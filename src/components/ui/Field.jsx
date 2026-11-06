/* ═══════════════════════════════════════════════════════════
 * FIELD Component — Label + Input wrapper
 * ═══════════════════════════════════════════════════════════ */
import React from "react";

export function Field({ label, children, span }) {
  return (
    <label className={`block ${span ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default Field;
