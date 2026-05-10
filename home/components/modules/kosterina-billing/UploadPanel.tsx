"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

const UPLOAD_TYPES = [
  { key: "shopify",   label: "Shopify Orders",  accept: ".csv",  endpoint: "/api/kosterina-billing/ingest/shopify" },
  { key: "pacful",    label: "Pacful Billing",   accept: ".xlsx", endpoint: "/api/kosterina-billing/ingest/pacful" },
  { key: "wwex-sp",   label: "WWEX SP (Parcel)", accept: ".xlsx", endpoint: "/api/kosterina-billing/ingest/wwex" },
  { key: "wwex-ltl",  label: "WWEX LTL",         accept: ".xlsx", endpoint: "/api/kosterina-billing/ingest/wwex" },
  { key: "wwex-ftl",  label: "WWEX FTL",         accept: ".xlsx", endpoint: "/api/kosterina-billing/ingest/wwex" },
] as const;

type UploadResult = { success?: boolean; error?: string; [key: string]: unknown };

export default function UploadPanel() {
  const searchParams = useSearchParams();
  const periodId = searchParams.get("period_id");

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, UploadResult>>({});

  async function handleUpload(key: string, endpoint: string, file: File) {
    if (!periodId) {
      setResults(r => ({ ...r, [key]: { error: "Select a period first" } }));
      return;
    }
    setUploading(key);

    // Derive YYYY-MM from period_id requires a lookup — instead we embed it
    // by reading from the select element's selected text in the DOM.
    // Simpler: require user to have selected a period which sets period_id in URL.
    // We need the period string (YYYY-MM), so we fetch the period detail.
    const periodsRes = await fetch("/api/kosterina-billing/periods");
    const periods: { id: number; period: string }[] = await periodsRes.json();
    const p = periods.find(x => String(x.id) === periodId);
    if (!p) {
      setUploading(null);
      setResults(r => ({ ...r, [key]: { error: "Period not found" } }));
      return;
    }
    const period = p.period.slice(0, 7); // "YYYY-MM"

    const form = new FormData();
    form.append("file", file);
    form.append("period", period);

    const res = await fetch(endpoint, { method: "POST", body: form });
    const data: UploadResult = await res.json();
    setUploading(null);
    setResults(r => ({ ...r, [key]: data }));
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl mb-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-300 hover:text-white"
      >
        <span>Upload / Refresh Data</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t border-slate-700 px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {UPLOAD_TYPES.map(({ key, label, accept, endpoint }) => (
            <UploadCard
              key={key}
              label={label}
              accept={accept}
              disabled={!periodId}
              uploading={uploading === key}
              result={results[key]}
              onFile={file => handleUpload(key, endpoint, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadCard({
  label, accept, disabled, uploading, result, onFile,
}: {
  label: string;
  accept: string;
  disabled: boolean;
  uploading: boolean;
  result?: UploadResult;
  onFile: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const extensions = accept.split(",").map(s => s.trim().toLowerCase());

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled && !uploading) setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the card itself, not a child element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ok = extensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!ok) return; // silently ignore wrong type; label already shows accepted format
    onFile(file);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        "rounded-lg p-4 border transition-colors " +
        (dragging
          ? "bg-indigo-900/30 border-indigo-500"
          : "bg-slate-900 border-slate-700")
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{label}</p>

      <label className={
        "flex items-center justify-center px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors " +
        (disabled
          ? "bg-slate-700 text-slate-500 cursor-not-allowed"
          : "bg-indigo-600 hover:bg-indigo-500 text-white")
      }>
        {uploading ? "Uploading…" : "Choose file"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || uploading}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      <p className={
        "text-xs mt-2 text-center transition-opacity " +
        (dragging ? "text-indigo-400 opacity-100" : "text-slate-600 opacity-60")
      }>
        {dragging ? "Drop to upload" : `or drag & drop ${accept}`}
      </p>

      {result && (
        <p className={
          "text-xs mt-1 " +
          (result.error ? "text-red-400" : "text-emerald-400")
        }>
          {result.error
            ? `Error: ${result.error}`
            : `✓ ${
                "ordersIngested" in result
                  ? `${result.ordersIngested} orders, ${result.lineItemsIngested} items`
                  : "rowsIngested" in result
                  ? `${result.rowsIngested} rows`
                  : "lineItemsIngested" in result
                  ? `${result.lineItemsIngested} line items`
                  : "Done"
              }`}
        </p>
      )}
    </div>
  );
}
