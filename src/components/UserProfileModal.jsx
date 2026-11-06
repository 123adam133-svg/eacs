/* ═══════════════════════════════════════════════════════════
 * USER PROFILE MODAL — Read-Only
 * عرض معلومات المستخدم + الملفات المرفقة (بدون تعديل)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { useT } from "../contexts";
import { getRoleLabel, getRoleIcon, getRoleColor } from "../config/permissions";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import { toDisplayImageUrl, toPreviewFileUrl, toDownloadFileUrl } from "../api";

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
  return `${String(d.getUTCDate()).padStart(2, "0")}-${
    months[d.getUTCMonth()]
  }-${d.getUTCFullYear()}`;
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

  if (!user) return null;

  /* ═══ Related crew data (if user is linked to crew member) ═══ */
  const linkedCrew = crew?.find((c) => String(c.id) === String(user.crewId));

  /* ═══ Attachments — من user أو crew ═══ */
  const attachments = useMemo(() => {
    const fromUser = normalizeAttachments(user.attachments);
    const fromCrew = normalizeAttachments(linkedCrew?.attachments);
    // دمج + إزالة التكرار
    const all = [...fromUser, ...fromCrew];
    const seen = new Set();
    return all.filter((a) => {
      const key = a.url || a.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [user, linkedCrew]);

  /* ═══ Role styling ═══ */
  const roleColor = getRoleColor(user.role);
  const roleIcon = getRoleIcon(user.role);
  const roleLabel = getRoleLabel(user.role, isRTL ? "ar" : "en");

  /* ═══ Info rows ═══ */
  const infoRows = [
    {
      icon: User,
      label: isRTL ? "الاسم الكامل" : "Full Name",
      value: user.fullName || "—",
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
      value: user.jobTitle || "—",
    },
    {
      icon: Shield,
      label: isRTL ? "الدور" : "Role",
      value: (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${roleColor}`}
        >
          <span>{roleIcon}</span>
          {roleLabel}
        </span>
      ),
    },
    {
      icon: Mail,
      label: isRTL ? "البريد الإلكتروني" : "Email",
      value: user.email || "—",
      link: user.email ? `mailto:${user.email}` : null,
    },
    {
      icon: Phone,
      label: isRTL ? "الهاتف" : "Phone",
      value: user.phone || "—",
      link: user.phone ? `tel:${user.phone}` : null,
    },
    {
      icon: Calendar,
      label: isRTL ? "تاريخ الانضمام" : "Joined",
      value: user.createdAt ? fmtDate(user.createdAt) : "—",
    },
  ];

  /* ═══ Crew extra info (if linked) ═══ */
  const crewExtraInfo = linkedCrew
    ? [
        {
          label: isRTL ? "الرقم الوظيفي" : "Employee No",
          value: linkedCrew.empNo || "—",
        },
        {
          label: isRTL ? "الرخصة" : "License",
          value: linkedCrew.licenseNo || "—",
        },
        {
          label: isRTL ? "انتهاء الرخصة" : "License Expiry",
          value: linkedCrew.licenseExpiry
            ? fmtDate(linkedCrew.licenseExpiry)
            : "—",
        },
        {
          label: isRTL ? "انتهاء الطبية" : "Medical Expiry",
          value: linkedCrew.medicalExpiry
            ? fmtDate(linkedCrew.medicalExpiry)
            : "—",
        },
        {
          label: isRTL ? "الجواز" : "Passport",
          value: linkedCrew.passportNo || "—",
        },
        {
          label: isRTL ? "الجنسية" : "Nationality",
          value: linkedCrew.nationality || "—",
        },
        {
          label: isRTL ? "القاعدة" : "Base",
          value: linkedCrew.base || "—",
        },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER ═══ */}
        <div
          className="p-5 flex items-start gap-4 text-white relative"
          style={{ background: "var(--brand-gradient)" }}
        >
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {toDisplayImageUrl(user.avatar) ? (
              <img
                src={toDisplayImageUrl(user.avatar)}
                alt={user.fullName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              (user.fullName || user.username || "?")[0].toUpperCase()
            )}
          </div>

          {/* Name + Role */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">
              {user.fullName || user.username || "User"}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                <span>{roleIcon}</span>
                {roleLabel}
              </span>
              {user.active !== false && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-xs font-bold">
                  ✅ {isRTL ? "نشط" : "Active"}
                </span>
              )}
              {user.active === false && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/30 text-xs font-bold">
                  ⛔ {isRTL ? "موقوف" : "Inactive"}
                </span>
              )}
            </div>
            {user.jobTitle && (
              <div className="text-xs opacity-80 mt-1">{user.jobTitle}</div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ BODY — Scrollable ═══ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 🔒 Read-Only Note */}
          <div className="p-2.5 rounded-lg text-xs flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-500">
            <Lock className="w-4 h-4 flex-shrink-0" />
            {isRTL
              ? "وضع العرض فقط — لتعديل المعلومات، تواصل مع المسؤول."
              : "View-only mode — to edit info, contact administrator."}
          </div>

          {/* ═══ Basic Info ═══ */}
          <section>
            <h3
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <User
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
              {isRTL ? "المعلومات الأساسية" : "Basic Information"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {infoRows.map((row, idx) => {
                const Icon = row.icon;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg flex items-center gap-3"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <Icon
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: "var(--text-muted)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[10px] uppercase font-bold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {row.label}
                      </div>
                      <div
                        className={`text-sm font-semibold truncate ${
                          row.mono ? "font-mono" : ""
                        }`}
                        style={{ color: "var(--text-primary)" }}
                      >
                        {row.link ? (
                          <a
                            href={row.link}
                            className="hover:underline"
                            style={{ color: "var(--brand-primary)" }}
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
          </section>

          {/* ═══ Crew Info (if linked) ═══ */}
          {linkedCrew && crewExtraInfo.length > 0 && (
            <section>
              <h3
                className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Award
                  className="w-4 h-4"
                  style={{ color: "var(--brand-primary)" }}
                />
                {isRTL ? "معلومات الطاقم" : "Crew Information"}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {crewExtraInfo.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <div
                      className="text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {row.label}
                    </div>
                    <div
                      className="text-xs font-semibold mt-0.5"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ═══ Attachments ═══ */}
          <section>
            <h3
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Paperclip
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
              {isRTL ? "الملفات المرفقة" : "Attached Files"}
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: "var(--bg-app)",
                  color: "var(--brand-primary)",
                }}
              >
                {attachments.length}
              </span>
            </h3>

            {attachments.length === 0 ? (
              <div
                className="p-8 text-center rounded-xl border-2 border-dashed"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                <Paperclip className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <div className="text-sm">
                  {isRTL ? "لا توجد ملفات مرفقة" : "No attached files"}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((doc, idx) => {
                  const name = doc.name || doc.fileName || `File ${idx + 1}`;
                  const url = doc.url || doc.fileUrl || doc.data || "";
                  const size = doc.size ? formatFileSize(doc.size) : "";
                  const type = doc.type || doc.mimeType || "";

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg flex items-center gap-3"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: "rgba(168, 85, 247, 0.15)" }}
                      >
                        {type?.startsWith("image/") ? (
                          <ImageIcon className="w-5 h-5 text-purple-500" />
                        ) : (
                          <FileText className="w-5 h-5 text-purple-500" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold text-sm truncate"
                          style={{ color: "var(--text-primary)" }}
                          title={name}
                        >
                          {name}
                        </div>
                        <div
                          className="text-[10px] flex gap-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {type && <span className="font-mono">{type}</span>}
                          {size && <span>· {size}</span>}
                        </div>
                      </div>

                      {/* Actions — View + Download only */}
                      {url ? (
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => setPreviewDoc({ name, url, type })}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-blue-500/20"
                            style={{ color: "var(--brand-primary)" }}
                            title={isRTL ? "عرض" : "View"}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={toDownloadFileUrl(url, name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={name}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-emerald-500/20"
                            style={{ color: "var(--text-muted)" }}
                            title={isRTL ? "تحميل" : "Download"}
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <span
                          className="text-[10px] italic"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {isRTL ? "رابط غير متاح" : "No link"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div
          className="p-3 border-t flex justify-end"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold border transition hover:bg-slate-50 dark:hover:bg-slate-700"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>

      {/* ═══ File Preview Modal ═══ */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.9)" }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "2px solid var(--brand-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-3 flex items-center justify-between text-white"
              style={{ background: "var(--brand-gradient)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span className="font-bold text-sm truncate">
                  {previewDoc.name}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative">
              {(previewDoc.type?.startsWith("image/") ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.name || "")) &&
              toDisplayImageUrl(previewDoc.url) ? (
                <img
                  src={toDisplayImageUrl(previewDoc.url)}
                  alt={previewDoc.name}
                  className="w-full h-full object-contain"
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
                <div className="w-full h-full flex items-center justify-center p-6 text-sm text-slate-500">
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
