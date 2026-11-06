/* ═══════════════════════════════════════════════════════════
 * LEAVE MODULE — Crew Leave Management
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useT } from "../contexts";
import { leaveAPI } from "../api";
import { fmtDate } from "../utils/helpers";
import { LEAVE_TYPES, LEAVE_STATUS } from "../config/constants";

/* ⭐ حساب الأيام */
const calcDays = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const diff = new Date(toDate) - new Date(fromDate);
  return Math.max(1, Math.round(diff / 86400000) + 1);
};

export function LeaveModule({
  crew,
  leave = [],
  setLeave,
  setSyncStatus,
  currentUser,
}) {
  const t = useT();
  const lang = document.documentElement.lang || "en";

  const [search, setSearch] = useState("");
  const [crewFilter, setCrewFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("upcoming");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [selectedLeave, setSelectedLeave] = useState(null);

  /* ⭐ Filtering */
  const filtered = useMemo(() => {
    return leave
      .filter((l) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !l.crewName?.toLowerCase().includes(q) &&
            !l.reason?.toLowerCase().includes(q)
          )
            return false;
        }
        if (crewFilter && l.crewId !== crewFilter) return false;
        if (typeFilter && l.type !== typeFilter) return false;
        if (statusFilter !== "all" && l.status !== statusFilter) return false;

        const today = new Date().toISOString().slice(0, 10);
        if (dateFilter === "upcoming" && l.toDate < today) return false;
        if (dateFilter === "past" && l.fromDate > today) return false;
        if (
          dateFilter === "current" &&
          (l.fromDate > today || l.toDate < today)
        )
          return false;

        return true;
      })
      .sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""));
  }, [leave, search, crewFilter, typeFilter, statusFilter, dateFilter]);

  /* ⭐ Stats */
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: leave.length,
      pending: leave.filter((l) => l.status === "pending").length,
      approved: leave.filter((l) => l.status === "approved").length,
      current: leave.filter(
        (l) =>
          l.fromDate <= today && l.toDate >= today && l.status === "approved"
      ).length,
      byType: Object.keys(LEAVE_TYPES).reduce((acc, k) => {
        acc[k] = leave.filter(
          (l) => l.type === k && l.status === "approved"
        ).length;
        return acc;
      }, {}),
    };
  }, [leave]);

  /* ⭐ CRUD */
  const openNew = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDraft({
      crewId: "",
      crewName: "",
      type: "ANNUAL",
      fromDate: today,
      toDate: today,
      days: 1,
      reason: "",
      status: "pending",
      requestedAt: new Date().toISOString(),
      approvedBy: "",
      approvedAt: "",
      notes: "",
    });
    setEditing("new");
  };

  const openEdit = (l) => {
    setDraft({ ...l });
    setEditing(l.id);
  };

  const save = async () => {
    if (!draft.crewId || !draft.fromDate || !draft.toDate) {
      showToast("Crew, dates are required");
      return;
    }

    const days = calcDays(draft.fromDate, draft.toDate);
    const finalDraft = { ...draft, days };

    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await leaveAPI.create(finalDraft);
        setLeave([...leave, { ...finalDraft, id: created.id }]);
      } else {
        await leaveAPI.update(editing, finalDraft);
        setLeave(
          leave.map((l) =>
            l.id === editing ? { ...finalDraft, id: editing } : l
          )
        );
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (!(await confirmAction(t.confirmDelete))) return;
    try {
      await leaveAPI.remove(id);
      setLeave(leave.filter((l) => l.id !== id));
    } catch (e) {
      showToast("Delete failed: " + e.message);
    }
  };

  /* ⭐ Approve / Reject */
  const approve = async (l) => {
    const updated = {
      ...l,
      status: "approved",
      approvedBy: currentUser?.fullName || "System",
      approvedAt: new Date().toISOString(),
    };
    setLeave(leave.map((x) => (x.id === l.id ? updated : x)));
    setSelectedLeave(null);
    try {
      await leaveAPI.update(l.id, updated);
    } catch (e) {
      showToast("Approval failed: " + e.message);
    }
  };

  const reject = async (l) => {
    const updated = {
      ...l,
      status: "rejected",
      approvedBy: currentUser?.fullName || "System",
      approvedAt: new Date().toISOString(),
    };
    setLeave(leave.map((x) => (x.id === l.id ? updated : x)));
    setSelectedLeave(null);
    try {
      await leaveAPI.update(l.id, updated);
    } catch (e) {
      showToast("Rejection failed: " + e.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🌴</span>
            </div>
            <div>
              <h2 className="text-xl font-bold">{t.leaveTitle}</h2>
              <div className="text-xs text-emerald-100">
                {stats.total} {t.total} · {stats.pending} {t.pending} ·{" "}
                {stats.current} {t.onLeaveNow}
              </div>
            </div>
          </div>

          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> {t.newLeaveRequest}
          </button>
        </div>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.total}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {stats.total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-amber-200 dark:border-amber-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.pending}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-sky-200 dark:border-sky-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.approved}
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {stats.approved}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.onLeaveNow}
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {stats.current}
          </div>
        </div>
      </div>

      {/* ═══ Type Breakdown ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
          {t.approvedByType}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LEAVE_TYPES).map(([k, v]) => (
            <div key={k} className={`rounded-lg border p-2 ${v.color} text-xs`}>
              <span className="mr-1">{v.icon}</span>
              <b>{stats.byType[k] || 0}</b>{" "}
              {lang === "ar" ? v.label_ar : v.label_en}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <select
          value={crewFilter}
          onChange={(e) => setCrewFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.allCrew}</option>
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all}</option>
          {Object.entries(LEAVE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.icon} {lang === "ar" ? v.label_ar : v.label_en}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="all">{t.allStatuses}</option>
          <option value="pending">{t.pending}</option>
          <option value="approved">{t.approved}</option>
          <option value="rejected">{t.rejected}</option>
          <option value="cancelled">{t.cancelled}</option>
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="upcoming">{t.standbyUpcoming}</option>
          <option value="current">{t.currentLeave}</option>
          <option value="past">{t.standbyPast}</option>
          <option value="all">{t.allTime}</option>
        </select>
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
              <tr>
                {[
                  t.crew,
                  t.leaveType,
                  t.fromDateLeave,
                  t.toDateLeave,
                  t.totalDays,
                  t.leaveReason,
                  t.status,
                  t.actions,
                ].map((h, idx) => (
                  <th
                    key={`${h}-${idx}`}
                    className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => {
                  const tp = LEAVE_TYPES[l.type] || LEAVE_TYPES.ANNUAL;
                  const st = LEAVE_STATUS[l.status] || LEAVE_STATUS.pending;
                  const today = new Date().toISOString().slice(0, 10);
                  const isCurrent =
                    l.fromDate <= today &&
                    l.toDate >= today &&
                    l.status === "approved";

                  return (
                    <tr
                      key={l.id}
                      className={`border-b border-slate-200 dark:border-slate-700 hover:bg-emerald-50/40 dark:hover:bg-slate-700/50 cursor-pointer ${
                        isCurrent
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                          : ""
                      }`}
                      onClick={() => setSelectedLeave(l)}
                    >
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                        {l.crewName}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${tp.color}`}
                        >
                          <span>{tp.icon}</span>
                          {lang === "ar" ? tp.label_ar : tp.label_en}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                        {fmtDate(l.fromDate)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                        {fmtDate(l.toDate)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-800 dark:text-slate-100">
                        {l.days}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">
                        {l.reason || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${st.color}`}
                        >
                          {lang === "ar" ? st.label_ar : st.label_en}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div
                          className="flex gap-1 justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {l.status === "pending" && (
                            <>
                              <button
                                onClick={() => approve(l)}
                                className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300"
                                title={t.approve}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => reject(l)}
                                className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                                title={t.reject}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openEdit(l)}
                            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(l.id)}
                            className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ DETAILS MODAL ═══ */}
      {selectedLeave && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLeave(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {t.leaveDetails}
              </h3>
              <button
                onClick={() => setSelectedLeave(null)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.crew}
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    {selectedLeave.crewName}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.leaveType}
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    {LEAVE_TYPES[selectedLeave.type]?.icon}{" "}
                    {lang === "ar"
                      ? LEAVE_TYPES[selectedLeave.type]?.label_ar
                      : LEAVE_TYPES[selectedLeave.type]?.label_en}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.fromDateLeave}
                  </div>
                  <div className="font-mono text-slate-800 dark:text-slate-100">
                    {fmtDate(selectedLeave.fromDate)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.toDateLeave}
                  </div>
                  <div className="font-mono text-slate-800 dark:text-slate-100">
                    {fmtDate(selectedLeave.toDate)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.totalDays}
                  </div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    {selectedLeave.days}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.status}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      LEAVE_STATUS[selectedLeave.status]?.color
                    }`}
                  >
                    {lang === "ar"
                      ? LEAVE_STATUS[selectedLeave.status]?.label_ar
                      : LEAVE_STATUS[selectedLeave.status]?.label_en}
                  </span>
                </div>
              </div>

              {selectedLeave.reason && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.leaveReason}
                  </div>
                  <div className="text-slate-800 dark:text-slate-100">
                    {selectedLeave.reason}
                  </div>
                </div>
              )}

              {selectedLeave.approvedBy && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    {t.approvedBy}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-100">
                    <b>{selectedLeave.approvedBy}</b> —{" "}
                    {new Date(selectedLeave.approvedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {selectedLeave.status === "pending" && (
                <>
                  <button
                    onClick={() => reject(selectedLeave)}
                    className="px-4 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> {t.reject}
                  </button>
                  <button
                    onClick={() => approve(selectedLeave)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> {t.approve}
                  </button>
                </>
              )}
              {selectedLeave.status !== "pending" && (
                <button
                  onClick={() => setSelectedLeave(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
                >
                  {t.close}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {editing === "new" ? t.newLeaveRequest : t.editLeaveRequest}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.crew} *
                </label>
                <select
                  value={draft.crewId || ""}
                  onChange={(e) => {
                    const c = crew.find((x) => x.id === e.target.value);
                    setDraft({
                      ...draft,
                      crewId: e.target.value,
                      crewName: c?.fullName || "",
                    });
                  }}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                >
                  <option value="">{t.selectCrew}</option>
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.empNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.leaveType} *
                </label>
                <select
                  value={draft.type || "ANNUAL"}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                >
                  {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.icon} {lang === "ar" ? v.label_ar : v.label_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {t.fromDateLeave} *
                  </label>
                  <input
                    type="date"
                    value={draft.fromDate || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, fromDate: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {t.toDateLeave} *
                  </label>
                  <input
                    type="date"
                    value={draft.toDate || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, toDate: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              {draft.fromDate && draft.toDate && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t.totalDays}:
                    </span>
                    <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      {calcDays(draft.fromDate, draft.toDate)} days
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.leaveReason}
                </label>
                <textarea
                  value={draft.reason || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, reason: e.target.value })
                  }
                  rows="2"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.status}
                </label>
                <select
                  value={draft.status || "pending"}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                >
                  <option value="pending">{t.pending}</option>
                  <option value="approved">{t.approved}</option>
                  <option value="rejected">{t.rejected}</option>
                  <option value="cancelled">{t.cancelled}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {editing !== "new" && (
                <button
                  onClick={() => {
                    remove(draft.id);
                    setEditing(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-sm"
                >
                  {t.delete}
                </button>
              )}
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1"
              >
                <Save className="w-4 h-4" /> {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveModule;
