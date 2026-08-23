// バッジ写真の保存先。localStorage（約5MB上限）では足りないためIndexedDBを使う。
// キーは "poke-{図鑑番号}" / "center-{店舗id}" / "other-{id}"
const DB_NAME = "pokepark-photos";
const STORE = "photos";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function reqToPromise<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function putPhoto(key: string, blob: Blob): Promise<void> {
  await reqToPromise((await store("readwrite")).put(blob, key));
  markPhotoDirty(key);
}

export async function getPhoto(key: string): Promise<Blob | undefined> {
  return reqToPromise((await store("readonly")).get(key));
}

export async function deletePhoto(key: string): Promise<void> {
  await reqToPromise((await store("readwrite")).delete(key));
  markPhotoDirty(key);
}

// ---- 同期用: dirty追跡と、dirtyにしない内部書き込み（リモートからのpull適用時に使う） ----

const DIRTY_KEY = "pokepark-pins:dirty-photos";

function readDirty(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DIRTY_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeDirty(set: Set<string>) {
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...set]));
}

export function markPhotoDirty(key: string) {
  const set = readDirty();
  set.add(key);
  writeDirty(set);
  window.dispatchEvent(new Event("photos-dirty"));
}

export function getDirtyPhotoKeys(): string[] {
  return [...readDirty()];
}

export function clearPhotoDirty(key: string) {
  const set = readDirty();
  set.delete(key);
  writeDirty(set);
}

/** 全写真をdirty扱いにする（バックアップJSONインポート後など、次回pushで全反映させたい時） */
export async function markAllPhotosDirty(): Promise<void> {
  const s = await store("readonly");
  const keys = (await reqToPromise(s.getAllKeys())) as string[];
  const set = readDirty();
  keys.forEach((k) => set.add(k));
  writeDirty(set);
}

/** リモートpullの適用用。dirtyにしない */
export async function applyRemotePhoto(key: string, blob: Blob): Promise<void> {
  await reqToPromise((await store("readwrite")).put(blob, key));
}

/** リモートpullの適用用。dirtyにしない */
export async function removeLocalPhoto(key: string): Promise<void> {
  await reqToPromise((await store("readwrite")).delete(key));
}

export async function getAllPhotos(): Promise<Record<string, Blob>> {
  const s = await store("readonly");
  const keys = (await reqToPromise(s.getAllKeys())) as string[];
  const values = (await reqToPromise(s.getAll())) as Blob[];
  const out: Record<string, Blob> = {};
  keys.forEach((k, i) => (out[k] = values[i]));
  return out;
}

// PhotoSlotに再読み込みを促す（インポート後など）
export function notifyPhotosUpdated() {
  window.dispatchEvent(new Event("photos-updated"));
}
