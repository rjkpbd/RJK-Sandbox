"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { registerDevice } from "./device";
import { needsBootstrap, bootstrapUser } from "./bootstrap";
import { startRealtimeSync } from "./realtime";
import { flushOutbox } from "./outbox";
import {
  getSyncState,
  subscribeSyncState,
  updateSyncState,
  type SyncState,
} from "./status";

interface SyncContextValue {
  syncState: SyncState;
  deviceFingerprint: string | null;
}

const SyncContext = createContext<SyncContextValue>({
  syncState: getSyncState(),
  deviceFingerprint: null,
});

export function useSyncStatus(): SyncState {
  return useContext(SyncContext).syncState;
}

export function useSyncContext(): SyncContextValue {
  return useContext(SyncContext);
}

interface SyncProviderProps {
  userId: string;
  children: ReactNode;
}

export function SyncProvider({ userId, children }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>(getSyncState);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const unsub = subscribeSyncState(setSyncState);
    return unsub;
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const supabase = createClient();
    let stopRealtime: (() => void) | null = null;
    let flushInterval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        // Device registration
        const fp = await registerDevice(supabase, userId);
        setFingerprint(fp);

        // Bootstrap if needed
        if (await needsBootstrap()) {
          await bootstrapUser(supabase, userId);
        }

        // Realtime sync
        stopRealtime = startRealtimeSync(supabase, userId);

        // Flush outbox every 30s
        flushInterval = setInterval(() => {
          if (navigator.onLine) {
            flushOutbox(supabase).catch(() => {});
          }
        }, 30_000);

        // Initial flush
        if (navigator.onLine) {
          await flushOutbox(supabase);
        }
      } catch (err) {
        updateSyncState({ status: "error", error: String(err) });
      }
    }

    function handleOnline() {
      updateSyncState({ status: "syncing" });
      flushOutbox(supabase)
        .then(() => updateSyncState({ status: "idle" }))
        .catch(() => updateSyncState({ status: "error" }));
    }

    function handleOffline() {
      updateSyncState({ status: "offline" });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    init();

    return () => {
      stopRealtime?.();
      if (flushInterval) clearInterval(flushInterval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userId]);

  return (
    <SyncContext.Provider value={{ syncState, deviceFingerprint: fingerprint }}>
      {children}
    </SyncContext.Provider>
  );
}
