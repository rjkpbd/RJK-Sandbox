// In-memory API key cache — lives for the duration of the browser tab session.
// Cleared automatically on page refresh/close. Never written to disk or storage.

let _cachedApiKey: string | null = null;

export function cacheApiKey(key: string): void {
  _cachedApiKey = key;
}

export function getCachedApiKey(): string | null {
  return _cachedApiKey;
}

export function clearCachedApiKey(): void {
  _cachedApiKey = null;
}
