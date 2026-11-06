/* ═══════════════════════════════════════════════════════════
 * CUSTOMIZABLE DASHBOARD — WIDGET SYSTEM & WIDGETS LIBRARY
 * Each widget is an independent modular definition with:
 *   id, title, title_ar, title_en, icon, component,
 *   defaultSize ('small' | 'medium' | 'large'),
 *   permissions (string[]), category ('Operations' | 'Quality' | 'Admin')
 * ═══════════════════════════════════════════════════════════ */
import React, { useMemo, useState } from "react";
import {
  Activity,
  Plane,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  BookOpen,
  GraduationCap,
  FileSignature,
  UtensilsCrossed,
  Shield,
  ClipboardList,
  History,
  Lock,
  TrendingUp,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  RefreshCw,
  Wrench,
  Gauge,
  Package,
} from "lucide-react";
import { Badge } from "../components/ui";
import { AlertsSummary } from "../modules/AlertsSummary";
import { computeAlerts } from "../utils/alerts";
import {
  todayISO,
  daysUntil,
  fmtDate,
  fmtTime,
  fmtDateTime,
  safeArray,
  safeNumber,
} from "../utils/helpers";
import { readSheetCache } from "../api";
import { TRAINING_TYPES } from "../config/constants";

/* ═══════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════ */
export const WIDGET_CATEGORIES = [
  {
    id: "Operations",
    label_en: "Operations",
    label_ar: "العمليات التشغيلية",
    badgeClass:
      "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  {
    id: "Quality",
    label_en: "Quality & Compliance",
    label_ar: "الجودة والامتثال",
    badgeClass:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  },
  {
    id: "Admin",
    label_en: "Administration & Security",
    label_ar: "الإدارة والأمان",
    badgeClass:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
  },
];

export const SIZE_LABELS = {
  small: { en: "Small", ar: "صغير", short: "S" },
  medium: { en: "Medium", ar: "متوسط", short: "M" },
  large: { en: "Large", ar: "كبير", short: "L" },
};

export function getWidgetTitle(widget, lang = "en") {
  if (!widget) return "";
  return lang === "ar"
    ? widget.title_ar || widget.title
    : widget.title_en || widget.title;
}

export function getWidgetDescription(widget, lang = "en") {
  if (!widget) return "";
  return lang === "ar"
    ? widget.description_ar || ""
    : widget.description_en || "";
}

export function canUserSeeWidget(widget, canFn) {
  if (!widget) return false;
  const perms = Array.isArray(widget.permissions) ? widget.permissions : [];
  if (perms.length === 0) return true;
  if (typeof canFn !== "function") return false;
  return perms.some((perm) => canFn(perm));
}

function scoreTone(score) {
  if (score >= 90)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
      chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
      label_en: "Compliant",
      label_ar: "ممتثل",
    };
  if (score >= 75)
    return {
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
      chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
      label_en: "Attention",
      label_ar: "يحتاج متابعة",
    };
  return {
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    label_en: "Action Required",
    label_ar: "إجراء عاجل",
  };
}

/* ═══════════════════════════════════════════════════════════
 * 1. OPERATIONS WIDGETS
 * ═══════════════════════════════════════════════════════════ */

function OpsKpiOverviewWidget({
  flights = [],
  fleet = [],
  crew = [],
  melList = [],
  leave = [],
  standby = [],
  setTab,
  can,
  lang,
}) {
  const isAr = lang === "ar";
  const today = todayISO();
  const todayFlights = flights.filter((f) => String(f.std || "").startsWith(today));
  const liveFlights = flights.filter(
    (f) => f.status === "IN_FLIGHT" || f.status === "DEPARTED"
  );
  const airworthyCount = fleet.filter((a) => a.status === "AIRWORTHY").length;
  const activeCrewCount = crew.filter((c) => c.status === "active").length;
  const openMels = melList.filter(
    (m) => String(m.status || "OPEN").toUpperCase() === "OPEN"
  ).length;
  const pendingLeaves = leave.filter((l) => l.status === "pending").length;
  const todayStandby = standby.filter((s) => s.date === today).length;

  const tiles = [
    {
      id: "flights",
      show: can("schedule.view"),
      tab: "schedule",
      icon: Calendar,
      label: isAr ? "إجمالي الرحلات" : "Total Flights",
      value: flights.length,
      meta: isAr
        ? `${todayFlights.length} اليوم · ${liveFlights.length} نشطة`
        : `${todayFlights.length} today · ${liveFlights.length} active`,
      accent: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
    },
    {
      id: "fleet",
      show: can("fleet.view"),
      tab: "fleet",
      icon: Plane,
      label: isAr ? "صلاحية الأسطول" : "Airworthy Fleet",
      value: `${airworthyCount}/${fleet.length}`,
      meta: isAr
        ? `${openMels} أعطال MEL مفتوحة`
        : `${openMels} open MEL items`,
      accent: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
    {
      id: "crew",
      show: can("crew.view"),
      tab: "crew",
      icon: Users,
      label: isAr ? "الطاقم الفعّال" : "Active Crew",
      value: activeCrewCount,
      meta: isAr
        ? `${todayStandby} احتياطي اليوم من أصل ${crew.length}`
        : `${todayStandby} standby today · ${crew.length} total`,
      accent: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
    },
    {
      id: "leave",
      show: can("leave.view") || can("roster.view"),
      tab: can("leave.view") ? "leave" : "roster",
      icon: Clock,
      label: isAr ? "طلبات الإجازة المعلقة" : "Pending Leave",
      value: pendingLeaves,
      meta: isAr
        ? `${leave.length} سجل إجازات مسجل`
        : `${leave.length} total leave records`,
      accent:
        pendingLeaves > 0
          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
          : "text-slate-600 dark:text-slate-400 bg-slate-500/10",
    },
  ].filter((x) => x.show);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => setTab?.(tile.tab)}
            className="p-3.5 rounded-lg text-start transition hover:opacity-90 group flex flex-col justify-between"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center ${tile.accent}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <ArrowUpRight
                className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
            <div>
              <div
                className="text-2xl font-bold font-mono tabular-nums tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {tile.value}
              </div>
              <div
                className="text-xs font-semibold mt-0.5 truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {tile.label}
              </div>
              <div
                className="text-[11px] mt-1 font-mono tabular-nums truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {tile.meta}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function FlightWatchWidget({ flights = [], setTab, lang }) {
  const isAr = lang === "ar";
  const [filterMode, setFilterMode] = useState("today");
  const today = todayISO();

  const filtered = useMemo(() => {
    const sorted = [...flights].sort((a, b) =>
      String(b.std || "").localeCompare(String(a.std || ""))
    );
    if (filterMode === "live") {
      return sorted.filter(
        (f) =>
          f.status === "IN_FLIGHT" ||
          f.status === "DEPARTED" ||
          f.status === "DELAYED"
      );
    }
    if (filterMode === "today") {
      const tList = sorted.filter((f) => String(f.std || "").startsWith(today));
      return tList.length > 0 ? tList : sorted.slice(0, 6);
    }
    return sorted.slice(0, 8);
  }, [flights, filterMode, today]);

  const todayExactCount = flights.filter((f) =>
    String(f.std || "").startsWith(today)
  ).length;
  const liveCount = flights.filter(
    (f) => f.status === "IN_FLIGHT" || f.status === "DEPARTED"
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {[
            {
              id: "today",
              label: isAr
                ? `اليوم (${todayExactCount})`
                : `Today (${todayExactCount})`,
            },
            {
              id: "live",
              label: isAr ? `نشطة (${liveCount})` : `Active (${liveCount})`,
            },
            {
              id: "recent",
              label: isAr ? "الأحدث" : "Recent",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold font-mono tabular-nums transition"
              style={
                filterMode === tab.id
                  ? {
                      backgroundColor: "var(--brand-primary)",
                      color: "#ffffff",
                    }
                  : {
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-muted)",
                      border: "1px solid var(--border-default)",
                    }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setTab?.("schedule")}
          className="text-xs font-semibold flex items-center gap-1 hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          {isAr ? "فتح جدول الرحلات" : "Open Schedule"}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div
          className="py-8 px-4 rounded-lg text-center"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Plane
            className="w-8 h-8 mx-auto mb-2 opacity-40"
            style={{ color: "var(--text-muted)" }}
          />
          <div
            className="text-xs font-semibold mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {isAr
              ? "لا توجد رحلات مطابقة لهذا الفلتر حالياً"
              : "No flights matching this filter right now"}
          </div>
          <button
            type="button"
            onClick={() => setTab?.("schedule")}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {isAr ? "إدارة الرحلات" : "Manage Flights"}
          </button>
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden divide-y"
          style={{
            border: "1px solid var(--border-default)",
            borderColor: "var(--border-default)",
          }}
        >
          {filtered.slice(0, 6).map((f, idx) => (
            <div
              key={f.id || idx}
              onClick={() => setTab?.("schedule")}
              className="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition hover:opacity-85"
              style={{
                backgroundColor: "var(--bg-app)",
                borderTop:
                  idx > 0 ? "1px solid var(--border-default)" : "none",
              }}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 font-mono text-[11px] font-bold"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    color: "var(--brand-primary)",
                  }}
                >
                  {(f.acft || "AC").slice(-3)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-xs font-mono tabular-nums"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {f.flightNo || "—"}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {f.dep || "—"} → {f.arr || "—"}
                    </span>
                  </div>
                  <div
                    className="text-[11px] font-mono tabular-nums truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {fmtDate(f.std)} · {fmtTime(f.std, "UTC")}Z –{" "}
                    {fmtTime(f.sta, "UTC")}Z · {f.acft || "TBA"}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-end">
                <Badge kind={f.status}>{f.status || "SCHEDULED"}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FleetReadinessWidget({ fleet = [], setTab, lang }) {
  const isAr = lang === "ar";
  const total = fleet.length;
  const airworthy = fleet.filter((a) => a.status === "AIRWORTHY").length;
  const pct = total > 0 ? Math.round((airworthy / total) * 100) : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {pct}%
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `${airworthy} من ${total} طائرات صالحة للطيران`
              : `${airworthy} of ${total} aircraft airworthy`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("fleet")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "الأسطول" : "Fleet"}
        </button>
      </div>

      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <div
          className={`h-full transition-all ${
            pct >= 80
              ? "bg-emerald-500"
              : pct >= 50
              ? "bg-amber-500"
              : "bg-rose-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {fleet.length === 0 ? (
        <div
          className="text-xs py-4 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {isAr ? "لا توجد طائرات مسجلة" : "No aircraft registered"}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {fleet.slice(0, 6).map((ac, i) => {
            const isOk = ac.status === "AIRWORTHY";
            return (
              <div
                key={ac.id || ac.reg || i}
                className="px-2.5 py-2 rounded-md flex items-center justify-between text-xs"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="min-w-0">
                  <span
                    className="font-bold font-mono"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {ac.reg || "—"}
                  </span>
                  <span
                    className="ms-2 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {ac.type || ""}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {safeNumber(ac.tah, 0)}h
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isOk
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {ac.status || "AIRWORTHY"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CrewDutyFtlWidget({ crew = [], setTab, lang }) {
  const isAr = lang === "ar";
  const activeCrew = crew.filter((c) => c.status === "active");
  const sortedByFtl = [...activeCrew].sort(
    (a, b) => safeNumber(b.ftl28, 0) - safeNumber(a.ftl28, 0)
  );
  const highLoadCount = activeCrew.filter(
    (c) => safeNumber(c.ftl28, 0) >= 80
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {activeCrew.length}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `طاقم نشط · ${highLoadCount} فوق 80 ساعة/28 يوم`
              : `Active crew · ${highLoadCount} above 80h / 28d`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("ftl")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          FTL
        </button>
      </div>

      {sortedByFtl.length === 0 ? (
        <div
          className="text-xs py-4 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {isAr ? "لا توجد بيانات ساعات طيران" : "No crew FTL records"}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedByFtl.slice(0, 5).map((member, idx) => {
            const hrs = safeNumber(member.ftl28, 0);
            const pct = Math.min(100, Math.round((hrs / 100) * 100));
            const barClass =
              hrs >= 90
                ? "bg-rose-500"
                : hrs >= 75
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <div key={member.id || idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-semibold truncate max-w-[65%]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {member.fullName || "—"}
                  </span>
                  <span
                    className="font-mono tabular-nums text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {hrs.toFixed(1)} / 100h
                  </span>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--bg-app)" }}
                >
                  <div
                    className={`h-full ${barClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StandbyLeavePulseWidget({
  standby = [],
  leave = [],
  roster = [],
  setTab,
  can,
  lang,
}) {
  const isAr = lang === "ar";
  const today = todayISO();
  const todayStandby = standby.filter((s) => s.date === today);
  const pendingLeave = leave.filter((l) => l.status === "pending");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={() => can("standby.view") && setTab?.("roster.standby")}
          className="p-2.5 rounded-md transition hover:opacity-85"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {todayStandby.length}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "احتياطي اليوم" : "Standby"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => can("leave.view") && setTab?.("roster.leave")}
          className="p-2.5 rounded-md transition hover:opacity-85"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {pendingLeave.length}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "إجازات معلقة" : "Pending Leave"}
          </div>
        </button>

        <button
          type="button"
          onClick={() => can("roster.view") && setTab?.("roster")}
          className="p-2.5 rounded-md transition hover:opacity-85"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            className="text-lg font-bold font-mono tabular-nums"
            style={{ color: "var(--brand-primary)" }}
          >
            {roster.length}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "مناوبات" : "Roster"}
          </div>
        </button>
      </div>

      {todayStandby.length > 0 ? (
        <div className="space-y-1.5">
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {isAr ? "المناوبون اليوم:" : "Today's Standby Crew:"}
          </div>
          {todayStandby.slice(0, 3).map((s, i) => (
            <div
              key={s.id || i}
              className="px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span
                className="font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {s.crewName || "—"}
              </span>
              <span
                className="font-mono tabular-nums text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                {s.type} · {s.startTime || "00:00"}–{s.endTime || "23:59"}
              </span>
            </div>
          ))}
        </div>
      ) : pendingLeave.length > 0 ? (
        <div className="space-y-1.5">
          <div
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {isAr ? "بانتظار الاعتماد:" : "Awaiting Approval:"}
          </div>
          {pendingLeave.slice(0, 3).map((lv, i) => (
            <div
              key={lv.id || i}
              className="px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span
                className="font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {lv.crewName || "—"}
              </span>
              <span className="font-mono tabular-nums text-[11px] text-amber-600 dark:text-amber-400">
                {fmtDate(lv.fromDate)} ({lv.days || 1}d)
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="text-xs py-3 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {isAr
            ? "لا توجد مناوبات احتياطية أو إجازات معلقة لليوم"
            : "No standby shifts or pending leave requests today"}
        </div>
      )}
    </div>
  );
}

function PermitsCateringOpsWidget({
  permits = [],
  cateringOrders = [],
  setTab,
  can,
  lang,
}) {
  const isAr = lang === "ar";
  const approvedPermits = permits.filter(
    (p) => String(p.status || "").toUpperCase() === "APPROVED"
  ).length;
  const pendingPermits = permits.filter((p) =>
    ["PENDING", "DRAFT", "SUBMITTED"].includes(
      String(p.status || "").toUpperCase()
    )
  ).length;

  const pendingCatering = cateringOrders.filter(
    (o) => String(o.status || "").toUpperCase() === "PENDING"
  ).length;
  const deliveredCatering = cateringOrders.filter((o) =>
    ["CONFIRMED", "DELIVERED"].includes(String(o.status || "").toUpperCase())
  ).length;

  const lowDryStock = useMemo(() => {
    if (typeof window === "undefined") return 0;
    try {
      const raw = window.localStorage.getItem("aeroops.dry_store_items");
      if (!raw) return 0;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) return 0;
      return items.filter(
        (it) => safeNumber(it.currentStock, 0) <= safeNumber(it.minThreshold, 0)
      ).length;
    } catch {
      return 0;
    }
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {can("permits.view") && (
        <div
          className="p-3 rounded-lg flex flex-col justify-between space-y-2.5"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              <FileSignature
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
              {isAr ? "تصاريح الطيران" : "Flight Permits"}
            </span>
            <button
              type="button"
              onClick={() => setTab?.("permits")}
              className="text-[11px] font-semibold hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              {isAr ? "عرض" : "Open"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
            <div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {approvedPermits}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr ? "معتمدة" : "Approved"}
              </div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {pendingPermits}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr ? "قيد الإجراء" : "In Progress"}
              </div>
            </div>
          </div>
        </div>
      )}

      {can("catering.view") && (
        <div
          className="p-3 rounded-lg flex flex-col justify-between space-y-2.5"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold flex items-center gap-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              <UtensilsCrossed
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
              {isAr ? "التموين والمخزن الجاف" : "Catering & Dry Store"}
            </span>
            <button
              type="button"
              onClick={() => setTab?.("catering")}
              className="text-[11px] font-semibold hover:underline"
              style={{ color: "var(--brand-primary)" }}
            >
              {isAr ? "عرض" : "Open"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-mono tabular-nums">
            <div>
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {pendingCatering}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {isAr ? "قيد التجهيز" : "Pending"}
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {deliveredCatering}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {isAr ? "مؤكدة" : "Confirmed"}
              </div>
            </div>
            <div>
              <div
                className={`text-lg font-bold ${
                  lowDryStock > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-500"
                }`}
              >
                {lowDryStock}
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {isAr ? "نقص مخزون" : "Low Stock"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickOpsActionsWidget({ setTab, can, lang, t }) {
  const isAr = lang === "ar";
  const actions = [
    {
      id: "schedule",
      icon: Calendar,
      label: t?.scheduleBoard || (isAr ? "جدول الرحلات" : "Schedule"),
      show: can("schedule.view"),
    },
    {
      id: "roster",
      icon: Users,
      label: isAr ? "الروستر والإجازات" : "Roster & Leave",
      show: can("roster.view") || can("leave.view") || can("standby.view"),
    },
    {
      id: "quality_management",
      icon: ShieldCheck,
      label: isAr ? "إدارة الجودة" : "Quality Mgmt",
      show: can("quality.view"),
    },
    {
      id: "ftl",
      icon: Clock,
      label: t?.ftl || (isAr ? "ساعات الطيران" : "FTL"),
      show: can("ftl.view"),
    },
    {
      id: "reports",
      icon: TrendingUp,
      label: t?.reports || (isAr ? "التقارير" : "Reports"),
      show: can("reports.view"),
    },
    {
      id: "permits",
      icon: FileSignature,
      label: isAr ? "التصاريح" : "Permits",
      show: can("permits.view"),
    },
    {
      id: "forms",
      icon: ClipboardList,
      label: isAr ? "النماذج" : "Forms",
      show: can("forms.view"),
    },
    {
      id: "catering",
      icon: Package,
      label: isAr ? "التموين" : "Catering",
      show: can("catering.view"),
    },
  ].filter((a) => a.show);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {actions.map((qa) => {
        const Icon = qa.icon;
        return (
          <button
            key={qa.id}
            type="button"
            onClick={() => setTab?.(qa.id)}
            className="p-2.5 rounded-lg text-center transition hover:opacity-85 group flex flex-col items-center justify-center gap-1.5"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <Icon
              className="w-4 h-4 transition group-hover:scale-110"
              style={{ color: "var(--brand-primary)" }}
            />
            <span
              className="text-[11px] font-semibold truncate w-full"
              style={{ color: "var(--text-primary)" }}
            >
              {qa.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * 2. QUALITY DASHBOARD WIDGETS (مواصفات مقترحة — Quality Dashboard)
 * ═══════════════════════════════════════════════════════════ */

function ComplianceScoreWidget({
  crew = [],
  fleet = [],
  training = [],
  manuals = [],
  setTab,
  lang,
}) {
  const isAr = lang === "ar";

  const metrics = useMemo(() => {
    // 1. Crew statutory documents validity (Medical, License, Passport)
    const activeCrew = crew.filter((c) => c.status === "active");
    let crewValid = 0;
    activeCrew.forEach((c) => {
      const medOk = !c.medicalExpiry || daysUntil(c.medicalExpiry) >= 0;
      const licOk = !c.licenseExpiry || daysUntil(c.licenseExpiry) >= 0;
      const passOk = !c.passportExpiry || daysUntil(c.passportExpiry) >= 0;
      if (medOk && licOk && passOk) crewValid++;
    });
    const crewPct =
      activeCrew.length > 0
        ? Math.round((crewValid / activeCrew.length) * 100)
        : 100;

    // 2. Fleet & CAMO Airworthiness compliance
    let fleetValid = 0;
    fleet.forEach((ac) => {
      const airworthy = ac.status === "AIRWORTHY";
      const coaOk = !ac.coaExpiry || daysUntil(ac.coaExpiry) >= 0;
      const insOk = !ac.insuranceExpiry || daysUntil(ac.insuranceExpiry) >= 0;
      const chkOk = !ac.nextCheck || daysUntil(ac.nextCheck) >= 0;
      if (airworthy && coaOk && insOk && chkOk) fleetValid++;
    });
    const fleetPct =
      fleet.length > 0 ? Math.round((fleetValid / fleet.length) * 100) : 100;

    // 3. Recurrent Training & Simulator Qualification
    let trainingValid = 0;
    training.forEach((tr) => {
      const passed = String(tr.result || "PASS").toUpperCase() !== "FAIL";
      const notExpired = !tr.expiryDate || daysUntil(tr.expiryDate) >= 0;
      if (passed && notExpired) trainingValid++;
    });
    const trainingPct =
      training.length > 0
        ? Math.round((trainingValid / training.length) * 100)
        : 100;

    // 4. Operations Manuals Currency
    const activeManuals = manuals.filter(
      (m) => String(m.status || "active").toLowerCase() === "active"
    ).length;
    const manualsPct =
      manuals.length > 0
        ? Math.round((activeManuals / manuals.length) * 100)
        : 100;

    const overall = Math.round(
      crewPct * 0.3 + fleetPct * 0.3 + trainingPct * 0.25 + manualsPct * 0.15
    );

    return {
      overall,
      pillars: [
        {
          id: "crew",
          tab: "crew",
          label: isAr ? "وثائق وصلاحيات الطاقم" : "Crew Statutory Docs",
          score: crewPct,
          detail: `${crewValid}/${activeCrew.length}`,
        },
        {
          id: "camo",
          tab: "camo",
          label: isAr ? "صلاحية الطيران (CAMO)" : "Fleet Airworthiness",
          score: fleetPct,
          detail: `${fleetValid}/${fleet.length}`,
        },
        {
          id: "training",
          tab: "training",
          label: isAr ? "كفاءة التدريب الدوري" : "Training Currency",
          score: trainingPct,
          detail: `${trainingValid}/${training.length}`,
        },
        {
          id: "manuals",
          tab: "manuals",
          label: isAr ? "حداثة الأدلة المعتمدة" : "Manuals Currency",
          score: manualsPct,
          detail: `${activeManuals}/${manuals.length}`,
        },
      ],
    };
  }, [crew, fleet, training, manuals, isAr]);

  const overallTone = scoreTone(metrics.overall);

  return (
    <div className="space-y-4">
      <div
        className="p-3.5 rounded-lg flex items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-app)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-bold font-mono tabular-nums ${overallTone.text}`}
            >
              {metrics.overall}%
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${overallTone.chip}`}
            >
              {isAr ? overallTone.label_ar : overallTone.label_en}
            </span>
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? "مؤشر الامتثال المرجّح عبر الطاقم والأسطول والتدريب والأدلة"
              : "Weighted compliance across crew, airworthiness, training & manuals"}
          </div>
        </div>
        <Gauge
          className={`w-9 h-9 shrink-0 ${overallTone.text} opacity-80`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {metrics.pillars.map((p) => {
          const tone = scoreTone(p.score);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setTab?.(p.tab)}
              className="p-2.5 rounded-lg text-start transition hover:opacity-85 space-y-1.5"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className="font-semibold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {p.label}
                </span>
                <span className={`font-bold font-mono tabular-nums ${tone.text}`}>
                  {p.score}%
                </span>
              </div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-card)" }}
              >
                <div
                  className={`h-full ${tone.bar}`}
                  style={{ width: `${p.score}%` }}
                />
              </div>
              <div
                className="text-[10px] font-mono tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {isAr ? "السجلات المطابقة:" : "Valid records:"} {p.detail}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpiringDocsRadarWidget({
  crew = [],
  users = [],
  fleet = [],
  training = [],
  lang,
}) {
  const isAr = lang === "ar";
  const [sevFilter, setSevFilter] = useState("all");

  const combinedAlerts = useMemo(() => {
    const base = computeAlerts(crew, users, fleet);
    const trainingAlerts = [];
    safeArray(training).forEach((tr) => {
      if (!tr.expiryDate) return;
      const d = daysUntil(tr.expiryDate);
      let sev = null;
      if (d < 0) sev = "expired";
      else if (d <= 15) sev = "critical";
      else if (d <= 60) sev = "expiring";
      if (sev) {
        trainingAlerts.push({
          key: `training_${tr.id}_${tr.expiryDate}`,
          sev,
          subject: tr.crewName || tr.title || "—",
          source: "training",
          label: tr.title || tr.type || "Training",
          expiry: tr.expiryDate,
          days: d,
        });
      }
    });
    return [...base, ...trainingAlerts].sort((a, b) => a.days - b.days);
  }, [crew, users, fleet, training]);

  const counts = useMemo(
    () => ({
      expired: combinedAlerts.filter((a) => a.sev === "expired").length,
      critical: combinedAlerts.filter((a) => a.sev === "critical").length,
      expiring: combinedAlerts.filter((a) => a.sev === "expiring").length,
    }),
    [combinedAlerts]
  );

  const visible =
    sevFilter === "all"
      ? combinedAlerts
      : combinedAlerts.filter((a) => a.sev === sevFilter);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 font-mono tabular-nums">
        <button
          type="button"
          onClick={() =>
            setSevFilter(sevFilter === "expired" ? "all" : "expired")
          }
          className={`p-2 rounded-md border text-start transition ${
            sevFilter === "expired"
              ? "ring-2 ring-rose-500"
              : ""
          } bg-rose-500/10 border-rose-500/25`}
        >
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
            {counts.expired}
          </div>
          <div className="text-[10px] text-rose-700 dark:text-rose-300">
            {isAr ? "منتهية الصلاحية" : "Expired (<0d)"}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setSevFilter(sevFilter === "critical" ? "all" : "critical")
          }
          className={`p-2 rounded-md border text-start transition ${
            sevFilter === "critical"
              ? "ring-2 ring-orange-500"
              : ""
          } bg-orange-500/10 border-orange-500/25`}
        >
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {counts.critical}
          </div>
          <div className="text-[10px] text-orange-700 dark:text-orange-300">
            {isAr ? "حرجة (≤15 يوم)" : "Critical (≤15d)"}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setSevFilter(sevFilter === "expiring" ? "all" : "expiring")
          }
          className={`p-2 rounded-md border text-start transition ${
            sevFilter === "expiring"
              ? "ring-2 ring-amber-500"
              : ""
          } bg-amber-500/10 border-amber-500/25`}
        >
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {counts.expiring}
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300">
            {isAr ? "قريبة (≤60 يوم)" : "Upcoming (≤60d)"}
          </div>
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {isAr
              ? "جميع الشهادات والوثائق ضمن فترة الصلاحية المعتمدة"
              : "All tracked certificates and statutory documents are valid"}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {visible.slice(0, 8).map((item, idx) => {
            const toneClass =
              item.sev === "expired"
                ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                : item.sev === "critical"
                ? "text-orange-600 dark:text-orange-400 bg-orange-500/10"
                : "text-amber-600 dark:text-amber-400 bg-amber-500/10";
            return (
              <div
                key={item.key || idx}
                className="px-3 py-2 rounded-md flex items-center justify-between gap-2 text-xs"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="min-w-0">
                  <div
                    className="font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.subject}
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.label} · {item.source}
                  </div>
                </div>
                <div className="text-end shrink-0 font-mono tabular-nums">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${toneClass}`}
                  >
                    {item.days < 0
                      ? isAr
                        ? `منتهي منذ ${Math.abs(item.days)}ي`
                        : `${Math.abs(item.days)}d ago`
                      : isAr
                      ? `${item.days} يوم`
                      : `${item.days}d left`}
                  </span>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {fmtDate(item.expiry)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertsDismissWidget({ crew = [], users = [], fleet = [] }) {
  return <AlertsSummary crew={crew} users={users} fleet={fleet} />;
}

function CamoMelWatchWidget({ camoList = [], melList = [], setTab, lang }) {
  const isAr = lang === "ar";
  const openMels = melList.filter(
    (m) => String(m.status || "OPEN").toUpperCase() === "OPEN"
  );
  const byCat = ["A", "B", "C", "D"].map((cat) => ({
    cat,
    count: openMels.filter(
      (m) => String(m.category || "C").toUpperCase() === cat
    ).length,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {byCat.map((b) => (
            <div
              key={b.cat}
              className="px-2.5 py-1 rounded-md text-xs font-mono tabular-nums"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span style={{ color: "var(--text-muted)" }}>CAT {b.cat}: </span>
              <span
                className="font-bold"
                style={{
                  color:
                    b.count > 0 ? "#d97706" : "var(--text-primary)",
                }}
              >
                {b.count}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTab?.("camo")}
          className="text-xs font-semibold flex items-center gap-1 hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          CAMO <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {openMels.length > 0 ? (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {openMels.slice(0, 5).map((mel, idx) => {
            const dLeft = mel.dueDate ? daysUntil(mel.dueDate) : null;
            return (
              <div
                key={mel.id || idx}
                className="px-3 py-2 rounded-md flex items-center justify-between gap-2 text-xs"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="min-w-0">
                  <div
                    className="font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span className="font-mono">{mel.reg || "—"}</span> ·{" "}
                    {mel.melRef || "MEL"} — {mel.item || "—"}
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {mel.restrictions || mel.remarks || (isAr ? "مفتوح" : "Deferred")}
                  </div>
                </div>
                <div className="shrink-0 text-end font-mono tabular-nums">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                    CAT {mel.category || "C"}
                  </span>
                  {dLeft !== null && dLeft !== Infinity && (
                    <div
                      className={`text-[10px] mt-0.5 ${
                        dLeft < 0 ? "text-rose-500 font-bold" : ""
                      }`}
                      style={
                        dLeft >= 0 ? { color: "var(--text-muted)" } : undefined
                      }
                    >
                      {fmtDate(mel.dueDate)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="p-3 rounded-lg flex items-center justify-between text-xs"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `لا توجد أعطال MEL مفتوحة · ${camoList.length} سجل CAMO نشط`
              : `Zero open MEL items · ${camoList.length} CAMO aircraft tracked`}
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>
      )}
    </div>
  );
}

function TrainingQualificationWidget({ training = [], setTab, lang }) {
  const isAr = lang === "ar";
  const total = training.length;
  const passed = training.filter(
    (t) => String(t.result || "PASS").toUpperCase() === "PASS"
  ).length;
  const expiringSoon = training.filter((t) => {
    const d = daysUntil(t.expiryDate);
    return d >= 0 && d <= 60;
  }).length;
  const expired = training.filter((t) => daysUntil(t.expiryDate) < 0).length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {passRate}%
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `معدل اجتياز التدريب (${total} سجل)`
              : `Pass rate (${total} checks)`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("training")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "التدريب" : "Training"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
        <div
          className="p-2.5 rounded-md"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {expiringSoon}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "تنتهي خلال 60 يوم" : "Expiring ≤60d"}
          </div>
        </div>
        <div
          className="p-2.5 rounded-md"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div
            className={`text-base font-bold ${
              expired > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {expired}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "شهادات منتهية" : "Expired Checks"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualsLibraryStatusWidget({ manuals = [], setTab, lang }) {
  const isAr = lang === "ar";
  const activeCount = manuals.filter(
    (m) => String(m.status || "active").toLowerCase() === "active"
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {activeCount}
            <span
              className="text-sm font-normal ms-1"
              style={{ color: "var(--text-muted)" }}
            >
              / {manuals.length}
            </span>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr ? "أدلة تشغيلية سارية المفعول" : "Active approved manuals"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("manuals")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "الأدلة" : "Manuals"}
        </button>
      </div>

      {manuals.length === 0 ? (
        <div
          className="text-xs py-3 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {isAr ? "لا توجد أدلة مرفوعة حالياً" : "No manuals uploaded yet"}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {manuals.slice(0, 4).map((m, idx) => (
            <div
              key={m.id || idx}
              className="px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="min-w-0">
                <span
                  className="font-bold font-mono me-1.5"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {m.code || "DOC"}
                </span>
                <span
                  className="truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr ? m.title_ar || m.title_en : m.title_en || m.title_ar}
                </span>
              </div>
              <span
                className="font-mono tabular-nums text-[10px] shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                Rev {m.rev || "0"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OtpDispatchQualityWidget({ flights = [], setTab, lang }) {
  const isAr = lang === "ar";

  const stats = useMemo(() => {
    const total = flights.length;
    if (total === 0) {
      return {
        total: 0,
        otpPct: 100,
        crewCoveragePct: 100,
        delayed: 0,
        cancelled: 0,
        completed: 0,
      };
    }
    const delayed = flights.filter(
      (f) => String(f.status || "").toUpperCase() === "DELAYED"
    ).length;
    const cancelled = flights.filter(
      (f) => String(f.status || "").toUpperCase() === "CANCELLED"
    ).length;
    const completed = flights.filter((f) =>
      ["ARRIVED", "COMPLETED"].includes(String(f.status || "").toUpperCase())
    ).length;
    const withCrew = flights.filter((f) => {
      const c = safeArray(f.crew);
      return c.length > 0;
    }).length;

    const effective = Math.max(1, total - cancelled);
    const otpPct = Math.max(
      0,
      Math.round(((effective - delayed) / effective) * 100)
    );
    const crewCoveragePct = Math.round((withCrew / total) * 100);

    return {
      total,
      otpPct,
      crewCoveragePct,
      delayed,
      cancelled,
      completed,
    };
  }, [flights]);

  const tone = scoreTone(stats.otpPct);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${tone.text}`}
            >
              {stats.otpPct}%
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${tone.chip}`}
            >
              {isAr ? "انتظام المواعيد" : "OTP"}
            </span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `تغطية الطاقم: ${stats.crewCoveragePct}% من ${stats.total} رحلة`
              : `Crew assigned: ${stats.crewCoveragePct}% across ${stats.total} flights`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("schedule")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "الجدول" : "Schedule"}
        </button>
      </div>

      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        <div
          className={`h-full ${tone.bar}`}
          style={{ width: `${stats.otpPct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center font-mono tabular-nums">
        <div
          className="p-2 rounded-md"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "منفذة" : "Completed"}
          </div>
        </div>
        <div
          className="p-2 rounded-md"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {stats.delayed}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "متأخرة" : "Delayed"}
          </div>
        </div>
        <div
          className="p-2 rounded-md"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="text-base font-bold text-rose-600 dark:text-rose-400">
            {stats.cancelled}
          </div>
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {isAr ? "ملغاة" : "Cancelled"}
          </div>
        </div>
      </div>
    </div>
  );
}

function QualityAuditsCapaWidget({
  qualityAudits,
  onOpenAuditsView,
  setTab,
  lang,
}) {
  const isAr = lang === "ar";
  const audits = useMemo(() => {
    if (Array.isArray(qualityAudits)) return qualityAudits;
    return readSheetCache("QualityAudits", []);
  }, [qualityAudits]);

  const summary = useMemo(() => {
    const today = todayISO();
    let open = 0;
    let inProgress = 0;
    let closed = 0;
    let overdue = 0;
    audits.forEach((a) => {
      const st = String(a.status || "OPEN").toUpperCase();
      if (st === "CLOSED") {
        closed++;
      } else {
        if (st === "IN_PROGRESS") inProgress++;
        else open++;
        if (a.targetDate && a.targetDate < today) overdue++;
      }
    });
    const closureRate =
      audits.length > 0 ? Math.round((closed / audits.length) * 100) : 100;
    return { open, inProgress, closed, overdue, closureRate };
  }, [audits]);

  const handleAction = () => {
    if (typeof onOpenAuditsView === "function") {
      onOpenAuditsView();
    } else {
      setTab?.("quality_dashboard");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className="text-2xl font-bold font-mono tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {summary.open + summary.inProgress}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {isAr ? "ملاحظات مفتوحة / قيد المعالجة" : "open / active CAPA"}
            </span>
          </div>
          <div
            className="text-[11px] font-mono tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {isAr
              ? `نسبة الإغلاق: ${summary.closureRate}% · متأخرة: ${summary.overdue}`
              : `Closure rate: ${summary.closureRate}% · Overdue: ${summary.overdue}`}
          </div>
        </div>
        <button
          type="button"
          onClick={handleAction}
          className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "سجل التدقيق" : "CAPA Log"}
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {audits.length === 0 ? (
        <div
          className="py-5 px-3 rounded-lg text-center space-y-2"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 opacity-80" />
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? "لا توجد ملاحظات عدم مطابقة مفتوحة حالياً"
              : "No open non-conformities or CAPA findings logged"}
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="px-3 py-1 rounded-md text-xs font-semibold text-white"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {isAr ? "+ تسجيل تدقيق جودة" : "+ Log Quality Audit"}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {audits.slice(0, 4).map((item, idx) => {
            const st = String(item.status || "OPEN").toUpperCase();
            const sev = String(item.severity || "LEVEL_2").toUpperCase();
            const sevChip =
              sev === "LEVEL_1"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : sev === "LEVEL_2"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-sky-500/15 text-sky-600 dark:text-sky-400";
            return (
              <div
                key={item.id || idx}
                onClick={handleAction}
                className="px-2.5 py-2 rounded-md flex items-center justify-between gap-2 text-xs cursor-pointer transition hover:opacity-85"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-mono font-bold text-[11px]"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      {item.refNo || "QA"}
                    </span>
                    <span
                      className="font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title}
                    </span>
                  </div>
                  <div
                    className="text-[10px] font-mono tabular-nums truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.department}
                    {item.targetDate ? ` · Due ${fmtDate(item.targetDate)}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${sevChip}`}>
                    {sev === "LEVEL_1" ? "L1" : sev === "LEVEL_2" ? "L2" : "OBS"}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      st === "CLOSED"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {st}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * 3. ADMIN & SECURITY WIDGETS
 * ═══════════════════════════════════════════════════════════ */

function UsersRolesOverviewWidget({ users = [], roles = [], setTab, lang }) {
  const isAr = lang === "ar";
  const activeUsers = users.filter((u) => u.active !== false).length;

  const byRole = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      const r = u.role || "user";
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [users]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div
            className="text-2xl font-bold font-mono tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {activeUsers}
            <span
              className="text-sm font-normal ms-1"
              style={{ color: "var(--text-muted)" }}
            >
              / {users.length}
            </span>
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? `حسابات نشطة · ${roles.length} أدوار وظيفية`
              : `Active accounts · ${roles.length} configured roles`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab?.("settings")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
            color: "var(--brand-primary)",
          }}
        >
          {isAr ? "الإدارة" : "Manage"}
        </button>
      </div>

      <div className="space-y-1.5">
        {byRole.map(([roleName, cnt]) => (
          <div
            key={roleName}
            className="px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              className="font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {roleName}
            </span>
            <span
              className="font-bold font-mono tabular-nums"
              style={{ color: "var(--brand-primary)" }}
            >
              {cnt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditActivityFeedWidget({ auditLogs = [], setTab, lang }) {
  const isAr = lang === "ar";
  const recent = useMemo(
    () =>
      [...auditLogs]
        .sort((a, b) =>
          String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
        )
        .slice(0, 6),
    [auditLogs]
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {isAr
            ? `إجمالي السجلات: ${auditLogs.length}`
            : `Total audit entries: ${auditLogs.length}`}
        </span>
        <button
          type="button"
          onClick={() => setTab?.("settings")}
          className="text-xs font-semibold hover:underline"
          style={{ color: "var(--brand-primary)" }}
        >
          {isAr ? "سجل النشاطات" : "Full Audit Log"}
        </button>
      </div>

      {recent.length === 0 ? (
        <div
          className="text-xs py-6 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          {isAr ? "لا توجد نشاطات مسجلة حديثاً" : "No recent audit events"}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {recent.map((log, idx) => (
            <div
              key={log.id || idx}
              className="px-3 py-2 rounded-md flex items-center justify-between gap-3 text-xs"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {log.userName || "System"} ·{" "}
                  <span style={{ color: "var(--brand-primary)" }}>
                    {log.action || "ACTION"}
                  </span>
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {log.entity || "—"} {log.entityName ? `(${log.entityName})` : ""}
                </div>
              </div>
              <div
                className="text-[10px] font-mono tabular-nums shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                {fmtDateTime(log.timestamp, "UTC")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SecurityLoginMonitorWidget({
  loginHistory = [],
  syncStatus = "idle",
  onRefresh,
  lang,
}) {
  const isAr = lang === "ar";
  const recentLogins = useMemo(
    () =>
      [...loginHistory]
        .sort((a, b) =>
          String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
        )
        .slice(0, 4),
    [loginHistory]
  );
  const failedCount = loginHistory.filter((h) => h.success === false).length;

  return (
    <div className="space-y-3">
      <div
        className="p-2.5 rounded-md flex items-center justify-between"
        style={{
          backgroundColor: "var(--bg-app)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="text-xs">
          <div
            className="font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {isAr ? "مزامنة Google Sheets" : "Google Sheets Sync"}
          </div>
          <div
            className="text-[11px] font-mono tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {syncStatus === "synced"
              ? isAr
                ? "متصل ومحدّث"
                : "Connected & Synced"
              : syncStatus === "syncing"
              ? isAr
                ? "جاري المزامنة..."
                : "Syncing..."
              : isAr
              ? "جاهز"
              : "Ready"}{" "}
            · {isAr ? `محاولات فاشلة: ${failedCount}` : `Failed logins: ${failedCount}`}
          </div>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 rounded-md transition hover:opacity-80"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              color: "var(--brand-primary)",
            }}
            title={isAr ? "تحديث البيانات" : "Refresh data"}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                syncStatus === "syncing" ? "animate-spin" : ""
              }`}
            />
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {recentLogins.map((h, idx) => (
          <div
            key={h.id || idx}
            className="px-2.5 py-1.5 rounded-md flex items-center justify-between text-xs"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              className="font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {h.userName || h.username || "—"}
            </span>
            <span
              className={`font-mono tabular-nums text-[10px] ${
                h.success === false
                  ? "text-rose-500 font-bold"
                  : ""
              }`}
              style={
                h.success !== false ? { color: "var(--text-muted)" } : undefined
              }
            >
              {fmtTime(h.timestamp, "UTC")}Z
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * CAMO & TRAINING SPECIALIZED DASHBOARD WIDGETS
 * ═══════════════════════════════════════════════════════════ */
function CamoChecksScheduleWidget({ camoList = [], fleet = [], lang }) {
  const isAr = lang === "ar";
  const list = camoList.length > 0 ? camoList : fleet;

  const rows = useMemo(() => {
    return safeArray(list)
      .map((ac) => {
        const d = ac.nextCheckDate ? daysUntil(ac.nextCheckDate) : null;
        return {
          reg: ac.reg || "—",
          type: ac.type || "—",
          tah: safeNumber(ac.tah ?? ac.hours, 0),
          tac: safeNumber(ac.tac ?? ac.cycles, 0),
          lastCheckType: ac.lastCheckType || "A",
          lastCheckDate: ac.lastCheckDate || "",
          nextCheckType: ac.nextCheckType || "A",
          nextCheckDate: ac.nextCheckDate || "",
          daysLeft: d,
        };
      })
      .sort((a, b) => {
        if (a.daysLeft === null && b.daysLeft === null) return 0;
        if (a.daysLeft === null) return 1;
        if (b.daysLeft === null) return -1;
        return a.daysLeft - b.daysLeft;
      });
  }, [list]);

  if (rows.length === 0) {
    return (
      <div
        className="text-xs py-6 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        {isAr
          ? "لا توجد بيانات فحوصات مجدولة للطائرات حالياً"
          : "No scheduled aircraft maintenance checks found"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            <th className="py-1.5 pe-2 text-start font-semibold">
              {isAr ? "الطائرة" : "Aircraft"}
            </th>
            <th className="py-1.5 px-2 text-end font-semibold">TAH / TAC</th>
            <th className="py-1.5 px-2 text-start font-semibold">
              {isAr ? "الفحص القادم" : "Next Check"}
            </th>
            <th className="py-1.5 ps-2 text-end font-semibold">
              {isAr ? "المتبقي" : "Remaining"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-default)]">
          {rows.slice(0, 6).map((r) => {
            const overdue = r.daysLeft !== null && r.daysLeft < 0;
            const dueSoon =
              r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30;
            return (
              <tr key={r.reg} className="hover:bg-slate-500/5">
                <td className="py-2 pe-2 font-mono font-bold tabular-nums">
                  <span style={{ color: "var(--text-primary)" }}>{r.reg}</span>
                  <span
                    className="block text-[10px] font-sans font-normal"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {r.type}
                  </span>
                </td>
                <td
                  className="py-2 px-2 text-end font-mono tabular-nums text-[11px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {r.tah}h / {r.tac}c
                </td>
                <td className="py-2 px-2 font-mono tabular-nums text-[11px]">
                  <span style={{ color: "var(--brand-primary)" }}>
                    {r.nextCheckType}-Check
                  </span>{" "}
                  <span style={{ color: "var(--text-muted)" }}>
                    · {r.nextCheckDate ? fmtDate(r.nextCheckDate) : "—"}
                  </span>
                </td>
                <td className="py-2 ps-2 text-end font-mono tabular-nums text-[11px] font-semibold">
                  {r.daysLeft === null ? (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  ) : overdue ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      {isAr
                        ? `متأخر ${Math.abs(r.daysLeft)}ي`
                        : `${Math.abs(r.daysLeft)}d overdue`}
                    </span>
                  ) : dueSoon ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {isAr ? `${r.daysLeft} يوم` : `${r.daysLeft}d`}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {isAr ? `${r.daysLeft} يوم` : `${r.daysLeft}d`}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CamoComponentsStatusWidget({ camoList = [], fleet = [], lang }) {
  const isAr = lang === "ar";
  const list = safeArray(camoList.length > 0 ? camoList : fleet);

  if (list.length === 0) {
    return (
      <div
        className="text-xs py-6 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        {isAr
          ? "لا توجد بيانات محركات ومكونات مسجلة"
          : "No engine, APU, or LLP component records"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.slice(0, 5).map((ac) => (
        <div
          key={ac.id || ac.reg}
          className="p-2.5 rounded-lg space-y-1.5"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <span
              className="font-mono font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {ac.reg || "—"}
            </span>
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {ac.type || "Aircraft"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
            <div>
              <div style={{ color: "var(--text-muted)" }}>ENG #1</div>
              <div
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {safeNumber(ac.engine1Hours, 0)}h /{" "}
                {safeNumber(ac.engine1Cycles, 0)}c
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>ENG #2</div>
              <div
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {safeNumber(ac.engine2Hours, 0)}h /{" "}
                {safeNumber(ac.engine2Cycles, 0)}c
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>APU</div>
              <div
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {safeNumber(ac.apuHours, 0)}h / {safeNumber(ac.apuCycles, 0)}c
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-muted)" }}>LLP</div>
              <div
                className="font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {safeNumber(ac.llpHours, 0)}h / {safeNumber(ac.llpCycles, 0)}c
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingTypeBreakdownWidget({ training = [], lang }) {
  const isAr = lang === "ar";
  const rows = useMemo(() => {
    const entries = Object.entries(TRAINING_TYPES || {}).map(([key, meta]) => {
      const items = safeArray(training).filter((tr) => tr.type === key);
      const passed = items.filter((tr) => tr.result === "PASS").length;
      const expired = items.filter(
        (tr) => tr.expiryDate && daysUntil(tr.expiryDate) < 0
      ).length;
      return {
        key,
        label: isAr ? meta.label_ar : meta.label_en,
        total: items.length,
        passed,
        expired,
      };
    });
    return entries.sort((a, b) => b.total - a.total);
  }, [training, isAr]);

  const maxCount = Math.max(1, ...rows.map((r) => r.total));

  if (training.length === 0) {
    return (
      <div
        className="text-xs py-6 text-center"
        style={{ color: "var(--text-muted)" }}
      >
        {isAr
          ? "لا توجد سجلات تدريب مسجلة بعد"
          : "No crew training records logged yet"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows
        .filter((r) => r.total > 0)
        .slice(0, 7)
        .map((r) => {
          const pct = Math.round((r.total / maxCount) * 100);
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span
                  className="font-medium truncate pe-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {r.label}
                </span>
                <span
                  className="font-mono tabular-nums text-[11px] shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  <strong style={{ color: "var(--text-primary)" }}>
                    {r.total}
                  </strong>{" "}
                  · {isAr ? "اجتياز" : "Pass"} {r.passed}
                  {r.expired > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400">
                      {" "}
                      · {isAr ? "منتهي" : "Exp"} {r.expired}
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--bg-app)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      r.expired > 0 ? "#D97706" : "var(--brand-primary)",
                  }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function TrainingUpcomingRenewalsWidget({ training = [], lang }) {
  const isAr = lang === "ar";
  const renewals = useMemo(() => {
    return safeArray(training)
      .filter((tr) => Boolean(tr.expiryDate))
      .map((tr) => ({
        ...tr,
        daysLeft: daysUntil(tr.expiryDate),
      }))
      .filter((tr) => tr.daysLeft !== null && tr.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [training]);

  if (renewals.length === 0) {
    return (
      <div className="py-5 text-center space-y-1">
        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {isAr
            ? "جميع شهادات التدريب سارية لأكثر من 90 يوماً"
            : "All crew training qualifications valid > 90 days"}
        </div>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {isAr
            ? "لا توجد شهادات منتهية أو مستحقة للتجديد قريباً"
            : "Zero expired or expiring recurrent checks"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {renewals.slice(0, 6).map((tr) => {
        const isExpired = tr.daysLeft < 0;
        const isCritical = tr.daysLeft >= 0 && tr.daysLeft < 30;
        const typeMeta = TRAINING_TYPES?.[tr.type];
        const typeLabel = typeMeta
          ? isAr
            ? typeMeta.label_ar
            : typeMeta.label_en
          : tr.type;
        return (
          <div
            key={tr.id || `${tr.crewId}-${tr.type}-${tr.expiryDate}`}
            className="px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-xs"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="min-w-0">
              <div
                className="font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {tr.crewName || "—"}
              </div>
              <div
                className="text-[11px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {typeLabel} · {fmtDate(tr.expiryDate)}
              </div>
            </div>
            <span
              className={`font-mono tabular-nums text-[11px] font-bold shrink-0 ${
                isExpired
                  ? "text-rose-600 dark:text-rose-400"
                  : isCritical
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-sky-600 dark:text-sky-400"
              }`}
            >
              {isExpired
                ? isAr
                  ? `منتهي (${Math.abs(tr.daysLeft)}ي)`
                  : `Expired (${Math.abs(tr.daysLeft)}d)`
                : isAr
                ? `${tr.daysLeft} يوم`
                : `${tr.daysLeft}d left`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * MASTER WIDGETS REGISTRY (19 Independent Modular Widgets)
 * ═══════════════════════════════════════════════════════════ */
export const WIDGETS_REGISTRY = [
  /* ── Operations ── */
  {
    id: "ops-kpi-overview",
    title: "Operations KPI Summary",
    title_en: "Operations KPI Summary",
    title_ar: "ملخص المؤشرات التشغيلية",
    description_en:
      "Key operational counters across flights, airworthy fleet, active crew, and leave.",
    description_ar:
      "ملخص فوري للرحلات والأسطول الصالح للطيران والطاقم الفعّال والإجازات.",
    icon: Activity,
    component: OpsKpiOverviewWidget,
    defaultSize: "large",
    permissions: ["schedule.view", "fleet.view", "crew.view"],
    category: "Operations",
  },
  {
    id: "flight-watch",
    title: "Live Flight Watch",
    title_en: "Live Flight Watch",
    title_ar: "مراقبة الرحلات الحية",
    description_en:
      "Real-time flight schedule monitor for today's, active, and recent sectors.",
    description_ar:
      "متابعة حية لرحلات اليوم والرحلات النشطة في الأجواء مع أوقات الإقلاع والوصول.",
    icon: Plane,
    component: FlightWatchWidget,
    defaultSize: "medium",
    permissions: ["schedule.view", "tracking.view"],
    category: "Operations",
  },
  {
    id: "fleet-readiness",
    title: "Fleet Serviceability",
    title_en: "Fleet Serviceability",
    title_ar: "جاهزية الأسطول الجوي",
    description_en:
      "Aircraft airworthiness ratio, registrations, and airframe hours (TAH).",
    description_ar:
      "نسبة جاهزية الطائرات وساعات الهياكل وحالة الصلاحية لكل طائرة.",
    icon: Wrench,
    component: FleetReadinessWidget,
    defaultSize: "small",
    permissions: ["fleet.view"],
    category: "Operations",
  },
  {
    id: "crew-duty-ftl",
    title: "Crew Duty & FTL Watch",
    title_en: "Crew Duty & FTL Watch",
    title_ar: "ساعات الطيران والخدمة (FTL)",
    description_en:
      "Monitors 28-day flight time limitations (100h cap) across active crew.",
    description_ar:
      "مراقبة استهلاك ساعات الطيران خلال 28 يوماً وتنبيهات الاقتراب من الحد الأقصى.",
    icon: Clock,
    component: CrewDutyFtlWidget,
    defaultSize: "small",
    permissions: ["ftl.view", "crew.view"],
    category: "Operations",
  },
  {
    id: "standby-leave-pulse",
    title: "Standby, Roster & Leave",
    title_en: "Standby, Roster & Leave",
    title_ar: "الاحتياطي والمناوبات والإجازات",
    description_en:
      "Today's standby crew coverage, published roster entries, and pending leave.",
    description_ar:
      "متابعة طاقم الاحتياط اليومي وطلبات الإجازات المعلقة وجدول المناوبات.",
    icon: Zap,
    component: StandbyLeavePulseWidget,
    defaultSize: "small",
    permissions: ["standby.view", "leave.view", "roster.view"],
    category: "Operations",
  },
  {
    id: "permits-catering-ops",
    title: "Permits & Catering Status",
    title_en: "Permits & Catering Status",
    title_ar: "التصاريح والتموين الجوي",
    description_en:
      "Approved/pending overflight & landing permits, catering orders, and dry store stock.",
    description_ar:
      "حالة تصاريح العبور والهبوط وطلبات التموين وتنبيهات المخزن الجاف.",
    icon: FileSignature,
    component: PermitsCateringOpsWidget,
    defaultSize: "medium",
    permissions: ["permits.view", "catering.view"],
    category: "Operations",
  },
  {
    id: "quick-ops-actions",
    title: "Quick Launchpad",
    title_en: "Quick Launchpad",
    title_ar: "الوصول التشغيلي السريع",
    description_en:
      "Direct one-click shortcuts to core operational modules and forms.",
    description_ar:
      "اختصارات مباشرة للأقسام التشغيلية والتقارير والنماذج المعتمدة.",
    icon: TrendingUp,
    component: QuickOpsActionsWidget,
    defaultSize: "medium",
    permissions: ["schedule.view", "roster.view", "ftl.view", "reports.view"],
    category: "Operations",
  },

  /* ── Quality (Quality Dashboard) ── */
  {
    id: "compliance-score",
    title: "Quality & Compliance Score",
    title_en: "Quality & Compliance Score",
    title_ar: "مؤشر الامتثال والجودة الشامل",
    description_en:
      "Weighted compliance score across crew docs, CAMO airworthiness, training, and manuals.",
    description_ar:
      "قياس فوري لنسبة الامتثال عبر وثائق الطاقم وصلاحية الطائرات والتدريب والأدلة.",
    icon: ShieldCheck,
    component: ComplianceScoreWidget,
    defaultSize: "medium",
    permissions: [
      "dashboard.quality_view",
      "camo.view",
      "training.view",
      "manuals.view",
    ],
    category: "Quality",
  },
  {
    id: "expiring-docs-radar",
    title: "Document & Certificate Expiry Radar",
    title_en: "Document & Certificate Expiry Radar",
    title_ar: "رادار انتهاء الوثائق والشهادات",
    description_en:
      "Tracks expired, critical (≤15d), and upcoming (≤60d) licenses, medicals, and CoA.",
    description_ar:
      "تصنيف فوري للشهادات والرخص المنتهية والحرجة والقريبة من الانتهاء.",
    icon: AlertTriangle,
    component: ExpiringDocsRadarWidget,
    defaultSize: "medium",
    permissions: ["alerts.view", "crew.docs", "fleet.docs", "training.view"],
    category: "Quality",
  },
  {
    id: "camo-mel-watch",
    title: "CAMO & Open MEL Defects",
    title_en: "CAMO & Open MEL Defects",
    title_ar: "مراقبة الصلاحية والأعطال المؤجلة (MEL)",
    description_en:
      "Deferred defect breakdown by MEL category (A/B/C/D) and due dates.",
    description_ar:
      "متابعة الأعطال المؤجلة حسب الفئة وتواريخ الاستحقاق وسجلات CAMO.",
    icon: Shield,
    component: CamoMelWatchWidget,
    defaultSize: "medium",
    permissions: ["camo.view", "mel.view"],
    category: "Quality",
  },
  {
    id: "training-qualification",
    title: "Crew Training & Checks",
    title_en: "Crew Training & Checks",
    title_ar: "كفاءة وتدريب الطاقم",
    description_en:
      "Simulator and recurrent check pass rates plus expiring qualifications.",
    description_ar:
      "نسبة اجتياز الفحوصات الدورية والتدريب التشبيهي والشهادات المستحقة للتجديد.",
    icon: GraduationCap,
    component: TrainingQualificationWidget,
    defaultSize: "small",
    permissions: ["training.view"],
    category: "Quality",
  },
  {
    id: "manuals-currency",
    title: "Operations Manuals Currency",
    title_en: "Operations Manuals Currency",
    title_ar: "حداثة الأدلة والمراجع",
    description_en:
      "Status of controlled operations manuals and active revision numbers.",
    description_ar:
      "متابعة إصدارات الأدلة التشغيلية المعتمدة وحالة سريانها.",
    icon: BookOpen,
    component: ManualsLibraryStatusWidget,
    defaultSize: "small",
    permissions: ["manuals.view", "schedule.view"],
    category: "Quality",
  },
  {
    id: "otp-dispatch-quality",
    title: "Dispatch & Schedule Reliability",
    title_en: "Dispatch & Schedule Reliability",
    title_ar: "جودة الانتظام التشغيلي ودقة المواعيد",
    description_en:
      "On-time performance (OTP %), crew assignment coverage, and delayed/cancelled ratio.",
    description_ar:
      "نسبة دقة مواعيد الإقلاع وتغطية الأطقم ومؤشر التأخير والإلغاء التشغيلي.",
    icon: Gauge,
    component: OtpDispatchQualityWidget,
    defaultSize: "small",
    permissions: ["quality.view", "dashboard.quality_view", "schedule.view"],
    category: "Quality",
  },
  {
    id: "quality-audits-capa",
    title: "Quality Audits & CAPA Findings",
    title_en: "Quality Audits & CAPA Findings",
    title_ar: "سجل التدقيق والملاحظات التصحيحية (CAPA)",
    description_en:
      "Live tracker of internal/external quality audits, Level 1/2 findings, and CAPA closure rate.",
    description_ar:
      "متابعة ملاحظات التدقيق الداخلي والخارجي ومستويات عدم المطابقة ونسبة الإغلاق.",
    icon: ClipboardList,
    component: QualityAuditsCapaWidget,
    defaultSize: "medium",
    permissions: [
      "quality.audits_view",
      "quality.view",
      "dashboard.quality_view",
    ],
    category: "Quality",
  },
  {
    id: "alerts-manager",
    title: "Active Alerts & Dismissals",
    title_en: "Active Alerts & Dismissals",
    title_ar: "إدارة التنبيهات النشطة",
    description_en:
      "Interactive compliance alert panel with acknowledge/dismiss workflow.",
    description_ar:
      "لوحة التنبيهات التفاعلية مع إمكانية المراجعة أو التجاهل حسب الصلاحية.",
    icon: AlertTriangle,
    component: AlertsDismissWidget,
    defaultSize: "large",
    permissions: ["alerts.view", "crew.docs", "fleet.docs"],
    category: "Quality",
  },

  {
    id: "camo-checks-schedule",
    title: "Aircraft Maintenance Checks Schedule",
    title_en: "Aircraft Maintenance Checks Schedule",
    title_ar: "جدول فحوصات وصيانة الطائرات (CAMO)",
    description_en:
      "Tracks fleet airframe TAH/TAC, next scheduled A/C checks, and remaining days.",
    description_ar:
      "متابعة ساعات ودورات الطائرات والفحوصات الدورية القادمة والأيام المتبقية.",
    icon: Wrench,
    component: CamoChecksScheduleWidget,
    defaultSize: "medium",
    permissions: ["camo.view", "camo.dashboard_view", "fleet.view"],
    category: "Quality",
  },
  {
    id: "camo-components-status",
    title: "Engines, APU & LLP Status",
    title_en: "Engines, APU & LLP Status",
    title_ar: "حالة المحركات و APU والمكونات المحدودة (LLP)",
    description_en:
      "Monitors Engine #1, Engine #2, APU, and life-limited part hours & cycles per aircraft.",
    description_ar:
      "مراقبة ساعات ودورات المحركات ووحدة الطاقة المساعدة والمكونات المحدودة العمر.",
    icon: Activity,
    component: CamoComponentsStatusWidget,
    defaultSize: "medium",
    permissions: ["camo.view", "camo.dashboard_view"],
    category: "Quality",
  },
  {
    id: "training-type-breakdown",
    title: "Training Courses & Pass Breakdown",
    title_en: "Training Courses & Pass Breakdown",
    title_ar: "توزيع الدورات التدريبية ونسب الاجتياز",
    description_en:
      "Breakdown of crew training records across Simulator,OPC/LPC, CRM, DG, SEP, and Medical.",
    description_ar:
      "تحليل سجلات التدريب حسب النوع (التشبيهي، CRM، المواد الخطرة، الطوارئ) ونسب النجاح.",
    icon: GraduationCap,
    component: TrainingTypeBreakdownWidget,
    defaultSize: "medium",
    permissions: ["training.view", "training.dashboard_view"],
    category: "Quality",
  },
  {
    id: "training-upcoming-renewals",
    title: "Upcoming Training Renewals & Expiries",
    title_en: "Upcoming Training Renewals & Expiries",
    title_ar: "التجديدات التدريبية المستحقة والمنتهية",
    description_en:
      "Prioritized list of expired, critical (<30d), and warning (<90d) crew qualifications.",
    description_ar:
      "قائمة مرتبة بشهادات التدريب المنتهية والحرجة والمستحقة للتجديد خلال 90 يوماً.",
    icon: Calendar,
    component: TrainingUpcomingRenewalsWidget,
    defaultSize: "medium",
    permissions: ["training.view", "training.dashboard_view"],
    category: "Quality",
  },

  /* ── Admin ── */
  {
    id: "users-roles-overview",
    title: "Users & RBAC Overview",
    title_en: "Users & RBAC Overview",
    title_ar: "المستخدمون والأدوار الوظيفية",
    description_en:
      "Active user accounts and role distribution across the organization.",
    description_ar:
      "إحصائيات الحسابات النشطة وتوزيع المستخدمين على الأدوار الوظيفية.",
    icon: Users,
    component: UsersRolesOverviewWidget,
    defaultSize: "small",
    permissions: ["users.view"],
    category: "Admin",
  },
  {
    id: "audit-activity-feed",
    title: "System Audit Trail",
    title_en: "System Audit Trail",
    title_ar: "سجل التدقيق والنشاطات",
    description_en:
      "Chronological feed of recent create, update, and delete operations.",
    description_ar:
      "سجل زمني لآخر عمليات الإضافة والتعديل والحذف في المنظومة.",
    icon: History,
    component: AuditActivityFeedWidget,
    defaultSize: "medium",
    permissions: ["security.audit_log"],
    category: "Admin",
  },
  {
    id: "security-login-monitor",
    title: "Login Security & Cloud Sync",
    title_en: "Login Security & Cloud Sync",
    title_ar: "أمان الدخول والمزامنة السحابية",
    description_en:
      "Recent user sign-ins, failed login counter, and Google Sheets sync status.",
    description_ar:
      "آخر عمليات تسجيل الدخول وحالة التزامن السحابي مع Google Sheets.",
    icon: Lock,
    component: SecurityLoginMonitorWidget,
    defaultSize: "small",
    permissions: ["security.login_history", "settings.view"],
    category: "Admin",
  },
];

export const WIDGETS_BY_ID = WIDGETS_REGISTRY.reduce((acc, w) => {
  acc[w.id] = w;
  return acc;
}, {});

/* ═══════════════════════════════════════════════════════════
 * PRESETS (Default / Operations / Quality Dashboard / Admin)
 * ═══════════════════════════════════════════════════════════ */
export const DASHBOARD_PRESETS = {
  operations: {
    id: "operations",
    label_en: "Operations View",
    label_ar: "لوحة العمليات",
    items: [
      { id: "ops-kpi-overview", size: "large" },
      { id: "flight-watch", size: "medium" },
      { id: "quick-ops-actions", size: "medium" },
      { id: "fleet-readiness", size: "small" },
      { id: "crew-duty-ftl", size: "small" },
      { id: "standby-leave-pulse", size: "small" },
      { id: "permits-catering-ops", size: "large" },
      { id: "alerts-manager", size: "large" },
    ],
  },
  quality: {
    id: "quality",
    label_en: "Quality Management",
    label_ar: "داشبورد إدارة الجودة",
    items: [
      { id: "compliance-score", size: "medium" },
      { id: "quality-audits-capa", size: "medium" },
      { id: "expiring-docs-radar", size: "medium" },
      { id: "camo-mel-watch", size: "medium" },
      { id: "training-qualification", size: "small" },
      { id: "manuals-currency", size: "small" },
      { id: "otp-dispatch-quality", size: "small" },
      { id: "alerts-manager", size: "large" },
    ],
  },
  camo: {
    id: "camo",
    label_en: "CAMO Airworthiness",
    label_ar: "داشبورد صلاحية الطائرات (CAMO)",
    items: [
      { id: "camo-mel-watch", size: "medium" },
      { id: "camo-checks-schedule", size: "medium" },
      { id: "fleet-readiness", size: "small" },
      { id: "camo-components-status", size: "medium" },
      { id: "expiring-docs-radar", size: "small" },
      { id: "alerts-manager", size: "large" },
    ],
  },
  training: {
    id: "training",
    label_en: "Crew Training",
    label_ar: "داشبورد التدريب والتأهيل",
    items: [
      { id: "training-qualification", size: "small" },
      { id: "training-type-breakdown", size: "medium" },
      { id: "crew-duty-ftl", size: "small" },
      { id: "training-upcoming-renewals", size: "medium" },
      { id: "expiring-docs-radar", size: "medium" },
    ],
  },
  admin: {
    id: "admin",
    label_en: "Admin & Executive",
    label_ar: "اللوحة الإدارية الشاملة",
    items: [
      { id: "ops-kpi-overview", size: "large" },
      { id: "compliance-score", size: "medium" },
      { id: "flight-watch", size: "medium" },
      { id: "users-roles-overview", size: "small" },
      { id: "security-login-monitor", size: "small" },
      { id: "fleet-readiness", size: "small" },
      { id: "audit-activity-feed", size: "medium" },
      { id: "expiring-docs-radar", size: "medium" },
    ],
  },
};

export function getDefaultLayoutForUser(user, canFn) {
  const roleNorm = String(user?.role || "")
    .trim()
    .toLowerCase();

  let candidateItems = DASHBOARD_PRESETS.operations.items;
  if (roleNorm === "camo" || roleNorm.includes("quality")) {
    candidateItems = DASHBOARD_PRESETS.quality.items;
  } else if (
    ["superadmin", "super_admin", "admin", "administrator", "owner"].includes(
      roleNorm
    )
  ) {
    candidateItems = [
      { id: "ops-kpi-overview", size: "large" },
      { id: "flight-watch", size: "medium" },
      { id: "compliance-score", size: "medium" },
      { id: "fleet-readiness", size: "small" },
      { id: "crew-duty-ftl", size: "small" },
      { id: "users-roles-overview", size: "small" },
      { id: "expiring-docs-radar", size: "medium" },
      { id: "quick-ops-actions", size: "medium" },
      { id: "alerts-manager", size: "large" },
    ];
  } else {
    candidateItems = [
      { id: "ops-kpi-overview", size: "large" },
      { id: "flight-watch", size: "medium" },
      { id: "compliance-score", size: "medium" },
      { id: "fleet-readiness", size: "small" },
      { id: "crew-duty-ftl", size: "small" },
      { id: "standby-leave-pulse", size: "small" },
      { id: "quick-ops-actions", size: "medium" },
      { id: "expiring-docs-radar", size: "medium" },
    ];
  }

  const permitted = candidateItems.filter((item) => {
    const def = WIDGETS_BY_ID[item.id];
    return def && canUserSeeWidget(def, canFn);
  });

  if (permitted.length > 0) return permitted;

  // Fallback: pick first 6 widgets user is allowed to see
  return WIDGETS_REGISTRY.filter((w) => canUserSeeWidget(w, canFn))
    .slice(0, 6)
    .map((w) => ({ id: w.id, size: w.defaultSize }));
}
