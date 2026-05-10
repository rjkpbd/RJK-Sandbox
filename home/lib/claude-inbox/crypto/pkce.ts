/** Generate a random PKCE code_verifier (43-128 chars, URL-safe base64). */
export function generateVerifier(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return toBase64Url(arr);
}

/** Compute the S256 code_challenge from a verifier. */
export async function computeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

/** Generate a random state parameter. */
export function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
