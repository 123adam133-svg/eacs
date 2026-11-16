/* ═══════════════════════════════════════════════════════════
 * CALENDAR VIEW — Ultra-Compact Full-Screen Month Grid + Flight Details
 * v5.0 — Compact side-by-side or stacked layout to fit full viewport
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plane,
  Clock,
  Users,
  Calendar,
} from "lucide-react";
import { useT } from "../contexts";
import { MONTHS_EN, MONTHS_AR, DAYS_EN, DAYS_AR } from "../config/constants";
import { fmtTime, safeArray, todayISO } from "../utils/helpers";
import { AirportHoverCard } from "../components/AirportHoverCard";

/* الأيام تبدأ من الإثنين */
const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEK_DAYS_AR = ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"];

export function CalendarView({
  flights,
  selectedDate,
  setSelectedDate,
  timeMode = "UTC",
  isPast,
  crew = [],
  onSelectFlight,
}) {
  const t = useT();
  const lang = document.documentElement.lang || "ar";

  /* حالة الشهر المعروض */
  const [viewYear, setViewYear] = useState(() => {
    return parseInt(selectedDate?.slice(0, 4)) || new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    return parseInt(selectedDate?.slice(5, 7)) - 1 || new Date().getMonth();
  });

  /* اليوم النشط */
  const [activeDay, setActiveDay] = useState(() => {
    return selectedDate || todayISO();
  });

  const monthNames = lang === "ar" ? MONTHS_AR : MONTHS_EN;
  const weekDayNames = lang === "ar" ? WEEK_DAYS_AR : WEEK_DAYS;

  /* فهرسة الرحلات حسب التاريخ */
  const flightsByDate = useMemo(() => {
    const map = {};
    (flights || []).forEach((f) => {
      if (!f.std) return;
      const dateKey = String(f.std).slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(f);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => String(a.std).localeCompare(String(b.std)));
    });
    return map;
  }, [flights]);

  /* بناء شبكة الشهر (42 خلية) */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1));
    const lastDay = new Date(Date.UTC(viewYear, viewMonth + 1, 0));
    const firstWeekDay = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = lastDay.getUTCDate();

    const cells = [];
    const prevMonthLastDay = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    for (let i = firstWeekDay - 1; i >= 0; i--) {
      cells.push({
        day: prevMonthLastDay - i,
        date: new Date(Date.UTC(viewYear, viewMonth - 1, prevMonthLastDay - i)),
        currentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        date: new Date(Date.UTC(viewYear, viewMonth, d)),
        currentMonth: true,
      });
    }

    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        date: new Date(Date.UTC(viewYear, viewMonth + 1, i)),
        currentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const today = todayISO();

  /* التنقل بين الأشهر */
  const shiftMonth = (delta) => {
    const d = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(d.getUTCFullYear());
    setViewMonth(d.getUTCMonth());
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getUTCFullYear());
    setViewMonth(now.getUTCMonth());
    const iso = todayISO();
    setActiveDay(iso);
    setSelectedDate?.(iso);
  };

  const handleSelectDay = (cell) => {
    if (!cell.currentMonth) {
      setViewYear(cell.date.getUTCFullYear());
      setViewMonth(cell.date.getUTCMonth());
    }
    const iso = cell.date.toISOString().slice(0, 10);
    setActiveDay(iso);
    setSelectedDate?.(iso);
  };

  const activeFlights = flightsByDate[activeDay] || [];
  const activeDateObj = new Date(activeDay + "T00:00:00Z");
  const activeDateLabel = `${activeDateObj.getUTCDate()} ${
    (lang === "ar" ? MONTHS_AR : MONTHS_EN)[activeDateObj.getUTCMonth()]
  } ${activeDateObj.getUTCFullYear()}`;

  return (
    <div className="space-y-2.5 animate-in fade-in duration-150">
      {/* ═══ Compact Header Bar ═══ */}
      <div
        className="rounded-xl px-3 py-2 flex items-center justify-between shadow-xs border"
        style={{
          background: "var(--brand-gradient)",
          color: "white",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="p-1 rounded-md hover:bg-white/20 transition"
            title="الشهر السابق"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-2.5 py-0.5 rounded-md hover:bg-white/20 transition text-xs font-bold font-mono"
          >
            {lang === "ar" ? "اليوم" : "Today"}
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="p-1 rounded-md hover:bg-white/20 transition"
            title="الشهر القادم"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 opacity-80" />
          <h2 className="text-sm md:text-base font-black tracking-tight">
            {monthNames[viewMonth]} {viewYear}
          </h2>
        </div>

        <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-90 px-2 py-0.5 rounded bg-black/20">
          {activeFlights.length} {lang === "ar" ? "رحلات باليوم المحدد" : "Flights Selected"}
        </div>
      </div>

      {/* ═══ 2-Column Responsive Layout (Full Screen Fit) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* Left: Compact Month Grid (7 cols) */}
        <div
          className="lg:col-span-7 xl:col-span-8 rounded-xl overflow-hidden border shadow-xs"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          {/* Weekday headers */}
          <div
            className="grid grid-cols-7 text-center border-b bg-slate-50 dark:bg-slate-900/60"
            style={{ borderColor: "var(--border-default)" }}
          >
            {weekDayNames.map((d, i) => (
              <div
                key={i}
                className="py-1 text-[11px] font-bold uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 42 compact day cells */}
          <div className="grid grid-cols-7">
            {calendarGrid.map((cell, idx) => {
              const iso = cell.date.toISOString().slice(0, 10);
              const dayFlights = flightsByDate[iso] || [];
              const hasFlights = dayFlights.length > 0;
              const isToday = iso === today;
              const isActive = iso === activeDay;
              const past = isPast ? isPast({ std: cell.date.toISOString() }) : false;

              let bgColor = "var(--bg-card)";
              let textColor = cell.currentMonth ? "var(--text-primary)" : "var(--text-muted)";
              let opacity = cell.currentMonth ? 1 : 0.35;

              if (hasFlights) {
                bgColor = "var(--brand-primary)";
                textColor = "white";
                opacity = 1;
              } else if (past) {
                bgColor = "var(--bg-app)";
                textColor = "var(--text-muted)";
                opacity = cell.currentMonth ? 0.75 : 0.35;
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(cell)}
                  className="relative h-10 sm:h-12 flex flex-col items-center justify-center text-xs sm:text-sm font-bold transition-all"
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    opacity,
                    borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--border-default)" : "none",
                    borderBottom: idx < 35 ? "1px solid var(--border-default)" : "none",
                    boxShadow: isActive
                      ? `inset 0 0 0 2.5px #f59e0b`
                      : isToday
                      ? `inset 0 0 0 2px #38bdf8`
                      : "none",
                  }}
                  title={
                    hasFlights
                      ? `${dayFlights.length} flight${dayFlights.length > 1 ? "s" : ""}`
                      : ""
                  }
                >
                  <span className="font-mono">{cell.day}</span>
                  {hasFlights && (
                    <span className="flex items-center gap-0.5 mt-0.5">
                      <span className="text-[9px] font-mono font-black px-1 rounded-full bg-white/30 text-white">
                        {dayFlights.length}
                      </span>
                    </span>
                  )}
                  {isToday && (
                    <span
                      className="absolute top-0.5 end-0.5 text-[7px] font-mono font-black px-0.5 rounded"
                      style={{
                        backgroundColor: "var(--brand-accent)",
                        color: "white",
                      }}
                    >
                      {lang === "ar" ? "اليوم" : "NOW"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Flights Panel */}
        <div
          className="lg:col-span-5 xl:col-span-4 rounded-xl border shadow-xs overflow-hidden flex flex-col max-h-[500px]"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          {/* Header */}
          <div
            className="px-3 py-2 border-b flex items-center justify-between shrink-0"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div>
              <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                {activeDateLabel}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {activeFlights.length} {lang === "ar" ? "رحلات مسجلة" : "flights registered"}
              </div>
            </div>
            {activeFlights.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30">
                {activeFlights.length} FLTS
              </span>
            )}
          </div>

          {/* Flights list */}
          <div className="overflow-y-auto divide-y flex-1" style={{ borderColor: "var(--border-default)" }}>
            {activeFlights.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <Plane className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs text-slate-400">
                  {lang === "ar" ? "لا توجد رحلات مجدولة لهذا اليوم" : "No flights scheduled for this day"}
                </p>
              </div>
            ) : (
              activeFlights.map((f) => {
                const crewSlots = safeArray(f.crewSlots);
                const crewCodes = crewSlots
                  .map((slot) => {
                    const member = crew.find((c) => String(c.id) === String(slot.crewId));
                    return member ? (member.empNo || member.id) : null;
                  })
                  .filter(Boolean);

                const status = (f.status || "SCHEDULED").toUpperCase();
                const statusColor =
                  status === "CANCELLED"
                    ? "#ef4444"
                    : status === "ARRIVED"
                    ? "#22c55e"
                    : status === "DEPARTED" || status === "IN_FLIGHT"
                    ? "#3b82f6"
                    : status === "DELAYED"
                    ? "#f59e0b"
                    : "#0284c7";

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectFlight?.(f)}
                    className="w-full text-start p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"
                    style={{ borderInlineStart: `3px solid ${statusColor}` }}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-xs text-sky-600 dark:text-sky-400">
                          {f.flightNo}
                        </span>
                        <span className="text-[10px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                          {f.acft || "—"}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {fmtTime(f.std, timeMode)}z
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[11px] font-mono font-bold">
                      <div className="flex items-center gap-1">
                        <AirportHoverCard code={f.dep}>
                          <span className="text-slate-800 dark:text-slate-200 hover:underline">{f.dep}</span>
                        </AirportHoverCard>
                        <span className="text-slate-400">➔</span>
                        <AirportHoverCard code={f.arr}>
                          <span className="text-slate-800 dark:text-slate-200 hover:underline">{f.arr}</span>
                        </AirportHoverCard>
                      </div>

                      {f.flightNature === "FERRY" ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          FERRY
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                          PAX {f.pax !== undefined && f.pax !== null && f.pax !== "" ? `(${f.pax})` : ""}
                        </span>
                      )}
                    </div>

                    {crewCodes.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1 truncate">
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{crewCodes.join(" · ")}</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
