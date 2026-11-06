/* ═══════════════════════════════════════════════════════════
 * PERMIT GENERATE MODAL — v5.0
 * Live Split-Screen Country Permit Form (HTML + PDF + Official):
 * - Auto-fills from Flight + Multi-Sector Legs + Fleet/CAMO + Crew + Operator Settings
 * - Auto-recognizes HTML attachment placeholders/inputs/cells & renders live auto-filled HTML
 * - Supports AcroForm & Coordinate-mapped PDF live preview
 * - Highlights Missing / Manual Fields for immediate user input
 * - Supports Print, Download (HTML/PDF), and Direct Email via Sender Accounts
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  X,
  Save,
  Plane,
  FileText,
  Download,
  Eye,
  Loader2,
  Printer,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MousePointer2,
  Sparkles,
  Mail,
  Send,
  Code2,
  Stamp,
  FileX,
  Lock,
} from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import {
  fillPermitPDF,
  downloadPDF,
  openPDF,
  extractPDFFormFields,
} from "../utils/pdfFiller";
import {
  SYSTEM_DATA_CATALOG,
  buildSystemAutoData,
  recognizeHtmlTemplateFields,
  fillHtmlTemplate,
  buildPrintableHtmlDocument,
} from "../utils/htmlTemplateEngine";
import { listEmailAccounts, getDefaultEmailAccount } from "../utils/emailAccounts";
import { sendEmail, toPreviewFileUrl, toDisplayImageUrl } from "../api";
import { PDFFieldMapper } from "./PDFFieldMapper";
import { PermitHTMLPreview } from "./PermitHTMLPreview";
import { showToast, printHTMLContent, openPreviewModal } from "../utils/dialog";

const CORE_REQUEST_FIELDS = [
  { key: "flightNo", label: "رقم الرحلة / Call Sign" },
  { key: "date", label: "تاريخ الرحلة / Date of Flight" },
  { key: "aircraft", label: "تسجيل الطائرة / Aircraft Reg" },
  { key: "aircraftType", label: "طراز الطائرة / Aircraft Type" },
  { key: "route", label: "خط السير والقطاعات / Route & Sectors" },
  { key: "std", label: "وقت الإقلاع / STD (UTC)" },
  { key: "sta", label: "وقت الوصول / STA (UTC)" },
  { key: "purpose", label: "الغرض من الرحلة / Purpose of Flight" },
  { key: "coaExpiry", label: "انتهاء شهادة الصلاحية / C of A Expiry" },
  { key: "insuranceExpiry", label: "انتهاء التأمين / Insurance Expiry" },
  { key: "picName", label: "اسم الكابتن / Captain (PIC)" },
  { key: "pax", label: "عدد الركاب / PAX" },
  { key: "handlingAgent", label: "وكيل المناولة / Handling Agent" },
  { key: "entryPoint", label: "نقطة الدخول الجوي / FIR Entry Point" },
  { key: "exitPoint", label: "نقطة الخروج الجوي / FIR Exit Point" },
];

export function PermitGenerateModal({
  template: initialTemplate,
  availableTemplates = [],
  flight,
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user,
  existingPermit = null,
  onUpdateTemplate,
  onClose,
  onSave,
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const effectiveStampUrl = "";

  // 1. Build rich auto-filled values from Flight + Legs + Fleet/CAMO + Crew + Settings
  const initialAutoData = useMemo(
    () =>
      buildSystemAutoData({
        flight,
        fleet,
        camoList,
        crew,
        settings,
        user,
      }),
    [flight, fleet, camoList, crew, settings, user]
  );

  // Merge auto-filled values with any existing saved permit customFields
  const [formData, setFormData] = useState(() => ({
    ...initialAutoData,
    permitNo: existingPermit?.permitNo || "",
    issuedDate:
      existingPermit?.issuedDate || new Date().toISOString().slice(0, 10),
    expiryDate:
      existingPermit?.expiryDate ||
      (flight?.std ? String(flight.std).slice(0, 10) : ""),
    issuedBy:
      existingPermit?.issuedBy ||
      initialTemplate?.name ||
      `${initialTemplate?.country || ""} CAA`,
    status: existingPermit?.status || "PENDING",
    notes: existingPermit?.notes || "",
    ...(existingPermit?.customFields || {}),
  }));

  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [filledPdfUrl, setFilledPdfUrl] = useState("");
  const [filledPdfBytes, setFilledPdfBytes] = useState(null);
  const [pdfError, setPdfError] = useState("");
  const [acroFields, setAcroFields] = useState([]);
  const [showMapper, setShowMapper] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);

  // HTML attachment state
  const [loadedHtmlRaw, setLoadedHtmlRaw] = useState("");
  const [loadingHtml, setLoadingHtml] = useState(false);

  // Direct Email panel state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState(() => listEmailAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => getDefaultEmailAccount(settings?.email)?.id || ""
  );
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendingPermitEmail, setSendingPermitEmail] = useState(false);

  useEffect(() => {
    const syncAccounts = () => setEmailAccounts(listEmailAccounts());
    window.addEventListener("aeroops:email-accounts-updated", syncAccounts);
    return () =>
      window.removeEventListener("aeroops:email-accounts-updated", syncAccounts);
  }, []);

  // Detect attached HTML, PDF, or Image in template
  const htmlAttachment = useMemo(
    () =>
      (template?.attachments || []).find(
        (a) =>
          a.isHtml ||
          a.type === "text/html" ||
          a.mime === "text/html" ||
          /\.html?$/i.test(String(a.name || ""))
      ),
    [template]
  );

  const pdfAttachment = useMemo(
    () =>
      !htmlAttachment
        ? (template?.attachments || []).find(
            (a) =>
              a.type === "application/pdf" ||
              a.mime === "application/pdf" ||
              String(a.name || "").toLowerCase().endsWith(".pdf")
          )
        : null,
    [template, htmlAttachment]
  );

  const imageAttachment = useMemo(
    () =>
      !htmlAttachment && !pdfAttachment
        ? (template?.attachments || []).find(
            (a) =>
              String(a.type || a.mime || "").startsWith("image/") ||
              /\.(png|jpg|jpeg|webp)$/i.test(String(a.name || ""))
          )
        : null,
    [template, htmlAttachment, pdfAttachment]
  );

  // Load HTML attachment content (from inline htmlContent, data: URI, or remote URL)
  useEffect(() => {
    if (!htmlAttachment) {
      setLoadedHtmlRaw("");
      return;
    }
    if (htmlAttachment.htmlContent) {
      setLoadedHtmlRaw(htmlAttachment.htmlContent);
      return;
    }
    const url = String(htmlAttachment.url || "");
    if (url.startsWith("data:text/html")) {
      try {
        const commaIdx = url.indexOf(",");
        const payload = commaIdx >= 0 ? url.slice(commaIdx + 1) : "";
        const isBase64 = url.slice(0, commaIdx).includes(";base64");
        const decoded = isBase64
          ? new TextDecoder().decode(
              Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
            )
          : decodeURIComponent(payload);
        setLoadedHtmlRaw(decoded);
        return;
      } catch (e) {
        console.warn("HTML data URL decode warning:", e);
      }
    }
    if (url && url !== "[Data URL - Local Only]") {
      let cancelled = false;
      setLoadingHtml(true);
      fetch(toPreviewFileUrl(url, htmlAttachment.name))
        .then((r) => r.text())
        .then((txt) => {
          if (!cancelled) setLoadedHtmlRaw(txt);
        })
        .catch((err) => {
          console.warn("HTML fetch warning:", err);
        })
        .finally(() => {
          if (!cancelled) setLoadingHtml(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [htmlAttachment]);

  // Auto-recognize HTML fields & merge with saved template field mappings
  const recognizedHtmlBundle = useMemo(() => {
    if (!loadedHtmlRaw) return { annotatedHtml: "", fields: [] };
    const { annotatedHtml, fields: autoFields } =
      recognizeHtmlTemplateFields(loadedHtmlRaw);
    const savedFields = Array.isArray(template?.fields) ? template.fields : [];

    // Merge saved mappings (user-configured systemKey/label) over auto-recognized slots/tokens
    const mergedFields = autoFields.map((af) => {
      const saved = savedFields.find(
        (sf) =>
          (af.token && sf.token === af.token) ||
          (af.slotId && sf.slotId === af.slotId) ||
          sf.key === af.key
      );
      if (saved) {
        return {
          ...af,
          ...saved,
          slotId: af.slotId || saved.slotId,
          token: af.token || saved.token,
        };
      }
      return af;
    });

    // Include any extra saved manual/system fields not in autoFields
    savedFields.forEach((sf) => {
      if (
        !mergedFields.some(
          (mf) =>
            mf.key === sf.key ||
            (sf.token && mf.token === sf.token) ||
            (sf.slotId && mf.slotId === sf.slotId)
        )
      ) {
        mergedFields.push(sf);
      }
    });

    return { annotatedHtml, fields: mergedFields };
  }, [loadedHtmlRaw, template?.fields]);

  // Live filled HTML document (with yellow tags for empty fields in preview, clean for print/export)
  const filledHtmlPreviewDoc = useMemo(() => {
    if (!recognizedHtmlBundle.annotatedHtml) return "";
    const filled = fillHtmlTemplate(
      recognizedHtmlBundle.annotatedHtml,
      recognizedHtmlBundle.fields,
      formData,
      { highlightEmpty: true }
    );
    return buildPrintableHtmlDocument(
      filled,
      `${template?.country || ""} — ${template?.name || "Permit"}`,
      { stampUrl: effectiveStampUrl }
    );
  }, [
    recognizedHtmlBundle,
    formData,
    template?.country,
    template?.name,
    effectiveStampUrl,
  ]);

  const getCleanFilledHtmlDoc = useCallback(() => {
    if (!recognizedHtmlBundle.annotatedHtml) return "";
    const filled = fillHtmlTemplate(
      recognizedHtmlBundle.annotatedHtml,
      recognizedHtmlBundle.fields,
      formData,
      { highlightEmpty: false }
    );
    return buildPrintableHtmlDocument(
      filled,
      `${template?.country || ""} — ${template?.name || "Permit"} (${
        formData.flightNo || ""
      })`,
      { stampUrl: effectiveStampUrl }
    );
  }, [
    recognizedHtmlBundle,
    formData,
    template?.country,
    template?.name,
    effectiveStampUrl,
  ]);

  // Auto-detect AcroForm fields if PDF is attached
  useEffect(() => {
    if (!pdfAttachment?.url) {
      setAcroFields([]);
      return;
    }
    let cancelled = false;
    extractPDFFormFields(pdfAttachment.url)
      .then((detected) => {
        if (!cancelled && detected.length > 0) {
          setAcroFields(detected);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfAttachment?.url]);

  // Unified list of fields relevant to this template
  const allTemplateFields = useMemo(() => {
    const map = new Map();

    const activeFields = htmlAttachment
      ? recognizedHtmlBundle.fields
      : template?.fields || [];

    // First: fields explicitly mapped or recognized on the template
    activeFields.forEach((f) => {
      const effectiveKey = f?.systemKey || f?.key;
      if (!effectiveKey) return;
      if (f?.systemKey === "crewTableHtml" || f?.systemKey === "sectorsTableHtml") {
        return; // Tables are auto-rendered in HTML
      }
      const cat = SYSTEM_DATA_CATALOG.find((c) => c.key === effectiveKey);
      if (!map.has(effectiveKey)) {
        map.set(effectiveKey, {
          key: effectiveKey,
          label: f.label || cat?.label || effectiveKey,
          initiallyAuto:
            f.auto !== false && Boolean(initialAutoData[effectiveKey]),
        });
      }
    });

    // Second: AcroForm fields detected inside the PDF
    acroFields.forEach((af) => {
      if (!map.has(af.key)) {
        map.set(af.key, {
          key: af.key,
          label: af.label || af.acroName,
          initiallyAuto: Boolean(initialAutoData[af.key]),
        });
      }
    });

    // Third: Core aviation permit request fields (always available if not HTML-only custom, or if missing)
    if (!htmlAttachment || map.size === 0) {
      CORE_REQUEST_FIELDS.forEach((cf) => {
        if (!map.has(cf.key)) {
          map.set(cf.key, {
            key: cf.key,
            label: cf.label,
            initiallyAuto: Boolean(initialAutoData[cf.key]),
          });
        }
      });
    }

    return Array.from(map.values());
  }, [
    htmlAttachment,
    recognizedHtmlBundle.fields,
    template?.fields,
    acroFields,
    initialAutoData,
  ]);

  // Partition into Missing/Manual fields (needs user attention) vs Auto-filled fields
  const { missingOrManualFields, autoPopulatedFields } = useMemo(() => {
    const missing = [];
    const populated = [];

    allTemplateFields.forEach((f) => {
      if (
        [
          "permitNo",
          "issuedDate",
          "expiryDate",
          "issuedBy",
          "status",
          "notes",
        ].includes(f.key)
      ) {
        return;
      }
      if (!f.initiallyAuto) {
        missing.push(f);
      } else {
        populated.push(f);
      }
    });

    return { missingOrManualFields: missing, autoPopulatedFields: populated };
  }, [allTemplateFields]);

  const uncompletedCount = useMemo(
    () =>
      missingOrManualFields.filter(
        (f) => !String(formData[f.key] ?? "").trim()
      ).length,
    [missingOrManualFields, formData]
  );

  const hasMappingOrAcro =
    (Array.isArray(template?.fields) &&
      template.fields.some((f) => f.x !== undefined || f.isAcro)) ||
    acroFields.length > 0;

  // Generate filled PDF preview
  const refreshPdfPreview = useCallback(async () => {
    if (!pdfAttachment?.url) return;
    setGeneratingPdf(true);
    setPdfError("");
    try {
      const bytes = await fillPermitPDF(
        pdfAttachment.url,
        template?.fields || [],
        formData,
        acroFields,
        { stampUrl: effectiveStampUrl }
      );
      setFilledPdfBytes(bytes);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const nextUrl = URL.createObjectURL(blob);
      setFilledPdfUrl((prev) => {
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000);
        return nextUrl;
      });
    } catch (err) {
      console.error("Live PDF fill error:", err);
      setPdfError(err.message || "تعذر توليد معاينة PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }, [
    pdfAttachment?.url,
    template?.fields,
    formData,
    acroFields,
    effectiveStampUrl,
  ]);

  useEffect(() => {
    if (!pdfAttachment?.url) return;
    const timer = setTimeout(() => {
      refreshPdfPreview();
    }, 450);
    return () => clearTimeout(timer);
  }, [pdfAttachment?.url, refreshPdfPreview]);

  useEffect(() => {
    return () => {
      if (filledPdfUrl) URL.revokeObjectURL(filledPdfUrl);
    };
  }, [filledPdfUrl]);

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleDownloadFilledPdf = async () => {
    try {
      setGeneratingPdf(true);
      const bytes =
        filledPdfBytes ||
        (await fillPermitPDF(
          pdfAttachment.url,
          template?.fields || [],
          formData,
          acroFields,
          { stampUrl: "" }
        ));
      const fileName = `Permit_${template?.country || "CAA"}_${
        formData.flightNo || "Flight"
      }_${formData.date || "request"}.pdf`;
      downloadPDF(bytes, fileName);
      showToast("✅ تم تحميل نموذج التصريح المعبأ بنجاح", "success");
    } catch (err) {
      showToast("❌ فشل تحميل PDF: " + err.message, "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleOpenFullPdf = async () => {
    try {
      const bytes =
        filledPdfBytes ||
        (await fillPermitPDF(
          pdfAttachment.url,
          template?.fields || [],
          formData,
          acroFields,
          { stampUrl: "" }
        ));
      openPDF(
        bytes,
        `${template?.country || ""} — ${template?.name || "Permit"} (${
          formData.flightNo || ""
        })`
      );
    } catch (err) {
      showToast("❌ فشل فتح PDF: " + err.message, "error");
    }
  };

  const handlePrintHtmlAttachment = () => {
    const cleanDoc = getCleanFilledHtmlDoc();
    if (!cleanDoc) return;
    printHTMLContent(
      cleanDoc,
      `Permit_${template?.country || "CAA"}_${formData.flightNo || "Flight"}`
    );
  };

  const handleDownloadHtmlAttachment = () => {
    const cleanDoc = getCleanFilledHtmlDoc();
    if (!cleanDoc) return;
    const blob = new Blob([cleanDoc], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Permit_${template?.country || "CAA"}_${
      formData.flightNo || "Flight"
    }_${formData.date || "request"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("✅ تم تحميل نموذج HTML المعبأ بنجاح", "success");
  };

  const handleSendPermitEmail = async () => {
    const toList = recipientEmail
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
    if (toList.length === 0) {
      return showToast("⚠️ أدخل البريد الإلكتروني للجهة المستلمة أولاً", "warning");
    }

    setSendingPermitEmail(true);
    try {
      const subject = `${template?.permitType || "FLIGHT"} PERMIT REQUEST — ${
        formData.flightNo || ""
      } (${formData.departure || ""} -> ${formData.arrival || ""}) — ${
        formData.date || ""
      }`;
      const htmlBody = htmlAttachment
        ? getCleanFilledHtmlDoc()
        : `<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;color:#0f172a;">
            <h3>${subject}</h3>
            <p>Dear ${template?.country || "Civil Aviation"} Authority,</p>
            <p>Please find our ${template?.permitType || "Flight"} Permit Request details below:</p>
            <table style="border-collapse:collapse;width:100%;max-width:640px;font-size:13px;">
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Operator</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${formData.operatorName || ""} (${formData.operatorCode || ""})</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Flight Call Sign</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-family:monospace;">${formData.flightNo || ""}</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Date of Flight</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-family:monospace;">${formData.date || ""}</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Aircraft Reg / Type</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-family:monospace;">${formData.aircraft || ""} (${formData.aircraftType || ""})</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Route & Sectors</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-family:monospace;">${formData.route || ""}</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Schedule (UTC)</td><td style="border:1px solid #cbd5e1;padding:6px 10px;font-family:monospace;">STD ${formData.std || ""} / STA ${formData.sta || ""}</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Captain (PIC)</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${formData.picName || ""}</td></tr>
              <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;font-weight:bold;">Purpose</td><td style="border:1px solid #cbd5e1;padding:6px 10px;">${formData.purpose || ""}</td></tr>
            </table>
          </div>`;

      const attachments = [];
      if (pdfAttachment?.url) {
        const bytes =
          filledPdfBytes ||
          (await fillPermitPDF(
            pdfAttachment.url,
            template?.fields || [],
            formData,
            acroFields,
            { stampUrl: effectiveStampUrl }
          ));
        let binary = "";
        const u8 = new Uint8Array(bytes);
        for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
        const b64 = btoa(binary);
        attachments.push({
          filename: `Permit_${template?.country || "CAA"}_${formData.flightNo || "Flight"}.pdf`,
          content: b64,
          contentBase64: b64,
          encoding: "base64",
          contentType: "application/pdf",
        });
      }

      await sendEmail({
        to: toList.join(", "),
        subject,
        body: `${subject}\nAircraft: ${formData.aircraft || ""}\nRoute: ${formData.route || ""}`,
        html: htmlBody,
        accountId: selectedAccountId || undefined,
        attachments,
      });

      showToast(`✅ تم إرسال طلب التصريح إلى ${toList.join(", ")}`, "success");
      setShowEmailPanel(false);
    } catch (err) {
      showToast("❌ فشل إرسال البريد: " + err.message, "error");
    } finally {
      setSendingPermitEmail(false);
    }
  };

  const handleSaveMappedFields = async (mappedFields) => {
    const updatedTpl = { ...template, fields: mappedFields };
    setTemplate(updatedTpl);
    setShowMapper(false);
    if (onUpdateTemplate) {
      await onUpdateTemplate(updatedTpl);
    }
    showToast(
      `✅ تم حفظ ربط ${mappedFields.length} حقل وتعبئة النموذج تلقائياً!`,
      "success"
    );
  };

  const handleSavePermit = async () => {
    setSaving(true);
    try {
      await onSave({
        id: existingPermit?.id,
        templateId: template?.id || "",
        permitType: template?.permitType || "OVERFLIGHT",
        country: template?.country || "",
        permitNo: formData.permitNo || "PENDING",
        issuedDate: formData.issuedDate || "",
        expiryDate: formData.expiryDate || "",
        issuedBy: formData.issuedBy || "",
        status: formData.status || "PENDING",
        notes: formData.notes || "",
        customFields: { ...formData },
      });
      showToast("✅ تم حفظ تصريح الرحلة بنجاح", "success");
    } finally {
      setSaving(false);
    }
  };

  // Merge edited formData into synthetic flight/settings for fallback PermitHTMLPreview
  const enrichedFlightForHtml = useMemo(
    () => ({
      ...flight,
      flightNo: formData.flightNo || flight?.flightNo,
      acft: formData.aircraft || flight?.acft,
      acftType: formData.aircraftType,
      dep: formData.departure || flight?.dep,
      arr: formData.arrival || flight?.arr,
      route: formData.route || flight?.route,
      notes: formData.purpose || flight?.notes,
    }),
    [flight, formData]
  );

  const enrichedSettingsForHtml = useMemo(
    () => ({
      ...settings,
      stamp: effectiveStampUrl,
      companyName: formData.operatorName || settings?.companyName,
      companyNameAr: formData.operatorNameAr || settings?.companyNameAr,
      operatorCode: formData.operatorCode || settings?.operatorCode,
      aircraftType: formData.aircraftType || settings?.aircraftType,
      coaExpiry: formData.coaExpiry || settings?.coaExpiry,
      address: formData.address || settings?.address,
      phone: formData.phone || settings?.phone,
      fax: formData.fax || settings?.fax,
      email: formData.email || settings?.email,
      sita: formData.sita || settings?.sita,
      seatCapacity: formData.seatCapacity || settings?.seatCapacity,
    }),
    [settings, formData, effectiveStampUrl]
  );

  return (
    <>
      <div
        className="fixed inset-0 z-[85] flex items-center justify-center p-2 md:p-4"
        style={{ backgroundColor: "rgba(0,0,0,0.78)" }}
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ═══ HEADER ═══ */}
          <div
            className="flex flex-wrap justify-between items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                {htmlAttachment ? (
                  <Code2 className="w-5 h-5" />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2
                    className="text-base md:text-lg font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    نموذج تصريح {template?.country}
                  </h2>
                  <span className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400">
                    · {template?.permitType || "PERMIT"}
                  </span>
                  {htmlAttachment && (
                    <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      · HTML معبأ تلقائياً
                    </span>
                  )}
                </div>
                <p
                  className="text-xs truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {template?.name} · الرحلة:{" "}
                  <b className="font-mono tabular-nums">
                    {formData.flightNo || "—"}
                  </b>{" "}
                  ({formData.departure || "—"} → {formData.arrival || "—"}) ·
                  الطائرة:{" "}
                  <b className="font-mono">{formData.aircraft || "—"}</b>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {availableTemplates.length > 1 && (
                <Select
                  value={template?.id || ""}
                  onChange={(e) => {
                    const next = availableTemplates.find(
                      (t) => String(t.id) === String(e.target.value)
                    );
                    if (next) setTemplate(next);
                  }}
                  className="text-xs w-auto py-1.5"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.permitType})
                    </option>
                  ))}
                </Select>
              )}

              {pdfAttachment && (
                <button
                  type="button"
                  onClick={() => setShowMapper(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="تحديد أو تعديل مواقع الحقول على ملف PDF"
                >
                  <MousePointer2 className="w-3.5 h-3.5" />
                  ضبط الحقول ({(template?.fields || []).length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowEmailPanel((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Mail className="w-3.5 h-3.5" />
                إرسال بالبريد
              </button>

              <button
                type="button"
                onClick={
                  htmlAttachment
                    ? handlePrintHtmlAttachment
                    : () => setShowHtmlModal(true)
                }
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                {htmlAttachment ? "طباعة نموذج HTML" : "طباعة النموذج الرسمي"}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ═══ DIRECT EMAIL BAR (COLLAPSIBLE) ═══ */}
          {showEmailPanel && (
            <div
              className="px-4 py-3 border-b bg-slate-50 dark:bg-slate-900/70 flex flex-wrap items-end gap-3"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-bold mb-1 text-slate-600 dark:text-slate-300">
                  الإرسال من حساب (Sender Email)
                </label>
                <Select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  {emailAccounts.length === 0 ? (
                    <option value="">
                      الافتراضي ({settings?.email || "System Relay"})
                    </option>
                  ) : (
                    emailAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name ? `${acc.name} — ` : ""}
                        {acc.email} ({acc.mode === "smtp" ? "SMTP" : "Relay"})
                      </option>
                    ))
                  )}
                </Select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="block text-[11px] font-bold mb-1 text-slate-600 dark:text-slate-300">
                  إلى البريد المستلم (CAA / Agent Email)
                </label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="permits@caa.gov , ops@handler.aero"
                  className="font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleSendPermitEmail}
                disabled={sendingPermitEmail}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {sendingPermitEmail ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sendingPermitEmail ? "جاري الإرسال..." : "إرسال الطلب الآن"}
              </button>
            </div>
          )}

          {/* ═══ SPLIT BODY: LEFT = FORM INPUTS, RIGHT = LIVE FILLED FORM PREVIEW ═══ */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* LEFT PANE: Missing/Manual Inputs + Auto-Filled Data */}
            <div
              className="lg:col-span-5 overflow-y-auto p-4 space-y-4 border-b lg:border-b-0 lg:border-e"
              style={{ borderColor: "var(--border-default)" }}
            >
              {/* 1. MISSING & MANUAL INFORMATION (TOP PRIORITY) */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3
                    className="text-sm font-bold flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>المعلومات الناقصة / الإدخال اليدوي</span>
                  </h3>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    {uncompletedCount > 0
                      ? `${uncompletedCount} حقول تحتاج تعبئة`
                      : "مكتملة"}
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  الحقول التالية لم تتوفر تلقائياً في بيانات الرحلة أو تتطلب إدخالاً يدوياً لإكمال نموذج {template?.country}:
                </p>

                {missingOrManualFields.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    جميع حقول النموذج تم التعرف عليها وتعبئتها تلقائياً من النظام!
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {missingOrManualFields.map((f) => {
                      const val = formData[f.key] ?? "";
                      const isFilled = Boolean(String(val).trim());
                      return (
                        <Field
                          key={f.key}
                          label={`${isFilled ? "✓ " : "⚠️ "}${f.label}`}
                        >
                          <Input
                            value={val}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            placeholder={`أدخل ${f.label}...`}
                            className={
                              !isFilled
                                ? "border-amber-400 dark:border-amber-600"
                                : "border-emerald-400 dark:border-emerald-600"
                            }
                          />
                        </Field>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. PERMIT TRACKING METADATA */}
              <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-3">
                <h3
                  className="text-sm font-bold flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <FileText className="w-4 h-4 text-sky-500" />
                  بيانات متابعة التصريح (اختياري عند تقديم الطلب)
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="رقم التصريح / Permit No">
                    <Input
                      value={formData.permitNo || ""}
                      onChange={(e) => updateField("permitNo", e.target.value)}
                      placeholder="PENDING أو رقم التصريح"
                      className="font-mono"
                    />
                  </Field>
                  <Field label="حالة التصريح / Status">
                    <Select
                      value={formData.status || "PENDING"}
                      onChange={(e) => updateField("status", e.target.value)}
                    >
                      <option value="DRAFT">DRAFT — مسودة طلب</option>
                      <option value="PENDING">PENDING — قيد الطلب</option>
                      <option value="APPROVED">FINAL / APPROVED — معتمد</option>
                      <option value="ACTIVE">ACTIVE — ساري</option>
                    </Select>
                  </Field>
                  <Field label="تاريخ الطلب / الإصدار">
                    <Input
                      type="date"
                      value={formData.issuedDate || ""}
                      onChange={(e) => updateField("issuedDate", e.target.value)}
                    />
                  </Field>
                  <Field label="تاريخ الصلاحية / الانتهاء">
                    <Input
                      type="date"
                      value={formData.expiryDate || ""}
                      onChange={(e) => updateField("expiryDate", e.target.value)}
                    />
                  </Field>
                  <Field label="الجهة المصدرة / CAA Authority" span>
                    <Input
                      value={formData.issuedBy || ""}
                      onChange={(e) => updateField("issuedBy", e.target.value)}
                      placeholder={`${template?.country || ""} Civil Aviation Authority`}
                    />
                  </Field>
                </div>
              </div>

              {/* 3. AUTO-FILLED DATA FROM FLIGHT + FLEET/CAMO + OPERATOR */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3
                    className="text-sm font-bold flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <Plane className="w-4 h-4 text-emerald-500" />
                    البيانات المعبأة تلقائياً (قابلة للتعديل)
                  </h3>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {autoPopulatedFields.length} حقل تلقائي
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {autoPopulatedFields.map((f) => (
                    <Field key={f.key} label={`⚡ ${f.label}`}>
                      <Input
                        value={formData[f.key] ?? ""}
                        onChange={(e) => updateField(f.key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              {/* 4. ADDITIONAL NOTES */}
              <Field label="ملاحظات إضافية / Additional Remarks">
                <textarea
                  value={formData.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                    backgroundColor: "var(--bg-app)",
                  }}
                  placeholder="أي ملاحظات إضافية ترفق مع طلب التصريح..."
                />
              </Field>
            </div>

            {/* RIGHT PANE: LIVE COUNTRY FORM PREVIEW (HTML OR PDF OR OFFICIAL) */}
            <div
              className="lg:col-span-7 flex flex-col overflow-hidden"
              style={{ backgroundColor: "var(--bg-app)" }}
            >
              {/* Preview Toolbar */}
              <div
                className="px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                }}
              >
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Sparkles
                    className="w-4 h-4"
                    style={{ color: "var(--brand-primary)" }}
                  />
                  <span style={{ color: "var(--text-primary)" }}>
                    {htmlAttachment
                      ? `معاينة حية لنموذج HTML المرفق (${htmlAttachment.name}) — ${recognizedHtmlBundle.fields.length} حقل متعرف عليه`
                      : pdfAttachment
                      ? `معاينة النموذج المرفق (${pdfAttachment.name})`
                      : imageAttachment
                      ? `صورة النموذج المرفق (${imageAttachment.name})`
                      : `معاينة النموذج الرسمي لـ ${template?.country}`}
                  </span>
                </div>

                {htmlAttachment && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          title: `${template?.country || ""} — ${
                            template?.name || "Permit"
                          }`,
                          html: getCleanFilledHtmlDoc(),
                          fileName: htmlAttachment.name,
                        })
                      }
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      تكبير
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintHtmlAttachment}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      طباعة / PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadHtmlAttachment}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 dark:bg-slate-700 hover:opacity-90 text-white flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل HTML
                    </button>
                  </div>
                )}

                {pdfAttachment && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={refreshPdfPreview}
                      disabled={generatingPdf}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:opacity-90 flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          generatingPdf ? "animate-spin" : ""
                        }`}
                      />
                      تحديث التعبئة
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenFullPdf}
                      disabled={generatingPdf}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      تكبير
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFilledPdf}
                      disabled={generatingPdf}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {generatingPdf ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      تحميل PDF المعبأ
                    </button>
                  </div>
                )}
              </div>

              {/* Notice if PDF uploaded without coordinates or AcroForm yet */}
              {pdfAttachment && !hasMappingOrAcro && (
                <div className="mx-4 mt-3 p-3 rounded-xl bg-purple-500/15 border border-purple-500/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs" style={{ color: "var(--text-primary)" }}>
                    <b>خطوة سريعة لمرة واحدة:</b> هذا الملف ثابت (غير تفاعلي) ولم تُحدد مواضع الكتابة عليه بعد. اضغط الزر لتحديد أماكن الحقول على النموذج ليتم تعبئته تلقائياً دائماً.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMapper(true)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <MousePointer2 className="w-3.5 h-3.5" />
                    تحديد مواضع الحقول على PDF
                  </button>
                </div>
              )}

              {/* Main Preview Surface */}
              <div className="flex-1 overflow-auto p-3">
                {htmlAttachment ? (
                  loadingHtml ? (
                    <div className="h-full min-h-[380px] flex flex-col items-center justify-center gap-2">
                      <Loader2
                        className="w-8 h-8 animate-spin"
                        style={{ color: "var(--brand-primary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        جاري قراءة نموذج HTML وتعبئة بيانات الرحلة...
                      </span>
                    </div>
                  ) : filledHtmlPreviewDoc ? (
                    <iframe
                      title="Filled Country HTML Permit"
                      srcDoc={filledHtmlPreviewDoc}
                      className="w-full h-full min-h-[520px] rounded-xl border bg-white shadow-sm"
                      style={{ borderColor: "var(--border-default)" }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      محتوى نموذج HTML فارغ
                    </div>
                  )
                ) : pdfAttachment ? (
                  pdfError ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-rose-400 bg-rose-500/5">
                      <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
                      <div className="text-sm font-bold text-rose-500 mb-1">
                        تعذر تحميل معاينة ملف PDF المرفق
                      </div>
                      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                        {pdfError}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowHtmlModal(true)}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        فتح النموذج الرسمي البديل الجاهز للطباعة
                      </button>
                    </div>
                  ) : filledPdfUrl || filledPdfBytes ? (
                    <PdfCanvasViewer
                      pdfData={filledPdfUrl || filledPdfBytes}
                      title={`Permit PDF — ${template?.country || ""}`}
                      fileName={`Permit_${template?.country || "Country"}.pdf`}
                      maxHeight="100%"
                      className="w-full h-full min-h-[480px]"
                    />
                  ) : (
                    <div className="h-full min-h-[380px] flex flex-col items-center justify-center gap-2">
                      <Loader2
                        className="w-8 h-8 animate-spin"
                        style={{ color: "var(--brand-primary)" }}
                      />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        جاري تعبئة نموذج {template?.country} ببيانات الرحلة...
                      </span>
                    </div>
                  )
                ) : imageAttachment && toDisplayImageUrl(imageAttachment.url) ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border shadow-sm">
                      <img
                        src={toDisplayImageUrl(imageAttachment.url)}
                        alt={imageAttachment.name}
                        referrerPolicy="no-referrer"
                        className="max-w-full h-auto mx-auto rounded"
                      />
                    </div>
                  </div>
                ) : (
                  /* Live Inline Official Request Summary Sheet when no file was uploaded */
                  <div className="bg-white text-black rounded-xl shadow-md p-6 max-w-2xl mx-auto text-xs space-y-4">
                    <div className="text-center border-b-2 border-black pb-3">
                      <div className="text-base font-bold">
                        {formData.operatorName || "FLIGHT OPERATIONS"}
                      </div>
                      {formData.operatorNameAr && (
                        <div className="text-sm font-bold text-slate-700">
                          {formData.operatorNameAr}
                        </div>
                      )}
                      <div className="mt-2 text-sm font-black uppercase tracking-wider bg-slate-100 py-1.5 border border-black">
                        {template?.permitType || "FLIGHT"} PERMIT APPLICATION —{" "}
                        {template?.country}
                      </div>
                    </div>

                    <table className="w-full border-collapse">
                      <tbody>
                        {[
                          [
                            "Operator / المشغل",
                            `${formData.operatorName} (${formData.operatorCode})`,
                          ],
                          ["Date of Flight / تاريخ الرحلة", formData.date || "—"],
                          [
                            "Flight Call Sign / رقم الرحلة",
                            formData.flightNo || "—",
                          ],
                          [
                            "Aircraft Reg & Type / الطائرة والطراز",
                            `${formData.aircraft || "—"} (${
                              formData.aircraftType || "—"
                            })`,
                          ],
                          ["Route & Sectors / خط السير", formData.route || "—"],
                          [
                            "Schedule (UTC) / التوقيت",
                            `STD: ${formData.std || "—"}  |  STA: ${
                              formData.sta || "—"
                            }`,
                          ],
                          ["Purpose of Flight / الغرض", formData.purpose || "—"],
                          [
                            "Captain (PIC) / قائد الطائرة",
                            `${formData.picName || "—"} ${
                              formData.picLicense
                                ? `(Lic: ${formData.picLicense})`
                                : ""
                            }`,
                          ],
                          [
                            "PAX / Crew",
                            `PAX: ${formData.pax || "0"}  |  Crew: ${
                              formData.crewCount || "0"
                            }`,
                          ],
                          [
                            "C of A / Insurance Expiry",
                            `COA: ${formData.coaExpiry || "—"}  |  Ins: ${
                              formData.insuranceExpiry || "—"
                            }`,
                          ],
                          [
                            "FIR Entry / Exit",
                            `Entry: ${formData.entryPoint || "—"}  |  Exit: ${
                              formData.exitPoint || "—"
                            }`,
                          ],
                          [
                            "Handling Agent / المناولة",
                            formData.handlingAgent || "—",
                          ],
                        ].map(([lbl, val], i) => (
                          <tr key={i}>
                            <td className="border border-slate-400 bg-slate-100 px-2.5 py-1.5 font-bold w-2/5">
                              {lbl}
                            </td>
                            <td className="border border-slate-400 px-2.5 py-1.5 font-mono">
                              {val}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pt-2 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => setShowHtmlModal(true)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <Printer className="w-4 h-4" /> فتح للطباعة الرسمية الكاملة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ FOOTER ═══ */}
          <div
            className="px-4 py-3 border-t flex flex-wrap justify-between items-center gap-2"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {uncompletedCount > 0
                ? `يتبقى ${uncompletedCount} حقل يدوي يمكنك تعبئته أعلاه قبل التحميل أو الطباعة`
                : "جميع الحقول مكتملة وجاهزة للطباعة أو الإرسال أو الحفظ"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-bold border whitespace-nowrap shrink-0"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إغلاق
              </button>
              {htmlAttachment && (
                <button
                  type="button"
                  onClick={handleDownloadHtmlAttachment}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  تحميل HTML المعبأ
                </button>
              )}
              {pdfAttachment && (
                <button
                  type="button"
                  onClick={handleDownloadFilledPdf}
                  disabled={generatingPdf}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  تحميل PDF المعبأ
                </button>
              )}
              <button
                type="button"
                onClick={handleSavePermit}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50 whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Save className="w-4 h-4" />
                {saving ? "جاري الحفظ..." : "حفظ تصريح الرحلة"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Field Mapper */}
      {showMapper && pdfAttachment && (
        <PDFFieldMapper
          pdfUrl={pdfAttachment.url}
          initialFields={Array.isArray(template?.fields) ? template.fields : []}
          onSave={handleSaveMappedFields}
          onClose={() => setShowMapper(false)}
        />
      )}

      {/* Official HTML Printable Preview */}
      {showHtmlModal && (
        <PermitHTMLPreview
          template={template}
          flight={enrichedFlightForHtml}
          crew={crew}
          settings={enrichedSettingsForHtml}
          permit={formData}
          user={user}
          onClose={() => setShowHtmlModal(false)}
        />
      )}
    </>
  );
}

export default PermitGenerateModal;
