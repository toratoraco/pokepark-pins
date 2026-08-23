import { useState } from "react";
import { ConfirmButton } from "./ConfirmButton";
import { deletePhoto } from "../db/photos";
import type { Collection } from "../store/useCollection";
import { PhotoSlot } from "./PhotoSlot";
import { ProgressBar } from "./ProgressBar";

export function CentersTab({ col }: { col: Collection }) {
  const centers = col.state.centers;
  const owned = centers.filter((c) => c.owned).length;
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", country: "日本", pokemon: "" });

  const groups: [string, typeof centers][] = [
    ["国内", centers.filter((c) => c.country === "日本")],
    ["海外", centers.filter((c) => c.country !== "日本")],
  ];

  const submit = () => {
    if (!form.name.trim()) return;
    col.addCenter({ ...form, name: form.name.trim(), owned: true, date: "", memo: "" });
    setForm({ name: "", region: "", country: "日本", pokemon: "" });
    setAdding(false);
  };

  return (
    <section>
      <ProgressBar value={owned} max={centers.length} />
      <p className="hint">
        各ポケモンセンターの「ロゴピンズ」をプリセット済み。チェックで所持を記録、入手日・メモ・📷写真も残せます。
      </p>
      {groups.map(([label, list]) => (
        <div key={label}>
          <h3 className="group-title">
            {label}（{list.filter((c) => c.owned).length}/{list.length}）
          </h3>
          <ul className="center-list">
            {list.map((c) => (
              <li key={c.id} className={c.owned ? "center-item owned" : "center-item"}>
                <label className="center-check">
                  <input type="checkbox" checked={c.owned} onChange={() => col.toggleCenter(c.id)} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.region}
                      {c.pokemon && c.pokemon !== "—" ? ` ／ ${c.pokemon}` : ""}
                    </small>
                    {c.note && <small className="note">※{c.note}</small>}
                  </span>
                </label>
                <div className="center-actions">
                  <PhotoSlot photoKey={`center-${c.id}`} title={c.name} size={36} />
                  <label className="date-inline" title="入手日">
                    <input
                      type="date"
                      value={c.date}
                      onChange={(e) => col.updateCenter(c.id, { date: e.target.value })}
                    />
                  </label>
                  <input
                    className="memo"
                    placeholder="メモ"
                    value={c.memo}
                    onChange={(e) => col.updateCenter(c.id, { memo: e.target.value })}
                  />
                  {c.custom && (
                    <ConfirmButton
                      onConfirm={() => {
                        col.removeCenter(c.id);
                        deletePhoto(`center-${c.id}`);
                      }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {adding ? (
        <div className="add-form">
          <input
            placeholder="店舗・ピンズ名（例: ポケモンセンター○○ 5周年ピン）"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="地域"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            <option value="日本">日本</option>
            <option value="海外">海外</option>
          </select>
          <input
            placeholder="デザインのポケモン"
            value={form.pokemon}
            onChange={(e) => setForm({ ...form, pokemon: e.target.value })}
          />
          <div className="form-buttons">
            <button className="primary" onClick={submit}>追加（所持として登録）</button>
            <button onClick={() => setAdding(false)}>キャンセル</button>
          </div>
        </div>
      ) : (
        <button className="primary add-button" onClick={() => setAdding(true)}>
          ＋ 店舗・限定ピンズを追加
        </button>
      )}
    </section>
  );
}
