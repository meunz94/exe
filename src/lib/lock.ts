/**
 * 잠금 글 복호화. 동기화가 scripts/notion-lib.mjs 의 encryptText 로 만든
 * base64( salt16 | iv12 | AES-GCM ciphertext ) 를 비밀번호로 푼다.
 * 비밀번호는 사이트에 실리지 않는다 — 틀리면 복호화 자체가 실패한다.
 */
const ITER = 200_000;

export async function decryptText(cipherB64: string, password: string): Promise<string | null> {
  try {
    const raw = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
    const salt = raw.slice(0, 16);
    const iv = raw.slice(16, 28);
    const ct = raw.slice(28);
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

const KEY = (id: string) => `lock:${id}`;
/** 한 세션 안에서는 다시 묻지 않는다 (탭을 닫으면 사라진다) */
export function rememberPassword(id: string, pw: string) {
  try {
    sessionStorage.setItem(KEY(id), pw);
  } catch {
    /* 비공개 창 등 */
  }
}
export function recallPassword(id: string): string | null {
  try {
    return sessionStorage.getItem(KEY(id));
  } catch {
    return null;
  }
}
