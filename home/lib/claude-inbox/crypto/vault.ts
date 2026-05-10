import * as bip39 from "bip39";
import {
  deriveKey,
  exportKey,
  importKey,
  generateSalt,
  DEFAULT_KDF_ITERATIONS,
} from "./kdf";
import { aesgcmEncrypt, aesgcmDecrypt } from "./aes";

// Iterations used for recovery-phrase wrapping (lower — phrase is high-entropy)
const RECOVERY_KDF_ITERATIONS = 100_000;

export interface VaultSaveData {
  encrypted_api_key: string;
  kdf_salt: string;
  kdf_iterations: number;
  recovery_key_wrap: string;
}

/**
 * Create a new vault. Returns data to persist in SB-user_settings plus the
 * recovery phrase (show once to the user — never stored in plaintext).
 */
export async function createVault(
  apiKey: string,
  passphrase: string
): Promise<{ saveData: VaultSaveData; recoveryPhrase: string }> {
  const salt = generateSalt();

  // Derive wrapping key from passphrase
  const wrappingKey = await deriveKey(passphrase, salt, DEFAULT_KDF_ITERATIONS);

  // Encrypt the API key
  const encryptedApiKey = await aesgcmEncrypt(wrappingKey, apiKey);

  // Generate 12-word BIP39 recovery phrase
  const recoveryPhrase = bip39.generateMnemonic();

  // Derive recovery key from the mnemonic (uses same salt, different iterations)
  const recoveryKey = await deriveKey(recoveryPhrase, salt, RECOVERY_KDF_ITERATIONS);

  // Wrap the passphrase-derived key so recovery phrase can reconstruct it
  const wrappingKeyB64 = await exportKey(wrappingKey);
  const recoveryKeyWrap = await aesgcmEncrypt(recoveryKey, wrappingKeyB64);

  return {
    saveData: {
      encrypted_api_key: encryptedApiKey,
      kdf_salt: salt,
      kdf_iterations: DEFAULT_KDF_ITERATIONS,
      recovery_key_wrap: recoveryKeyWrap,
    },
    recoveryPhrase,
  };
}

/**
 * Unlock the vault with the user's passphrase. Returns the plaintext API key.
 * Throws if the passphrase is wrong (AES-GCM authentication will fail).
 */
export async function unlockVault(
  encryptedApiKey: string,
  kdfSalt: string,
  kdfIterations: number,
  passphrase: string
): Promise<{ apiKey: string; wrappingKey: CryptoKey }> {
  const wrappingKey = await deriveKey(passphrase, kdfSalt, kdfIterations);
  const apiKey = await aesgcmDecrypt(wrappingKey, encryptedApiKey);
  return { apiKey, wrappingKey };
}

/**
 * Recover vault access using the BIP39 recovery phrase.
 * Returns the plaintext API key and the reconstructed wrapping key.
 */
export async function recoverVault(
  encryptedApiKey: string,
  kdfSalt: string,
  recoveryKeyWrap: string,
  recoveryPhrase: string
): Promise<{ apiKey: string; wrappingKey: CryptoKey }> {
  // Validate mnemonic before doing expensive KDF
  if (!bip39.validateMnemonic(recoveryPhrase.trim().toLowerCase())) {
    throw new Error("Invalid recovery phrase");
  }

  const recoveryKey = await deriveKey(
    recoveryPhrase.trim().toLowerCase(),
    kdfSalt,
    RECOVERY_KDF_ITERATIONS
  );

  // Unwrap the passphrase-derived key
  const wrappingKeyB64 = await aesgcmDecrypt(recoveryKey, recoveryKeyWrap);
  const wrappingKey = await importKey(wrappingKeyB64);

  const apiKey = await aesgcmDecrypt(wrappingKey, encryptedApiKey);
  return { apiKey, wrappingKey };
}
