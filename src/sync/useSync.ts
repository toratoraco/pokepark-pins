import { useCallback, useEffect, useRef, useState } from "react";
import type { Collection, CollectionState } from "../store/useCollection";
import {
  applyRemotePhoto,
  clearPhotoDirty,
  getDirtyPhotoKeys,
  getPhoto,
  notifyPhotosUpdated,
  removeLocalPhoto,
} from "../db/photos";
import {
  GitHubError,
  SyncConfig,
  b64ToBlob,
  b64ToText,
  blobToB64,
  deleteFile,
  getFile,
  listDir,
  putFile,
  textToB64,
} from "./github";

const CONFIG_KEY = "pokepark-pins:sync-config";
const META_KEY = "pokepark-pins:sync-meta";
const DATA_PATH = "data.json";
const PHOTOS_DIR = "photos";
const PUSH_DEBOUNCE_MS = 30_000;
const FOCUS_PULL_MIN_INTERVAL_MS = 60_000;

// リモートの data.json の中身
interface RemotePayload {
  updatedAt: number;
  deviceId: string;
  state: CollectionState;
}

interface SyncMeta {
  deviceId: string;
  // ローカル最終編集時刻。lastSyncedAt より大きければ「未pushの変更あり」
  localUpdatedAt: number;
  // 最後に同期が成立した時点の updatedAt
  lastSyncedAt: number;
  dataSha: string | null;
  // 前回同期時点のリモート写真sha。差分pullの判定に使う
  photoShas: Record<string, string>;
}

export type SyncStatus = "unconfigured" | "synced" | "dirty" | "syncing" | "offline" | "auth" | "error";

export interface SyncProgress {
  done: number;
  total: number;
}

export function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as SyncConfig;
    if (!cfg.token || !cfg.owner || !cfg.repo) return null;
    return cfg;
  } catch {
    return null;
  }
}

function loadMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as SyncMeta;
      if (m.deviceId) return { ...m, photoShas: m.photoShas ?? {} };
    }
  } catch {
    /* fall through */
  }
  return {
    deviceId: Math.random().toString(36).slice(2, 10),
    localUpdatedAt: 0,
    lastSyncedAt: 0,
    dataSha: null,
    photoShas: {},
  };
}

export function useSync(col: Collection) {
  const [config, setConfigState] = useState<SyncConfig | null>(loadConfig);
  const [status, setStatus] = useState<SyncStatus>(config ? "dirty" : "unconfigured");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [lastSyncedLabel, setLastSyncedLabel] = useState("");

  const metaRef = useRef<SyncMeta>(loadMeta());
  const stateRef = useRef(col.state);
  stateRef.current = col.state;
  const prevState = useRef(col.state);
  const applyingRemote = useRef(false);
  const syncing = useRef(false);
  const pendingResync = useRef(false);
  const debounceTimer = useRef<number | null>(null);
  const lastAttempt = useRef(0);

  const saveMeta = () => localStorage.setItem(META_KEY, JSON.stringify(metaRef.current));

  const isLocalDirty = () =>
    metaRef.current.localUpdatedAt > metaRef.current.lastSyncedAt || getDirtyPhotoKeys().length > 0;

  const setConfig = (cfg: SyncConfig | null) => {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
    setConfigState(cfg);
    setStatus(cfg ? "dirty" : "unconfigured");
  };

  const failWith = (e: unknown) => {
    if (e instanceof GitHubError && (e.status === 401 || e.status === 403)) {
      setStatus("auth");
      setMessage("認証エラー。PATの期限切れの可能性があります。設定を確認してください。");
    } else if (e instanceof TypeError) {
      // fetch自体の失敗＝オフライン。次回オンライン時のpushで回復する
      setStatus("offline");
      setMessage("オフラインのため未同期です");
    } else {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "同期に失敗しました");
    }
  };

  // リモートの写真をローカルへ差分反映（リモート採用時のみ呼ぶ）
  const pullPhotos = async (cfg: SyncConfig) => {
    const meta = metaRef.current;
    const entries = await listDir(cfg, PHOTOS_DIR);
    const remote = new Map<string, { name: string; sha: string }>();
    for (const e of entries) {
      if (e.name.endsWith(".jpg")) remote.set(e.name.slice(0, -4), e);
    }
    const dirty = new Set(getDirtyPhotoKeys()); // この端末で編集済みの写真はpullで潰さない
    let changed = false;
    for (const [key, e] of remote) {
      if (meta.photoShas[key] === e.sha || dirty.has(key)) continue;
      const f = await getFile(cfg, `${PHOTOS_DIR}/${encodeURIComponent(e.name)}`);
      if (!f) continue;
      await applyRemotePhoto(key, b64ToBlob(f.contentB64));
      meta.photoShas[key] = e.sha;
      changed = true;
    }
    for (const key of Object.keys(meta.photoShas)) {
      if (!remote.has(key) && !dirty.has(key)) {
        await removeLocalPhoto(key);
        delete meta.photoShas[key];
        changed = true;
      }
    }
    if (changed) notifyPhotosUpdated();
  };

  const pull = async (cfg: SyncConfig) => {
    const meta = metaRef.current;
    const f = await getFile(cfg, DATA_PATH);
    if (!f) return; // まだリモートにデータがない
    meta.dataSha = f.sha;
    const payload = JSON.parse(b64ToText(f.contentB64)) as RemotePayload;
    if (payload.updatedAt > meta.lastSyncedAt) {
      if (isLocalDirty()) {
        const useRemote = window.confirm(
          "もう一方の端末に新しいデータがありますが、この端末にも未同期の変更があります。\n" +
            "OK: リモートのデータを取り込む（この端末の未同期の変更は破棄）\n" +
            "キャンセル: この端末のデータを優先（リモートを上書き）"
        );
        if (!useRemote) {
          saveMeta();
          return; // 直後のpushでリモートを上書きする
        }
      }
      applyingRemote.current = true;
      col.importState(JSON.stringify(payload.state));
      await pullPhotos(cfg);
      meta.localUpdatedAt = payload.updatedAt;
      meta.lastSyncedAt = payload.updatedAt;
    }
    saveMeta();
  };

  const pushPhotos = async (cfg: SyncConfig) => {
    const meta = metaRef.current;
    const keys = getDirtyPhotoKeys();
    if (keys.length === 0) return;
    setProgress({ done: 0, total: keys.length });
    try {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const path = `${PHOTOS_DIR}/${encodeURIComponent(key)}.jpg`;
        const blob = await getPhoto(key);
        if (blob) {
          const b64 = await blobToB64(blob);
          try {
            meta.photoShas[key] = await putFile(cfg, path, b64, meta.photoShas[key]);
          } catch (e) {
            // sha不一致（他端末が先に更新）→ 最新shaを取り直して1回だけ再試行
            if (e instanceof GitHubError && (e.status === 409 || e.status === 422)) {
              const cur = await getFile(cfg, path);
              meta.photoShas[key] = await putFile(cfg, path, b64, cur?.sha);
            } else {
              throw e;
            }
          }
        } else {
          const sha = meta.photoShas[key] ?? (await getFile(cfg, path))?.sha;
          if (sha) await deleteFile(cfg, path, sha);
          delete meta.photoShas[key];
        }
        clearPhotoDirty(key);
        saveMeta();
        setProgress({ done: i + 1, total: keys.length });
      }
    } finally {
      setProgress(null);
    }
  };

  const push = async (cfg: SyncConfig) => {
    const meta = metaRef.current;
    if (meta.localUpdatedAt > meta.lastSyncedAt) {
      const payload: RemotePayload = {
        updatedAt: meta.localUpdatedAt,
        deviceId: meta.deviceId,
        state: stateRef.current,
      };
      const b64 = textToB64(JSON.stringify(payload));
      try {
        meta.dataSha = await putFile(cfg, DATA_PATH, b64, meta.dataSha ?? undefined);
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 409 || e.status === 422)) {
          const cur = await getFile(cfg, DATA_PATH);
          meta.dataSha = await putFile(cfg, DATA_PATH, b64, cur?.sha);
        } else {
          throw e;
        }
      }
      meta.lastSyncedAt = meta.localUpdatedAt;
      saveMeta();
    }
    await pushPhotos(cfg);
  };

  const sync = useCallback(async () => {
    const cfg = loadConfig();
    if (!cfg) return;
    if (syncing.current) {
      pendingResync.current = true;
      return;
    }
    syncing.current = true;
    lastAttempt.current = Date.now();
    setStatus("syncing");
    setMessage("");
    try {
      await pull(cfg);
      await push(cfg);
      setStatus("synced");
      setLastSyncedLabel(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      failWith(e);
    } finally {
      syncing.current = false;
      if (pendingResync.current) {
        pendingResync.current = false;
        void sync();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleSync = useCallback(() => {
    if (!loadConfig()) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => void sync(), PUSH_DEBOUNCE_MS);
  }, [sync]);

  // ローカル編集の検知（初回レンダー・StrictModeの再実行・リモート適用によるstate変化は除外）
  useEffect(() => {
    if (prevState.current === col.state) return;
    prevState.current = col.state;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    metaRef.current.localUpdatedAt = Date.now();
    saveMeta();
    if (loadConfig()) {
      setStatus((s) => (s === "syncing" ? s : "dirty"));
      scheduleSync();
    }
  }, [col.state, scheduleSync]);

  // 写真の変更検知
  useEffect(() => {
    const onDirty = () => {
      if (loadConfig()) {
        setStatus((s) => (s === "syncing" ? s : "dirty"));
        scheduleSync();
      }
    };
    window.addEventListener("photos-dirty", onDirty);
    return () => window.removeEventListener("photos-dirty", onDirty);
  }, [scheduleSync]);

  // 起動時と、アプリに戻ってきた時のpull
  useEffect(() => {
    if (config) void sync();
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        loadConfig() &&
        Date.now() - lastAttempt.current > FOCUS_PULL_MIN_INTERVAL_MS
      ) {
        void sync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, sync]);

  return {
    config,
    setConfig,
    status,
    message,
    progress,
    lastSyncedLabel,
    syncNow: sync,
  };
}

export type Sync = ReturnType<typeof useSync>;
