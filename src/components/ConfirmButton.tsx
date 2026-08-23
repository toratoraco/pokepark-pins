import { useEffect, useRef, useState } from "react";

// confirm()ダイアログはブラウザによってはブロックされるため、
// 1回目のタップで「本当に削除？」に変わり、2回目で実行する方式にする。
interface Props {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
}

export function ConfirmButton({ label = "削除", confirmLabel = "本当に削除？", onConfirm, className = "delete" }: Props) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      className={armed ? `${className} armed` : className}
      onClick={() => {
        if (armed) {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = window.setTimeout(() => setArmed(false), 3000);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
