import { useState } from "react";
import { checkRepo } from "../sync/github";
import type { Sync } from "../sync/useSync";

const STATUS_LABEL: Record<string, string> = {
  unconfigured: "未設定",
  synced: "同期済み",
  dirty: "未同期の変更あり",
  syncing: "同期中…",
  offline: "オフライン",
  auth: "要再設定（認証エラー）",
  error: "エラー",
};

export function SyncSettings({ sync }: { sync: Sync }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(sync.config?.owner ?? "");
  const [repo, setRepo] = useState(sync.config?.repo ?? "");
  const [token, setToken] = useState(sync.config?.token ?? "");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const save = async () => {
    const cfg = { owner: owner.trim(), repo: repo.trim(), token: token.trim() };
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      setTestResult("すべての項目を入力してください");
      return;
    }
    setTesting(true);
    setTestResult("");
    try {
      await checkRepo(cfg);
      sync.setConfig(cfg);
      setTestResult("接続OK。同期を開始します。");
      void sync.syncNow();
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "接続に失敗しました");
    } finally {
      setTesting(false);
    }
  };

  const disconnect = () => {
    if (window.confirm("同期設定を削除しますか？（データ自体は消えません）")) {
      sync.setConfig(null);
      setToken("");
      setTestResult("");
    }
  };

  return (
    <div className="sync-settings">
      <button onClick={() => setOpen(!open)}>
        {open ? "同期設定を閉じる" : `同期設定（${STATUS_LABEL[sync.status] ?? sync.status}）`}
      </button>
      {open && (
        <div className="sync-form">
          <p className="hint">
            GitHubのプライベートリポジトリをデータ置き場にして、スマホとPCで同期します。
            fine-grained PAT（対象をデータ用リポジトリのみ・権限は Contents: Read and write のみ）を使ってください。
          </p>
          <label>
            GitHubユーザー名
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="例: toratoraco" autoCapitalize="none" />
          </label>
          <label>
            データ用リポジトリ名（プライベート）
            <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="例: pokepark-pins-data" autoCapitalize="none" />
          </label>
          <label>
            Personal Access Token
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
            />
          </label>
          <div className="sync-actions">
            <button onClick={save} disabled={testing}>
              {testing ? "接続確認中…" : "接続テストして保存"}
            </button>
            <button onClick={() => void sync.syncNow()} disabled={!sync.config || testing}>
              今すぐ同期
            </button>
            {sync.config && (
              <button className="danger" onClick={disconnect}>
                同期設定を削除
              </button>
            )}
          </div>
          {testResult && <p className="hint">{testResult}</p>}
          {sync.message && <p className="hint">{sync.message}</p>}
          {sync.progress && (
            <p className="hint">
              写真を同期中… {sync.progress.done}/{sync.progress.total}
            </p>
          )}
          {sync.lastSyncedLabel && <p className="hint">最終同期: {sync.lastSyncedLabel}</p>}
        </div>
      )}
    </div>
  );
}
