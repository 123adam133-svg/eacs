/* ═══════════════════════════════════════════════════════════
 * DOCUMENTS DASHBOARD — مركز المستندات والامتثال الموحد
 * Central aviation document management + Google Drive file storage
 * Department access control + Role classification + Expiry tracking & Email alerts
 * ═══════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FolderLock,
  Files,
  FileCheck2,
  FileText,
  Upload,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Mail,
  Send,
  Eye,
  Download,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  ShieldAlert,
  Printer,
  ChevronDown,
  X,
  Paperclip,
  UserCheck,
  Tag,
  SlidersHorizontal,
  Lock,
  Check,
  Plane,
  Compass,
  Wrench,
  UtensilsCrossed,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import {
  documentsAPI,
  documentDepartmentsAPI,
  uploadFile,
  readSheetCache,
  toDisplayImageUrl,
} from "../api";
import { can as checkPerm } from "../config/permissions";
import { showToast, confirmAction, openPreviewModal, printHTMLContent } from "../utils/dialog";
import {
  getDaysRemaining,
  sendDocumentExpiryAlert,
} from "../utils/documentNotificationService";
import { listEmailAccounts, getDefaultEmailAccount } from "../utils/emailAccounts";

/* ═══ Styles ═══ */
const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

const innerBoxStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

const DOCUMENT_CATEGORIES = [
  { id: "license", labelAr: "رخص الطيران (ATPL/CPL/AML)", labelEn: "Aviation Licenses", icon: Plane },
  { id: "medical", labelAr: "شهادات الفحص الطبي (Medical Class 1/2)", labelEn: "Medical Certificates", icon: ShieldCheck },
  { id: "passport", labelAr: "جوازات السفر (Passports)", labelEn: "Passports", icon: Tag },
  { id: "visa", labelAr: "التأشيرات وتصاريح الدخول (Visas)", labelEn: "Visas & Entry Permits", icon: Compass },
  { id: "security_pass", labelAr: "تصاريح أمن المطار والبطاقات (Security/CMC)", labelEn: "Airport & Security Passes", icon: Lock },
  { id: "training_cert", labelAr: "شهادات التدريب والتأهيل (Recurrent/CRM)", labelEn: "Training Certificates", icon: FileCheck2 },
  { id: "type_rating", labelAr: "أهليات الطراز (Type Ratings & LPC)", labelEn: "Type Ratings & Checks", icon: Plane },
  { id: "dg_cert", labelAr: "المواد الخطرة (Dangerous Goods)", labelEn: "Dangerous Goods Certs", icon: AlertTriangle },
  { id: "contract", labelAr: "عقود التوظيف والاتفاقيات", labelEn: "Contracts & Agreements", icon: FileText },
  { id: "other", labelAr: "وثائق ومرفقات أخرى", labelEn: "Other Documents", icon: Files },
];

const QUICK_DOC_TITLES = [
  "Air Transport Pilot License (ATPL)",
  "Commercial Pilot License (CPL)",
  "Class 1 Aviation Medical Certificate",
  "Class 2 Aviation Medical Certificate",
  "Official Passport (جواز سفر)",
  "Crew Member Certificate (CMC Badge)",
  "Airport Security Access Pass (تصريح المطار)",
  "Line Proficiency Check (LPC / OPC)",
  "Dangerous Goods Training (CAT 10)",
  "Crew Resource Management (CRM Recurrent)",
  "Emergency & Survival Equipment Training",
  "Aircraft Maintenance Engineer License (AML)",
  "Type Rating Qualification Certificate",
];

export function DocumentsModule({
  crew = [],
  users = [],
  fleet = [],
  settings = {},
  user,
  lang = "ar",
  setSyncStatus,
}) {
  const t = useT();
  const { user: authUser } = useAuth();
  const effectiveUser = user || authUser;

  // Permissions
  const canView =
    checkPerm(effectiveUser, "documents.view") ||
    checkPerm(effectiveUser, "schedule.view");
  const canUpload =
    checkPerm(effectiveUser, "documents.upload") ||
    checkPerm(effectiveUser, "schedule.edit");
  const canEdit =
    checkPerm(effectiveUser, "documents.edit") ||
    checkPerm(effectiveUser, "schedule.edit");
  const canDelete =
    checkPerm(effectiveUser, "documents.delete") ||
    checkPerm(effectiveUser, "schedule.delete");
  const canManageDepts =
    checkPerm(effectiveUser, "documents.manage_departments") ||
    checkPerm(effectiveUser, "settings.edit") ||
    effectiveUser?.role === "superAdmin";
  const canSendAlerts =
    checkPerm(effectiveUser, "documents.email_alerts") ||
    checkPerm(effectiveUser, "email.send") ||
    effectiveUser?.role === "superAdmin" ||
    effectiveUser?.role === "dispatcher";
  const canViewAllDepts =
    checkPerm(effectiveUser, "documents.view_all_depts") ||
    effectiveUser?.role === "superAdmin" ||
    effectiveUser?.role === "dispatcher";

  // Data states
  const [documents, setDocuments] = useState(() =>
    readSheetCache("Documents", [])
  );
  const [departments, setDepartments] = useState(() =>
    readSheetCache("DocumentDepartments", [])
  );
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table" | "personnel"
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "EXPIRED" | "EXPIRING_30" | "EXPIRING_90" | "VALID"
  const [selectedPersonId, setSelectedPersonId] = useState("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [docDraft, setDocDraft] = useState({
    title: "",
    category: "license",
    docNo: "",
    issuingAuthority: "",
    departmentId: "flight_ops",
    personId: "",
    personName: "",
    personRole: "",
    personEmail: "",
    issueDate: "",
    expiryDate: "",
    reminderDays: 30,
    notes: "",
    fileId: "",
    fileUrl: "",
    viewUrl: "",
    fileName: "",
    fileType: "",
    fileSize: "",
  });

  // Renewal Modal
  const [renewingDoc, setRenewingDoc] = useState(null);
  const [renewalDraft, setRenewalDraft] = useState({
    newIssueDate: "",
    newExpiryDate: "",
    renewalNotes: "",
    sendEmailConfirmation: true,
  });
  const [renewalFile, setRenewalFile] = useState(null);

  // Department Management Modal
  const [showDeptsModal, setShowDeptsModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptDraft, setDeptDraft] = useState({
    nameAr: "",
    nameEn: "",
    icon: "Building2",
    color: "#0284c7",
    headName: "",
    headEmail: "",
    roles: "",
    description: "",
  });

  // Single Email Alert Modal
  const [emailAlertDoc, setEmailAlertDoc] = useState(null);
  const [emailAlertDraft, setEmailAlertDraft] = useState({
    recipientEmail: "",
    recipientName: "",
    headEmail: "",
    senderAccountId: "",
    customMessage: "",
  });

  // Bulk Email Alert Modal
  const [showBulkAlertModal, setShowBulkAlertModal] = useState(false);
  const [bulkAlertSenderId, setBulkAlertSenderId] = useState("");
  const [bulkAlertCustomMessage, setBulkAlertCustomMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  // File Upload State
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedLocalFile, setSelectedLocalFile] = useState(null);
  const [localFilePreview, setLocalFilePreview] = useState(null);

  // Unified Personnel Directory (Crew + Users)
  const unifiedPersonnel = useMemo(() => {
    const list = [];
    const seenEmails = new Set();

    // From Crew
    (crew || []).forEach((c) => {
      const email = String(c.email || "").trim().toLowerCase();
      if (email) seenEmails.add(email);
      const isPilot = ["CPT", "FO", "FE", "TRE", "TRI"].includes(
        String(c.role || "").toUpperCase()
      );
      const isCabin = ["CC", "SCC", "PURSER", "FA"].includes(
        String(c.role || "").toUpperCase()
      );
      list.push({
        id: String(c.id),
        type: "crew",
        fullName: c.fullName || "Crew Member",
        role: c.role || "CREW",
        email: c.email || "",
        phone: c.phone || "",
        empNo: c.empNo || c.eNumber || "",
        base: c.base || "",
        avatar: c.avatar || "",
        suggestedDept: isPilot ? "flight_ops" : isCabin ? "cabin_crew" : "flight_ops",
      });
    });

    // From Users (Dispatchers, Engineers, Admin, etc.)
    (users || []).forEach((u) => {
      const email = String(u.email || "").trim().toLowerCase();
      // Skip if already represented from crew
      if (email && seenEmails.has(email) && u.crewId) return;
      const roleStr = String(u.role || "").toLowerCase();
      const isEng = roleStr.includes("camo") || roleStr.includes("eng");
      const isDisp = roleStr.includes("disp") || roleStr.includes("ops");
      list.push({
        id: String(u.id),
        type: "user",
        fullName: u.fullName || u.username || "Staff User",
        role: u.jobTitle || u.role || "STAFF",
        email: u.email || "",
        phone: u.phone || "",
        empNo: u.empNo || "",
        base: "",
        avatar: u.avatar || "",
        suggestedDept: isEng ? "camo_eng" : isDisp ? "dispatch" : "hr_admin",
      });
    });

    return list;
  }, [crew, users]);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    setSyncStatus?.("syncing");
    try {
      const [docs, depts] = await Promise.all([
        documentsAPI.list().catch(() => readSheetCache("Documents", [])),
        documentDepartmentsAPI
          .list()
          .catch(() => readSheetCache("DocumentDepartments", [])),
      ]);
      setDocuments(Array.isArray(docs) ? docs : []);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSyncStatus?.("synced");
    } catch {
      setSyncStatus?.("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Department Access Restriction: If user has restricted dept, apply default
  useEffect(() => {
    if (!canViewAllDepts && departments.length > 0) {
      const userRole = effectiveUser?.role;
      const matchedDept = departments.find((d) =>
        (d.allowedUserRoles || []).includes(userRole)
      );
      if (matchedDept && selectedDept === "ALL") {
        setSelectedDept(matchedDept.id);
      }
    }
  }, [canViewAllDepts, departments, effectiveUser]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = documents.length;
    let expired = 0;
    let expiring30 = 0;
    let expiring90 = 0;
    let valid = 0;

    documents.forEach((d) => {
      const days = getDaysRemaining(d.expiryDate);
      if (days === null) {
        valid++;
      } else if (days < 0) {
        expired++;
      } else if (days <= 30) {
        expiring30++;
      } else if (days <= 90) {
        expiring90++;
      } else {
        valid++;
      }
    });

    const compliantRate = total > 0 ? Math.round(((total - expired) / total) * 100) : 100;

    return { total, expired, expiring30, expiring90, valid, compliantRate };
  }, [documents]);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      // Department filter
      if (selectedDept !== "ALL" && d.departmentId !== selectedDept) return false;

      // Role filter
      if (selectedRole !== "ALL" && d.personRole !== selectedRole) return false;

      // Category filter
      if (selectedCategory !== "ALL" && d.category !== selectedCategory) return false;

      // Specific person filter
      if (selectedPersonId !== "ALL" && String(d.personId) !== String(selectedPersonId))
        return false;

      // Expiry status filter
      const days = getDaysRemaining(d.expiryDate);
      if (statusFilter === "EXPIRED" && (days === null || days >= 0)) return false;
      if (statusFilter === "EXPIRING_30" && (days === null || days < 0 || days > 30))
        return false;
      if (statusFilter === "EXPIRING_90" && (days === null || days < 0 || days > 90))
        return false;
      if (statusFilter === "VALID" && days !== null && days < 0) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const str = `${d.title || ""} ${d.docNo || ""} ${d.personName || ""} ${
          d.issuingAuthority || ""
        } ${d.departmentName || ""} ${d.notes || ""}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [
    documents,
    selectedDept,
    selectedRole,
    selectedCategory,
    selectedPersonId,
    statusFilter,
    searchTerm,
  ]);

  // Personnel Grouped List (for Personnel View mode)
  const personnelWithDocs = useMemo(() => {
    return unifiedPersonnel
      .map((p) => {
        const docs = documents.filter((d) => String(d.personId) === String(p.id));
        const hasExpired = docs.some((d) => {
          const days = getDaysRemaining(d.expiryDate);
          return days !== null && days < 0;
        });
        const hasExpiring = docs.some((d) => {
          const days = getDaysRemaining(d.expiryDate);
          return days !== null && days >= 0 && days <= 30;
        });

        const status = hasExpired
          ? "EXPIRED"
          : hasExpiring
          ? "EXPIRING_SOON"
          : "COMPLIANT";

        return { ...p, docs, status };
      })
      .filter((p) => {
        if (selectedDept !== "ALL") {
          const inDept = p.docs.some((d) => d.departmentId === selectedDept) || p.suggestedDept === selectedDept;
          if (!inDept) return false;
        }
        if (selectedRole !== "ALL" && p.role !== selectedRole) return false;
        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const str = `${p.fullName} ${p.role} ${p.email} ${p.empNo}`.toLowerCase();
          if (!str.includes(q)) return false;
        }
        return true;
      });
  }, [unifiedPersonnel, documents, selectedDept, selectedRole, searchTerm]);

  // Document Urgency Badge Helper
  const renderExpiryBadge = (expiryDate) => {
    const days = getDaysRemaining(expiryDate);
    if (!expiryDate) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400">
          دائم / No Expiry
        </span>
      );
    }

    if (days === null) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-500/10 text-slate-400">
          {expiryDate}
        </span>
      );
    }

    if (days < 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>منتهي منذ {Math.abs(days)} يوم ({expiryDate})</span>
        </span>
      );
    }

    if (days === 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>ينتهي اليوم! ({expiryDate})</span>
        </span>
      );
    }

    if (days <= 30) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>ينتهي خلال {days} يوم ({expiryDate})</span>
        </span>
      );
    }

    if (days <= 90) {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>متبقي {days} يوم ({expiryDate})</span>
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>ساري حتى {expiryDate} ({Math.round(days / 30)} شهر)</span>
      </span>
    );
  };

  /* ═══ ACTIONS: Upload Document to Google Drive ═══ */
  const openNewDocModal = (prefillPerson = null) => {
    if (!canUpload) return showToast("⚠️ ليس لديك صلاحية رفع المستندات");
    setSelectedLocalFile(null);
    setLocalFilePreview(null);
    setEditingDoc(null);

    const person = prefillPerson || unifiedPersonnel[0];
    const dept =
      departments.find((d) => d.id === person?.suggestedDept) ||
      departments[0];

    setDocDraft({
      title: "",
      category: "license",
      docNo: "",
      issuingAuthority: "الهيئة العامة للطيران المدني",
      departmentId: dept?.id || "flight_ops",
      departmentName: dept?.nameAr || "عمليات الطيران",
      personId: person?.id || "",
      personName: person?.fullName || "",
      personRole: person?.role || "",
      personEmail: person?.email || "",
      issueDate: new Date().toISOString().slice(0, 10),
      expiryDate: "",
      reminderDays: 30,
      notes: "",
      fileId: "",
      fileUrl: "",
      viewUrl: "",
      fileName: "",
      fileType: "",
      fileSize: "",
    });
    setShowAddModal(true);
  };

  const openEditDocModal = (doc) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تعديل المستندات");
    setSelectedLocalFile(null);
    setLocalFilePreview(null);
    setEditingDoc(doc);
    setDocDraft({ ...doc });
    setShowAddModal(true);
  };

  const handleSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      showToast("⚠️ الحد الأقصى للملف هو 25 ميغابايت", "warning");
      return;
    }
    setSelectedLocalFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setLocalFilePreview(url);
    } else {
      setLocalFilePreview(null);
    }
  };

  const handleSaveDoc = async () => {
    if (!docDraft.title.trim()) {
      return showToast("⚠️ يرجى إدخال مسمى الوثيقة", "warning");
    }

    setUploadingFile(true);
    setSyncStatus?.("syncing");

    try {
      let fileMeta = {
        fileId: docDraft.fileId || "",
        fileUrl: docDraft.fileUrl || "",
        viewUrl: docDraft.viewUrl || "",
        proxyUrl: docDraft.proxyUrl || "",
        fileName: docDraft.fileName || "",
        fileType: docDraft.fileType || "",
        fileSize: docDraft.fileSize || "",
      };

      // Upload to Google Drive via Apps Script if a new file was chosen
      if (selectedLocalFile) {
        showToast("جاري رفع الملف وحفظه في Google Drive...", "info");
        const uploadRes = await uploadFile(selectedLocalFile, "documents");
        fileMeta = {
          fileId: uploadRes.fileId || "",
          fileUrl: uploadRes.fileUrl || "",
          viewUrl: uploadRes.viewUrl || "",
          proxyUrl: uploadRes.proxyUrl || "",
          fileName: uploadRes.fileName || selectedLocalFile.name,
          fileType: uploadRes.mimeType || selectedLocalFile.type,
          fileSize: `${(selectedLocalFile.size / (1024 * 1024)).toFixed(2)} MB`,
        };
      }

      const matchedDept = departments.find(
        (d) => String(d.id) === String(docDraft.departmentId)
      );
      const catObj = DOCUMENT_CATEGORIES.find((c) => c.id === docDraft.category);

      const finalRecord = {
        ...docDraft,
        ...fileMeta,
        departmentName: matchedDept ? matchedDept.nameAr : docDraft.departmentName,
        categoryLabel: catObj ? catObj.labelAr : docDraft.category,
        updatedBy: effectiveUser?.fullName || effectiveUser?.username || "Operations",
      };

      if (editingDoc) {
        await documentsAPI.update(editingDoc.id, finalRecord);
        setDocuments((prev) =>
          prev.map((d) => (d.id === editingDoc.id ? { ...finalRecord, id: d.id } : d))
        );
        showToast("✅ تم تحديث الوثيقة بنجاح", "success");
      } else {
        const created = await documentsAPI.create(finalRecord);
        setDocuments((prev) => [created, ...prev]);
        showToast("✅ تم حفظ الوثيقة في Google Drive والمنظومة", "success");
      }

      setShowAddModal(false);
      setEditingDoc(null);
      setSelectedLocalFile(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("فشل الحفظ: " + e.message, "error");
      setSyncStatus?.("error");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteDoc = async (doc) => {
    if (!canDelete) return showToast("⚠️ ليس لديك صلاحية حذف المستندات");
    if (!(await confirmAction(`هل أنت متأكد من حذف الوثيقة "${doc.title}"؟`))) return;

    try {
      await documentsAPI.remove(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      showToast("✅ تم حذف الوثيقة", "info");
    } catch (e) {
      showToast("فشل الحذف: " + e.message);
    }
  };

  /* ═══ ACTIONS: Document Renewal / Validity Update ═══ */
  const openRenewModal = (doc) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تجديد المستندات");
    setRenewingDoc(doc);
    setRenewalDraft({
      newIssueDate: new Date().toISOString().slice(0, 10),
      newExpiryDate: doc.expiryDate || "",
      renewalNotes: "",
      sendEmailConfirmation: Boolean(doc.personEmail),
    });
    setRenewalFile(null);
  };

  const handleSaveRenewal = async () => {
    if (!renewalDraft.newExpiryDate) {
      return showToast("⚠️ يرجى تحديد تاريخ الانتهاء الجديد", "warning");
    }

    setUploadingFile(true);
    setSyncStatus?.("syncing");

    try {
      let fileMeta = null;
      if (renewalFile) {
        showToast("جاري رفع وثيقة التجديد إلى Google Drive...", "info");
        const uploadRes = await uploadFile(renewalFile, "documents");
        fileMeta = {
          fileId: uploadRes.fileId || "",
          fileUrl: uploadRes.fileUrl || "",
          viewUrl: uploadRes.viewUrl || "",
          proxyUrl: uploadRes.proxyUrl || "",
          fileName: uploadRes.fileName || renewalFile.name,
          fileType: uploadRes.mimeType || renewalFile.type,
          fileSize: `${(renewalFile.size / (1024 * 1024)).toFixed(2)} MB`,
        };
      }

      const updated = await documentsAPI.renew(renewingDoc.id, {
        newIssueDate: renewalDraft.newIssueDate,
        newExpiryDate: renewalDraft.newExpiryDate,
        renewalNotes: renewalDraft.renewalNotes,
        updatedBy: effectiveUser?.fullName || effectiveUser?.username,
        fileMeta,
      });

      setDocuments((prev) =>
        prev.map((d) => (d.id === renewingDoc.id ? updated : d))
      );

      // Optional confirmation email
      if (renewalDraft.sendEmailConfirmation && renewingDoc.personEmail) {
        sendDocumentExpiryAlert({
          document: updated,
          recipientEmail: renewingDoc.personEmail,
          recipientName: renewingDoc.personName,
          recipientRole: renewingDoc.personRole,
          customMessage: `تم تجديد الوثيقة بنجاح ومطابقتها. تاريخ الانتهاء الجديد: ${renewalDraft.newExpiryDate}. ${renewalDraft.renewalNotes || ""}`,
          settings,
        }).catch(() => {});
      }

      showToast("✅ تم تجديد صلاحية الوثيقة بنجاح", "success");
      setRenewingDoc(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("فشل التجديد: " + e.message, "error");
      setSyncStatus?.("error");
    } finally {
      setUploadingFile(false);
    }
  };

  /* ═══ ACTIONS: Single Document Email Alert ═══ */
  const openEmailAlertModal = (doc) => {
    if (!canSendAlerts) return showToast("⚠️ ليس لديك صلاحية إرسال التنبيهات");
    const dept = departments.find((d) => d.id === doc.departmentId);
    const defaultAcc = getDefaultEmailAccount();

    setEmailAlertDoc(doc);
    setEmailAlertDraft({
      recipientEmail: doc.personEmail || "",
      recipientName: doc.personName || "",
      headEmail: dept?.headEmail || "",
      senderAccountId: defaultAcc?.id || "",
      customMessage: "",
    });
  };

  const handleSendSingleAlert = async () => {
    if (!emailAlertDraft.recipientEmail) {
      return showToast("⚠️ البريد الإلكتروني للمستلم مطلوب", "warning");
    }

    try {
      showToast("جاري إرسال إشعار الصلاحية عبر البريد...", "info");
      await sendDocumentExpiryAlert({
        document: emailAlertDoc,
        recipientEmail: emailAlertDraft.recipientEmail,
        recipientName: emailAlertDraft.recipientName,
        recipientRole: emailAlertDoc.personRole,
        departmentHeadEmail: emailAlertDraft.headEmail,
        customMessage: emailAlertDraft.customMessage,
        settings,
        senderAccountId: emailAlertDraft.senderAccountId,
      });

      showToast(`✅ تم إرسال إشعار التنبيه إلى ${emailAlertDraft.recipientEmail}`, "success");
      setEmailAlertDoc(null);
    } catch (e) {
      showToast("فشل إرسال الإشعار: " + e.message, "error");
    }
  };

  /* ═══ ACTIONS: Bulk Email Alerts for Expiring Documents ═══ */
  const expiringOrExpiredDocs = useMemo(() => {
    return filteredDocuments.filter((d) => {
      const days = getDaysRemaining(d.expiryDate);
      return days !== null && days <= 30 && Boolean(d.personEmail);
    });
  }, [filteredDocuments]);

  const handleBulkSendAlerts = async () => {
    if (expiringOrExpiredDocs.length === 0) {
      return showToast("لا توجد وثائق منتهية أو قاربت على الانتهاء ضمن التصفية الحالية");
    }

    setBulkSending(true);
    let sentCount = 0;
    let failCount = 0;

    for (const doc of expiringOrExpiredDocs) {
      try {
        const dept = departments.find((d) => d.id === doc.departmentId);
        await sendDocumentExpiryAlert({
          document: doc,
          recipientEmail: doc.personEmail,
          recipientName: doc.personName,
          recipientRole: doc.personRole,
          departmentHeadEmail: dept?.headEmail || "",
          customMessage: bulkAlertCustomMessage,
          settings,
          senderAccountId: bulkAlertSenderId,
        });
        sentCount++;
      } catch {
        failCount++;
      }
    }

    setBulkSending(false);
    setShowBulkAlertModal(false);
    showToast(
      `✅ تم إرسال ${sentCount} إشعار بريدي بنجاح${failCount > 0 ? ` (تعذر ${failCount})` : ""}`,
      sentCount > 0 ? "success" : "error"
    );
  };

  /* ═══ ACTIONS: Departments CRUD ═══ */
  const openNewDeptModal = () => {
    if (!canManageDepts) return showToast("⚠️ ليس لديك صلاحية إدارة الأقسام");
    setEditingDept(null);
    setDeptDraft({
      nameAr: "",
      nameEn: "",
      icon: "Building2",
      color: "#0284c7",
      headName: "",
      headEmail: "",
      roles: "",
      description: "",
    });
    setShowDeptsModal(true);
  };

  const handleSaveDept = async () => {
    if (!deptDraft.nameAr.trim()) {
      return showToast("⚠️ يرجى إدخال اسم القسم بالعربية", "warning");
    }

    try {
      const rolesArray = deptDraft.roles
        ? deptDraft.roles.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : [];

      if (editingDept) {
        await documentDepartmentsAPI.update(editingDept.id, {
          ...deptDraft,
          roles: rolesArray,
        });
        setDepartments((prev) =>
          prev.map((d) => (d.id === editingDept.id ? { ...d, ...deptDraft, roles: rolesArray } : d))
        );
        showToast("✅ تم تحديث بيانات القسم بنجاح", "success");
      } else {
        const created = await documentDepartmentsAPI.create({
          ...deptDraft,
          roles: rolesArray,
        });
        setDepartments((prev) => [...prev, created]);
        showToast("✅ تم إنشاء القسم الجديد", "success");
      }
      setShowDeptsModal(false);
      setEditingDept(null);
    } catch (e) {
      showToast("فشل حفظ القسم: " + e.message);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!canManageDepts) return showToast("⚠️ ليس لديك صلاحية حذف الأقسام");
    if (!(await confirmAction(`حذف قسم "${dept.nameAr}"؟`))) return;
    try {
      await documentDepartmentsAPI.remove(dept.id);
      setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
      showToast("✅ تم حذف القسم", "info");
    } catch (e) {
      showToast("فشل الحذف: " + e.message);
    }
  };

  /* ═══ ACTIONS: Print Compliance Report ═══ */
  const handlePrintComplianceReport = () => {
    const companyName = settings?.companyName || "EXECUTIVE AVIATION AUTHORITY";
    const companyNameAr = settings?.companyNameAr || "الجهاز التنفيذي للطيران";
    const logoUrl = toDisplayImageUrl(settings?.logo);

    const rowsHtml = filteredDocuments
      .map((d, idx) => {
        const days = getDaysRemaining(d.expiryDate);
        const statusText =
          days === null
            ? "دائم / Valid"
            : days < 0
            ? `منتهي (${Math.abs(days)} يوم)`
            : days <= 30
            ? `تحذير (${days} يوم)`
            : `ساري (${days} يوم)`;
        const statusColor =
          days !== null && days < 0
            ? "#dc2626"
            : days !== null && days <= 30
            ? "#d97706"
            : "#16a34a";

        return `
        <tr>
          <td style="text-align: center; font-mono; font-size: 11px;">${idx + 1}</td>
          <td><strong>${d.title}</strong><div style="font-size: 10px; color: #64748b;">${d.docNo || "—"}</div></td>
          <td>${d.categoryLabel || d.category}</td>
          <td>${d.departmentName || "—"}</td>
          <td><strong>${d.personName || "—"}</strong><div style="font-size: 10px; color: #64748b;">${d.personRole || ""}</div></td>
          <td style="font-family: monospace; text-align: center;">${d.expiryDate || "—"}</td>
          <td style="text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
        </tr>
      `;
      })
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>AeroOps — تقرير صلاحية وامتثال وثائق الطيران</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Cairo', Arial, sans-serif; color: #000; background: white; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: right; }
          th { background-color: #f1f5f9; font-weight: bold; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 14px;">
          ${logoUrl ? `<img src="${logoUrl}" style="max-height: 60px; margin-bottom: 6px;">` : ""}
          <h2 style="margin: 0; font-size: 16px;">${companyNameAr}</h2>
          <div style="font-size: 12px; font-family: monospace; color: #475569;">${companyName}</div>
          <h3 style="margin: 10px 0 4px 0; font-size: 15px; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 6px;">
            تقرير مركز المستندات وصلاحيات الأطقم والموظفين (Aviation Documents & Compliance Audit)
          </h3>
          <div style="font-size: 11px; color: #64748b;">تاريخ التقرير: ${new Date().toLocaleString()} · إجمالي الوثائق: ${filteredDocuments.length} · نسبة الامتثال: ${stats.compliantRate}%</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>الوثيقة ورقمها</th>
              <th>التصنيف</th>
              <th>القسم</th>
              <th>الموظف / الطاقم</th>
              <th style="text-align: center;">تاريخ الانتهاء</th>
              <th style="text-align: center;">حالة الامتثال</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printHTMLContent(fullHtml, "Documents_Compliance_Report");
  };

  if (!canView) {
    return (
      <div className="rounded-xl p-8 text-center" style={cardStyle}>
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500" />
        <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
          ليس لديك صلاحية الوصول لمركز المستندات والامتثال / No permission to view Documents
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ HEADER & STATS ═══ */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <FolderLock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>مركز المستندات والامتثال الموحد / Documents Hub</span>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  Google Drive Cloud
                </span>
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                منظومة مركزية لحفظ وأرشفة رخص الطيران والشهادات وجوازات الأطقم والموظفين مع متابعة الصلاحيات وإشعارات البريد
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintComplianceReport}
              className="px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
              title="طباعة وتصدير تقرير الامتثال والصلاحيات"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير</span>
            </button>

            {canSendAlerts && expiringOrExpiredDocs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBulkAlertSenderId(getDefaultEmailAccount()?.id || "");
                  setShowBulkAlertModal(true);
                }}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 transition hover:bg-amber-500 hover:text-white"
                title="إرسال إشعارات جماعية لكافة الموظفين الذين تقترب وثائقهم من الانتهاء"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال تنبيهات جماعية ({expiringOrExpiredDocs.length})</span>
              </button>
            )}

            {canManageDepts && (
              <button
                type="button"
                onClick={openNewDeptModal}
                className="px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition hover:bg-black/5 dark:hover:bg-white/5"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <Building2 className="w-4 h-4" />
                <span>إدارة الأقسام</span>
              </button>
            )}

            {canUpload && (
              <button
                type="button"
                onClick={() => openNewDocModal()}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" />
                <span>رفع وثيقة جديدة / Upload Doc</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              إجمالي الوثائق
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono" style={{ color: "var(--text-primary)" }}>
                {stats.total}
              </span>
              <Files className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
            </div>
          </div>

          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              سارية وممتثلة
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {stats.valid}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              تنتهي خلال 30 يوم
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                {stats.expiring30}
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>

          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              تخطيط التجديد (90d)
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-sky-600 dark:text-sky-400">
                {stats.expiring90}
              </span>
              <Calendar className="w-4 h-4 text-sky-500" />
            </div>
          </div>

          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              منتهية الصلاحية!
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                {stats.expired}
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
          </div>

          <div
            className="p-3 rounded-lg border flex flex-col justify-between"
            style={innerBoxStyle}
          >
            <div className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
              نسبة الامتثال العامة
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className={`text-xl font-black font-mono ${
                  stats.compliantRate >= 90
                    ? "text-emerald-500"
                    : stats.compliantRate >= 70
                    ? "text-amber-500"
                    : "text-rose-500"
                }`}
              >
                {stats.compliantRate}%
              </span>
              <ShieldCheck
                className={`w-4 h-4 ${
                  stats.compliantRate >= 90
                    ? "text-emerald-500"
                    : stats.compliantRate >= 70
                    ? "text-amber-500"
                    : "text-rose-500"
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DEPARTMENT TABS BAR ═══ */}
      <div className="rounded-xl p-2.5 flex items-center gap-1.5 overflow-x-auto" style={cardStyle}>
        <button
          type="button"
          onClick={() => setSelectedDept("ALL")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
            selectedDept === "ALL"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "hover:bg-black/5 dark:hover:bg-white/5"
          }`}
          style={
            selectedDept === "ALL"
              ? undefined
              : { color: "var(--text-muted)" }
          }
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>كافة الأقسام ({documents.length})</span>
        </button>

        {departments.map((dept) => {
          const count = documents.filter((d) => d.departmentId === dept.id).length;
          const hasExpiredInDept = documents.some(
            (d) => d.departmentId === dept.id && getDaysRemaining(d.expiryDate) < 0
          );
          const isSelected = selectedDept === dept.id;

          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => setSelectedDept(dept.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 border ${
                isSelected
                  ? "border-sky-500/80 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={
                isSelected
                  ? undefined
                  : {
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: dept.color || "#0284c7" }}
              />
              <span>{dept.nameAr || dept.nameEn}</span>
              <span className="font-mono text-[10px] opacity-75">({count})</span>
              {hasExpiredInDept && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ FILTER & SEARCH TOOLBAR ═══ */}
      <div className="rounded-xl p-3 space-y-2.5" style={cardStyle}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search
              className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
              style={{ color: "var(--text-muted)" }}
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الوثيقة، رقمها، الموظف، جهة الإصدار..."
              className="ps-9 h-9 text-xs"
            />
          </div>

          {/* Expiry Status Filter */}
          <div className="md:col-span-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="ALL">كل حالات الصلاحية</option>
              <option value="EXPIRED">🔴 منتهية الصلاحية فقط ({stats.expired})</option>
              <option value="EXPIRING_30">🟡 تنتهي خلال 30 يوم ({stats.expiring30})</option>
              <option value="EXPIRING_90">🟠 تنتهي خلال 90 يوم ({stats.expiring90})</option>
              <option value="VALID">🟢 سارية المفعول ({stats.valid})</option>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="md:col-span-3">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="ALL">جميع التصنيفات</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelAr}
                </option>
              ))}
            </Select>
          </div>

          {/* View Mode Switcher */}
          <div className="md:col-span-2 flex justify-end items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`p-2 rounded-lg text-xs font-bold border transition ${
                viewMode === "cards"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={
                viewMode === "cards"
                  ? undefined
                  : { borderColor: "var(--border-default)", color: "var(--text-muted)" }
              }
              title="عرض البطاقات"
            >
              <Files className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg text-xs font-bold border transition ${
                viewMode === "table"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={
                viewMode === "table"
                  ? undefined
                  : { borderColor: "var(--border-default)", color: "var(--text-muted)" }
              }
              title="عرض الجدول"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("personnel")}
              className={`p-2 rounded-lg text-xs font-bold border transition ${
                viewMode === "personnel"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40"
                  : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
              style={
                viewMode === "personnel"
                  ? undefined
                  : { borderColor: "var(--border-default)", color: "var(--text-muted)" }
              }
              title="عرض ملفات الموظفين والأطقم"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={loadData}
              className="p-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
              title="تحديث البيانات"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ VIEW 1: CARDS GRID ═══ */}
      {viewMode === "cards" && (
        <>
          {loading && documents.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
              جاري مزامنة المستندات من Google Drive... / Loading...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 rounded-xl space-y-3" style={cardStyle}>
              <Files className="w-12 h-12 mx-auto opacity-30" style={{ color: "var(--text-muted)" }} />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                لا توجد وثائق مطابقة للفلاتر المحددة
              </div>
              {canUpload && (
                <button
                  type="button"
                  onClick={() => openNewDocModal()}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-4 h-4" /> رفع أول وثيقة
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredDocuments.map((doc) => {
                const days = getDaysRemaining(doc.expiryDate);
                const isExpired = days !== null && days < 0;
                const isUrgent = days !== null && days >= 0 && days <= 30;
                const deptObj = departments.find((d) => d.id === doc.departmentId);

                return (
                  <div
                    key={doc.id}
                    className="rounded-xl p-4 flex flex-col justify-between border transition hover:shadow-md"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: isExpired
                        ? "#f43f5e"
                        : isUrgent
                        ? "#f59e0b"
                        : "var(--border-default)",
                    }}
                  >
                    <div>
                      {/* Card Top: Department & Expiry Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-bold text-white shrink-0"
                          style={{ backgroundColor: deptObj?.color || "#0284c7" }}
                        >
                          {doc.departmentName || "عام"}
                        </span>
                        <div className="shrink-0">{renderExpiryBadge(doc.expiryDate)}</div>
                      </div>

                      {/* Title & Doc Number */}
                      <h3
                        className="font-bold text-sm leading-snug mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {doc.title}
                      </h3>
                      {doc.docNo && (
                        <div className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 mb-2">
                          #{doc.docNo}
                        </div>
                      )}

                      {/* Personnel Info */}
                      <div
                        className="p-2.5 rounded-lg mb-3 flex items-center gap-2.5"
                        style={innerBoxStyle}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
                          style={{ background: "var(--brand-gradient)" }}
                        >
                          {doc.personName ? doc.personName.slice(0, 2) : "OP"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="font-bold text-xs truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {doc.personName || "غير محدد"}
                          </div>
                          <div
                            className="text-[11px] truncate flex items-center gap-2"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {doc.personRole && (
                              <span className="font-semibold text-sky-600 dark:text-sky-400">
                                {doc.personRole}
                              </span>
                            )}
                            {doc.personEmail && (
                              <span className="truncate">{doc.personEmail}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Issuer & Issue Date */}
                      <div
                        className="text-[11px] space-y-0.5 mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {doc.issuingAuthority && (
                          <div className="truncate">
                            <span className="font-semibold">جهة الإصدار:</span>{" "}
                            {doc.issuingAuthority}
                          </div>
                        )}
                        {doc.issueDate && (
                          <div>
                            <span className="font-semibold">تاريخ الإصدار:</span>{" "}
                            {doc.issueDate}
                          </div>
                        )}
                        {doc.notes && (
                          <div className="italic text-[10px] truncate text-slate-500">
                            {doc.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div
                      className="pt-3 border-t flex flex-wrap items-center justify-between gap-1.5"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <div className="flex items-center gap-1">
                        {/* Google Drive Preview */}
                        {doc.proxyUrl || doc.viewUrl || doc.fileUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPreviewModal({
                                title: doc.title,
                                blobUrl: doc.proxyUrl || doc.fileUrl,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white transition flex items-center gap-1"
                            title="معاينة الملف المخزن في Google Drive"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            بدون ملف مرفق
                          </span>
                        )}

                        {/* Direct Drive Download */}
                        {doc.fileId && (
                          <a
                            href={`/api/drive-file/${doc.fileId}?download=1&name=${encodeURIComponent(
                              doc.fileName || doc.title
                            )}`}
                            download
                            className="p-1.5 rounded-lg border text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="تحميل الملف من Google Drive"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {doc.viewUrl && (
                          <a
                            href={doc.viewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="فتح في Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Send Email Alert */}
                        {canSendAlerts && (
                          <button
                            type="button"
                            onClick={() => openEmailAlertModal(doc)}
                            className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-500/15 hover:bg-amber-500 hover:text-white transition"
                            title="إرسال إشعار بريدي للموظف"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Renew Document Expiry */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openRenewModal(doc)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition"
                            title="تجديد صلاحية الوثيقة"
                          >
                            تجديد
                          </button>
                        )}

                        {/* Edit */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditDocModal(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-sky-500 transition"
                            title="تعديل البيانات"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 transition"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ VIEW 2: TABLE LIST ═══ */}
      {viewMode === "table" && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th className="py-2.5 px-3 text-start font-semibold">الوثيقة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">التصنيف</th>
                  <th className="py-2.5 px-3 text-start font-semibold">القسم</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الموظف / الطاقم</th>
                  <th className="py-2.5 px-3 text-start font-semibold">جهة الإصدار</th>
                  <th className="py-2.5 px-3 text-center font-semibold">حالة الصلاحية</th>
                  <th className="py-2.5 px-3 text-end font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-default)" }}>
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد وثائق مطابقة للفلاتر المحددة
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => {
                    const deptObj = departments.find((d) => d.id === doc.departmentId);
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition"
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                            {doc.title}
                          </div>
                          {doc.docNo && (
                            <div className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                              #{doc.docNo}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] bg-slate-500/10 font-medium">
                            {doc.categoryLabel || doc.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-bold text-white"
                            style={{ backgroundColor: deptObj?.color || "#0284c7" }}
                          >
                            {doc.departmentName || "عام"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold" style={{ color: "var(--text-primary)" }}>
                            {doc.personName || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {doc.personRole} {doc.personEmail ? `· ${doc.personEmail}` : ""}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {doc.issuingAuthority || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {renderExpiryBadge(doc.expiryDate)}
                        </td>
                        <td className="py-2.5 px-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            {doc.proxyUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  openPreviewModal({
                                    title: doc.title,
                                    blobUrl: doc.proxyUrl || doc.fileUrl,
                                  })
                                }
                                className="p-1.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white transition"
                                title="معاينة الملف"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canSendAlerts && (
                              <button
                                type="button"
                                onClick={() => openEmailAlertModal(doc)}
                                className="p-1.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition"
                                title="إرسال إشعار بريدي"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openRenewModal(doc)}
                                className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-500 hover:text-white transition"
                                title="تجديد الصلاحية"
                              >
                                تجديد
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditDocModal(doc)}
                                className="p-1.5 rounded text-slate-400 hover:text-sky-500 transition"
                                title="تعديل"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDoc(doc)}
                                className="p-1.5 rounded text-slate-400 hover:text-rose-500 transition"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* ═══ VIEW 3: PERSONNEL ROSTER VIEW (عرض حسب الموظف) ═══ */}
      {viewMode === "personnel" && (
        <div className="space-y-3">
          {personnelWithDocs.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={cardStyle}>
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <div className="text-xs text-slate-400">لا يوجد موظفين مطابقين للبحث</div>
            </div>
          ) : (
            personnelWithDocs.map((person) => {
              const deptObj = departments.find((d) => d.id === person.suggestedDept);
              const isNonCompliant = person.status === "EXPIRED";
              const isWarning = person.status === "EXPIRING_SOON";

              return (
                <div
                  key={person.id}
                  className="rounded-xl p-4 border transition space-y-3"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: isNonCompliant
                      ? "#f43f5e"
                      : isWarning
                      ? "#f59e0b"
                      : "var(--border-default)",
                  }}
                >
                  {/* Personnel Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 shadow"
                        style={{ background: "var(--brand-gradient)" }}
                      >
                        {person.fullName ? person.fullName.slice(0, 2) : "OP"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className="font-bold text-sm"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {person.fullName}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 font-mono">
                            {person.role}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: deptObj?.color || "#0284c7" }}
                          >
                            {deptObj?.nameAr || "عام"}
                          </span>
                        </div>
                        <div
                          className="text-xs flex flex-wrap gap-2 mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {person.empNo && (
                            <span className="font-mono">#{person.empNo}</span>
                          )}
                          {person.email && <span>· {person.email}</span>}
                          {person.phone && <span>· {person.phone}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                          isNonCompliant
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : isWarning
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isNonCompliant ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" /> وثائق منتهية
                          </>
                        ) : isWarning ? (
                          <>
                            <Clock className="w-3.5 h-3.5" /> تنبيه اقتراب انتهاء
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> مكتمل وممتثل
                          </>
                        )}
                      </span>

                      {canUpload && (
                        <button
                          type="button"
                          onClick={() => openNewDocModal(person)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                          style={{ background: "var(--brand-primary)" }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة وثيقة</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Documents List for this person */}
                  {person.docs.length === 0 ? (
                    <div
                      className="p-3 rounded-lg text-center text-xs border border-dashed"
                      style={{
                        borderColor: "var(--border-default)",
                        color: "var(--text-muted)",
                      }}
                    >
                      لا توجد وثائق مرفوعة لهذا الموظف بعد. انقر على "إضافة وثيقة" لرفع رخصة أو جواز أو شهادة في Google Drive.
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {person.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-2.5 rounded-lg border space-y-1.5 flex flex-col justify-between"
                          style={innerBoxStyle}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className="font-bold text-xs truncate"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {doc.title}
                              </span>
                              {renderExpiryBadge(doc.expiryDate)}
                            </div>
                            {doc.docNo && (
                              <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                                #{doc.docNo}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                            {doc.proxyUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openPreviewModal({
                                    title: doc.title,
                                    blobUrl: doc.proxyUrl,
                                  })
                                }
                                className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> معاينة
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                بدون ملف
                              </span>
                            )}

                            <div className="flex items-center gap-1">
                              {canSendAlerts && (
                                <button
                                  type="button"
                                  onClick={() => openEmailAlertModal(doc)}
                                  className="p-1 rounded text-amber-500 hover:bg-amber-500/10"
                                  title="إرسال تنبيه بالبريد"
                                >
                                  <Mail className="w-3 h-3" />
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => openRenewModal(doc)}
                                  className="text-[10px] font-bold text-emerald-600 hover:underline px-1"
                                >
                                  تجديد
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ MODAL 1: ADD / EDIT DOCUMENT (رفع وحفظ في Google Drive) ═══ */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 fade-in"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-sky-500" />
                <span>
                  {editingDoc
                    ? "تعديل بيانات الوثيقة / Edit Document"
                    : "رفع وثيقة جديدة إلى Google Drive / Upload New Document"}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Personnel Selector */}
              <Field label="الموظف / عضو الطاقم المعني *">
                <Select
                  value={docDraft.personId}
                  onChange={(e) => {
                    const person = unifiedPersonnel.find(
                      (p) => String(p.id) === String(e.target.value)
                    );
                    const dept = departments.find(
                      (d) => d.id === person?.suggestedDept
                    );
                    setDocDraft({
                      ...docDraft,
                      personId: person?.id || "",
                      personName: person?.fullName || "",
                      personRole: person?.role || "",
                      personEmail: person?.email || "",
                      departmentId: dept?.id || docDraft.departmentId,
                      departmentName: dept?.nameAr || docDraft.departmentName,
                    });
                  }}
                >
                  <option value="">— اختر الموظف أو عضو الطاقم —</option>
                  {unifiedPersonnel.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.role} · {p.email || "بدون بريد"})
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Department & Category */}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="القسم التابع له / Department *">
                  <Select
                    value={docDraft.departmentId}
                    onChange={(e) => {
                      const dept = departments.find((d) => d.id === e.target.value);
                      setDocDraft({
                        ...docDraft,
                        departmentId: e.target.value,
                        departmentName: dept?.nameAr || "",
                      });
                    }}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nameAr}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="تصنيف الوثيقة / Category">
                  <Select
                    value={docDraft.category}
                    onChange={(e) => {
                      const cat = DOCUMENT_CATEGORIES.find(
                        (c) => c.id === e.target.value
                      );
                      setDocDraft({
                        ...docDraft,
                        category: e.target.value,
                        categoryLabel: cat?.labelAr || "",
                      });
                    }}
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.labelAr}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Title + Quick Suggestions */}
              <div>
                <Field label="مسمى الوثيقة / Document Title *">
                  <Input
                    value={docDraft.title}
                    onChange={(e) =>
                      setDocDraft({ ...docDraft, title: e.target.value })
                    }
                    placeholder="مثال: رخصة طيار نقل جوي ATPL، فحص طبي، جواز سفر..."
                  />
                </Field>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <span className="text-[10px] text-slate-400 me-1">اقتراحات:</span>
                  {QUICK_DOC_TITLES.slice(0, 5).map((tTitle) => (
                    <button
                      key={tTitle}
                      type="button"
                      onClick={() => setDocDraft({ ...docDraft, title: tTitle })}
                      className="text-[10px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 hover:bg-sky-500 hover:text-white transition"
                    >
                      {tTitle}
                    </button>
                  ))}
                </div>
              </div>

              {/* Doc No & Issuing Authority */}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="رقم الوثيقة / Document No">
                  <Input
                    value={docDraft.docNo}
                    onChange={(e) =>
                      setDocDraft({ ...docDraft, docNo: e.target.value })
                    }
                    placeholder="مثال: GACA-ATPL-98124"
                    className="font-mono"
                  />
                </Field>

                <Field label="جهة الإصدار / Issuing Authority">
                  <Input
                    value={docDraft.issuingAuthority}
                    onChange={(e) =>
                      setDocDraft({
                        ...docDraft,
                        issuingAuthority: e.target.value,
                      })
                    }
                    placeholder="مثال: GACA, EASA, وزارة الداخلية..."
                  />
                </Field>
              </div>

              {/* Issue Date & Expiry Date */}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="تاريخ الإصدار / Issue Date">
                  <Input
                    type="date"
                    value={docDraft.issueDate}
                    onChange={(e) =>
                      setDocDraft({ ...docDraft, issueDate: e.target.value })
                    }
                  />
                </Field>

                <Field label="تاريخ الانتهاء / Expiry Date (اتركه فارغاً للدائم)">
                  <Input
                    type="date"
                    value={docDraft.expiryDate}
                    onChange={(e) =>
                      setDocDraft({ ...docDraft, expiryDate: e.target.value })
                    }
                  />
                </Field>
              </div>

              {/* Google Drive File Upload Dropzone */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  ملف الوثيقة (PDF أو صورة) — يتم رفعه وحفظه تلقائياً في Google Drive
                </label>

                <div
                  className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition hover:border-sky-500"
                  style={{
                    borderColor: selectedLocalFile
                      ? "var(--brand-primary)"
                      : "var(--border-default)",
                    backgroundColor: "var(--bg-app)",
                  }}
                  onClick={() => document.getElementById("file-doc-input")?.click()}
                >
                  <input
                    id="file-doc-input"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleSelectFile}
                    className="hidden"
                  />
                  <Upload className="w-8 h-8 mx-auto mb-2 text-sky-500" />
                  {selectedLocalFile ? (
                    <div>
                      <div className="font-bold text-xs text-sky-600 dark:text-sky-400">
                        {selectedLocalFile.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {(selectedLocalFile.size / (1024 * 1024)).toFixed(2)} MB · جاهز للرفع إلى Google Drive
                      </div>
                    </div>
                  ) : docDraft.fileUrl ? (
                    <div>
                      <div className="font-bold text-xs text-emerald-600">
                        ✓ ملف محفوظ مسبقاً في Google Drive: {docDraft.fileName || "ملف معتمد"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        انقر هنا لاختيار ملف بديل
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>
                        اسحب الملف هنا أو انقر للاختيار من جهازك
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        يدعم ملفات PDF، وصور PNG، JPG حتى 25 ميغابايت
                      </div>
                    </div>
                  )}
                </div>

                {localFilePreview && (
                  <div className="mt-2 text-center">
                    <img
                      src={localFilePreview}
                      alt="preview"
                      className="max-h-36 rounded-lg mx-auto object-contain border"
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <Field label="ملاحظات تشغيلية أو قيود طبية / Notes">
                <Input
                  value={docDraft.notes}
                  onChange={(e) =>
                    setDocDraft({ ...docDraft, notes: e.target.value })
                  }
                  placeholder="مثال: صالح مع ارتداء نظارات طبية، متطلب طيار مساعد..."
                />
              </Field>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={uploadingFile}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء / Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDoc}
                disabled={uploadingFile}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow"
                style={{ background: "var(--brand-gradient)" }}
              >
                {uploadingFile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الرفع إلى Google Drive...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>حفظ في Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL 2: RENEW DOCUMENT (تحديث وتجديد الصلاحية) ═══ */}
      {renewingDoc && (
        <div
          className="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4 fade-in"
          onClick={() => setRenewingDoc(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>تجديد وتحديث صلاحية الوثيقة / Renew Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setRenewingDoc(null)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {renewingDoc.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
                  <span>الموظف: <b>{renewingDoc.personName}</b></span>
                  <span>· القسم: <b>{renewingDoc.departmentName}</b></span>
                  {renewingDoc.docNo && <span>· الرقم: <b>{renewingDoc.docNo}</b></span>}
                </div>
                <div className="mt-2 text-xs">
                  الصلاحية الحالية: {renderExpiryBadge(renewingDoc.expiryDate)}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="تاريخ الإصدار / الفحص الجديد">
                  <Input
                    type="date"
                    value={renewalDraft.newIssueDate}
                    onChange={(e) =>
                      setRenewalDraft({
                        ...renewalDraft,
                        newIssueDate: e.target.value,
                      })
                    }
                  />
                </Field>

                <Field label="تاريخ الانتهاء الجديد المعتمد *">
                  <Input
                    type="date"
                    value={renewalDraft.newExpiryDate}
                    onChange={(e) =>
                      setRenewalDraft({
                        ...renewalDraft,
                        newExpiryDate: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>

              <Field label="رقم إيصال التجديد أو ملاحظات الاعتماد">
                <Input
                  value={renewalDraft.renewalNotes}
                  onChange={(e) =>
                    setRenewalDraft({
                      ...renewalDraft,
                      renewalNotes: e.target.value,
                    })
                  }
                  placeholder="مثال: تم التجديد بسلطة الطيران، رقم الإيصال 8291..."
                />
              </Field>

              {/* Upload New Renewed File */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>
                  نسخة الوثيقة المجددة (PDF أو صورة) — يتم حفظها في Google Drive
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setRenewalFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:me-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-white hover:file:bg-sky-600 cursor-pointer"
                />
                {renewalFile && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                    ✓ تم اختيار: {renewalFile.name} ({(renewalFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {renewingDoc.personEmail && (
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={renewalDraft.sendEmailConfirmation}
                    onChange={(e) =>
                      setRenewalDraft({
                        ...renewalDraft,
                        sendEmailConfirmation: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-sky-600"
                  />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    إرسال إشعار بريدي للموظف ({renewingDoc.personEmail}) بتأكيد تجديد الوثيقة
                  </span>
                </label>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setRenewingDoc(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveRenewal}
                disabled={uploadingFile}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow bg-emerald-600 hover:bg-emerald-700"
              >
                {uploadingFile ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ في Drive...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>اعتماد وتجديد الوثيقة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL 3: SINGLE EMAIL ALERT (إرسال إشعار بريدي) ═══ */}
      {emailAlertDoc && (
        <div
          className="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4 fade-in"
          onClick={() => setEmailAlertDoc(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                <span>إرسال تنبيه صلاحية الوثيقة عبر البريد / Send Email Alert</span>
              </h3>
              <button
                type="button"
                onClick={() => setEmailAlertDoc(null)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs space-y-1">
                <div>الوثيقة: <b>{emailAlertDoc.title}</b> (#{emailAlertDoc.docNo || "—"})</div>
                <div>تاريخ الانتهاء: <b>{emailAlertDoc.expiryDate || "—"}</b></div>
                <div>الموظف المعني: <b>{emailAlertDoc.personName}</b> ({emailAlertDoc.personRole})</div>
              </div>

              <Field label="البريد الإلكتروني للمستلم *">
                <Input
                  type="email"
                  value={emailAlertDraft.recipientEmail}
                  onChange={(e) =>
                    setEmailAlertDraft({
                      ...emailAlertDraft,
                      recipientEmail: e.target.value,
                    })
                  }
                  placeholder="crew@aeroops.aero"
                />
              </Field>

              <Field label="نسخة إلى مدير القسم (CC)">
                <Input
                  type="email"
                  value={emailAlertDraft.headEmail}
                  onChange={(e) =>
                    setEmailAlertDraft({
                      ...emailAlertDraft,
                      headEmail: e.target.value,
                    })
                  }
                  placeholder="ops-manager@aeroops.aero"
                />
              </Field>

              <Field label="حساب الإرسال (Sender Account)">
                <Select
                  value={emailAlertDraft.senderAccountId}
                  onChange={(e) =>
                    setEmailAlertDraft({
                      ...emailAlertDraft,
                      senderAccountId: e.target.value,
                    })
                  }
                >
                  {listEmailAccounts().map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name ? `${acc.name} (${acc.email})` : acc.email}
                      {acc.isDefault ? " [الافتراضي]" : ""}
                    </option>
                  ))}
                  {listEmailAccounts().length === 0 && (
                    <option value="">خادم النظام الافتراضي (System Relay)</option>
                  )}
                </Select>
              </Field>

              <Field label="ملاحظات أو توجيهات إضافية في الرسالة">
                <Input
                  value={emailAlertDraft.customMessage}
                  onChange={(e) =>
                    setEmailAlertDraft({
                      ...emailAlertDraft,
                      customMessage: e.target.value,
                    })
                  }
                  placeholder="مثال: يرجى تسليم التقرير الطبي قبل موعد رحلة الجمعة..."
                />
              </Field>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setEmailAlertDoc(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSendSingleAlert}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Send className="w-4 h-4" />
                <span>إرسال التنبيه الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL 4: BULK SEND EMAIL ALERTS (إرسال تنبيهات جماعية) ═══ */}
      {showBulkAlertModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4 fade-in"
          onClick={() => !bulkSending && setShowBulkAlertModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-amber-500" />
                <span>إرسال تنبيهات بريدية جماعية ({expiringOrExpiredDocs.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => !bulkSending && setShowBulkAlertModal(false)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300">
                سيتم إرسال بريد رسمي منسق ومخصص لكل موظف يحتوي على تفاصيل وثيقته وتاريخ الانتهاء ورابط الملف في Google Drive.
              </div>

              <div className="max-h-48 overflow-y-auto divide-y border rounded-lg text-xs" style={{ borderColor: "var(--border-default)" }}>
                {expiringOrExpiredDocs.map((doc) => {
                  const days = getDaysRemaining(doc.expiryDate);
                  return (
                    <div key={doc.id} className="p-2 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <div className="font-bold truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-500">{doc.personName} · {doc.personEmail}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${days < 0 ? "bg-rose-500/15 text-rose-600" : "bg-amber-500/15 text-amber-600"}`}>
                        {days < 0 ? `منتهي (${Math.abs(days)}d)` : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>

              <Field label="ملاحظات موحدة ترفق بالرسائل (اختياري)">
                <Input
                  value={bulkAlertCustomMessage}
                  onChange={(e) => setBulkAlertCustomMessage(e.target.value)}
                  placeholder="مثال: يرجى التنسيق مع إدارة العمليات قبل صدور جدول الأسبوع القادم..."
                />
              </Field>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkAlertModal(false)}
                disabled={bulkSending}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleBulkSendAlerts}
                disabled={bulkSending}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 bg-amber-600 hover:bg-amber-700 shadow"
              >
                {bulkSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>إرسال لكافة المعنيين ({expiringOrExpiredDocs.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL 5: MANAGE DEPARTMENTS (إدارة الأقسام) ═══ */}
      {showDeptsModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 fade-in"
          onClick={() => setShowDeptsModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-500" />
                <span>إدارة أقسام وتصنيفات المنظومة / Aviation Departments</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDeptsModal(false)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Add / Edit Form */}
              <div className="p-3.5 rounded-xl border space-y-3" style={innerBoxStyle}>
                <h4 className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>
                  {editingDept ? "تعديل القسم" : "إضافة قسم جديد"}
                </h4>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="اسم القسم بالعربية *">
                    <Input
                      value={deptDraft.nameAr}
                      onChange={(e) =>
                        setDeptDraft({ ...deptDraft, nameAr: e.target.value })
                      }
                      placeholder="مثال: التدريب وعمليات الطيران"
                    />
                  </Field>
                  <Field label="اسم القسم بالإنجليزية">
                    <Input
                      value={deptDraft.nameEn}
                      onChange={(e) =>
                        setDeptDraft({ ...deptDraft, nameEn: e.target.value })
                      }
                      placeholder="e.g., Flight Training Dept"
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="اسم مدير القسم / Head of Dept">
                    <Input
                      value={deptDraft.headName}
                      onChange={(e) =>
                        setDeptDraft({ ...deptDraft, headName: e.target.value })
                      }
                      placeholder="الكابتن / المهندس..."
                    />
                  </Field>
                  <Field label="بريد إشعار مدير القسم (CC)">
                    <Input
                      type="email"
                      value={deptDraft.headEmail}
                      onChange={(e) =>
                        setDeptDraft({ ...deptDraft, headEmail: e.target.value })
                      }
                      placeholder="head@aeroops.aero"
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="الوظائف المربوطة بالقسم (مفصولة بفاصلة)">
                    <Input
                      value={deptDraft.roles}
                      onChange={(e) =>
                        setDeptDraft({ ...deptDraft, roles: e.target.value })
                      }
                      placeholder="CPT, FO, FE, TRE..."
                      className="font-mono"
                    />
                  </Field>
                  <Field label="لون التمييز (Hex Color)">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={deptDraft.color || "#0284c7"}
                        onChange={(e) =>
                          setDeptDraft({ ...deptDraft, color: e.target.value })
                        }
                        className="w-9 h-9 rounded cursor-pointer border"
                      />
                      <Input
                        value={deptDraft.color || "#0284c7"}
                        onChange={(e) =>
                          setDeptDraft({ ...deptDraft, color: e.target.value })
                        }
                        className="font-mono text-xs"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="وصف واختصاصات القسم">
                  <Input
                    value={deptDraft.description}
                    onChange={(e) =>
                      setDeptDraft({ ...deptDraft, description: e.target.value })
                    }
                    placeholder="نطاق الوثائق واختصاصات هذا القسم..."
                  />
                </Field>

                <div className="flex justify-end gap-2 pt-1">
                  {editingDept && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDept(null);
                        setDeptDraft({
                          nameAr: "",
                          nameEn: "",
                          icon: "Building2",
                          color: "#0284c7",
                          headName: "",
                          headEmail: "",
                          roles: "",
                          description: "",
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                    >
                      إلغاء التعديل
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveDept}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow"
                    style={{ background: "var(--brand-primary)" }}
                  >
                    {editingDept ? "تحديث القسم" : "إضافة القسم"}
                  </button>
                </div>
              </div>

              {/* Existing Departments List */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs" style={{ color: "var(--text-muted)" }}>
                  الأقسام المسجلة في المنظومة ({departments.length})
                </h4>

                <div className="divide-y border rounded-xl overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color || "#0284c7" }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                            {dept.nameAr}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {dept.headName && <span>المدير: {dept.headName} · </span>}
                            {dept.headEmail && <span>{dept.headEmail} · </span>}
                            <span>الوظائف: {Array.isArray(dept.roles) ? dept.roles.join(", ") : dept.roles || "عام"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDept(dept);
                            setDeptDraft({
                              nameAr: dept.nameAr || "",
                              nameEn: dept.nameEn || "",
                              icon: dept.icon || "Building2",
                              color: dept.color || "#0284c7",
                              headName: dept.headName || "",
                              headEmail: dept.headEmail || "",
                              roles: Array.isArray(dept.roles) ? dept.roles.join(", ") : dept.roles || "",
                              description: dept.description || "",
                            });
                          }}
                          className="p-1.5 rounded hover:bg-sky-500/15 hover:text-sky-600 transition"
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDept(dept)}
                          className="p-1.5 rounded hover:bg-rose-500/15 hover:text-rose-500 transition"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeptsModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsModule;
