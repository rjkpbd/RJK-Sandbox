import { bytesToBase64, base64ToBytes, toArrayBuffer } from "./codec";

export const DEFAULT_KDF_ITERATIONS = 600_000;

export function generateSalt(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(
  passphrase: string,
  saltBase64: string,
  iterations: number
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltBase64),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable for device escrow wrapping
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64(new Uint8Array(raw));
}

export async function importKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}
