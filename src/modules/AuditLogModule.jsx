/* ═══════════════════════════════════════════════════════════
 * AUDIT LOG MODULE — with date range search
 * v2.0 — Added from/to date + preset ranges
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import { Search, FileText, FileDown, X, Calendar } from "lucide-react";
import { useT } from "../contexts";
import { Modal } from "../components/ui/Modal";
import { auditAPI } from "../api";
import { fmtDateTime } from "../utils/helpers";
import { AUDIT_ACTIONS } from "../config/constants";

/* ⭐ Preset ranges */
const PRESETS = [
  { id: "today", label_en: "Today", label_ar: "اليوم", days: 0 },
  { id: "yesterday", label_en: "Yesterday", label_ar: "أمس", days: 1 },
  { id: "week", label_en: "Last 7 days", label_ar: "آخر 7 أيام", days: 7 },
  { id: "month", label_en: "Last 30 days", label_ar: "آخر 30 يوم", days: 30 },
  {
    id: "3months",
    label_en: "Last 3 months",
    label_ar: "آخر 3 أشهر",
    days: 90,
  },
  { id: "year", label_en: "Last year", label_ar: "آخر سنة", days: 365 },
  { id: "all", label_en: "All time", label_ar: "كل الوقت", days: null },
  { id: "custom", label_en: "Custom", label_ar: "مخصص", days: null },
];

const presetRange = (presetId) => {
  if (presetId === "all") return { from: "", to: "" };
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  if (presetId === "today") return { from: to, to };
  if (presetId === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return {
      from: y.toISOString().slice(0, 10),
      to: y.toISOString().slice(0, 10),
    };
  }

  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.days === null) return { from: "", to };

  const from = new Date(today);
  from.setDate(from.getDate() - preset.days);
  return { from: from.toISOString().slice(0, 10), to };
};

export function AuditLogModule({ auditLogs = [], setAuditLogs }) {
  const t = useT();
  const lang = document.documentElement.lang || "ar";

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [preset, setPreset] = useState("week");
  const [fromDate, setFromDate] = useState(() => presetRange("week").from);
  const [toDate, setToDate] = useState(() => presetRange("week").to);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(true);

  const changePreset = (id) => {
    setPreset(id);
    if (id !== "custom") {
      const range = presetRange(id);
      setFromDate(range.from);
      setToDate(range.to);
    }
  };

  /* ⭐ Unique users */
  const uniqueUsers = useMemo(() => {
    const map = {};
    auditLogs.forEach((l) => {
      if (l.userId) {
        map[l.userId] = l.userName || "Unknown";
      }
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [auditLogs]);

  /* ⭐ Filter */
  const filtered = useMemo(() => {
    return auditLogs
      .filter((log) => {
        const matchesSearch =
          !search ||
          (log.userName || "").toLowerCase().includes(search.toLowerCase()) ||
          (log.entityName || "").toLowerCase().includes(search.toLowerCase()) ||
          (log.action || "").toLowerCase().includes(search.toLowerCase());

        if (!matchesSearch) return false;
        if (actionFilter && log.action !== actionFilter) return false;
        if (entityFilter && log.entity !== entityFilter) return false;
        if (userFilter && log.userId !== userFilter) return false;

        /* ⭐ Date Range */
        if (log.timestamp) {
          const logDate = log.timestamp.slice(0, 10);
          if (fromDate && logDate < fromDate) return false;
          if (toDate && logDate > toDate) return false;
        }

        return true;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [
    auditLogs,
    search,
    actionFilter,
    entityFilter,
    userFilter,
    fromDate,
    toDate,
  ]);

  /* ⭐ Stats */
  const stats = {
    total: auditLogs.length,
    filtered: filtered.length,
    today: auditLogs.filter(
      (l) => new Date() - new Date(l.timestamp) < 86400000
    ).length,
    creates: auditLogs.filter((l) => l.action === "CREATE").length,
    updates: auditLogs.filter((l) => l.action === "UPDATE").length,
    deletes: auditLogs.filter((l) => l.action === "DELETE").length,
  };

  const actionColor = (action) =>
    AUDIT_ACTIONS[action]?.color ||
    "bg-slate-100 text-slate-700 border-slate-300";

  const actionIcon = (action) => AUDIT_ACTIONS[action]?.icon || "📝";

  const clearDates = () => {
    setFromDate("");
    setToDate("");
    setPreset("all");
  };

  /* ⭐ CSV Export */
  const exportCSV = () => {
    const headers = [
      "Timestamp",
      "User",
      "Role",
      "Action",
      "Entity",
      "Item",
      "Details",
    ];
    const rows = filtered.map((l) => [
      fmtDateTime(l.timestamp),
      l.userName,
      l.userRole,
      l.action,
      l.entity,
      l.entityName,
      (l.details || "").substring(0, 100),
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${fromDate || "all"}_${toDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ⭐ Clear All */
  const clearAll = async () => {
    if (!(await confirmAction(t.confirmDeleteAll))) return;
    if (!(await confirmAction(t.confirmClearAll || "Are you sure?"))) return;
    try {
      await auditAPI.clearAll();
      setAuditLogs([]);
    } catch (e) {
      showToast("Failed: " + e.message);
    }
  };

  /* ⭐ Unique entities */
  const uniqueEntities = [
    ...new Set(auditLogs.map((l) => l.entity).filter(Boolean)),
  ];

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-indigo-700 to-purple-800 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {t.auditLogTitle || "Audit Log"}
              </h2>
              <div className="text-xs text-indigo-200">
                {stats.total} {t.totalAudit || "total"} · {stats.filtered}{" "}
                {lang === "ar" ? "معروض" : "shown"}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold"
            >
              <FileDown className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-bold"
            >
              🗑️ {t.clearAll || "Clear All"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.totalAudit || "Total"}
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-300">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border-2 border-sky-200 dark:border-sky-800 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.todayAudit || "Today"}
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {stats.today}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.createsAudit || "Creates"}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {stats.creates}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.updatesAudit || "Updates"}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {stats.updates}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-800 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.deletesAudit || "Deletes"}
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300">
            {stats.deletes}
          </div>
        </div>
      </div>

      {/* ═══ Date Range Filter ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-800 dark:text-indigo-200">
            <Calendar className="w-4 h-4" />
            {lang === "ar" ? "البحث بالتاريخ" : "Date Range Search"}
          </div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {showDateFilter ? "▾" : "▸"}
          </button>
        </div>

        {showDateFilter && (
          <>
            <div className="flex flex-wrap gap-1 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => changePreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    preset === p.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {lang === "ar" ? p.label_ar : p.label_en}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  {lang === "ar" ? "من تاريخ" : "From"}
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPreset("custom");
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  {lang === "ar" ? "إلى تاريخ" : "To"}
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPreset("custom");
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  onClick={clearDates}
                  className="flex-1 px-3 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold"
                >
                  ✖ {lang === "ar" ? "مسح التاريخ" : "Clear Dates"}
                </button>
                <div className="flex-1 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 text-xs font-bold text-center">
                  {stats.filtered} / {stats.total}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Other Filters ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchAudit || "Search…"}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all || "All actions"}</option>
          {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.icon} {v.label_en}
            </option>
          ))}
        </select>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all || "All users"}</option>
          {uniqueUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* ═══ Entity filter ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap gap-1">
        <span className="text-xs font-bold text-slate-500 self-center px-2">
          {lang === "ar" ? "الكيان:" : "Entity:"}
        </span>
        <button
          onClick={() => setEntityFilter("")}
          className={`px-3 py-1 rounded-lg text-xs font-bold ${
            entityFilter === ""
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
          }`}
        >
          {t.all || "All"}
        </button>
        {uniqueEntities.map((e) => (
          <button
            key={e}
            onClick={() => setEntityFilter(e)}
            className={`px-3 py-1 rounded-lg text-xs font-bold ${
              entityFilter === e
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.eventTimestamp || "Timestamp"}
                </th>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.eventUser || "User"}
                </th>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.role || "Role"}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-200">
                  {t.eventAction || "Action"}
                </th>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.eventEntity || "Entity"}
                </th>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.eventItem || "Item"}
                </th>
                <th className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-200">
                  {t.details || "Details"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 opacity-30" />
                      <span>{t.noData || "No data"}</span>
                      {(fromDate || toDate) && (
                        <span className="text-xs">
                          {lang === "ar"
                            ? "لا توجد أحداث في النطاق"
                            : "No events in range"}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-indigo-50/40 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {fmtDateTime(log.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {(log.userName || "?")[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-100">
                          {log.userName || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      {log.userRole || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${actionColor(
                          log.action
                        )}`}
                      >
                        {actionIcon(log.action)} {log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                      {log.entity || "—"}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                      {log.entityName || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 hover:bg-sky-200 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                        {t.view || "View"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Details Modal ═══ */}
      {selectedLog && (
        <Modal
          open={!!selectedLog}
          title={`${t.auditEvent || "Event"} — ${selectedLog.action}`}
          onClose={() => setSelectedLog(null)}
          wide
          footer={
            <button
              onClick={() => setSelectedLog(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
            >
              {t.close || "Close"}
            </button>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventTimestamp || "Timestamp"}
                </div>
                <div className="font-mono text-xs text-slate-800 dark:text-slate-100">
                  {selectedLog.timestamp}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventUser || "User"}
                </div>
                <div className="text-slate-800 dark:text-slate-100">
                  {selectedLog.userName} ({selectedLog.userRole})
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventAction || "Action"}
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${actionColor(
                    selectedLog.action
                  )}`}
                >
                  {actionIcon(selectedLog.action)} {selectedLog.action}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventEntity || "Entity"}
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-100">
                  {selectedLog.entity} · {selectedLog.entityName}
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-800">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase mb-1">
                {t.eventDetails || "Details"}
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-800 dark:text-slate-100">
                {(() => {
                  try {
                    return JSON.stringify(
                      JSON.parse(selectedLog.details || "{}"),
                      null,
                      2
                    );
                  } catch {
                    return selectedLog.details || "—";
                  }
                })()}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AuditLogModule;
