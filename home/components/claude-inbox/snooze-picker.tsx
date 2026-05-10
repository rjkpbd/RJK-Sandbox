"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function nextWeekday(weekday: number, hour = 9): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const current = d.getDay();
  const diff = ((weekday - current + 7) % 7) || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function tomorrow(hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function inNDays(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const OPTIONS: { label: string; sublabel: string; getDate: () => Date }[] = [
  {
    label: "Tomorrow",
    sublabel: "9:00 AM",
    getDate: () => tomorrow(),
  },
  {
    label: "This weekend",
    sublabel: "Saturday 9:00 AM",
    getDate: () => nextWeekday(6),
  },
  {
    label: "Next week",
    sublabel: "Monday 9:00 AM",
    getDate: () => nextWeekday(1),
  },
  {
    label: "In 2 weeks",
    sublabel: "9:00 AM",
    getDate: () => inNDays(14),
  },
];

interface SnoozePicker {
  onSnooze: (until: Date) => void;
  onClose: () => void;
  align?: "left" | "right";
}

export function SnoozePicker({ onSnooze, onClose, align = "left" }: SnoozePicker) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={cn("absolute z-50 mt-1 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 text-sm", align === "right" ? "right-0" : "left-0")}
    >
      <p className="text-[10px] text-slate-500 uppercase tracking-wide px-3 py-1.5">
        Snooze until
      </p>
      {OPTIONS.map(({ label, sublabel, getDate }) => (
        <button
          key={label}
          onClick={() => { onSnooze(getDate()); onClose(); }}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700 transition-colors text-left"
        >
          <span className="text-slate-200">{label}</span>
          <span className="text-slate-500 text-xs">{sublabel}</span>
        </button>
      ))}
    </div>
  );
}
