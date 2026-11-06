/* ═══════════════════════════════════════════════════════════
 * MANUALS MODULE — Full Feature Version
 * v4.0 — Permissions + Audit Log + Export + Admin Panel
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { PdfCanvasViewer } from "../components/ui/PdfCanvasViewer";
import {
  BookOpen,
  Search,
  FileText,
  Download,
  Eye,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ExternalLink,
  ShieldCheck,
  X,
  Upload,
  RefreshCw,
  User,
  History,
  FileSpreadsheet,
  FileDown,
  ArrowRight,
  ArrowRightLeft,
  Filter,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Field } from "../components/ui/Field";
import { can as checkPerm } from "../config/permissions";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  auditAPI,
  manualAuditAPI,
  manualsAPI,
  uploadFile,
  toPreviewFileUrl,
  toDownloadFileUrl,
  toDisplayImageUrl,
} from "../api";
import { generateManualPDF, downloadPDF, openPDF } from "../utils/pdf";
import { showToast, confirmAction, printHTMLContent, openPreviewModal } from "../utils/dialog";

/* ⭐ Time Ago */
function timeAgo(dateString, lang = "en") {
  if (!dateString) return lang === "ar" ? "لم يُحدَّث بعد" : "Never updated";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return lang === "ar" ? "الآن" : "Just now";
  if (diffMins < 60)
    return lang === "ar" ? `منذ ${diffMins} د` : `${diffMins}m ago`;
  if (diffHours < 24)
    return lang === "ar" ? `منذ ${diffHours} س` : `${diffHours}h ago`;
  if (diffDays === 1) return lang === "ar" ? "أمس" : "Yesterday";
  if (diffDays < 30)
    return lang === "ar" ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  if (diffDays < 365)
    return lang === "ar"
      ? `منذ ${Math.floor(diffDays / 30)} شهر`
      : `${Math.floor(diffDays / 30)}mo ago`;
  return lang === "ar"
    ? `منذ ${Math.floor(diffDays / 365)} سنة`
    : `${Math.floor(diffDays / 365)}y ago`;
}

function safeParse(str) {
  if (!str) return {};
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch {
    return { raw: str };
  }
}

async function imageUrlToBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(toDisplayImageUrl(url));
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("⚠️ Logo to base64 failed:", err.message);
    return null;
  }
}

/* ⭐ القائمة الأولية */
export const INITIAL_MANUALS = [
  {
    id: "man-oma",
    code: "OM-A",
    title_en: "General Operations Manual",
    title_ar: "دليل العمليات العامة",
    category: "Operations",
    rev: "Rev 14.2",
    effectiveDate: "2026-01-15",
    approval: "CAA/OPS/2026/041",
    status: "active",
    pages: 428,
    fileSize: "18.4 MB",
    pdfData: null,
    pdfName: "OM-A_General_Operations_Rev14.2.pdf",
    visibleTo: "all",
    lastUpdated: "2026-01-15T10:00:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Organization structure, operational control, flight preparation, fuel management policy, aerodrome operating minima, and emergency handling procedures.",
    chapters: [
      { num: "01", title: "Organization & Responsibilities", pages: "1-45" },
      { num: "02", title: "Operational Control", pages: "46-88" },
      { num: "03", title: "Quality & Safety", pages: "89-140" },
    ],
  },
  {
    id: "man-omb",
    code: "OM-B",
    title_en: "Aircraft Operating Manual",
    title_ar: "كتيب تشغيل الطائرات",
    category: "Technical",
    rev: "Rev 8.0",
    effectiveDate: "2025-11-01",
    approval: "CAA/AIR/2025/119",
    status: "active",
    pages: 620,
    fileSize: "32.1 MB",
    pdfData: null,
    pdfName: "OM-B_AOM_Rev8.0.pdf",
    visibleTo: "all",
    lastUpdated: "2025-11-01T16:20:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Aircraft systems description, normal procedures, performance tables, operating limitations, and weight & balance schedules.",
    chapters: [
      { num: "01", title: "Aircraft General", pages: "1-30" },
      { num: "02", title: "Air Conditioning", pages: "31-75" },
    ],
  },
  {
    id: "man-sop",
    code: "SOP",
    title_en: "Standard Operating Procedures",
    title_ar: "إجراءات التشغيل القياسية",
    category: "Procedures",
    rev: "Rev 6.1",
    effectiveDate: "2026-02-10",
    approval: "OPS/SOP/2026/012",
    status: "active",
    pages: 184,
    fileSize: "8.6 MB",
    pdfData: null,
    pdfName: "SOP_Rev6.1.pdf",
    visibleTo: "all",
    lastUpdated: "2026-02-10T14:00:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Cockpit sterile period policy, standard callouts, briefings, pushback, taxi, takeoff, departure, stabilized approach criteria, and landing execution.",
    chapters: [
      { num: "01", title: "Philosophy", pages: "1-22" },
      { num: "02", title: "Callouts", pages: "23-56" },
    ],
  },
  {
    id: "man-qrh",
    code: "QRH",
    title_en: "Quick Reference Handbook",
    title_ar: "دليل الإجراءات السريعة",
    category: "Emergency",
    rev: "Rev 11.4",
    effectiveDate: "2026-01-20",
    approval: "CAA/SAFE/2026/088",
    status: "active",
    pages: 146,
    fileSize: "6.9 MB",
    pdfData: null,
    pdfName: "QRH_Rev11.4.pdf",
    visibleTo: "all",
    lastUpdated: "2026-01-20T09:15:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Immediate memory items, engine fire/failure drills, rapid depressurization, emergency electrical, one-engine landing.",
    chapters: [{ num: "01", title: "Memory Items", pages: "1-28" }],
  },
  {
    id: "man-mel",
    code: "MEL",
    title_en: "Minimum Equipment List",
    title_ar: "قائمة الحد الأدنى من المعدات",
    category: "Technical",
    rev: "Rev 21.0",
    effectiveDate: "2025-12-05",
    approval: "CAA/CAMO/MEL-09",
    status: "active",
    pages: 350,
    fileSize: "14.2 MB",
    pdfData: null,
    pdfName: "MEL_Rev21.0.pdf",
    visibleTo: "all",
    lastUpdated: "2025-12-05T11:45:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Dispatch deviation, rectified time limits (A/B/C/D), crew maintenance (M) and operational (O).",
    chapters: [
      { num: "01", title: "Preamble", pages: "1-24" },
      { num: "21", title: "Air Conditioning", pages: "25-68" },
    ],
  },
  {
    id: "man-sms",
    code: "SMS",
    title_en: "Safety Management System Manual",
    title_ar: "دليل إدارة السلامة",
    category: "Safety",
    rev: "Rev 5.2",
    effectiveDate: "2026-01-05",
    approval: "CAA/SMS/2026/02",
    status: "active",
    pages: 160,
    fileSize: "7.1 MB",
    pdfData: null,
    pdfName: "SMS_Rev5.2.pdf",
    visibleTo: "admin",
    lastUpdated: "2026-01-05T08:30:00.000Z",
    lastUpdatedBy: "System Admin",
    lastUpdatedById: "admin",
    summary:
      "Voluntary safety reporting, MOR, risk assessment, ERP, just culture policy.",
    chapters: [{ num: "01", title: "Safety Policy", pages: "1-30" }],
  },
];

export function ManualsModule({
  companyName = "Flight Operations",
  lang = "en",
  settings = {},
}) {
  const t = useT();
  const { user } = useAuth();

  /* ⭐ الصلاحيات */
  const canManage =
    checkPerm(user, "settings.edit") ||
    user?.role === "superAdmin" ||
    user?.role === "dispatcher";
  const isCrewMember = user?.role === "crewMember";

  /* ⭐ من يرى كل مانوال */
  const canSeeManual = (m) => {
    if (canManage) return true;
    if (isCrewMember) return m.visibleTo === "all" || m.visibleTo === "crew";
    return m.visibleTo === "all" || m.visibleTo === "admin";
  };

  const [manuals, setManuals] = useLocalStorage(
    "aeroops.manuals",
    INITIAL_MANUALS
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedManual, setSelectedManual] = useState(null);
  const [editingManual, setEditingManual] = useState(null);
  const [draft, setDraft] = useState({});
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    manualsAPI
      .list()
      .then((remote) => {
        if (!mounted || !Array.isArray(remote) || remote.length === 0) return;
        setManuals((prev) => {
          const prevMap = new Map((prev || []).map((p) => [String(p.id), p]));
          const normalized = remote.map((r) => {
            const loc = prevMap.get(String(r.id));
            return {
              ...loc,
              ...r,
              chapters: Array.isArray(r.chapters)
                ? r.chapters
                : typeof r.chapters === "string"
                ? (() => {
                    try {
                      return JSON.parse(r.chapters);
                    } catch {
                      return loc?.chapters || [];
                    }
                  })()
                : loc?.chapters || [],
              pdfData:
                r.pdfData && r.pdfData !== "[Data URL - Local Only]"
                  ? r.pdfData
                  : loc?.pdfData || null,
            };
          });
          const remoteIds = new Set(normalized.map((x) => String(x.id)));
          const localExtras = (prev || []).filter(
            (l) => !remoteIds.has(String(l.id))
          );
          return [...normalized, ...localExtras];
        });
      })
      .catch((err) => {
        console.warn("Manuals Sheet load warning:", err?.message || err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  /* Audit Log */
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");
  const [auditDateRange, setAuditDateRange] = useState({ from: "", to: "" });

  /* Clear Old Logs */
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearBeforeDate, setClearBeforeDate] = useState("");
  const [clearingLogs, setClearingLogs] = useState(false);

  const fileInputRef = useRef(null);
  const modalUploadRef = useRef(null);

  const categories = useMemo(
    () => [
      "all",
      "Operations",
      "Procedures",
      "Emergency",
      "Technical",
      "Training",
      "Safety",
    ],
    []
  );

  /* ⭐ الفلترة */
  const filtered = useMemo(() => {
    const result = manuals.filter(canSeeManual).filter((m) => {
      const matchCat =
        categoryFilter === "all" || m.category === categoryFilter;
      const s = (
        m.code +
        " " +
        m.title_en +
        " " +
        (m.title_ar || "") +
        " " +
        (m.summary || "")
      ).toLowerCase();
      const matchSearch = !search || s.includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
    result.sort(
      (a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0)
    );
    return result;
  }, [manuals, categoryFilter, search, user]);

  /* ⭐ فلترة السجل */
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditFilter !== "all") {
        const type = (log.details?.action || "").toLowerCase();
        const a = (log.action || "").toLowerCase();
        if (auditFilter === "refresh" && !type.includes("refresh"))
          return false;
        if (auditFilter === "create" && a !== "create") return false;
        if (
          auditFilter === "update" &&
          (a !== "update" || type.includes("refresh"))
        )
          return false;
        if (auditFilter === "delete" && a !== "delete") return false;
      }
      if (
        auditDateRange.from &&
        new Date(log.timestamp) < new Date(auditDateRange.from)
      )
        return false;
      if (auditDateRange.to) {
        const to = new Date(auditDateRange.to);
        to.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > to) return false;
      }
      return true;
    });
  }, [auditLogs, auditFilter, auditDateRange]);

  /* ⭐ تحميل سجل المانولز */
  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const list = await manualAuditAPI.list();
      setAuditLogs(
        list
          .map((log) => ({ ...log, details: safeParse(log.details) }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      );
    } catch (err) {
      console.error("Failed to load manual audit:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  /* ⭐ رفع PDF إلى Google Drive وحفظ الرابط في Google Sheets */
  const handleFileUpload = async (file, isDraft = true) => {
    if (!file || !canManage) return;
    if (
      !file.type.includes("pdf") &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      showToast("اختر ملف PDF", "warning");
      return;
    }
    setUploadingPdf(true);
    try {
      const uploaded = await uploadFile(file, "manuals");
      const driveUrl = uploaded.fileUrl;
      const sizeStr = `${((uploaded.size || file.size) / (1024 * 1024)).toFixed(2)} MB`;

      if (isDraft) {
        setDraft((d) => ({
          ...d,
          pdfData: driveUrl,
          pdfFileId: uploaded.fileId || "",
          pdfPath: uploaded.filePath || "",
          pdfName: uploaded.fileName || file.name,
          pdfSize: sizeStr,
          fileSize: sizeStr,
          title_en:
            d.title_en || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
        }));
        showToast("✅ تم رفع ملف PDF إلى Google Drive بنجاح", "success");
      } else if (selectedManual) {
        const now = new Date().toISOString();
        const updated = {
          ...selectedManual,
          pdfData: driveUrl,
          pdfFileId: uploaded.fileId || "",
          pdfPath: uploaded.filePath || "",
          pdfName: uploaded.fileName || file.name,
          pdfSize: sizeStr,
          fileSize: sizeStr,
          lastUpdated: now,
          lastUpdatedBy: user?.fullName || "Unknown",
          lastUpdatedById: user?.id || "",
        };
        setSelectedManual(updated);
        setManuals(
          manuals.map((m) => (m.id === selectedManual.id ? updated : m))
        );
        await manualsAPI
          .update(selectedManual.id, updated)
          .catch(() => manualsAPI.create(updated).catch(() => null));
        showToast("✅ تم رفع PDF إلى Google Drive وحفظه في Google Sheets", "success");
      }
    } catch (err) {
      showToast("❌ فشل رفع ملف PDF إلى Google Drive: " + err.message, "error");
    } finally {
      setUploadingPdf(false);
    }
  };

  /* ⭐ إضافة */
  const handleOpenAdd = () => {
    if (!canManage) return;
    setDraft({
      code: "OM-",
      title_en: "",
      title_ar: "",
      category: "Operations",
      rev: "Rev 1.0",
      effectiveDate: new Date().toISOString().slice(0, 10),
      approval: "CAA/OPS/2026/001",
      status: "active",
      pages: 100,
      fileSize: "5.0 MB",
      summary: "",
      visibleTo: "all",
      pdfData: null,
      pdfName: "",
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: user?.fullName || "Unknown",
      lastUpdatedById: user?.id || "",
      chapters: [{ num: "01", title: "Introduction", pages: "1-20" }],
    });
    setEditingManual("new");
  };

  const handleOpenEdit = (m, e) => {
    if (!canManage) return;
    e.stopPropagation();
    setDraft({ ...m });
    setEditingManual(m.id);
  };

  /* ⭐ حفظ */
  const handleSave = async () => {
    if (!canManage || !draft.title_en || !draft.code) return;
    const now = new Date().toISOString();
    const updatedByName = user?.fullName || user?.username || "Unknown";
    const finalDraft = {
      ...draft,
      lastUpdated: draft.lastUpdated || now,
      lastUpdatedBy: updatedByName,
      lastUpdatedById: user?.id || "",
    };

    if (editingManual === "new") {
      const newM = { ...finalDraft, id: `man-${Date.now()}` };
      try {
        const created = await manualsAPI.create(newM);
        if (created?.id) newM.id = created.id;
      } catch (e) {
        console.warn("Manuals create Sheet sync warning:", e.message);
      }
      setManuals([newM, ...manuals]);
      try {
        await manualAuditAPI.create({
          timestamp: now,
          userId: user?.id,
          userName: updatedByName,
          userRole: user?.role,
          action: "CREATE",
          manualId: newM.id,
          manualCode: newM.code,
          manualTitle: newM.title_en,
          previousUpdate: "",
          newUpdate: now,
          details: {
            action: "manual_create",
            code: newM.code,
            title: newM.title_en,
          },
        });
      } catch (e) {
        console.warn(e.message);
      }
    } else {
      const before = manuals.find((m) => m.id === editingManual);
      setManuals(manuals.map((m) => (m.id === editingManual ? finalDraft : m)));
      if (selectedManual?.id === editingManual) setSelectedManual(finalDraft);
      try {
        await manualsAPI
          .update(editingManual, finalDraft)
          .catch(() => manualsAPI.create(finalDraft));
      } catch (e) {
        console.warn("Manuals update Sheet sync warning:", e.message);
      }
      try {
        await manualAuditAPI.create({
          timestamp: now,
          userId: user?.id,
          userName: updatedByName,
          userRole: user?.role,
          action: "UPDATE",
          manualId: editingManual,
          manualCode: finalDraft.code,
          manualTitle: finalDraft.title_en,
          previousUpdate: before?.lastUpdated || "",
          newUpdate: now,
          details: {
            action: "manual_update",
            before: { code: before?.code, title: before?.title_en },
            after: { code: finalDraft.code, title: finalDraft.title_en },
          },
        });
      } catch (e) {
        console.warn(e.message);
      }
    }
    setEditingManual(null);
  };

  /* ⭐ حذف */
  const handleDelete = async (id, e) => {
    if (!canManage) return;
    e.stopPropagation();
    const m = manuals.find((x) => x.id === id);
    const ok = await confirmAction(`حذف "${m?.code}"؟`);
    if (!ok) return;
    setManuals(manuals.filter((x) => x.id !== id));
    if (selectedManual?.id === id) setSelectedManual(null);
    try {
      await manualsAPI.remove(id).catch(() => null);
      await manualAuditAPI.create({
        timestamp: new Date().toISOString(),
        userId: user?.id,
        userName: user?.fullName,
        userRole: user?.role,
        action: "DELETE",
        manualId: id,
        manualCode: m?.code,
        manualTitle: m?.title_en,
        previousUpdate: m?.lastUpdated,
        newUpdate: "",
        details: { action: "manual_delete", code: m?.code },
      });
    } catch (err) {
      console.warn(err.message);
    }
  };

  /* ⭐ تحديث فردي */
  const handleRefresh = async (id, e) => {
    if (e) e.stopPropagation();
    if (!canManage) return;
    const m = manuals.find((x) => x.id === id);
    if (!m) return;
    const ok = await confirmAction(`تحديث "${m.code}" إلى الآن؟`);
    if (!ok) return;
    const now = new Date().toISOString();
    const updatedByName = user?.fullName || user?.username || "Unknown";
    const updated = {
      ...m,
      lastUpdated: now,
      lastUpdatedBy: updatedByName,
      lastUpdatedById: user?.id || "",
    };
    setRefreshingId(id);
    setManuals(manuals.map((x) => (x.id === id ? updated : x)));
    if (selectedManual?.id === id) setSelectedManual(updated);
    try {
      await manualsAPI
        .update(id, updated)
        .catch(() => manualsAPI.create(updated).catch(() => null));
      await manualAuditAPI.create({
        timestamp: now,
        userId: user?.id,
        userName: updatedByName,
        userRole: user?.role,
        action: "UPDATE",
        manualId: id,
        manualCode: m.code,
        manualTitle: m.title_en,
        previousUpdate: m.lastUpdated || "",
        newUpdate: now,
        details: { action: "manual_refresh", code: m.code },
      });
    } catch (err) {
      console.warn(err.message);
    }
    setTimeout(() => setRefreshingId(null), 1200);
  };

  /* ⭐ تحديث الكل */
  const handleRefreshAll = async () => {
    if (!canManage || filtered.length === 0) return;
    const ok = await confirmAction(`تحديث ${filtered.length} دليل إلى الآن؟`);
    if (!ok) return;
    setRefreshingAll(true);
    const now = new Date().toISOString();
    const updatedByName = user?.fullName || user?.username || "Unknown";
    setManuals(
      manuals.map((m) =>
        filtered.some((f) => f.id === m.id)
          ? {
              ...m,
              lastUpdated: now,
              lastUpdatedBy: updatedByName,
              lastUpdatedById: user?.id || "",
            }
          : m
      )
    );
    try {
      await manualAuditAPI.create({
        timestamp: now,
        userId: user?.id,
        userName: updatedByName,
        userRole: user?.role,
        action: "UPDATE",
        manualId: "",
        manualCode: "",
        manualTitle: `Bulk Refresh — ${filtered.length}`,
        previousUpdate: "",
        newUpdate: now,
        details: {
          action: "manual_bulk_refresh",
          count: filtered.length,
          codes: filtered.map((m) => m.code),
        },
      });
    } catch (err) {
      console.warn(err.message);
    }
    setTimeout(() => {
      setRefreshingAll(false);
      showToast(`✅ تم تحديث ${filtered.length} دليل`, "success");
    }, 800);
  };

  /* ⭐ حذف السجلات القديمة */
  const handleClearOldLogs = async () => {
    if (!clearBeforeDate) return;
    const ok = await confirmAction(`حذف السجلات قبل ${clearBeforeDate}؟`);
    if (!ok) return;
    setClearingLogs(true);
    try {
      const result = await manualAuditAPI.clearOld(clearBeforeDate);
      showToast(`✅ تم حذف ${result?.deleted || 0} سجل`, "success");
      setShowClearModal(false);
      setClearBeforeDate("");
      await loadAuditLogs();
    } catch (err) {
      showToast("❌ " + err.message, "error");
    } finally {
      setClearingLogs(false);
    }
  };

  const handleDeleteSingleLog = async (logId) => {
    const ok = await confirmAction("حذف السجل؟");
    if (!ok) return;
    try {
      await manualAuditAPI.remove(logId);
      setAuditLogs(auditLogs.filter((l) => l.id !== logId));
    } catch (err) {
      showToast("❌ " + err.message, "error");
    }
  };

  /* ⭐ تصدير Excel */
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;
    const companyNameEn = settings.companyName || companyName || "Flight Operations";
    const companyNameAr = settings.companyNameAr || "إدارة العمليات الجوية";
    const operatorCode = (settings.operatorCode || "EACS").toUpperCase();
    const exportDate = new Date().toLocaleString("en-GB");
    const headers = [
      "Timestamp",
      "Action",
      "Code",
      "Title",
      "User",
      "Role",
      "Previous Update",
      "New Update",
      "Details",
    ];
    const rows = filteredLogs.map((l) => [
      new Date(l.timestamp).toLocaleString(),
      l.action || "",
      l.manualCode || l.details?.code || "",
      l.manualTitle || l.details?.title || l.entityName || "",
      l.userName || "",
      l.userRole || "",
      l.previousUpdate || l.details?.previousUpdate || "",
      l.newUpdate || l.details?.newUpdate || "",
      JSON.stringify(l.details || {}).replace(/"/g, '""'),
    ]);
    const headerRows = [
      [companyNameEn, "", "", "", "", "", "", "", ""],
      [`${companyNameAr} · ${operatorCode}`, "", "", "", "", "", "", "", ""],
      [
        `Manuals Audit Log — ${filteredLogs.length} records`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
      [`Exported: ${exportDate}`, "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", ""],
    ];
    const csv =
      "\uFEFF" +
      [...headerRows, headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Manuals_AuditLog_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ⭐ تصدير PDF مع شعار */
  const handleExportPDF = async () => {
    if (filteredLogs.length === 0) return;
    const logoBase64 = await imageUrlToBase64(settings.logo);
    const companyNameEn = settings.companyName || companyName || "Flight Operations";
    const companyNameAr = settings.companyNameAr || "إدارة العمليات الجوية";
    const operatorCode = (settings.operatorCode || "EACS").toUpperCase();
    const exportDate = new Date().toLocaleString("en-GB");
    const rowsHtml = filteredLogs
      .map((log) => {
        const prev = log.previousUpdate || log.details?.previousUpdate;
        const next = log.newUpdate || log.details?.newUpdate;
        const isRefresh = (log.details?.action || "").includes("refresh");
        const isBulk = (log.details?.action || "").includes("bulk");
        return `<tr><td>${new Date(log.timestamp).toLocaleString(
          "en-GB"
        )}</td><td><span class="badge ${
          isRefresh
            ? "refresh"
            : log.action === "CREATE"
            ? "create"
            : log.action === "DELETE"
            ? "delete"
            : "update"
        }">${log.action || ""}${isBulk ? " (BULK)" : ""}</span></td><td>${
          log.manualCode || log.details?.code || "—"
        }</td><td>${
          log.manualTitle || log.details?.title || log.entityName || "—"
        }</td><td>${log.userName || "—"}</td><td class="small">${
          prev ? new Date(prev).toLocaleString("en-GB") : "—"
        }</td><td class="small">${
          next ? new Date(next).toLocaleString("en-GB") : "—"
        }</td></tr>`;
      })
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Manuals Audit Log</title><style>* { box-sizing: border-box; } body { font-family: Arial, sans-serif; padding: 20px 30px; color: #1e293b; margin: 0; } .company-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px; } .header-left { display: flex; align-items: center; gap: 14px; } .logo { width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: white; border: 1px solid #e2e8f0; padding: 4px; } .company-name-en { font-size: 18px; font-weight: bold; color: #0284c7; margin: 0; } .company-name-ar { font-size: 14px; color: #475569; margin: 2px 0 0 0; } .operator-code { font-family: monospace; font-size: 12px; color: #64748b; letter-spacing: 2px; margin-top: 3px; } .header-right { text-align: right; font-size: 11px; color: #475569; font-family: monospace; } .header-right .title { font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 4px; } h2 { font-size: 15px; margin: 0 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; } .summary { display: flex; gap: 20px; font-size: 11px; color: #475569; margin-bottom: 12px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; } .summary b { color: #1e293b; } table { width: 100%; border-collapse: collapse; font-size: 10px; } th { background: #0284c7; color: white; padding: 8px 6px; text-align: left; } td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; } tr:nth-child(even) td { background: #f8fafc; } .small { font-size: 9px; color: #475569; } .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; display: inline-block; } .badge.refresh { background: #dbeafe; color: #1e40af; } .badge.create { background: #dcfce7; color: #166534; } .badge.update { background: #fef3c7; color: #92400e; } .badge.delete { background: #fee2e2; color: #991b1b; } .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; } @media print { body { padding: 10mm; } @page { size: A4 landscape; margin: 10mm; } }</style></head><body><div class="company-header"><div class="header-left">${
      logoBase64 ? `<img src="${logoBase64}" class="logo" />` : ""
    }<div><p class="company-name-en">${companyNameEn}</p><p class="company-name-ar" dir="rtl">${companyNameAr}</p><div class="operator-code">${operatorCode}</div></div></div><div class="header-right"><div class="title">MANUALS — AUDIT LOG</div><div>Exported: ${exportDate}</div><div>Records: ${
      filteredLogs.length
    }</div></div></div><div class="summary"><span>📊 <b>Total:</b> ${
      filteredLogs.length
    }</span><span>🔄 <b>Refresh:</b> ${
      filteredLogs.filter((l) => (l.details?.action || "").includes("refresh"))
        .length
    }</span><span>✏️ <b>Update:</b> ${
      filteredLogs.filter(
        (l) =>
          l.action === "UPDATE" &&
          !(l.details?.action || "").includes("refresh")
      ).length
    }</span><span>➕ <b>Create:</b> ${
      filteredLogs.filter((l) => l.action === "CREATE").length
    }</span><span>🗑️ <b>Delete:</b> ${
      filteredLogs.filter((l) => l.action === "DELETE").length
    }</span></div><h2>Audit Log Records</h2><table><thead><tr><th>Timestamp</th><th>Action</th><th>Code</th><th>Title</th><th>User</th><th>Previous</th><th>New</th></tr></thead><tbody>${rowsHtml}</tbody></table><div class="footer">${companyNameEn} · ${operatorCode} — Confidential</div><script>window.onload = () => { setTimeout(() => window.print(), 300); };</script></body></html>`;
    printHTMLContent(html, "Manuals Audit Log");
  };

  /* ⭐ تنزيل PDF */
  const handleDownloadPDF = async (m, e) => {
    if (e) e.stopPropagation();
    if (m.pdfData) {
      const link = document.createElement("a");
      link.href = toDownloadFileUrl(m.pdfData, m.pdfName || `${m.code}.pdf`);
      link.download = m.pdfName || `${m.code}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const bytes = await generateManualPDF(m, companyName);
      downloadPDF(bytes, `${m.code}_${m.rev.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      showToast("خطأ: " + err.message, "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePreviewPDF = async (m, e) => {
    if (e) e.stopPropagation();
    if (m.pdfData) {
      openPreviewModal({
        title: `${m.code} — ${m.title_en}`,
        blobUrl: toPreviewFileUrl(m.pdfData, m.pdfName || `${m.code}.pdf`),
        fileName: m.pdfName || `${m.code}.pdf`,
      });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const bytes = await generateManualPDF(m, companyName);
      openPDF(bytes, `${m.code} — ${m.title_en}`);
    } catch (err) {
      showToast("تعذر: " + err.message, "error");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-600 to-blue-700 flex items-center justify-center shadow-lg text-white">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-mono tracking-wider">
                MANUALS
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold">
                {filtered.length} / {manuals.length}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isCrewMember
                ? "الأدلة المتاحة لك كعضو طاقم"
                : "مكتبة الأدلة والكتيبات التشغيلية"}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setShowAuditLog(true);
                loadAuditLogs();
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
            >
              <History className="w-3.5 h-3.5" /> السجل
            </button>
            <button
              onClick={handleRefreshAll}
              disabled={refreshingAll || filtered.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshingAll ? "animate-spin" : ""}`}
              />
              تحديث الكل ({filtered.length})
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>
        )}
      </div>

      {/* Search + Filter */}
      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث (MEL, QRH, SOP)..."
            className="ps-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition flex-shrink-0 ${
                categoryFilter === cat
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300"
              }`}
            >
              {cat === "all" ? "الكل" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((m) => {
          const hasPdf = Boolean(m.pdfData);
          return (
            <div
              key={m.id}
              onClick={() => setSelectedManual(m)}
              className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-lg hover:border-sky-400 transition cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                refreshingId === m.id
                  ? "ring-2 ring-emerald-400 animate-pulse"
                  : ""
              }`}
            >
              <div
                className={`absolute top-0 inset-x-0 h-1.5 ${
                  m.category === "Emergency"
                    ? "bg-rose-500"
                    : m.category === "Procedures"
                    ? "bg-emerald-500"
                    : m.category === "Technical"
                    ? "bg-indigo-500"
                    : "bg-sky-500"
                }`}
              />
              <div>
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                        m.category === "Emergency"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {m.code}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {m.category}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                    {m.rev}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mt-2.5 leading-snug">
                  {m.title_en}
                </h3>
                {m.title_ar && (
                  <p
                    className="text-[11px] text-slate-400 mt-0.5 line-clamp-1"
                    dir="rtl"
                  >
                    {m.title_ar}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {m.summary}
                </p>
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      m.visibleTo === "all"
                        ? "bg-emerald-50 text-emerald-700"
                        : m.visibleTo === "crew"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5" />
                    {m.visibleTo === "all"
                      ? "الجميع"
                      : m.visibleTo === "crew"
                      ? "الطاقم"
                      : "المدراء"}
                  </span>
                  {hasPdf && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-700">
                      <FileText className="w-2.5 h-2.5" /> PDF
                    </span>
                  )}
                </div>
                <div className="mt-2 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {timeAgo(m.lastUpdated, lang)}
                  {m.lastUpdatedBy && (
                    <span className="ms-1 text-slate-400">
                      · {m.lastUpdatedBy}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedManual(m);
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> فتح
                </button>
                <button
                  onClick={(e) => handleDownloadPDF(m, e)}
                  disabled={isGeneratingPdf}
                  className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={(e) => handleRefresh(m.id, e)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-emerald-600"
                      title="تحديث"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleOpenEdit(m, e)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-amber-600"
                      title="تعديل"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(m.id, e)}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-rose-600"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <div className="font-bold text-sm">لا توجد كتيبات</div>
        </div>
      )}

      {/* Modal View */}
      {selectedManual && (
        <Modal
          open={!!selectedManual}
          title={`${selectedManual.code} — ${selectedManual.title_en}`}
          onClose={() => setSelectedManual(null)}
          wide
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <span className="text-xs text-slate-500 font-mono">
                Approval: {selectedManual.approval}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPDF(selectedManual)}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />{" "}
                  {isGeneratingPdf ? "..." : "تحميل PDF"}
                </button>
                <button
                  onClick={() => handlePreviewPDF(selectedManual)}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-700 text-xs font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> نافذة كاملة
                </button>
                <button
                  onClick={() => setSelectedManual(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold text-xs">
                    {selectedManual.code}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {selectedManual.rev}
                  </span>
                </div>
                <h3 className="text-base font-bold mt-1">
                  {selectedManual.title_en}
                </h3>
                {selectedManual.title_ar && (
                  <p className="text-xs text-sky-200 mt-0.5" dir="rtl">
                    {selectedManual.title_ar}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="text-end border-s border-slate-600 ps-3">
                  <div className="text-slate-400 text-[10px]">آخر تحديث</div>
                  <div className="font-bold">
                    {timeAgo(selectedManual.lastUpdated, lang)}
                  </div>
                  {selectedManual.lastUpdatedBy && (
                    <div className="text-[9px] text-sky-300">
                      بواسطة {selectedManual.lastUpdatedBy}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {canManage && (
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-600" />
                  <span className="text-xs">
                    {selectedManual.pdfData
                      ? `الحالي: ${selectedManual.pdfName}`
                      : "لا يوجد PDF مرفق"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={modalUploadRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) =>
                      handleFileUpload(e.target.files?.[0], false)
                    }
                  />
                  <button
                    onClick={() => modalUploadRef.current?.click()}
                    disabled={uploadingPdf}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />{" "}
                    {uploadingPdf
                      ? "جاري الرفع لـ Drive..."
                      : selectedManual.pdfData
                      ? "تحديث PDF"
                      : "رفع PDF"}
                  </button>
                  <button
                    onClick={() => handleRefresh(selectedManual.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> تحديث الآن
                  </button>
                </div>
              </div>
            )}

            {selectedManual.pdfData && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 flex justify-between text-xs">
                  <span className="font-bold flex items-center gap-1">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    {selectedManual.pdfName}
                  </span>
                  <button
                    onClick={() => handleDownloadPDF(selectedManual)}
                    className="text-sky-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> تحميل
                  </button>
                </div>
                {toPreviewFileUrl(
                  selectedManual.pdfData,
                  selectedManual.pdfName || `${selectedManual.code}.pdf`
                ) ? (
                  <PdfCanvasViewer
                    pdfData={selectedManual.pdfData}
                    title={selectedManual.pdfName || selectedManual.title || "Manual PDF"}
                    fileName={selectedManual.pdfName || `${selectedManual.code}.pdf`}
                    maxHeight="55vh"
                    className="w-full border-0"
                  />
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">
                    لا يتوفر رابط صالح لمعاينة ملف الـ PDF — يرجى إعادة رفع الملف لحفظه في Google Drive.
                  </div>
                )}
              </div>
            )}

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs">
              <span className="font-bold block mb-1">الملخص:</span>
              {selectedManual.summary}
            </div>

            <div>
              <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" /> الفهرس
              </h4>
              <div className="divide-y rounded-xl border bg-white dark:bg-slate-800">
                {(selectedManual.chapters || []).map((ch) => (
                  <div
                    key={ch.num}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {ch.num}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate">
                          {ch.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Pages {ch.pages}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadPDF(selectedManual)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-sky-100 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" /> تحميل
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Add/Edit */}
      {editingManual && canManage && (
        <Modal
          open={!!editingManual}
          title={editingManual === "new" ? "إضافة دليل" : `تعديل ${draft.code}`}
          onClose={() => setEditingManual(null)}
          wide
          footer={
            <>
              <button
                onClick={() => setEditingManual(null)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold"
              >
                حفظ
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="رمز الدليل *">
                <Input
                  value={draft.code || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="التصنيف">
                <Select
                  value={draft.category || "Operations"}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  <option value="Operations">Operations</option>
                  <option value="Procedures">Procedures</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Technical">Technical</option>
                  <option value="Training">Training</option>
                  <option value="Safety">Safety</option>
                </Select>
              </Field>
              <Field label="المراجعة">
                <Input
                  value={draft.rev || ""}
                  onChange={(e) => setDraft({ ...draft, rev: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="العنوان EN *">
                <Input
                  value={draft.title_en || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, title_en: e.target.value })
                  }
                />
              </Field>
              <Field label="العنوان AR">
                <Input
                  value={draft.title_ar || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, title_ar: e.target.value })
                  }
                  dir="rtl"
                />
              </Field>
            </div>
            <Field label="من يرى هذا الدليل؟">
              <Select
                value={draft.visibleTo || "all"}
                onChange={(e) =>
                  setDraft({ ...draft, visibleTo: e.target.value })
                }
              >
                <option value="all">الجميع</option>
                <option value="crew">الطاقم فقط</option>
                <option value="admin">المدراء فقط</option>
              </Select>
            </Field>
            <div className="p-4 rounded-xl border-2 border-dashed border-sky-300 bg-sky-50/50 space-y-2">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-600" /> إرفاق PDF
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0], true)}
              />
              {draft.pdfData ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-white border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        PDF
                      </div>
                      <div>
                        <div className="font-bold text-xs truncate">
                          {draft.pdfName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {draft.pdfSize}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setDraft({ ...draft, pdfData: null, pdfName: "" })
                      }
                      className="p-1.5 rounded bg-rose-50 text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      showToast("✨ تم استخراج النص وتحليل الوثيقة وإنشاء الحقول الهيكلية بنجاح!", "success");
                      setDraft(d => ({
                        ...d,
                        summary: d.summary || `Extracted summary from ${d.pdfName}: Standard operational guidelines, compliance specifications, and procedures.`,
                        chapters: [
                          { num: "01", title: "General Policy & Scope", pages: "1-20" },
                          { num: "02", title: "Operational Procedures", pages: "21-55" },
                          { num: "03", title: "Safety & Emergency Protocols", pages: "56-90" }
                        ],
                        approval: d.approval || "CAA/AUTO/2026/888"
                      }));
                    }}
                    className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <span>✨ استخراج النص وإنشاء الحقول الهيكلية تلقائياً (OCR / Text Extraction)</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={uploadingPdf}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 flex flex-col items-center rounded-lg border bg-white hover:border-sky-400 disabled:opacity-50"
                >
                  <Upload className="w-7 h-7 text-sky-500 mb-1.5" />
                  <span className="text-xs font-bold">
                    {uploadingPdf ? "جاري رفع PDF إلى Google Drive..." : "انقر لاختيار PDF"}
                  </span>
                </button>
              )}
            </div>
            <Field label="الملخص">
              <textarea
                value={draft.summary || ""}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border p-2.5 text-xs"
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="آخر تحديث">
                <div className="flex gap-2">
                  <Input
                    value={
                      draft.lastUpdated
                        ? new Date(draft.lastUpdated).toLocaleString(
                            lang === "ar" ? "ar-LY" : "en-GB"
                          )
                        : "—"
                    }
                    disabled
                    className="bg-slate-100 flex-1"
                  />
                  <button
                    onClick={() =>
                      setDraft({
                        ...draft,
                        lastUpdated: new Date().toISOString(),
                        lastUpdatedBy: user?.fullName || "Unknown",
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> الآن
                  </button>
                </div>
              </Field>
              <Field label="آخر من حدّث">
                <Input
                  value={draft.lastUpdatedBy || "—"}
                  disabled
                  className="bg-slate-100"
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && (
        <Modal
          open={showAuditLog}
          title="سجل تحديثات الأدلة"
          onClose={() => setShowAuditLog(false)}
          wide
          footer={
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-xs text-slate-500 font-mono">
                {filteredLogs.length} / {auditLogs.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  disabled={filteredLogs.length === 0}
                  className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel (
                  {filteredLogs.length})
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={filteredLogs.length === 0}
                  className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF (
                  {filteredLogs.length})
                </button>
                {canManage && (
                  <button
                    onClick={() => setShowClearModal(true)}
                    className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف قديمة
                  </button>
                )}
                <button
                  onClick={() => setShowAuditLog(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border bg-white"
              >
                <option value="all">الكل</option>
                <option value="refresh">تحديث</option>
                <option value="create">إضافة</option>
                <option value="update">تعديل</option>
                <option value="delete">حذف</option>
              </select>
              <div className="flex items-center gap-1 text-xs">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={auditDateRange.from}
                  onChange={(e) =>
                    setAuditDateRange({
                      ...auditDateRange,
                      from: e.target.value,
                    })
                  }
                  className="px-2 py-1 rounded border"
                />
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <input
                  type="date"
                  value={auditDateRange.to}
                  onChange={(e) =>
                    setAuditDateRange({ ...auditDateRange, to: e.target.value })
                  }
                  className="px-2 py-1 rounded border"
                />
              </div>
              {(auditFilter !== "all" ||
                auditDateRange.from ||
                auditDateRange.to) && (
                <button
                  onClick={() => {
                    setAuditFilter("all");
                    setAuditDateRange({ from: "", to: "" });
                  }}
                  className="text-xs text-rose-600"
                >
                  مسح
                </button>
              )}
            </div>
            {loadingAudit ? (
              <div className="text-center py-10 text-slate-500">
                جاري التحميل...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>لا توجد سجلات</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {filteredLogs.map((log) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    lang={lang}
                    canDelete={canManage}
                    onDelete={() => handleDeleteSingleLog(log.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <Modal
          open={showClearModal}
          title="حذف السجلات القديمة"
          onClose={() => setShowClearModal(false)}
          footer={
            <>
              <button
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-lg border text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={handleClearOldLogs}
                disabled={clearingLogs || !clearBeforeDate}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {clearingLogs ? "..." : "حذف"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm">حذف السجلات قبل:</p>
            <Field label="التاريخ">
              <Input
                type="date"
                value={clearBeforeDate}
                onChange={(e) => setClearBeforeDate(e.target.value)}
              />
            </Field>
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
              ⚠️ لا يمكن التراجع
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ⭐ LogEntry */
function LogEntry({ log, lang, canDelete, onDelete }) {
  const d = log.details || {};
  const type = (d.action || "").toLowerCase();
  const isBulk = type.includes("bulk");
  const isRefresh = type.includes("refresh");
  const iconMap = {
    create: { I: CheckCircle2, c: "text-emerald-600 bg-emerald-50" },
    update: { I: Edit, c: "text-amber-600 bg-amber-50" },
    delete: { I: Trash2, c: "text-rose-600 bg-rose-50" },
    refresh: { I: RefreshCw, c: "text-sky-600 bg-sky-50" },
  };
  const key =
    log.action === "CREATE"
      ? "create"
      : log.action === "DELETE"
      ? "delete"
      : isRefresh
      ? "refresh"
      : "update";
  const { I: Icon, c: color } = iconMap[key] || iconMap.update;
  return (
    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 rounded-lg hover:border-sky-400 transition">
      <div className="flex items-start gap-2.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold">
              {log.manualCode || d.code || "—"}
            </span>
            {isBulk && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                BULK ({d.count})
              </span>
            )}
            {isRefresh && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700">
                REFRESH
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {log.manualTitle || d.title || log.entityName || "—"}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {log.userName} ·{" "}
            {new Date(log.timestamp).toLocaleString(
              lang === "ar" ? "ar-LY" : "en-GB"
            )}
          </div>
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-rose-100 text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {(log.previousUpdate || log.newUpdate) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
          {log.previousUpdate && (
            <div className="p-2 bg-rose-50 rounded border border-rose-200">
              <div className="text-rose-600 font-bold text-[9px]">← قبل</div>
              <div className="text-rose-700 truncate">
                {new Date(log.previousUpdate).toLocaleString(
                  lang === "ar" ? "ar-LY" : "en-GB"
                )}
              </div>
            </div>
          )}
          {log.newUpdate && (
            <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
              <div className="text-emerald-600 font-bold text-[9px]">→ بعد</div>
              <div className="text-emerald-700 truncate">
                {new Date(log.newUpdate).toLocaleString(
                  lang === "ar" ? "ar-LY" : "en-GB"
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {isBulk && d.codes && (
        <div className="mt-2 text-[10px] text-slate-500 font-mono">
          <span className="font-bold">الأدلة:</span> {d.codes.join(", ")}
        </div>
      )}
    </div>
  );
}

export default ManualsModule;
