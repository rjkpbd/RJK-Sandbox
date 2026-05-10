"use client";

import { useState } from "react";
import { X, Lock } from "lucide-react";
import { unlockVault } from "@/lib/claude-inbox/crypto/vault";
import { cacheApiKey } from "@/lib/claude-inbox/crypto/session";
import { useUserSettings } from "@/lib/claude-inbox/data/user-settings";
import { useSyncContext } from "@/lib/claude-inbox/sync/context";

interface VaultUnlockModalProps {
  onUnlocked: () => void;
  onCancel: () => void;
}

export function VaultUnlockModal({ onUnlocked, onCancel }: VaultUnlockModalProps) {
  const { userId } = useSyncContext();
  const settings = useUserSettings(userId);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const noVault = settings !== undefined && !settings?.encrypted_api_key;

  async function handleUnlock() {
    if (!settings?.encrypted_api_key || !settings?.kdf_salt) return;
    setUnlocking(true);
    setError(null);
    try {
      const { apiKey } = await unlockVault(
        settings.encrypted_api_key,
        settings.kdf_salt,
        settings.kdf_iterations,
        passphrase
      );
      cacheApiKey(apiKey);
      onUnlocked();
    } catch {
      setError("Wrong passphrase — try again.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">API vault locked</h2>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {noVault ? (
            <p className="text-xs text-slate-400">
              No API key is configured yet. Go to{" "}
              <a href="/claude-inbox/settings" className="text-indigo-400 underline">Settings</a>
              {" "}to add your Anthropic API key.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Enter your vault passphrase to unlock your API key and continue.
              </p>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="Passphrase…"
                autoFocus
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
            </>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            {!noVault && (
              <button
                onClick={handleUnlock}
                disabled={!passphrase.trim() || unlocking}
                className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg transition-colors"
              >
                {unlocking ? "Unlocking…" : "Unlock"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
