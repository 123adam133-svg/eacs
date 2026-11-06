/* ═══════════════════════════════════════════════════════════
 * BADGE Component
 * ═══════════════════════════════════════════════════════════ */
import React from "react";

export function Badge({ kind, children }) {
  const map = {
    /* Documents */
    valid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    expiring: "bg-amber-100 text-amber-700 border-amber-200",
    critical: "bg-orange-100 text-orange-700 border-orange-200",
    expired: "bg-rose-100 text-rose-700 border-rose-200",

    /* Aircraft */
    AIRWORTHY: "bg-emerald-100 text-emerald-700 border-emerald-200",
    MAINTENANCE: "bg-amber-100 text-amber-700 border-amber-200",
    AOG: "bg-rose-100 text-rose-700 border-rose-200",
    INSPECTION_DUE: "bg-orange-100 text-orange-700 border-orange-200",
    STORED: "bg-slate-200 text-slate-700 border-slate-300",
    IN_FLIGHT: "bg-sky-100 text-sky-700 border-sky-200",
    RESERVED: "bg-indigo-100 text-indigo-700 border-indigo-200",
    RETIRED: "bg-slate-300 text-slate-800 border-slate-400",
    LEASED_OUT: "bg-purple-100 text-purple-700 border-purple-200",
    GROUNDED: "bg-red-100 text-red-700 border-red-200",

    /* Flight */
    SCHEDULED: "bg-sky-100 text-sky-700 border-sky-200",
    BOARDING: "bg-indigo-100 text-indigo-700 border-indigo-200",
    DELAYED: "bg-rose-100 text-rose-700 border-rose-200",
    DEPARTED: "bg-sky-100 text-sky-700 border-sky-200",
    ARRIVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CANCELLED: "bg-slate-300 text-slate-800 border-slate-400",

    /* Users */
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inactive: "bg-slate-200 text-slate-600 border-slate-300",

    /* Leave */
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-300",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
        map[kind] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {children}
    </span>
  );
}

export default Badge;
