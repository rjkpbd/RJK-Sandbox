"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDB } from "@/lib/claude-inbox/sync/db";

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10); // "2026-05-08"
}

function monthPrefix(): string {
  return new Date().toISOString().slice(0, 7); // "2026-05"
}

/** Sum of assistant message costs for today across all conversations. */
export function useDailySpendUsd(userId: string): number | undefined {
  const prefix = todayPrefix();
  return useLiveQuery(async () => {
    const msgs = await getDB().messages.where("user_id").equals(userId).toArray();
    return msgs
      .filter((m) => m.role === "assistant" && m.created_at.startsWith(prefix) && m.usage?.cost_usd)
      .reduce((sum, m) => sum + m.usage!.cost_usd, 0);
  }, [userId, prefix]);
}

/** Sum of assistant message costs for the current calendar month. */
export function useMonthlySpendUsd(userId: string): number | undefined {
  const prefix = monthPrefix();
  return useLiveQuery(async () => {
    const msgs = await getDB().messages.where("user_id").equals(userId).toArray();
    return msgs
      .filter((m) => m.role === "assistant" && m.created_at.startsWith(prefix) && m.usage?.cost_usd)
      .reduce((sum, m) => sum + m.usage!.cost_usd, 0);
  }, [userId, prefix]);
}
