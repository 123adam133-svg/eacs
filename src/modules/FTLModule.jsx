/* ═══════════════════════════════════════════════════════════
 * FTL MODULE — EASA Compliance (ORO.FTL)
 * - Department / Section filtering (Cockpit, Cabin, Engineering, Ops)
 * - Full Schedule-drawer-level daily breakdown (Duty & FDP Sectors + FTL Calculation Summary)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  Clock,
  Search,
  User,
  Plane,
  Award,
  Activity,
  X,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { useT } from "../contexts";
import {
  calcCrewDutyEASA,
  calcFlightDuty,
  fmtDuty,
  fmtDutyHM,
  getMemberAllRoles,
} from "../config/constants";
import { fmtDate, todayISO } from "../utils/helpers";
import { toDisplayImageUrl } from "../api";
import { CrewContactCard, getCrewDailyFtlStats } from "../components/CrewContactCard";
import { getCrewDailyFtlDetailed } from "../utils/multiSectorFtl";

const FTL_DEPARTMENTS = [
  { id: "all", ar: "كل الأقسام", en: "All Depts" },
  { id: "cockpit", ar: "القيادة (Cockpit)", en: "Cockpit" },
  { id: "cabin", ar: "الضيافة (Cabin)", en: "Cabin" },
  { id: "engineering", ar: "الهندسة (Eng)", en: "Engineering" },
  { id: "ops", ar: "العمليات (Ops)", en: "Ops & Dispatch" },
];

function getCrewDepartment(member) {
  if (!member) return "cockpit";
  const explicitDept = String(member.department || member.section || "").toLowerCase();
  if (explicitDept.includes("cabin") || explicitDept.includes("ضيا")) return "cabin";
  if (explicitDept.includes("eng") || explicitDept.includes("هندس") || explicitDept.includes("صيان")) return "engineering";
  if (explicitDept.includes("ops") || explicitDept.includes("dispatch") || explicitDept.includes("عمل") || explicitDept.includes("ترحيل")) return "ops";
  if (explicitDept.includes("cockpit") || explicitDept.includes("pilot") || explicitDept.includes("قياد")) return "cockpit";

  const roles = getMemberAllRoles(member).map((r) => String(r).toLowerCase());
  if (roles.some((r) => ["captain", "firstofficer", "tri", "instructor", "observer", "sp", "utr", "safetypilot", "undertraining"].includes(r))) {
    return "cockpit";
  }
  if (roles.some((r) => ["flightattendant", "fa1", "fa2", "fa3", "fa4", "ifa", "cabin"].includes(r))) {
    return "cabin";
  }
  if (roles.some((r) => ["engineer", "engineer2", "camo", "maintenance"].includes(r))) {
    return "engineering";
  }
  if (roles.some((r) => ["flightdispatcher", "dispatcher", "loadmaster", "security"].includes(r))) {
    return "ops";
  }
  return "cockpit";
}

function getDeptLabel(deptId, isAr) {
  const found = FTL_DEPARTMENTS.find((d) => d.id === deptId);
  return found ? (isAr ? found.ar : found.en) : deptId;
}

export function FTLModule({ crew = [], flights = [] }) {
  const t = useT();
  const isAr = (t?.locale || document.documentElement?.lang || "ar") === "ar";
  const [selectedCrew, setSelectedCrew] = useState("");
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodDays, setPeriodDays] = useState(28);
  const [referenceDate, setReferenceDate] = useState(todayISO());

  /* ⭐ حساب الإحصائيات التراكمية واليومية لجميع الطاقم */
  const crewStats = useMemo(() => {
    const toDate = referenceDate || todayISO();
    const toMs = new Date(`${toDate}T00:00:00Z`).getTime() || Date.now();
    const fromDate = new Date(toMs - periodDays * 86400000).toISOString().slice(0, 10);

    const stats = {};
    crew.forEach((c) => {
      stats[c.id] = calcCrewDutyEASA(c.id, flights, fromDate, toDate);
    });
    return stats;
  }, [crew, flights, periodDays, referenceDate]);

  const deptCounts = useMemo(() => {
    const counts = { all: crew.length, cockpit: 0, cabin: 0, engineering: 0, ops: 0 };
    crew.forEach((c) => {
      const d = getCrewDepartment(c);
      if (counts[d] !== undefined) counts[d] += 1;
    });
    return counts;
  }, [crew]);

  const filteredCrew = useMemo(() => {
    const q = search.trim().toLowerCase();
    return crew.filter((c) => {
      const dept = getCrewDepartment(c);
      if (deptFilter !== "all" && dept !== deptFilter) return false;

      if (q) {
        const hay = `${c.fullName || ""} ${c.empNo || ""} ${c.role || ""} ${c.base || ""} ${getDeptLabel(dept, isAr)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (statusFilter !== "all") {
        const L = crewStats[c.id]?.limits || {};
        const dutySt = L.duty28?.status || "ok";
        const fltSt = L.flight28?.status || "ok";
        const worst = [dutySt, fltSt].includes("exceeded")
          ? "exceeded"
          : [dutySt, fltSt].includes("critical")
          ? "critical"
          : [dutySt, fltSt].includes("warning")
          ? "warning"
          : "ok";
        if (statusFilter === "attention" && worst === "ok") return false;
        if (statusFilter === "exceeded" && worst !== "exceeded") return false;
      }
      return true;
    });
  }, [crew, deptFilter, search, statusFilter, crewStats, isAr]);

  /* ═══════════ تفاصيل عضو الطاقم الكاملة (مثل القائمة الجانبية في سكجول) ═══════════ */
  if (selectedCrew) {
    const member = crew.find((c) => String(c.id) === String(selectedCrew));
    if (!member) {
      setSelectedCrew("");
      return null;
    }

    const memberDept = getCrewDepartment(member);
    const data = crewStats[member.id] || {
      duties: [],
      limits: {},
      crewFlights: [],
      totalDutyMin: 0,
      totalFlightMin: 0,
      totalSectors: 0,
    };
    const L = data.limits || {};
    const detailedFtl = getCrewDailyFtlDetailed(member.id, referenceDate, flights);

    const recentFlightDates = Array.from(
      new Set(
        (flights || [])
          .filter((f) => {
            const hasMain = Array.isArray(f.crewSlots) && f.crewSlots.some((s) => String(s?.crewId) === String(member.id));
            const hasLeg = Array.isArray(f.legs) && f.legs.some((l) => Array.isArray(l?.crewSlots) && l.crewSlots.some((s) => String(s?.crewId) === String(member.id)));
            return hasMain || hasLeg;
          })
          .flatMap((f) => {
            const dates = [];
            if (f.date || f.std) dates.push(String(f.date || f.std).slice(0, 10));
            if (Array.isArray(f.legs)) {
              f.legs.forEach((l) => {
                if (l?.date || l?.std) dates.push(String(l.date || l.std).slice(0, 10));
              });
            }
            return dates;
          })
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      )
    )
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 8);

    const getColor = (status) =>
      ({
        exceeded: "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
        critical: "bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800",
        warning: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        ok: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
      }[status] || "bg-slate-50 text-slate-700 border-slate-300");

    const getBarColor = (status) =>
      ({
        exceeded: "#dc2626",
        critical: "#f97316",
        warning: "#f59e0b",
        ok: "#22c55e",
      }[status] || "#94a3b8");

    return (
      <div className="space-y-3 fade-in">
        {/* ⭐ Header */}
        <div
          className="flex flex-wrap gap-3 items-center justify-between rounded-xl p-3 text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 border border-white/30 flex-shrink-0">
              {toDisplayImageUrl(member.avatar) ? (
                <img
                  src={toDisplayImageUrl(member.avatar)}
                  alt={member.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-2.5 text-white/70" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base">{member.fullName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {getDeptLabel(memberDept, isAr)}
                </span>
              </div>
              <div className="text-xs text-slate-300 font-mono">
                {t[member.role] || member.role} · #{member.empNo || "—"} {member.base ? `· ${member.base}` : ""}
              </div>
              <div className="text-[10.5px] text-sky-300 mt-0.5">
                {t.ftlCompliance} · {data.totalSectors} {t.sectors}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 border border-white/25 text-xs">
              <Calendar className="w-3.5 h-3.5 text-sky-300" />
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="bg-transparent text-xs font-mono text-white outline-none cursor-pointer"
              />
            </div>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(+e.target.value)}
              className="px-2.5 py-1.5 bg-white/10 border border-white/25 rounded text-xs text-white outline-none cursor-pointer"
            >
              <option value={7} className="text-slate-800">{t.last7days}</option>
              <option value={14} className="text-slate-800">{t.last14days}</option>
              <option value={28} className="text-slate-800">{t.last28days}</option>
              <option value={90} className="text-slate-800">{t.last90days}</option>
              <option value={365} className="text-slate-800">{t.lastYear}</option>
            </select>
            <button
              type="button"
              onClick={() => setSelectedCrew("")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> {isAr ? "عودة للقائمة" : t.cancel || "Back"}
            </button>
          </div>
        </div>

        {/* ⭐ KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-800/70 p-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">{t.totalDuty}</span>
              <Clock className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-sky-800 dark:text-sky-300">
              {fmtDuty(data.totalDutyMin)}
            </div>
            <div className="text-[10px] text-slate-500">{periodDays} days</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-800/70 p-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">{t.flightTime}</span>
              <Plane className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
              {fmtDuty(data.totalFlightMin)}
            </div>
            <div className="text-[10px] text-slate-500">{periodDays} days</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-800/70 p-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">{t.sectors}</span>
              <Award className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-purple-800 dark:text-purple-300">
              {data.totalSectors}
            </div>
            <div className="text-[10px] text-slate-500">Total flights</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-800/70 p-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase">{t.avgPerDuty}</span>
              <Activity className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-bold font-mono tabular-nums text-amber-800 dark:text-amber-300">
              {data.duties.length ? fmtDuty(Math.round(data.totalDutyMin / data.duties.length)) : "00:00"}
            </div>
            <div className="text-[10px] text-slate-500">{data.duties.length} duties</div>
          </div>
        </div>

        {/* ═══ FULL SCHEDULE-DRAWER DAILY FTL BREAKDOWN (Duty & FDP Sectors + FTL Calculation Summary) ═══ */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
          <div className="px-3 py-2 bg-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-xs tracking-wide uppercase">
                FTL CALCULATIONS — {referenceDate}
              </span>
              {detailedFtl && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    detailedFtl.isExceeded
                      ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {detailedFtl.isExceeded ? "⚠️ Exceeded" : "✓ Legal / Within Limits"}
                </span>
              )}
            </div>

            {recentFlightDates.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400">{isAr ? "تواريخ الرحلات:" : "Flight dates:"}</span>
                {recentFlightDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setReferenceDate(d)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                      referenceDate === d
                        ? "bg-sky-500 text-white"
                        : "bg-white/10 text-slate-200 hover:bg-white/20"
                    }`}
                  >
                    {d.slice(5)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!detailedFtl ? (
            <div className="p-4 text-center text-xs text-slate-400">
              {isAr
                ? `لا توجد قطاعات أو رحلات مسجلة لهذا العضو في تاريخ ${referenceDate} — اختر تاريخاً من الشريط أعلاه.`
                : `No scheduled or completed sectors found for ${referenceDate}. Select a date above.`}
            </div>
          ) : (
            <div className="p-3 grid lg:grid-cols-2 gap-3 text-xs">
              {/* ─── 1. Duty & FDP Sectors Table ─── */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div className="px-2.5 py-1.5 bg-[#e2e8f0]/60 dark:bg-slate-800/80 font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <span>Duty & FDP Sectors</span>
                  <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-bold">
                    {detailedFtl.sectorsCount} Sector{detailedFtl.sectorsCount > 1 ? "s" : ""}
                  </span>
                </div>

                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px]">
                      <th className="py-1 px-2 text-start font-bold w-20">Report On</th>
                      <th className="py-1 px-2 text-start font-bold">Schedule</th>
                      <th className="py-1 px-2 text-end font-bold w-20">Report Off</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                      <td colSpan={3} className="py-1 px-2 text-center text-[10px] text-slate-500 font-mono">
                        <span className="inline-flex items-center gap-1 font-bold">
                          <span>Rest before: {detailedFtl.restBeforeStr}</span>
                          <Clock className="w-3 h-3 text-slate-400" />
                        </span>
                      </td>
                    </tr>

                    {detailedFtl.sectors.map((sec, sIdx) => (
                      <React.Fragment key={sec.id || sIdx}>
                        <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400 align-top">
                            {sec.reportOnHhmm}
                          </td>
                          <td className="py-1.5 px-2 align-top">
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 flex-wrap">
                              <span className="text-slate-500">✈</span>
                              <span className="text-[10px] text-slate-400">{sec.flightNo}</span>
                              <span>{sec.std}</span>
                              <span className="text-sky-600 dark:text-sky-400">{sec.dep}</span>
                              <span>➔</span>
                              <span className="text-sky-600 dark:text-sky-400">{sec.arr}</span>
                              <span>{sec.sta}</span>
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono mt-0.5">
                              cockpit count: {sec.cockpitCount} · cabin count: {sec.cabinCount}
                            </div>
                          </td>
                          <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400 text-end align-top">
                            {sec.reportOffHhmm}
                          </td>
                        </tr>
                        {sec.hasBreak && (
                          <tr className="bg-amber-500/10 border-b border-amber-500/20">
                            <td colSpan={3} className="py-1 px-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900">
                                Possible break ({sec.turnaroundMin}m)
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ─── 2. FTL Calculation Summary Table ─── */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div className="px-2.5 py-1.5 bg-[#e2e8f0]/60 dark:bg-slate-800/80 font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <span>FTL Calculation Summary</span>
                  <span className="text-[10px] font-mono text-slate-500">ORO.FTL</span>
                </div>

                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px]">
                      <th className="py-1 px-2 text-start font-bold">Limit</th>
                      <th className="py-1 px-2 text-end font-bold">Actual</th>
                      <th className="py-1 px-2 text-center w-6 font-bold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                        Rest before duty <span className="text-[10px] text-slate-400">min 12h</span>
                      </td>
                      <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">{detailedFtl.restBeforeStr}</td>
                      <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">Total block time</td>
                      <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">{detailedFtl.totalBlockStr}</td>
                      <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                    </tr>
                    <tr className={detailedFtl.isExceeded ? "bg-rose-500/10" : ""}>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                        Flight Duty Period <span className="text-[10px] text-slate-400">max {detailedFtl.maxFdpStr}</span>
                      </td>
                      <td className={`py-1 px-2 text-end font-bold ${detailedFtl.isExceeded ? "text-rose-600 font-black" : "text-slate-800 dark:text-slate-200"}`}>
                        {detailedFtl.fdpStr}
                      </td>
                      <td className="py-1 px-1 text-center font-bold">
                        {detailedFtl.isExceeded ? <span className="text-rose-600">⚠️</span> : <span className="text-emerald-500">✓</span>}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">Duty</td>
                      <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">{detailedFtl.dutyStr}</td>
                      <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                        Rest after duty <span className="text-[10px] text-slate-400">min 12h</span>
                      </td>
                      <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">{detailedFtl.restAfterStr}</td>
                      <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">Next EOBT</td>
                      <td className="py-1 px-2 text-end font-bold text-sky-600 dark:text-sky-400 text-[10px]">{detailedFtl.nextEobtStr}</td>
                      <td className="py-1 px-1 text-center"></td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">Next EOBT (with compensation)</td>
                      <td className="py-1 px-2 text-end text-slate-400">—</td>
                      <td className="py-1 px-1 text-center"></td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">Acclimatisation</td>
                      <td className="py-1 px-2 text-end font-bold text-slate-700 dark:text-slate-300">{detailedFtl.acclimatisation}</td>
                      <td className="py-1 px-1 text-center"></td>
                    </tr>

                    <tr className="bg-slate-50/70 dark:bg-slate-800/60 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                      <td colSpan={3} className="py-1 px-2">Cumulative Duty</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">7 days <span className="text-[9px]">max 60h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d7.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">14 days <span className="text-[9px]">max 110h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d14.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">28 days <span className="text-[9px]">max 190h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d28.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>

                    <tr className="bg-slate-50/70 dark:bg-slate-800/60 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                      <td colSpan={3} className="py-1 px-2">Cumulative Block Time</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">28 days <span className="text-[9px]">max 100h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.d28.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">calendar year <span className="text-[9px]">max 900h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.year.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">12 calendar months <span className="text-[9px]">max 1000h</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.m12.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>

                    <tr className="bg-slate-50/70 dark:bg-slate-800/60 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                      <td colSpan={3} className="py-1 px-2">Cumulative Days Off</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 px-3 text-slate-500 text-[10px]">days in 7 days <span className="text-[9px]">min 1</span></td>
                      <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDaysOff.d7.actual}</td>
                      <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                        Recovery Rest <span className="text-[10px] text-slate-400">{detailedFtl.recoveryRest?.limit || "max 168h"}</span>
                      </td>
                      <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                        {detailedFtl.recoveryRest?.actual ?? "—"}
                      </td>
                      <td className="py-1 px-1 text-center font-bold">
                        {detailedFtl.recoveryRest?.ok === false ? (
                          <span className="text-rose-600">⚠️</span>
                        ) : (
                          <span className="text-emerald-500">✓</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ⭐ EASA Cumulative Limits */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-slate-800 px-3 py-2 text-white flex items-center justify-between">
            <h3 className="font-bold text-xs flex items-center gap-2">
              📋 {t.cumulativeLimits}
              <span className="text-[10px] bg-sky-500 px-1.5 py-0.5 rounded font-mono">ORO.FTL.210</span>
            </h3>
          </div>
          <div className="p-2.5 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(L).map(([k, l]) => (
              <div key={k} className={`rounded-lg border p-2.5 ${getColor(l.status)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase opacity-80">
                    {l.label_en || l.label}
                  </span>
                  {l.status === "exceeded" && <AlertTriangle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-base font-bold font-mono tabular-nums">{fmtDuty(l.used)}</div>
                  <div className="text-[10px] font-mono opacity-75">/ {fmtDuty(l.max)}</div>
                </div>
                <div className="mt-1.5 h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: Math.min(100, l.pct) + "%", background: getBarColor(l.status) }}
                  />
                </div>
                <div className="flex justify-between text-[10px] mt-1 font-mono">
                  <span className="font-bold">{l.pct}%</span>
                  <span className="opacity-80">
                    {l.status === "exceeded"
                      ? `⚠️ ${t.exceeded}`
                      : l.status === "critical"
                      ? t.critical
                      : l.status === "warning"
                      ? t.warning
                      : t.ok}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ⭐ Daily Duties & Recent Flights */}
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-800 px-3 py-2 text-white flex items-center justify-between">
              <h3 className="font-bold text-xs">📅 {t.dailyDuties}</h3>
              <span className="text-[10px] text-slate-300 font-mono">{data.duties.length} duty periods</span>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-start font-bold">{t.date}</th>
                    <th className="px-2 py-1.5 text-center font-bold">Sec</th>
                    <th className="px-2 py-1.5 text-center font-bold">{t.block}</th>
                    <th className="px-2 py-1.5 text-center font-bold">{t.dutyTime}</th>
                    <th className="px-2 py-1.5 text-center font-bold">{t.fdp}</th>
                    <th className="px-2 py-1.5 text-center font-bold">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duties.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-slate-400 text-xs">
                        No duties in this period
                      </td>
                    </tr>
                  ) : (
                    data.duties.map((d, i) => (
                      <tr
                        key={i}
                        onClick={() => setReferenceDate(String(d.date).slice(0, 10))}
                        className={`border-t border-slate-200 dark:border-slate-700 cursor-pointer ${
                          d.fdpExceeded
                            ? "bg-rose-50 dark:bg-rose-950/50"
                            : "hover:bg-sky-50/50 dark:hover:bg-slate-700/40"
                        }`}
                      >
                        <td className="px-2 py-1.5 font-mono">{d.date}</td>
                        <td className="px-2 py-1.5 text-center font-mono font-bold">{d.sectors}</td>
                        <td className="px-2 py-1.5 text-center font-mono">{fmtDuty(d.blockMin)}</td>
                        <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                          {fmtDuty(d.dutyMin)}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-sky-700 dark:text-sky-400">
                          {fmtDuty(d.fdpMin)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {d.fdpExceeded ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 text-[9.5px] font-bold">
                              ⚠️
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[9.5px] font-bold">
                              ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-800 px-3 py-2 text-white">
              <h3 className="font-bold text-xs">
                ✈️ {t.recentFlightsFt} ({(data.crewFlights || []).length})
              </h3>
            </div>
            <div className="max-h-80 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
              {(data.crewFlights || [])
                .slice()
                .reverse()
                .slice(0, 30)
                .map((flight, i) => {
                  const calc = calcFlightDuty(flight);
                  const hasJL = flight.actual && (flight.actual.std || flight.actual.sta);
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        const fDate = String(flight.date || flight.std || "").slice(0, 10);
                        if (/^\d{4}-\d{2}-\d{2}$/.test(fDate)) setReferenceDate(fDate);
                      }}
                      className="p-2 flex items-center gap-2.5 hover:bg-sky-50/50 dark:hover:bg-slate-700/40 cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded bg-sky-100 dark:bg-sky-950 flex items-center justify-center flex-shrink-0">
                        <Plane className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                          <span className="font-mono">{flight.flightNo}</span>
                          {hasJL && <span className="text-[9px] text-emerald-600 font-bold">✓ JL</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {flight.dep} → {flight.arr} · {flight.acft || "—"}
                        </div>
                      </div>
                      <div className="text-end font-mono">
                        <div className="text-[10.5px] text-slate-700 dark:text-slate-300">{fmtDate(flight.std)}</div>
                        <div className="text-[10px] text-slate-500">
                          B:{fmtDuty(calc.blockMin)} · D:{fmtDuty(calc.dutyMin)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════ قائمة الطاقم حسب القسم ═══════════ */
  return (
    <div className="space-y-2.5 fade-in">
      {/* Compact Header & Department Search Strip */}
      <div
        className="p-2.5 rounded-xl space-y-2"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #ea580c, #dc2626)" }}
            >
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {t.ftlTitle || "Flight Time Limitations (FTL)"}
              </h2>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {t.ftlCompliance} (ORO.FTL) · {filteredCrew.length} / {crew.length} {isAr ? "عضو" : "crew"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="h-7 px-2 rounded border text-[11px] font-mono bg-transparent"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              title={isAr ? "تاريخ الحساب اليومي" : "Daily reference date"}
            />

            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(+e.target.value)}
              className="h-7 px-2 rounded border text-[11px] font-semibold bg-transparent outline-none cursor-pointer"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value={7}>{t.last7days}</option>
              <option value={14}>{t.last14days}</option>
              <option value={28}>{t.last28days}</option>
              <option value={90}>{t.last90days}</option>
              <option value={365}>{t.lastYear}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-7 px-2 rounded border text-[11px] font-semibold bg-transparent outline-none cursor-pointer"
              style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
            >
              <option value="all">{isAr ? "كل الحالات" : "All Statuses"}</option>
              <option value="attention">{isAr ? "تحتاج متابعة" : "Attention Needed"}</option>
              <option value="exceeded">{isAr ? "تجاوز الحد" : "Exceeded Only"}</option>
            </select>

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? "بحث بالاسم، الكود، القسم..." : "Search crew or dept..."}
                className="ps-7 pe-2 h-7 rounded border text-[11px] bg-transparent outline-none w-44 sm:w-52"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
        </div>

        {/* Department Tabs */}
        <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t" style={{ borderColor: "var(--border-default)" }}>
          {FTL_DEPARTMENTS.map((dept) => {
            const active = deptFilter === dept.id;
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setDeptFilter(dept.id)}
                className="h-6 px-2.5 rounded-md text-[11px] font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
                style={
                  active
                    ? { background: "var(--brand-gradient)", color: "white" }
                    : {
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border-default)",
                      }
                }
              >
                <span>{isAr ? dept.ar : dept.en}</span>
                <span className="font-mono tabular-nums text-[10px] opacity-85">
                  {deptCounts[dept.id] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Crew FTL Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {filteredCrew.map((c) => {
          const dept = getCrewDepartment(c);
          const data = crewStats[c.id] || {
            limits: {},
            totalDutyMin: 0,
            totalFlightMin: 0,
            totalSectors: 0,
          };
          const L = data.limits || {};
          const duty28 = L.duty28 || { used: 0, max: 190 * 60, pct: 0, status: "ok" };
          const ftl28 = L.flight28 || { used: 0, max: 100 * 60, pct: 0, status: "ok" };
          const dailyFtl = getCrewDailyFtlStats(c.id, referenceDate, flights);

          const worstStatus =
            dailyFtl?.isExceeded || [duty28.status, ftl28.status].includes("exceeded")
              ? "exceeded"
              : [duty28.status, ftl28.status].includes("critical")
              ? "critical"
              : [duty28.status, ftl28.status].includes("warning")
              ? "warning"
              : "ok";

          const borderColor = {
            exceeded: "border-rose-400 bg-rose-50/60 dark:bg-rose-950/30",
            critical: "border-orange-400 bg-orange-50/60 dark:bg-orange-950/30",
            warning: "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30",
            ok: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",
          }[worstStatus];

          const statusDot = {
            exceeded: "bg-rose-500",
            critical: "bg-orange-500",
            warning: "bg-amber-500",
            ok: "bg-emerald-500",
          }[worstStatus];

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCrew(c.id)}
              className={`text-start rounded-lg border p-2.5 hover:border-sky-500/60 transition cursor-pointer flex flex-col justify-between ${borderColor}`}
            >
              <div className="space-y-2 w-full">
                <div className="flex items-start gap-2">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex-shrink-0">
                    {toDisplayImageUrl(c.avatar) ? (
                      <img src={toDisplayImageUrl(c.avatar)} alt={c.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-full h-full p-2 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <CrewContactCard member={c} flights={flights}>
                        <div className="font-bold text-xs truncate text-slate-800 dark:text-slate-100 hover:text-blue-500">
                          {c.fullName}
                        </div>
                      </CrewContactCard>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
                    </div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate font-mono">
                      {t[c.role] || c.role} · #{c.empNo || "—"}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300 font-semibold">
                        {getDeptLabel(dept, isAr)}
                      </span>
                      {dailyFtl && dailyFtl.sectorsCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300 font-mono font-bold">
                          FDP {dailyFtl.actualStr}/{dailyFtl.maxStr}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 text-[10.5px]">
                  <div className="p-1.5 bg-slate-100/70 dark:bg-slate-900/70 rounded">
                    <div className="text-slate-500 text-[9px]">Duty 28d</div>
                    <div className="font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                      {fmtDutyHM(duty28.used)}
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-100/70 dark:bg-slate-900/70 rounded">
                    <div className="text-slate-500 text-[9px]">Flt 28d</div>
                    <div className="font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                      {fmtDutyHM(ftl28.used)}
                    </div>
                  </div>
                  <div className="p-1.5 bg-slate-100/70 dark:bg-slate-900/70 rounded">
                    <div className="text-slate-500 text-[9px]">Sectors</div>
                    <div className="font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                      {data.totalSectors}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between text-[9.5px] text-slate-500 mb-0.5">
                      <span>Duty</span>
                      <span className="font-mono font-bold">{duty28.pct}%</span>
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: Math.min(100, duty28.pct) + "%",
                          background:
                            duty28.status === "exceeded"
                              ? "#dc2626"
                              : duty28.status === "critical"
                              ? "#f97316"
                              : duty28.status === "warning"
                              ? "#f59e0b"
                              : "#22c55e",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9.5px] text-slate-500 mb-0.5">
                      <span>Flight</span>
                      <span className="font-mono font-bold">{ftl28.pct}%</span>
                    </div>
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: Math.min(100, ftl28.pct) + "%",
                          background:
                            ftl28.status === "exceeded"
                              ? "#dc2626"
                              : ftl28.status === "critical"
                              ? "#f97316"
                              : ftl28.status === "warning"
                              ? "#f59e0b"
                              : "#22c55e",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FTLModule;
