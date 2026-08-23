import { useEffect, useRef, useState } from "react";

// 保存サイズ: 512x512 JPEG（1枚あたり数十KB程度に収まる）
const OUT_SIZE = 512;
const MAX_ZOOM = 8;

interface Props {
  file: File;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
}

export function PhotoCropper({ file, onSave, onCancel }: Props) {
  const [size] = useState(() => Math.min(window.innerWidth - 48, 320));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // k: 表示倍率, ox/oy: 画像左上のキャンバス内位置
  const view = useRef({ k: 1, kMin: 1, ox: 0, oy: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  const draw = () => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d")!;
    const { k, ox, oy } = view.current;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, ox, oy, img.naturalWidth * k, img.naturalHeight * k);
  };

  const clamp = () => {
    const img = imgRef.current!;
    const v = view.current;
    v.k = Math.max(v.kMin, Math.min(v.k, v.kMin * MAX_ZOOM));
    v.ox = Math.min(0, Math.max(size - img.naturalWidth * v.k, v.ox));
    v.oy = Math.min(0, Math.max(size - img.naturalHeight * v.k, v.oy));
  };

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const kMin = size / Math.min(img.naturalWidth, img.naturalHeight);
      view.current = {
        k: kMin,
        kMin,
        ox: (size - img.naturalWidth * kMin) / 2,
        oy: (size - img.naturalHeight * kMin) / 2,
      };
      setReady(true);
      requestAnimationFrame(draw);
    };
    img.onerror = () => {
      if (!cancelled) setError(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const v = view.current;
    const k2 = Math.max(v.kMin, Math.min(v.k * factor, v.kMin * MAX_ZOOM));
    const f = k2 / v.k;
    v.ox = cx - (cx - v.ox) * f;
    v.oy = cy - (cy - v.oy) * f;
    v.k = k2;
    clamp();
    draw();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const pts = pointers.current;
    const prev = pts.get(e.pointerId);
    if (!prev || !imgRef.current) return;
    if (pts.size === 2) {
      // ピンチで拡大縮小
      const [a1, b1] = [...pts.values()];
      const before = Math.hypot(a1.x - b1.x, a1.y - b1.y);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a2, b2] = [...pts.values()];
      const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      if (before > 0) zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, after / before);
    } else {
      const v = view.current;
      v.ox += e.clientX - prev.x;
      v.oy += e.clientY - prev.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clamp();
      draw();
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const save = () => {
    const img = imgRef.current!;
    const { k, ox, oy } = view.current;
    const out = document.createElement("canvas");
    out.width = OUT_SIZE;
    out.height = OUT_SIZE;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(img, -ox / k, -oy / k, size / k, size / k, 0, 0, OUT_SIZE, OUT_SIZE);
    out.toBlob(
      (b) => {
        if (b) onSave(b);
      },
      "image/jpeg",
      0.85
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <p className="modal-title">バッジ部分を正方形に切り抜き</p>
        {error ? (
          <p className="hint">この画像は読み込めませんでした。別の写真を選んでください。</p>
        ) : (
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            className="crop-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onWheel={(e) => zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9)}
          />
        )}
        <p className="hint" style={{ margin: 0 }}>
          ドラッグで位置調整、ピンチ／ホイールで拡大縮小
        </p>
        <div className="form-buttons">
          <button className="primary" onClick={save} disabled={!ready || error}>
            この範囲で保存
          </button>
          <button onClick={onCancel}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
