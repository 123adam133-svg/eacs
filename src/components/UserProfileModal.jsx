/* ═══════════════════════════════════════════════════════════
 * USER PROFILE MODAL — Full-Page Compact, Clean & Theme-Aware View
 * Displays user identity, aviation credentials, crew qualifications,
 * and attached documents with theme-aware styling (light/dark support).
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  Briefcase,
  Shield,
  Calendar,
  FileText,
  Download,
  Eye,
  Lock,
  Award,
  MapPin,
  Hash,
  Paperclip,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Plane,
  Building2,
} from "lucide-react";
import { useT } from "../contexts";
import { getRoleLabel, getRoleIcon, getRoleColor } from "../config/permissions";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import { toDisplayImageUrl, toDownloadFileUrl } from "../api";

function normalizeAttachments(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d.getUTCDate()).padStart(2, "0")}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function UserProfileModal({ user, crew, settings, onClose }) {
  const t = useT();
  const lang = document.documentElement.lang || "en";
  const isRTL = lang === "ar";
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (previewDoc) {
          setPreviewDoc(null);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewDoc, onClose]);

  if (!user) return null;

  /* ═══ Related crew member ═══ */
  const linkedCrew = crew?.find(
    (c) =>
      String(c.id) === String(user.crewId) ||
      (c.empNo && user.username && String(c.empNo).replace(/^#/, "") === String(user.username)) ||
      (c.email && user.email && c.email.toLowerCase() === user.email.toLowerCase())
  );

  /* ═══ Attachments — Merged from User + Crew ═══ */
  const attachments = useMemo(() => {
    const fromUser = normalizeAttachments(user.attachments);
    const fromCrew = normalizeAttachments(linkedCrew?.attachments);
    const all = [...fromUser, ...fromCrew];
    const seen = new Set();
    return all.filter((a) => {
      const key = a.url || a.fileUrl || a.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user, linkedCrew]);

  /* ═══ Role styling ═══ */
  const roleColor = getRoleColor(user.role);
  const roleIcon = getRoleIcon(user.role);
  const roleLabel = getRoleLabel(user.role, isRTL ? "ar" : "en");
  const operatorCode = settings?.companyCode || "5A-GAK";

  /* ═══ Basic Info Fields ═══ */
  const basicInfo = [
    {
      icon: User,
      label: isRTL ? "الاسم الكامل" : "Full Name",
      value: user.fullName || user.name || "—",
    },
    {
      icon: Hash,
      label: isRTL ? "اسم المستخدم" : "Username",
      value: user.username || "—",
      mono: true,
    },
    {
      icon: Briefcase,
      label: isRTL ? "المسمى الوظيفي" : "Job Title",
      value: user.jobTitle || linkedCrew?.role || "—",
    },
    {
      icon: Shield,
      label: isRTL ? "الدور والصلاحيات" : "Role & Access",
      value: (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${roleColor}`}>
          <span>{roleIcon}</span>
          {roleLabel}
        </span>
      ),
    },
    {
      icon: Mail,
      label: isRTL ? "البريد الإلكتروني" : "Email",
      value: user.email || linkedCrew?.email || "—",
      link: user.email ? `mailto:${user.email}` : null,
      mono: true,
    },
    {
      icon: Phone,
      label: isRTL ? "رقم الهاتف" : "Phone",
      value: user.phone || linkedCrew?.phone || "—",
      link: user.phone ? `tel:${user.phone}` : null,
      mono: true,
    },
    {
      icon: Calendar,
      label: isRTL ? "تاريخ الإنشاء / الانضمام" : "Joined Date",
      value: fmtDate(user.createdAt || linkedCrew?.joinDate),
      mono: true,
    },
    {
      icon: Building2,
      label: isRTL ? "رمز المشغل / الشركة" : "Operator Code",
      value: operatorCode,
      mono: true,
    },
  ];

  /* ═══ Crew / Operational Info Fields ═══ */
  const crewInfo = linkedCrew
    ? [
        {
          label: isRTL ? "رمز الطاقم (Emp No)" : "Crew Code",
          value: linkedCrew.empNo || `#${linkedCrew.id}`,
          mono: true,
        },
        {
          label: isRTL ? "الرتبة / الوظيفة" : "Rank / Role",
          value: linkedCrew.role || linkedCrew.rank || "—",
        },
        {
          label: isRTL ? "المحطة الرئيسية (Base)" : "Base Station",
          value: linkedCrew.base || "HLLM (Tripoli)",
          mono: true,
        },
        {
          label: isRTL ? "الجنسية" : "Nationality",
          value: linkedCrew.nationality || "Libyan",
        },
        {
          label: isRTL ? "رقم الجواز" : "Passport Number",
          value: linkedCrew.passportNo || "—",
          mono: true,
        },
        {
          label: isRTL ? "انتهاء الجواز" : "Passport Expiry",
          value: fmtDate(linkedCrew.passportExpiry),
          mono: true,
        },
        {
          label: isRTL ? "رقم رخصة الطيران" : "License Number",
          value: linkedCrew.licenseNo || "—",
          mono: true,
        },
        {
          label: isRTL ? "انتهاء الشهادة الطبية" : "Medical Expiry",
          value: fmtDate(linkedCrew.medicalExpiry),
          mono: true,
        },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full h-full max-w-7xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ FULL-PAGE HEADER BAR ═══ */}
        <div className="p-3.5 sm:p-4 bg-[#1b365d] text-white flex items-center justify-between border-b border-[#142947] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* User Avatar */}
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-base font-bold shrink-0 overflow-hidden shadow-inner">
              {toDisplayImageUrl(user.avatar) ? (
                <img
                  src={toDisplayImageUrl(user.avatar)}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sky-300">
                  {(user.fullName || user.username || "?")[0].toUpperCase()}
                </span>
              )}
            </div>

            {/* User Title & Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold truncate text-white">
                  {user.fullName || user.username || "User"}
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-900/80 border border-sky-600/50 text-sky-200">
                  {operatorCode}
                </span>
                {user.active !== false ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{isRTL ? "حساب نشط" : "Active"}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                    <AlertCircle className="w-3 h-3 text-rose-400" />
                    <span>{isRTL ? "موقوف" : "Inactive"}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-sky-200/80 mt-0.5 flex-wrap">
                <span className="font-mono text-sky-300">@{user.username}</span>
                {user.jobTitle && <span>· {user.jobTitle}</span>}
                {linkedCrew && (
                  <span className="text-emerald-300">
                    · {isRTL ? "عضو طاقم مسجل" : "Registered Crew"} ({linkedCrew.empNo || linkedCrew.role})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ FULL-PAGE COMPACT 3-COLUMN CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/60">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-full">
            {/* ── COLUMN 1: BASIC INFORMATION (4 cols) ── */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <User className="w-4 h-4 text-sky-500" />
                    <span>{isRTL ? "المعلومات الأساسية" : "Basic Information"}</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {user.id || user.uid}</span>
                </div>

                <div className="space-y-2">
                  {basicInfo.map((row, idx) => {
                    const Icon = row.icon;
                    return (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2.5 text-xs"
                      >
                        <div className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <Icon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">
                            {row.label}
                          </div>
                          <div className={`font-semibold text-slate-800 dark:text-slate-200 truncate ${row.mono ? "font-mono" : ""}`}>
                            {row.link ? (
                              <a
                                href={row.link}
                                className="text-sky-600 dark:text-sky-400 hover:underline decoration-dotted"
                              >
                                {row.value}
                              </a>
                            ) : (
                              row.value
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* View-only notice */}
              <div className="mt-3 p-2 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>
                  {isRTL
                    ? "عرض فقط — لتعديل البيانات اتصل بمسؤول المنظومة"
                    : "View-only — contact system admin to modify details"}
                </span>
              </div>
            </div>

            {/* ── COLUMN 2: CREW & OPERATIONAL QUALIFICATIONS (4 cols) ── */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-500" />
                    <span>{isRTL ? "بيانات الطاقم والاعتمادات" : "Crew & Qualifications"}</span>
                  </h3>
                  {linkedCrew && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                      {linkedCrew.role || "CREW"}
                    </span>
                  )}
                </div>

                {linkedCrew ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {crewInfo.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs"
                        >
                          <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 truncate">
                            {item.label}
                          </div>
                          <div className={`font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate ${item.mono ? "font-mono" : ""}`}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Aircraft Type Ratings */}
                    {Array.isArray(linkedCrew.aircraft) && linkedCrew.aircraft.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs mt-2">
                        <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                          <Plane className="w-3 h-3 text-sky-500" />
                          <span>{isRTL ? "الطائرات المؤهل عليها (Type Ratings):" : "Qualified Aircraft:"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {linkedCrew.aircraft.map((ac, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-bold"
                            >
                              {ac}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-4 text-center">
                    <Award className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs font-semibold">{isRTL ? "غير مربوط بسجل طاقم جوي" : "Not linked to a crew record"}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isRTL
                        ? "هذا الحساب مخصص للمستخدمين الإداريين أو الموظفين الأرضيين"
                        : "This account is configured for administrative or ground personnel"}
                    </p>
                  </div>
                )}
              </div>

              {/* Status summary */}
              {linkedCrew && (
                <div className="mt-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  <span>
                    {isRTL
                      ? "عضو طاقم مسجل ومرخص للعمليات الميدانية والجوية"
                      : "Verified crew member licensed for flight operations"}
                  </span>
                </div>
              )}
            </div>

            {/* ── COLUMN 3: ATTACHED DOCUMENTS & FILES (4 cols) ── */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-purple-500" />
                    <span>{isRTL ? "الملفات والوثائق المرفقة" : "Attached Documents"}</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                    {attachments.length} {isRTL ? "ملف" : "files"}
                  </span>
                </div>

                {attachments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400 dark:text-slate-500 text-center">
                    <Paperclip className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs font-semibold">{isRTL ? "لا توجد ملفات مرفقة" : "No attached documents"}</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isRTL ? "لم يتم إرفاق جوازات أو رخص أو شهادات لهذا الحساب" : "No passports or certificates attached"}
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 pe-1 max-h-[460px]">
                    {attachments.map((doc, idx) => {
                      const name = doc.name || doc.fileName || `Document ${idx + 1}`;
                      const url = doc.url || doc.fileUrl || doc.data || "";
                      const size = doc.size ? formatFileSize(doc.size) : "";
                      const type = doc.type || doc.mimeType || "";
                      const isImg = type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(name);

                      return (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 hover:border-purple-500/40 transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                              {isImg ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-purple-600 dark:group-hover:text-purple-300 transition" title={name}>
                                {name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {size || "PDF/File"}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Preview & Download */}
                          {url ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setPreviewDoc({ name, url, type })}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-500/15 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition"
                                title={isRTL ? "معاينة الملف" : "Preview"}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={toDownloadFileUrl(url, name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={name}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-500/15 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition"
                                title={isRTL ? "تحميل" : "Download"}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">{isRTL ? "غير متاح" : "N/A"}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ FULL-PAGE FOOTER ═══ */}
        <div className="p-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>
              {isRTL
                ? "عرض شامل ومصغر لكافة البيانات الشخصية والمهنية والملفات المرفقة"
                : "Comprehensive compact view of user credentials & attached documents"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition text-xs"
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>

      {/* ═══ FILE PREVIEW MODAL ═══ */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-3 bg-[#1b365d] text-white flex items-center justify-between border-b border-[#142947] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-purple-300 shrink-0" />
                <span className="font-bold text-xs sm:text-sm truncate text-white">{previewDoc.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={toDownloadFileUrl(previewDoc.url, previewDoc.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={previewDoc.name}
                  className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Viewer Body */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center">
              {(previewDoc.type?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.name || "")) &&
              toDisplayImageUrl(previewDoc.url) ? (
                <img
                  src={toDisplayImageUrl(previewDoc.url)}
                  alt={previewDoc.name}
                  className="max-w-full max-h-full object-contain p-2"
                />
              ) : previewDoc.url ? (
                <PdfCanvasViewer
                  pdfData={previewDoc.url}
                  title={previewDoc.name || "Attachment Preview"}
                  fileName={previewDoc.name || "attachment.pdf"}
                  maxHeight="100%"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  {isRTL ? "لا يتوفر رابط صالح لمعاينة هذا المرفق" : "No valid preview URL available"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfileModal;
