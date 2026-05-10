export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Copies any Uint8Array into a guaranteed ArrayBuffer-backed one (for Web Crypto APIs). */
export function toArrayBuffer(input: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(input.byteLength);
  const out = new Uint8Array(buf);
  out.set(input);
  return out;
}
