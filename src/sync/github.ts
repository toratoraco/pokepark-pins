// GitHub Contents API の薄いラッパー。api.github.com はCORS対応なのでブラウザから直接叩ける。
// 認証は fine-grained PAT（データ用プライベートリポジトリ限定・Contents Read/Write のみ）。

export interface SyncConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request(cfg: SyncConfig, method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${cfg.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

function contentsPath(cfg: SyncConfig, path: string): string {
  return `/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
}

/** リポジトリへの疎通と権限を確認。問題があれば GitHubError を投げる */
export async function checkRepo(cfg: SyncConfig): Promise<void> {
  const res = await request(cfg, "GET", `/repos/${cfg.owner}/${cfg.repo}`);
  if (!res.ok) throw new GitHubError(res.status, `リポジトリにアクセスできません (${res.status})`);
}

export interface RemoteFile {
  contentB64: string;
  sha: string;
}

/** ファイル取得。存在しなければ null。1MB未満のファイル前提（content同梱で返る） */
export async function getFile(cfg: SyncConfig, path: string): Promise<RemoteFile | null> {
  const res = await request(cfg, "GET", contentsPath(cfg, path));
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(res.status, `取得に失敗 (${res.status}): ${path}`);
  const json = await res.json();
  return { contentB64: String(json.content ?? "").replace(/\n/g, ""), sha: json.sha };
}

/** ファイル作成/更新。更新時は sha 必須。成功時は新しい sha を返す */
export async function putFile(cfg: SyncConfig, path: string, contentB64: string, sha?: string): Promise<string> {
  const res = await request(cfg, "PUT", contentsPath(cfg, path), {
    message: `sync: ${path}`,
    content: contentB64,
    ...(sha ? { sha } : {}),
  });
  if (!res.ok) throw new GitHubError(res.status, `保存に失敗 (${res.status}): ${path}`);
  const json = await res.json();
  return json.content.sha as string;
}

export async function deleteFile(cfg: SyncConfig, path: string, sha: string): Promise<void> {
  const res = await request(cfg, "DELETE", contentsPath(cfg, path), {
    message: `sync: delete ${path}`,
    sha,
  });
  if (!res.ok && res.status !== 404) throw new GitHubError(res.status, `削除に失敗 (${res.status}): ${path}`);
}

export interface RemoteEntry {
  name: string;
  sha: string;
}

/** ディレクトリ一覧。存在しなければ空配列 */
export async function listDir(cfg: SyncConfig, path: string): Promise<RemoteEntry[]> {
  const res = await request(cfg, "GET", contentsPath(cfg, path));
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubError(res.status, `一覧取得に失敗 (${res.status}): ${path}`);
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json.map((e: { name: string; sha: string }) => ({ name: e.name, sha: e.sha }));
}

// ---- base64 ユーティリティ ----

/** UTF-8文字列 → base64 */
export function textToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** base64 → UTF-8文字列 */
export function b64ToText(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Blob → base64（dataURLのプレフィックスを除去） */
export function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** base64 → Blob */
export function b64ToBlob(b64: string, type = "image/jpeg"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
