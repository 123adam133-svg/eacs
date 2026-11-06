/* ═══════════════════════════════════════════════════════════
 * CALENDAR VIEW — Modern Month Grid + Flight Details
 * v4.0 — Follows system theme (CSS Variables)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Filter,
  Plane,
  Clock,
  Users,
} from "lucide-react";
import { useT } from "../contexts";
import { MONTHS_EN, MONTHS_AR, DAYS_EN, DAYS_AR } from "../config/constants";
import { fmtTime, safeArray, todayISO } from "../utils/helpers";

/* ⭐ أسماء الأيام (تبدأ من الإثنين مثل الصورة) */
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
  const lang = document.documentElement.lang || "en";

  /* ⭐ حالة الشهر المعروض */
  const [viewYear, setViewYear] = useState(() => {
    return parseInt(selectedDate?.slice(0, 4)) || new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    return parseInt(selectedDate?.slice(5, 7)) - 1 || new Date().getMonth();
  });

  /* ⭐ اليوم النشط */
  const [activeDay, setActiveDay] = useState(() => {
    return selectedDate || todayISO();
  });

  const monthNames = lang === "ar" ? MONTHS_AR : MONTHS_EN;
  const weekDayNames = lang === "ar" ? WEEK_DAYS_AR : WEEK_DAYS;

  /* ⭐ الرحلات مفهرسة حسب التاريخ */
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

  /* ⭐ بناء شبكة الشهر (6 صفوف × 7 أعمدة) */
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1));
    const lastDay = new Date(Date.UTC(viewYear, viewMonth + 1, 0));
    const firstWeekDay = (firstDay.getUTCDay() + 6) % 7;
    const daysInMonth = lastDay.getUTCDate();

    const cells = [];

    const prevMonthLastDay = new Date(
      Date.UTC(viewYear, viewMonth, 0)
    ).getUTCDate();

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

  /* ⭐ التنقل بين الأشهر */
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

  /* ⭐ اختيار يوم */
  const handleSelectDay = (cell) => {
    if (!cell.currentMonth) {
      setViewYear(cell.date.getUTCFullYear());
      setViewMonth(cell.date.getUTCMonth());
    }
    const iso = cell.date.toISOString().slice(0, 10);
    setActiveDay(iso);
    setSelectedDate?.(iso);
  };

  /* ⭐ الرحلات النشطة */
  const activeFlights = flightsByDate[activeDay] || [];

  const activeDateObj = new Date(activeDay + "T00:00:00Z");
  const activeDateLabel = `${activeDateObj.getUTCDate()} ${
    (lang === "ar" ? MONTHS_AR : MONTHS_EN)[activeDateObj.getUTCMonth()]
  } ${activeDateObj.getUTCFullYear()}`;

  return (
    <div className="space-y-3 fade-in">
      {/* ═══ Header ═══ */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between shadow-md-theme"
        style={{ background: "var(--brand-gradient)", color: "white" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            className="px-3 py-1 rounded-lg hover:bg-white/20 transition text-sm font-bold"
          >
            {lang === "ar" ? "اليوم" : "Today"}
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-lg md:text-2xl font-black tracking-tight">
          {monthNames[viewMonth]} {viewYear}
        </h2>

        <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-80">
          {lang === "ar" ? "محدّث" : "UP TO DATE"}
        </div>
      </div>

      {/* ═══ Month Grid ═══ */}
      <div
        className="rounded-2xl overflow-hidden shadow-md-theme"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* أسماء الأيام */}
        <div
          className="grid grid-cols-7 text-center border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          {weekDayNames.map((d, i) => (
            <div
              key={i}
              className="py-2 text-xs md:text-sm font-bold uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* الشبكة */}
        <div className="grid grid-cols-7">
          {calendarGrid.map((cell, idx) => {
            const iso = cell.date.toISOString().slice(0, 10);
            const dayFlights = flightsByDate[iso] || [];
            const hasFlights = dayFlights.length > 0;
            const isToday = iso === today;
            const isActive = iso === activeDay;
            const past = isPast
              ? isPast({ std: cell.date.toISOString() })
              : false;

            let bgColor = "var(--bg-card)";
            let textColor = cell.currentMonth
              ? "var(--text-primary)"
              : "var(--text-muted)";
            let opacity = cell.currentMonth ? 1 : 0.4;

            if (hasFlights) {
              bgColor = "var(--brand-primary)";
              textColor = "white";
              opacity = 1;
            } else if (past) {
              bgColor = "var(--bg-app)";
              textColor = "var(--text-muted)";
              opacity = cell.currentMonth ? 0.7 : 0.4;
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectDay(cell)}
                className="relative aspect-square flex items-center justify-center text-sm md:text-base font-bold transition-all"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  opacity,
                  borderRight:
                    (idx + 1) % 7 !== 0
                      ? "1px solid var(--border-default)"
                      : "none",
                  borderBottom:
                    idx < 35 ? "1px solid var(--border-default)" : "none",
                  boxShadow: isActive
                    ? `inset 0 0 0 3px var(--brand-accent)`
                    : isToday
                    ? `inset 0 0 0 2px var(--brand-secondary)`
                    : "none",
                }}
                title={
                  hasFlights
                    ? `${dayFlights.length} flight${
                        dayFlights.length > 1 ? "s" : ""
                      }`
                    : ""
                }
              >
                {cell.day}
                {hasFlights && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dayFlights.slice(0, 3).map((_, i) => (
                      <span key={i} className="w-1 h-1 rounded-full bg-white" />
                    ))}
                  </span>
                )}
                {isToday && (
                  <span
                    className="absolute top-1 right-1 text-[8px] font-black px-1 rounded"
                    style={{
                      backgroundColor: "var(--brand-accent)",
                      color: "white",
                    }}
                  >
                    {lang === "ar" ? "اليوم" : "TODAY"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Flight Details ═══ */}
      <div
        className="rounded-2xl overflow-hidden shadow-md-theme"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        {/* رأس القائمة */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-header)",
            borderBottom: "1px solid var(--border-default)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h3
            className="text-sm md:text-base font-black"
            style={{ color: "var(--text-primary)" }}
          >
            {activeDateLabel}
            {activeFlights.length > 0 && (
              <span
                className="ms-2 text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "white",
                }}
              >
                {activeFlights.length}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              style={{ color: "var(--text-muted)" }}
              title="Refresh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              style={{ color: "var(--text-muted)" }}
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* قائمة الرحلات */}
        {activeFlights.length === 0 ? (
          <div className="p-8 text-center">
            <Plane
              className="w-12 h-12 mx-auto mb-2 opacity-30"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {lang === "ar" ? "لا توجد رحلات" : "No flights"}
            </p>
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "var(--border-default)" }}
          >
            {activeFlights.map((f) => {
              const crewSlots = safeArray(f.crewSlots);
              const crewNames = crewSlots
                .map((slot) => {
                  const member = crew.find((c) => c.id === slot.crewId);
                  if (!member) return null;
                  return member.empNo
                    ? member.empNo
                    : member.fullName
                    ? member.fullName.slice(0, 3).toUpperCase()
                    : "—";
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
                  : "var(--brand-primary)";

              return (
                <button
                  key={f.id}
                  onClick={() => onSelectFlight?.(f)}
                  className="w-full text-start px-3 py-2.5 hover:bg-white/5 transition group"
                  style={{ borderLeft: `4px solid ${statusColor}` }}
                >
                  {/* الصف الأول */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="font-mono font-black text-sm md:text-base"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {f.flightNo}
                      </span>
                      <span
                        className="text-xs md:text-sm font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {fmtTime(f.std, timeMode)}{" "}
                        <span style={{ color: "var(--brand-primary)" }}>
                          {f.dep}
                        </span>{" "}
                        <span style={{ color: "var(--text-muted)" }}>→</span>{" "}
                        {fmtTime(f.sta, timeMode)}{" "}
                        <span style={{ color: "var(--brand-primary)" }}>
                          {f.arr}
                        </span>
                      </span>
                    </div>
                    <span
                      className="font-mono font-bold text-[11px] md:text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        color: "var(--brand-primary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {f.acft}
                    </span>
                  </div>

                  {/* الصف الثاني */}
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className="flex items-center gap-1.5 text-[10px] md:text-xs font-mono truncate min-w-0 flex-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Plane
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: "var(--brand-primary)" }}
                      />
                      <span className="truncate">
                        {lang === "ar" ? "الطاقم:" : "Crew:"}{" "}
                        {crewNames.length > 0 ? crewNames.join("-") : "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] opacity-70">
                        {crewNames.length}
                      </span>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                        title={status}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CalendarView;
