export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
  isBootstrapping: boolean;
  bootstrapProgress: number; // 0–100
}

const DEFAULT_STATE: SyncState = {
  status: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
  isBootstrapping: false,
  bootstrapProgress: 0,
};

let _state: SyncState = { ...DEFAULT_STATE };
const _listeners = new Set<(s: SyncState) => void>();

export function getSyncState(): SyncState {
  return _state;
}

export function updateSyncState(patch: Partial<SyncState>): void {
  _state = { ..._state, ...patch };
  _listeners.forEach((fn) => fn(_state));
}

export function subscribeSyncState(
  listener: (s: SyncState) => void
): () => void {
  _listeners.add(listener);
  listener(_state);
  return () => _listeners.delete(listener);
}
