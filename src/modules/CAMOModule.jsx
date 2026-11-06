/* ═══════════════════════════════════════════════════════════
 * CAMO MODULE — Continuous Airworthiness Management (v2.0)
 * Linked Bidirectionally with Fleet (Aircraft + Documents + Certificates)
 * 5 Tabs: Aircraft / Checks / Components / Documents / MEL
 * ═══════════════════════════════════════════════════════════ */
import {
  showToast,
  confirmAction,
  openPreviewModal,
} from "../utils/dialog";
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  ShieldCheck,
  Plane,
  AlertTriangle,
  Wrench,
  FileText,
  Eye,
  Calendar,
  CheckCircle2,
  Paperclip,
  RefreshCw,
  Activity,
  Gauge,
} from "lucide-react";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { AttachmentsEditor } from "../components/AttachmentsEditor";
import { ReadOnlyDocsList } from "./Fleet";
import { camoAPI, melAPI } from "../api";
import { IntegrityDashboard } from "../components/IntegrityDashboard";
import { EmbeddedSectionDashboard } from "../dashboard/EmbeddedSectionDashboard";
import { can as checkPerm } from "../config/permissions";
import { fmtDate, daysUntil } from "../utils/helpers";
import { logSafe } from "../utils/audit";
import {
  normalizeReg,
  parseDocsList,
  buildUnifiedFleetAndCamo,
  saveAircraftFromCamo,
  saveAircraftDocsBothWays,
  deleteAircraftBothWays,
  syncAllFleetAndCamo,
} from "../utils/fleetCamoSync";

/* ═══ Helpers ═══ */
const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};
const innerBoxStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

const STATUS_COLORS = {
  AIRWORTHY: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
    label: "AIRWORTHY",
  },
  "DUE SOON": {
    bg: "bg-amber-500/15",
    text: "text-amber-500",
    label: "DUE SOON",
  },
  OVERDUE: {
    bg: "bg-rose-500/15",
    text: "text-rose-500",
    label: "OVERDUE",
  },
  GROUNDED: {
    bg: "bg-slate-500/15",
    text: "text-slate-400",
    label: "GROUNDED",
  },
};

const MEL_STATUS_COLORS = {
  OPEN: { bg: "bg-amber-500/15", text: "text-amber-500", label: "OPEN" },
  CLOSED: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
    label: "CLOSED",
  },
  DEFERRED: {
    bg: "bg-orange-500/15",
    text: "text-orange-500",
    label: "DEFERRED",
  },
};

const CATEGORY_DAYS = { A: 1, B: 3, C: 10, D: 120 };

const getCheckStatus = (acft) => {
  if (acft?.status === "GROUNDED") return "GROUNDED";
  const nextCheckDate = acft?.nextCheckDate;
  if (!nextCheckDate) return "AIRWORTHY";
  const days = daysUntil(nextCheckDate);
  if (days === null) return "AIRWORTHY";
  if (days < 0) return "OVERDUE";
  if (days <= 30) return "DUE SOON";
  return "AIRWORTHY";
};

/* ═══ MAIN COMPONENT ═══ */
export function CAMOModule({
  fleet = [],
  rawFleet,
  setFleet,
  camoList: propCamoList,
  setCamoList: propSetCamoList,
  unifiedCamo: propUnifiedCamo,
  melList: propMelList,
  setMelList: propSetMelList,
  flights = [],
  crew = [],
  users = [],
  roles = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  auditLogs = [],
  loginHistory = [],
  settings,
  user,
  syncStatus = "idle",
  onRefresh,
  setTab,
  lang,
  setSyncStatus,
}) {
  const canDashboardView =
    checkPerm(user, "camo.dashboard_view") || checkPerm(user, "camo.view");
  const [activeTab, setActiveTab] = useState(() =>
    canDashboardView ? "dashboard" : "aircraft"
  );

  // Support both controlled props from App.tsx and standalone fallback
  const [localCamoList, setLocalCamoList] = useState([]);
  const [localMelList, setLocalMelList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingBoth, setSyncingBoth] = useState(false);
  const [search, setSearch] = useState("");

  const camoList = propCamoList !== undefined ? propCamoList : localCamoList;
  const setCamoList = propSetCamoList || setLocalCamoList;
  const melList = propMelList !== undefined ? propMelList : localMelList;
  const setMelList = propSetMelList || setLocalMelList;
  const sourceFleet = rawFleet || fleet;

  const [editingAircraft, setEditingAircraft] = useState(null);
  const [beforeEditReg, setBeforeEditReg] = useState("");
  const [draftAircraft, setDraftAircraft] = useState({});
  const [savingAircraft, setSavingAircraft] = useState(false);

  const [docsAcft, setDocsAcft] = useState(null);
  const [docsDraft, setDocsDraft] = useState([]);
  const [certDatesDraft, setCertDatesDraft] = useState({
    coaExpiry: "",
    insuranceExpiry: "",
    noiseCertExpiry: "",
  });
  const [docsSaving, setDocsSaving] = useState(false);

  const [editingMel, setEditingMel] = useState(null);
  const [draftMel, setDraftMel] = useState({});

  const canEdit =
    checkPerm(user, "camo.edit") || checkPerm(user, "fleet.edit");
  const canDocsView =
    checkPerm(user, "camo.view") || checkPerm(user, "fleet.docs");
  const canDocsEdit =
    checkPerm(user, "camo.edit") || checkPerm(user, "fleet.docs_edit");
  const canDocsDownload =
    checkPerm(user, "camo.view") || checkPerm(user, "fleet.docs_download");
  const canMelEdit = checkPerm(user, "mel.edit");

  // Only load locally if parent didn't pass camoList/melList
  useEffect(() => {
    if (propCamoList !== undefined && propMelList !== undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [camo, mel] = await Promise.all([
          camoAPI.list().catch(() => []),
          melAPI.list().catch(() => []),
        ]);
        if (!cancelled) {
          if (propCamoList === undefined) setLocalCamoList(camo);
          if (propMelList === undefined) setLocalMelList(mel);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propCamoList, propMelList]);

  // Unified CAMO list linked with Fleet by registration
  const displayCamo = useMemo(() => {
    if (propUnifiedCamo) return propUnifiedCamo;
    return buildUnifiedFleetAndCamo(sourceFleet, camoList).unifiedCamo;
  }, [propUnifiedCamo, sourceFleet, camoList]);

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
      showToast(
        "✅ تمت مزامنة جميع الطائرات والمستندات بين CAMO والأسطول",
        "success"
      );
    } catch (e) {
      setSyncStatus?.("error");
      showToast("❌ فشلت المزامنة: " + e.message, "error");
    } finally {
      setSyncingBoth(false);
    }
  };

  /* ═══ Aircraft CRUD (Two-Way Synced with Fleet) ═══ */
  const openNewAircraft = () => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setBeforeEditReg("");
    setDraftAircraft({
      reg: "",
      type: "",
      tah: 0,
      tac: 0,
      lastCheckDate: "",
      lastCheckType: "A",
      nextCheckDate: "",
      nextCheckType: "A",
      coaExpiry: "",
      insuranceExpiry: "",
      noiseCertExpiry: "",
      engine1Hours: 0,
      engine1Cycles: 0,
      engine2Hours: 0,
      engine2Cycles: 0,
      apuHours: 0,
      apuCycles: 0,
      llpHours: 0,
      llpCycles: 0,
      notes: "",
      status: "AIRWORTHY",
      attachments: [],
    });
    setEditingAircraft("new");
  };

  const openEditAircraft = (a) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setBeforeEditReg(a.reg || "");
    setDraftAircraft({
      ...a,
      lastCheckDate: a.lastCheckDate ? String(a.lastCheckDate).slice(0, 10) : "",
      nextCheckDate: a.nextCheckDate ? String(a.nextCheckDate).slice(0, 10) : "",
      coaExpiry: a.coaExpiry ? String(a.coaExpiry).slice(0, 10) : "",
      insuranceExpiry: a.insuranceExpiry
        ? String(a.insuranceExpiry).slice(0, 10)
        : "",
      noiseCertExpiry: a.noiseCertExpiry
        ? String(a.noiseCertExpiry).slice(0, 10)
        : "",
    });
    setEditingAircraft(a.id);
  };

  const saveAircraft = async () => {
    if (!draftAircraft.reg)
      return showToast("⚠️ أدخل رقم التسجيل (Registration)", "warning");
    setSavingAircraft(true);
    setSyncStatus?.("syncing");
    try {
      const { camoItem } = await saveAircraftFromCamo({
        draft: draftAircraft,
        isNew: editingAircraft === "new",
        beforeReg: beforeEditReg,
        fleet: sourceFleet,
        setFleet,
        camoList,
        setCamoList,
        userName: user?.fullName || "",
      });

      logSafe(
        user,
        editingAircraft === "new" ? "CREATE" : "UPDATE",
        "CAMO+Fleet",
        camoItem.id,
        camoItem.reg,
        { reg: camoItem.reg, type: camoItem.type }
      );

      setEditingAircraft(null);
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ الطائرة ومزامنتها تلقائياً مع Fleet", "success");
    } catch (e) {
      showToast("فشل الحفظ: " + e.message, "error");
      setSyncStatus?.("error");
    } finally {
      setSavingAircraft(false);
    }
  };

  const removeAircraft = async (acft) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    if (
      !(await confirmAction(
        `حذف الطائرة (${acft.reg}) من كلٍّ من CAMO والأسطول؟`
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
      logSafe(user, "DELETE", "CAMO+Fleet", acft.id, acft.reg || "", {});
      setSyncStatus?.("synced");
      showToast("✅ تم الحذف من CAMO والأسطول", "success");
    } catch (e) {
      setSyncStatus?.("error");
      showToast("فشل الحذف: " + e.message, "error");
    }
  };

  /* ═══ Documents & Certificates Modal (Two-Way Synced with Fleet) ═══ */
  const openDocsModal = (a) => {
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

  const saveDocsModal = async () => {
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
        "CAMO+Fleet (Documents)",
        docsAcft.id,
        docsAcft.reg,
        { count: docsDraft.length }
      );

      setDocsAcft(null);
      setDocsDraft([]);
      setSyncStatus?.("synced");
      showToast(
        "✅ تم حفظ المستندات والشهادات ومزامنتها مع قسم الأسطول (Fleet)",
        "success"
      );
    } catch (e) {
      setSyncStatus?.("error");
      showToast("❌ فشل الحفظ: " + e.message, "error");
    } finally {
      setDocsSaving(false);
    }
  };

  /* ═══ MEL CRUD ═══ */
  const openNewMel = () => {
    if (!canMelEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setDraftMel({
      reg: displayCamo[0]?.reg || "",
      melRef: "",
      item: "",
      status: "OPEN",
      category: "C",
      openedDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      closedDate: "",
      restrictions: "",
      remarks: "",
    });
    setEditingMel("new");
  };

  const openEditMel = (m) => {
    if (!canMelEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setDraftMel({ ...m });
    setEditingMel(m.id);
  };

  const saveMel = async () => {
    if (!draftMel.reg || !draftMel.melRef) {
      return showToast("⚠️ أدخل Reg + MEL Ref", "warning");
    }
    const payload = { ...draftMel };
    if (payload.status === "OPEN" && payload.openedDate && payload.category) {
      const opened = new Date(payload.openedDate);
      const days = CATEGORY_DAYS[payload.category] || 10;
      opened.setDate(opened.getDate() + days);
      payload.dueDate = opened.toISOString().slice(0, 10);
    }
    setSyncStatus?.("syncing");
    try {
      if (editingMel === "new") {
        const created = await melAPI.create(payload);
        setMelList([...melList, { ...payload, id: created.id }]);
      } else {
        await melAPI.update(editingMel, payload);
        setMelList(
          melList.map((m) =>
            m.id === editingMel ? { ...payload, id: editingMel } : m
          )
        );
      }
      setEditingMel(null);
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ عنصر MEL", "success");
    } catch (e) {
      showToast("فشل: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  const closeMel = async (id) => {
    if (!canMelEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    const m = melList.find((x) => x.id === id);
    if (!m) return;
    if (!(await confirmAction(`إغلاق MEL ${m.melRef}؟`))) return;
    try {
      const updated = {
        ...m,
        status: "CLOSED",
        closedDate: new Date().toISOString().slice(0, 10),
      };
      await melAPI.update(id, updated);
      setMelList(melList.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      showToast("فشل: " + e.message, "error");
    }
  };

  const removeMel = async (id) => {
    if (!canMelEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    if (!(await confirmAction("حذف هذا MEL؟"))) return;
    try {
      await melAPI.remove(id);
      setMelList(melList.filter((m) => m.id !== id));
    } catch (e) {
      showToast("فشل: " + e.message, "error");
    }
  };

  /* ═══ Filtering ═══ */
  const filteredCamo = useMemo(() => {
    if (!search) return displayCamo;
    const q = search.toLowerCase();
    return displayCamo.filter((a) =>
      `${a.reg || ""} ${a.type || ""}`.toLowerCase().includes(q)
    );
  }, [displayCamo, search]);

  const filteredMel = useMemo(() => {
    if (!search) return melList;
    const q = search.toLowerCase();
    return melList.filter((m) =>
      `${m.reg || ""} ${m.melRef || ""} ${m.item || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [melList, search]);

  const counters = {
    total: displayCamo.length,
    airworthy: displayCamo.filter((a) => getCheckStatus(a) === "AIRWORTHY")
      .length,
    dueSoon: displayCamo.filter((a) => getCheckStatus(a) === "DUE SOON").length,
    overdue: displayCamo.filter((a) => getCheckStatus(a) === "OVERDUE").length,
    openMel: melList.filter((m) => m.status === "OPEN").length,
  };

  /* ═══ RENDER ═══ */
  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="rounded-xl p-3" style={cardStyle}>
        <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
              style={{ background: "var(--brand-gradient)" }}
            >
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>CAMO — Continuous Airworthiness</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500">
                  ⇄ Fleet Linked
                </span>
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {counters.total} aircraft · {counters.openMel} open MEL items · مرتبط ثنائياً مع الأسطول والمستندات
              </p>
            </div>
          </div>

          {(canEdit || canDocsEdit) && (
            <button
              onClick={handleManualSync}
              disabled={syncingBoth}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncingBoth ? "animate-spin" : ""}`}
              />
              مزامنة CAMO ↔ Fleet
            </button>
          )}
        </div>

        {/* Tabs */}
        <div
          className="flex flex-wrap gap-1 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          {[
            ...(canDashboardView
              ? [
                  {
                    id: "dashboard",
                    label:
                      lang === "ar"
                        ? "داشبورد الكامو والصلاحية"
                        : "CAMO Dashboard",
                    icon: Gauge,
                  },
                ]
              : []),
            { id: "aircraft", label: "Aircraft", icon: Plane },
            { id: "checks", label: "Checks", icon: Calendar },
            { id: "components", label: "Components", icon: Wrench },
            { id: "documents", label: "Documents (المستندات)", icon: FileText },
            { id: "mel", label: "MEL", icon: AlertTriangle },
            { id: "integrity", label: "Integrity", icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap shrink-0"
                style={{
                  borderColor: active ? "var(--brand-primary)" : "transparent",
                  color: active ? "var(--brand-primary)" : "var(--text-muted)",
                  backgroundColor: active ? "var(--bg-app)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search + Add */}
        {activeTab !== "dashboard" && activeTab !== "integrity" && (
          <div className="flex flex-wrap gap-2 items-center mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search aircraft, registration, MEL…"
                className="ps-9"
              />
            </div>
            {activeTab === "aircraft" && canEdit && (
              <button
                onClick={openNewAircraft}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> Add Aircraft
              </button>
            )}
            {activeTab === "mel" && canMelEdit && (
              <button
                onClick={openNewMel}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> Add MEL
              </button>
            )}
          </div>
        )}

        {/* Counters */}
        <div
          className="flex flex-wrap gap-4 mt-3 pt-3 border-t text-xs"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          <span>
            Airworthy: <b className="text-emerald-500">{counters.airworthy}</b>
          </span>
          <span>·</span>
          <span>
            Due Soon: <b className="text-amber-500">{counters.dueSoon}</b>
          </span>
          <span>·</span>
          <span>
            Overdue: <b className="text-rose-500">{counters.overdue}</b>
          </span>
          <span>·</span>
          <span>
            Open MEL: <b className="text-amber-500">{counters.openMel}</b>
          </span>
        </div>
      </div>

      {loading && displayCamo.length === 0 && (
        <div
          className="text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          جاري تحميل بيانات الصلاحية...
        </div>
      )}

      {/* ═══ TAB: CAMO DASHBOARD ═══ */}
      {activeTab === "dashboard" && canDashboardView && (
        <EmbeddedSectionDashboard
          scope="camo"
          defaultPresetKey="camo"
          flights={flights}
          crew={crew}
          fleet={fleet}
          camoList={displayCamo}
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
      )}

      {/* ═══ TAB: AIRCRAFT ═══ */}
      {activeTab === "aircraft" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCamo.map((a) => {
            const status = getCheckStatus(a);
            const sc = STATUS_COLORS[status] || STATUS_COLORS.AIRWORTHY;
            const docs = parseDocsList(a.attachments);
            const openMel = melList.filter(
              (m) =>
                normalizeReg(m.reg) === normalizeReg(a.reg) &&
                m.status === "OPEN"
            ).length;

            return (
              <div
                key={a.id}
                className="rounded-xl p-4 space-y-3"
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
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.type || "—"}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${sc.bg} ${sc.text}`}
                  >
                    {sc.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded" style={innerBoxStyle}>
                    <div style={{ color: "var(--text-muted)" }}>TAH</div>
                    <div
                      className="font-mono font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.tah?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={innerBoxStyle}>
                    <div style={{ color: "var(--text-muted)" }}>TAC</div>
                    <div
                      className="font-mono font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.tac?.toLocaleString() || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded col-span-2" style={innerBoxStyle}>
                    <div style={{ color: "var(--text-muted)" }}>Next Check</div>
                    <div
                      className="font-mono font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {fmtDate(a.nextCheckDate) || "—"} (
                      {a.nextCheckType || "—"})
                    </div>
                  </div>
                </div>

                {openMel > 0 && (
                  <div className="p-2 rounded text-xs bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    ⚠️ {openMel} MEL item{openMel > 1 ? "s" : ""} open
                  </div>
                )}

                <div
                  className="flex gap-2 pt-2"
                  style={{ borderTop: "1px solid var(--border-default)" }}
                >
                  {canEdit && (
                    <button
                      onClick={() => openEditAircraft(a)}
                      className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-xs font-bold flex items-center justify-center gap-1 transition"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  {canDocsView && (
                    <button
                      onClick={() => openDocsModal(a)}
                      className="flex-1 py-2 rounded-lg bg-purple-500/15 text-purple-500 hover:bg-purple-500/25 text-xs font-bold flex items-center justify-center gap-1 transition"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>مستندات</span>
                      <span className="ms-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full px-1.5">
                        {docs.length}
                      </span>
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => removeAircraft(a)}
                      className="py-2 px-3 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 text-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TAB: CHECKS ═══ */}
      {activeTab === "checks" && (
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
                  "Reg",
                  "Aircraft Type",
                  "Last Check",
                  "Check Type",
                  "Next Check",
                  "Next Type",
                  "Days Left",
                  "Status",
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
              {filteredCamo.map((a) => {
                const status = getCheckStatus(a);
                const sc = STATUS_COLORS[status] || STATUS_COLORS.AIRWORTHY;
                const days = a.nextCheckDate
                  ? daysUntil(a.nextCheckDate)
                  : null;
                return (
                  <tr
                    key={a.id}
                    style={{ borderTop: "1px solid var(--border-default)" }}
                  >
                    <td
                      className="px-3 py-2 font-mono font-bold"
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
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {fmtDate(a.lastCheckDate) || "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-center font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.lastCheckType || "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {fmtDate(a.nextCheckDate) || "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-center font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.nextCheckType || "—"}
                    </td>
                    <td
                      className="px-3 py-2 text-center font-mono font-bold"
                      style={{
                        color:
                          days === null
                            ? "var(--text-muted)"
                            : days < 0
                            ? "#ef4444"
                            : days <= 30
                            ? "#f59e0b"
                            : "#22c55e",
                      }}
                    >
                      {days !== null
                        ? days < 0
                          ? `${Math.abs(days)} overdue`
                          : `${days}d`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${sc.bg} ${sc.text}`}
                      >
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB: COMPONENTS ═══ */}
      {activeTab === "components" && (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredCamo.map((a) => (
            <div
              key={a.id}
              className="rounded-xl p-4 space-y-2"
              style={cardStyle}
            >
              <div className="flex items-center justify-between">
                <div
                  className="font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {a.reg} · {a.type}
                </div>
                {canEdit && (
                  <button
                    onClick={() => openEditAircraft(a)}
                    className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-500 text-xs font-bold flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" /> Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded" style={innerBoxStyle}>
                  <div style={{ color: "var(--text-muted)" }}>Engine 1</div>
                  <div
                    className="font-mono font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {(a.engine1Hours || 0).toLocaleString()}h /{" "}
                    {(a.engine1Cycles || 0).toLocaleString()}c
                  </div>
                </div>
                <div className="p-2 rounded" style={innerBoxStyle}>
                  <div style={{ color: "var(--text-muted)" }}>Engine 2</div>
                  <div
                    className="font-mono font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {(a.engine2Hours || 0).toLocaleString()}h /{" "}
                    {(a.engine2Cycles || 0).toLocaleString()}c
                  </div>
                </div>
                <div className="p-2 rounded" style={innerBoxStyle}>
                  <div style={{ color: "var(--text-muted)" }}>APU</div>
                  <div
                    className="font-mono font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {(a.apuHours || 0).toLocaleString()}h /{" "}
                    {(a.apuCycles || 0).toLocaleString()}c
                  </div>
                </div>
                <div className="p-2 rounded" style={innerBoxStyle}>
                  <div style={{ color: "var(--text-muted)" }}>LLP</div>
                  <div
                    className="font-mono font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {(a.llpHours || 0).toLocaleString()}h /{" "}
                    {(a.llpCycles || 0).toLocaleString()}c
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ TAB: DOCUMENTS (Two-Way Editable with Fleet) ═══ */}
      {activeTab === "documents" && (
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
                  "Reg",
                  "Type",
                  "COA Expiry",
                  "Insurance",
                  "Noise Cert",
                  "المستندات المرفقة (Fleet ⇄ CAMO)",
                  "الإجراءات",
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
              {filteredCamo.map((a) => {
                const docs = parseDocsList(a.attachments);
                const docColor = (d) => {
                  if (!d) return "";
                  const days = daysUntil(d);
                  if (days < 0) return "text-rose-500 font-bold";
                  if (days <= 30) return "text-amber-500 font-bold";
                  return "text-emerald-500";
                };
                return (
                  <tr
                    key={a.id}
                    style={{ borderTop: "1px solid var(--border-default)" }}
                  >
                    <td
                      className="px-3 py-3 font-mono font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.reg}
                    </td>
                    <td
                      className="px-3 py-3"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {a.type}
                    </td>
                    <td
                      className={`px-3 py-3 text-xs font-mono ${docColor(
                        a.coaExpiry
                      )}`}
                    >
                      {fmtDate(a.coaExpiry) || "—"}
                    </td>
                    <td
                      className={`px-3 py-3 text-xs font-mono ${docColor(
                        a.insuranceExpiry
                      )}`}
                    >
                      {fmtDate(a.insuranceExpiry) || "—"}
                    </td>
                    <td
                      className={`px-3 py-3 text-xs font-mono ${docColor(
                        a.noiseCertExpiry
                      )}`}
                    >
                      {fmtDate(a.noiseCertExpiry) || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {docs.length === 0 ? (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          لا توجد مرفقات بعد
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {docs.slice(0, 3).map((d, dIdx) => (
                            <button
                              key={`${d.id}-${dIdx}`}
                              type="button"
                              onClick={() =>
                                d.url
                                  ? openPreviewModal({
                                      title: `${a.reg} — ${d.name}`,
                                      blobUrl: d.url,
                                      fileName: d.fileName || d.name,
                                    })
                                  : openDocsModal(a)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 text-xs font-semibold max-w-[160px]"
                              title={d.name}
                            >
                              <Paperclip className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{d.name}</span>
                            </button>
                          ))}
                          {docs.length > 3 && (
                            <button
                              type="button"
                              onClick={() => openDocsModal(a)}
                              className="px-2 py-1 rounded bg-slate-500/15 text-xs font-bold"
                              style={{ color: "var(--text-muted)" }}
                            >
                              +{docs.length - 3}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openDocsModal(a)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap"
                        style={{ background: "var(--brand-gradient)" }}
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {canDocsEdit
                          ? `إدارة وتعديل (${docs.length})`
                          : `عرض (${docs.length})`}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB: MEL ═══ */}
      {activeTab === "mel" && (
        <div className="space-y-3">
          {filteredMel.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={cardStyle}>
              <AlertTriangle
                className="w-12 h-12 mx-auto mb-2 opacity-40"
                style={{ color: "var(--text-muted)" }}
              />
              <div style={{ color: "var(--text-muted)" }}>
                لا توجد عناصر MEL مسجلة
              </div>
            </div>
          ) : (
            filteredMel.map((m) => {
              const sc = MEL_STATUS_COLORS[m.status] || MEL_STATUS_COLORS.OPEN;
              const days = m.dueDate ? daysUntil(m.dueDate) : null;
              const isOverdue =
                days !== null && days < 0 && m.status === "OPEN";
              return (
                <div
                  key={m.id}
                  className={`rounded-xl p-4 space-y-2 border ${
                    isOverdue ? "border-rose-500/50" : ""
                  }`}
                  style={cardStyle}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div
                        className="font-bold text-sm font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {m.reg} · MEL {m.melRef}
                      </div>
                      <div
                        className="text-sm"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {m.item}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-500">
                        Cat {m.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${sc.bg} ${sc.text}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded" style={innerBoxStyle}>
                      <div style={{ color: "var(--text-muted)" }}>Opened</div>
                      <div
                        className="font-mono"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fmtDate(m.openedDate)}
                      </div>
                    </div>
                    <div className="p-2 rounded" style={innerBoxStyle}>
                      <div style={{ color: "var(--text-muted)" }}>Due</div>
                      <div
                        className={`font-mono ${
                          isOverdue ? "text-rose-500 font-bold" : ""
                        }`}
                        style={{
                          color: isOverdue ? "#ef4444" : "var(--text-primary)",
                        }}
                      >
                        {fmtDate(m.dueDate) || "—"}
                      </div>
                    </div>
                    <div className="p-2 rounded" style={innerBoxStyle}>
                      <div style={{ color: "var(--text-muted)" }}>
                        Days Left
                      </div>
                      <div
                        className={`font-mono font-bold ${
                          isOverdue
                            ? "text-rose-500"
                            : days !== null && days <= 3
                            ? "text-amber-500"
                            : "text-emerald-500"
                        }`}
                      >
                        {days !== null
                          ? days < 0
                            ? `${Math.abs(days)} overdue`
                            : `${days}d`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {m.restrictions && (
                    <div className="p-2 rounded text-xs" style={innerBoxStyle}>
                      <div style={{ color: "var(--text-muted)" }}>
                        Restrictions:
                      </div>
                      <div style={{ color: "var(--text-primary)" }}>
                        {m.restrictions}
                      </div>
                    </div>
                  )}

                  {m.remarks && (
                    <div
                      className="text-xs italic"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {m.remarks}
                    </div>
                  )}

                  {canMelEdit && (
                    <div
                      className="flex gap-2 pt-2"
                      style={{ borderTop: "1px solid var(--border-default)" }}
                    >
                      <button
                        onClick={() => openEditMel(m)}
                        className="flex-1 py-1.5 rounded bg-amber-500/15 text-amber-500 text-xs font-bold flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </button>
                      {m.status === "OPEN" && (
                        <button
                          onClick={() => closeMel(m.id)}
                          className="flex-1 py-1.5 rounded bg-emerald-500/15 text-emerald-500 text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Close
                        </button>
                      )}
                      <button
                        onClick={() => removeMel(m.id)}
                        className="py-1.5 px-3 rounded bg-rose-500/15 text-rose-500 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "integrity" && (
        <IntegrityDashboard
          fleet={sourceFleet}
          camoList={camoList}
          syncAll={handleManualSync}
          setSyncStatus={setSyncStatus}
        />
      )}

      {/* ═══ MODAL: AIRCRAFT (Synced with Fleet) ═══ */}
      <Modal
        open={!!editingAircraft}
        title={
          editingAircraft === "new"
            ? "Add Aircraft (CAMO ⇄ Fleet)"
            : `Edit Aircraft — ${draftAircraft.reg || ""}`
        }
        onClose={() => setEditingAircraft(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditingAircraft(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveAircraft}
              disabled={savingAircraft}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" />{" "}
              {savingAircraft ? "Saving…" : "Save & Sync Fleet"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            ⇄ يتم تحديث الطائرة ومواعيد الصيانة والشهادات تلقائياً في كلٍّ من CAMO وقسم الأسطول (Fleet).
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Registration">
              <Input
                value={draftAircraft.reg || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    reg: e.target.value.toUpperCase(),
                  })
                }
                className="font-mono"
              />
            </Field>
            <Field label="Type">
              <Input
                value={draftAircraft.type || ""}
                onChange={(e) =>
                  setDraftAircraft({ ...draftAircraft, type: e.target.value })
                }
              />
            </Field>
            <Field label="Status">
              <Select
                value={draftAircraft.status || "AIRWORTHY"}
                onChange={(e) =>
                  setDraftAircraft({ ...draftAircraft, status: e.target.value })
                }
              >
                <option value="AIRWORTHY">AIRWORTHY</option>
                <option value="GROUNDED">GROUNDED</option>
              </Select>
            </Field>
            <Field label="TAH">
              <Input
                type="number"
                value={draftAircraft.tah || 0}
                onChange={(e) =>
                  setDraftAircraft({ ...draftAircraft, tah: +e.target.value })
                }
              />
            </Field>
            <Field label="TAC">
              <Input
                type="number"
                value={draftAircraft.tac || 0}
                onChange={(e) =>
                  setDraftAircraft({ ...draftAircraft, tac: +e.target.value })
                }
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Last Check">
              <Input
                type="date"
                value={draftAircraft.lastCheckDate || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    lastCheckDate: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Last Type">
              <Select
                value={draftAircraft.lastCheckType || "A"}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    lastCheckType: e.target.value,
                  })
                }
              >
                {["A", "B", "C", "D"].map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Next Check">
              <Input
                type="date"
                value={draftAircraft.nextCheckDate || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    nextCheckDate: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Next Type">
              <Select
                value={draftAircraft.nextCheckType || "A"}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    nextCheckType: e.target.value,
                  })
                }
              >
                {["A", "B", "C", "D"].map((ct) => (
                  <option key={ct} value={ct}>
                    {ct}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="COA Expiry">
              <Input
                type="date"
                value={draftAircraft.coaExpiry || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    coaExpiry: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Insurance Expiry">
              <Input
                type="date"
                value={draftAircraft.insuranceExpiry || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    insuranceExpiry: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Noise Cert Expiry">
              <Input
                type="date"
                value={draftAircraft.noiseCertExpiry || ""}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    noiseCertExpiry: e.target.value,
                  })
                }
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Engine 1 (h)">
              <Input
                type="number"
                value={draftAircraft.engine1Hours || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    engine1Hours: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Engine 1 (c)">
              <Input
                type="number"
                value={draftAircraft.engine1Cycles || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    engine1Cycles: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Engine 2 (h)">
              <Input
                type="number"
                value={draftAircraft.engine2Hours || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    engine2Hours: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Engine 2 (c)">
              <Input
                type="number"
                value={draftAircraft.engine2Cycles || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    engine2Cycles: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="APU (h)">
              <Input
                type="number"
                value={draftAircraft.apuHours || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    apuHours: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="APU (c)">
              <Input
                type="number"
                value={draftAircraft.apuCycles || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    apuCycles: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="LLP (h)">
              <Input
                type="number"
                value={draftAircraft.llpHours || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    llpHours: +e.target.value,
                  })
                }
              />
            </Field>
            <Field label="LLP (c)">
              <Input
                type="number"
                value={draftAircraft.llpCycles || 0}
                onChange={(e) =>
                  setDraftAircraft({
                    ...draftAircraft,
                    llpCycles: +e.target.value,
                  })
                }
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              value={draftAircraft.notes || ""}
              onChange={(e) =>
                setDraftAircraft({ ...draftAircraft, notes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-card)",
              }}
            />
          </Field>
        </div>
      </Modal>

      {/* ═══ MODAL: TWO-WAY DOCUMENTS & CERTIFICATES (CAMO ⇄ FLEET) ═══ */}
      {docsAcft && (
        <Modal
          open={!!docsAcft}
          title={`📎 مستندات وشهادات الطائرة — ${docsAcft.reg} (CAMO ⇄ Fleet)`}
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
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إغلاق
              </button>
              {canDocsEdit && (
                <button
                  onClick={saveDocsModal}
                  disabled={docsSaving}
                  className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Save className="w-4 h-4" />
                  {docsSaving
                    ? "جاري الحفظ والمزامنة…"
                    : "حفظ ومزامنة مع الأسطول (Fleet)"}
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
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {docsAcft.reg} · {docsAcft.type}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ⇄ مربوط ثنائياً مع قسم الأسطول (Fleet) — يمكنك الإضافة أو التعديل أو الحذف من الجهتين
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-500 text-xs font-bold">
                {docsDraft.length} مستندات
              </span>
            </div>

            {/* Statutory Certificate Dates */}
            <div className="p-3 rounded-xl border space-y-2.5" style={innerBoxStyle}>
              <div
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <FileText className="w-4 h-4 text-sky-500" />
                تواريخ انتهاء الشهادات الرسمية (COA / Insurance / Noise)
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
                وضع العرض فقط — لا يمكنك تعديل المستندات
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

      {/* ═══ MODAL: MEL ═══ */}
      <Modal
        open={!!editingMel}
        title={editingMel === "new" ? "Add MEL Item" : "Edit MEL Item"}
        onClose={() => setEditingMel(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditingMel(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveMel}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Aircraft Reg">
              <Select
                value={draftMel.reg || ""}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, reg: e.target.value })
                }
              >
                <option value="">—</option>
                {displayCamo.map((a) => (
                  <option key={a.id} value={a.reg}>
                    {a.reg} ({a.type})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="MEL Ref">
              <Input
                value={draftMel.melRef || ""}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, melRef: e.target.value })
                }
                placeholder="24-30-01"
              />
            </Field>
            <Field label="Category">
              <Select
                value={draftMel.category || "C"}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, category: e.target.value })
                }
              >
                <option value="A">A (1 day)</option>
                <option value="B">B (3 days)</option>
                <option value="C">C (10 days)</option>
                <option value="D">D (120 days)</option>
              </Select>
            </Field>
          </div>

          <Field label="Item Description">
            <Input
              value={draftMel.item || ""}
              onChange={(e) =>
                setDraftMel({ ...draftMel, item: e.target.value })
              }
              placeholder="APU, Weather Radar, etc."
            />
          </Field>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Status">
              <Select
                value={draftMel.status || "OPEN"}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, status: e.target.value })
                }
              >
                <option value="OPEN">OPEN</option>
                <option value="CLOSED">CLOSED</option>
                <option value="DEFERRED">DEFERRED</option>
              </Select>
            </Field>
            <Field label="Opened Date">
              <Input
                type="date"
                value={draftMel.openedDate || ""}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, openedDate: e.target.value })
                }
              />
            </Field>
            <Field label="Due Date (auto)">
              <Input
                type="date"
                value={draftMel.dueDate || ""}
                onChange={(e) =>
                  setDraftMel({ ...draftMel, dueDate: e.target.value })
                }
              />
            </Field>
          </div>

          <Field label="Restrictions">
            <textarea
              value={draftMel.restrictions || ""}
              onChange={(e) =>
                setDraftMel({ ...draftMel, restrictions: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-card)",
              }}
              placeholder="e.g., APU not available, Day VMC only"
            />
          </Field>

          <Field label="Remarks">
            <textarea
              value={draftMel.remarks || ""}
              onChange={(e) =>
                setDraftMel({ ...draftMel, remarks: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-card)",
              }}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default CAMOModule;
