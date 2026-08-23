import { useEffect, useState } from "react";
import { CENTER_PRESETS } from "../data/centers";

export interface CenterEntry {
  id: string;
  name: string;
  region: string;
  country: string;
  pokemon: string;
  note?: string;
  owned: boolean;
  date: string; // 入手日（YYYY-MM-DD）
  memo: string;
  custom: boolean;
}

export interface IrregularEntry {
  id: string;
  series: string;
  pokemon: string;
  date: string; // 年月（YYYY-MM）
  memo: string;
}

export interface CollectionState {
  version: 1;
  // 図鑑番号 -> 所持数（ダブり含む）。0または未定義は未所持
  pokepark: Record<number, number>;
  // 図鑑番号 -> 初回入手日（YYYY-MM-DD）
  pokeparkDates: Record<number, string>;
  // 図鑑番号 -> 初回入手時刻（ミリ秒）。同じ日付内の取得順の並び替えに使う
  pokeparkSeq: Record<number, number>;
  // 図鑑番号 -> 取得経緯メモ（ポケパーク／交換／購入店舗名など一言）
  pokeparkMemos: Record<number, string>;
  // 図鑑番号 -> 購入金額（円）。基本は1200円
  pokeparkPrices: Record<number, number>;
  centers: CenterEntry[];
  irregular: IrregularEntry[];
}

const STORAGE_KEY = "pokepark-pins:v1";

function defaultState(): CollectionState {
  return {
    version: 1,
    pokepark: {},
    pokeparkDates: {},
    pokeparkSeq: {},
    pokeparkMemos: {},
    pokeparkPrices: {},
    centers: CENTER_PRESETS.map((c) => ({ ...c, owned: false, date: "", memo: "", custom: false })),
    irregular: [],
  };
}

function load(): CollectionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as CollectionState;
    if (parsed.version !== 1) return defaultState();
    // プリセット店舗が増えた場合は追記する（既存の所持状態は維持）
    parsed.pokeparkDates = parsed.pokeparkDates ?? {};
    parsed.pokeparkSeq = parsed.pokeparkSeq ?? {};
    parsed.pokeparkMemos = parsed.pokeparkMemos ?? {};
    parsed.pokeparkPrices = parsed.pokeparkPrices ?? {};
    const known = new Set(parsed.centers.map((c) => c.id));
    for (const preset of CENTER_PRESETS) {
      if (!known.has(preset.id)) {
        parsed.centers.push({ ...preset, owned: false, date: "", memo: "", custom: false });
      }
    }
    parsed.centers = parsed.centers.map((c) => ({ ...c, date: c.date ?? "" }));
    // 旧形式（name項目）のその他バッジを新形式（pokemon項目）へ移行
    parsed.irregular = parsed.irregular.map((i) => {
      const legacy = i as IrregularEntry & { name?: string };
      return {
        id: i.id,
        series: i.series ?? "",
        pokemon: i.pokemon ?? legacy.name ?? "",
        date: i.date ?? "",
        memo: i.memo ?? "",
      };
    });
    return parsed;
  } catch {
    return defaultState();
  }
}

export function useCollection() {
  const [state, setState] = useState<CollectionState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // acquiredOn: 0個→1個になった時に初回入手日として記録する日付
  const changePokeparkCount = (id: number, delta: number, acquiredOn?: string) =>
    setState((s) => {
      const prev = s.pokepark[id] ?? 0;
      const next = Math.max(0, prev + delta);
      const dates = { ...s.pokeparkDates };
      const seq = { ...s.pokeparkSeq };
      const memos = { ...s.pokeparkMemos };
      const prices = { ...s.pokeparkPrices };
      if (prev === 0 && next > 0) {
        if (acquiredOn && !dates[id]) dates[id] = acquiredOn;
        if (!seq[id]) seq[id] = Date.now();
      }
      if (next === 0) {
        delete dates[id];
        delete seq[id];
        delete memos[id];
        delete prices[id];
      }
      return {
        ...s,
        pokepark: { ...s.pokepark, [id]: next },
        pokeparkDates: dates,
        pokeparkSeq: seq,
        pokeparkMemos: memos,
        pokeparkPrices: prices,
      };
    });

  const setPokeparkPrice = (id: number, price: number | null) =>
    setState((s) => {
      const prices = { ...s.pokeparkPrices };
      if (price !== null && price >= 0) prices[id] = price;
      else delete prices[id];
      return { ...s, pokeparkPrices: prices };
    });

  const setPokeparkMemo = (id: number, memo: string) =>
    setState((s) => {
      const memos = { ...s.pokeparkMemos };
      if (memo) memos[id] = memo;
      else delete memos[id];
      return { ...s, pokeparkMemos: memos };
    });

  const setPokeparkDate = (id: number, date: string) =>
    setState((s) => {
      const dates = { ...s.pokeparkDates };
      if (date) dates[id] = date;
      else delete dates[id];
      return { ...s, pokeparkDates: dates };
    });

  const toggleCenter = (id: string) =>
    setState((s) => ({
      ...s,
      centers: s.centers.map((c) => (c.id === id ? { ...c, owned: !c.owned } : c)),
    }));

  const updateCenter = (id: string, patch: Partial<CenterEntry>) =>
    setState((s) => ({
      ...s,
      centers: s.centers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));

  const addCenter = (entry: Omit<CenterEntry, "id" | "custom">) =>
    setState((s) => ({
      ...s,
      centers: [...s.centers, { ...entry, id: `custom-${Date.now()}`, custom: true }],
    }));

  const removeCenter = (id: string) =>
    setState((s) => ({ ...s, centers: s.centers.filter((c) => c.id !== id) }));

  const addIrregular = (entry: Omit<IrregularEntry, "id">) =>
    setState((s) => ({
      ...s,
      irregular: [...s.irregular, { ...entry, id: `irr-${Date.now()}` }],
    }));

  const updateIrregular = (id: string, patch: Partial<IrregularEntry>) =>
    setState((s) => ({
      ...s,
      irregular: s.irregular.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));

  const removeIrregular = (id: string) =>
    setState((s) => ({ ...s, irregular: s.irregular.filter((i) => i.id !== id) }));

  const importState = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as CollectionState;
      if (parsed.version !== 1 || typeof parsed.pokepark !== "object" || !Array.isArray(parsed.centers)) {
        return false;
      }
      setState(parsed);
      return true;
    } catch {
      return false;
    }
  };

  return {
    state,
    changePokeparkCount,
    setPokeparkDate,
    setPokeparkMemo,
    setPokeparkPrice,
    toggleCenter,
    updateCenter,
    addCenter,
    removeCenter,
    addIrregular,
    updateIrregular,
    removeIrregular,
    importState,
  };
}

export type Collection = ReturnType<typeof useCollection>;
