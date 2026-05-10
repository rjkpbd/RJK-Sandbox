"use client";

import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";

interface RateLimitBannerProps {
  retryAfterMs: number;
  attempt: number;
  maxAttempts: number;
  onCancel: () => void;
}

export function RateLimitBanner({ retryAfterMs, attempt, maxAttempts, onCancel }: RateLimitBannerProps) {
  const [remaining, setRemaining] = useState(Math.ceil(retryAfterMs / 1000));

  useEffect(() => {
    setRemaining(Math.ceil(retryAfterMs / 1000));
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryAfterMs]);

  return (
    <div className="mx-4 my-2 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 shrink-0">
      <Clock size={13} className="text-amber-400 shrink-0 animate-pulse" />
      <p className="text-xs text-amber-300 flex-1">
        Rate limited — retrying in{" "}
        <span className="font-semibold tabular-nums">{remaining}s</span>
        <span className="text-amber-500 ml-1.5">(attempt {attempt} of {maxAttempts})</span>
      </p>
      <button
        onClick={onCancel}
        title="Cancel retry"
        aria-label="Cancel retry"
        className="p-0.5 text-amber-500 hover:text-amber-300 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  );
}
