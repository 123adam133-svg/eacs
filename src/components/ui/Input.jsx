/* ═══════════════════════════════════════════════════════════
 * INPUT Component
 * ═══════════════════════════════════════════════════════════ */
import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-900 ${className}`}
    />
  );
}

export default Input;
