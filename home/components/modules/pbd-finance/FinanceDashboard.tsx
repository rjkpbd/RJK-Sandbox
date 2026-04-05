"use client";

import { useEffect, useState } from "react";
import { IncomeStatement } from "./IncomeStatement";
import { AccountsReceivable } from "./AccountsReceivable";
import type {
  ProfitAndLossData,
  AccountsReceivableData,
} from "@/lib/quickbooks";

interface ErrorState {
  is: true;
  code: string;
}

type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; code: string };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </section>
  );
}

function ErrorBanner({ code }: { code: string }) {
  const messages: Record<string, string> = {
    not_connected: "Not connected to QuickBooks.",
    token_expired: "Session expired — please reconnect.",
    fetch_failed: "Failed to fetch data from QuickBooks.",
    auth_denied: "QuickBooks authorization was denied.",
    invalid_state: "OAuth state mismatch — please try again.",
    token_exchange: "Failed to complete QuickBooks sign-in.",
  };
  return (
    <p className="text-sm text-red-400">
      {messages[code] ?? `Error: ${code}`}
    </p>
  );
}

function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-6 bg-slate-700/50 rounded animate-pulse"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function FinanceDashboard({
  connected,
  urlError,
}: {
  connected: boolean;
  urlError?: string;
}) {
  const [pl, setPl] = useState<AsyncState<ProfitAndLossData>>({
    status: "idle",
  });
  const [ar, setAr] = useState<AsyncState<AccountsReceivableData>>({
    status: "idle",
  });

  useEffect(() => {
    if (!connected) return;
    fetchData();
  }, [connected]);

  async function fetchData() {
    setPl({ status: "loading" });
    setAr({ status: "loading" });

    const [plRes, arRes] = await Promise.allSettled([
      fetch("/api/qbo/income-statement").then((r) => r.json()),
      fetch("/api/qbo/accounts-receivable").then((r) => r.json()),
    ]);

    setPl(
      plRes.status === "fulfilled" && !plRes.value.error
        ? { status: "ok", data: plRes.value }
        : { status: "error", code: plRes.status === "fulfilled" ? plRes.value.error : "fetch_failed" }
    );
    setAr(
      arRes.status === "fulfilled" && !arRes.value.error
        ? { status: "ok", data: arRes.value }
        : { status: "error", code: arRes.status === "fulfilled" ? arRes.value.error : "fetch_failed" }
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">PBD Finance</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            QuickBooks Online reporting
          </p>
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <button
              onClick={fetchData}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          )}
          {connected ? (
            <form action="/api/qbo/disconnect" method="POST">
              <button
                type="submit"
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors"
              >
                Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/qbo/connect"
              className="text-sm px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-medium"
            >
              Connect QuickBooks
            </a>
          )}
        </div>
      </div>

      {/* URL error from OAuth redirect */}
      {urlError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
          <ErrorBanner code={urlError} />
        </div>
      )}

      {!connected && !urlError && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
            📊
          </div>
          <p className="text-slate-300 font-medium">
            Connect your QuickBooks account
          </p>
          <p className="text-sm text-slate-500 max-w-sm">
            Authorize PBD Finance to read your QuickBooks Online data to view
            your income statement and accounts receivable.
          </p>
          <a
            href="/api/qbo/connect"
            className="mt-2 text-sm px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-medium"
          >
            Connect QuickBooks
          </a>
        </div>
      )}

      {connected && (
        <>
          {/* Income Statement */}
          <Section title="Income Statement — Last 3 Months">
            {pl.status === "loading" && <LoadingRows />}
            {pl.status === "error" && <ErrorBanner code={pl.code} />}
            {pl.status === "ok" && <IncomeStatement data={pl.data} />}
          </Section>

          {/* Accounts Receivable */}
          <Section title="Accounts Receivable">
            {ar.status === "loading" && <LoadingRows rows={4} />}
            {ar.status === "error" && <ErrorBanner code={ar.code} />}
            {ar.status === "ok" && <AccountsReceivable data={ar.data} />}
          </Section>
        </>
      )}
    </div>
  );
}
