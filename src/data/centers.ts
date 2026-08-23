export interface CenterPreset {
  id: string;
  name: string;
  region: string;
  country: "日本" | "海外";
  pokemon: string;
  note?: string;
}

// ロゴピンズ販売実績のあるポケモンセンター店舗（2026年8月時点の調査に基づく）
export const CENTER_PRESETS: CenterPreset[] = [
  { id: "sapporo", name: "ポケモンセンターサッポロ", region: "北海道", country: "日本", pokemon: "ピカチュウ・アローラロコン・アシマリ" },
  { id: "tohoku", name: "ポケモンセンタートウホク", region: "宮城", country: "日本", pokemon: "ピカチュウ・ビクティニ" },
  { id: "tokyo-dx", name: "ポケモンセンタートウキョーDX", region: "東京・日本橋", country: "日本", pokemon: "ピカチュウ・ミュウ" },
  { id: "mega-tokyo", name: "ポケモンセンターメガトウキョー", region: "東京・池袋", country: "日本", pokemon: "ピカチュウ・ミライドン" },
  { id: "skytree", name: "ポケモンセンタースカイツリータウン", region: "東京・押上", country: "日本", pokemon: "ピカチュウ・レックウザ" },
  { id: "shibuya", name: "ポケモンセンターシブヤ", region: "東京・渋谷", country: "日本", pokemon: "—", note: "ロゴピンズ販売なし（参考掲載）" },
  { id: "tokyo-bay", name: "ポケモンセンタートーキョーベイ", region: "千葉・船橋", country: "日本", pokemon: "ピカチュウ・デンリュウ・マリルリ" },
  { id: "yokohama", name: "ポケモンセンターヨコハマ", region: "神奈川", country: "日本", pokemon: "ピカチュウ・アシマリ・ドダイトス" },
  { id: "nagoya", name: "ポケモンセンターナゴヤ", region: "愛知", country: "日本", pokemon: "ピカチュウ・セレビィ" },
  { id: "kyoto", name: "ポケモンセンターキョウト", region: "京都", country: "日本", pokemon: "ピカチュウ・ホウオウ" },
  { id: "osaka-dx", name: "ポケモンセンターオーサカDX", region: "大阪・心斎橋", country: "日本", pokemon: "ピカチュウ・サルノリ・ニャース" },
  { id: "osaka", name: "ポケモンセンターオーサカ", region: "大阪・梅田", country: "日本", pokemon: "ピカチュウ・コライドン" },
  { id: "hiroshima", name: "ポケモンセンターヒロシマ", region: "広島", country: "日本", pokemon: "ピカチュウ・赤いギャラドス" },
  { id: "kagawa", name: "ポケモンセンター出張所（カガワ）", region: "香川", country: "日本", pokemon: "ピカチュウ・ヤドン" },
  { id: "fukuoka", name: "ポケモンセンターフクオカ", region: "福岡", country: "日本", pokemon: "ピカチュウ・ラティアス・ラティオス" },
  { id: "okinawa", name: "ポケモンセンターオキナワ", region: "沖縄", country: "日本", pokemon: "ピカチュウ・ガーディ（ウインディ）" },
  { id: "singapore", name: "Pokémon Center Singapore", region: "ジュエル・チャンギ空港", country: "海外", pokemon: "ピカチュウ・ラプラス・セレビィ", note: "2026年7月リニューアル後はソルガレオ" },
  { id: "taipei", name: "Pokémon Center Taipei", region: "台北", country: "海外", pokemon: "ピカチュウ・カイリュー" },
];
