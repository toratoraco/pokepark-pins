import { useEffect, useRef, useState } from "react";
import { deletePhoto, getPhoto, putPhoto } from "../db/photos";
import { ConfirmButton } from "./ConfirmButton";
import { PhotoCropper } from "./PhotoCropper";

interface Props {
  photoKey: string;
  title: string;
  size?: number;
}

export function PhotoSlot({ photoKey, title, size = 36 }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [viewing, setViewing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    getPhoto(photoKey).then((b) => {
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return b ? URL.createObjectURL(b) : null;
      });
    });
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("photos-updated", handler);
    return () => window.removeEventListener("photos-updated", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setCropFile(f);
          e.target.value = "";
        }}
      />
      {url ? (
        <button
          className="photo-thumb"
          style={{ width: size, height: size }}
          onClick={() => setViewing(true)}
          title={`${title} の写真を見る`}
        >
          <img src={url} alt={`${title} の写真`} />
        </button>
      ) : (
        <button
          className="photo-add"
          style={{ width: size, height: size }}
          onClick={() => inputRef.current?.click()}
          title={`${title} の写真を追加`}
        >
          📷
        </button>
      )}
      {cropFile && (
        <PhotoCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onSave={async (blob) => {
            await putPhoto(photoKey, blob);
            setCropFile(null);
            refresh();
          }}
        />
      )}
      {viewing && url && (
        <div className="modal-overlay" onClick={() => setViewing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <img className="photo-full" src={url} alt={title} />
            <p className="modal-title">{title}</p>
            <div className="form-buttons">
              <button
                onClick={() => {
                  setViewing(false);
                  inputRef.current?.click();
                }}
              >
                撮り直す
              </button>
              <ConfirmButton
                onConfirm={async () => {
                  await deletePhoto(photoKey);
                  setViewing(false);
                  refresh();
                }}
              />
              <button onClick={() => setViewing(false)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
