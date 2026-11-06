/* ═══════════════════════════════════════════════════════════
 * FTL MODULE — EASA Compliance
 * Flight Time Limitations dashboard
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
} from "lucide-react";
import { useT } from "../contexts";
import {
  calcCrewDutyEASA,
  calcFlightDuty,
  fmtDuty,
  fmtDutyHM,
} from "../config/constants";
import { fmtDate } from "../utils/helpers";
import { toDisplayImageUrl } from "../api";

export function FTLModule({ crew, flights }) {
  const t = useT();
  const [selectedCrew, setSelectedCrew] = useState("");
  const [search, setSearch] = useState("");
  const [periodDays, setPeriodDays] = useState(28);

  /* ⭐ حساب لجميع الطاقم */
  const crewStats = useMemo(() => {
    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - periodDays * 86400000)
      .toISOString()
      .slice(0, 10);

    const stats = {};
    crew.forEach((c) => {
      stats[c.id] = calcCrewDutyEASA(c.id, flights, fromDate, toDate);
    });
    return stats;
  }, [crew, flights, periodDays]);

  const filteredCrew = crew.filter(
    (c) =>
      !search ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (c.empNo || "").toLowerCase().includes(search.toLowerCase())
  );

  /* ═══════════ تفاصيل عضو ═══════════ */
  if (selectedCrew) {
    const member = crew.find((c) => c.id === selectedCrew);
    if (!member) {
      setSelectedCrew("");
      return null;
    }

    const data = crewStats[selectedCrew] || {
      duties: [],
      limits: {},
      totalDutyMin: 0,
      totalFlightMin: 0,
      totalSectors: 0,
    };
    const L = data.limits;

    const getColor = (status) =>
      ({
        exceeded: "bg-rose-100 text-rose-700 border-rose-300",
        critical: "bg-orange-100 text-orange-700 border-orange-300",
        warning: "bg-amber-100 text-amber-700 border-amber-300",
        ok: "bg-emerald-100 text-emerald-700 border-emerald-300",
      }[status] || "bg-slate-100 text-slate-700 border-slate-300");

    const getBarColor = (status) =>
      ({
        exceeded: "#dc2626",
        critical: "#f97316",
        warning: "#f59e0b",
        ok: "#22c55e",
      }[status] || "#94a3b8");

    return (
      <div className="space-y-3">
        {/* ⭐ Header */}
        <div className="flex flex-wrap gap-3 items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 border-2 border-white/30 flex-shrink-0">
              {toDisplayImageUrl(member.avatar) ? (
                <img
                  src={toDisplayImageUrl(member.avatar)}
                  alt={member.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-full h-full p-2 text-white/70" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-lg">{member.fullName}</h2>
              <div className="text-xs text-slate-300">
                {t[member.role]} · {member.empNo} · {member.base}
              </div>
              <div className="text-[10px] text-sky-300 mt-0.5">
                {t.ftlCompliance} · {data.totalSectors} {t.sectors}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(+e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/30 rounded text-xs text-white outline-none"
            >
              <option value={7} className="text-slate-800">
                {t.last7days}
              </option>
              <option value={14} className="text-slate-800">
                {t.last14days}
              </option>
              <option value={28} className="text-slate-800">
                {t.last28days}
              </option>
              <option value={90} className="text-slate-800">
                {t.last90days}
              </option>
              <option value={365} className="text-slate-800">
                {t.lastYear}
              </option>
            </select>
            <button
              onClick={() => setSelectedCrew("")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm transition"
            >
              <X className="w-4 h-4" /> {t.cancel}
            </button>
          </div>
        </div>

        {/* ⭐ KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-sky-200 dark:border-sky-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {t.totalDuty}
              </span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-800 dark:text-sky-300">
              {fmtDuty(data.totalDutyMin)}
            </div>
            <div className="text-[10px] text-slate-500">{periodDays} days</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {t.flightTime}
              </span>
              <Plane className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300">
              {fmtDuty(data.totalFlightMin)}
            </div>
            <div className="text-[10px] text-slate-500">{periodDays} days</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {t.sectors}
              </span>
              <Award className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-800 dark:text-purple-300">
              {data.totalSectors}
            </div>
            <div className="text-[10px] text-slate-500">Total flights</div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-amber-200 dark:border-amber-800 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase">
                {t.avgPerDuty}
              </span>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-800 dark:text-amber-300">
              {data.duties.length
                ? fmtDuty(Math.round(data.totalDutyMin / data.duties.length))
                : "00:00"}
            </div>
            <div className="text-[10px] text-slate-500">
              {data.duties.length} duties
            </div>
          </div>
        </div>

        {/* ⭐ EASA Limits */}
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2 text-white">
            <h3 className="font-bold text-sm flex items-center gap-2">
              📋 {t.cumulativeLimits}
              <span className="text-[10px] bg-sky-500 px-2 py-0.5 rounded">
                ORO.FTL.210
              </span>
            </h3>
          </div>
          <div className="p-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(L).map(([k, l]) => (
              <div
                key={k}
                className={`rounded-lg border-2 p-3 ${getColor(l.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase opacity-80">
                    {l.label_en || l.label}
                  </span>
                  {l.status === "exceeded" && (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-xl font-bold font-mono">
                    {fmtDuty(l.used)}
                  </div>
                  <div className="text-[10px] opacity-70">
                    / {fmtDuty(l.max)}
                  </div>
                </div>
                <div className="mt-2 h-2 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: l.pct + "%",
                      background: getBarColor(l.status),
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] mt-1">
                  <span className="font-bold">{l.pct}%</span>
                  <span className="opacity-70">
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

        {/* ⭐ Daily Duties */}
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2 text-white flex items-center justify-between">
            <h3 className="font-bold text-sm">📅 {t.dailyDuties}</h3>
            <span className="text-xs text-slate-300">
              {data.duties.length} duty periods
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-start font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.date}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.sectors}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.block}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.flightTime}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.dutyTime}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.fdp}
                  </th>
                  <th className="px-3 py-2 text-center font-bold border-e border-slate-200 dark:border-slate-700">
                    {t.fdpLimit}
                  </th>
                  <th className="px-3 py-2 text-center font-bold">
                    {t.status}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.duties.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="p-8 text-center text-slate-400 text-sm"
                    >
                      No completed duties in this period
                    </td>
                  </tr>
                ) : (
                  data.duties.map((d, i) => (
                    <tr
                      key={i}
                      className={`border-t border-slate-200 dark:border-slate-700 ${
                        d.fdpExceeded
                          ? "bg-rose-50 dark:bg-rose-950"
                          : "hover:bg-sky-50/50 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono">{d.date}</td>
                      <td className="px-3 py-1.5 text-center font-bold">
                        {d.sectors}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono">
                        {fmtDuty(d.blockMin)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-emerald-700 dark:text-emerald-400">
                        {fmtDuty(d.flightMin)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                        {fmtDuty(d.dutyMin)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-sky-700 dark:text-sky-400">
                        {fmtDuty(d.fdpMin)}
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono text-slate-500">
                        {d.fdpLimit ? fmtDuty(d.fdpLimitMin) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {d.fdpExceeded ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                            ⚠️ {t.fdpExceeded}
                          </span>
                        ) : d.isNightDuty ? (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                            🌙 {t.nightDuty}
                          </span>
                        ) : d.usingDiscretion ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            ⚖️ {t.discretion}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            ✓ {t.ok}
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

        {/* ⭐ Recent Flights */}
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-2 text-white">
            <h3 className="font-bold text-sm">
              ✈️ {t.recentFlightsFt} ({data.crewFlights.length})
            </h3>
          </div>
          <div className="max-h-96 overflow-auto">
            {data.crewFlights
              .slice()
              .reverse()
              .slice(0, 30)
              .map((flight, i) => {
                const calc = calcFlightDuty(flight);
                const hasJL =
                  flight.actual && (flight.actual.std || flight.actual.sta);
                return (
                  <div
                    key={i}
                    className="p-3 flex items-center gap-3 hover:bg-sky-50/50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700"
                  >
                    <div className="w-10 h-10 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center flex-shrink-0">
                      <Plane className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
                        {flight.flightNo}
                        {hasJL && (
                          <span className="text-[9px] text-emerald-600 font-bold">
                            ✓ JL
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {flight.dep} → {flight.arr} · {flight.acft}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
                        {fmtDate(flight.std)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t.block}: {fmtDuty(calc.blockMin)} · {t.dutyTime}:{" "}
                        {fmtDuty(calc.dutyMin)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════ قائمة الطاقم ═══════════ */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-gradient-to-r from-orange-600 to-red-700 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t.ftlTitle}</h2>
            <div className="text-xs text-orange-100">
              {t.ftlCompliance} (ORO.FTL) · {crew.length} crew
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(+e.target.value)}
            className="px-3 py-2 bg-white/10 border border-white/30 rounded text-sm text-white outline-none"
          >
            <option value={7} className="text-slate-800">
              {t.last7days}
            </option>
            <option value={14} className="text-slate-800">
              {t.last14days}
            </option>
            <option value={28} className="text-slate-800">
              {t.last28days}
            </option>
            <option value={90} className="text-slate-800">
              {t.last90days}
            </option>
            <option value={365} className="text-slate-800">
              {t.lastYear}
            </option>
          </select>

          <div className="relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-white/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="ps-9 pe-3 py-2 bg-white/10 border border-white/30 rounded text-sm text-white placeholder-white/60 outline-none w-56"
            />
          </div>
        </div>
      </div>

      {/* Crew Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredCrew.map((c) => {
          const data = crewStats[c.id] || {
            limits: {},
            totalDutyMin: 0,
            totalFlightMin: 0,
            totalSectors: 0,
          };
          const L = data.limits;
          const duty28 = L.duty28 || {
            used: 0,
            max: 190 * 60,
            pct: 0,
            status: "ok",
          };
          const ftl28 = L.flight28 || {
            used: 0,
            max: 100 * 60,
            pct: 0,
            status: "ok",
          };

          const worstStatus = [duty28.status, ftl28.status].includes("exceeded")
            ? "exceeded"
            : [duty28.status, ftl28.status].includes("critical")
            ? "critical"
            : [duty28.status, ftl28.status].includes("warning")
            ? "warning"
            : "ok";

          const borderColor = {
            exceeded: "border-rose-400 bg-rose-50 dark:bg-rose-950",
            critical: "border-orange-400 bg-orange-50 dark:bg-orange-950",
            warning: "border-amber-400 bg-amber-50 dark:bg-amber-950",
            ok: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800",
          }[worstStatus];

          const statusIcon = {
            exceeded: "⚠️",
            critical: "🔴",
            warning: "🟡",
            ok: "✓",
          }[worstStatus];

          return (
            <button
              key={c.id}
              onClick={() => setSelectedCrew(c.id)}
              className={`text-start rounded-xl border-2 p-4 hover:shadow-lg transition ${borderColor}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-white flex-shrink-0">
                  {toDisplayImageUrl(c.avatar) ? (
                    <img
                      src={toDisplayImageUrl(c.avatar)}
                      alt={c.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-full h-full p-2 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate text-slate-800 dark:text-slate-100">
                    {c.fullName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t[c.role]} · {c.empNo}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {c.base}
                  </div>
                </div>
                <div className="text-xl">{statusIcon}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                <div className="p-2 bg-white/70 dark:bg-slate-900/70 rounded">
                  <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                    {t.duty28}
                  </div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {fmtDutyHM(duty28.used)}
                  </div>
                </div>
                <div className="p-2 bg-white/70 dark:bg-slate-900/70 rounded">
                  <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                    {t.flight28}
                  </div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {fmtDutyHM(ftl28.used)}
                  </div>
                </div>
                <div className="p-2 bg-white/70 dark:bg-slate-900/70 rounded">
                  <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                    {t.sectors}
                  </div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {data.totalSectors}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>{t.duty28}</span>
                    <span className="font-bold">{duty28.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: duty28.pct + "%",
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
                  <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                    <span>{t.flight28}</span>
                    <span className="font-bold">{ftl28.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: ftl28.pct + "%",
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

              <div className="text-[10px] text-slate-500 mt-2 text-end">
                Click for details →
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FTLModule;
