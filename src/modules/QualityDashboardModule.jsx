/* ═══════════════════════════════════════════════════════════
 * QUALITY MANAGEMENT MODULE — قسم إدارة الجودة والامتثال (QMS)
 * Features:
 * 1. Dedicated Customizable Quality Dashboard (Multi-Named + Drag & Drop + RBAC)
 * 2. Interactive Quality Audits, Inspections & CAPA Findings Log (Google Sheets synced)
 * 3. Live Operational Compliance Matrix across Crew, CAMO, MEL, Training & Manuals
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Gauge,
  Plus,
  Check,
  X,
  ClipboardList,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Save,
  Layers,
  ArrowUpRight,
} from "lucide-react";

import { useT } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { LiveClock } from "../components/ui";
import { can as checkPerm, getRoleLabel } from "../config/permissions";
import {
  manualsAPI,
  flightPermitsAPI,
  cateringOrdersAPI,
  qualityAuditsAPI,
  readSheetCache,
} from "../api";
import { showToast, confirmAction } from "../utils/dialog";
import { logSafe } from "../utils/audit";
import { todayISO, fmtDate, daysUntil } from "../utils/helpers";
import { EmbeddedSectionDashboard } from "../dashboard/EmbeddedSectionDashboard";

const DEPARTMENTS = [
  "Flight Operations",
  "CAMO & Maintenance",
  "Crew Training",
  "Ground & Dispatch",
  "Cabin Safety & Catering",
  "Documentation & Manuals",
];

export function QualityDashboardModule({
  flights = [],
  crew = [],
  fleet = [],
  camoList = [],
  melList = [],
  users = [],
  roles = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  setSyncStatus,
  lang: langProp,
}) {
  const t = useT();
  const { user } = useAuth();
  const lang =
    langProp ||
    t?.code ||
    (typeof document !== "undefined" ? document.documentElement.lang : "en") ||
    "en";
  const isAr = lang === "ar";

  const can = useCallback(
    (perm) => {
      if (!user || !perm) return false;
      try {
        return checkPerm(user, perm);
      } catch {
        return false;
      }
    },
    [user]
  );

  const canViewDashboard = can("quality.dashboard_view") || can("quality.view");
  const canViewAudits = can("quality.audits_view") || can("quality.view");
  const canManageAudits = can("quality.audits_manage") || can("users.perms");

  /* ── Sub-view: "dashboards" | "audits" | "matrix" ── */
  const [subView, setSubView] = useState(() =>
    canViewDashboard ? "dashboards" : "audits"
  );

  /* ── Supplemental Data (Manuals, Permits, Catering, Quality Audits) ── */
  const [manuals, setManuals] = useState(() => readSheetCache("Manuals", []));
  const [permits, setPermits] = useState(() =>
    readSheetCache("FlightPermits", [])
  );
  const [cateringOrders, setCateringOrders] = useState(() =>
    readSheetCache("CateringOrders", [])
  );
  const [qualityAudits, setQualityAudits] = useState(() =>
    readSheetCache("QualityAudits", [])
  );
  const [auditsLoading, setAuditsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadExtras = async () => {
      setAuditsLoading(qualityAudits.length === 0);
      const [mList, pList, cList, qaList] = await Promise.all([
        manualsAPI.list().catch(() => readSheetCache("Manuals", [])),
        can("permits.view")
          ? flightPermitsAPI
              .list()
              .catch(() => readSheetCache("FlightPermits", []))
          : Promise.resolve([]),
        can("catering.view")
          ? cateringOrdersAPI
              .list()
              .catch(() => readSheetCache("CateringOrders", []))
          : Promise.resolve([]),
        qualityAuditsAPI
          .list()
          .catch(() => readSheetCache("QualityAudits", [])),
      ]);
      if (!cancelled) {
        setManuals(mList || []);
        setPermits(pList || []);
        setCateringOrders(cList || []);
        setQualityAudits(qaList || []);
        setAuditsLoading(false);
      }
    };
    loadExtras();
    return () => {
      cancelled = true;
    };
  }, [can]);

  /* ── Quality Audits & CAPA State & CRUD ── */
  const [auditSearch, setAuditSearch] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState("ALL");
  const [auditSevFilter, setAuditSevFilter] = useState("ALL");
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState(null);
  const [savingAudit, setSavingAudit] = useState(false);

  const [auditForm, setAuditForm] = useState({
    refNo: "",
    title: "",
    department: "Flight Operations",
    auditType: "Internal Audit",
    severity: "LEVEL_2",
    status: "OPEN",
    auditor: "",
    assignee: "",
    targetDate: "",
    aircraftReg: "",
    flightNo: "",
    rootCause: "",
    correctiveAction: "",
    notes: "",
  });

  const openNewAuditModal = () => {
    const nextNum = String(qualityAudits.length + 1).padStart(3, "0");
    const year = new Date().getFullYear();
    setEditingAudit(null);
    setAuditForm({
      refNo: `QA-${year}-${nextNum}`,
      title: "",
      department: "Flight Operations",
      auditType: "Internal Audit",
      severity: "LEVEL_2",
      status: "OPEN",
      auditor: user?.fullName || user?.username || "",
      assignee: "",
      targetDate: "",
      aircraftReg: "",
      flightNo: "",
      rootCause: "",
      correctiveAction: "",
      notes: "",
    });
    setAuditModalOpen(true);
  };

  const openEditAuditModal = (item) => {
    setEditingAudit(item);
    setAuditForm({
      refNo: item.refNo || "",
      title: item.title || "",
      department: item.department || "Flight Operations",
      auditType: item.auditType || "Internal Audit",
      severity: item.severity || "LEVEL_2",
      status: item.status || "OPEN",
      auditor: item.auditor || "",
      assignee: item.assignee || "",
      targetDate: item.targetDate || "",
      aircraftReg: item.aircraftReg || "",
      flightNo: item.flightNo || "",
      rootCause: item.rootCause || "",
      correctiveAction: item.correctiveAction || "",
      notes: item.notes || "",
    });
    setAuditModalOpen(true);
  };

  const handleSaveAudit = async (e) => {
    e?.preventDefault();
    if (!String(auditForm.title || "").trim()) {
      showToast(
        isAr
          ? "يرجى إدخال عنوان ملاحظة التدقيق"
          : "Please enter finding title",
        "warning"
      );
      return;
    }

    setSavingAudit(true);
    setSyncStatus?.("syncing");
    const now = new Date().toISOString();

    try {
      let nextList;
      if (editingAudit) {
        const updated = {
          ...editingAudit,
          ...auditForm,
          closedDate:
            auditForm.status === "CLOSED"
              ? editingAudit.closedDate || todayISO()
              : "",
          updatedAt: now,
        };
        nextList = qualityAudits.map((a) =>
          a.id === editingAudit.id ? updated : a
        );
        logSafe(user, "UPDATE", "QualityAudit", updated.id, updated.refNo, {
          status: updated.status,
        });
      } else {
        const created = {
          ...auditForm,
          id: `qa_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          closedDate: auditForm.status === "CLOSED" ? todayISO() : "",
          createdAt: now,
          updatedAt: now,
        };
        nextList = [created, ...qualityAudits];
        logSafe(user, "CREATE", "QualityAudit", created.id, created.refNo, {
          severity: created.severity,
        });
      }

      setQualityAudits(nextList);
      await qualityAuditsAPI.saveAll(nextList);
      setSyncStatus?.("synced");
      setAuditModalOpen(false);
      showToast(
        isAr
          ? "تم حفظ سجل التدقيق والمزامنة مع Google Sheets"
          : "Quality finding saved and synced to Google Sheets",
        "success"
      );
    } catch (err) {
      setSyncStatus?.("error");
      showToast(
        (isAr ? "تعذر الحفظ: " : "Save failed: ") + (err?.message || ""),
        "error"
      );
    } finally {
      setSavingAudit(false);
    }
  };

  const handleQuickCloseAudit = async (item) => {
    if (!canManageAudits) return;
    const now = new Date().toISOString();
    const nextList = qualityAudits.map((a) =>
      a.id === item.id
        ? { ...a, status: "CLOSED", closedDate: todayISO(), updatedAt: now }
        : a
    );
    setQualityAudits(nextList);
    setSyncStatus?.("syncing");
    try {
      await qualityAuditsAPI.saveAll(nextList);
      setSyncStatus?.("synced");
      showToast(
        isAr ? "تم إغلاق الملاحظة بنجاح" : "Finding marked as Closed",
        "success"
      );
    } catch {
      setSyncStatus?.("error");
    }
  };

  const handleDeleteAudit = async (item) => {
    if (!canManageAudits) return;
    const ok = await confirmAction(
      isAr
        ? `حذف سجل التدقيق "${item.refNo || item.title}"؟`
        : `Delete quality finding "${item.refNo || item.title}"?`
    );
    if (!ok) return;
    const nextList = qualityAudits.filter((a) => a.id !== item.id);
    setQualityAudits(nextList);
    await qualityAuditsAPI.saveAll(nextList).catch(() => {});
    showToast(isAr ? "تم الحذف" : "Deleted", "success");
  };

  const auditStats = useMemo(() => {
    const today = todayISO();
    let open = 0;
    let inProgress = 0;
    let closed = 0;
    let overdue = 0;
    qualityAudits.forEach((a) => {
      const st = String(a.status || "OPEN").toUpperCase();
      if (st === "CLOSED") closed++;
      else {
        if (st === "IN_PROGRESS") inProgress++;
        else open++;
        if (a.targetDate && a.targetDate < today) overdue++;
      }
    });
    const closurePct =
      qualityAudits.length > 0
        ? Math.round((closed / qualityAudits.length) * 100)
        : 100;
    return {
      total: qualityAudits.length,
      open: open + inProgress,
      overdue,
      closed,
      closurePct,
    };
  }, [qualityAudits]);

  const filteredAudits = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return qualityAudits.filter((a) => {
      const st = String(a.status || "OPEN").toUpperCase();
      const sev = String(a.severity || "LEVEL_2").toUpperCase();
      if (auditStatusFilter !== "ALL" && st !== auditStatusFilter) return false;
      if (auditSevFilter !== "ALL" && sev !== auditSevFilter) return false;
      if (!q) return true;
      return (
        String(a.refNo || "").toLowerCase().includes(q) ||
        String(a.title || "").toLowerCase().includes(q) ||
        String(a.department || "").toLowerCase().includes(q) ||
        String(a.assignee || "").toLowerCase().includes(q) ||
        String(a.aircraftReg || "").toLowerCase().includes(q)
      );
    });
  }, [qualityAudits, auditSearch, auditStatusFilter, auditSevFilter]);

  /* ── Live Operational Compliance Matrix Calculation ── */
  const complianceMatrix = useMemo(() => {
    // 1. Crew Licenses & Medicals
    const activeCrew = crew.filter((c) => c.status !== "inactive");
    let crewValid = 0;
    let crewIssues = 0;
    activeCrew.forEach((c) => {
      const licDays = c.licenseExpiry ? daysUntil(c.licenseExpiry) : 999;
      const medDays = c.medicalExpiry ? daysUntil(c.medicalExpiry) : 999;
      if (licDays < 0 || medDays < 0) crewIssues++;
      else crewValid++;
    });
    const crewPct =
      activeCrew.length > 0
        ? Math.round((crewValid / activeCrew.length) * 100)
        : 100;

    // 2. CAMO Statutory Certificates (CoA / Insurance / Checks)
    const acList = camoList.length > 0 ? camoList : fleet;
    let acValid = 0;
    let acIssues = 0;
    acList.forEach((ac) => {
      const coaDays = ac.coaExpiry ? daysUntil(ac.coaExpiry) : 999;
      const insDays = ac.insuranceExpiry ? daysUntil(ac.insuranceExpiry) : 999;
      const chkDays = ac.nextCheckDate ? daysUntil(ac.nextCheckDate) : 999;
      if (coaDays < 0 || insDays < 0 || chkDays < 0 || ac.status === "GROUNDED")
        acIssues++;
      else acValid++;
    });
    const camoPct =
      acList.length > 0 ? Math.round((acValid / acList.length) * 100) : 100;

    // 3. MEL Deferred Defects
    const openMel = melList.filter(
      (m) => String(m.status || "").toUpperCase() === "OPEN"
    );
    const overdueMel = openMel.filter(
      (m) => m.dueDate && daysUntil(m.dueDate) < 0
    );
    const melPct =
      openMel.length === 0
        ? 100
        : Math.max(
            0,
            Math.round(
              ((openMel.length - overdueMel.length) / openMel.length) * 100
            )
          );

    // 4. Crew Training & Recurrent Qualifications
    const trWithExp = training.filter((tr) => Boolean(tr.expiryDate));
    const trExpired = trWithExp.filter(
      (tr) => daysUntil(tr.expiryDate) < 0
    ).length;
    const trainingPct =
      trWithExp.length > 0
        ? Math.round(((trWithExp.length - trExpired) / trWithExp.length) * 100)
        : 100;

    // 5. Controlled Operations Manuals
    const activeManuals = manuals.filter(
      (m) => String(m.status || "active").toLowerCase() !== "archived"
    );
    const manualsPct = activeManuals.length > 0 ? 100 : 95;

    return [
      {
        id: "crew_docs",
        domainAr: "رخص وشهادات الطاقم الطبية",
        domainEn: "Crew Licenses & Medical Certificates",
        standard: "ICAO Annex 1 / Part-MED",
        total: activeCrew.length,
        compliant: crewValid,
        nonCompliant: crewIssues,
        pct: crewPct,
        targetTab: "crew",
        canOpen: can("crew.view"),
      },
      {
        id: "camo_airworthiness",
        domainAr: "صلاحية الأسطول وشهادات الطائرات (CAMO)",
        domainEn: "Continuous Airworthiness & Aircraft Certificates",
        standard: "Part-CAMO / ICAO Annex 8",
        total: acList.length,
        compliant: acValid,
        nonCompliant: acIssues,
        pct: camoPct,
        targetTab: "camo",
        canOpen: can("camo.view"),
      },
      {
        id: "mel_control",
        domainAr: "الأعطال المؤجلة (MEL) والمهل الزمنية",
        domainEn: "Minimum Equipment List (MEL) Control",
        standard: "MMEL / ORO.MLR.105",
        total: melList.length,
        compliant: Math.max(0, melList.length - overdueMel.length),
        nonCompliant: overdueMel.length,
        pct: melPct,
        targetTab: "camo",
        canOpen: can("camo.view") || can("mel.view"),
      },
      {
        id: "crew_training",
        domainAr: "التدريب الدوري والفحوصات التشبيهية (OPC/LPC)",
        domainEn: "Crew Recurrent Training & Simulator Checks",
        standard: "ORO.FC / Part-FCL",
        total: training.length,
        compliant: Math.max(0, training.length - trExpired),
        nonCompliant: trExpired,
        pct: trainingPct,
        targetTab: "training",
        canOpen: can("training.view"),
      },
      {
        id: "ops_manuals",
        domainAr: "الأدلة التشغيلية والوثائق المعتمدة",
        domainEn: "Controlled Operations Manuals (OM-A/B/C/D)",
        standard: "ORO.MLR.100",
        total: manuals.length,
        compliant: activeManuals.length,
        nonCompliant: 0,
        pct: manualsPct,
        targetTab: "manuals",
        canOpen: can("manuals.view") || can("schedule.view"),
      },
      {
        id: "qms_capa",
        domainAr: "سجل التدقيق الداخلي والإجراءات التصحيحية (CAPA)",
        domainEn: "Internal Audits & CAPA Closure",
        standard: "ORO.GEN.200 QMS",
        total: auditStats.total,
        compliant: auditStats.closed,
        nonCompliant: auditStats.overdue,
        pct: auditStats.closurePct,
        targetTab: "__audits__",
        canOpen: canViewAudits,
      },
    ];
  }, [
    crew,
    camoList,
    fleet,
    melList,
    training,
    manuals,
    auditStats,
    can,
    canViewAudits,
  ]);

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Top Header Bar — Quality Management System (QMS) ═══ */}
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
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2
              className="text-lg sm:text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {isAr
                ? "إدارة الجودة والامتثال (Quality Management)"
                : "Quality Management System (QMS)"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? `منظومة ضمان الجودة والتدقيق والامتثال مع داشبورد مخصص · ${getRoleLabel(
                    user?.role,
                    lang
                  )}`
                : `Aviation quality assurance, CAPA control & dedicated customizable dashboard · ${getRoleLabel(
                    user?.role,
                    lang
                  )}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden xl:block me-1">
            <LiveClock />
          </div>

          {/* Segmented Section Tabs: Dedicated Quality Dashboard | Audits & CAPA | Compliance Matrix */}
          <div
            className="flex items-center rounded-lg p-1 text-xs flex-wrap gap-1"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            {canViewDashboard && (
              <button
                type="button"
                onClick={() => setSubView("dashboards")}
                className="px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                style={
                  subView === "dashboards"
                    ? {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--brand-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                <Gauge className="w-3.5 h-3.5" />
                {isAr ? "داشبورد الجودة" : "Quality Dashboard"}
              </button>
            )}

            {canViewAudits && (
              <button
                type="button"
                onClick={() => setSubView("audits")}
                className="px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
                style={
                  subView === "audits"
                    ? {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--brand-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                <ClipboardList className="w-3.5 h-3.5" />
                {isAr ? "التدقيق و CAPA" : "Audits & CAPA"}
                <span className="font-mono tabular-nums text-[10px] opacity-80">
                  ({auditStats.open})
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubView("matrix")}
              className="px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
              style={
                subView === "matrix"
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--brand-primary)",
                      boxShadow: "var(--shadow-sm)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              <Layers className="w-3.5 h-3.5" />
              {isAr ? "مصفوفة الامتثال" : "Compliance Matrix"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ SUB-VIEW 1: Dedicated Customizable Quality Dashboard ═══ */}
      {subView === "dashboards" && canViewDashboard && (
        <EmbeddedSectionDashboard
          scope="quality"
          defaultPresetKey="quality"
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
          manuals={manuals}
          permits={permits}
          cateringOrders={cateringOrders}
          qualityAudits={qualityAudits}
          auditLogs={auditLogs}
          loginHistory={loginHistory}
          settings={settings}
          syncStatus={syncStatus}
          onRefresh={onRefresh}
          setTab={setTab}
          onOpenAuditsView={() => setSubView("audits")}
          lang={lang}
        />
      )}

      {/* ═══ SUB-VIEW 2: Quality Audits & CAPA Findings ═══ */}
      {subView === "audits" && (
        <div className="space-y-4">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: isAr ? "إجمالي سجلات التدقيق" : "Total Audits & CAPA",
                val: auditStats.total,
                tone: "var(--text-primary)",
              },
              {
                label: isAr
                  ? "ملاحظات مفتوحة / قيد الإجراء"
                  : "Open / In Progress",
                val: auditStats.open,
                tone: "#D97706",
              },
              {
                label: isAr
                  ? "متجاوزة لتاريخ الاستحقاق"
                  : "Overdue Target Date",
                val: auditStats.overdue,
                tone: auditStats.overdue > 0 ? "#DC2626" : "#16A34A",
              },
              {
                label: isAr ? "نسبة الإغلاق الفعّال" : "CAPA Closure Rate",
                val: `${auditStats.closurePct}%`,
                tone: "#16A34A",
              },
            ].map((k, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl"
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

          {/* Filter & Action Toolbar */}
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search
                    className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder={
                      isAr
                        ? "بحث برقم المرجع، العنوان، القسم، الطائرة..."
                        : "Search by Ref No, title, department, aircraft..."
                    }
                    className="w-full ps-9 pe-3 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: "ALL", en: "All", ar: "الكل" },
                    { id: "OPEN", en: "Open", ar: "مفتوحة" },
                    { id: "IN_PROGRESS", en: "In Progress", ar: "قيد المعالجة" },
                    { id: "CLOSED", en: "Closed", ar: "مغلقة" },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setAuditStatusFilter(st.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0"
                      style={
                        auditStatusFilter === st.id
                          ? {
                              backgroundColor: "var(--brand-primary)",
                              color: "#ffffff",
                            }
                          : {
                              backgroundColor: "var(--bg-app)",
                              border: "1px solid var(--border-default)",
                              color: "var(--text-muted)",
                            }
                      }
                    >
                      {isAr ? st.ar : st.en}
                    </button>
                  ))}
                </div>

                <select
                  value={auditSevFilter}
                  onChange={(e) => setAuditSevFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="ALL">
                    {isAr ? "كل المستويات" : "All Severities"}
                  </option>
                  <option value="LEVEL_1">
                    {isAr ? "مستوى 1 (حرج)" : "Level 1 (Critical)"}
                  </option>
                  <option value="LEVEL_2">
                    {isAr ? "مستوى 2 (رئيسي)" : "Level 2 (Major)"}
                  </option>
                  <option value="OBSERVATION">
                    {isAr ? "ملاحظة تحسينية" : "Observation"}
                  </option>
                </select>
              </div>

              {canManageAudits && (
                <button
                  type="button"
                  onClick={openNewAuditModal}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-4 h-4" />
                  {isAr ? "تسجيل تدقيق / CAPA" : "Log Audit / CAPA"}
                </button>
              )}
            </div>

            {/* Audits Table */}
            {auditsLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-10 rounded-lg animate-pulse"
                    style={{ backgroundColor: "var(--bg-app)" }}
                  />
                ))}
              </div>
            ) : filteredAudits.length === 0 ? (
              <div
                className="py-12 px-4 rounded-xl text-center space-y-2.5"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                <CheckCircle2 className="w-9 h-9 mx-auto text-emerald-500 opacity-80" />
                <div className="text-sm font-bold">
                  {isAr
                    ? "لا توجد ملاحظات تدقيق مطابقة"
                    : "No quality audit findings match your filter"}
                </div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "سجّل نتائج التدقيق الداخلي أو الخارجي وخطط الإجراءات التصحيحية (CAPA) لمتابعتها."
                    : "Log internal/external audit findings and corrective action plans (CAPA) here."}
                </p>
                {canManageAudits && (
                  <button
                    type="button"
                    onClick={openNewAuditModal}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    <Plus className="w-4 h-4" />
                    {isAr ? "تسجيل أول ملاحظة تدقيق" : "Log First Audit Entry"}
                  </button>
                )}
              </div>
            ) : (
              <div
                className="overflow-x-auto rounded-lg"
                style={{ border: "1px solid var(--border-default)" }}
              >
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "var(--bg-app)",
                        borderBottom: "1px solid var(--border-default)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "المرجع" : "Ref No"}
                      </th>
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "العنوان والملاحظة" : "Finding / Audit Title"}
                      </th>
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "القسم" : "Department"}
                      </th>
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "المستوى" : "Severity"}
                      </th>
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "تاريخ الاستحقاق" : "Target Date"}
                      </th>
                      <th className="px-3 py-2.5 text-start font-bold">
                        {isAr ? "الحالة" : "Status"}
                      </th>
                      {canManageAudits && (
                        <th className="px-3 py-2.5 text-end font-bold">
                          {isAr ? "إجراءات" : "Actions"}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-default)]">
                    {filteredAudits.map((item) => {
                      const st = String(item.status || "OPEN").toUpperCase();
                      const sev = String(
                        item.severity || "LEVEL_2"
                      ).toUpperCase();
                      const isOverdue =
                        st !== "CLOSED" &&
                        item.targetDate &&
                        item.targetDate < todayISO();

                      return (
                        <tr
                          key={item.id}
                          className="transition hover:bg-slate-500/5"
                        >
                          <td
                            className="px-3 py-2.5 font-mono font-bold tabular-nums whitespace-nowrap"
                            style={{ color: "var(--brand-primary)" }}
                          >
                            {item.refNo || "—"}
                          </td>
                          <td className="px-3 py-2.5 max-w-xs">
                            <div
                              className="font-semibold truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {item.title}
                            </div>
                            {(item.correctiveAction || item.aircraftReg) && (
                              <div
                                className="text-[11px] truncate"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {item.aircraftReg ? `[${item.aircraftReg}] ` : ""}
                                {item.correctiveAction || ""}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {item.department}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                            <span
                              className={
                                sev === "LEVEL_1"
                                  ? "text-rose-600 dark:text-rose-400 font-bold"
                                  : sev === "LEVEL_2"
                                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                                  : "text-sky-600 dark:text-sky-400"
                              }
                            >
                              {sev === "LEVEL_1"
                                ? isAr
                                  ? "مستوى 1 (حرج)"
                                  : "Level 1"
                                : sev === "LEVEL_2"
                                ? isAr
                                  ? "مستوى 2 (رئيسي)"
                                  : "Level 2"
                                : isAr
                                ? "ملاحظة"
                                : "Obs"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={
                                isOverdue
                                  ? "text-rose-600 dark:text-rose-400 font-bold"
                                  : ""
                              }
                            >
                              {item.targetDate ? fmtDate(item.targetDate) : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                            <span
                              className={
                                st === "CLOSED"
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : st === "IN_PROGRESS"
                                  ? "text-sky-600 dark:text-sky-400 font-semibold"
                                  : "text-amber-600 dark:text-amber-400 font-semibold"
                              }
                            >
                              {st}
                            </span>
                          </td>
                          {canManageAudits && (
                            <td className="px-3 py-2.5 text-end whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {st !== "CLOSED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickCloseAudit(item)}
                                    className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                    title={
                                      isAr ? "إغلاق الملاحظة" : "Mark Closed"
                                    }
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditAuditModal(item)}
                                  className="p-1.5 rounded hover:opacity-80"
                                  style={{
                                    backgroundColor: "var(--bg-app)",
                                    color: "var(--text-primary)",
                                  }}
                                  title={isAr ? "تعديل" : "Edit"}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAudit(item)}
                                  className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                  title={isAr ? "حذف" : "Delete"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
          </div>
        </div>
      )}

      {/* ═══ SUB-VIEW 3: Live Operational Compliance Matrix ═══ */}
      {subView === "matrix" && (
        <div
          className="rounded-xl p-4 sm:p-5 space-y-4"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3
                className="text-sm sm:text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr
                  ? "مصفوفة الامتثال التشغيلي واللوائح القياسية"
                  : "Statutory & Operational Compliance Matrix"}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "قياس حي ومباشر لنسب الامتثال عبر جميع أقسام الطيران مع ربط مباشر بالسجلات المصدرية"
                  : "Real-time cross-departmental compliance evaluation linked directly to operational records"}
              </p>
            </div>
          </div>

          <div
            className="overflow-x-auto rounded-lg"
            style={{ border: "1px solid var(--border-default)" }}
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderBottom: "1px solid var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th className="px-3 py-2.5 text-start font-bold">
                    {isAr ? "مجال الامتثال" : "Compliance Domain"}
                  </th>
                  <th className="px-3 py-2.5 text-start font-bold">
                    {isAr ? "المرجع التنظيمي" : "Regulatory Standard"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-bold">
                    {isAr ? "إجمالي العناصر" : "Total"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-bold">
                    {isAr ? "مطابق" : "Compliant"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-bold">
                    {isAr ? "مخالفات / منتهي" : "Overdue / Issues"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-bold">
                    {isAr ? "نسبة الامتثال" : "Score"}
                  </th>
                  <th className="px-3 py-2.5 text-end font-bold">
                    {isAr ? "القسم" : "Module"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {complianceMatrix.map((row) => {
                  const statusTone =
                    row.pct >= 90
                      ? "text-emerald-600 dark:text-emerald-400"
                      : row.pct >= 75
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400";
                  return (
                    <tr key={row.id} className="hover:bg-slate-500/5">
                      <td
                        className="px-3 py-3 font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {isAr ? row.domainAr : row.domainEn}
                      </td>
                      <td
                        className="px-3 py-3 font-mono text-[11px] whitespace-nowrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {row.standard}
                      </td>
                      <td
                        className="px-3 py-3 text-end font-mono tabular-nums"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.total}
                      </td>
                      <td className="px-3 py-3 text-end font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                        {row.compliant}
                      </td>
                      <td
                        className={`px-3 py-3 text-end font-mono tabular-nums font-semibold ${
                          row.nonCompliant > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : ""
                        }`}
                        style={
                          row.nonCompliant === 0
                            ? { color: "var(--text-muted)" }
                            : undefined
                        }
                      >
                        {row.nonCompliant}
                      </td>
                      <td
                        className={`px-3 py-3 text-end font-mono tabular-nums font-bold ${statusTone}`}
                      >
                        {row.pct}%
                      </td>
                      <td className="px-3 py-3 text-end whitespace-nowrap">
                        {row.canOpen && (
                          <button
                            type="button"
                            onClick={() => {
                              if (row.targetTab === "__audits__") {
                                setSubView("audits");
                              } else {
                                setTab?.(row.targetTab);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition hover:opacity-85 whitespace-nowrap shrink-0"
                            style={{
                              backgroundColor: "var(--bg-app)",
                              border: "1px solid var(--border-default)",
                              color: "var(--brand-primary)",
                            }}
                          >
                            {isAr ? "فتح" : "Open"}
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Create / Edit Quality Audit & CAPA Modal ═══ */}
      {auditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setAuditModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border-default)" }}
            >
              <h3 className="text-base font-bold">
                {editingAudit
                  ? isAr
                    ? "تعديل سجل التدقيق / CAPA"
                    : "Edit Quality Audit / CAPA"
                  : isAr
                  ? "تسجيل ملاحظة تدقيق جودة جديدة (CAPA)"
                  : "Log Quality Audit / CAPA Finding"}
              </h3>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="p-1.5 rounded-lg"
                style={{
                  backgroundColor: "var(--bg-app)",
                  color: "var(--text-muted)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAudit}
              className="p-5 overflow-y-auto flex-1 space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "رقم المرجع" : "Reference No"}
                  </label>
                  <input
                    type="text"
                    value={auditForm.refNo}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, refNo: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg font-mono outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "نوع التدقيق" : "Audit Type"}
                  </label>
                  <select
                    value={auditForm.auditType}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, auditType: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="Internal Audit">Internal Audit</option>
                    <option value="CAA / Authority Inspection">
                      CAA / Authority Inspection
                    </option>
                    <option value="Ramp / SAFA Inspection">
                      Ramp / SAFA Inspection
                    </option>
                    <option value="CAMO Quality Review">
                      CAMO Quality Review
                    </option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "القسم المعني" : "Department"}
                  </label>
                  <select
                    value={auditForm.department}
                    onChange={(e) =>
                      setAuditForm((p) => ({
                        ...p,
                        department: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold block">
                  {isAr ? "عنوان الملاحظة / عدم المطابقة *" : "Finding Title *"}
                </label>
                <input
                  type="text"
                  value={auditForm.title}
                  onChange={(e) =>
                    setAuditForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder={
                    isAr
                      ? "وصف واضح ومختصر لملاحظة الجودة..."
                      : "Concise description of non-conformity or observation..."
                  }
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "مستوى الأهمية" : "Severity"}
                  </label>
                  <select
                    value={auditForm.severity}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, severity: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="LEVEL_1">Level 1 — Critical</option>
                    <option value="LEVEL_2">Level 2 — Major</option>
                    <option value="OBSERVATION">Observation</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "الحالة" : "Status"}
                  </label>
                  <select
                    value={auditForm.status}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, status: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "تاريخ الاستحقاق" : "Target Closure Date"}
                  </label>
                  <input
                    type="date"
                    value={auditForm.targetDate}
                    onChange={(e) =>
                      setAuditForm((p) => ({
                        ...p,
                        targetDate: e.target.value,
                      }))
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "المسؤول عن التنفيذ" : "Responsible Assignee"}
                  </label>
                  <input
                    type="text"
                    value={auditForm.assignee}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, assignee: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "تسجيل الطائرة (اختياري)" : "Aircraft Reg"}
                  </label>
                  <select
                    value={auditForm.aircraftReg}
                    onChange={(e) =>
                      setAuditForm((p) => ({
                        ...p,
                        aircraftReg: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg font-mono outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">—</option>
                    {fleet.map((ac) => (
                      <option key={ac.id || ac.reg} value={ac.reg}>
                        {ac.reg}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold block">
                    {isAr ? "المدقق" : "Auditor"}
                  </label>
                  <input
                    type="text"
                    value={auditForm.auditor}
                    onChange={(e) =>
                      setAuditForm((p) => ({ ...p, auditor: e.target.value }))
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

              <div className="space-y-1">
                <label className="font-bold block">
                  {isAr ? "تحليل السبب الجذري (Root Cause)" : "Root Cause Analysis"}
                </label>
                <textarea
                  rows={2}
                  value={auditForm.rootCause}
                  onChange={(e) =>
                    setAuditForm((p) => ({ ...p, rootCause: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold block">
                  {isAr
                    ? "الإجراء التصحيحي / الوقائي (CAPA)"
                    : "Corrective & Preventive Action (CAPA)"}
                </label>
                <textarea
                  rows={2}
                  value={auditForm.correctiveAction}
                  onChange={(e) =>
                    setAuditForm((p) => ({
                      ...p,
                      correctiveAction: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div
                className="pt-3 flex items-center justify-end gap-2"
                style={{ borderTop: "1px solid var(--border-default)" }}
              >
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-bold whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={savingAudit}
                  className="px-4 py-2 rounded-lg font-bold text-white flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Save className="w-4 h-4" />
                  {savingAudit ? "…" : isAr ? "حفظ ومزامنة" : "Save & Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default QualityDashboardModule;
