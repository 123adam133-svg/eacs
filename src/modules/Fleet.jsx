/* ═══════════════════════════════════════════════════════════
 * FLEET MODULE — Bidirectional Sync with CAMO + Two-Way Docs Editing
 * v5.0 — مربوط بالكامل مع CAMO ذهاباً وإياباً (الطائرات + المستندات + الشهادات)
 * ═══════════════════════════════════════════════════════════ */
import {
  showToast,
  confirmAction,
  openPreviewModal,
} from "../utils/dialog";
import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Plane,
  Save,
  Paperclip,
  Eye,
  FileDown,
  Check,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { AircraftStatusBadge } from "../components/ui/AircraftStatusBadge";
import { AttachmentsEditor } from "../components/AttachmentsEditor";
import { logSafe } from "../utils/audit";
import {
  fmtDate,
  docStatus,
  daysUntil,
  formatFileSize,
  getStatusColor,
} from "../utils/helpers";
import {
  parseDocsList,
  normalizeReg,
  saveAircraftFromFleet,
  saveAircraftDocsBothWays,
  deleteAircraftBothWays,
  syncAllFleetAndCamo,
} from "../utils/fleetCamoSync";
import { AIRCRAFT_STATUSES } from "../config/constants";
import { can as checkPerm } from "../config/permissions";
import { useLocalStorage } from "../hooks/useLocalStorage";

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

const innerBoxStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

export function Fleet({
  fleet = [],
  rawFleet,
  setFleet,
  camoList = [],
  setCamoList,
  melList = [],
  lang = "en",
  setSyncStatus,
}) {
  const t = useT();
  const { user } = useAuth();

  const canCreate =
    checkPerm(user, "fleet.create") || checkPerm(user, "camo.edit");
  const canEdit =
    checkPerm(user, "fleet.edit") || checkPerm(user, "camo.edit");
  const canDelete =
    checkPerm(user, "fleet.delete") || checkPerm(user, "camo.edit");
  const canDocsView =
    checkPerm(user, "fleet.docs") || checkPerm(user, "camo.view");
  const canDocsEdit =
    checkPerm(user, "fleet.docs_edit") || checkPerm(user, "camo.edit");
  const canDocsDownload =
    checkPerm(user, "fleet.docs_download") || checkPerm(user, "camo.view");

  const [editing, setEditing] = useState(null);
  const [beforeEditReg, setBeforeEditReg] = useState("");
  const [draft, setDraft] = useState({});
  const [savingAcft, setSavingAcft] = useState(false);

  const [docsAcft, setDocsAcft] = useState(null);
  const [docsDraft, setDocsDraft] = useState([]);
  const [certDatesDraft, setCertDatesDraft] = useState({
    coaExpiry: "",
    insuranceExpiry: "",
    noiseCertExpiry: "",
  });
  const [docsSaving, setDocsSaving] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);

  const [viewMode, setViewMode] = useLocalStorage("aeroops.fleetView", "cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const sourceFleet = rawFleet || fleet;

  const filteredFleet = fleet.filter((a) => {
    const matchesSearch =
      !search ||
      `${a.reg || ""} ${a.type || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesStatus = !statusFilter || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleManualSync = async () => {
    setSyncingBoth(true);
    setSyncStatus?.("syncing");
    try {
      await syncAllFleetAndCamo({
        fleet: sourceFleet,
        setFleet,
        camoList,
        setCamoList,
        userName: user?.fullName || "",
      });
      setSyncStatus?.("synced");
      showToast("✅ تمت مزامنة جميع الطائرات والمستندات بين الأسطول و CAMO", "success");
    } catch (e) {
      setSyncStatus?.("error");
      showToast("❌ فشلت المزامنة: " + e.message, "error");
    } finally {
      setSyncingBoth(false);
    }
  };

  const openNew = () => {
    if (!canCreate) return;
    setBeforeEditReg("");
    setDraft({
      reg: "",
      type: "",
      status: "AIRWORTHY",
      tah: 0,
      tac: 0,
      lastCheck: "",
      nextCheck: "",
      coaExpiry: "",
      insuranceExpiry: "",
      noiseCertExpiry: "",
      attachments: [],
    });
    setEditing("new");
  };

  const openEdit = (a) => {
    if (!canEdit) {
      showToast("⚠️ ليس لديك صلاحية تعديل", "warning");
      return;
    }
    setBeforeEditReg(a.reg || "");
    setDraft({
      ...a,
      lastCheck: a.lastCheck ? String(a.lastCheck).slice(0, 10) : "",
      nextCheck: a.nextCheck ? String(a.nextCheck).slice(0, 10) : "",
      coaExpiry: a.coaExpiry ? String(a.coaExpiry).slice(0, 10) : "",
      insuranceExpiry: a.insuranceExpiry
        ? String(a.insuranceExpiry).slice(0, 10)
        : "",
      noiseCertExpiry: a.noiseCertExpiry
        ? String(a.noiseCertExpiry).slice(0, 10)
        : "",
    });
    setEditing(a.id);
  };

  const save = async () => {
    if (editing === "new" && !canCreate) {
      showToast("⚠️ ليس لديك صلاحية إضافة", "warning");
      return;
    }
    if (editing !== "new" && !canEdit) {
      showToast("⚠️ ليس لديك صلاحية تعديل", "warning");
      return;
    }
    if (!draft.reg) {
      showToast("⚠️ يرجى إدخال تسجيل الطائرة (Registration)", "warning");
      return;
    }
    setSavingAcft(true);
    setSyncStatus?.("syncing");
    try {
      const { fleetItem } = await saveAircraftFromFleet({
        draft,
        isNew: editing === "new",
        beforeReg: beforeEditReg,
        fleet: sourceFleet,
        setFleet,
        camoList,
        setCamoList,
        userName: user?.fullName || "",
      });

      logSafe(
        user,
        editing === "new" ? "CREATE" : "UPDATE",
        "Fleet+CAMO",
        fleetItem.id,
        fleetItem.reg,
        { reg: fleetItem.reg, type: fleetItem.type, status: fleetItem.status }
      );

      setEditing(null);
      setSyncStatus?.("synced");
      showToast("✅ تم الحفظ والمزامنة تلقائياً مع CAMO", "success");
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
      setSyncStatus?.("error");
    } finally {
      setSavingAcft(false);
    }
  };

  const remove = async (acft) => {
    if (!canDelete) {
      showToast("⚠️ ليس لديك صلاحية حذف", "warning");
      return;
    }
    if (
      !(await confirmAction(
        `${t.confirmDelete || "حذف هذه الطائرة"} (${acft.reg}) من الأسطول و CAMO؟`
      ))
    )
      return;
    setSyncStatus?.("syncing");
    try {
      await deleteAircraftBothWays({
        reg: acft.reg,
        fleet: sourceFleet,
        setFleet,
        camoList,
        setCamoList,
      });
      logSafe(user, "DELETE", "Fleet+CAMO", acft.id, acft.reg || "", {});
      setSyncStatus?.("synced");
      showToast("✅ تم حذف الطائرة من الأسطول و CAMO", "success");
    } catch (e) {
      setSyncStatus?.("error");
      showToast("Delete failed: " + e.message, "error");
    }
  };

  const openDocs = (a) => {
    if (!canDocsView) {
      showToast("⚠️ ليس لديك صلاحية عرض المستندات", "warning");
      return;
    }
    setDocsAcft(a);
    setDocsDraft(parseDocsList(a.attachments));
    setCertDatesDraft({
      coaExpiry: a.coaExpiry ? String(a.coaExpiry).slice(0, 10) : "",
      insuranceExpiry: a.insuranceExpiry
        ? String(a.insuranceExpiry).slice(0, 10)
        : "",
      noiseCertExpiry: a.noiseCertExpiry
        ? String(a.noiseCertExpiry).slice(0, 10)
        : "",
    });
  };

  const saveDocs = async () => {
    if (!canDocsEdit) {
      showToast("⚠️ ليس لديك صلاحية تعديل المستندات", "warning");
      return;
    }
    if (!docsAcft) return;
    setDocsSaving(true);
    setSyncStatus?.("syncing");
    try {
      await saveAircraftDocsBothWays({
        reg: docsAcft.reg,
        docs: docsDraft,
        certDates: certDatesDraft,
        fleet: sourceFleet,
        setFleet,
        camoList,
        setCamoList,
        userName: user?.fullName || "",
      });

      logSafe(
        user,
        "UPDATE",
        "Fleet+CAMO (Documents)",
        docsAcft.id,
        docsAcft.reg,
        { count: docsDraft.length }
      );
      setDocsAcft(null);
      setDocsDraft([]);
      setSyncStatus?.("synced");
      showToast(
        "✅ تم حفظ المستندات والشهادات ومزامنتها مع CAMO بنجاح",
        "success"
      );
    } catch (e) {
      setSyncStatus?.("error");
      showToast("Save failed: " + e.message, "error");
    } finally {
      setDocsSaving(false);
    }
  };

  const hasAnyAction = canEdit || canDocsView || canDelete || canCreate;

  const certBadgeColor = (dateStr) => {
    if (!dateStr) return "var(--text-muted)";
    const d = daysUntil(dateStr);
    if (d === null) return "var(--text-muted)";
    if (d < 0) return "#ef4444";
    if (d <= 30) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Toolbar ═══ */}
      <div className="rounded-xl p-3 space-y-3" style={cardStyle}>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Plane className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>{t.fleet}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                  ⇄ CAMO Linked
                </span>
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {fleet.length} {t.aircraft || "aircraft"} · مرتبط ثنائياً مع إدارة الصلاحية (CAMO)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(canEdit || canDocsEdit) && (
              <button
                onClick={handleManualSync}
                disabled={syncingBoth}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
                title="مزامنة شاملة لجميع سجلات ومستندات الطائرات بين Fleet و CAMO"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncingBoth ? "animate-spin" : ""}`}
                />
                {lang === "ar" ? "مزامنة Fleet ↔ CAMO" : "Sync Fleet ↔ CAMO"}
              </button>
            )}
            {canCreate && (
              <button
                onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:-translate-y-0.5"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <Plus className="w-4 h-4" /> {t.addAircraft}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
              style={{ color: "var(--text-muted)" }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="ps-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-auto"
          >
            <option value="">{t.allStatuses}</option>
            {AIRCRAFT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {lang === "ar" ? s.ar : s.en}
              </option>
            ))}
          </Select>
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border-default)" }}
          >
            {[
              { id: "cards", l: "⊞" },
              { id: "table", l: "☰" },
              { id: "list", l: "≡" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className="px-3 py-1.5 text-sm font-bold transition"
                style={
                  viewMode === v.id
                    ? {
                        background: "var(--brand-gradient)",
                        color: "white",
                      }
                    : {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {v.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasAnyAction && (
        <div className="p-3 rounded-lg text-xs flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-500">
          <Eye className="w-4 h-4" /> لديك صلاحية العرض فقط — لا يمكنك تعديل أو إضافة أو حذف
        </div>
      )}

      {/* ═══ CARDS VIEW ═══ */}
      {viewMode === "cards" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFleet.map((a) => {
            const docs = parseDocsList(a.attachments);
            const openMelCount = (melList || []).filter(
              (m) =>
                normalizeReg(m.reg) === normalizeReg(a.reg) &&
                m.status === "OPEN"
            ).length;

            return (
              <div
                key={a.id}
                className="rounded-xl p-4 space-y-3 transition theme-transition"
                style={cardStyle}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div
                      className="font-bold text-lg font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.reg}
                    </div>
                    <div
                      className="text-sm flex items-center gap-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{a.type || "—"}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" /> CAMO
                      </span>
                    </div>
                  </div>
                  <AircraftStatusBadge status={a.status} lang={lang} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { l: t.tah || "TAH", v: a.tah?.toLocaleString() },
                    { l: t.tac || "TAC", v: a.tac?.toLocaleString() },
                    { l: t.lastCheck || "Last Check", v: fmtDate(a.lastCheck) },
                    { l: t.nextCheck || "Next Check", v: fmtDate(a.nextCheck) },
                  ].map((it, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded"
                      style={innerBoxStyle}
                    >
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {it.l}
                      </div>
                      <div
                        className="font-semibold font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {it.v || "—"}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CAMO Certificates Quick Summary */}
                {(a.coaExpiry || a.insuranceExpiry || a.noiseCertExpiry) && (
                  <div
                    className="p-2 rounded text-[11px] flex flex-wrap items-center justify-between gap-2"
                    style={innerBoxStyle}
                  >
                    <span>
                      COA:{" "}
                      <b
                        className="font-mono"
                        style={{ color: certBadgeColor(a.coaExpiry) }}
                      >
                        {fmtDate(a.coaExpiry) || "—"}
                      </b>
                    </span>
                    <span>
                      Ins:{" "}
                      <b
                        className="font-mono"
                        style={{ color: certBadgeColor(a.insuranceExpiry) }}
                      >
                        {fmtDate(a.insuranceExpiry) || "—"}
                      </b>
                    </span>
                    <span>
                      Noise:{" "}
                      <b
                        className="font-mono"
                        style={{ color: certBadgeColor(a.noiseCertExpiry) }}
                      >
                        {fmtDate(a.noiseCertExpiry) || "—"}
                      </b>
                    </span>
                  </div>
                )}

                {openMelCount > 0 && (
                  <div className="p-2 rounded text-xs bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{openMelCount} MEL مفتوح في CAMO</span>
                  </div>
                )}

                {hasAnyAction && (
                  <div
                    className="flex gap-2 pt-2"
                    style={{ borderTop: "1px solid var(--border-default)" }}
                  >
                    {canEdit && (
                      <button
                        onClick={() => openEdit(a)}
                        className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-xs flex items-center justify-center gap-1 font-bold transition"
                      >
                        <Edit className="w-3.5 h-3.5" /> {t.edit || "تعديل"}
                      </button>
                    )}
                    {canDocsView && (
                      <button
                        onClick={() => openDocs(a)}
                        className="relative flex-1 py-2 rounded-lg bg-purple-500/15 text-purple-500 hover:bg-purple-500/25 text-xs flex items-center justify-center gap-1 font-bold transition"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {t.attachments || "مستندات"}
                        {docs.length > 0 && (
                          <span className="ms-1 bg-purple-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2">
                            {docs.length}
                          </span>
                        )}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(a)}
                        className="py-2 px-3 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 text-xs transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl" style={cardStyle}>
          <table className="w-full text-sm">
            <thead
              style={{
                backgroundColor: "var(--bg-app)",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <tr>
                {[
                  "#",
                  t.registration,
                  t.type,
                  t.status,
                  t.tah,
                  t.tac,
                  t.lastCheck,
                  t.nextCheck,
                  "COA Expiry",
                  "Docs",
                  ...(hasAnyAction ? [t.actions] : []),
                ].map((h, idx) => (
                  <th
                    key={`${h}-${idx}`}
                    className="px-3 py-3 text-start font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFleet.map((a, idx) => {
                const docs = parseDocsList(a.attachments);
                return (
                  <tr
                    key={a.id}
                    style={{
                      borderTop: "1px solid var(--border-default)",
                    }}
                  >
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      className="px-3 py-2 font-bold font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.reg}
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.type}
                    </td>
                    <td className="px-3 py-2">
                      <AircraftStatusBadge status={a.status} lang={lang} />
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.tah?.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.tac?.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {fmtDate(a.lastCheck)}
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {fmtDate(a.nextCheck)}
                    </td>
                    <td
                      className="px-3 py-2 text-xs font-mono"
                      style={{ color: certBadgeColor(a.coaExpiry) }}
                    >
                      {fmtDate(a.coaExpiry) || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canDocsView ? (
                        <button
                          onClick={() => openDocs(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-purple-500/15 text-purple-500 hover:bg-purple-500/25 text-xs font-bold transition"
                        >
                          <Paperclip className="w-3 h-3" /> {docs.length}
                        </button>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {docs.length}
                        </span>
                      )}
                    </td>
                    {hasAnyAction && (
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(a)}
                              className="p-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/25 transition"
                              title={t.edit}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => remove(a)}
                              className="p-1.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/25 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ LIST VIEW ═══ */}
      {viewMode === "list" && (
        <div
          className="rounded-xl divide-y"
          style={{ ...cardStyle, borderColor: "var(--border-default)" }}
        >
          {filteredFleet.map((a) => {
            const docs = parseDocsList(a.attachments);
            return (
              <div
                key={a.id}
                className="p-4 flex flex-wrap items-center gap-4 transition"
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plane className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold font-mono"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {a.reg}{" "}
                    <span
                      className="text-sm font-normal"
                      style={{ color: "var(--text-muted)" }}
                    >
                      ({a.type})
                    </span>
                  </div>
                  <div
                    className="text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    TAH: {a.tah?.toLocaleString()} · TAC:{" "}
                    {a.tac?.toLocaleString()}
                    {a.coaExpiry ? ` · COA: ${fmtDate(a.coaExpiry)}` : ""}
                  </div>
                </div>
                <AircraftStatusBadge status={a.status} lang={lang} />
                {canDocsView && (
                  <button
                    onClick={() => openDocs(a)}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-500 hover:bg-purple-500/25 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Paperclip className="w-3 h-3" /> {docs.length}
                  </button>
                )}
                {hasAnyAction && (
                  <div className="flex gap-1">
                    {canEdit && (
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/25 transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(a)}
                        className="p-1.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/25 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ADD / EDIT AIRCRAFT MODAL ═══ */}
      <Modal
        open={!!editing}
        title={editing === "new" ? t.addAircraft : t.editAircraft}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={save}
              disabled={savingAcft}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
              style={{
                background: "var(--brand-gradient)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Save className="w-4 h-4" /> {savingAcft ? "..." : t.save}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            ⇄ يتم تحديث بيانات الطائرة وشهاداتها تلقائياً في كلٍّ من Fleet و CAMO.
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label={t.registration}>
              <Input
                value={draft.reg || ""}
                onChange={(e) =>
                  setDraft({ ...draft, reg: e.target.value.toUpperCase() })
                }
                placeholder="5A-..."
                className="font-mono"
              />
            </Field>
            <Field label={t.type}>
              <Input
                value={draft.type || ""}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                placeholder="CRJ-900 / Falcon 900 / B737..."
              />
            </Field>
            <Field label={t.status} span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {AIRCRAFT_STATUSES.map((s) => {
                  const active = draft.status === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setDraft({ ...draft, status: s.key })}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-start transition"
                      style={{
                        backgroundColor: active
                          ? "var(--bg-app)"
                          : "var(--bg-card)",
                        borderColor: active
                          ? "var(--brand-primary)"
                          : "var(--border-default)",
                        boxShadow: active
                          ? `0 0 0 2px var(--brand-accent)`
                          : "none",
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: s.dot }}
                      />
                      <span
                        className="flex-1 truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {lang === "ar" ? s.ar : s.en}
                      </span>
                      {active && (
                        <Check
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--brand-primary)" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t.tah}>
              <Input
                type="number"
                value={draft.tah || 0}
                onChange={(e) => setDraft({ ...draft, tah: +e.target.value })}
              />
            </Field>
            <Field label={t.tac}>
              <Input
                type="number"
                value={draft.tac || 0}
                onChange={(e) => setDraft({ ...draft, tac: +e.target.value })}
              />
            </Field>
            <Field label={t.lastCheck}>
              <Input
                type="date"
                value={draft.lastCheck || ""}
                onChange={(e) =>
                  setDraft({ ...draft, lastCheck: e.target.value })
                }
              />
            </Field>
            <Field label={t.nextCheck}>
              <Input
                type="date"
                value={draft.nextCheck || ""}
                onChange={(e) =>
                  setDraft({ ...draft, nextCheck: e.target.value })
                }
              />
            </Field>
          </div>

          <div
            className="pt-3 border-t"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div
              className="text-xs font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              تواريخ الشهادات الرسمية (مشتركة مع CAMO)
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="COA Expiry (شهادة الصلاحية)">
                <Input
                  type="date"
                  value={draft.coaExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, coaExpiry: e.target.value })
                  }
                />
              </Field>
              <Field label="Insurance Expiry (التأمين)">
                <Input
                  type="date"
                  value={draft.insuranceExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, insuranceExpiry: e.target.value })
                  }
                />
              </Field>
              <Field label="Noise Cert Expiry (شهادة الضوضاء)">
                <Input
                  type="date"
                  value={draft.noiseCertExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, noiseCertExpiry: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══ TWO-WAY DOCS MODAL (FLEET ↔ CAMO) ═══ */}
      {docsAcft && (
        <Modal
          open={!!docsAcft}
          title={`📎 ${t.aircraftDocs || "مستندات وشهادات الطائرة"} — ${docsAcft.reg} (Fleet ⇄ CAMO)`}
          onClose={() => {
            setDocsAcft(null);
            setDocsDraft([]);
          }}
          wide
          footer={
            <>
              <button
                onClick={() => {
                  setDocsAcft(null);
                  setDocsDraft([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {t.cancel || "إغلاق"}
              </button>
              {canDocsEdit && (
                <button
                  onClick={saveDocs}
                  disabled={docsSaving}
                  className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
                  style={{
                    background: "var(--brand-gradient)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <Save className="w-4 h-4" />
                  {docsSaving
                    ? "جاري الحفظ والمزامنة…"
                    : "حفظ ومزامنة مع CAMO"}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div
              className="p-3 rounded-lg flex flex-wrap items-center gap-3"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
              }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plane className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {docsAcft.reg} · {docsAcft.type}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ⇄ ربط ثنائي الاتجاه مع CAMO — أي تعديل هنا ينعكس فوراً في CAMO والعكس
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-500 text-xs font-bold">
                {docsDraft.length} {t.attachments || "مستندات"}
              </span>
            </div>

            {/* Statutory Certificate Expiry Dates */}
            <div className="p-3 rounded-xl border space-y-2.5" style={innerBoxStyle}>
              <div
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                تواريخ انتهاء الشهادات الأساسية (COA / Insurance / Noise)
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="COA Expiry (شهادة الصلاحية)">
                  <Input
                    type="date"
                    disabled={!canDocsEdit}
                    value={certDatesDraft.coaExpiry || ""}
                    onChange={(e) =>
                      setCertDatesDraft({
                        ...certDatesDraft,
                        coaExpiry: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Insurance Expiry (التأمين)">
                  <Input
                    type="date"
                    disabled={!canDocsEdit}
                    value={certDatesDraft.insuranceExpiry || ""}
                    onChange={(e) =>
                      setCertDatesDraft({
                        ...certDatesDraft,
                        insuranceExpiry: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Noise Cert Expiry (الضوضاء)">
                  <Input
                    type="date"
                    disabled={!canDocsEdit}
                    value={certDatesDraft.noiseCertExpiry || ""}
                    onChange={(e) =>
                      setCertDatesDraft({
                        ...certDatesDraft,
                        noiseCertExpiry: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </div>

            {!canDocsEdit && (
              <div className="p-3 rounded-lg text-xs flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-500">
                <Eye className="w-4 h-4" />
                {t.docs_readonly || "وضع العرض فقط — لا يمكنك تعديل المستندات"}
              </div>
            )}

            {canDocsEdit ? (
              <AttachmentsEditor
                value={docsDraft}
                onChange={(v) => setDocsDraft(v)}
                folder="aircraft-docs"
              />
            ) : (
              <ReadOnlyDocsList
                docs={docsDraft}
                canDownload={canDocsDownload}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * READ-ONLY DOCS LIST (Theme-Aware & Iframe-Safe Preview)
 * ═══════════════════════════════════════════════════════════ */
export function ReadOnlyDocsList({ docs = [], canDownload = false }) {
  const t = useT();
  if (docs.length === 0) {
    return (
      <div
        className="p-8 text-center text-sm rounded-lg border-2 border-dashed"
        style={{
          color: "var(--text-muted)",
          borderColor: "var(--border-default)",
        }}
      >
        <Paperclip className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <div>{t.noData || "لا توجد مستندات مرفقة"}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {docs.map((doc, idx) => {
        const name = doc.name || doc.fileName || `Document ${idx + 1}`;
        const url = doc.url || doc.fileUrl || doc.data || "";
        const size = doc.size ? formatFileSize(doc.size) : "";
        const type = doc.type || doc.mimeType || doc.mime || "";
        const st = docStatus(doc.expiry);
        const days = daysUntil(doc.expiry);
        const colorCls = getStatusColor(st);
        const cardBg =
          st === "expired"
            ? "rgba(244, 63, 94, 0.1)"
            : st === "critical"
            ? "rgba(249, 115, 22, 0.1)"
            : st === "expiring"
            ? "rgba(245, 158, 11, 0.1)"
            : "var(--bg-app)";
        const cardBorder =
          st === "expired"
            ? "rgba(244, 63, 94, 0.4)"
            : st === "critical"
            ? "rgba(249, 115, 22, 0.4)"
            : st === "expiring"
            ? "rgba(245, 158, 11, 0.4)"
            : "var(--border-default)";
        return (
          <div
            key={`${doc.id || name}-${idx}`}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg border"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "rgba(168, 85, 247, 0.15)" }}
            >
              <Paperclip className="w-5 h-5 text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-bold text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {name}
              </div>
              <div
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {type && <span className="font-mono">{type}</span>}
                {size && <span> · {size}</span>}
              </div>
              {doc.expiry && days !== null && (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      color: "var(--text-muted)",
                    }}
                  >
                    📅 {String(doc.expiry).slice(0, 10)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${colorCls}`}
                  >
                    {days < 0
                      ? `منتهي منذ ${Math.abs(days)} يوم`
                      : days === 0
                      ? "ينتهي اليوم"
                      : `${days} يوم متبقٍ`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {url && (
                <button
                  type="button"
                  onClick={() =>
                    openPreviewModal({
                      title: name,
                      blobUrl: url,
                      fileName: doc.fileName || name,
                    })
                  }
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 transition"
                >
                  <Eye className="w-3.5 h-3.5" /> معاينة
                </button>
              )}
              {canDownload && url ? (
                <a
                  href={url}
                  download={name}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                  style={{
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "var(--brand-primary)",
                  }}
                >
                  <FileDown className="w-3.5 h-3.5" /> {t.download || "تحميل"}
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Fleet;
