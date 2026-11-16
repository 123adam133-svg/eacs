/* ═══════════════════════════════════════════════════════════
 * SMART DOCUMENT & FORM SCANNER MODAL — v3.0 (Full-Page Studio + AI Chat)
 * AI-powered OCR, Interactive AI Chat Editor & Form Auto-Filler
 * - Full-screen streamlined studio with compact, simplified controls
 * - Live AI Chat Assistant applying commands directly to fields/layout
 * - Direct Original Fill on BOTH Images (auto-PDF) & PDFs + HTML templates
 * - Saves directly to Operational Forms / Permits + Flight Dropdown Menu
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Upload,
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
  Eye,
  FileCode,
  Image as ImageIcon,
  MousePointer2,
  Link2,
  MessageSquare,
  Send,
  ListChecks,
} from "lucide-react";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import { showToast, printHTMLContent } from "../utils/dialog";
import { saveOperationalForm } from "../utils/operationalFormsService";
import { permitTemplatesAPI, uploadFile, toDisplayImageUrl } from "../api";
import { fillPermitPDF, downloadPDF, openPDF } from "../utils/pdfFiller";
import {
  SYSTEM_DATA_CATALOG,
  buildSystemAutoData,
  matchLabelOrTokenToSystemKey,
} from "../utils/htmlTemplateEngine";
import { PDFFieldMapper } from "./PDFFieldMapper";

const CATALOG_KEY_SET = new Set(SYSTEM_DATA_CATALOG.map((c) => c.key));

const AI_QUICK_PROMPTS = [
  "أضف حقل رقم التصريح اربطه بالنموذج",
  "أضف حقل اسم قائد الطائرة واربطه بالكابتن",
  "غيّر عنوان النموذج إلى تصريح عبور جوي",
  "حوّل التنسيق إلى HTML منسق للطباعة",
];

async function convertImageDataUrlToPdfDataUrl(imageDataUrl) {
  const { PDFDocument } = await import("pdf-lib");
  const pngBytes = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1240;
        canvas.height = img.naturalHeight || img.height || 1754;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const pngData = canvas.toDataURL("image/png");
        const b64 = pngData.split(",")[1];
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        resolve({ u8, width: canvas.width, height: canvas.height });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("تعذر قراءة ملف الصورة للتحويل"));
    img.src = imageDataUrl;
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const embedded = await pdfDoc.embedPng(pngBytes.u8);
  const scale = Math.min(595 / pngBytes.width, 842 / pngBytes.height);
  const drawW = pngBytes.width * scale;
  const drawH = pngBytes.height * scale;
  page.drawImage(embedded, {
    x: (595 - drawW) / 2,
    y: (842 - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  const pdfBytes = await pdfDoc.save();
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < pdfBytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, pdfBytes.subarray(i, i + chunk));
  }
  return {
    dataUrl: `data:application/pdf;base64,${btoa(binary)}`,
    bytes: pdfBytes,
  };
}

export function SmartDocumentScannerModal({
  mode = "permit",
  flight: initialFlight,
  flights = [],
  fleet = [],
  camoList = [],
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

  // Upload & analysis state
  const [inputTab, setInputTab] = useState("file");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [convertedPdfBase64, setConvertedPdfBase64] = useState("");
  const [convertedPdfBytes, setConvertedPdfBytes] = useState(null);
  const [htmlCode, setHtmlCode] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [aiSource, setAiSource] = useState("");

  // Workspace left panel sub-tab ("fields" | "chat")
  const [leftTab, setLeftTab] = useState("fields");

  // Parsed Form State
  const [docTitle, setDocTitle] = useState("Permit / Operational Form");
  const [docCategory, setDocCategory] = useState("Dispatch");
  const [docCountry, setDocCountry] = useState("");
  const [docAuthority, setDocAuthority] = useState("");
  const [detectedFields, setDetectedFields] = useState([]);
  const [missingFields, setMissingFields] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [saveOutputFormat, setSaveOutputFormat] = useState("original");
  const [includeInContextMenu, setIncludeInContextMenu] = useState(true);

  // Direct Original PDF Overlay Filling State
  const [filledPdfUrl, setFilledPdfUrl] = useState("");
  const [filledPdfBytes, setFilledPdfBytes] = useState(null);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [mappingOriginalPdf, setMappingOriginalPdf] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // AI Chat Assistant State
  const [chatMessages, setChatMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "مرحباً! اكتب أي أمر لتعديل النموذج مباشرة (مثل: إضافة حقل، ربطه ببيانات الرحلة، تعديل العنوان، حذف حقل، أو تعديل تخطيط HTML).",
      appliedCount: 0,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, leftTab]);

  const isPdfInput = Boolean(
    fileMime.includes("pdf") ||
      selectedFile?.name?.toLowerCase()?.endsWith(".pdf")
  );
  const isImageInput = Boolean(
    fileMime.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp)$/i.test(selectedFile?.name || "")
  );

  const effectivePdfSource = useMemo(() => {
    if (isPdfInput && fileBase64) return fileBase64;
    if (isImageInput && convertedPdfBase64) return convertedPdfBase64;
    return "";
  }, [isPdfInput, isImageInput, fileBase64, convertedPdfBase64]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileMime(file.type || "application/octet-stream");
    setConvertedPdfBase64("");
    setConvertedPdfBytes(null);

    const reader = new FileReader();
    if (
      file.type.includes("html") ||
      file.name.endsWith(".html") ||
      file.name.endsWith(".htm")
    ) {
      reader.onload = (evt) => {
        setHtmlCode(String(evt.target?.result || ""));
        setFileBase64("");
      };
      reader.readAsText(file);
    } else {
      reader.onload = async (evt) => {
        const b64 = String(evt.target?.result || "");
        setFileBase64(b64);
        if (
          file.type.startsWith("image/") ||
          /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)
        ) {
          try {
            const pdfConv = await convertImageDataUrlToPdfDataUrl(b64);
            setConvertedPdfBase64(pdfConv.dataUrl);
            setConvertedPdfBytes(pdfConv.bytes);
          } catch (err) {
            console.warn("Image->PDF preview prep warning:", err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const systemAutoData = useMemo(() => {
    return buildSystemAutoData({
      flight: activeFlight,
      selectedFlights: activeFlight ? [activeFlight] : [],
      fleet,
      camoList,
      crew,
      settings,
      user,
    });
  }, [activeFlight, fleet, camoList, crew, settings, user]);

  const flightContext = useMemo(() => {
    if (!activeFlight) {
      return {
        operatorName: settings?.companyName || "Flight Operations",
        operatorNameAr: settings?.companyNameAr || "إدارة العمليات الجوية",
        operatorCode: settings?.operatorCode || "EACS",
        phone: settings?.phone || "",
        email: settings?.email || "",
        sita: settings?.sita || "",
      };
    }
    return {
      ...systemAutoData,
      flightNo: activeFlight.flightNo,
      dep: activeFlight.dep,
      arr: activeFlight.arr,
      stdDate: activeFlight.std ? String(activeFlight.std).slice(0, 10) : "",
      stdTime: activeFlight.std ? String(activeFlight.std).slice(11, 16) + "Z" : "",
      staTime: activeFlight.sta ? String(activeFlight.sta).slice(11, 16) + "Z" : "",
      acft: activeFlight.acft,
      aircraftReg: activeFlight.acft,
      companyName: settings?.companyName || "Flight Operations",
      companyNameAr: settings?.companyNameAr || "إدارة العمليات الجوية",
      handlingAgent: activeFlight.services || systemAutoData.handlingAgent || "",
      permits: activeFlight.permits || "",
    };
  }, [activeFlight, systemAutoData, settings]);

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

      setAiSource(data.source || "");
      setDocTitle(
        data.title ||
          selectedFile?.name?.replace(/\.[^/.]+$/, "") ||
          "Operational Aviation Form"
      );
      setDocCategory(data.category || "Dispatch");
      setDocCountry(data.country || "");
      setDocAuthority(data.authority || "");

      const normalizedFields = (data.detectedFields || []).map((f) => {
        const candidate =
          f.systemKey && CATALOG_KEY_SET.has(f.systemKey)
            ? f.systemKey
            : CATALOG_KEY_SET.has(f.key)
            ? f.key
            : matchLabelOrTokenToSystemKey(f.systemKey || f.key || f.label);

        const sysKey = candidate || "";
        const liveVal =
          sysKey && systemAutoData[sysKey] !== undefined && systemAutoData[sysKey] !== ""
            ? String(systemAutoData[sysKey])
            : f.value || "";

        return {
          ...f,
          key: sysKey || f.key,
          systemKey: sysKey,
          mappedFromFlight: Boolean(sysKey),
          value: liveVal,
          box: f.box || { x: 140, y: 680, width: 140, height: 22, page: 0 },
          fontSize: f.fontSize || 10,
          align: f.align || "center",
        };
      });

      setDetectedFields(normalizedFields);
      setMissingFields(data.missingFields || []);
      setPreviewHtml(data.formattedHtml || "");
      setSaveOutputFormat(isPdfInput || isImageInput ? "original" : "html");
      setAnalysisDone(true);
      showToast("✅ تم التعرف على الحقول وربطها بمعلومات النظام بنجاح!", "success");
    } catch (err) {
      showToast("❌ " + (err?.message || "خطأ في تحليل المستند"), "error");
    } finally {
      setAnalyzing(false);
    }
  };

  // Start clean AI Workspace without uploaded file (AI Chat Form Builder)
  const startBlankAiWorkspace = () => {
    setDocTitle(mode === "permit" ? "تصريح رحلة / Flight Permit" : "نموذج تشغيلي / Flight Form");
    setDetectedFields([
      {
        key: "flightNo",
        systemKey: "flightNo",
        label: "Flight No / رقم الرحلة",
        value: String(systemAutoData.flightNo || ""),
        mappedFromFlight: true,
        box: { x: 170, y: 695, width: 130, height: 20, page: 0 },
        fontSize: 10,
        align: "center",
      },
      {
        key: "route",
        systemKey: "route",
        label: "Route / المسار",
        value: String(systemAutoData.route || ""),
        mappedFromFlight: true,
        box: { x: 170, y: 660, width: 180, height: 20, page: 0 },
        fontSize: 10,
        align: "center",
      },
    ]);
    setSaveOutputFormat("html");
    setAnalysisDone(true);
    setLeftTab("chat");
  };

  // Apply structured AI commands cleanly onto the live form state
  const applyAiCommands = (commands) => {
    if (!Array.isArray(commands) || commands.length === 0) return 0;
    let applied = 0;

    const findMatchIdx = (list, target) => {
      if (typeof target === "number" && list[target]) return target;
      const t = String(target || "").trim().toLowerCase();
      if (!t) return -1;
      return list.findIndex(
        (f, i) =>
          String(i) === t ||
          String(f.key || "").toLowerCase() === t ||
          String(f.systemKey || "").toLowerCase() === t ||
          String(f.label || "").toLowerCase().includes(t)
      );
    };

    commands.forEach((cmd) => {
      if (!cmd || !cmd.type) return;

      if (cmd.type === "update_meta") {
        if (cmd.title) setDocTitle(String(cmd.title));
        if (cmd.category) setDocCategory(String(cmd.category));
        if (cmd.authority !== undefined) setDocAuthority(String(cmd.authority));
        if (cmd.country !== undefined) setDocCountry(String(cmd.country));
        if (cmd.outputFormat === "html" || cmd.outputFormat === "original") {
          setSaveOutputFormat(cmd.outputFormat);
        }
        applied++;
      } else if (cmd.type === "add_field") {
        const candSys =
          cmd.systemKey && CATALOG_KEY_SET.has(cmd.systemKey)
            ? cmd.systemKey
            : matchLabelOrTokenToSystemKey(cmd.systemKey || cmd.key || cmd.label) || "";
        const sysVal =
          candSys && systemAutoData[candSys] !== undefined && systemAutoData[candSys] !== ""
            ? String(systemAutoData[candSys])
            : "";
        const nextField = {
          key: candSys || cmd.key || `ai_field_${Date.now().toString(36)}`,
          systemKey: candSys,
          label: cmd.label || candSys || "حقل جديد",
          value: cmd.value !== undefined && cmd.value !== "" ? String(cmd.value) : sysVal,
          mappedFromFlight: Boolean(candSys),
          category: cmd.category || "manual",
          align: cmd.align || "center",
          fontSize: Number(cmd.fontSize) || 10,
          box: {
            x: Number(cmd.box?.x) || 160,
            y: Number(cmd.box?.y) || 440,
            width: Number(cmd.box?.width) || 140,
            height: Number(cmd.box?.height) || 20,
            page: Number(cmd.box?.page) || 0,
          },
        };
        setDetectedFields((prev) => [...prev, nextField]);
        applied++;
      } else if (cmd.type === "update_field") {
        setDetectedFields((prev) => {
          const idx = findMatchIdx(prev, cmd.target ?? cmd.key ?? cmd.label);
          if (idx === -1) return prev;
          const copy = [...prev];
          const cur = copy[idx];
          const nextSys =
            cmd.systemKey !== undefined
              ? CATALOG_KEY_SET.has(cmd.systemKey)
                ? cmd.systemKey
                : ""
              : cur.systemKey;
          const nextVal =
            cmd.value !== undefined
              ? String(cmd.value)
              : nextSys && systemAutoData[nextSys] !== undefined
              ? String(systemAutoData[nextSys])
              : cur.value;
          copy[idx] = {
            ...cur,
            label: cmd.label || cur.label,
            systemKey: nextSys,
            key: nextSys || cur.key,
            mappedFromFlight: Boolean(nextSys),
            value: nextVal,
            align: cmd.align || cur.align,
            fontSize: cmd.fontSize ? Number(cmd.fontSize) : cur.fontSize,
            box: cmd.box ? { ...(cur.box || {}), ...cmd.box } : cur.box,
          };
          return copy;
        });
        applied++;
      } else if (cmd.type === "remove_field") {
        const target = cmd.target ?? cmd.key ?? cmd.label;
        setDetectedFields((prev) => {
          const idx = findMatchIdx(prev, target);
          if (idx === -1) return prev;
          return prev.filter((_, i) => i !== idx);
        });
        setMissingFields((prev) => {
          const t = String(target || "").toLowerCase();
          return prev.filter(
            (m) =>
              String(m.key || "").toLowerCase() !== t &&
              !String(m.label || "").toLowerCase().includes(t)
          );
        });
        applied++;
      } else if (cmd.type === "update_missing_field") {
        const t = String(cmd.target || "").toLowerCase();
        setMissingFields((prev) =>
          prev.map((m) =>
            String(m.key || "").toLowerCase() === t ||
            String(m.label || "").toLowerCase().includes(t)
              ? { ...m, value: String(cmd.value ?? m.value) }
              : m
          )
        );
        applied++;
      } else if (cmd.type === "set_html_template" && cmd.formattedHtml) {
        setPreviewHtml(String(cmd.formattedHtml));
        setSaveOutputFormat("html");
        applied++;
      }
    });

    if (applied > 0 && !analysisDone) {
      setAnalysisDone(true);
    }
    return applied;
  };

  const handleSendChat = async (overrideMsg) => {
    const text = String(overrideMsg ?? chatInput).trim();
    if (!text || chatLoading) return;

    const userEntry = { id: `u_${Date.now()}`, role: "user", text };
    setChatMessages((prev) => [...prev, userEntry]);
    if (!overrideMsg) setChatInput("");
    setLeftTab("chat");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/form-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: chatMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          formState: {
            title: docTitle,
            category: docCategory,
            authority: docAuthority,
            country: docCountry,
            saveOutputFormat,
            detectedFields,
            missingFields,
          },
          flightData: flightContext,
          fileBase64,
          mimeType: fileMime,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "تعذر تنفيذ الأمر");

      const appliedCount = applyAiCommands(data.commands || []);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: data.assistantMessage || "تم تطبيق التعديل على النموذج.",
          appliedCount,
          commands: data.commands || [],
        },
      ]);
      if (appliedCount > 0) {
        showToast(`✅ تم تطبيق ${appliedCount} تعديل على النموذج`, "success");
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: "assistant",
          text: `⚠️ ${err?.message || "حدث خطأ أثناء تنفيذ الأمر"}`,
          appliedCount: 0,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Re-apply system data values smoothly when switching Target Flight
  useEffect(() => {
    if (!analysisDone || !activeFlight) return;
    setDetectedFields((prev) =>
      prev.map((f) => {
        const sk = f.systemKey || (CATALOG_KEY_SET.has(f.key) ? f.key : "");
        if (!sk) return f;
        const nextVal = systemAutoData[sk];
        if (nextVal !== undefined && nextVal !== "") {
          return { ...f, value: String(nextVal) };
        }
        return f;
      })
    );
  }, [activeFlight?.id, analysisDone, systemAutoData]);

  // Direct Original PDF / Image-PDF Overlay Filling Effect
  useEffect(() => {
    if (!analysisDone || !effectivePdfSource) {
      setFilledPdfUrl("");
      setFilledPdfBytes(null);
      return;
    }
    let cancelled = false;
    setRenderingPdf(true);

    const fieldsToFill = [
      ...detectedFields.map((f) => ({
        key: f.key,
        systemKey: f.systemKey || f.key,
        x: f.box?.x ?? 120,
        y: f.box?.y ?? 720,
        width: f.box?.width ?? 130,
        maxWidth: f.box?.width ?? 130,
        height: f.box?.height ?? 22,
        align: f.align || "center",
        fontSize: f.fontSize || 10,
        page: f.box?.page ?? 0,
        bold: true,
      })),
      ...missingFields
        .filter((m) => m.value)
        .map((m, idx) => ({
          key: m.key,
          systemKey: m.key,
          x: 160,
          y: Math.max(80, 220 - idx * 28),
          maxWidth: 160,
          align: "center",
          fontSize: 10,
        })),
    ];

    const dataDict = { ...systemAutoData };
    detectedFields.forEach((f) => {
      if (f.value !== undefined) {
        dataDict[f.key] = f.value;
        if (f.systemKey) dataDict[f.systemKey] = f.value;
      }
    });
    missingFields.forEach((m) => {
      if (m.value) dataDict[m.key] = m.value;
    });

    fillPermitPDF(effectivePdfSource, fieldsToFill, dataDict, [], {
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
        console.warn("Direct PDF/Image fill preview warning:", err);
      })
      .finally(() => {
        if (!cancelled) setRenderingPdf(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    analysisDone,
    effectivePdfSource,
    detectedFields,
    missingFields,
    systemAutoData,
  ]);

  const updateDetectedField = (idx, nextVal) => {
    setDetectedFields((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], value: nextVal };
      return copy;
    });
  };

  const updateDetectedFieldSystemKey = (idx, nextSysKey) => {
    setDetectedFields((prev) => {
      const copy = [...prev];
      const cur = copy[idx];
      if (!cur) return prev;
      const nextVal =
        nextSysKey && systemAutoData[nextSysKey] !== undefined
          ? String(systemAutoData[nextSysKey])
          : cur.value;
      copy[idx] = {
        ...cur,
        systemKey: nextSysKey || "",
        key: nextSysKey || cur.key,
        mappedFromFlight: Boolean(nextSysKey),
        value: nextVal,
      };
      return copy;
    });
  };

  const removeDetectedField = (idx) => {
    setDetectedFields((prev) => prev.filter((_, i) => i !== idx));
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
        label: "حقل مخصص",
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

  const buildTemplatedHtmlBody = () => {
    if (previewHtml && String(previewHtml).trim()) {
      return previewHtml;
    }
    const rows = [
      ...detectedFields.map(
        (f) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:38%;">${f.label}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;">{{${
          f.systemKey || f.key
        }}}</td>
      </tr>`
      ),
      ...missingFields.map(
        (m) => `
      <tr>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:38%;">${m.label}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;">{{${m.key}}}</td>
      </tr>`
      ),
    ].join("");

    return `<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:16px;border:2px solid #1e3a8a;background:#fff;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:bold;color:#1e3a8a;">{{operatorName}} ({{operatorCode}})</div>
          <div style="font-size:11px;color:#475569;">${docAuthority || "Flight Operations"}</div>
        </div>
        <div style="text-align:end;">
          <div style="font-size:14px;font-weight:bold;">${docTitle}</div>
          <div style="font-size:10px;font-family:monospace;color:#64748b;">{{date}} · {{flightNo}}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;"><tbody>${rows}</tbody></table>
    </div>`;
  };

  const finalCompiledHtml = useMemo(() => {
    const logoUrl = toDisplayImageUrl(settings?.logo || "");
    const companyName = settings?.companyName || "Flight Operations";
    const companyNameAr = settings?.companyNameAr || "إدارة العمليات الجوية";

    // If AI generated custom HTML template, substitute live field values cleanly inside it
    if (previewHtml && String(previewHtml).trim()) {
      let rendered = String(previewHtml);
      const tokenValues = { ...systemAutoData };
      detectedFields.forEach((f) => {
        if (f.key) tokenValues[f.key] = f.value ?? "";
        if (f.systemKey) tokenValues[f.systemKey] = f.value ?? "";
      });
      missingFields.forEach((m) => {
        if (m.key) tokenValues[m.key] = m.value ?? "";
      });
      rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) =>
        tokenValues[k] !== undefined && tokenValues[k] !== "" ? String(tokenValues[k]) : "—"
      );
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:10mm;}body{font-family:Arial,sans-serif;margin:0;padding:12px;background:#fff;color:#0f172a;}</style></head><body>${rendered}</body></html>`;
    }

    const allRows = [
      ...detectedFields.map(
        (f) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:36%;">${f.label}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;color:#0f172a;">${f.value || "—"}</td>
        </tr>
      `
      ),
      ...missingFields
        .filter((m) => m.value)
        .map(
          (m) => `
        <tr style="background:#fffbeb;">
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-weight:bold;color:#b45309;width:36%;">★ ${m.label}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;color:#1e3a8a;">${m.value}</td>
        </tr>
      `
        ),
      ...customFields
        .filter((c) => c.value)
        .map(
          (c) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:bold;width:36%;">${c.label}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;">${c.value}</td>
        </tr>
      `
        ),
    ].join("");

    return `<!DOCTYPE html>
<html dir="ltr">
<head>
  <meta charset="utf-8">
  <title>${docTitle} — ${activeFlight?.flightNo || ""}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; background: white; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  </style>
</head>
<body>
  <div style="border: 2px solid #1e3a8a; padding: 16px; border-radius: 4px;">
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">
      <div style="display:flex; align-items:center; gap: 12px;">
        ${logoUrl ? `<img src="${logoUrl}" style="height: 46px; max-width: 120px; object-fit: contain;" />` : `<div style="font-size:24px;">✈️</div>`}
        <div>
          <div style="font-size: 15px; font-weight: bold; color: #1e3a8a;">${companyName}</div>
          <div style="font-size: 11px; color: #475569;">${companyNameAr}</div>
        </div>
      </div>
      <div style="text-align: end;">
        <div style="font-size: 13px; font-weight: bold; color: #0f172a;">${docTitle}</div>
        <div style="font-size: 10px; color: #64748b;">${docAuthority || docCountry || "CIVIL AVIATION AUTHORITY"}</div>
        <div style="font-size: 9.5px; font-family: monospace; color: #64748b; margin-top: 2px;">${activeFlight?.flightNo || ""} · ${new Date().toISOString().slice(0, 10)}</div>
      </div>
    </div>
    <table><tbody>${allRows}</tbody></table>
    <div style="margin-top: 22px; padding-top: 10px; border-top: 1px solid #94a3b8; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 10px; color: #64748b;">Authorized Dispatch Operations:</div>
        <div style="font-size: 11px; font-weight: bold; margin-top: 2px;">${user?.fullName || user?.username || "Flight Operations"}</div>
      </div>
      <div style="border-bottom: 1px solid #0f172a; width: 160px; height: 16px;"></div>
    </div>
  </div>
</body>
</html>`;
  }, [
    previewHtml,
    systemAutoData,
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

  const handlePrint = () => {
    if (saveOutputFormat === "original" && filledPdfBytes) {
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
    showToast("✅ تم تنزيل PDF المعبأ", "success");
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([finalCompiledHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "Flight_Document").replace(/[^a-zA-Z0-9]/g, "_")}_${activeFlight?.flightNo || "Flight"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ تم تنزيل ملف HTML", "success");
  };

  const handleSaveAsTemplate = async () => {
    if (savingTemplate) return;
    setSavingTemplate(true);
    try {
      const mapFieldToSave = (f) => ({
        key: f.systemKey || f.key,
        systemKey: f.systemKey || (f.mappedFromFlight ? f.key : ""),
        label: f.label || f.key,
        auto: Boolean(f.systemKey || f.mappedFromFlight !== false),
        x: f.box?.x ?? 120,
        y: f.box?.y ?? 250,
        width: f.box?.width ?? 130,
        maxWidth: f.box?.width ?? 130,
        height: f.box?.height ?? 22,
        align: f.align || "center",
        fontSize: f.fontSize || 10,
        page: f.box?.page ?? 0,
        bold: true,
      });

      const templateFields = [
        ...detectedFields.map(mapFieldToSave),
        ...missingFields.map((m) => ({
          key: m.key,
          systemKey: CATALOG_KEY_SET.has(m.key) ? m.key : "",
          label: m.label || m.key,
          auto: CATALOG_KEY_SET.has(m.key),
          align: "center",
          maxWidth: 130,
          fontSize: 10,
        })),
        ...customFields.map((c) => ({
          key: `custom_${c.id}`,
          systemKey: "",
          label: c.label || "Custom Field",
          auto: false,
          align: "center",
          maxWidth: 130,
          fontSize: 10,
        })),
      ];

      const folder = mode === "permit" ? "permits-templates" : "operational-forms";
      const wantPdfOriginal =
        saveOutputFormat === "original" && Boolean(effectivePdfSource);

      let fileToUpload;
      let htmlBody = "";

      if (wantPdfOriginal) {
        if (isPdfInput && selectedFile) {
          fileToUpload = selectedFile;
        } else if (convertedPdfBytes) {
          const safePdfName = `${
            (docTitle || "scanned_form")
              .replace(/[^a-zA-Z0-9_-]/g, "_")
              .slice(0, 40) || "scanned_form"
          }.pdf`;
          fileToUpload = new File([convertedPdfBytes], safePdfName, {
            type: "application/pdf",
          });
        }
      }

      if (!fileToUpload) {
        htmlBody = htmlCode || buildTemplatedHtmlBody();
        const safeHtmlName = `${
          (docTitle || "template")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 40) || "template"
        }.html`;
        fileToUpload = new File([htmlBody], safeHtmlName, {
          type: "text/html",
        });
      }

      const isSavedAsPdf =
        fileToUpload.type === "application/pdf" ||
        fileToUpload.name.toLowerCase().endsWith(".pdf");

      let uploaded = null;
      try {
        uploaded = await uploadFile(fileToUpload, folder);
      } catch (upErr) {
        console.warn("AI form upload fallback warning:", upErr?.message);
      }

      const attachmentUrl =
        uploaded?.fileUrl ||
        (isSavedAsPdf
          ? effectivePdfSource
          : `data:text/html;charset=utf-8,${encodeURIComponent(htmlBody)}`);

      const driveAttachment = {
        name: fileToUpload.name,
        fileName: uploaded?.fileName || fileToUpload.name,
        url: attachmentUrl,
        viewUrl: uploaded?.viewUrl || "",
        fileId: uploaded?.fileId || "",
        path: uploaded?.filePath || "",
        type: isSavedAsPdf ? "application/pdf" : "text/html",
        mime: isSavedAsPdf ? "application/pdf" : "text/html",
        size: uploaded?.size || fileToUpload.size || 0,
        ...(!isSavedAsPdf
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
          flightFields: templateFields.map((f) => f.key),
          attachments: [driveAttachment],
          notes: `Created via AI Scanner on ${new Date().toISOString().slice(0, 10)}`,
        });
        showToast("✅ تم حفظ نموذج التصريح المعتمد بنجاح!", "success");
      } else {
        await saveOperationalForm({
          id: `opform_ai_${Date.now()}`,
          name: docTitle || "نموذج تشغيلي ذكي",
          category: docCategory || "Dispatch",
          format: isSavedAsPdf ? "pdf" : "html",
          htmlContent: isSavedAsPdf ? "" : htmlBody,
          attachments: [driveAttachment],
          fields: templateFields,
          showInContextMenu: includeInContextMenu,
          notes: "تم التعرف الذكي على النموذج وربط حقوله تلقائياً ببيانات الرحلة",
          updatedAt: new Date().toISOString(),
        });
        showToast(
          includeInContextMenu
            ? "✅ تم حفظ النموذج وإضافته تلقائياً إلى القائمة المنسدلة للرحلة!"
            : "✅ تم حفظ النموذج التشغيلي بنجاح!",
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
      className="fixed inset-0 z-50 flex flex-col w-screen h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-card)" }}
    >
      {/* ═══ COMPACT FULL-PAGE TOP TOOLBAR ═══ */}
      <div
        className="h-12 px-3 border-b flex items-center justify-between gap-2 shrink-0 text-white"
        style={{ background: "var(--brand-gradient)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <span className="text-xs md:text-sm font-bold truncate">
            {analysisDone ? docTitle : "التعرف الذكي وتصميم النماذج (AI)"}
          </span>
          {aiSource && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 font-mono shrink-0">
              {aiSource === "gemini-ai" ? "Gemini AI" : "Smart Parse"}
            </span>
          )}
        </div>

        {/* Target Flight Selector inline */}
        {flights.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 bg-white/15 rounded-lg px-2 py-1 max-w-xs flex-1">
            <Plane className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <select
              value={selectedFlightId}
              onChange={(e) => setSelectedFlightId(e.target.value)}
              className="bg-transparent text-white text-[11px] font-mono font-bold outline-none w-full truncate [&>option]:text-slate-900"
            >
              {flights.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flightNo} · {f.dep}→{f.arr} · {f.std ? String(f.std).slice(0, 10) : ""} · {f.acft}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Top Action Strip */}
        <div className="flex items-center gap-1.5 shrink-0">
          {analysisDone && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAnalysisDone(false);
                  setSelectedFile(null);
                  setFileBase64("");
                  setConvertedPdfBase64("");
                  setConvertedPdfBytes(null);
                }}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold flex items-center gap-1 transition"
                title="نموذج جديد"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline">جديد</span>
              </button>

              <button
                type="button"
                disabled={savingTemplate}
                onClick={handleSaveAsTemplate}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50"
              >
                {savingTemplate ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>{includeInContextMenu && mode === "form" ? "حفظ للقائمة" : "حفظ"}</span>
              </button>

              {filledPdfBytes && saveOutputFormat === "original" ? (
                <button
                  type="button"
                  onClick={handleDownloadFilledPdf}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">PDF</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">HTML</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 transition"
              >
                <Printer className="w-3 h-3" />
                <span className="hidden sm:inline">طباعة</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Flight Bar */}
      {flights.length > 0 && (
        <div
          className="md:hidden px-3 py-1.5 border-b flex items-center gap-2 shrink-0"
          style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
        >
          <Plane className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          <select
            value={selectedFlightId}
            onChange={(e) => setSelectedFlightId(e.target.value)}
            className="w-full text-[11px] font-mono font-bold bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          >
            {flights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.flightNo} · {f.dep}→{f.arr} · {f.acft}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ═══ MAIN FULL-PAGE CONTENT ═══ */}
      {!analysisDone ? (
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div className="w-full max-w-xl space-y-4">
            <div
              className="flex rounded-xl p-1 border max-w-xs mx-auto"
              style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
            >
              <button
                type="button"
                onClick={() => setInputTab("file")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  inputTab === "file" ? "text-white shadow-xs" : "opacity-70"
                }`}
                style={inputTab === "file" ? { background: "var(--brand-gradient)" } : {}}
              >
                <ImageIcon className="w-3.5 h-3.5" /> صورة / PDF
              </button>
              <button
                type="button"
                onClick={() => setInputTab("html")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  inputTab === "html" ? "text-white shadow-xs" : "opacity-70"
                }`}
                style={inputTab === "html" ? { background: "var(--brand-gradient)" } : {}}
              >
                <FileCode className="w-3.5 h-3.5" /> كود HTML
              </button>
            </div>

            {inputTab === "file" ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition hover:border-sky-500 hover:bg-sky-500/5"
                style={{ borderColor: "var(--border-default)" }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.html,.htm"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-sky-500/10 text-sky-500">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-bold text-xs mb-1" style={{ color: "var(--text-primary)" }}>
                  {selectedFile ? selectedFile.name : "اختر صورة النموذج أو ملف PDF للتحليل"}
                </div>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  PNG, JPG, WEBP, PDF, HTML
                </p>
                {selectedFile && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> {(selectedFile.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
            ) : (
              <textarea
                rows={7}
                value={htmlCode}
                onChange={(e) => setHtmlCode(e.target.value)}
                placeholder="الصق كود HTML للنموذج هنا..."
                className="w-full p-2.5 rounded-xl border text-xs font-mono"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={analyzing || (!fileBase64 && !htmlCode)}
                onClick={runAiAnalysis}
                className="px-6 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 disabled:opacity-45 transition shadow-md"
                style={{ background: "var(--brand-gradient)" }}
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التحليل والربط...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>تحليل وربط تلقائي بالرحلة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={startBlankAiWorkspace}
                className="px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-sky-500/10 transition"
                style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              >
                <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                <span>إنشاء / تعديل بشات الذكاء الاصطناعي</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ═══ FULL-PAGE ORGANIZED STUDIO WORKSPACE ═══ */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* LEFT PANEL: Compact Controls, Fields & AI Chat */}
          <div
            className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0 border-e overflow-hidden"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
          >
            {/* Compact Metadata Strip */}
            <div
              className="p-2.5 border-b space-y-1.5 shrink-0"
              style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
            >
              <div className="grid grid-cols-12 gap-1.5">
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="اسم النموذج"
                  className="col-span-7 px-2 py-1 rounded-lg border text-xs font-bold"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="col-span-5 px-2 py-1 rounded-lg border text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {["Ground Ops", "Dispatch", "Handling", "Crew & GenDec", "Load & Fuel", "Safety & Security", "General"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <input
                  value={docAuthority}
                  onChange={(e) => setDocAuthority(e.target.value)}
                  placeholder="الجهة / الدولة"
                  className="flex-1 min-w-[110px] px-2 py-0.5 rounded-md border text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
                {mode === "form" && (
                  <label className="flex items-center gap-1 text-[10px] font-bold cursor-pointer px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0">
                    <input
                      type="checkbox"
                      checked={includeInContextMenu}
                      onChange={(e) => setIncludeInContextMenu(e.target.checked)}
                      className="w-3 h-3 accent-emerald-600"
                    />
                    <span>قائمة الرحلة</span>
                  </label>
                )}
              </div>
            </div>

            {/* Sub-Tab Switcher: Fields vs AI Chat */}
            <div
              className="px-2.5 py-1.5 border-b grid grid-cols-2 gap-1.5 shrink-0"
              style={{ borderColor: "var(--border-default)" }}
            >
              <button
                type="button"
                onClick={() => setLeftTab("fields")}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition border ${
                  leftTab === "fields"
                    ? "bg-sky-600 text-white border-sky-600 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>الحقول المربوطة ({detectedFields.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLeftTab("chat")}
                className={`py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition border ${
                  leftTab === "chat"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>شات الذكاء الاصطناعي</span>
              </button>
            </div>

            {/* Scrollable Body (Fields OR Chat) */}
            {leftTab === "fields" ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
                {missingFields.length > 0 && (
                  <div className="p-2 rounded-xl border bg-amber-500/5 border-amber-500/30 space-y-1.5">
                    <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>حقول يدوية ({missingFields.length})</span>
                    </div>
                    {missingFields.map((field, idx) => (
                      <div key={field.key || idx} className="grid grid-cols-12 gap-1 items-center">
                        <span className="col-span-5 text-[10px] font-bold truncate" title={field.label}>
                          {field.label}
                        </span>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateMissingField(idx, e.target.value)}
                          placeholder={field.placeholder || "أدخل..."}
                          className="col-span-7 px-2 py-0.5 rounded border text-[11px] font-mono"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-default)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10.5px] font-bold text-slate-500">
                    الحقول ({detectedFields.length})
                  </span>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="text-[10.5px] font-bold text-sky-600 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> حقل مخصص
                  </button>
                </div>

                <div className="space-y-1">
                  {detectedFields.map((field, idx) => (
                    <div
                      key={`${field.key}-${idx}`}
                      className="p-1.5 rounded-lg border space-y-1"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        borderColor: "var(--border-default)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {field.label}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] px-1 rounded font-mono ${
                              field.systemKey
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                            }`}
                          >
                            {field.systemKey || "يدوي"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDetectedField(idx)}
                            className="text-slate-400 hover:text-rose-500"
                            title="حذف الحقل"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-1">
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateDetectedField(idx, e.target.value)}
                          placeholder="القيمة..."
                          className="col-span-6 px-1.5 py-0.5 rounded border text-[11px] font-mono font-bold"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-default)",
                            color: "var(--text-primary)",
                          }}
                        />
                        <div className="col-span-6 flex items-center gap-1">
                          <Link2 className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                          <select
                            value={field.systemKey || ""}
                            onChange={(e) => updateDetectedFieldSystemKey(idx, e.target.value)}
                            className="w-full px-1 py-0.5 rounded border text-[10px]"
                            style={{
                              backgroundColor: "var(--bg-card)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <option value="">— ربط —</option>
                            {SYSTEM_DATA_CATALOG.map((cat) => (
                              <option key={cat.key} value={cat.key}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {customFields.map((cf) => (
                    <div key={cf.id} className="p-1.5 rounded-lg border bg-sky-500/5 border-sky-500/25 grid grid-cols-12 gap-1 items-center">
                      <input
                        type="text"
                        value={cf.label}
                        onChange={(e) => updateCustomField(cf.id, "label", e.target.value)}
                        placeholder="الاسم"
                        className="col-span-5 px-1.5 py-0.5 text-[11px] rounded border"
                        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
                      />
                      <input
                        type="text"
                        value={cf.value}
                        onChange={(e) => updateCustomField(cf.id, "value", e.target.value)}
                        placeholder="القيمة"
                        className="col-span-6 px-1.5 py-0.5 text-[11px] rounded border font-mono"
                        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomField(cf.id)}
                        className="col-span-1 text-rose-500 flex justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* AI CHAT ASSISTANT VIEW */
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="p-2 border-b flex items-center gap-1 overflow-x-auto shrink-0" style={{ borderColor: "var(--border-default)" }}>
                  {AI_QUICK_PROMPTS.map((q, qi) => (
                    <button
                      key={qi}
                      type="button"
                      disabled={chatLoading}
                      onClick={() => handleSendChat(q)}
                      className="px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap hover:bg-indigo-500/10 hover:border-indigo-500/40 transition shrink-0"
                      style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                    >
                      + {q}
                    </button>
                  ))}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "border bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700"
                        }`}
                        style={msg.role === "assistant" ? { color: "var(--text-primary)" } : {}}
                      >
                        <div>{msg.text}</div>
                        {msg.appliedCount > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>تم تطبيق {msg.appliedCount} أمر على النموذج</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-500 px-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>جاري تنفيذ الأمر وتحديث النموذج...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}

            {/* ALWAYS-AVAILABLE COMPACT AI COMMAND INPUT BAR */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-2 border-t flex items-center gap-1.5 shrink-0"
              style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="أمر AI: أضف حقل / عدّل / احذف / نسّق..."
                className="flex-1 px-2.5 py-1 rounded-lg border text-[11px] outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition shrink-0"
                title="تطبيق الأمر"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* RIGHT PANEL: Full-Height Document Preview */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950">
            <div
              className="h-9 px-3 border-b flex items-center justify-between gap-2 shrink-0"
              style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>
                <Eye className="w-3.5 h-3.5 text-sky-500" />
                <span>المعاينة الفورية</span>
                {activeFlight && (
                  <span className="font-mono text-sky-600 dark:text-sky-400">
                    ({activeFlight.flightNo})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {effectivePdfSource && (
                  <>
                    <div className="inline-flex rounded-md border overflow-hidden text-[10px] font-bold" style={{ borderColor: "var(--border-default)" }}>
                      <button
                        type="button"
                        onClick={() => setSaveOutputFormat("original")}
                        className={`px-2 py-0.5 transition ${
                          saveOutputFormat === "original"
                            ? "bg-sky-600 text-white"
                            : "text-slate-500 hover:bg-slate-200/60"
                        }`}
                      >
                        PDF الأصلي
                      </button>
                      <button
                        type="button"
                        onClick={() => setSaveOutputFormat("html")}
                        className={`px-2 py-0.5 transition ${
                          saveOutputFormat === "html"
                            ? "bg-sky-600 text-white"
                            : "text-slate-500 hover:bg-slate-200/60"
                        }`}
                      >
                        HTML
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMappingOriginalPdf(true)}
                      className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                    >
                      <MousePointer2 className="w-3 h-3" />
                      <span>ضبط مواضع PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-2">
              {saveOutputFormat === "original" && filledPdfUrl ? (
                <PdfCanvasViewer
                  pdfData={filledPdfUrl}
                  title="Document Preview"
                  fileName="Document_Preview.pdf"
                  maxHeight="100%"
                  className="w-full h-full min-h-[500px] rounded-lg bg-white shadow-sm"
                />
              ) : saveOutputFormat === "original" && renderingPdf ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                  <span className="text-xs text-slate-500">جاري تجهيز المعاينة...</span>
                </div>
              ) : (
                <iframe
                  title="Live Preview"
                  srcDoc={finalCompiledHtml}
                  className="w-full h-full min-h-[540px] border rounded-lg bg-white shadow-sm"
                  style={{ borderColor: "var(--border-default)" }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visual PDF Mapper Overlay Modal */}
      {mappingOriginalPdf && effectivePdfSource && (
        <PDFFieldMapper
          pdfUrl={effectivePdfSource}
          initialFields={detectedFields.map((f) => ({
            key: f.key,
            systemKey: f.systemKey || f.key,
            label: f.label || f.key,
            auto: true,
            x: f.box?.x ?? 120,
            y: f.box?.y ?? 720,
            maxWidth: f.box?.width ?? 130,
            align: f.align || "center",
            fontSize: f.fontSize || 10,
            page: f.box?.page ?? 0,
            bold: true,
          }))}
          onSave={(updatedFields) => {
            setDetectedFields((prev) =>
              prev.map((f) => {
                const match = updatedFields.find(
                  (u) => u.key === f.key || u.systemKey === f.key
                );
                return match
                  ? {
                      ...f,
                      systemKey: match.systemKey || f.systemKey,
                      box: {
                        x: match.x,
                        y: match.y,
                        width: match.maxWidth || match.width || 130,
                        height: match.height || 22,
                        page: match.page || 0,
                      },
                      align: match.align || "center",
                      fontSize: match.fontSize || 10,
                    }
                  : f;
              })
            );
            setMappingOriginalPdf(false);
            showToast("✅ تم تحديث مواضع الحقول بنجاح!", "success");
          }}
          onClose={() => setMappingOriginalPdf(false)}
        />
      )}
    </div>
  );
}

export default SmartDocumentScannerModal;
