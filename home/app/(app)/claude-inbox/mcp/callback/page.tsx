"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { storeMcpToken } from "@/lib/claude-inbox/data/mcp-servers";

const STORAGE_KEY = "mcp_oauth_pending";

export default function McpOAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing connection…");

  useEffect(() => {
    (async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage(`OAuth error: ${searchParams.get("error_description") ?? error}`);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Missing code or state parameter.");
        return;
      }

      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("error");
        setMessage("OAuth session expired. Please try connecting again.");
        return;
      }

      let pending: {
        state: string;
        verifier: string;
        serverId: string;
        tokenUrl: string;
        clientId: string;
        redirectUri: string;
      };
      try {
        pending = JSON.parse(raw);
      } catch {
        setStatus("error");
        setMessage("Invalid OAuth session data.");
        return;
      }

      if (pending.state !== state) {
        setStatus("error");
        setMessage("State mismatch — possible CSRF attack.");
        return;
      }

      sessionStorage.removeItem(STORAGE_KEY);

      try {
        const res = await fetch("/api/claude-inbox/mcp-oauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenUrl: pending.tokenUrl,
            code,
            redirectUri: pending.redirectUri,
            clientId: pending.clientId,
            codeVerifier: pending.verifier,
          }),
        });

        const data = await res.json() as { access_token?: string; refresh_token?: string; error?: string };
        if (!res.ok || !data.access_token) {
          setStatus("error");
          setMessage(data.error ?? "Token exchange failed.");
          return;
        }

        await storeMcpToken(pending.serverId, data.access_token, data.refresh_token);
        setStatus("success");
        setMessage("Connected successfully!");
        setTimeout(() => router.push("/claude-inbox/mcp"), 1500);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Connection failed.");
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col flex-1 items-center justify-center gap-4 bg-slate-900">
      {status === "loading" && <Loader2 size={32} className="text-indigo-400 animate-spin" />}
      {status === "success" && <CheckCircle size={32} className="text-emerald-400" />}
      {status === "error" && <XCircle size={32} className="text-red-400" />}
      <p className="text-sm text-slate-300">{message}</p>
      {status === "error" && (
        <button
          onClick={() => router.push("/claude-inbox/mcp")}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-2"
        >
          Back to MCP servers
        </button>
      )}
    </div>
  );
}
