"use client";

import Link from "next/link";

export default function ClaudeInboxWidget() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-violet-500/20 flex items-center justify-center text-sm">
          ✉️
        </div>
        <div>
          <p className="text-sm font-medium text-white">Claude Inbox</p>
          <p className="text-xs text-slate-400">Multi-AI conversation manager</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 flex-1 leading-relaxed">
        Email-style triage for Claude — archive, snooze, tag, projects,
        skills, and MCP tools. Bring your own API key.
      </p>
      <Link
        href="/claude-inbox"
        className="text-xs font-medium text-violet-400 hover:text-violet-300 hover:underline"
      >
        Open Inbox →
      </Link>
    </div>
  );
}
