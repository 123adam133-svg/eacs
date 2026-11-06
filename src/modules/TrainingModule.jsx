/* ═══════════════════════════════════════════════════════════
 * TRAINING MODULE — Crew Training Records & Dedicated Dashboard
 * Features:
 * 1. Dedicated Customizable Training Dashboard (Multi-Named + Drag & Drop + RBAC)
 * 2. Complete Crew Training Records, Qualifications & Expiry Tracking
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction, openPreviewModal } from "../utils/dialog";
import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  GraduationCap,
  Gauge,
  ClipboardList,
  Upload,
  Eye,
  Download,
  Loader2,
} from "lucide-react";
import { useT } from "../contexts";
import { useAuth } from "../contexts/AuthContext";
import {
  trainingAPI,
  uploadFile,
  toPreviewFileUrl,
  toDownloadFileUrl,
} from "../api";
import { can as checkPerm } from "../config/permissions";
import { fmtDate, daysUntil } from "../utils/helpers";
import { TRAINING_TYPES, TRAINING_RESULT } from "../config/constants";
import { EmbeddedSectionDashboard } from "../dashboard/EmbeddedSectionDashboard";

/* Expiry status evaluation */
const getExpiryStatus = (expiryDate) => {
  if (!expiryDate)
    return {
      status: "no-expiry",
      textClass: "text-slate-500 dark:text-slate-400",
      label: "No Expiry",
    };

  const daysLeft = daysUntil(expiryDate);

  if (daysLeft < 0)
    return {
      status: "expired",
      textClass: "text-rose-600 dark:text-rose-400 font-bold",
      label: "EXPIRED",
      daysLeft,
    };
  if (daysLeft < 30)
    return {
      status: "critical",
      textClass: "text-orange-600 dark:text-orange-400 font-bold",
      label: `${daysLeft}d left`,
      daysLeft,
    };
  if (daysLeft < 90)
    return {
      status: "warning",
      textClass: "text-amber-600 dark:text-amber-400 font-semibold",
      label: `${daysLeft}d left`,
      daysLeft,
    };
  return {
    status: "valid",
    textClass: "text-emerald-600 dark:text-emerald-400 font-semibold",
    label: "Valid",
    daysLeft,
  };
};

export function TrainingModule({
  crew = [],
  training = [],
  setTraining,
  flights = [],
  fleet = [],
  camoList = [],
  melList = [],
  users = [],
  roles = [],
  leave = [],
  roster = [],
  standby = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  user: propUser,
  lang: langProp,
  setSyncStatus,
}) {
  const t = useT();
  const { user: authUser } = useAuth();
  const activeUser = propUser || authUser;
  const lang =
    langProp ||
    (typeof document !== "undefined" ? document.documentElement.lang : "en") ||
    "en";
  const isAr = lang === "ar";

  const can = useCallback(
    (perm) => {
      if (!activeUser || !perm) return false;
      try {
        return checkPerm(activeUser, perm);
      } catch {
        return false;
      }
    },
    [activeUser]
  );

  const canViewDashboard =
    can("training.dashboard_view") || can("training.view");
  const canCreate = can("training.create") || can("training.edit");
  const canEdit = can("training.edit");
  const canDelete = can("training.delete");

  const [subView, setSubView] = useState(() =>
    canViewDashboard ? "dashboard" : "records"
  );

  const [search, setSearch] = useState("");
  const [crewFilter, setCrewFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [uploadingCert, setUploadingCert] = useState(false);
  const certFileRef = useRef(null);

  const handleCertUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingCert(true);
    try {
      const r = await uploadFile(f, "certificates");
      setDraft((prev) => ({ ...prev, certificate: r.fileUrl }));
      showToast(
        isAr
          ? "✅ تم رفع الشهادة إلى Google Drive بنجاح"
          : "✅ Certificate uploaded to Google Drive",
        "success"
      );
    } catch (err) {
      showToast(
        (isAr ? "❌ فشل رفع الشهادة: " : "❌ Upload failed: ") + err.message,
        "error"
      );
    } finally {
      setUploadingCert(false);
      e.target.value = "";
    }
  };

  /* Filtering */
  const filtered = useMemo(() => {
    return training
      .filter((tr) => {
        if (search) {
          const q = search.toLowerCase();
          if (
            !tr.crewName?.toLowerCase().includes(q) &&
            !tr.title?.toLowerCase().includes(q) &&
            !tr.instructor?.toLowerCase().includes(q) &&
            !tr.location?.toLowerCase().includes(q)
          )
            return false;
        }
        if (crewFilter && tr.crewId !== crewFilter) return false;
        if (typeFilter && tr.type !== typeFilter) return false;
        if (resultFilter && tr.result !== resultFilter) return false;

        if (expiryFilter !== "all") {
          const exp = getExpiryStatus(tr.expiryDate);
          if (expiryFilter === "expired" && exp.status !== "expired")
            return false;
          if (expiryFilter === "critical" && exp.status !== "critical")
            return false;
          if (expiryFilter === "warning" && exp.status !== "warning")
            return false;
          if (expiryFilter === "valid" && exp.status !== "valid") return false;
        }

        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [training, search, crewFilter, typeFilter, resultFilter, expiryFilter]);

  /* Stats */
  const stats = useMemo(() => {
    const s = {
      total: training.length,
      passed: training.filter((tr) => tr.result === "PASS").length,
      failed: training.filter((tr) => tr.result === "FAIL").length,
      expired: training.filter(
        (tr) => getExpiryStatus(tr.expiryDate).status === "expired"
      ).length,
      critical: training.filter(
        (tr) => getExpiryStatus(tr.expiryDate).status === "critical"
      ).length,
      byType: {},
    };
    Object.keys(TRAINING_TYPES).forEach((k) => {
      s.byType[k] = training.filter((tr) => tr.type === k).length;
    });
    return s;
  }, [training]);

  /* Crew Summary */
  const crewSummary = useMemo(() => {
    const summary = {};
    crew.forEach((c) => {
      const myTraining = training.filter((tr) => tr.crewId === c.id);
      const expired = myTraining.filter(
        (tr) => getExpiryStatus(tr.expiryDate).status === "expired"
      ).length;
      const critical = myTraining.filter(
        (tr) => getExpiryStatus(tr.expiryDate).status === "critical"
      ).length;
      summary[c.id] = { total: myTraining.length, expired, critical };
    });
    return summary;
  }, [crew, training]);

  /* CRUD */
  const openNew = () => {
    if (!canCreate) return;
    setDraft({
      crewId: "",
      crewName: "",
      type: "SIMULATOR",
      title: "",
      date: new Date().toISOString().slice(0, 10),
      expiryDate: "",
      instructor: "",
      location: "",
      result: "PASS",
      score: "",
      notes: "",
      certificate: "",
    });
    setEditing("new");
  };

  const openEdit = (tr) => {
    if (!canEdit) return;
    setDraft({ ...tr });
    setEditing(tr.id);
  };

  const save = async () => {
    if (!draft.crewId || !draft.date) {
      showToast(
        isAr ? "يرجى اختيار الطاقم والتاريخ" : "Crew and date are required",
        "warning"
      );
      return;
    }
    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await trainingAPI.create(draft);
        setTraining([...training, { ...draft, id: created.id }]);
      } else {
        await trainingAPI.update(editing, draft);
        setTraining(
          training.map((tr) =>
            tr.id === editing ? { ...draft, id: editing } : tr
          )
        );
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (!canDelete) return;
    if (!(await confirmAction(t.confirmDelete))) return;
    try {
      await trainingAPI.remove(id);
      setTraining(training.filter((tr) => tr.id !== id));
    } catch (e) {
      showToast("Delete failed: " + e.message, "error");
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Header + Sub-Section Switcher ═══ */}
      <div
        className="rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: "var(--brand-gradient)" }}
          >
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-lg sm:text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {t.trainingTitle || (isAr ? "إدارة التدريب والتأهيل" : "Crew Training & Qualifications")}
            </h2>
            <p className="text-xs font-mono tabular-nums mt-0.5" style={{ color: "var(--text-muted)" }}>
              {stats.total} {t.totalRecords} · {stats.passed} {t.passed} ·{" "}
              {stats.expired} {t.expired}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center rounded-lg p-1 text-xs gap-1"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            {canViewDashboard && (
              <button
                type="button"
                onClick={() => setSubView("dashboard")}
                className="px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                style={
                  subView === "dashboard"
                    ? {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--brand-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                <Gauge className="w-3.5 h-3.5" />
                {isAr ? "داشبورد التدريب" : "Training Dashboard"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubView("records")}
              className="px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
              style={
                subView === "records"
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--brand-primary)",
                      boxShadow: "var(--shadow-sm)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              <ClipboardList className="w-3.5 h-3.5" />
              {isAr ? "سجلات التدريب والتأهيل" : "Training Records"}
              <span className="font-mono tabular-nums text-[10px] opacity-80">
                ({stats.total})
              </span>
            </button>
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setSubView("records");
                openNew();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Plus className="w-4 h-4" /> {t.newTraining}
            </button>
          )}
        </div>
      </div>

      {/* ═══ SUB-VIEW 1: Dedicated Customizable Training Dashboard ═══ */}
      {subView === "dashboard" && canViewDashboard ? (
        <EmbeddedSectionDashboard
          scope="training"
          defaultPresetKey="training"
          flights={flights}
          crew={crew}
          fleet={fleet}
          camoList={camoList}
          melList={melList}
          users={users}
          roles={roles}
          leave={leave}
          roster={roster}
          standby={standby}
          training={training}
          auditLogs={auditLogs}
          loginHistory={loginHistory}
          settings={settings}
          syncStatus={syncStatus}
          onRefresh={onRefresh}
          setTab={setTab}
          lang={lang}
        />
      ) : (
        /* ═══ SUB-VIEW 2: Training Records & Crew Qualifications ═══ */
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              {
                label: t.totalRecords,
                val: stats.total,
                tone: "var(--brand-primary)",
              },
              {
                label: t.passed,
                val: stats.passed,
                tone: "#16A34A",
              },
              {
                label: t.failed,
                val: stats.failed,
                tone: stats.failed > 0 ? "#DC2626" : "var(--text-muted)",
              },
              {
                label: t.criticalTraining,
                val: stats.critical,
                tone: stats.critical > 0 ? "#D97706" : "var(--text-muted)",
              },
              {
                label: t.expiredTraining,
                val: stats.expired,
                tone: stats.expired > 0 ? "#DC2626" : "#16A34A",
              },
            ].map((k, idx) => (
              <div
                key={idx}
                className="rounded-xl p-3.5"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  className="text-2xl font-bold font-mono tabular-nums"
                  style={{ color: k.tone }}
                >
                  {k.val}
                </div>
                <div
                  className="text-xs font-medium mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  {k.label}
                </div>
              </div>
            ))}
          </div>

          {/* Crew Qualification Summary */}
          <div
            className="rounded-xl p-3.5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div
                className="text-xs font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {t.trainingStatus}
              </div>
              {crewFilter && (
                <button
                  type="button"
                  onClick={() => setCrewFilter("")}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: "var(--brand-primary)" }}
                >
                  {isAr ? "عرض كل الطاقم" : "Show all crew"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-auto">
              {crew.map((c) => {
                const s = crewSummary[c.id] || {
                  total: 0,
                  expired: 0,
                  critical: 0,
                };
                const hasIssue = s.expired > 0 || s.critical > 0;
                const active = crewFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCrewFilter((prev) => (prev === c.id ? "" : c.id))
                    }
                    className="text-start p-2.5 rounded-lg text-xs transition hover:opacity-90"
                    style={{
                      backgroundColor: active
                        ? "var(--bg-app)"
                        : hasIssue
                        ? "rgba(220, 38, 38, 0.06)"
                        : "var(--bg-app)",
                      border: active
                        ? "1.5px solid var(--brand-primary)"
                        : hasIssue
                        ? "1px solid rgba(220, 38, 38, 0.35)"
                        : "1px solid var(--border-default)",
                    }}
                  >
                    <div
                      className="font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {c.fullName}
                    </div>
                    <div
                      className="text-[11px] font-mono tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{c.empNo || "—"}</span>
                      <span>·</span>
                      <span>
                        {s.total} {isAr ? "سجل" : "rec"}
                      </span>
                      {s.expired > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {s.expired} {isAr ? "منتهي" : "exp"}
                          </span>
                        </>
                      )}
                      {s.critical > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">
                            {s.critical} {isAr ? "حرج" : "crit"}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div
            className="rounded-xl p-3 flex flex-wrap gap-2 items-center"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className="w-full ps-9 pe-3 py-2 rounded-lg text-xs outline-none"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <select
              value={crewFilter}
              onChange={(e) => setCrewFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
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
              className="px-3 py-2 rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">{t.all}</option>
              {Object.entries(TRAINING_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {isAr ? v.label_ar : v.label_en}
                </option>
              ))}
            </select>

            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">{t.all}</option>
              <option value="PASS">{t.pass}</option>
              <option value="FAIL">{t.fail}</option>
              <option value="PENDING">{t.pending}</option>
            </select>

            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="all">{t.all}</option>
              <option value="valid">{t.valid}</option>
              <option value="warning">{t.warning}</option>
              <option value="critical">{t.critical}</option>
              <option value="expired">{t.expired}</option>
            </select>
          </div>

          {/* Table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderBottom: "1px solid var(--border-default)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {[
                      t.date,
                      t.crew,
                      t.trainingType,
                      t.trainingTitleField,
                      t.instructor,
                      t.result,
                      t.trainingExpiry,
                      ...(canEdit || canDelete ? [t.actions] : []),
                    ].map((h, idx) => (
                      <th
                        key={`${h}-${idx}`}
                        className="px-3 py-2.5 text-start font-bold whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canEdit || canDelete ? 8 : 7}
                        className="p-10 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t.noData}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((tr) => {
                      const type =
                        TRAINING_TYPES[tr.type] || TRAINING_TYPES.SIMULATOR;
                      const result =
                        TRAINING_RESULT[tr.result] || TRAINING_RESULT.PENDING;
                      const expiry = getExpiryStatus(tr.expiryDate);

                      return (
                        <tr
                          key={tr.id}
                          className="hover:bg-slate-500/5 transition"
                        >
                          <td
                            className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {fmtDate(tr.date)}
                          </td>
                          <td
                            className="px-3 py-2.5 font-bold whitespace-nowrap"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {tr.crewName}
                          </td>
                          <td
                            className="px-3 py-2.5 font-medium whitespace-nowrap"
                            style={{ color: "var(--brand-primary)" }}
                          >
                            {isAr ? type.label_ar : type.label_en}
                          </td>
                          <td
                            className="px-3 py-2.5 truncate max-w-[220px]"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {tr.title || "—"}
                          </td>
                          <td
                            className="px-3 py-2.5 truncate max-w-[140px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {tr.instructor || "—"}
                          </td>
                          <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                            <span
                              className={
                                tr.result === "PASS"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : tr.result === "FAIL"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }
                            >
                              {isAr ? result.label_ar : result.label_en}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                            {tr.expiryDate ? (
                              <span className={expiry.textClass}>
                                {fmtDate(tr.expiryDate)} · {expiry.label}
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>
                                —
                              </span>
                            )}
                          </td>
                          {(canEdit || canDelete) && (
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex gap-1">
                                {tr.certificate &&
                                  (/^https?:\/\//i.test(tr.certificate) ||
                                    String(tr.certificate).startsWith("/api/")) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPreviewModal({
                                          title: `${tr.crewName || ""} — ${
                                            tr.title || t.certificate
                                          }`,
                                          blobUrl: toPreviewFileUrl(
                                            tr.certificate,
                                            `${tr.title || "certificate"}.pdf`
                                          ),
                                          fileName: `${
                                            tr.title || "certificate"
                                          }.pdf`,
                                        })
                                      }
                                      className="p-1.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400"
                                      title={isAr ? "معاينة الشهادة" : "Preview Certificate"}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(tr)}
                                    className="p-1.5 rounded hover:opacity-80"
                                    style={{
                                      backgroundColor: "var(--bg-app)",
                                      color: "var(--text-primary)",
                                    }}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => remove(tr.id)}
                                    className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="rounded-xl max-w-lg w-full p-5 max-h-[90vh] overflow-auto shadow-2xl border"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">
                {editing === "new" ? t.newTraining : t.editTraining}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg"
                style={{
                  backgroundColor: "var(--bg-app)",
                  color: "var(--text-muted)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">{t.crew} *</label>
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
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">{t.selectCrew}</option>
                  {crew.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.empNo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">
                    {t.trainingType} *
                  </label>
                  <select
                    value={draft.type || "SIMULATOR"}
                    onChange={(e) =>
                      setDraft({ ...draft, type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {Object.entries(TRAINING_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {isAr ? v.label_ar : v.label_en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">{t.result}</label>
                  <select
                    value={draft.result || "PASS"}
                    onChange={(e) =>
                      setDraft({ ...draft, result: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="PASS">{t.pass}</option>
                    <option value="FAIL">{t.fail}</option>
                    <option value="PENDING">{t.pending}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  {t.trainingTitleField}
                </label>
                <input
                  value={draft.title || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                  placeholder="e.g. A320 Type Rating Renewal"
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{t.date} *</label>
                  <input
                    type="date"
                    value={draft.date || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg font-mono outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">
                    {t.trainingExpiry}
                  </label>
                  <input
                    type="date"
                    value={draft.expiryDate || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, expiryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg font-mono outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{t.instructor}</label>
                  <input
                    value={draft.instructor || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, instructor: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">{t.location}</label>
                  <input
                    value={draft.location || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, location: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">{t.score}</label>
                  <input
                    value={draft.score || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, score: e.target.value })
                    }
                    placeholder="e.g. 95/100"
                    className="w-full px-3 py-2 rounded-lg font-mono outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">
                    {t.certificate}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft.certificate || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, certificate: e.target.value })
                      }
                      placeholder={isAr ? "رقم أو رابط الشهادة..." : "Cert # or Drive link..."}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg outline-none"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <input
                      ref={certFileRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleCertUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingCert}
                      onClick={() => certFileRef.current?.click()}
                      className="px-2.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-1 shrink-0 disabled:opacity-50"
                      title={isAr ? "رفع الشهادة إلى Google Drive" : "Upload Certificate to Google Drive"}
                    >
                      {uploadingCert ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {draft.certificate &&
                      (/^https?:\/\//i.test(draft.certificate) ||
                        String(draft.certificate).startsWith("/api/")) && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openPreviewModal({
                                title: draft.title || t.certificate,
                                blobUrl: toPreviewFileUrl(
                                  draft.certificate,
                                  `${draft.title || "certificate"}.pdf`
                                ),
                                fileName: `${draft.title || "certificate"}.pdf`,
                              })
                            }
                            className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
                            title={isAr ? "معاينة" : "Preview"}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={toDownloadFileUrl(
                              draft.certificate,
                              `${draft.title || "certificate"}.pdf`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            download={`${draft.title || "certificate"}.pdf`}
                            className="p-2 rounded-lg bg-emerald-600 text-white shrink-0"
                            title={isAr ? "تحميل" : "Download"}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">{t.notes}</label>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div
              className="flex justify-end gap-2 mt-4 pt-4"
              style={{ borderTop: "1px solid var(--border-default)" }}
            >
              {editing !== "new" && canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    remove(draft.id);
                    setEditing(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold whitespace-nowrap shrink-0"
                >
                  {t.delete}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-2 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
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

export default TrainingModule;
