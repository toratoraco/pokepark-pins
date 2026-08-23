import { useState } from "react";
import { ConfirmButton } from "./ConfirmButton";
import { deletePhoto } from "../db/photos";
import type { Collection } from "../store/useCollection";
import { PhotoSlot } from "./PhotoSlot";

const emptyForm = { series: "", pokemon: "", date: "", memo: "" };

export function IrregularTab({ col }: { col: Collection }) {
  const items = col.state.irregular;
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);

  const title = (i: { series: string; pokemon: string }) =>
    [i.series, i.pokemon].filter(Boolean).join(" ") || "（名称未設定）";

  const submit = () => {
    const trimmed = { ...form, series: form.series.trim(), pokemon: form.pokemon.trim() };
    if (!trimmed.series && !trimmed.pokemon) return;
    if (editing) {
      col.updateIrregular(editing, trimmed);
      setEditing(null);
    } else {
      col.addIrregular(trimmed);
    }
    setForm(emptyForm);
  };

  return (
    <section>
      <p className="hint">
        ポケモンスリープのバッジなど、シリーズ外のピンバッジを自由に記録できます（現在 {items.length} 件）。📷から写真も残せます。
      </p>
      <ul className="irregular-list">
        {items.map((i) => (
          <li key={i.id} className="irregular-item">
            <PhotoSlot photoKey={`other-${i.id}`} title={title(i)} size={44} />
            <div className="irregular-body">
              <strong>{title(i)}</strong>
              <small>{[i.date, i.memo].filter(Boolean).join(" ／ ")}</small>
            </div>
            <div className="center-actions">
              <button
                onClick={() => {
                  setEditing(i.id);
                  setForm({ series: i.series, pokemon: i.pokemon, date: i.date, memo: i.memo });
                }}
              >
                編集
              </button>
              <ConfirmButton
                onConfirm={() => {
                  col.removeIrregular(i.id);
                  deletePhoto(`other-${i.id}`);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="add-form">
        {editing && <p className="modal-title">「{title(form)}」を編集中</p>}
        <label className="field-label">
          バッジシリーズ
          <input
            placeholder="例: ポケモンスリープ"
            value={form.series}
            onChange={(e) => setForm({ ...form, series: e.target.value })}
          />
        </label>
        <label className="field-label">
          ポケモン
          <input
            placeholder="例: カビゴン"
            value={form.pokemon}
            onChange={(e) => setForm({ ...form, pokemon: e.target.value })}
          />
        </label>
        <label className="field-label">
          入手日
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>
        <label className="field-label">
          メモ
          <input
            placeholder="入手場所など"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
          />
        </label>
        <div className="form-buttons">
          <button className="primary" onClick={submit}>
            {editing ? "更新" : "＋ 追加"}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
