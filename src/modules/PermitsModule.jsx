/* ═══════════════════════════════════════════════════════════
 * PERMITS MODULE — v4.0
 * - Permits Library: Upload Country Form (HTML / PDF / Image) OR Paste/Edit HTML
 *   + Auto-recognize HTML placeholders/inputs/cells & PDF AcroForm fields
 *   + Interactive System Data Linking (Flight, Legs, Aircraft/CAMO, Crew, Operator)
 *   + Visual PDF Coordinate Mapper + Custom Manual Fields
 * - Flight Permits: Select Flight -> Auto-detect Route/Leg Countries + Smart Template
 *   Matching (Landing vs Overflight) -> Auto-open Filled Country Form (HTML / PDF)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  FileSignature,
  Plane,
  Globe,
  Upload,
  Paperclip,
  X,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  MapPin,
  MousePointer2,
  Sparkles,
  Eye,
  Code2,
  Link2,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import {
  permitTemplatesAPI,
  flightPermitsAPI,
  uploadFile,
  toPreviewFileUrl,
} from "../api";
import { can as checkPerm } from "../config/permissions";
import { fmtDate } from "../utils/helpers";
import {
  getCountryFromAirport,
  getAvailableCountries,
} from "../config/airportCountries";
import { extractPDFFormFields } from "../utils/pdfFiller";
import {
  SYSTEM_DATA_CATALOG,
  buildSystemAutoData,
  recognizeHtmlTemplateFields,
  buildPrintableHtmlDocument,
} from "../utils/htmlTemplateEngine";
import {
  showToast,
  confirmAction,
  openPreviewModal,
} from "../utils/dialog";
import { FormsModule } from "./FormsModule";

import { PermitPrintModal } from "../components/PermitPrintModal";
import { PermitGenerateModal } from "../components/PermitGenerateModal";
import { PDFFieldMapper } from "../components/PDFFieldMapper";
import { SmartDocumentScannerModal } from "../components/SmartDocumentScannerModal";

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};
const innerBoxStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

const PERMIT_TYPES = [
  "OVERFLIGHT",
  "LANDING",
  "DIPLOMATIC",
  "TECHNICAL",
  "CHARTER",
  "CARGO",
];

const STATUS_COLORS = {
  ACTIVE: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  APPROVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FINAL: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  EXPIRED: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SUSPENDED: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  DRAFT: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
};

const QUICK_HTML_TOKENS = [
  { key: "flightNo", label: "رقم الرحلة {{flightNo}}" },
  { key: "date", label: "تاريخ الرحلة {{date}}" },
  { key: "aircraft", label: "الطائرة {{aircraft}}" },
  { key: "aircraftType", label: "الطراز {{aircraftType}}" },
  { key: "departure", label: "المغادرة {{departure}}" },
  { key: "arrival", label: "الوصول {{arrival}}" },
  { key: "std", label: "الإقلاع {{std}}" },
  { key: "sta", label: "الوصول {{sta}}" },
  { key: "route", label: "المسار {{route}}" },
  { key: "purpose", label: "الغرض {{purpose}}" },
  { key: "picName", label: "الكابتن {{picName}}" },
  { key: "coaExpiry", label: "الصلاحية {{coaExpiry}}" },
  { key: "insuranceExpiry", label: "التأمين {{insuranceExpiry}}" },
  { key: "sectorsTableHtml", label: "جدول القطاعات {{sectorsTableHtml}}" },
  { key: "crewTableHtml", label: "جدول الطاقم {{crewTableHtml}}" },
];

const GROUPED_SYSTEM_CATALOG = SYSTEM_DATA_CATALOG.reduce((acc, item) => {
  const grp = item.group || "Other";
  if (!acc[grp]) acc[grp] = [];
  acc[grp].push(item);
  return acc;
}, {});

export function PermitsModule({
  flights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user,
  lang,
  initialSubTab,
  setSyncStatus,
}) {
  const isAr = (lang || document.documentElement.lang || "ar") === "ar";
  const canViewPermits = checkPerm(user, "permits.view");
  const canViewForms = checkPerm(user, "forms.view");

  const hubTabs = useMemo(() => {
    const list = [];
    if (canViewPermits) {
      list.push(
        {
          id: "flight-permits",
          icon: Plane,
          labelAr: "تصاريح الرحلات",
          labelEn: "Flight Permits",
        },
        {
          id: "library",
          icon: BookOpen,
          labelAr: "مكتبة نماذج الدول",
          labelEn: "Country Permits Library",
        }
      );
    }
    if (canViewForms) {
      list.push({
        id: "forms",
        icon: ClipboardList,
        labelAr: "النماذج التشغيلية",
        labelEn: "Operational Forms",
      });
    }
    return list;
  }, [canViewPermits, canViewForms]);

  const resolveTab = (candidate) => {
    if (candidate === "forms" && canViewForms) return "forms";
    if (candidate === "library" && canViewPermits) return "library";
    if (
      (candidate === "flight-permits" || candidate === "permits") &&
      canViewPermits
    ) {
      return "flight-permits";
    }
    return hubTabs[0]?.id || "flight-permits";
  };

  const [activeTab, setActiveTab] = useState(() => resolveTab(initialSubTab));
  const [showSmartScanner, setShowSmartScanner] = useState(false);

  useEffect(() => {
    setActiveTab((prev) =>
      initialSubTab ? resolveTab(initialSubTab) : resolveTab(prev)
    );
  }, [initialSubTab, canViewPermits, canViewForms]);

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ UNIFIED PERMITS & FORMS HUB HEADER ═══ */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h1
                className="text-lg md:text-xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr
                  ? "مركز التصاريح والنماذج التشغيلية"
                  : "Permits & Operational Forms Hub"}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "إصدار تصاريح الرحلات ومكتبة نماذج الدول والنماذج التشغيلية المربوطة تلقائياً ببيانات الرحلة"
                  : "Flight permits, country CAA templates library, and auto-filled operational flight forms"}
              </p>
            </div>
          </div>

          {activeTab !== "forms" && canViewPermits && (
            <button
              type="button"
              onClick={() => setShowSmartScanner(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-white text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap shrink-0 transition hover:opacity-95"
              style={{ background: "linear-gradient(135deg, #059669, #0284c7)" }}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              {isAr
                ? "الماسح الذكي للتصاريح (AI OCR)"
                : "Smart Permit Scanner (AI OCR)"}
            </button>
          )}
        </div>

        {/* Segmented Hub Navigation */}
        {hubTabs.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl"
            style={{ backgroundColor: "var(--bg-app)" }}
          >
            {hubTabs.map((ht) => {
              const TabIcon = ht.icon;
              const isActive = activeTab === ht.id;
              return (
                <button
                  key={ht.id}
                  type="button"
                  onClick={() => setActiveTab(ht.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap"
                  style={
                    isActive
                      ? {
                          background: "var(--brand-gradient)",
                          color: "#ffffff",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  <TabIcon className="w-4 h-4 shrink-0" />
                  <span>{isAr ? ht.labelAr : ht.labelEn}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ SUB-MODULE VIEWS ═══ */}
      {activeTab === "flight-permits" && canViewPermits && (
        <FlightPermits
          flights={flights}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          setSyncStatus={setSyncStatus}
          onOpenScanner={() => setShowSmartScanner(true)}
        />
      )}

      {activeTab === "library" && canViewPermits && (
        <PermitsLibrary user={user} setSyncStatus={setSyncStatus} />
      )}

      {activeTab === "forms" && canViewForms && (
        <FormsModule
          flights={flights}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          setSyncStatus={setSyncStatus}
          embedded
        />
      )}

      {showSmartScanner && (
        <SmartDocumentScannerModal
          mode="permit"
          flight={flights[0]}
          flights={flights}
          fleet={fleet}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setShowSmartScanner(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * PERMITS LIBRARY
 * ═══════════════════════════════════════════════════════════ */
function PermitsLibrary({ user, setSyncStatus, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [airportHint, setAirportHint] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [mappingPdf, setMappingPdf] = useState(null);
  const [newManualFieldLabel, setNewManualFieldLabel] = useState("");

  // Inline HTML attachment composer / editor state
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [htmlFileName, setHtmlFileName] = useState("permit_template.html");
  const [htmlSource, setHtmlSource] = useState("");

  const canEdit = checkPerm(user, "permits.edit");
  const canCreate = checkPerm(user, "permits.create");
  const canDelete = checkPerm(user, "permits.delete");

  const AVAILABLE_COUNTRIES = useMemo(() => getAvailableCountries(), []);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await permitTemplatesAPI.list().catch(() => []);
      setTemplates(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNew = () => {
    if (!canCreate) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setDraft({
      country: "",
      name: "",
      permitType: "OVERFLIGHT",
      fields: [],
      flightFields: [],
      attachments: [],
      notes: "",
    });
    setAirportHint("");
    setNewManualFieldLabel("");
    setShowHtmlEditor(false);
    setHtmlSource("");
    setHtmlFileName("permit_template.html");
    setEditing("new");
  };

  const openEdit = (tpl) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية", "warning");
    setDraft({ ...tpl });
    setAirportHint("");
    setNewManualFieldLabel("");
    const existingHtml = (tpl.attachments || []).find(
      (a) =>
        a.isHtml ||
        a.type === "text/html" ||
        /\.html?$/i.test(String(a.name || ""))
    );
    if (existingHtml?.htmlContent) {
      setHtmlSource(existingHtml.htmlContent);
      setHtmlFileName(existingHtml.name || "permit_template.html");
    } else {
      setHtmlSource("");
      setHtmlFileName("permit_template.html");
    }
    setShowHtmlEditor(false);
    setEditing(tpl.id);
  };

  const handleAirportHint = (icao) => {
    setAirportHint(icao);
    if (icao.length >= 2) {
      const detected = getCountryFromAirport(icao);
      if (detected && detected !== icao) {
        setDraft((prev) => ({
          ...prev,
          country: detected,
          name:
            prev.name ||
            `${detected} ${prev.permitType || "Permit"} Request`,
        }));
      }
    }
  };

  const mergeDiscoveredFieldsIntoDraft = (existingFields, discoveredFields) => {
    const merged = Array.isArray(existingFields) ? [...existingFields] : [];
    (discoveredFields || []).forEach((df) => {
      const idx = merged.findIndex(
        (ef) =>
          (df.token && ef.token === df.token) ||
          (df.slotId && ef.slotId === df.slotId) ||
          (df.acroName && ef.acroName === df.acroName) ||
          ef.key === df.key
      );
      if (idx >= 0) {
        merged[idx] = {
          ...df,
          ...merged[idx],
          slotId: df.slotId || merged[idx].slotId,
          token: df.token || merged[idx].token,
        };
      } else {
        merged.push(df);
      }
    });
    return merged;
  };

  const applyHtmlTemplateToDraft = async (
    rawHtml,
    fileName = "permit_template.html",
    driveMeta = null
  ) => {
    const trimmed = String(rawHtml || "").trim();
    if (!trimmed) {
      return showToast("⚠️ محتوى ملف HTML فارغ", "warning");
    }
    const { annotatedHtml, fields: recognized } =
      recognizeHtmlTemplateFields(trimmed);
    const safeName = /\.html?$/i.test(fileName) ? fileName : `${fileName}.html`;

    let uploaded = driveMeta;
    if (!uploaded) {
      try {
        const htmlFile = new File([annotatedHtml], safeName, {
          type: "text/html",
        });
        uploaded = await uploadFile(htmlFile, "permits-templates");
      } catch (upErr) {
        console.warn("Permit HTML Drive upload warning:", upErr?.message);
      }
    }

    const htmlAtt = {
      name: safeName,
      fileName: uploaded?.fileName || safeName,
      type: "text/html",
      mime: "text/html",
      isHtml: true,
      htmlContent: annotatedHtml.length <= 32000 ? annotatedHtml : "",
      url:
        uploaded?.fileUrl ||
        `data:text/html;charset=utf-8,${encodeURIComponent(annotatedHtml)}`,
      viewUrl: uploaded?.viewUrl || "",
      fileId: uploaded?.fileId || "",
      path: uploaded?.filePath || "",
      size: uploaded?.size || new Blob([annotatedHtml]).size,
    };

    setDraft((prev) => {
      const otherAtts = (prev.attachments || []).filter(
        (a) =>
          !(
            a.isHtml ||
            a.type === "text/html" ||
            /\.html?$/i.test(String(a.name || ""))
          )
      );
      return {
        ...prev,
        name:
          prev.name ||
          (prev.country
            ? `${prev.country} ${prev.permitType || "Permit"} HTML Form`
            : safeName.replace(/\.[^/.]+$/, "")),
        attachments: [htmlAtt, ...otherAtts],
        fields: mergeDiscoveredFieldsIntoDraft(prev.fields, recognized),
      };
    });

    setHtmlSource(annotatedHtml);
    setHtmlFileName(safeName);
    setShowHtmlEditor(false);
    showToast(
      `✅ تم رفع نموذج HTML في Google Drive والتعرف تلقائياً على ${recognized.length} حقل!`,
      "success"
    );
  };

  const uploadTemplateAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      return showToast("⚠️ الحد الأقصى لحجم الملف 10 MB", "warning");
    }

    const isHtmlFile =
      file.type === "text/html" || /\.html?$/i.test(file.name || "");

    if (isHtmlFile) {
      setUploadingFile(true);
      try {
        const rawText = await file.text();
        await applyHtmlTemplateToDraft(rawText, file.name);
      } catch (err) {
        showToast("❌ تعذر قراءة ملف HTML: " + err.message, "error");
      } finally {
        setUploadingFile(false);
        e.target.value = "";
      }
      return;
    }

    setUploadingFile(true);
    try {
      const result = await uploadFile(file, "permits-templates");
      const newAtt = {
        name: file.name,
        url: result.fileUrl,
        size: result.size || file.size,
        type: file.type || result.mimeType || "application/pdf",
      };

      let autoDetectedFields = Array.isArray(draft.fields)
        ? [...draft.fields]
        : [];
      const isPdf =
        newAtt.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        try {
          const acro = await extractPDFFormFields(newAtt.url);
          if (acro.length > 0) {
            acro.forEach((af) => {
              if (
                !autoDetectedFields.some(
                  (f) => f.key === af.key || f.acroName === af.acroName
                )
              ) {
                autoDetectedFields.push({
                  key: af.key,
                  systemKey: af.autoMatched ? af.key : "",
                  acroName: af.acroName,
                  label: af.label,
                  rawLabel: af.acroName,
                  auto: af.autoMatched,
                  isAcro: true,
                  sourceType: "acroform",
                });
              }
            });
            showToast(
              `✅ تم رفع النموذج واكتشاف ${acro.length} حقل تفاعلي تلقائياً!`,
              "success"
            );
          } else {
            showToast(
              "✅ تم رفع النموذج! اضغط (تحديد الحقول على PDF) للنقر على أماكن التعبئة.",
              "success"
            );
          }
        } catch {
          showToast("✅ تم رفع النموذج بنجاح", "success");
        }
      } else {
        showToast("✅ تم إرفاق الملف بنجاح", "success");
      }

      setDraft((prev) => ({
        ...prev,
        name:
          prev.name ||
          (prev.country
            ? `${prev.country} ${prev.permitType || "Permit"} Form`
            : file.name.replace(/\.[^/.]+$/, "")),
        attachments: [...(prev.attachments || []), newAtt],
        fields: autoDetectedFields,
      }));
    } catch (err) {
      showToast("❌ فشل الرفع: " + err.message, "error");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleReRecognizeFields = async () => {
    const htmlAtt = (draft.attachments || []).find(
      (a) =>
        a.isHtml ||
        a.type === "text/html" ||
        /\.html?$/i.test(String(a.name || ""))
    );
    if (htmlAtt?.htmlContent) {
      const { annotatedHtml, fields: recognized } = recognizeHtmlTemplateFields(
        htmlAtt.htmlContent
      );
      setDraft((prev) => ({
        ...prev,
        attachments: (prev.attachments || []).map((a) =>
          a === htmlAtt
            ? {
                ...a,
                htmlContent: annotatedHtml,
                url: `data:text/html;charset=utf-8,${encodeURIComponent(
                  annotatedHtml
                )}`,
              }
            : a
        ),
        fields: mergeDiscoveredFieldsIntoDraft(prev.fields, recognized),
      }));
      showToast(`✅ تم التعرف على ${recognized.length} حقل في مرفق HTML`, "success");
      return;
    }

    const pdfAtt = (draft.attachments || []).find(
      (a) =>
        a.type === "application/pdf" ||
        String(a.name || "").toLowerCase().endsWith(".pdf")
    );
    if (pdfAtt?.url) {
      try {
        const acro = await extractPDFFormFields(pdfAtt.url);
        if (acro.length > 0) {
          const formatted = acro.map((af) => ({
            key: af.key,
            systemKey: af.autoMatched ? af.key : "",
            acroName: af.acroName,
            label: af.label,
            rawLabel: af.acroName,
            auto: af.autoMatched,
            isAcro: true,
            sourceType: "acroform",
          }));
          setDraft((prev) => ({
            ...prev,
            fields: mergeDiscoveredFieldsIntoDraft(prev.fields, formatted),
          }));
          showToast(
            `✅ تم اكتشاف ${acro.length} حقل AcroForm داخل ملف PDF`,
            "success"
          );
        } else {
          showToast(
            "ملف PDF ثابت — استخدم زر (تحديد مواضع الحقول على PDF) للنقر على مواقع التعبئة",
            "info"
          );
        }
      } catch (err) {
        showToast("⚠️ تعذر فحص حقول PDF: " + err.message, "warning");
      }
    }
  };

  const updateFieldSystemLink = (idx, nextSystemKey) => {
    const cat = SYSTEM_DATA_CATALOG.find((c) => c.key === nextSystemKey);
    setDraft((prev) => {
      const list = Array.isArray(prev.fields) ? [...prev.fields] : [];
      const current = list[idx];
      if (!current) return prev;
      const isCoord = current.x !== undefined && current.y !== undefined;
      const manualFallbackKey =
        current.rawLabel
          ? "manual_" +
            String(current.rawLabel)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "_")
              .slice(0, 24) +
            `_${idx}`
          : `manual_field_${idx}`;

      list[idx] = {
        ...current,
        systemKey: nextSystemKey || "",
        key: nextSystemKey || (isCoord ? current.key : manualFallbackKey),
        label: cat ? cat.label : current.rawLabel || current.label,
        auto: Boolean(nextSystemKey),
      };
      return { ...prev, fields: list };
    });
  };

  const addCustomManualFieldToDraft = () => {
    const label = newManualFieldLabel.trim();
    if (!label) return;
    const key =
      "custom_" +
      label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "") +
      "_" +
      Math.random().toString(36).slice(2, 5);

    setDraft((prev) => ({
      ...prev,
      fields: [
        ...(prev.fields || []),
        {
          key,
          systemKey: "",
          label,
          rawLabel: label,
          auto: false,
          sourceType: "manual",
        },
      ],
    }));
    setNewManualFieldLabel("");
  };

  const previewAttachment = (att, titlePrefix = "") => {
    const isHtml =
      att.isHtml ||
      att.type === "text/html" ||
      /\.html?$/i.test(String(att.name || ""));
    if (isHtml && att.htmlContent) {
      openPreviewModal({
        title: titlePrefix ? `${titlePrefix} — ${att.name}` : att.name,
        html: buildPrintableHtmlDocument(att.htmlContent, att.name),
        fileName: att.name,
      });
      return;
    }
    openPreviewModal({
      title: titlePrefix ? `${titlePrefix} — ${att.name}` : att.name,
      blobUrl: toPreviewFileUrl(att.url, att.name),
      fileName: att.name,
    });
  };

  const save = async () => {
    if (!draft.country || !draft.name) {
      return showToast("⚠️ الدولة واسم النموذج مطلوبان", "warning");
    }
    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await permitTemplatesAPI.create(draft);
        setTemplates([...templates, { ...draft, id: created.id }]);
      } else {
        await permitTemplatesAPI.update(editing, draft);
        setTemplates(
          templates.map((x) =>
            x.id === editing ? { ...draft, id: editing } : x
          )
        );
      }
      setEditing(null);
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ قالب التصريح وربط حقوله في المكتبة", "success");
    } catch (e) {
      showToast("❌ فشل الحفظ: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (!canDelete) return showToast("⚠️ ليس لديك صلاحية", "warning");
    if (!(await confirmAction("حذف هذا القالب من المكتبة؟"))) return;
    try {
      await permitTemplatesAPI.remove(id);
      setTemplates(templates.filter((x) => x.id !== id));
      showToast("✅ تم حذف القالب", "success");
    } catch (e) {
      showToast("❌ فشل الحذف: " + e.message, "error");
    }
  };

  const grouped = useMemo(() => {
    const map = {};
    templates
      .filter(
        (t) =>
          !search ||
          (t.country + t.name + (t.permitType || ""))
            .toLowerCase()
            .includes(search.toLowerCase())
      )
      .forEach((t) => {
        if (!map[t.country]) map[t.country] = [];
        map[t.country].push(t);
      });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [templates, search]);

  return (
    <div className="space-y-4 fade-in">
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
              style={{ color: "var(--text-muted)" }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم الدولة أو النموذج أو نوع التصريح..."
              className="ps-9"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className="text-xs font-mono tabular-nums"
              style={{ color: "var(--text-muted)" }}
            >
              {grouped.length} دولة · {templates.length} نموذج
            </span>
            {canCreate && (
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> إضافة نموذج دولة
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div
          className="text-center py-12"
          style={{ color: "var(--text-muted)" }}
        >
          جاري التحميل...
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 rounded-xl" style={cardStyle}>
          <BookOpen
            className="w-12 h-12 mx-auto mb-2 opacity-30"
            style={{ color: "var(--text-muted)" }}
          />
          <div style={{ color: "var(--text-muted)" }}>
            لا توجد نماذج مضافة بعد — اضغط "إضافة نموذج دولة" لرفع ملف HTML أو PDF والتعرف على حقوله تلقائياً
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grouped.map(([country, list]) => (
            <div
              key={country}
              className="rounded-xl overflow-hidden"
              style={cardStyle}
            >
              <div
                className="p-3 border-b flex items-center gap-2"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                }}
              >
                <Globe
                  className="w-5 h-5"
                  style={{ color: "var(--brand-primary)" }}
                />
                <div>
                  <div
                    className="font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {country}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {list.length} نموذج
                  </div>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {list.map((tpl) => {
                  const htmlAtt = (tpl.attachments || []).find(
                    (a) =>
                      a.isHtml ||
                      a.type === "text/html" ||
                      /\.html?$/i.test(String(a.name || ""))
                  );
                  const pdfAtt = (tpl.attachments || []).find(
                    (a) =>
                      a.type === "application/pdf" ||
                      String(a.name || "").toLowerCase().endsWith(".pdf")
                  );
                  const primaryAtt = htmlAtt || (tpl.attachments || [])[0];
                  const hasMappedFields =
                    Array.isArray(tpl.fields) && tpl.fields.length > 0;
                  return (
                    <div
                      key={tpl.id}
                      className="p-2.5 rounded-lg border text-xs space-y-1.5"
                      style={innerBoxStyle}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className="font-bold"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {tpl.name}
                        </div>
                        <span className="font-mono text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          {tpl.permitType}
                        </span>
                      </div>

                      {htmlAtt ? (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>نموذج HTML ذكي: {htmlAtt.name}</span>
                        </div>
                      ) : primaryAtt ? (
                        <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                          مرفق: {primaryAtt.name}
                        </div>
                      ) : (
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          يستخدم النموذج الرسمي المدمج
                        </div>
                      )}

                      {hasMappedFields && (
                        <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                          {tpl.fields.length} حقل متعرف عليه ومربوط للتعبئة
                        </div>
                      )}

                      <div className="flex gap-1 pt-1">
                        {primaryAtt && (
                          <button
                            onClick={() =>
                              previewAttachment(
                                primaryAtt,
                                `${tpl.country} — ${tpl.name}`
                              )
                            }
                            className="flex-1 py-1 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] font-bold flex items-center justify-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" /> معاينة النموذج
                          </button>
                        )}
                        {pdfAtt && canEdit && (
                          <button
                            onClick={() => {
                              setDraft({ ...tpl });
                              setEditing(tpl.id);
                              setMappingPdf(pdfAtt);
                            }}
                            className="px-2 py-1 rounded bg-purple-500/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                            title="تحديد مواضع الحقول على PDF"
                          >
                            <MousePointer2 className="w-3 h-3" /> الحقول
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => openEdit(tpl)}
                            className="p-1 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            title="تعديل وربط الحقول"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => remove(tpl.id)}
                            className="p-1 rounded bg-rose-500/15 text-rose-500"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Template Modal */}
      <Modal
        open={!!editing}
        title={
          editing === "new"
            ? "إضافة نموذج تصريح لدولة والتعرف على حقوله"
            : "تعديل نموذج التصريح وربط الحقول"
        }
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              إلغاء
            </button>
            <button
              onClick={save}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" /> حفظ النموذج في المكتبة
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 1. Country & Permit Type */}
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30">
            <h4
              className="text-sm font-bold mb-2 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <MapPin
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
              1. تحديد الدولة ونوع التصريح
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="كود مطار ICAO لاكتشاف الدولة (اختياري)">
                <Input
                  value={airportHint}
                  onChange={(e) =>
                    handleAirportHint(e.target.value.toUpperCase())
                  }
                  placeholder="HLLT, HECA, GMMN, LMML..."
                  maxLength={4}
                  className="font-mono"
                />
              </Field>
              <Field label="الدولة / Country *">
                <Select
                  value={draft.country || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      country: e.target.value,
                      name:
                        draft.name ||
                        `${e.target.value} ${
                          draft.permitType || "OVERFLIGHT"
                        } Permit`,
                    })
                  }
                >
                  <option value="">— اختر الدولة —</option>
                  {AVAILABLE_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="نوع التصريح / Permit Type">
                <Select
                  value={draft.permitType || "OVERFLIGHT"}
                  onChange={(e) =>
                    setDraft({ ...draft, permitType: e.target.value })
                  }
                >
                  {PERMIT_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="اسم النموذج / Template Name *">
                <Input
                  value={draft.name || ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="مثال: Libya Landing Permit HTML / نموذج طلب تصريح هبوط"
                />
              </Field>
            </div>
          </div>

          {/* 2. Upload Country Permit Form (HTML / PDF / Image) OR Paste HTML */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Paperclip className="w-4 h-4 text-purple-500" />
                2. إرفاق نموذج الدولة (HTML أو PDF أو صورة) والتعرف عليه
              </h4>
              <button
                type="button"
                onClick={() => setShowHtmlEditor((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Code2 className="w-3.5 h-3.5" />
                {showHtmlEditor
                  ? "إخفاء محرر HTML"
                  : "لصق / تحرير نموذج HTML مباشرة"}
              </button>
            </div>

            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              يدعم النظام رفع ملفات <b>HTML (.html / .htm)</b> و<b>PDF</b> والصور. عند إرفاق ملف HTML يتعرف النظام تلقائياً على المتغيرات <code>{"{{flightNo}}"}</code> وحقول الإدخال <code>{"<input>"}</code> وخانات الجداول الفارغة ويربطها بمعلومات الرحلة للتعبئة التلقائية!
            </p>

            {/* Inline HTML Editor / Paster */}
            {showHtmlEditor && (
              <div
                className="p-3 rounded-xl border space-y-2.5"
                style={innerBoxStyle}
              >
                <div className="grid sm:grid-cols-2 gap-2">
                  <Field label="اسم مرفق HTML">
                    <Input
                      value={htmlFileName}
                      onChange={(e) => setHtmlFileName(e.target.value)}
                      placeholder="country_permit.html"
                      className="font-mono"
                    />
                  </Field>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        applyHtmlTemplateToDraft(htmlSource, htmlFileName)
                      }
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      اعتماد كود HTML والتعرف على حقوله تلقائياً
                    </button>
                  </div>
                </div>

                <div>
                  <div
                    className="text-[11px] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    إدراج سريع لرموز بيانات النظام داخل كود HTML:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_HTML_TOKENS.map((tItem) => (
                      <button
                        key={tItem.key}
                        type="button"
                        onClick={() =>
                          setHtmlSource((prev) => `${prev}{{${tItem.key}}}`)
                        }
                        className="px-2 py-1 rounded border text-[10px] font-mono hover:bg-emerald-500/10 transition"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        + {tItem.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={htmlSource}
                  onChange={(e) => setHtmlSource(e.target.value)}
                  rows={8}
                  dir="ltr"
                  className="w-full p-2.5 rounded-lg text-xs font-mono border outline-none"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--bg-card)",
                  }}
                  placeholder="الصق كود نموذج التصريح بصيغة HTML هنا (يدعم الجداول وحقول input والمتغيرات مثل {{flightNo}} و {{aircraft}})..."
                />
              </div>
            )}

            {/* Attached Files List */}
            {(draft.attachments || []).map((att, i) => {
              const isHtml =
                att.isHtml ||
                att.type === "text/html" ||
                /\.html?$/i.test(String(att.name || ""));
              const isPdf =
                !isHtml &&
                (att.type === "application/pdf" ||
                  String(att.name || "").toLowerCase().endsWith(".pdf"));
              return (
                <div
                  key={`${att.name}-${i}`}
                  className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg text-xs"
                  style={innerBoxStyle}
                >
                  {isHtml ? (
                    <Code2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Paperclip className="w-4 h-4 text-purple-500" />
                  )}
                  <span
                    className="flex-1 font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {att.name}
                  </span>
                  {isHtml && (
                    <button
                      type="button"
                      onClick={() => {
                        setHtmlFileName(att.name || "permit_template.html");
                        setHtmlSource(att.htmlContent || "");
                        setShowHtmlEditor(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      تحرير كود HTML
                    </button>
                  )}
                  {isPdf && (
                    <button
                      type="button"
                      onClick={() => setMappingPdf(att)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <MousePointer2 className="w-3.5 h-3.5" />
                      تحديد مواضع الحقول على PDF (
                      {Array.isArray(draft.fields) ? draft.fields.length : 0})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => previewAttachment(att, draft.country)}
                    className="p-1.5 rounded bg-sky-500/15 text-sky-500"
                    title="معاينة"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        attachments: draft.attachments.filter(
                          (_, idx) => idx !== i
                        ),
                      })
                    }
                    className="p-1.5 rounded bg-rose-500/15 text-rose-500"
                    title="إزالة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <label
              className="flex items-center justify-center gap-2 p-3 rounded-xl cursor-pointer border-2 border-dashed text-xs font-bold transition hover:bg-purple-500/5"
              style={{
                borderColor: "var(--brand-primary)",
                color: "var(--brand-primary)",
              }}
            >
              <Upload className="w-4 h-4" />
              {uploadingFile
                ? "جاري رفع وفحص النموذج والتعرف على حقوله..."
                : "رفع نموذج طلب التصريح كمرفق (HTML / PDF / Image)"}
              <input
                type="file"
                accept=".html,.htm,text/html,application/pdf,image/*"
                disabled={uploadingFile}
                onChange={uploadTemplateAttachment}
                className="hidden"
              />
            </label>
          </div>

          {/* 3. Field Recognition & System Data Linking */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                3. آلية التعرف على حقول النموذج وربطها بمعلومات النظام (
                {Array.isArray(draft.fields) ? draft.fields.length : 0})
              </h4>
              {(draft.attachments || []).length > 0 && (
                <button
                  type="button"
                  onClick={handleReRecognizeFields}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  إعادة التعرف التلقائي على الحقول
                </button>
              )}
            </div>

            {Array.isArray(draft.fields) && draft.fields.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {draft.fields.map((f, idx) => {
                  const currentSysKey =
                    f.systemKey !== undefined
                      ? f.systemKey
                      : SYSTEM_DATA_CATALOG.some((c) => c.key === f.key)
                      ? f.key
                      : "";
                  return (
                    <div
                      key={`${f.key}-${f.slotId || idx}`}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 rounded-lg border text-xs"
                      style={innerBoxStyle}
                    >
                      <div className="md:col-span-5 flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          {f.sourceType === "placeholder"
                            ? "HTML {{}}"
                            : f.sourceType === "table_cell"
                            ? "جدول HTML"
                            : f.sourceType === "input"
                            ? "حقل HTML"
                            : f.isAcro
                            ? "AcroForm"
                            : f.x !== undefined
                            ? "PDF XY"
                            : "يدوي"}
                        </span>
                        <Input
                          value={f.label || f.rawLabel || f.key}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((prev) => ({
                              ...prev,
                              fields: prev.fields.map((it, i) =>
                                i === idx ? { ...it, label: val } : it
                              ),
                            }));
                          }}
                          className="text-xs py-1"
                        />
                      </div>

                      <div className="md:col-span-6">
                        <Select
                          value={currentSysKey}
                          onChange={(e) =>
                            updateFieldSystemLink(idx, e.target.value)
                          }
                          className="text-xs py-1"
                        >
                          <option value="">
                            ✍️ إدخال يدوي عند طلب التصريح (Manual Input)
                          </option>
                          {Object.entries(GROUPED_SYSTEM_CATALOG).map(
                            ([grp, items]) => (
                              <optgroup key={grp} label={`── ${grp} ──`}>
                                {items.map((c) => (
                                  <option key={c.key} value={c.key}>
                                    ⚡ {c.label} ({c.key})
                                  </option>
                                ))}
                              </optgroup>
                            )
                          )}
                        </Select>
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              fields: prev.fields.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25"
                          title="حذف الحقل"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="text-xs p-3 rounded-lg border border-dashed text-center"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                لم يتم إرفاق حقول مخصصة بعد — ارفع ملف HTML أو PDF تفاعلي ليتم استخراج حقوله وربطها تلقائياً، أو أضف حقلاً خاصاً أدناه.
              </div>
            )}

            {/* Add Extra Custom / Manual Field */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newManualFieldLabel}
                onChange={(e) => setNewManualFieldLabel(e.target.value)}
                placeholder="إضافة حقل إضافي خاص بهذه الدولة (مثل: اسم الدبلوماسي / نقطة دخول FIR / مرجع الوكيل)..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomManualFieldToDraft();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomManualFieldToDraft}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold whitespace-nowrap shrink-0"
              >
                + إضافة حقل
              </button>
            </div>
          </div>

          <Field label="ملاحظات وتعليمات الطيران المدني لهذه الدولة">
            <textarea
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-app)",
              }}
              placeholder="مثال: يُرسل قبل 48 ساعة إلى البريد الرسمي لسلطة الطيران المدني..."
            />
          </Field>
        </div>
      </Modal>

      {mappingPdf && (
        <PDFFieldMapper
          pdfUrl={mappingPdf.url}
          initialFields={Array.isArray(draft.fields) ? draft.fields : []}
          onSave={async (fields) => {
            const nextDraft = { ...draft, fields };
            setDraft(nextDraft);
            setMappingPdf(null);
            if (editing && editing !== "new") {
              try {
                await permitTemplatesAPI.update(editing, nextDraft);
                setTemplates((prev) =>
                  prev.map((x) =>
                    x.id === editing ? { ...nextDraft, id: editing } : x
                  )
                );
              } catch {}
            }
            showToast(`✅ تم ربط ${fields.length} حقل على النموذج`, "success");
          }}
          onClose={() => setMappingPdf(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * FLIGHT PERMITS
 * ═══════════════════════════════════════════════════════════ */
function FlightPermits({
  flights,
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user,
  setSyncStatus,
  onBack,
}) {
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [permits, setPermits] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extraCountries, setExtraCountries] = useState([]);
  const [overflightPick, setOverflightPick] = useState("");

  const [activeGenerator, setActiveGenerator] = useState(null);
  const [printPermit, setPrintPermit] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFlightIds, setBulkFlightIds] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);

  const sameCountry = (a, b) =>
    String(a || "").trim().toLowerCase() ===
    String(b || "").trim().toLowerCase();

  // Smartly choose the most appropriate template from Library for a country & flight role
  const pickBestCountryTemplate = (tplList, countryName, isOverflight = false) => {
    const matches = (tplList || []).filter((t) =>
      sameCountry(t.country, countryName)
    );
    if (matches.length === 0) return { best: null, all: [] };
    const preferredType = isOverflight ? "OVERFLIGHT" : "LANDING";
    const byType = matches.find(
      (t) => String(t.permitType || "").toUpperCase() === preferredType
    );
    // Also prefer templates that have an HTML or PDF attachment configured
    const withAtt = matches.find(
      (t) => Array.isArray(t.attachments) && t.attachments.length > 0
    );
    return {
      best: byType || withAtt || matches[0],
      all: matches,
    };
  };

  const handleBulkGenerate = async () => {
    if (bulkFlightIds.length === 0) {
      return showToast("⚠️ اختر رحلة واحدة على الأقل", "warning");
    }
    setLoading(true);
    setSyncStatus?.("syncing");
    try {
      let count = 0;
      for (const fid of bulkFlightIds) {
        const fl = flights.find((x) => String(x.id) === String(fid));
        if (!fl) continue;
        const dest = getCountryFromAirport(fl.arr);
        const { best } = pickBestCountryTemplate(templates, dest, false);
        const tpl = best ||
          templates[0] || {
            country: dest || "International",
            permitType: "LANDING",
            name: "Standard Permit",
          };

        await flightPermitsAPI.create({
          flightId: fl.id,
          country: tpl.country || dest || "International",
          permitType: tpl.permitType || "LANDING",
          permitNo: `BULK-${fl.flightNo}-${Date.now().toString().slice(-4)}`,
          issuedDate: new Date().toISOString().slice(0, 10),
          expiryDate: fl.std ? String(fl.std).slice(0, 10) : "",
          issuedBy: tpl.name || "CAA",
          status: "APPROVED",
          notes: "Bulk generated from library template",
          customFields: buildSystemAutoData({
            flight: fl,
            fleet,
            camoList,
            crew,
            settings,
            user,
          }),
        });
        count++;
      }
      showToast(
        `✅ تم بنجاح توليد ${count} تصريح رحلة جماعياً من قوالب المكتبة!`,
        "success"
      );
      setBulkFlightIds([]);
      setBulkMode(false);
      setSyncStatus?.("synced");
    } catch (e) {
      setSyncStatus?.("error");
      showToast("❌ فشل التوليد الجماعي: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    permitTemplatesAPI
      .list()
      .then((tpls) => setTemplates(tpls))
      .catch(() => setTemplates([]));
  }, []);

  // Load permits when flight changes + auto-recognize & open country form if a matching template exists!
  const handleSelectFlight = async (flightId) => {
    const f = flights.find((x) => String(x.id) === String(flightId)) || null;
    setSelectedFlight(f);
    setExtraCountries([]);
    setOverflightPick("");
    if (!f) {
      setPermits([]);
      return;
    }

    setLoading(true);
    try {
      const [list, loadedTemplates] = await Promise.all([
        flightPermitsAPI.listByFlight(f.id).catch(() => []),
        templates.length > 0
          ? Promise.resolve(templates)
          : permitTemplatesAPI.list().catch(() => []),
      ]);
      setPermits(list);
      if (templates.length === 0 && loadedTemplates.length > 0) {
        setTemplates(loadedTemplates);
      }

      // Detect route countries for this flight (dep + arr + all legs + alternates)
      const codes = [
        f.dep,
        f.arr,
        ...(Array.isArray(f.legs)
          ? f.legs.flatMap((l) => [l?.dep, l?.arr])
          : []),
        f.altn,
        f.altn2,
      ].filter(Boolean);

      const routeCountries = [];
      codes.forEach((code) => {
        const c = getCountryFromAirport(code);
        if (
          c &&
          c !== code &&
          !routeCountries.some((rc) => sameCountry(rc, c))
        ) {
          routeCountries.push(c);
        }
      });

      const destCountry = getCountryFromAirport(f.arr);
      const orderedCountries = destCountry
        ? [
            destCountry,
            ...routeCountries.filter((c) => !sameCountry(c, destCountry)),
          ]
        : routeCountries;

      let opened = false;
      for (const cName of orderedCountries) {
        const { best, all } = pickBestCountryTemplate(
          loadedTemplates,
          cName,
          false
        );
        const alreadySaved = list.find((p) => sameCountry(p.country, cName));
        if (best && !alreadySaved) {
          setActiveGenerator({
            country: best.country || cName,
            template: best,
            availableTemplates: all,
            existingPermit: null,
          });
          opened = true;
          break;
        }
      }

      if (!opened && orderedCountries.length > 0) {
        for (const cName of orderedCountries) {
          const { best, all } = pickBestCountryTemplate(
            loadedTemplates,
            cName,
            false
          );
          if (best) {
            const existingP =
              list.find((p) => sameCountry(p.country, cName)) || null;
            setActiveGenerator({
              country: best.country || cName,
              template: best,
              availableTemplates: all,
              existingPermit: existingP,
            });
            break;
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Detect all countries from route, multi-sector legs, alternates, plus user-added overflight countries
  const detectedCountries = useMemo(() => {
    if (!selectedFlight) return [];
    const entries = [];
    const addAirport = (code, roleLabel) => {
      if (!code) return;
      const country = getCountryFromAirport(code);
      if (!country || country === code) return;
      const existing = entries.find((c) => sameCountry(c.name, country));
      if (existing) {
        if (!existing.airports.includes(code)) existing.airports.push(code);
      } else {
        entries.push({ name: country, airports: [code], roleLabel });
      }
    };

    addAirport(selectedFlight.dep, "Departure");
    addAirport(selectedFlight.arr, "Arrival");
    if (Array.isArray(selectedFlight.legs)) {
      selectedFlight.legs.forEach((leg, i) => {
        addAirport(leg?.dep, `Leg ${i + 2} Dep`);
        addAirport(leg?.arr, `Leg ${i + 2} Arr`);
      });
    }
    addAirport(selectedFlight.altn, "Alternate");
    addAirport(selectedFlight.altn2, "Alternate 2");

    extraCountries.forEach((cName) => {
      if (!entries.find((e) => sameCountry(e.name, cName))) {
        entries.push({
          name: cName,
          airports: ["OVERFLIGHT"],
          roleLabel: "Overflight",
        });
      }
    });

    return entries;
  }, [selectedFlight, extraCountries]);

  const libraryCountries = useMemo(() => {
    const set = new Set(templates.map((t) => t.country).filter(Boolean));
    return Array.from(set).sort();
  }, [templates]);

  const handleSaveGeneratedOrEditedPermit = async (data) => {
    setSyncStatus?.("syncing");
    try {
      const payload = {
        flightId: selectedFlight.id,
        country: data.country,
        permitType: data.permitType,
        permitNo: data.permitNo || "PENDING",
        issuedDate: data.issuedDate,
        expiryDate: data.expiryDate,
        issuedBy: data.issuedBy,
        customFields: data.customFields,
        attachments: [],
        status: data.status || "PENDING",
        notes: data.notes,
        updatedBy: user?.fullName || "",
      };

      if (data.id) {
        await flightPermitsAPI.update(data.id, payload);
      } else {
        await flightPermitsAPI.create(payload);
      }

      const list = await flightPermitsAPI.listByFlight(selectedFlight.id);
      setPermits(list);
      setActiveGenerator(null);
      setSyncStatus?.("synced");
    } catch (e) {
      setSyncStatus?.("error");
      showToast("❌ فشل حفظ التصريح: " + e.message, "error");
      throw e;
    }
  };

  const handleUpdateTemplateFromGenerator = async (updatedTpl) => {
    try {
      await permitTemplatesAPI.update(updatedTpl.id, updatedTpl);
      setTemplates((prev) =>
        prev.map((t) => (t.id === updatedTpl.id ? updatedTpl : t))
      );
    } catch (e) {
      showToast("⚠️ تعذر حفظ ربط الحقول في المكتبة: " + e.message, "warning");
    }
  };

  const handleDeletePermit = async (id) => {
    if (!(await confirmAction("حذف هذا التصريح؟"))) return;
    try {
      await flightPermitsAPI.remove(id);
      setPermits((prev) => prev.filter((p) => p.id !== id));
      showToast("✅ تم حذف التصريح", "success");
    } catch (e) {
      showToast("❌ فشل الحذف: " + e.message, "error");
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Flight Selector + Bulk Controls */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronRight
                  className="w-5 h-5 rotate-180"
                  style={{ color: "var(--text-muted)" }}
                />
              </button>
            )}
            <div>
              <h2
                className="text-sm sm:text-base font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                تصاريح الرحلة واكتشاف دول المسار تلقائياً
              </h2>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                اختر الرحلة ليتعرف النظام تلقائياً على نماذج الدول (HTML / PDF) ويفتحها معبأة ببيانات الرحلة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBulkMode(!bulkMode)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              {bulkMode ? "إلغاء التوليد الجماعي" : "توليد تصاريح جماعية (Bulk)"}
            </button>
          </div>
        </div>

        {bulkMode ? (
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">
            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              تحديد رحلات متعددة لتوليد التصاريح جماعياً من قوالب المكتبة:
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white dark:bg-slate-800 rounded-lg border">
              {flights.map((f) => {
                const checked = bulkFlightIds.includes(f.id);
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkFlightIds([...bulkFlightIds, f.id]);
                        } else {
                          setBulkFlightIds(
                            bulkFlightIds.filter((id) => id !== f.id)
                          );
                        }
                      }}
                      className="rounded"
                    />
                    <span className="font-bold font-mono">{f.flightNo}</span>
                    <span>
                      ({f.dep} → {f.arr})
                    </span>
                    <span className="text-[10px] text-slate-400 ms-auto font-mono">
                      {f.acft || "—"}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-600">
                تم اختيار {bulkFlightIds.length} رحلة
              </span>
              <button
                type="button"
                onClick={handleBulkGenerate}
                disabled={loading || bulkFlightIds.length === 0}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 shadow-sm"
              >
                {loading
                  ? "جاري التوليد..."
                  : "توليد التصاريح للرحلات المحددة جماعياً"}
              </button>
            </div>
          </div>
        ) : (
          <Field label="اختر الرحلة / Select Flight">
            <Select
              value={selectedFlight?.id || ""}
              onChange={(e) => handleSelectFlight(e.target.value)}
            >
              <option value="">— اختر الرحلة —</option>
              {flights.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flightNo} — {f.dep} → {f.arr}
                  {Array.isArray(f.legs) && f.legs.length > 0
                    ? ` (+${f.legs.length} قطاعات)`
                    : ""}{" "}
                  · {f.acft || "بدون طائرة"} (
                  {f.std ? String(f.std).slice(0, 10) : "—"})
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {selectedFlight && (
        <>
          {/* Selected Flight Summary */}
          <div className="rounded-xl p-3.5" style={cardStyle}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  رقم الرحلة / Flight
                </div>
                <div
                  className="font-bold font-mono tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedFlight.flightNo}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  المسار / Route
                </div>
                <div
                  className="font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedFlight.dep} → {selectedFlight.arr}
                  {Array.isArray(selectedFlight.legs) &&
                    selectedFlight.legs.map((l, i) => (
                      <span key={i}> → {l.arr}</span>
                    ))}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  التاريخ / Date
                </div>
                <div
                  className="font-bold font-mono tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {fmtDate(selectedFlight.std)}
                </div>
              </div>
              <div>
                <div
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  الطائرة / Aircraft
                </div>
                <div
                  className="font-bold font-mono"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedFlight.acft || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Detected Route Countries + Add Overflight Country */}
          <div className="rounded-xl p-4 space-y-3" style={cardStyle}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <MapPin
                  className="w-4 h-4"
                  style={{ color: "var(--brand-primary)" }}
                />
                الدول المرتبطة بالرحلة ونماذجها المتعرف عليها للتعبئة التلقائية
              </h3>

              {/* Add Overflight Country from Library */}
              {libraryCountries.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Select
                    value={overflightPick}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOverflightPick("");
                      if (!val) return;
                      if (!extraCountries.some((ec) => sameCountry(ec, val))) {
                        setExtraCountries([...extraCountries, val]);
                      }
                      const { best, all } = pickBestCountryTemplate(
                        templates,
                        val,
                        true
                      );
                      if (best) {
                        setActiveGenerator({
                          country: val,
                          template: best,
                          availableTemplates: all,
                          existingPermit: null,
                        });
                      }
                    }}
                    className="text-xs w-auto"
                  >
                    <option value="">
                      + إضافة دولة عبور (Overflight) من المكتبة...
                    </option>
                    {libraryCountries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {detectedCountries.map(({ name: country, airports }) => {
                const isOverflight = airports.includes("OVERFLIGHT");
                const savedPermitsForCountry = permits.filter((p) =>
                  sameCountry(p.country, country)
                );
                const { all: tpls } = pickBestCountryTemplate(
                  templates,
                  country,
                  isOverflight
                );

                return (
                  <div
                    key={country}
                    className="p-3.5 rounded-xl border space-y-2.5"
                    style={innerBoxStyle}
                  >
                    <div className="flex items-center gap-2">
                      <Globe
                        className="w-5 h-5"
                        style={{ color: "var(--brand-primary)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className="font-bold text-sm truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {country}
                        </div>
                        <div
                          className="text-[10px] font-mono"
                          style={{ color: "var(--text-muted)" }}
                        >
                          عبر: {airports.join(", ")}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          savedPermitsForCountry.length > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {savedPermitsForCountry.length > 0
                          ? `محفوظ (${savedPermitsForCountry.length})`
                          : "يحتاج تصريح"}
                      </span>
                    </div>

                    {tpls.length > 0 ? (
                      <div className="space-y-1.5">
                        {tpls.map((tpl) => {
                          const hasHtml = (tpl.attachments || []).some(
                            (a) =>
                              a.isHtml ||
                              a.type === "text/html" ||
                              /\.html?$/i.test(String(a.name || ""))
                          );
                          return (
                            <button
                              key={tpl.id}
                              onClick={() =>
                                setActiveGenerator({
                                  country,
                                  template: tpl,
                                  availableTemplates: tpls,
                                  existingPermit: null,
                                })
                              }
                              className="w-full text-start px-3 py-2 rounded-lg text-xs font-bold text-white flex items-center justify-between transition hover:opacity-90 shadow-sm"
                              style={{ background: "var(--brand-gradient)" }}
                            >
                              <span className="truncate">
                                {hasHtml ? "HTML" : "نموذج"}: {tpl.name} (
                                {tpl.permitType})
                              </span>
                              <ChevronRight className="w-4 h-4 flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          لا يوجد نموذج مرفق لـ {country} في المكتبة بعد — يمكنك فتح النموذج الرسمي المدمج معبأً تلقائياً:
                        </div>
                        <button
                          onClick={() =>
                            setActiveGenerator({
                              country,
                              template: {
                                id: `default_${country}`,
                                country,
                                name: `${country} Official Permit Request`,
                                permitType: isOverflight
                                  ? "OVERFLIGHT"
                                  : "LANDING",
                                fields: [],
                                attachments: [],
                              },
                              availableTemplates: [],
                              existingPermit: null,
                            })
                          }
                          className="w-full text-start px-3 py-2 rounded-lg text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 flex items-center justify-between"
                        >
                          <span>فتح النموذج الرسمي المعبأ تلقائياً</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Saved / Generated Permits for this Flight */}
          {loading ? (
            <div
              className="text-center py-8"
              style={{ color: "var(--text-muted)" }}
            >
              جاري تحميل تصاريح الرحلة...
            </div>
          ) : permits.length > 0 ? (
            <div className="space-y-2.5">
              <h3
                className="text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                التصاريح المحفوظة لهذه الرحلة ({permits.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {permits.map((p) => {
                  const statusColor =
                    STATUS_COLORS[p.status] || STATUS_COLORS.DRAFT;
                  const countryTpls = templates.filter((t) =>
                    sameCountry(t.country, p.country)
                  );
                  const matchingTpl =
                    countryTpls.find((t) => t.permitType === p.permitType) ||
                    countryTpls[0] || {
                      id: `saved_${p.country}`,
                      country: p.country,
                      name: `${p.country} ${p.permitType || "Permit"}`,
                      permitType: p.permitType || "OVERFLIGHT",
                      fields: [],
                      attachments: [],
                    };

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl border"
                      style={cardStyle}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Globe
                              className="w-4 h-4"
                              style={{ color: "var(--brand-primary)" }}
                            />
                            <span
                              className="font-bold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {p.country}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}`}
                            >
                              {p.status}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              · {p.permitType}
                            </span>
                          </div>
                          <div
                            className="text-xs mt-1 font-mono tabular-nums"
                            style={{ color: "var(--text-muted)" }}
                          >
                            رقم التصريح: <b>{p.permitNo || "PENDING"}</b> ·{" "}
                            {p.issuedBy || "—"}
                          </div>
                        </div>
                        <div
                          className="text-xs font-mono tabular-nums"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {p.expiryDate ? fmtDate(p.expiryDate) : ""}
                        </div>
                      </div>

                      <div
                        className="flex gap-2 mt-3 pt-2.5 border-t"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <button
                          onClick={() =>
                            setActiveGenerator({
                              country: p.country,
                              template: matchingTpl,
                              availableTemplates: countryTpls,
                              existingPermit: p,
                            })
                          }
                          className="flex-1 py-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" /> فتح وتعديل النموذج
                        </button>
                        <button
                          onClick={() => setPrintPermit(p)}
                          className="flex-1 py-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center justify-center gap-1"
                        >
                          <FileSignature className="w-3.5 h-3.5" /> طباعة سريعة
                        </button>
                        <button
                          onClick={() => handleDeletePermit(p.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-500 text-xs"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Auto-Filled Country Form Modal */}
      {activeGenerator && selectedFlight && (
        <PermitGenerateModal
          template={activeGenerator.template}
          availableTemplates={activeGenerator.availableTemplates || []}
          flight={selectedFlight}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          existingPermit={activeGenerator.existingPermit}
          onUpdateTemplate={handleUpdateTemplateFromGenerator}
          onClose={() => setActiveGenerator(null)}
          onSave={handleSaveGeneratedOrEditedPermit}
        />
      )}

      {printPermit && (
        <PermitPrintModal
          permit={printPermit}
          flight={selectedFlight}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setPrintPermit(null)}
        />
      )}

      {scannerOpen && (
        <SmartDocumentScannerModal
          mode="permit"
          flight={selectedFlight || flights[0]}
          flights={flights}
          fleet={fleet}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setScannerOpen(false)}
          onTemplateSaved={() => {
            permitTemplatesAPI.list().then((t) => setTemplates(t)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

export default PermitsModule;
