import { bytesToBase64, base64ToBytes } from "./codec";

// Stores iv (12 bytes) + ciphertext concatenated, base64-encoded.
export async function aesgcmEncrypt(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return bytesToBase64(combined);
}

export async function aesgcmDecrypt(
  key: CryptoKey,
  ciphertextBase64: string
): Promise<string> {
  const combined = base64ToBytes(ciphertextBase64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
