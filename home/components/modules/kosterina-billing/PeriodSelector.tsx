"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Period = { id: number; period: string; label: string };

export default function PeriodSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newPeriod, setNewPeriod] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchPeriods = useCallback(async () => {
    const res = await fetch("/api/kosterina-billing/periods");
    if (!res.ok) return;
    const data: Period[] = await res.json();
    setPeriods(data);
    // Auto-select: use URL param, else the first (most recent)
    const urlId = searchParams.get("period_id");
    if (urlId && data.find(p => String(p.id) === urlId)) {
      setSelectedId(urlId);
    } else if (data.length > 0) {
      setSelectedId(String(data[0].id));
      updateUrl(String(data[0].id));
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPeriods(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function updateUrl(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period_id", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    updateUrl(id);
  }

  async function handleCreate() {
    if (!/^\d{4}-\d{2}$/.test(newPeriod)) return;
    setLoading(true);
    const res = await fetch("/api/kosterina-billing/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: newPeriod }),
    });
    setLoading(false);
    if (res.ok) {
      const created: Period = await res.json();
      setCreating(false);
      setNewPeriod("");
      await fetchPeriods();
      handleSelect(String(created.id));
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedId}
        onChange={e => handleSelect(e.target.value)}
        className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
      >
        {periods.length === 0 && <option value="">No periods yet</option>}
        {periods.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {creating ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="YYYY-MM"
            value={newPeriod}
            onChange={e => setNewPeriod(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm w-28"
          />
          <button
            onClick={handleCreate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => setCreating(false)}
            className="text-slate-400 hover:text-white text-sm px-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="text-slate-400 hover:text-white text-sm px-2 py-2"
          title="Add new period"
        >
          + Period
        </button>
      )}
    </div>
  );
}
