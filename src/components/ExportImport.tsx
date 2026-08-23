import { useRef, useState } from "react";
import { getAllPhotos, notifyPhotosUpdated, putPhoto } from "../db/photos";
import type { Collection } from "../store/useCollection";

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function ExportImport({ col }: { col: Collection }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      const photos = await getAllPhotos();
      const encoded: Record<string, string> = {};
      for (const [key, blob] of Object.entries(photos)) {
        encoded[key] = await blobToDataURL(blob);
      }
      const payload = { ...col.state, photos: encoded };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pin-collection-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const doImport = (file: File) => {
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // 写真はIndexedDBへ、それ以外はlocalStorageへ（写真をlocalStorageに入れると容量超過するため分離）
        const photos: Record<string, string> = parsed.photos ?? {};
        delete parsed.photos;
        const ok = col.importState(JSON.stringify(parsed));
        if (!ok) {
          alert("ファイルの形式が正しくありません");
          return;
        }
        for (const [key, dataUrl] of Object.entries(photos)) {
          const blob = await (await fetch(dataUrl)).blob();
          await putPhoto(key, blob);
        }
        notifyPhotosUpdated();
        alert("インポートしました");
      } catch {
        alert("ファイルの形式が正しくありません");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="export-import">
      <button onClick={doExport} disabled={busy}>
        バックアップ（写真込みJSON書き出し）
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy}>
        復元（JSON読み込み）
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) doImport(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
