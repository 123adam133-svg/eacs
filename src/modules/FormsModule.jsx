/* ═══════════════════════════════════════════════════════════
 * FORMS MODULE — النماذج التشغيلية المربوطة بمعلومات النظام
 * Located under More -> Forms (النماذج):
 * - Insert existing company forms (Upload .html/.htm or .pdf, or Paste/Edit HTML)
 * - Auto-recognize placeholders, <input>/<select>, table cells, & AcroForm fields
 * - Link each recognized field to AeroOps System Data (Flight, Legs, JL, Aircraft, Crew, Operator)
 * - Toggle visibility in ScheduleBoard's FlightContextMenu so clicking the form name
 *   on any flight opens it auto-populated with that flight's data
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  FileText,
  Code2,
  Upload,
  Eye,
  Link2,
  RefreshCw,
  MousePointer2,
  Plane,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { uploadFile } from "../api";
import { can as checkPerm } from "../config/permissions";
import {
  SYSTEM_DATA_CATALOG,
  recognizeHtmlTemplateFields,
  buildPrintableHtmlDocument,
  matchLabelOrTokenToSystemKey,
} from "../utils/htmlTemplateEngine";
import { extractPDFFormFields } from "../utils/pdfFiller";
import {
  listOperationalFormsSync,
  fetchOperationalForms,
  saveOperationalForm,
  deleteOperationalForm,
} from "../utils/operationalFormsService";
import { PDFFieldMapper } from "../components/PDFFieldMapper";
import { SmartDocumentScannerModal } from "../components/SmartDocumentScannerModal";
import { showToast, confirmAction, openPreviewModal } from "../utils/dialog";

const FORM_CATEGORIES = [
  "Ground Ops",
  "Dispatch",
  "Handling",
  "Crew & GenDec",
  "Load & Fuel",
  "Safety & Security",
  "General",
];

const QUICK_INSERT_TOKENS = [
  { key: "flightNo", label: "رقم الرحلة {{flightNo}}" },
  { key: "date", label: "التاريخ {{date}}" },
  { key: "aircraft", label: "تسجيل الطائرة {{aircraft}}" },
  { key: "aircraftType", label: "طراز الطائرة {{aircraftType}}" },
  { key: "departure", label: "مطار المغادرة {{departure}}" },
  { key: "arrival", label: "مطار الوصول {{arrival}}" },
  { key: "std", label: "وقت الإقلاع {{std}}" },
  { key: "sta", label: "وقت الوصول {{sta}}" },
  { key: "route", label: "المسار والقطاعات {{route}}" },
  { key: "actualStd", label: "Block Off {{actualStd}}" },
  { key: "actualSta", label: "Block On {{actualSta}}" },
  { key: "blockTime", label: "زمن البلوك {{blockTime}}" },
  { key: "blockFuel", label: "وقود الإقلاع {{blockFuel}}" },
  { key: "picName", label: "قائد الطائرة {{picName}}" },
  { key: "foName", label: "المساعد الأول {{foName}}" },
  { key: "pax", label: "الركاب {{pax}}" },
  { key: "cargo", label: "الشحن {{cargo}}" },
  { key: "handlingAgent", label: "وكيل المناولة {{handlingAgent}}" },
  { key: "sectorsTableHtml", label: "جدول القطاعات {{sectorsTableHtml}}" },
  { key: "crewTableHtml", label: "جدول الطاقم {{crewTableHtml}}" },
  { key: "operatorName", label: "اسم المشغل {{operatorName}}" },
];

const GROUPED_SYSTEM_CATALOG = SYSTEM_DATA_CATALOG.reduce((acc, item) => {
  const grp = item.group || "Other";
  if (!acc[grp]) acc[grp] = [];
  acc[grp].push(item);
  return acc;
}, {});

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

const innerStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

export function FormsModule({
  flights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user,
  setSyncStatus,
  embedded = false,
}) {
  const [forms, setForms] = useState(() => listOperationalFormsSync());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [mappingPdf, setMappingPdf] = useState(null);
  const [newManualLabel, setNewManualLabel] = useState("");
  const [showAiScanner, setShowAiScanner] = useState(false);

  const canCreate = checkPerm(user, "forms.create");
  const canEdit = checkPerm(user, "forms.edit");
  const canDelete = checkPerm(user, "forms.delete");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchOperationalForms()
      .then((list) => {
        if (mounted) setForms(list);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const handleSync = () => setForms(listOperationalFormsSync());
    window.addEventListener("aeroops:forms-updated", handleSync);
    return () => {
      mounted = false;
      window.removeEventListener("aeroops:forms-updated", handleSync);
    };
  }, []);

  const filteredForms = useMemo(() => {
    return forms.filter(
      (f) =>
        !search ||
        `${f.name || ""} ${f.category || ""} ${f.notes || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
    );
  }, [forms, search]);

  const openNewForm = () => {
    if (!canCreate) return showToast("⚠️ ليس لديك صلاحية إنشاء النماذج", "warning");
    setDraft({
      name: "",
      category: "Ground Ops",
      format: "html",
      htmlContent: "",
      fields: [],
      attachments: [],
      showInContextMenu: true,
      notes: "",
    });
    setNewManualLabel("");
    setEditing("new");
  };

  const openEditForm = (form) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تعديل النماذج", "warning");
    setDraft({
      ...form,
      fields: Array.isArray(form.fields) ? [...form.fields] : [],
      attachments: Array.isArray(form.attachments) ? [...form.attachments] : [],
    });
    setNewManualLabel("");
    setEditing(form.id);
  };

  const mergeDiscoveredFields = (existingFields, discovered) => {
    const merged = Array.isArray(existingFields) ? [...existingFields] : [];
    (discovered || []).forEach((df) => {
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

  const handleRecognizeHtmlDraft = (customHtml) => {
    const raw = customHtml !== undefined ? customHtml : draft.htmlContent;
    if (!String(raw || "").trim()) {
      return showToast("⚠️ الصق أو ارفع كود HTML أولاً للتعرف على حقوله", "warning");
    }
    const { annotatedHtml, fields: recognized } =
      recognizeHtmlTemplateFields(raw);
    setDraft((prev) => ({
      ...prev,
      format: "html",
      htmlContent: annotatedHtml,
      fields: mergeDiscoveredFields(prev.fields, recognized),
    }));
    showToast(
      `✅ تم التعرف على ${recognized.length} حقل وربط المتطابق منها بمعلومات النظام تلقائياً`,
      "success"
    );
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      return showToast("⚠️ الحد الأقصى لحجم الملف 10 MB", "warning");
    }

    const isHtml =
      file.type === "text/html" || /\.html?$/i.test(file.name || "");

    if (isHtml) {
      setUploadingFile(true);
      try {
        const text = await file.text();
        const { annotatedHtml, fields: recognized } =
          recognizeHtmlTemplateFields(text);
        const annotatedFile = new File([annotatedHtml], file.name, {
          type: "text/html",
        });
        let driveMeta = null;
        try {
          driveMeta = await uploadFile(annotatedFile, "operational-forms");
        } catch (upErr) {
          console.warn("HTML Drive upload fallback warning:", upErr?.message);
        }
        setDraft((prev) => ({
          ...prev,
          name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
          format: "html",
          htmlContent: annotatedHtml,
          attachments: [
            {
              name: file.name,
              fileName: driveMeta?.fileName || file.name,
              type: "text/html",
              mime: "text/html",
              isHtml: true,
              htmlContent: annotatedHtml.length <= 32000 ? annotatedHtml : "",
              url:
                driveMeta?.fileUrl ||
                `data:text/html;charset=utf-8,${encodeURIComponent(
                  annotatedHtml
                )}`,
              viewUrl: driveMeta?.viewUrl || "",
              fileId: driveMeta?.fileId || "",
              path: driveMeta?.filePath || "",
              size: driveMeta?.size || file.size,
            },
          ],
          fields: mergeDiscoveredFields(prev.fields, recognized),
        }));
        showToast(
          `✅ تم رفع ملف HTML في Google Drive واكتشاف ${recognized.length} حقل تلقائياً`,
          "success"
        );
      } catch (err) {
        showToast("❌ تعذر قراءة ملف HTML: " + err.message, "error");
      } finally {
        setUploadingFile(false);
        e.target.value = "";
      }
      return;
    }

    // PDF Upload
    setUploadingFile(true);
    try {
      const result = await uploadFile(file, "operational-forms");
      const newAtt = {
        name: file.name,
        url: result.fileUrl,
        size: result.size || file.size,
        type: file.type || result.mimeType || "application/pdf",
      };

      let discovered = [];
      try {
        const acro = await extractPDFFormFields(newAtt.url);
        discovered = acro.map((af) => ({
          key: af.key,
          systemKey: af.autoMatched ? af.key : "",
          acroName: af.acroName,
          label: af.label,
          rawLabel: af.acroName,
          auto: af.autoMatched,
          isAcro: true,
          sourceType: "acroform",
        }));
      } catch {}

      setDraft((prev) => ({
        ...prev,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
        format: "pdf",
        attachments: [newAtt],
        fields: mergeDiscoveredFields(prev.fields, discovered),
      }));

      if (discovered.length > 0) {
        showToast(
          `✅ تم رفع نموذج PDF واكتشاف ${discovered.length} حقل تفاعلي تلقائياً`,
          "success"
        );
      } else {
        showToast(
          "✅ تم رفع ملف PDF — اضغط (تحديد مواضع الحقول على PDF) لربط مواقع الكتابة بالنظام",
          "success"
        );
      }
    } catch (err) {
      showToast("❌ فشل رفع الملف: " + err.message, "error");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const [fieldSearchQuery, setFieldSearchQuery] = useState("");
  const [fieldFilterType, setFieldFilterType] = useState("all");
  const [selectedPresetToAdd, setSelectedPresetToAdd] = useState("");

  const moveFieldOrder = (idx, direction) => {
    setDraft((prev) => {
      const list = Array.isArray(prev.fields) ? [...prev.fields] : [];
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      return { ...prev, fields: list };
    });
  };

  const addSystemPresetField = (sysKey) => {
    if (!sysKey) return;
    const cat = SYSTEM_DATA_CATALOG.find((c) => c.key === sysKey);
    if (!cat) return;

    const instanceId = `inst_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
    const uniqueKey = `${sysKey}_${instanceId}`;

    setDraft((prev) => {
      const currentFields = Array.isArray(prev.fields) ? prev.fields : [];
      const sameCount = currentFields.filter(
        (f) => f.systemKey === sysKey || f.key === sysKey
      ).length;
      const label = sameCount > 0 ? `${cat.label} (موقع ${sameCount + 1})` : cat.label;

      return {
        ...prev,
        fields: [
          ...currentFields,
          {
            key: uniqueKey,
            systemKey: sysKey,
            label,
            rawLabel: cat.label,
            auto: true,
            sourceType: "system_preset",
          },
        ],
      };
    });
    setSelectedPresetToAdd("");
    showToast(`✅ تم إضافة حقل مربوط بـ (${cat.label})`, "success");
  };

  const autoMatchAllFields = () => {
    let matchedCount = 0;
    const currentFields = Array.isArray(draft.fields) ? [...draft.fields] : [];

    const next = currentFields.map((f) => {
      if (f.systemKey) return f;
      const matched = matchLabelOrTokenToSystemKey(f.label || f.rawLabel || f.token || f.key);
      if (matched) {
        matchedCount++;
        const cat = SYSTEM_DATA_CATALOG.find((c) => c.key === matched);
        return {
          ...f,
          systemKey: matched,
          label: cat ? cat.label : f.label,
          auto: true,
        };
      }
      return f;
    });

    setDraft((prev) => ({ ...prev, fields: next }));

    if (matchedCount > 0) {
      showToast(`⚡ تم ربط ${matchedCount} حقل ببيانات النظام تلقائياً!`, "success");
    } else {
      showToast("ℹ️ كافة الحقول الحالية مربوطة بالفعل أو لم تُعثر على مطابقة اسم مباشرة", "info");
    }
  };

  const updateFieldLink = (idx, nextSystemKey) => {
    const cat = SYSTEM_DATA_CATALOG.find((c) => c.key === nextSystemKey);
    setDraft((prev) => {
      const list = Array.isArray(prev.fields) ? [...prev.fields] : [];
      const cur = list[idx];
      if (!cur) return prev;
      const isCoord = cur.x !== undefined && cur.y !== undefined;
      const fallbackManualKey = cur.rawLabel
        ? "manual_" +
          String(cur.rawLabel)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "_")
            .slice(0, 24) +
          `_${idx}`
        : `manual_${idx}`;

      list[idx] = {
        ...cur,
        systemKey: nextSystemKey || "",
        key: nextSystemKey || (isCoord ? cur.key : fallbackManualKey),
        label: cat ? cat.label : cur.rawLabel || cur.label,
        auto: Boolean(nextSystemKey),
      };
      return { ...prev, fields: list };
    });
  };

  const addExtraField = () => {
    const lbl = newManualLabel.trim();
    if (!lbl) return;
    const key =
      "custom_" +
      lbl
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 20) +
      "_" +
      Math.random().toString(36).slice(2, 5);
    setDraft((prev) => ({
      ...prev,
      fields: [
        ...(prev.fields || []),
        {
          key,
          systemKey: "",
          label: lbl,
          rawLabel: lbl,
          auto: false,
          sourceType: "manual",
        },
      ],
    }));
    setNewManualLabel("");
  };

  const handleSave = async () => {
    if (!String(draft.name || "").trim()) {
      return showToast("⚠️ أدخل اسم النموذج أولاً (سيظهر بهذا الاسم في قائمة الرحلة)", "warning");
    }
    if (
      draft.format === "html" &&
      !String(draft.htmlContent || "").trim()
    ) {
      return showToast("⚠️ أدرج كود أو ملف HTML للنموذج أولاً", "warning");
    }
    if (
      draft.format === "pdf" &&
      (!Array.isArray(draft.attachments) || draft.attachments.length === 0)
    ) {
      return showToast("⚠️ ارفع ملف PDF للنموذج أولاً", "warning");
    }

    setSyncStatus?.("syncing");
    try {
      // Ensure HTML fields are recognized if user typed HTML without clicking recognize
      let finalDraft = { ...draft };
      if (finalDraft.format === "html" && finalDraft.htmlContent) {
        const { annotatedHtml, fields: recognized } =
          recognizeHtmlTemplateFields(finalDraft.htmlContent);
        finalDraft.htmlContent = annotatedHtml;
        finalDraft.fields = mergeDiscoveredFields(
          finalDraft.fields,
          recognized
        );

        const hasDriveHtml =
          Array.isArray(finalDraft.attachments) &&
          finalDraft.attachments.some(
            (a) => a.url && !String(a.url).startsWith("data:")
          );
        if (!hasDriveHtml) {
          try {
            const safeFileName = `${
              String(finalDraft.name || "operational_form")
                .replace(/[^a-zA-Z0-9_-]/g, "_")
                .slice(0, 40) || "operational_form"
            }.html`;
            const htmlFile = new File([annotatedHtml], safeFileName, {
              type: "text/html",
            });
            const uploaded = await uploadFile(htmlFile, "operational-forms");
            finalDraft.attachments = [
              {
                name: safeFileName,
                fileName: uploaded.fileName || safeFileName,
                type: "text/html",
                mime: "text/html",
                isHtml: true,
                htmlContent: annotatedHtml.length <= 32000 ? annotatedHtml : "",
                url: uploaded.fileUrl,
                viewUrl: uploaded.viewUrl || "",
                fileId: uploaded.fileId || "",
                path: uploaded.filePath || "",
                size: uploaded.size || htmlFile.size,
              },
            ];
          } catch (upErr) {
            console.warn("Operational form HTML Drive upload warning:", upErr?.message);
          }
        }
      }

      await saveOperationalForm(finalDraft);
      setForms(listOperationalFormsSync());
      setEditing(null);
      setSyncStatus?.("synced");
      showToast(
        `✅ تم حفظ النموذج "${finalDraft.name}" ${
          finalDraft.showInContextMenu !== false
            ? "وإظهاره في القائمة المنبثقة للرحلات"
            : ""
        }`,
        "success"
      );
    } catch (err) {
      setSyncStatus?.("error");
      showToast("❌ تعذر حفظ النموذج: " + err.message, "error");
    }
  };

  const handleToggleContextMenu = async (form) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية التعديل", "warning");
    const updated = await saveOperationalForm({
      ...form,
      showInContextMenu: form.showInContextMenu === false,
    });
    setForms(listOperationalFormsSync());
    showToast(
      updated.showInContextMenu
        ? `✅ يظهر "${updated.name}" الآن في القائمة المنبثقة للرحلة`
        : `تم إخفاء "${updated.name}" من القائمة المنبثقة للرحلة`,
      "info"
    );
  };

  const handleRemove = async (form) => {
    if (!canDelete) return showToast("⚠️ ليس لديك صلاحية الحذف", "warning");
    if (!(await confirmAction(`حذف النموذج "${form.name}" نهائياً؟`))) return;
    await deleteOperationalForm(form.id);
    setForms(listOperationalFormsSync());
    showToast("✅ تم حذف النموذج", "success");
  };

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ TOP WORKSPACE HEADER / TOOLBAR ═══ */}
      <div className="rounded-xl p-4" style={cardStyle}>
        {!embedded ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1
                    className="text-lg md:text-xl font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    النماذج التشغيلية (Operational Forms)
                  </h1>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    أدرج النماذج المعمول بها (HTML أو PDF)، اربط حقولها بمعلومات النظام، وسيظهر اسم كل نموذج مباشرة في القائمة المنبثقة للرحلة لتعبئته تلقائياً
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowAiScanner(true)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0 transition hover:opacity-95"
                  style={{ background: "linear-gradient(135deg, #059669, #0284c7)" }}
                  title="إيداع صورة أو ملف PDF أو HTML والتعرف التلقائي على الحقول وتعبئتها من الرحلة"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  التعرف الذكي على النماذج (AI OCR)
                </button>
                {canCreate && (
                  <button
                    onClick={openNewForm}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    <Plus className="w-4 h-4" />
                    إدراج نموذج جديد
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم النموذج أو التصنيف..."
                className="ps-9"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في النماذج التشغيلية باسم النموذج أو التصنيف..."
                className="ps-9"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setShowAiScanner(true)}
                className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 transition hover:opacity-95"
                style={{ background: "linear-gradient(135deg, #059669, #0284c7)" }}
                title="إيداع صورة أو ملف PDF أو HTML والتعرف التلقائي على الحقول وتعبئتها من الرحلة"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                التعرف الذكي (AI OCR)
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="px-4 py-2 rounded-lg text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-4 h-4" />
                  إدراج نموذج جديد
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ FORMS GRID ═══ */}
      {loading && forms.length === 0 ? (
        <div
          className="text-center py-12 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          جاري تحميل النماذج...
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="rounded-xl p-12 text-center space-y-3" style={cardStyle}>
          <FileText
            className="w-12 h-12 mx-auto opacity-30"
            style={{ color: "var(--text-muted)" }}
          />
          <div
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            لا توجد نماذج تشغيلية مطابقة
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            اضغط على "إدراج نموذج جديد" لرفع نموذج HTML أو PDF معمول به في شركتك وربطه ببيانات الرحلات.
          </p>
          {canCreate && (
            <button
              onClick={openNewForm}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Plus className="w-4 h-4" /> إدراج أول نموذج
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredForms.map((form) => {
            const isPdf = form.format === "pdf";
            const autoCount = (form.fields || []).filter(
              (f) =>
                f.auto !== false &&
                SYSTEM_DATA_CATALOG.some(
                  (c) => c.key === (f.systemKey || f.key)
                )
            ).length;
            const totalFields = (form.fields || []).length;

            return (
              <div
                key={form.id}
                className="rounded-xl p-4 flex flex-col justify-between gap-3"
                style={cardStyle}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3
                        className="font-bold text-base truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {form.name}
                      </h3>
                      <div
                        className="text-xs flex items-center gap-1.5 mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                          {isPdf ? "PDF" : "HTML"}
                        </span>
                        <span>·</span>
                        <span>{form.category || "Operations"}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {autoCount}/{totalFields} حقل مربوط
                        </span>
                      </div>
                    </div>
                  </div>

                  {form.notes && (
                    <p
                      className="text-xs line-clamp-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {form.notes}
                    </p>
                  )}

                  {/* Context menu visibility switch */}
                  <div
                    className="p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs"
                    style={innerStyle}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          form.showInContextMenu !== false
                            ? "text-emerald-500"
                            : "text-slate-400"
                        }`}
                      />
                      <span
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        يظهر في القائمة المنبثقة للرحلة
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.showInContextMenu !== false}
                      onChange={() => handleToggleContextMenu(form)}
                      disabled={!canEdit}
                      className="w-4 h-4 cursor-pointer accent-emerald-600"
                    />
                  </div>
                </div>

                <div
                  className="pt-2.5 border-t flex items-center gap-1.5"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openEditForm(form)}
                      className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition hover:opacity-90 whitespace-nowrap shadow-xs"
                      style={{ background: "var(--brand-gradient)" }}
                      title="تعديل وربط الحقول"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      تعديل وربط الحقول
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (isPdf && form.attachments?.[0]?.url) {
                        openPreviewModal({
                          title: form.name,
                          blobUrl: form.attachments[0].url,
                          fileName: form.attachments[0].name,
                        });
                      } else if (form.htmlContent) {
                        openPreviewModal({
                          title: form.name,
                          html: buildPrintableHtmlDocument(
                            form.htmlContent,
                            form.name
                          ),
                        });
                      }
                    }}
                    className="p-2 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 transition"
                    title="معاينة القالب الخام"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleRemove(form)}
                      className="p-2 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ADD / EDIT OPERATIONAL FORM MODAL ═══ */}
      <Modal
        open={!!editing}
        title={
          editing === "new"
            ? "إدراج نموذج تشغيلي جديد وربطه بمعلومات النظام"
            : `تعديل النموذج: ${draft.name || ""}`
        }
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              type="button"
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
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" />
              حفظ النموذج واعتماد الربط
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 1. Identity & Context Menu Toggle */}
          <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="اسم النموذج (يظهر في القائمة المنبثقة للرحلة) *">
                <Input
                  value={draft.name || ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="مثال: طلب مناولة أرضية / Load Sheet / تصريح أمني..."
                />
              </Field>
              <Field label="التصنيف / Category">
                <Select
                  value={draft.category || "Ground Ops"}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  {FORM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="صيغة النموذج المعمول به">
                <Select
                  value={draft.format || "html"}
                  onChange={(e) =>
                    setDraft({ ...draft, format: e.target.value })
                  }
                >
                  <option value="html">HTML (ملف ويب / جدول قابل للتعبئة)</option>
                  <option value="pdf">PDF (نموذج رسمي مرفق)</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-xs font-bold cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={draft.showInContextMenu !== false}
                onChange={(e) =>
                  setDraft({ ...draft, showInContextMenu: e.target.checked })
                }
                className="w-4 h-4 accent-emerald-600"
              />
              <span style={{ color: "var(--text-primary)" }}>
                إظهار اسم هذا النموذج في القائمة المنبثقة للرحلة (Right-Click على الرحلة في جدول الرحلات)
              </span>
            </label>
          </div>

          {/* 2. Insert Template File / HTML Source */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <Code2 className="w-4 h-4 text-purple-500" />
                2. إدراج النموذج المعمول به (رفع ملف HTML أو PDF أو لصق الكود)
              </h4>

              <label className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                {uploadingFile
                  ? "جاري الرفع والفحص..."
                  : "رفع ملف نموذج (.html / .pdf)"}
                <input
                  type="file"
                  accept=".html,.htm,text/html,application/pdf"
                  disabled={uploadingFile}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {draft.format === "pdf" ? (
              <div className="space-y-2">
                {(draft.attachments || []).length > 0 ? (
                  draft.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs"
                      style={innerStyle}
                    >
                      <span
                        className="font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {att.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMappingPdf(att)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5"
                        >
                          <MousePointer2 className="w-3.5 h-3.5" />
                          تحديد مواضع الحقول على PDF (
                          {Array.isArray(draft.fields)
                            ? draft.fields.length
                            : 0}
                          )
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openPreviewModal({
                              title: att.name,
                              blobUrl: att.url,
                              fileName: att.name,
                            })
                          }
                          className="p-1.5 rounded bg-sky-500/15 text-sky-500"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="p-6 rounded-xl border-2 border-dashed text-center text-xs"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--text-muted)",
                    }}
                  >
                    اضغط زر "رفع ملف نموذج (.html / .pdf)" أعلاه لإدراج ملف PDF المعمول به
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <div
                    className="text-[11px] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    إدراج متغيرات النظام بنقرة واحدة داخل كود HTML:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_INSERT_TOKENS.map((tok) => (
                      <button
                        key={tok.key}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            htmlContent: `${prev.htmlContent || ""}{{${
                              tok.key
                            }}}`,
                          }))
                        }
                        className="px-2 py-1 rounded border text-[10px] font-mono hover:bg-purple-500/10 transition"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                          backgroundColor: "var(--bg-card)",
                        }}
                      >
                        + {tok.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={draft.htmlContent || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, htmlContent: e.target.value })
                  }
                  rows={9}
                  dir="ltr"
                  className="w-full p-3 rounded-lg text-xs font-mono border outline-none"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--bg-card)",
                  }}
                  placeholder="الصق كود HTML للنموذج المعمول به هنا أو ارفع ملف .html من جهازك... سيتعرف النظام على {{المتغيرات}} وحقول <input> وخلايا الجداول تلقائياً!"
                />

                <div className="flex justify-end gap-2">
                  {draft.htmlContent && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          title: draft.name || "معاينة HTML",
                          html: buildPrintableHtmlDocument(
                            draft.htmlContent,
                            draft.name || "Preview"
                          ),
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      معاينة شكل الصفحة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRecognizeHtmlDraft()}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    التعرف التلقائي على حقول HTML وربطها بالنظام
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Link Fields to System Data & Position Control */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4
                  className="text-sm font-bold flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  3. ربط حقول النموذج وترتيبها والتحكم بمكانها (
                  {Array.isArray(draft.fields) ? draft.fields.length : 0})
                </h4>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  يمكنك إعادة ترتيب الحقول بالأرقام والأسهم (▲/▼)، وتحديد الحقول المربوطة تلقائياً أو تكرار ربط أكثر من حقل بنفس المعلومة
                </p>
              </div>

              <button
                type="button"
                onClick={autoMatchAllFields}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                ⚡ ربط ذكي تلقائي لكل الحقول
              </button>
            </div>

            {/* Quick System Preset Adder — Allows adding MULTIPLE fields bound to the same system information */}
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 space-y-1.5">
              <span
                className="text-xs font-bold block"
                style={{ color: "var(--text-primary)" }}
              >
                ⚡ إضافة حقل مربوط بمعلومات النظام (ربط مكرر لنفس المعلومة أو موضع جديد):
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={selectedPresetToAdd}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPresetToAdd(val);
                    if (val) addSystemPresetField(val);
                  }}
                  className="text-xs py-1.5 flex-1"
                >
                  <option value="">
                    -- اختر معلومة النظام المُراد إضافتها/تكرارها (مثال: رقم الرحلة، التاريخ، قائد الطائرة...) --
                  </option>
                  {Object.entries(GROUPED_SYSTEM_CATALOG).map(([grp, items]) => (
                    <optgroup key={grp} label={`── ${grp} ──`}>
                      {items.map((c) => (
                        <option key={c.key} value={c.key}>
                          ⚡ {c.label} ({c.key})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
            </div>

            {/* Filter & Search Fields inside the form editor */}
            {Array.isArray(draft.fields) && draft.fields.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-500/20">
                <div className="relative flex-1 min-w-[180px]">
                  <Search
                    className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <Input
                    value={fieldSearchQuery}
                    onChange={(e) => setFieldSearchQuery(e.target.value)}
                    placeholder="تصفية حقول النموذج بالحرف..."
                    className="ps-8 py-1 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFieldFilterType("all")}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      fieldFilterType === "all"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    الكل ({draft.fields.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType("auto")}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      fieldFilterType === "auto"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    ⚡ مربوطة بالنظام (
                    {
                      draft.fields.filter(
                        (f) =>
                          f.auto !== false &&
                          SYSTEM_DATA_CATALOG.some(
                            (c) => c.key === (f.systemKey || f.key)
                          )
                      ).length
                    }
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => setFieldFilterType("manual")}
                    className={`px-2.5 py-1 rounded-md font-bold transition ${
                      fieldFilterType === "manual"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    ✍️ يدوية (
                    {
                      draft.fields.filter(
                        (f) =>
                          f.auto === false ||
                          !SYSTEM_DATA_CATALOG.some(
                            (c) => c.key === (f.systemKey || f.key)
                          )
                      ).length
                    }
                    )
                  </button>
                </div>
              </div>
            )}

            {/* List of Fields with Up/Down Reorder, Label Edit, System Link, Delete */}
            {Array.isArray(draft.fields) && draft.fields.length > 0 ? (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {draft.fields.map((f, idx) => {
                  const candidateSysKey =
                    f.systemKey !== undefined ? f.systemKey : f.key;
                  const currentSysKey =
                    f.auto !== false &&
                    SYSTEM_DATA_CATALOG.some((c) => c.key === candidateSysKey)
                      ? candidateSysKey
                      : "";

                  const matchesSearch =
                    !fieldSearchQuery ||
                    `${f.label || ""} ${f.rawLabel || ""} ${f.key || ""} ${
                      currentSysKey || ""
                    }`
                      .toLowerCase()
                      .includes(fieldSearchQuery.toLowerCase());

                  const isAuto = Boolean(currentSysKey);
                  const matchesFilter =
                    fieldFilterType === "all" ||
                    (fieldFilterType === "auto" && isAuto) ||
                    (fieldFilterType === "manual" && !isAuto);

                  if (!matchesSearch || !matchesFilter) return null;

                  return (
                    <div
                      key={`${f.key}-${f.slotId || idx}`}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 rounded-lg border text-xs"
                      style={innerStyle}
                    >
                      {/* Index & Reorder Controls */}
                      <div className="md:col-span-2 flex items-center gap-1">
                        <span className="font-mono font-bold text-[10px] w-5 text-center text-slate-500 shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveFieldOrder(idx, -1)}
                            disabled={idx === 0}
                            className="px-1 text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white rounded disabled:opacity-30"
                            title="تحريك لأعلى"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFieldOrder(idx, 1)}
                            disabled={idx === draft.fields.length - 1}
                            className="px-1 text-[10px] bg-slate-200 dark:bg-slate-700 hover:bg-emerald-500 hover:text-white rounded disabled:opacity-30"
                            title="تحريك لأسفل"
                          >
                            ▼
                          </button>
                        </div>
                        <span className="font-mono text-[9px] text-slate-400 truncate max-w-[70px]">
                          {f.token || f.sourceType || "حقل"}
                        </span>
                      </div>

                      {/* Field Label Input */}
                      <div className="md:col-span-4">
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

                      {/* System Link Select */}
                      <div className="md:col-span-5">
                        <Select
                          value={currentSysKey}
                          onChange={(e) => updateFieldLink(idx, e.target.value)}
                          className={`text-xs py-1 ${
                            currentSysKey
                              ? "border-emerald-500/60 font-semibold"
                              : ""
                          }`}
                        >
                          <option value="">
                            ✍️ يُترك للإدخال اليدوي عند فتح النموذج
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

                      {/* Remove Button */}
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              fields: prev.fields.filter((_, i) => i !== idx),
                            }))
                          }
                          className="p-1.5 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                          title="حذف هذا الحقل"
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
                className="p-3 rounded-lg border border-dashed text-center text-xs"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                اضغط "التعرف التلقائي على حقول HTML" أو ارفع ملف نموذج ليظهر جدول ربط الحقول بمعلومات النظام هنا.
              </div>
            )}

            {/* Manual Custom Field Adder */}
            <div className="flex gap-2 pt-1">
              <Input
                value={newManualLabel}
                onChange={(e) => setNewManualLabel(e.target.value)}
                placeholder="إضافة حقل إضافي يدوي في هذا النموذج..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addExtraField();
                  }
                }}
              />
              <button
                type="button"
                onClick={addExtraField}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold whitespace-nowrap shrink-0"
              >
                + إضافة حقل يدوي
              </button>
            </div>
          </div>

          <Field label="وصف مختصر / ملاحظات الاستخدام (اختياري)">
            <Input
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="مثال: يُستخدم لطلب خدمات المناولة والوقود من الوكيل الأرضي..."
            />
          </Field>
        </div>
      </Modal>

      {/* PDF Visual Field Mapper */}
      {mappingPdf && (
        <PDFFieldMapper
          pdfUrl={mappingPdf.url}
          initialFields={Array.isArray(draft.fields) ? draft.fields : []}
          onSave={(fields) => {
            setDraft((prev) => ({ ...prev, fields }));
            setMappingPdf(null);
            showToast(`✅ تم ربط ${fields.length} حقل على ملف PDF`, "success");
          }}
          onClose={() => setMappingPdf(null)}
        />
      )}

      {/* Smart Document AI Scanner Modal */}
      {showAiScanner && (
        <SmartDocumentScannerModal
          mode="form"
          flights={flights}
          fleet={fleet}
          crew={crew}
          settings={settings}
          user={user}
          onTemplateSaved={() => {
            setForms(listOperationalFormsSync());
            fetchOperationalForms().then(setForms);
          }}
          onClose={() => setShowAiScanner(false)}
        />
      )}
    </div>
  );
}

export default FormsModule;
