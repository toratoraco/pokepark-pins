interface Props {
  value: number;
  max: number;
  // 表示形式（例: 金額なら ¥1,200）。省略時はそのままの数値
  format?: (n: number) => string;
}

export function ProgressBar({ value, max, format }: Props) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const fmt = format ?? ((n: number) => String(n));
  return (
    <div className="progress">
      <span className="progress-label">
        {fmt(value)} / {fmt(max)}（{pct.toFixed(1)}%）
      </span>
      <div className="progress-track">
        <div
          className={pct > 100 ? "progress-fill over" : "progress-fill"}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
