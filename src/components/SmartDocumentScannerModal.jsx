/* ═══════════════════════════════════════════════════════════
 * SMART DOCUMENT & FORM SCANNER MODAL — v1.0
 * AI-powered OCR & Form Field Auto-Filler for Permits & Forms
 * Accepts Image (PNG/JPG), PDF, or HTML -> Auto-detects all fields
 * -> Auto-populates from selected Flight -> Allows manual edits
 * -> Generates fillable, printable, exportable official document
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Upload,
  FileText,
  Sparkles,
  Plane,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Stamp,
  FileX,
  Lock,
  Eye,
  FileCode,
  Image as ImageIcon,
  Copy,
  MousePointer2,
} from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import { showToast, printHTMLContent } from "../utils/dialog";
import { can as checkPerm } from "../config/permissions";
import { saveOperationalForm } from "../utils/operationalFormsService";
import { permitTemplatesAPI, uploadFile, toDisplayImageUrl } from "../api";
import { fillPermitPDF, downloadPDF, openPDF } from "../utils/pdfFiller";
import { PDFFieldMapper } from "./PDFFieldMapper";

export function SmartDocumentScannerModal({
  mode = "permit", // "permit" | "form"
  flight: initialFlight,
  flights = [],
  fleet = [],
  crew = [],
  settings = {},
  user,
  onClose,
  onTemplateSaved,
}) {
  const [selectedFlightId, setSelectedFlightId] = useState(
    initialFlight?.id || flights[0]?.id || ""
  );

  const activeFlight = useMemo(() => {
    return (
      flights.find((f) => String(f.id) === String(selectedFlightId)) ||
      initialFlight ||
      null
    );
  }, [flights, initialFlight, selectedFlightId]);

  // Document upload state
  const [inputTab, setInputTab] = useState("file"); // "file" | "html"
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);

  // Parsed Form State
  const [docTitle, setDocTitle] = useState("Permit / Flight Clearance Application");
  const [docCountry, setDocCountry] = useState("");
  const [docAuthority, setDocAuthority] = useState("");
  const [detectedFields, setDetectedFields] = useState([]);
  const [missingFields, setMissingFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [previewHtml, setPreviewHtml] = useState("");

  // Direct Original PDF Overlay Filling State
  const [filledPdfUrl, setFilledPdfUrl] = useState("");
  const [filledPdfBytes, setFilledPdfBytes] = useState(null);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [mappingOriginalPdf, setMappingOriginalPdf] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const fileInputRef = useRef(null);

  // File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileMime(file.type || "application/octet-stream");

    const reader = new FileReader();
    if (file.type.includes("html") || file.name.endsWith(".html") || file.name.endsWith(".htm")) {
      reader.onload = (evt) => {
        const text = evt.target?.result || "";
        setHtmlCode(String(text));
        setFileBase64("");
      };
      reader.readAsText(file);
    } else {
      reader.onload = (evt) => {
        const b64 = evt.target?.result || "";
        setFileBase64(String(b64));
      };
      reader.readAsDataURL(file);
    }
  };

  // Build Flight Context for Server AI
  const flightContext = useMemo(() => {
    if (!activeFlight) return {};

    const resolvedCrew = (activeFlight.crewSlots || []).map((s) => {
      const m = (crew || []).find((c) => String(c.id) === String(s.crewId));
      return { slot: s, member: m };
    });

    const pic = resolvedCrew.find(
      (x) =>
        x.slot.position === "captain" ||
        x.slot.position === "CPT" ||
        x.member?.role === "captain"
    )?.member;

    const fo = resolvedCrew.find(
      (x) =>
        x.slot.position === "firstOfficer" ||
        x.slot.position === "FO" ||
        x.member?.role === "firstOfficer"
    )?.member;

    const acftObj = fleet.find(
      (f) => String(f.reg || f.registration) === String(activeFlight.acft)
    );

    return {
      flightNo: activeFlight.flightNo,
      dep: activeFlight.dep,
      arr: activeFlight.arr,
      route: activeFlight.route || `${activeFlight.dep || ""}-${activeFlight.arr || ""}`,
      date: activeFlight.std ? String(activeFlight.std).slice(0, 10) : "",
      stdDate: activeFlight.std ? String(activeFlight.std).slice(0, 10) : "",
      stdTime: activeFlight.std ? String(activeFlight.std).slice(11, 16) : "",
      staTime: activeFlight.sta ? String(activeFlight.sta).slice(11, 16) : "",
      acft: activeFlight.acft,
      aircraftReg: activeFlight.acft,
      aircraftType: acftObj?.type || activeFlight.aircraftType || "Aircraft",
      mtow: acftObj?.mtow || "77000 KG",
      picName: pic?.fullName || "Capt. Commander",
      picLicense: pic?.licenseNo || "",
      picPassport: pic?.passportNo || "",
      foName: fo?.fullName || "First Officer",
      foLicense: fo?.licenseNo || "",
      pax: activeFlight.pax || 0,
      cargo: activeFlight.cargo || 0,
      operatorCode: settings?.operatorCode || "EACS",
      companyName: settings?.companyName || "Flight Operations",
      companyNameAr: settings?.companyNameAr || "إدارة العمليات الجوية",
      handlingAgent: activeFlight.services || "",
      permits: activeFlight.permits || "",
    };
  }, [activeFlight, fleet, crew, settings]);

  // Run AI Scanner
  const runAiAnalysis = async () => {
    if (!fileBase64 && !htmlCode) {
      return showToast("⚠️ يرجى تحميل صورة أو مستند PDF أو إدخال كود HTML");
    }

    setAnalyzing(true);
    try {
      const res = await fetch("/api/ai/parse-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64,
          mimeType: fileMime,
          htmlContent: htmlCode,
          flightData: flightContext,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || "فشل التحليل الذكي للنموذج");
      }

      setDocTitle(data.title || "Aviation Flight Document");
      setDocCountry(data.country || "");
      setDocAuthority(data.authority || "");
      setDetectedFields(data.detectedFields || []);
      setMissingFields(data.missingFields || []);
      setPreviewHtml(data.formattedHtml || "");
      setAnalysisDone(true);
      showToast("✅ تم التعرف على جميع الحقول وتعبئتها من بيانات الرحلة!");
    } catch (err) {
      showToast("❌ " + (err?.message || "خطأ في تحليل المستند"));
    } finally {
      setAnalyzing(false);
    }
  };

  // Direct Original PDF Overlay Filling Effect
  useEffect(() => {
    if (!analysisDone || !fileBase64 || (!fileMime.includes("pdf") && !selectedFile?.name?.toLowerCase()?.endsWith(".pdf"))) {
      setFilledPdfUrl("");
      setFilledPdfBytes(null);
      return;
    }
    let cancelled = false;
    setRenderingPdf(true);

    const fieldsToFill = [
      ...detectedFields.map((f) => ({
        key: f.key,
        systemKey: f.key,
        x: f.box?.x ?? 120,
        y: f.box?.y ?? 720,
        width: f.box?.width ?? 130,
        maxWidth: f.box?.width ?? 130,
        align: f.align || "center",
        fontSize: f.fontSize || 11,
        page: f.box?.page ?? 0,
        bold: true,
      })),
      ...missingFields.filter((m) => m.value).map((m) => ({
        key: m.key,
        systemKey: m.key,
        x: 120,
        y: 200,
        maxWidth: 130,
        align: "center",
        fontSize: 11,
      })),
    ];

    const dataDict = { ...flightContext };
    detectedFields.forEach((f) => {
      if (f.value) dataDict[f.key] = f.value;
    });
    missingFields.forEach((m) => {
      if (m.value) dataDict[m.key] = m.value;
    });

    fillPermitPDF(fileBase64, fieldsToFill, dataDict, [], {
      stampUrl: "",
    })
      .then((bytes) => {
        if (cancelled) return;
        setFilledPdfBytes(bytes);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const nextUrl = URL.createObjectURL(blob);
        setFilledPdfUrl((prev) => {
          if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000);
          return nextUrl;
        });
      })
      .catch((err) => {
        console.warn("Direct PDF fill preview warning:", err);
      })
      .finally(() => {
        if (!cancelled) setRenderingPdf(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    analysisDone,
    fileBase64,
    fileMime,
    selectedFile,
    detectedFields,
    missingFields,
    flightContext,
  ]);

  // Field change helper
  const updateDetectedField = (idx, nextVal) => {
    setDetectedFields((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value: nextVal };
      return copy;
    });
  };

  const updateMissingField = (idx, nextVal) => {
    setMissingFields((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value: nextVal };
      return copy;
    });
  };

  const addCustomField = () => {
    setCustomFields((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: "حقل مخصص / Custom Field",
        value: "",
      },
    ]);
  };

  const removeCustomField = (id) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const updateCustomField = (id, key, val) => {
    setCustomFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: val } : f))
    );
  };

  // Compile final document HTML for print / download / view
  const finalCompiledHtml = useMemo(() => {
    const logoUrl = toDisplayImageUrl(settings?.logo || "");
    const companyName = settings?.companyName || "Flight Operations";
    const companyNameAr = settings?.companyNameAr || "إدارة العمليات الجوية";

    // Map all fields into a structured summary table
    const allRows = [
      ...detectedFields.map((f) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:35%;">${f.label}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;color:#0f172a;">${f.value || "—"}</td>
        </tr>
      `),
      ...missingFields
        .filter((m) => m.value)
        .map((m) => `
        <tr style="background:#fffbeb;">
          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-weight:bold;color:#b45309;width:35%;">★ ${m.label}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;color:#1e3a8a;">${m.value}</td>
        </tr>
      `),
      ...customFields
        .filter((c) => c.value)
        .map((c) => `
        <tr>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:35%;">${c.label}</td>
          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;">${c.value}</td>
        </tr>
      `),
    ].join("");

    return `
<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="utf-8">
  <title>${docTitle} — ${activeFlight?.flightNo || ""}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; background: white; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  </style>
</head>
<body>
  <div style="border: 2px solid #1e3a8a; padding: 20px; border-radius: 4px;">
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
      <div style="display:flex; align-items:center; gap: 14px;">
        ${logoUrl ? `<img src="${logoUrl}" style="height: 55px; max-width: 140px; object-fit: contain;" />` : `<div style="font-size:28px;">✈️</div>`}
        <div>
          <div style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${companyName}</div>
          <div style="font-size: 12px; color: #475569;">${companyNameAr}</div>
        </div>
      </div>
      <div style="text-align: end;">
        <div style="font-size: 14px; font-weight: bold; color: #0f172a;">${docTitle}</div>
        <div style="font-size: 11px; color: #64748b;">${docAuthority || docCountry || "CIVIL AVIATION AUTHORITY"}</div>
        <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 2px;">Date: ${new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>

    <!-- Content Table -->
    <table>
      <tbody>
        ${allRows}
      </tbody>
    </table>

    <!-- Signatures -->
    <div style="margin-top: 28px; padding-top: 14px; border-top: 1px solid #94a3b8; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 11px; color: #64748b;">Authorized Flight Dispatcher / Dispatch Operations:</div>
        <div style="font-size: 12px; font-weight: bold; margin-top: 4px;">${user?.fullName || user?.username || "Flight Operations"}</div>
        <div style="margin-top: 24px; border-bottom: 1px solid #0f172a; width: 180px; height: 16px;"></div>
      </div>
    </div>
  </div>
</body>
</html>
`;
  }, [
    docTitle,
    docAuthority,
    docCountry,
    detectedFields,
    missingFields,
    customFields,
    activeFlight,
    settings,
    user,
  ]);

  // Actions
  const handlePrint = () => {
    if (filledPdfBytes) {
      openPDF(
        filledPdfBytes,
        `${docTitle || "Flight Document"} — ${activeFlight?.flightNo || ""}`
      );
      return;
    }
    printHTMLContent(
      finalCompiledHtml,
      `${docTitle || "Flight Document"} — ${activeFlight?.flightNo || ""}`
    );
  };

  const handleDownloadFilledPdf = () => {
    if (!filledPdfBytes) return;
    const safeName = `${(docTitle || "Flight_Document").replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_")}_${activeFlight?.flightNo || "Flight"}.pdf`;
    downloadPDF(filledPdfBytes, safeName);
    showToast("✅ تم تنزيل مستند PDF الأصلي المعبأ بنجاح", "success");
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([finalCompiledHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "Flight_Document").replace(/[^a-zA-Z0-9]/g, "_")}_${activeFlight?.flightNo || "Flight"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ تم تنزيل المستند بنجاح");
  };

  const handleSaveAsTemplate = async () => {
    if (savingTemplate) return;
    setSavingTemplate(true);
    try {
      const mapFieldToSave = (f) => ({
        key: f.key,
        systemKey: f.mappedFromFlight !== false ? f.key : "",
        label: f.label || f.key,
        auto: f.mappedFromFlight !== false,
        x: f.box?.x ?? 120,
        y: f.box?.y ?? 250,
        width: f.box?.width ?? 130,
        maxWidth: f.box?.width ?? 130,
        height: f.box?.height ?? 22,
        align: f.align || "center",
        fontSize: f.fontSize || 11,
        page: f.box?.page ?? 0,
        bold: true,
      });

      const templateFields = [
        ...detectedFields.map(mapFieldToSave),
        ...missingFields.map((m) => ({
          key: m.key,
          systemKey: "",
          label: m.label || m.key,
          auto: false,
          align: "center",
          maxWidth: 130,
          fontSize: 11,
        })),
        ...customFields.map((c) => ({
          key: `custom_${c.id}`,
          systemKey: "",
          label: c.label || "Custom Field",
          auto: false,
          align: "center",
          maxWidth: 130,
          fontSize: 11,
        })),
      ];

      const folder = mode === "permit" ? "permits-templates" : "operational-forms";
      const isPdf = Boolean(
        selectedFile &&
          (fileMime.includes("pdf") ||
            selectedFile.name?.toLowerCase()?.endsWith(".pdf"))
      );
      const isImage = Boolean(
        selectedFile &&
          (fileMime.startsWith("image/") ||
            /\.(png|jpe?g|webp|gif)$/i.test(selectedFile.name || ""))
      );
      const htmlBody = isPdf ? "" : htmlCode || previewHtml || finalCompiledHtml;

      const fileToUpload =
        selectedFile ||
        new File(
          [htmlBody],
          `${(docTitle || "template").replace(/[^a-zA-Z0-9_-]/g, "_") || "template"}.html`,
          { type: "text/html" }
        );

      const uploaded = await uploadFile(fileToUpload, folder);
      const driveAttachment = {
        name: fileToUpload.name,
        fileName: uploaded.fileName || fileToUpload.name,
        url: uploaded.fileUrl,
        viewUrl: uploaded.viewUrl || "",
        fileId: uploaded.fileId || "",
        path: uploaded.filePath || "",
        type:
          fileToUpload.type ||
          uploaded.mimeType ||
          (isPdf ? "application/pdf" : isImage ? "image/png" : "text/html"),
        mime:
          fileToUpload.type ||
          uploaded.mimeType ||
          (isPdf ? "application/pdf" : isImage ? "image/png" : "text/html"),
        size: uploaded.size || fileToUpload.size || 0,
        ...(!isPdf && !isImage
          ? {
              isHtml: true,
              htmlContent: htmlBody.length <= 32000 ? htmlBody : "",
            }
          : {}),
      };

      if (mode === "permit") {
        await permitTemplatesAPI.create({
          country: docCountry || "International",
          name: docTitle || "Smart Scanned Permit",
          permitType: "OVERFLIGHT",
          fields: templateFields,
          flightFields: detectedFields.map((f) => f.key),
          attachments: [driveAttachment],
          notes: `Created via Ultra AI Scanner on ${new Date().toISOString().slice(0, 10)}`,
        });
        showToast(
          "✅ تم رفع الملف في Google Drive وحفظ النموذج في Google Sheets بنجاح!",
          "success"
        );
      } else {
        await saveOperationalForm({
          id: `opform_ai_${Date.now()}`,
          name: docTitle || "نموذج تشغيلي ذكي",
          category: "Dispatch",
          format: isPdf ? "pdf" : "html",
          htmlContent: isPdf ? "" : htmlBody,
          attachments: [driveAttachment],
          fields: templateFields,
          showInContextMenu: true,
          notes: "تم التعرف والتنسيق التلقائي وحفظ الملف في Google Drive",
          updatedAt: new Date().toISOString(),
        });
        showToast(
          "✅ تم رفع النموذج في Google Drive وحفظه في Google Sheets للتعبئة التلقائية!",
          "success"
        );
      }
      onTemplateSaved?.();
    } catch (e) {
      showToast("❌ فشل حفظ النموذج: " + (e?.message || "خطأ غير معروف"), "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border fade-in"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 md:p-5 border-b flex items-center justify-between gap-3 text-white"
          style={{ background: "var(--brand-gradient)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                <span>أداة التعرف الذكي على النماذج وتعبئتها</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
                  AI OCR Scanner
                </span>
              </h2>
              <p className="text-xs text-white/80">
                إيداع صورة أو مستند PDF أو كود HTML للتعرف على الحقول وتعبئتها تلقائياً من الرحلة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Flight Selector (Shown in Permit mode only; Form mode is template-only without flight assignment) */}
        {mode !== "form" && flights.length > 0 && (
          <div
            className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <Plane className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand-primary)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                الرحلة المستهدفة للتعبئة التلقائية:
              </span>
              <select
                value={selectedFlightId}
                onChange={(e) => setSelectedFlightId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border text-xs font-bold font-mono transition flex-1"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                {flights.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.flightNo} • {f.dep} → {f.arr} • {f.std ? String(f.std).slice(0, 10) : ""} • {f.acft}
                  </option>
                ))}
              </select>
            </div>

            {activeFlight && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ جاهز للربط: {activeFlight.flightNo}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          {!analysisDone ? (
            /* Upload & Input Section */
            <div className="max-w-2xl mx-auto space-y-5">
              <div
                className="flex rounded-2xl p-1 border max-w-sm mx-auto"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setInputTab("file")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    inputTab === "file" ? "text-white shadow-sm" : "opacity-70"
                  }`}
                  style={inputTab === "file" ? { background: "var(--brand-gradient)" } : {}}
                >
                  <ImageIcon className="w-4 h-4" /> صورة أو مستند PDF
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab("html")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    inputTab === "html" ? "text-white shadow-sm" : "opacity-70"
                  }`}
                  style={inputTab === "html" ? { background: "var(--brand-gradient)" } : {}}
                >
                  <FileCode className="w-4 h-4" /> كود أو ملف HTML
                </button>
              </div>

              {inputTab === "file" ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition hover:border-sky-500 hover:bg-sky-500/5 group"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.html,.htm"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-sky-500/10 text-sky-500 group-hover:scale-110 transition">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>
                    {selectedFile ? selectedFile.name : "اسحب وأفلت مستند النموذج هنا أو انقر للاختيار"}
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    يدعم صور المستندات (PNG, JPG, WEBP) وملفات PDF ونماذج HTML الرسمية
                  </p>
                  {selectedFile && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> جاهز للتحليل: {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    الصق كود HTML للنموذج أو الترويسة هنا:
                  </label>
                  <textarea
                    rows={8}
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    placeholder="<form> ... أو <table> ... </form>"
                    className="w-full p-3 rounded-2xl border text-xs font-mono"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  disabled={analyzing || (!fileBase64 && !htmlCode)}
                  onClick={runAiAnalysis}
                  className="px-8 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition shadow-lg hover:scale-102"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جارٍ التعرف على الحقول ونصوص النموذج بالذكاء الاصطناعي...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>بدء التعرف الذكي والتعبئة التلقائية من الرحلة</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Analysis Completed: Side-by-side Fields & Document Editor */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Form Fields & Review */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>عنوان الوثيقة:</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">
                      {docCountry || "International"}
                    </span>
                  </div>
                  <input
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border text-sm font-bold"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                  <input
                    value={docAuthority}
                    onChange={(e) => setDocAuthority(e.target.value)}
                    placeholder="سلطة الطيران المدني / الجهة المانحة"
                    className="w-full px-3 py-1.5 rounded-xl border text-xs"
                    style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                {/* Missing / Manual Fields (High Priority Alert) */}
                {missingFields.length > 0 && (
                  <div className="p-4 rounded-2xl border bg-amber-500/5 border-amber-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>حقول ناقصة تتطلب إدخالاً يدوياً ({missingFields.length}):</span>
                    </div>
                    <div className="space-y-2">
                      {missingFields.map((field, idx) => (
                        <div key={field.key || idx} className="space-y-1">
                          <label className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                            <span>{field.label}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20">مطلوب</span>
                          </label>
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => updateMissingField(idx, e.target.value)}
                            placeholder={field.placeholder || "أدخل القيمة هنا..."}
                            className="w-full px-3 py-1.5 rounded-xl border text-xs font-mono focus:border-amber-500"
                            style={{
                              backgroundColor: "var(--bg-card)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-primary)",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected & Auto-Filled Fields */}
                <div className="p-4 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>الحقول المعبأة تلقائياً ({detectedFields.length}):</span>
                    </span>
                    <button
                      type="button"
                      onClick={addCustomField}
                      className="text-[11px] font-bold text-sky-500 hover:text-sky-600 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة حقل
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
                    {detectedFields.map((field, idx) => (
                      <div key={field.key || idx} className="space-y-0.5">
                        <label className="text-[10px] font-semibold flex items-center justify-between" style={{ color: "var(--text-muted)" }}>
                          <span>{field.label}</span>
                          <span className="text-[9px] text-emerald-500 font-mono">من الرحلة</span>
                        </label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateDetectedField(idx, e.target.value)}
                          className="w-full px-2.5 py-1 rounded-lg border text-xs font-mono font-bold"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-default)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    ))}

                    {customFields.map((cf) => (
                      <div key={cf.id} className="p-2 rounded-xl border space-y-1 bg-sky-500/5 border-sky-500/20">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={cf.label}
                            onChange={(e) => updateCustomField(cf.id, "label", e.target.value)}
                            placeholder="اسم الحقل"
                            className="flex-1 px-2 py-0.5 text-xs rounded border"
                            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
                          />
                          <button
                            type="button"
                            onClick={() => removeCustomField(cf.id)}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={cf.value}
                          onChange={(e) => updateCustomField(cf.id, "value", e.target.value)}
                          placeholder="القيمة"
                          className="w-full px-2 py-0.5 text-xs rounded border font-mono"
                          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAnalysisDone(false);
                    setSelectedFile(null);
                    setFileBase64("");
                  }}
                  className="w-full py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1.5"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> مسح نموذج آخر (Scan New Document)
                </button>
              </div>

              {/* Right Column: Live Original Document / Printable Preview */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    <Eye className="w-4 h-4 text-sky-500" />
                    <span>الكتابة المباشرة على المستند الأصلي (Direct Original Fill):</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {fileBase64 && fileMime.includes("pdf") && (
                      <button
                        type="button"
                        onClick={() => setMappingOriginalPdf(true)}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 shadow-xs"
                      >
                        <MousePointer2 className="w-3.5 h-3.5" />
                        🎯 الضبط الدقيق للحقول على PDF الأصلي
                      </button>
                    )}
                  </div>
                </div>

                {/* Rendered Preview Container */}
                <div
                  className="flex-1 min-h-[460px] max-h-[550px] overflow-auto rounded-2xl border p-2 shadow-inner"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  {filledPdfUrl ? (
                    <PdfCanvasViewer
                      pdfData={filledPdfUrl}
                      title="Original PDF Direct Fill Preview"
                      fileName="Document_Preview.pdf"
                      maxHeight="100%"
                      className="w-full h-full min-h-[440px]"
                    />
                  ) : renderingPdf ? (
                    <div className="h-full min-h-[440px] flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
                      <span className="text-xs text-slate-500">جاري الكتابة المباشرة على صفحات المستند الأصلي...</span>
                    </div>
                  ) : (
                    <iframe
                      title="Live Preview"
                      srcDoc={finalCompiledHtml}
                      className="w-full h-full min-h-[440px] border-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visual PDF Mapper Overlay Modal */}
        {mappingOriginalPdf && fileBase64 && (
          <PDFFieldMapper
            pdfUrl={fileBase64}
            initialFields={detectedFields.map((f) => ({
              key: f.key,
              systemKey: f.key,
              label: f.label || f.key,
              auto: true,
              x: f.box?.x ?? 120,
              y: f.box?.y ?? 720,
              maxWidth: f.box?.width ?? 130,
              align: f.align || "center",
              fontSize: f.fontSize || 11,
              page: f.box?.page ?? 0,
              bold: true,
            }))}
            onSave={(updatedFields) => {
              setDetectedFields((prev) =>
                prev.map((f) => {
                  const match = updatedFields.find((u) => u.key === f.key || u.systemKey === f.key);
                  return match
                    ? {
                        ...f,
                        box: {
                          x: match.x,
                          y: match.y,
                          width: match.maxWidth || match.width || 130,
                          height: match.height || 22,
                          page: match.page || 0,
                        },
                        align: match.align || "center",
                        fontSize: match.fontSize || 11,
                      }
                    : f;
                })
              );
              setMappingOriginalPdf(false);
              showToast("✅ تم تحديث مواضع الخانات والمحاذاة المركزية على المستند الأصلي!", "success");
            }}
            onClose={() => setMappingOriginalPdf(false)}
          />
        )}

        {/* Footer Actions */}
        <div
          className="p-4 border-t flex items-center justify-between gap-3 flex-wrap"
          style={{
            backgroundColor: "var(--bg-app)",
            borderColor: "var(--border-default)",
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border transition"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            إغلاق
          </button>

          {analysisDone && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={savingTemplate}
                onClick={handleSaveAsTemplate}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition hover:bg-sky-500/10 disabled:opacity-50"
                style={{
                  borderColor: "var(--brand-primary)",
                  color: "var(--brand-primary)",
                }}
              >
                {savingTemplate ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>
                  {savingTemplate
                    ? "جاري الرفع والحفظ في Google Drive..."
                    : "حفظ كنموذج معتمد"}
                </span>
              </button>

              {filledPdfBytes ? (
                <button
                  type="button"
                  onClick={handleDownloadFilledPdf}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition hover:bg-indigo-500/10"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل PDF الأصلي المعبأ</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition hover:bg-slate-500/10"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل HTML</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition hover:opacity-90"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Printer className="w-4 h-4" />
                <span>
                  {filledPdfBytes ? "معاينة وطباعة PDF الأصلي" : "طباعة الوثيقة"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SmartDocumentScannerModal;
