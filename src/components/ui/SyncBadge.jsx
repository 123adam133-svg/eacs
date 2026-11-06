/* ═══════════════════════════════════════════════════════════
 * SYNC BADGE Component
 * Shows sync status (synced / syncing / error)
 * ═══════════════════════════════════════════════════════════ */
import React from "react";
import { Cloud, RefreshCw, CloudOff } from "lucide-react";
import { useT } from "../../contexts";

export function SyncBadge({ status, onRetry }) {
  const t = useT();

  const map = {
    synced: {
      icon: Cloud,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      label: t.synced,
    },
    syncing: {
      icon: RefreshCw,
      color: "bg-sky-50 text-sky-700 border-sky-200",
      label: t.syncing,
    },
    error: {
      icon: CloudOff,
      color: "bg-rose-50 text-rose-700 border-rose-200 cursor-pointer",
      label: t.syncError,
    },
    idle: {
      icon: Cloud,
      color: "bg-slate-100 text-slate-600 border-slate-300",
      label: "—",
    },
  };

  const s = map[status] || map.idle;
  const Icon = s.icon;

  return (
    <span
      onClick={status === "error" ? onRetry : undefined}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${s.color}`}
      title={status === "error" ? t.retrySync : s.label}
    >
      <Icon
        className={`w-3 h-3 ${status === "syncing" ? "animate-spin" : ""}`}
      />
      <span className="hidden md:inline">{s.label}</span>
    </span>
  );
}

export default SyncBadge;
