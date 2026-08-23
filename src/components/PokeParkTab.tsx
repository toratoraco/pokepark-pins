import { useState } from "react";
import { KANTO_POKEMON, spriteUrl } from "../data/pokemon";
import type { Collection } from "../store/useCollection";
import { ConfirmButton } from "./ConfirmButton";
import { PhotoSlot } from "./PhotoSlot";
import { ProgressBar } from "./ProgressBar";

type Filter = "all" | "owned" | "missing" | "dupes";

const today = () => new Date().toISOString().slice(0, 10);

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${y}/${Number(m)}/${Number(day)}`;
};

export function PokeParkTab({ col }: { col: Collection }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  // タップで+1した時に初回入手日として記録する日付（過去の入手分を登録する時はここを変える）
  const [acqDate, setAcqDate] = useState(today);
  const [sortMode, setSortMode] = useState<"dex" | "acq">("dex");
  // 詳細編集モーダル対象の図鑑番号
  const [editingDate, setEditingDate] = useState<number | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [memoDraft, setMemoDraft] = useState("");
  const [priceDraft, setPriceDraft] = useState("");

  const counts = col.state.pokepark;
  const ownedKinds = KANTO_POKEMON.filter((p) => (counts[p.id] ?? 0) > 0).length;
  const dupes = KANTO_POKEMON.filter((p) => (counts[p.id] ?? 0) >= 2);

  // コスト進捗: 所持している種類ごとに記録金額（未記録は基本の1,200円）を合算
  const DEFAULT_PRICE = 1200;
  const costNow = KANTO_POKEMON.reduce((sum, p) => {
    if ((counts[p.id] ?? 0) === 0) return sum;
    return sum + (col.state.pokeparkPrices[p.id] ?? DEFAULT_PRICE);
  }, 0);
  const costMax = DEFAULT_PRICE * KANTO_POKEMON.length;
  const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

  // 取得順: 入手日→同日内はタップ順で並べ、日付なし所持→未所持（図鑑順）と続ける
  const acqSortKey = (id: number): [number, number, number, number] => {
    const owned = (counts[id] ?? 0) > 0;
    const date = col.state.pokeparkDates[id];
    if (owned && date) return [0, Date.parse(date), col.state.pokeparkSeq[id] ?? 0, id];
    if (owned) return [1, 0, col.state.pokeparkSeq[id] ?? 0, id];
    return [2, 0, 0, id];
  };

  const sorted =
    sortMode === "dex"
      ? KANTO_POKEMON
      : [...KANTO_POKEMON].sort((a, b) => {
          const ka = acqSortKey(a.id);
          const kb = acqSortKey(b.id);
          for (let i = 0; i < ka.length; i++) {
            if (ka[i] !== kb[i]) return ka[i] - kb[i];
          }
          return 0;
        });

  const visible = sorted.filter((p) => {
    const n = counts[p.id] ?? 0;
    if (filter === "owned" && n === 0) return false;
    if (filter === "missing" && n > 0) return false;
    if (filter === "dupes" && n < 2) return false;
    if (query && !p.ja.includes(query) && !p.en.toLowerCase().includes(query.toLowerCase()) && String(p.id) !== query) {
      return false;
    }
    return true;
  });

  return (
    <section>
      <ProgressBar value={ownedKinds} max={KANTO_POKEMON.length} />
      <ProgressBar value={costNow} max={costMax} format={yen} />
      <p className="hint">
        タップで +1（ダブりも記録）、右下の−で -1。ダブり{dupes.length}種は園内スタッフとの交換に使えます。
        初めて入手したポケモンには下の「入手日」が記録されます（カードの日付タップで変更可）。
      </p>
      <div className="toolbar">
        <label className="acq-date">
          入手日
          <input type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value || today())} />
        </label>
        <input
          type="search"
          placeholder="名前・図鑑番号で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filter-group">
          {(
            [
              ["all", "すべて"],
              ["owned", "所持"],
              ["missing", "未所持"],
              ["dupes", "ダブり"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "chip active" : "chip"}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          {(
            [
              ["dex", "図鑑順"],
              ["acq", "取得順"],
            ] as ["dex" | "acq", string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={sortMode === key ? "chip active" : "chip"}
              onClick={() => setSortMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="poke-grid">
        {visible.map((p) => {
          const n = counts[p.id] ?? 0;
          const d = col.state.pokeparkDates[p.id];
          return (
            <div key={p.id} className={n > 0 ? "poke-card owned" : "poke-card"}>
              <button
                className="poke-main"
                onClick={() => col.changePokeparkCount(p.id, 1, acqDate)}
                title={`${p.ja} を +1`}
              >
                <img src={spriteUrl(p.id)} alt={p.ja} loading="lazy" />
                <span className="poke-no">No.{String(p.id).padStart(3, "0")}</span>
                <span className="poke-name">{p.ja}</span>
              </button>
              {n > 0 && (
                <button
                  className="poke-date"
                  onClick={() => {
                    setEditingDate(p.id);
                    setDateDraft(d ?? acqDate);
                    setMemoDraft(col.state.pokeparkMemos[p.id] ?? "");
                    setPriceDraft(String(col.state.pokeparkPrices[p.id] ?? 1200));
                  }}
                  title="入手日・取得経緯を編集"
                >
                  {d ? fmtDate(d) : "日付未設定"}
                  {col.state.pokeparkMemos[p.id] && (
                    <span className="poke-memo">{col.state.pokeparkMemos[p.id]}</span>
                  )}
                </button>
              )}
              <div className="poke-photo">
                <PhotoSlot photoKey={`poke-${p.id}`} title={`${p.ja} のピンバッジ`} size={26} />
              </div>
              {n > 0 && (
                <>
                  <span className={n >= 2 ? "count-badge dupe" : "count-badge"}>×{n}</span>
                  {n === 1 ? (
                    // 0個に戻すと入手日も消えるため、最後の1個だけは二度押しで確認
                    <ConfirmButton
                      label="−"
                      confirmLabel="0にする?"
                      className="minus"
                      onConfirm={() => col.changePokeparkCount(p.id, -1)}
                    />
                  ) : (
                    <button
                      className="minus"
                      onClick={() => col.changePokeparkCount(p.id, -1)}
                      title={`${p.ja} を -1`}
                    >
                      −
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {visible.length === 0 && <p className="empty">該当するポケモンがいません</p>}
      {editingDate !== null && (
        <div className="modal-overlay" onClick={() => setEditingDate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">
              {KANTO_POKEMON.find((p) => p.id === editingDate)?.ja} の入手記録
            </p>
            <label className="field-label">
              初回入手日
              <input type="date" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} />
            </label>
            <label className="field-label">
              取得経緯
              <input value={memoDraft} onChange={(e) => setMemoDraft(e.target.value)} />
            </label>
            <div className="filter-group">
              {["ポケパーク", "交換", "購入", "チャールズ"].map((m) => (
                <button key={m} className="chip" onClick={() => setMemoDraft(m)}>
                  {m}
                </button>
              ))}
            </div>
            <label className="field-label">
              購入金額（円）
              <input
                type="text"
                inputMode="numeric"
                value={priceDraft === "" ? "" : Number(priceDraft).toLocaleString("ja-JP")}
                onChange={(e) => setPriceDraft(e.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
            <div className="form-buttons">
              <button
                className="primary"
                onClick={() => {
                  col.setPokeparkDate(editingDate, dateDraft);
                  col.setPokeparkMemo(editingDate, memoDraft.trim());
                  const price = priceDraft.trim() === "" ? null : Number(priceDraft);
                  col.setPokeparkPrice(editingDate, Number.isFinite(price as number) ? (price as number) : null);
                  setEditingDate(null);
                }}
              >
                保存
              </button>
              <button
                className="delete"
                onClick={() => {
                  col.setPokeparkDate(editingDate, "");
                  setEditingDate(null);
                }}
              >
                日付を消す
              </button>
              <button onClick={() => setEditingDate(null)}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
