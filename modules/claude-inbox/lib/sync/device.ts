import type { SupabaseClient } from "@supabase/supabase-js";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    String(screen.colorDepth),
    String(screen.width) + "x" + String(screen.height),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ""),
  ].join("|");
  return sha256(components);
}

export async function registerDevice(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const fingerprint = await getFingerprint();
  const name =
    navigator.userAgent.match(
      /\(([^)]+)\)/
    )?.[1]?.split(";")[0]?.trim() ?? "Unknown Device";

  await supabase.from("SB-devices").upsert(
    {
      user_id: userId,
      fingerprint,
      name,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,fingerprint" }
  );

  return fingerprint;
}
