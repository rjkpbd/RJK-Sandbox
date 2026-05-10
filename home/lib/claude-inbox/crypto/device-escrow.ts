import { getDB } from "@/lib/claude-inbox/sync/db";
import { exportKey, importKey } from "./kdf";
import { aesgcmEncrypt, aesgcmDecrypt } from "./aes";
import { toArrayBuffer } from "./codec";

const ESCROW_META_KEY = "device_escrow_v1";
const ESCROW_KDF_ITERATIONS = 100_000;

/**
 * Derives a device-binding key from the fingerprint + userId.
 * Not a secret, but binds the escrow to this specific device+user combination.
 */
async function deviceBindingKey(
  fingerprint: string,
  userId: string
): Promise<CryptoKey> {
  const material = `${userId}:${fingerprint}:claude-inbox-device-escrow-v1`;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(material)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = toArrayBuffer(
    new TextEncoder().encode("claude-inbox-device-binding-salt-v1")
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ESCROW_KDF_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Saves the wrapping key to IndexedDB encrypted with a device-binding key.
 * Call this when the user marks the current device as trusted.
 */
export async function saveDeviceEscrow(
  wrappingKey: CryptoKey,
  fingerprint: string,
  userId: string
): Promise<void> {
  const bindingKey = await deviceBindingKey(fingerprint, userId);
  const wrappingKeyB64 = await exportKey(wrappingKey);
  const escapedWrap = await aesgcmEncrypt(bindingKey, wrappingKeyB64);

  const db = getDB();
  await db._meta.put({ key: ESCROW_META_KEY, value: escapedWrap });
}

/**
 * Attempts to auto-unlock using a saved device escrow.
 * Returns the plaintext API key, or null if no escrow exists or decryption fails.
 */
export async function loadDeviceEscrow(
  fingerprint: string,
  userId: string,
  encryptedApiKey: string
): Promise<string | null> {
  try {
    const db = getDB();
    const meta = await db._meta.get(ESCROW_META_KEY);
    if (!meta) return null;

    const bindingKey = await deviceBindingKey(fingerprint, userId);
    const wrappingKeyB64 = await aesgcmDecrypt(bindingKey, meta.value);
    const wrappingKey = await importKey(wrappingKeyB64);
    return await aesgcmDecrypt(wrappingKey, encryptedApiKey);
  } catch {
    return null;
  }
}

/**
 * Removes the device escrow from IndexedDB (un-trusts this device).
 */
export async function clearDeviceEscrow(): Promise<void> {
  const db = getDB();
  await db._meta.delete(ESCROW_META_KEY);
}
