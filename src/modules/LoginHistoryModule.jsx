/* ═══════════════════════════════════════════════════════════
 * LOGIN HISTORY MODULE — with date range search
 * v2.0 — Added from/to date + preset ranges
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Monitor,
  Smartphone,
  FileDown,
  Trash2,
  Calendar,
  X,
} from "lucide-react";
import { useT } from "../contexts";
import { Modal } from "../components/ui/Modal";
import { loginHistoryAPI } from "../api";
import { fmtTimeAgo, fmtDateTime, todayISO } from "../utils/helpers";

/* ⭐ Action types */
const ACTION_TYPES = {
  LOGIN: {
    label_en: "Login Success",
    label_ar: "دخول ناجح",
    color:
      "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300",
    icon: "🔓",
  },
  LOGOUT: {
    label_en: "Logout",
    label_ar: "خروج",
    color:
      "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300",
    icon: "🔒",
  },
  LOGIN_FAILED: {
    label_en: "Login Failed",
    label_ar: "دخول فاشل",
    color:
      "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300",
    icon: "⚠️",
  },
};

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

/* ⭐ احسب التاريخ من preset */
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

export function LoginHistoryModule({
  loginHistory = [],
  setLoginHistory,
  currentUser,
}) {
  const t = useT();
  const lang = document.documentElement.lang || "ar";

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [preset, setPreset] = useState("week");
  const [fromDate, setFromDate] = useState(() => presetRange("week").from);
  const [toDate, setToDate] = useState(() => presetRange("week").to);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDateFilter, setShowDateFilter] = useState(true);

  /* ⭐ تغيير preset */
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
    loginHistory.forEach((h) => {
      if (h.userId) {
        map[h.userId] = {
          id: h.userId,
          name: h.userName || h.username || "Unknown",
          role: h.userRole || "",
        };
      }
    });
    return Object.values(map);
  }, [loginHistory]);

  /* ⭐ Filter */
  const filtered = useMemo(() => {
    return loginHistory
      .filter((h) => {
        /* ⭐ Search */
        if (search) {
          const q = String(search).toLowerCase();
          if (
            !String(h.userName ?? "").toLowerCase().includes(q) &&
            !String(h.username ?? "").toLowerCase().includes(q) &&
            !String(h.browser ?? "").toLowerCase().includes(q) &&
            !String(h.os ?? "").toLowerCase().includes(q) &&
            !String(h.ipAddress ?? "").toLowerCase().includes(q)
          )
            return false;
        }
        if (userFilter && h.userId !== userFilter) return false;
        if (actionFilter && h.action !== actionFilter) return false;

        /* ⭐ Date Range */
        if (h.timestamp) {
          const eventDate = h.timestamp.slice(0, 10);
          if (fromDate && eventDate < fromDate) return false;
          if (toDate && eventDate > toDate) return false;
        }

        return true;
      })
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }, [loginHistory, search, userFilter, actionFilter, fromDate, toDate]);

  /* ⭐ Stats */
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    return {
      total: loginHistory.length,
      filtered: filtered.length,
      today: loginHistory.filter((h) => new Date(h.timestamp) >= todayStart)
        .length,
      loginSuccess: loginHistory.filter((h) => h.action === "LOGIN").length,
      loginFailed: loginHistory.filter((h) => h.action === "LOGIN_FAILED")
        .length,
      logout: loginHistory.filter((h) => h.action === "LOGOUT").length,
      uniqueUsers: uniqueUsers.length,
    };
  }, [loginHistory, filtered, uniqueUsers]);

  /* ⭐ Device Icon */
  const getDeviceIcon = (userAgent = "") => {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes("mobile") ||
      ua.includes("android") ||
      ua.includes("iphone")
    )
      return <Smartphone className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  /* ⭐ Clear date filter */
  const clearDates = () => {
    setFromDate("");
    setToDate("");
    setPreset("all");
  };

  /* ⭐ Export CSV */
  const exportCSV = () => {
    const headers = [
      "Timestamp",
      "User",
      "Username",
      "Role",
      "Action",
      "Browser",
      "OS",
      "IP",
      "Success",
      "Reason",
    ];
    const rows = filtered.map((h) => [
      h.timestamp || "",
      h.userName || "",
      h.username || "",
      h.userRole || "",
      h.action || "",
      h.browser || "",
      h.os || "",
      h.ipAddress || "",
      h.success !== false ? "Yes" : "No",
      h.reason || "",
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
    a.download = `login-history-${fromDate || "all"}_${toDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ⭐ Clear All */
  const clearAll = async () => {
    if (!(await confirmAction(t.confirmDeleteAll))) return;
    if (!(await confirmAction(t.confirmClearAll || "Are you sure?"))) return;
    try {
      await loginHistoryAPI.clearAll();
      setLoginHistory([]);
    } catch (e) {
      showToast("Failed: " + e.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {t.loginHistoryTitle || "Login History"}
              </h2>
              <div className="text-xs text-slate-300">
                {stats.total} {t.totalEvents || "events"} · {stats.uniqueUsers}{" "}
                {lang === "ar" ? "مستخدم" : "users"} · {stats.filtered}{" "}
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
            {currentUser?.role === "superAdmin" && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-bold"
              >
                <Trash2 className="w-4 h-4" /> {t.clear || "Clear"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.totalEvents || "Total"}
          </div>
          <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-200">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.successfulLogins || "Success"}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {stats.loginSuccess}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-rose-200 dark:border-rose-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.failedLogins || "Failed"}
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300">
            {stats.loginFailed}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.logouts || "Logouts"}
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700 dark:text-indigo-300">
            {stats.logout}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.todayLogin || "Today"}
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {stats.today}
          </div>
        </div>
      </div>

      {/* ═══ Security Alert ═══ */}
      {stats.loginFailed > 5 && (
        <div className="bg-rose-50 dark:bg-rose-950 border-2 border-rose-300 dark:border-rose-800 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 dark:text-rose-200">
            <b>⚠️ {t.securityAlert || "Security Alert"}:</b> {stats.loginFailed}{" "}
            {t.securityAlertMsg || "failed login attempts detected"}
          </div>
        </div>
      )}

      {/* ═══ Date Range Filter ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-sky-200 dark:border-sky-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-sky-800 dark:text-sky-200">
            <Calendar className="w-4 h-4" />
            {lang === "ar" ? "البحث بالتاريخ" : "Date Range Search"}
          </div>
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
          >
            {showDateFilter ? "▾" : "▸"}
          </button>
        </div>

        {showDateFilter && (
          <>
            {/* Presets */}
            <div className="flex flex-wrap gap-1 mb-3">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => changePreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    preset === p.id
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {lang === "ar" ? p.label_ar : p.label_en}
                </button>
              ))}
            </div>

            {/* From/To */}
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
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
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
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  onClick={clearDates}
                  className="flex-1 px-3 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold"
                >
                  ✖ {lang === "ar" ? "مسح التاريخ" : "Clear Dates"}
                </button>
                <div className="flex-1 px-3 py-2 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-200 text-xs font-bold text-center">
                  {stats.filtered} / {stats.total}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ Other Filters ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchLogin || "Search…"}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all || "All users"}</option>
          {uniqueUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all || "All actions"}</option>
          <option value="LOGIN">🔓 {t.loginSuccess || "Login"}</option>
          <option value="LOGOUT">🔒 {t.logout || "Logout"}</option>
          <option value="LOGIN_FAILED">⚠️ {t.loginFailed || "Failed"}</option>
        </select>
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
                  {t.device || "Device"}
                </th>
                <th className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200">
                  {t.browser || "Browser"}
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
                      <ShieldCheck className="w-12 h-12 opacity-30" />
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
                filtered.map((h) => {
                  const action = ACTION_TYPES[h.action] || ACTION_TYPES.LOGIN;
                  const failed =
                    h.action === "LOGIN_FAILED" || h.success === false;
                  return (
                    <tr
                      key={h.id}
                      className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer ${
                        failed ? "bg-rose-50/50 dark:bg-rose-950/30" : ""
                      }`}
                      onClick={() => setSelectedEvent(h)}
                    >
                      <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300">
                          {fmtDateTime(h.timestamp)}
                        </div>
                        <div className="text-slate-400 text-[9px]">
                          {fmtTimeAgo(h.timestamp)}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {(h.userName || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-100">
                              {h.userName || "Unknown"}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              @{h.username || "—"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {h.userRole || "—"}
                      </td>

                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${action.color}`}
                        >
                          <span>{action.icon}</span>
                          {lang === "ar" ? action.label_ar : action.label_en}
                        </span>
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          {getDeviceIcon(h.userAgent)}
                          <span>{h.os || "—"}</span>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {h.browser || "—"}
                      </td>

                      <td className="px-3 py-2 text-center">
                        <button className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 hover:bg-sky-200 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                          {t.view || "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Details Modal ═══ */}
      {selectedEvent && (
        <Modal
          open={!!selectedEvent}
          title={`${ACTION_TYPES[selectedEvent.action]?.icon} ${
            t.eventDetails || "Event Details"
          }`}
          onClose={() => setSelectedEvent(null)}
          wide
          footer={
            <button
              onClick={() => setSelectedEvent(null)}
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
                  {selectedEvent.timestamp}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.timeAgo || "Time Ago"}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {fmtTimeAgo(selectedEvent.timestamp)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventUser || "User"}
                </div>
                <div className="font-bold text-slate-800 dark:text-slate-100">
                  {selectedEvent.userName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  @{selectedEvent.username}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.role || "Role"}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {selectedEvent.userRole || "—"}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.eventAction || "Action"}
                </div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                    ACTION_TYPES[selectedEvent.action]?.color
                  }`}
                >
                  {lang === "ar"
                    ? ACTION_TYPES[selectedEvent.action]?.label_ar
                    : ACTION_TYPES[selectedEvent.action]?.label_en}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Success
                </div>
                <div
                  className={
                    selectedEvent.success !== false
                      ? "text-emerald-600 font-bold"
                      : "text-rose-600 font-bold"
                  }
                >
                  {selectedEvent.success !== false ? "✓ Yes" : "✗ No"}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.browser || "Browser"}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {selectedEvent.browser || "—"}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  {t.os || "OS"}
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {selectedEvent.os || "—"}
                </div>
              </div>
            </div>

            {selectedEvent.reason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded">
                <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                  Reason
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-100">
                  {selectedEvent.reason}
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
              <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                {t.userAgent || "User Agent"}
              </div>
              <div className="text-[10px] font-mono break-all text-slate-600 dark:text-slate-400">
                {selectedEvent.userAgent || "—"}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default LoginHistoryModule;
