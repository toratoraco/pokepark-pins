import { useState } from "react";
import { KANTO_POKEMON } from "./data/pokemon";
import { useCollection } from "./store/useCollection";
import { PokeParkTab } from "./components/PokeParkTab";
import { CentersTab } from "./components/CentersTab";
import { IrregularTab } from "./components/IrregularTab";
import { ExportImport } from "./components/ExportImport";

type Tab = "pokepark" | "centers" | "irregular";

const TABS: [Tab, string][] = [
  ["pokepark", "ポケパーク 151"],
  ["centers", "ポケセン ロゴピンズ"],
  ["irregular", "その他"],
];

export default function App() {
  const col = useCollection();
  const [tab, setTab] = useState<Tab>("pokepark");

  const parkOwned = KANTO_POKEMON.filter((p) => (col.state.pokepark[p.id] ?? 0) > 0).length;
  const centersOwned = col.state.centers.filter((c) => c.owned).length;

  return (
    <div className="app">
      <header className="header">
        <h1>ピンズコレクション</h1>
        <p className="summary">
          ポケパーク {parkOwned}/{KANTO_POKEMON.length} ・ ポケセン {centersOwned}/
          {col.state.centers.length} ・ その他 {col.state.irregular.length}件
        </p>
      </header>
      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "pokepark" && <PokeParkTab col={col} />}
        {tab === "centers" && <CentersTab col={col} />}
        {tab === "irregular" && <IrregularTab col={col} />}
      </main>
      <footer className="footer">
        <ExportImport col={col} />
        <p className="hint">データはこのブラウザ内（localStorage）に保存されます。機種変更前にバックアップを。</p>
      </footer>
    </div>
  );
}
