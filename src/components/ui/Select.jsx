/* ═══════════════════════════════════════════════════════════
 * SELECT Component
 * ═══════════════════════════════════════════════════════════ */
import React from "react";

export function Select({ className = "", children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-60 ${className}`}
    >
      {children}
    </select>
  );
}

export default Select;
