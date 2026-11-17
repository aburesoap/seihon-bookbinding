// パスワードによる暗号化.
// PBKDF2（SHA-256）で鍵を作り, AES-GCMで暗号化する.
// 復号側は reader/reader.js にある. 形式を変えるときは両方をそろえること.

const ITERATIONS = 310000;

export async function encryptText(text, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  return {
    v: 1,
    iterations: ITERATIONS,
    salt: await toBase64(salt),
    iv: await toBase64(iv),
    data: await toBase64(new Uint8Array(data)),
  };
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

// 大きなデータでも速いよう, FileReader を使ってBase64にする.
export function toBase64(bytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes]));
  });
}
