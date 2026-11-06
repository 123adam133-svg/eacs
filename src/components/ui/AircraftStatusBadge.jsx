/* ═══════════════════════════════════════════════════════════
 * AIRCRAFT STATUS BADGE
 * ═══════════════════════════════════════════════════════════ */
import React from "react";
import { getAircraftStatus } from "../../config/constants";

export function AircraftStatusBadge({ status, lang = "en" }) {
  const s = getAircraftStatus(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.color}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.dot }}
      />
      {lang === "ar" ? s.ar : s.en}
    </span>
  );
}

export default AircraftStatusBadge;
