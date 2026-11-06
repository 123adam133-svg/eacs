/* ═══════════════════════════════════════════════════════════
 * TIMELINE VIEW
 * Horizontal bars representing flights throughout the day
 * ═══════════════════════════════════════════════════════════ */
import React from "react";
import { BarChart3 } from "lucide-react";
import { useT } from "../contexts";
import { fmtTime } from "../utils/helpers";

export function TimelineView({ flights, timeMode = "UTC", isPast }) {
  const t = useT();

  /* ⭐ لا رحلات */
  if (flights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center text-slate-400">
        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <div className="text-sm">{t.noFlights}</div>
      </div>
    );
  }

  /* ⭐ حساب النطاق الزمني */
  let minHour = 24;
  let maxHour = 0;
  flights.forEach((f) => {
    if (!f.std) return;
    const d1 = new Date(f.std);
    if (isNaN(d1.getTime())) return;
    const h1 = d1.getUTCHours();
    const d2 = f.sta ? new Date(f.sta) : d1;
    const h2 = isNaN(d2.getTime()) ? h1 : d2.getUTCHours();
    minHour = Math.min(minHour, h1);
    maxHour = Math.max(maxHour, h2);
  });
  if (minHour > maxHour) {
    minHour = 0;
    maxHour = 24;
  } else {
    minHour = Math.max(0, minHour - 1);
    maxHour = Math.min(24, maxHour + 1);
  }
  const totalHours = Math.max(1, maxHour - minHour);
  const tf =
    (typeof window !== "undefined" &&
      (window.__AEROOPS_TIME_FORMAT ||
        window.localStorage?.getItem("aeroops.timeFormat"))) ||
    "24";

  const fmtHeaderHour = (h) => {
    const hh = ((h % 24) + 24) % 24;
    if (tf === "12") {
      const ampm = hh >= 12 ? "PM" : "AM";
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return `${h12} ${ampm}`;
    }
    return `${String(hh).padStart(2, "0")}:00`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* ⭐ Hours header */}
      <div className="flex bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-400 dark:border-slate-700">
        <div className="w-32 flex-shrink-0 p-2 text-xs font-bold text-slate-600 dark:text-slate-400 border-e border-slate-300 dark:border-slate-700">
          {t.flightNo}
        </div>
        <div className="flex-1 flex">
          {Array.from({ length: totalHours }, (_, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[10px] font-bold text-slate-600 dark:text-slate-400 py-2 border-e border-slate-200 dark:border-slate-800"
            >
              {fmtHeaderHour(minHour + i)}
            </div>
          ))}
        </div>
      </div>

      {/* ⭐ Flight rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {flights.map((f) => {
          if (!f.std) return null;

          const std = new Date(f.std);
          const sta = f.sta ? new Date(f.sta) : std;

          const startH = std.getUTCHours() + std.getUTCMinutes() / 60;
          const endH = sta.getUTCHours() + sta.getUTCMinutes() / 60;

          const leftPct = ((startH - minHour) / totalHours) * 100;
          const widthPct = Math.max(3, ((endH - startH) / totalHours) * 100);

          const past = isPast ? isPast(f) : false;

          return (
            <div
              key={f.id}
              className="flex items-center hover:bg-sky-50/40 dark:hover:bg-slate-700/50"
            >
              {/* Flight info */}
              <div className="w-32 flex-shrink-0 p-2 border-e border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {f.flightNo}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {f.dep}→{f.arr}
                </div>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative h-12">
                {/* Grid lines */}
                {Array.from({ length: totalHours }, (_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-e border-slate-100 dark:border-slate-800"
                    style={{ left: `${(i / totalHours) * 100}%` }}
                  />
                ))}

                {/* Bar */}
                <div
                  className={`absolute top-2 bottom-2 rounded shadow-sm flex items-center px-2 text-[10px] font-bold text-white overflow-hidden ${
                    past
                      ? "bg-slate-400 dark:bg-slate-600"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-600"
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    minWidth: "60px",
                  }}
                  title={`${f.flightNo} · ${fmtTime(
                    f.std,
                    timeMode
                  )} → ${fmtTime(f.sta, timeMode)}`}
                >
                  <span className="truncate">
                    {fmtTime(f.std, timeMode)} → {fmtTime(f.sta, timeMode)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TimelineView;
