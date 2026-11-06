/* ═══════════════════════════════════════════════════════════
 * OPERATIONAL FORM FILL MODAL — معاينة وطباعة النماذج التشغيلية المربوطة بالرحلة
 * Opened from FlightContextMenu (ScheduleBoard) or FormsModule:
 * - Auto-fills linked system fields from Flight, Legs, JL, Aircraft/CAMO, Crew & Settings
 * - Displays ONLY:
 *   1) Live & Full Preview (المعاينة)
 *   2) Print action (الطباعة)
 *   3) Input fields ONLY for empty/unfilled slots based on the stored form template
 * - If all stored fields are populated (or there are no empty fields to fill),
 *   hides the input sidebar completely and shows ONLY Preview & Print.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  X,
  FileText,
  Printer,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  PenLine,
  Plane,
  Plus,
  ChevronDown,
  Check,
} from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { PdfCanvasViewer } from "./ui/PdfCanvasViewer";
import {
  SYSTEM_DATA_CATALOG,
  buildSystemAutoData,
  recognizeHtmlTemplateFields,
  fillHtmlTemplate,
  buildPrintableHtmlDocument,
} from "../utils/htmlTemplateEngine";
import {
  fillPermitPDF,
  openPDF,
  extractPDFFormFields,
} from "../utils/pdfFiller";
import { toPreviewFileUrl } from "../api";
import { showToast, printHTMLContent, openPreviewModal } from "../utils/dialog";

const CATALOG_MAP = new Map(SYSTEM_DATA_CATALOG.map((c) => [c.key, c]));
const NON_TEXT_SYSTEM_KEYS = new Set([
  "crewTableHtml",
  "sectorsTableHtml",
  "logoUrl",
]);

function printPdfBytesIframeSafe(pdfBytes, fallbackTitle) {
  if (typeof document === "undefined") return;
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  iframe.src = blobUrl;

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      URL.revokeObjectURL(blobUrl);
    }, 15000);
  };

  iframe.onload = () => {
    setTimeout(() => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          cleanup();
        } else {
          cleanup();
          openPDF(pdfBytes, fallbackTitle);
        }
      } catch {
        cleanup();
        openPDF(pdfBytes, fallbackTitle);
      }
    }, 350);
  };

  document.body.appendChild(iframe);
}

export function OperationalFormFillModal({
  form,
  flight: initialFlight,
  selectedFlights: initialSelectedFlights = [],
  flights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user = null,
  onClose,
}) {
  const [selectedFlightIds, setSelectedFlightIds] = useState(() => {
    if (Array.isArray(initialSelectedFlights) && initialSelectedFlights.length > 0) {
      return initialSelectedFlights.map((f) => f.id);
    }
    return initialFlight?.id ? [initialFlight.id] : [];
  });

  const [flightPickerOpen, setFlightPickerOpen] = useState(false);

  const selectedFlights = useMemo(() => {
    if (!selectedFlightIds || selectedFlightIds.length === 0) {
      return initialFlight ? [initialFlight] : [];
    }
    const resolved = selectedFlightIds
      .map(
        (id) =>
          (flights || []).find((f) => f.id === id) ||
          (initialFlight?.id === id ? initialFlight : null)
      )
      .filter(Boolean);
    return resolved.length > 0
      ? resolved
      : initialFlight
      ? [initialFlight]
      : [];
  }, [selectedFlightIds, flights, initialFlight]);

  const activeFlight = selectedFlights[0] || initialFlight || null;
  const pdfIframeRef = useRef(null);

  const toggleFlightSelection = (flightToToggle) => {
    if (!flightToToggle?.id) return;
    setSelectedFlightIds((prev) => {
      if (prev.includes(flightToToggle.id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== flightToToggle.id);
      }
      return [...prev, flightToToggle.id];
    });
  };

  const systemAutoData = useMemo(() => {
    const base = buildSystemAutoData({
      flight: activeFlight,
      selectedFlights,
      fleet,
      camoList,
      crew,
      settings,
      user,
    });
    return base;
  }, [activeFlight, selectedFlights, fleet, camoList, crew, settings, user]);

  const [manualInputs, setManualInputs] = useState({});

  useEffect(() => {
    setManualInputs({});
  }, [form?.id, activeFlight?.id, selectedFlightIds.join(",")]);

  const isPdfForm = useMemo(() => {
    if (form?.format === "pdf") return true;
    return (form?.attachments || []).some(
      (a) =>
        a.type === "application/pdf" ||
        String(a.name || "").toLowerCase().endsWith(".pdf")
    );
  }, [form]);

  const pdfAttachment = useMemo(
    () =>
      (form?.attachments || []).find(
        (a) =>
          a.type === "application/pdf" ||
          String(a.name || "").toLowerCase().endsWith(".pdf")
      ),
    [form]
  );

  const [remoteHtmlRaw, setRemoteHtmlRaw] = useState("");

  useEffect(() => {
    if (isPdfForm || form?.htmlContent) {
      setRemoteHtmlRaw("");
      return;
    }
    const htmlAtt = (form?.attachments || []).find(
      (a) =>
        a.isHtml ||
        a.type === "text/html" ||
        a.mime === "text/html" ||
        /\.html?$/i.test(String(a.name || ""))
    );
    if (
      !htmlAtt ||
      htmlAtt.htmlContent ||
      !htmlAtt.url ||
      String(htmlAtt.url).startsWith("data:") ||
      htmlAtt.url === "[Data URL - Local Only]"
    ) {
      setRemoteHtmlRaw("");
      return;
    }
    let cancelled = false;
    fetch(toPreviewFileUrl(htmlAtt.url, htmlAtt.name))
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        if (!cancelled && txt) setRemoteHtmlRaw(txt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form, isPdfForm]);

  const htmlSource = useMemo(() => {
    if (form?.htmlContent) return form.htmlContent;
    const htmlAtt = (form?.attachments || []).find(
      (a) =>
        a.isHtml ||
        a.type === "text/html" ||
        a.mime === "text/html" ||
        /\.html?$/i.test(String(a.name || ""))
    );
    if (htmlAtt?.htmlContent) return htmlAtt.htmlContent;
    if (htmlAtt?.url && htmlAtt.url.startsWith("data:text/html")) {
      try {
        const commaIdx = htmlAtt.url.indexOf(",");
        if (commaIdx >= 0) {
          const raw = htmlAtt.url.slice(commaIdx + 1);
          return decodeURIComponent(raw);
        }
      } catch {}
    }
    if (remoteHtmlRaw) return remoteHtmlRaw;
    return "";
  }, [form, remoteHtmlRaw]);

  // Resolve HTML template & strictly adhere to stored form.fields when defined
  const htmlBundle = useMemo(() => {
    if (isPdfForm || !htmlSource) return { annotatedHtml: "", fields: [] };
    const { annotatedHtml, fields: autoFields } =
      recognizeHtmlTemplateFields(htmlSource);

    if (Array.isArray(form?.fields)) {
      const resolvedSaved = form.fields.map((sf) => {
        const matchedAuto = autoFields.find(
          (af) =>
            (sf.token && af.token === sf.token) ||
            (sf.slotId && af.slotId === sf.slotId) ||
            af.key === sf.key ||
            (sf.rawLabel && af.rawLabel === sf.rawLabel)
        );
        return matchedAuto
          ? {
              ...matchedAuto,
              ...sf,
              slotId: sf.slotId || matchedAuto.slotId,
              token: sf.token || matchedAuto.token,
            }
          : sf;
      });
      return { annotatedHtml, fields: resolvedSaved };
    }

    return { annotatedHtml, fields: autoFields };
  }, [isPdfForm, htmlSource, form?.fields]);

  // PDF AcroForm & live preview state
  const [acroFields, setAcroFields] = useState([]);
  const [filledPdfUrl, setFilledPdfUrl] = useState("");
  const [filledPdfBytes, setFilledPdfBytes] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState("");

  useEffect(() => {
    if (!isPdfForm || !pdfAttachment?.url) return;
    let cancelled = false;
    extractPDFFormFields(pdfAttachment.url)
      .then((detected) => {
        if (!cancelled) setAcroFields(detected);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPdfForm, pdfAttachment?.url]);

  const storedPdfFields = useMemo(() => {
    if (!isPdfForm) return [];
    if (Array.isArray(form?.fields)) return form.fields;
    return acroFields;
  }, [isPdfForm, form?.fields, acroFields]);

  const coordinatePdfFields = useMemo(
    () =>
      storedPdfFields.filter(
        (f) => f && f.x !== undefined && f.y !== undefined && !f.isAcro
      ),
    [storedPdfFields]
  );

  const effectiveAcroMappings = useMemo(() => {
    if (!isPdfForm) return [];
    if (Array.isArray(form?.fields) && form.fields.length > 0) {
      const fromSaved = form.fields
        .filter((f) => f?.acroName)
        .map((f) => ({
          acroName: f.acroName,
          key: f.systemKey || f.key,
        }));
      if (fromSaved.length > 0) return fromSaved;
    }
    return acroFields;
  }, [isPdfForm, form?.fields, acroFields]);

  const activeTemplateFields = isPdfForm ? storedPdfFields : htmlBundle.fields;

  // Compute ONLY empty/unfilled fields that require user entry according to stored form
  const { emptyFieldsToFill, manualOnlyKeys } = useMemo(() => {
    const seen = new Map();
    const manualKeys = new Set();

    (activeTemplateFields || []).forEach((f) => {
      if (!f) return;
      const rawSysKey = f.systemKey || "";
      const rawKey = f.key || "";
      const candidateKey = rawSysKey || rawKey;
      if (!candidateKey || NON_TEXT_SYSTEM_KEYS.has(candidateKey)) return;

      const catBySys = rawSysKey ? CATALOG_MAP.get(rawSysKey) : null;
      const catByKey = !catBySys && rawKey ? CATALOG_MAP.get(rawKey) : null;
      const catalogItem = catBySys || catByKey || null;

      const resolvedCatalogKey = catalogItem ? catalogItem.key : "";
      const sysVal = resolvedCatalogKey
        ? systemAutoData[resolvedCatalogKey]
        : "";
      const hasNonEmptySysVal =
        sysVal !== undefined &&
        sysVal !== null &&
        String(sysVal).trim() !== "" &&
        String(sysVal).trim() !== "—";

      const isExplicitlyUnlinked =
        f.auto === false && (!rawSysKey || !catBySys);

      if (isExplicitlyUnlinked) {
        if (rawKey) manualKeys.add(rawKey);
        if (rawSysKey && !catBySys) manualKeys.add(rawSysKey);
      }

      const isPopulatedFromSystem =
        !isExplicitlyUnlinked &&
        Boolean(resolvedCatalogKey) &&
        (f.auto !== false || hasNonEmptySysVal) &&
        hasNonEmptySysVal;

      if (isPopulatedFromSystem) return;

      const targetKey = resolvedCatalogKey || rawSysKey || rawKey;
      if (!seen.has(targetKey)) {
        const cleanLabel = String(
          f.label || f.rawLabel || catalogItem?.label || targetKey
        )
          .replace(/\(موقع\s*\d+\)/g, "")
          .trim();

        seen.set(targetKey, {
          key: targetKey,
          rawKey,
          rawLabel: f.rawLabel || "",
          label: cleanLabel || targetKey,
        });
      }
    });

    return {
      emptyFieldsToFill: Array.from(seen.values()),
      manualOnlyKeys: manualKeys,
    };
  }, [activeTemplateFields, systemAutoData]);

  const formData = useMemo(() => {
    const merged = { ...systemAutoData };
    manualOnlyKeys.forEach((k) => {
      merged[k] = "";
    });
    Object.entries(manualInputs).forEach(([k, v]) => {
      merged[k] = v;
    });
    return merged;
  }, [systemAutoData, manualOnlyKeys, manualInputs]);

  const handleManualFieldChange = (item, value) => {
    setManualInputs((prev) => {
      const next = { ...prev, [item.key]: value };
      if (item.rawKey && item.rawKey !== item.key) {
        next[item.rawKey] = value;
      }
      if (
        item.rawLabel &&
        item.rawLabel !== item.key &&
        !CATALOG_MAP.has(item.rawLabel)
      ) {
        next[item.rawLabel] = value;
      }
      return next;
    });
  };

  const refreshPdfPreview = useCallback(async () => {
    if (!isPdfForm || !pdfAttachment?.url) return;
    setGeneratingPdf(true);
    setPdfPreviewError("");
    try {
      const bytes = await fillPermitPDF(
        pdfAttachment.url,
        coordinatePdfFields,
        formData,
        effectiveAcroMappings,
        { stampUrl: "" }
      );
      setFilledPdfBytes(bytes);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const nextUrl = URL.createObjectURL(blob);
      setFilledPdfUrl((prev) => {
        if (prev) setTimeout(() => URL.revokeObjectURL(prev), 1000);
        return nextUrl;
      });
    } catch (e) {
      console.warn("Operational form PDF preview warning:", e);
      setPdfPreviewError(e.message || "فشل إعداد معاينة ملف PDF المعبأ");
    } finally {
      setGeneratingPdf(false);
    }
  }, [
    isPdfForm,
    pdfAttachment?.url,
    coordinatePdfFields,
    formData,
    effectiveAcroMappings,
  ]);

  useEffect(() => {
    if (!isPdfForm || !pdfAttachment?.url) return;
    const t = setTimeout(refreshPdfPreview, 350);
    return () => clearTimeout(t);
  }, [isPdfForm, pdfAttachment?.url, refreshPdfPreview]);

  useEffect(() => {
    return () => {
      if (filledPdfUrl) URL.revokeObjectURL(filledPdfUrl);
    };
  }, [filledPdfUrl]);

  const hasEmptyFields = emptyFieldsToFill.length > 0;

  const filledHtmlPreviewDoc = useMemo(() => {
    if (isPdfForm || !htmlBundle.annotatedHtml) return "";
    const filled = fillHtmlTemplate(
      htmlBundle.annotatedHtml,
      htmlBundle.fields,
      formData,
      { highlightEmpty: hasEmptyFields }
    );
    return buildPrintableHtmlDocument(
      filled,
      `${form?.name || "Form"} — ${formData.flightNo || ""}`,
      { stampUrl: "" }
    );
  }, [isPdfForm, htmlBundle, formData, form?.name, hasEmptyFields]);

  const getCleanHtmlDoc = useCallback(() => {
    if (isPdfForm || !htmlBundle.annotatedHtml) return "";
    const filled = fillHtmlTemplate(
      htmlBundle.annotatedHtml,
      htmlBundle.fields,
      formData,
      { highlightEmpty: false }
    );
    return buildPrintableHtmlDocument(
      filled,
      `${form?.name || "Form"} — ${formData.flightNo || ""}`,
      { stampUrl: "" }
    );
  }, [isPdfForm, htmlBundle, formData, form?.name]);

  const handleOpenFullPreview = async () => {
    const docTitle = `${form?.name || "نموذج تشغيلي"} — ${
      formData.flightNo || ""
    }`;
    if (isPdfForm && pdfAttachment?.url) {
      try {
        const bytes =
          filledPdfBytes ||
          (await fillPermitPDF(
            pdfAttachment.url,
            coordinatePdfFields,
            formData,
            effectiveAcroMappings,
            { stampUrl: "" }
          ));
        openPDF(bytes, docTitle);
      } catch (err) {
        showToast("❌ تعذر فتح معاينة ملف PDF: " + err.message, "error");
      }
      return;
    }

    const cleanDoc = getCleanHtmlDoc();
    if (cleanDoc) {
      openPreviewModal({
        title: docTitle,
        html: cleanDoc,
      });
    }
  };

  const handlePrint = async () => {
    const docTitle = `${form?.name || "Form"} — ${formData.flightNo || ""}`;
    if (isPdfForm && pdfAttachment?.url) {
      try {
        if (
          !generatingPdf &&
          filledPdfUrl &&
          pdfIframeRef.current?.contentWindow
        ) {
          try {
            pdfIframeRef.current.contentWindow.focus();
            pdfIframeRef.current.contentWindow.print();
            return;
          } catch {
            // Fall through to fresh blob iframe print
          }
        }
        const bytes =
          filledPdfBytes ||
          (await fillPermitPDF(
            pdfAttachment.url,
            coordinatePdfFields,
            formData,
            effectiveAcroMappings,
            { stampUrl: "" }
          ));
        printPdfBytesIframeSafe(bytes, docTitle);
      } catch (err) {
        showToast("❌ تعذر طباعة ملف PDF: " + err.message, "error");
      }
      return;
    }

    const cleanDoc = getCleanHtmlDoc();
    if (cleanDoc) {
      printHTMLContent(
        cleanDoc,
        `${form?.name || "Form"}_${formData.flightNo || "Flight"}`
      );
    }
  };

  const filledEmptyCount = useMemo(
    () =>
      emptyFieldsToFill.filter((f) =>
        Boolean(String(formData[f.key] ?? "").trim())
      ).length,
    [emptyFieldsToFill, formData]
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-2 md:p-4 backdrop-blur-xs"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className={`rounded-2xl w-full ${
          hasEmptyFields ? "max-w-6xl" : "max-w-5xl"
        } h-[92vh] flex flex-col overflow-hidden shadow-2xl border`}
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER: Title + Flight Summary + ONLY Preview & Print ═══ */}
        <div
          className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base md:text-lg font-bold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {form?.name || "نموذج تشغيلي"}
              </h2>
              <div
                className="text-xs font-mono tabular-nums truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {activeFlight ? (
                  <>
                    {formData.flightNo || activeFlight.flightNo || "—"} ·{" "}
                    {formData.departure || activeFlight.dep || "—"} →{" "}
                    {formData.arrival || activeFlight.arr || "—"}
                    {formData.aircraft ? ` · ${formData.aircraft}` : ""}
                    {formData.date ? ` · ${formData.date}` : ""}
                  </>
                ) : (
                  "معاينة النموذج التشغيلي"
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">

            <button
              type="button"
              onClick={handleOpenFullPreview}
              disabled={isPdfForm && generatingPdf && !filledPdfUrl}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Eye className="w-4 h-4 text-sky-500" />
              المعاينة
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isPdfForm && generatingPdf && !filledPdfBytes}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border transition hover:opacity-80"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═══ MULTI-FLIGHT SELECTOR BAR ═══ */}
        {flights && flights.length > 0 && (
          <div
            className="px-4 py-2 border-b flex items-center justify-between flex-wrap gap-2 text-xs shrink-0"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span
                className="font-bold flex items-center gap-1.5 shrink-0"
                style={{ color: "var(--text-primary)" }}
              >
                <Plane className="w-3.5 h-3.5 text-sky-500" />
                الرحلات المرتبطة بالنموذج:
              </span>

              {selectedFlights.map((flt, idx) => (
                <span
                  key={flt.id || idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-xs shadow-xs"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--brand-primary, #0ea5e9)",
                    color: "var(--text-primary)",
                  }}
                >
                  <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <span>{flt.flightNo}</span>
                  <span className="text-slate-400 font-normal">
                    ({flt.dep} → {flt.arr})
                  </span>
                  {selectedFlights.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleFlightSelection(flt)}
                      className="p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 transition"
                      title="إزالة هذه الرحلة من النموذج"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}

              {/* Add Flight Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFlightPickerOpen((v) => !v)}
                  className="px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 transition hover:opacity-90 shadow-xs"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>تحديد / إضافة رحلة أخرى</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {flightPickerOpen && (
                  <div
                    className="absolute z-50 top-full mt-1 start-0 min-w-[280px] max-h-64 overflow-y-auto rounded-xl border shadow-2xl p-1.5 space-y-1"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      اختر الرحلات لعرض بياناتها على النموذج:
                    </div>
                    {flights.map((f) => {
                      const isSelected = selectedFlightIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFlightSelection(f)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-start transition ${
                            isSelected
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-300 font-bold"
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold">{f.flightNo}</span>
                            <span className="text-[11px] text-slate-400 truncate">
                              {f.dep} → {f.arr} · {f.acft || ""}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-sky-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {selectedFlights.length === 1
                ? "رحلة واحدة معينة"
                : `${selectedFlights.length} رحلات معينة على النموذج`}
            </span>
          </div>
        )}

        {/* ═══ BODY: Conditional Empty Fields + Live Preview ═══ */}
        <div
          className={`flex-1 overflow-hidden ${
            hasEmptyFields
              ? "grid grid-cols-1 lg:grid-cols-12"
              : "flex flex-col"
          }`}
        >
          {/* EMPTY FIELDS PANEL — Rendered ONLY when emptyFieldsToFill.length > 0 */}
          {hasEmptyFields && (
            <div
              className="lg:col-span-4 overflow-y-auto p-4 space-y-3 border-b lg:border-b-0 lg:border-e"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
              }}
            >
              <div
                className="flex items-center justify-between gap-2 pb-2.5 border-b"
                style={{ borderColor: "var(--border-default)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <PenLine className="w-4 h-4 text-amber-500 shrink-0" />
                  <h3
                    className="text-sm font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    الخانات المطلوب تعبئتها
                  </h3>
                </div>
                <span
                  className="text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-md border shrink-0"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color:
                      filledEmptyCount === emptyFieldsToFill.length
                        ? "#16a34a"
                        : "#d97706",
                  }}
                >
                  {filledEmptyCount}/{emptyFieldsToFill.length}
                </span>
              </div>

              <div className="space-y-3">
                {emptyFieldsToFill.map((f) => {
                  const val = formData[f.key] ?? "";
                  const isFilled = Boolean(String(val).trim());
                  return (
                    <Field
                      key={f.key}
                      label={
                        <span className="inline-flex items-center gap-1.5">
                          {isFilled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                          <span>{f.label}</span>
                        </span>
                      }
                    >
                      <Input
                        value={val}
                        onChange={(e) =>
                          handleManualFieldChange(f, e.target.value)
                        }
                        placeholder={`أدخل ${f.label}...`}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIVE PREVIEW AREA — Full width when no empty fields exist */}
          <div
            className={`${
              hasEmptyFields ? "lg:col-span-8" : "w-full flex-1"
            } flex flex-col overflow-hidden`}
            style={{ backgroundColor: "var(--bg-app)" }}
          >
            <div
              className="px-4 py-2 border-b flex items-center justify-between gap-2"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
              }}
            >
              <span
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <Eye className="w-3.5 h-3.5 text-sky-500" />
                المعاينة
              </span>

              {isPdfForm && (
                <button
                  type="button"
                  onClick={refreshPdfPreview}
                  disabled={generatingPdf}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 whitespace-nowrap shrink-0 transition hover:opacity-90 disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <RefreshCw
                    className={`w-3 h-3 ${generatingPdf ? "animate-spin" : ""}`}
                  />
                  تحديث المعاينة
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden p-2 flex flex-col min-h-0">
              {isPdfForm ? (
                filledPdfUrl || filledPdfBytes ? (
                  <PdfCanvasViewer
                    pdfData={filledPdfUrl || filledPdfBytes}
                    title={`${form?.name || "معاينة النموذج"} — ${formData.flightNo || ""}`}
                    fileName={`${form?.name || "Form"}_${formData.flightNo || "Flight"}.pdf`}
                    onPrint={handlePrint}
                    maxHeight="100%"
                    className="w-full h-full min-h-[500px]"
                  />
                ) : pdfPreviewError ? (
                  <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-3 p-6 text-center bg-rose-500/10 rounded-xl border border-rose-500/30">
                    <AlertTriangle className="w-10 h-10 text-rose-500" />
                    <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {pdfPreviewError}
                    </div>
                    <button
                      type="button"
                      onClick={refreshPdfPreview}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> إعادة إعداد المعاينة
                    </button>
                  </div>
                ) : (
                  <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-2">
                    <Loader2
                      className="w-8 h-8 animate-spin"
                      style={{ color: "var(--brand-primary)" }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      جاري تجهيز المعاينة...
                    </span>
                  </div>
                )
              ) : filledHtmlPreviewDoc ? (
                <iframe
                  title="Operational HTML Form Preview"
                  srcDoc={filledHtmlPreviewDoc}
                  className="w-full h-full min-h-[520px] rounded-xl border bg-white shadow-sm"
                  style={{ borderColor: "var(--border-default)" }}
                />
              ) : (
                <div
                  className="h-full flex items-center justify-center text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  لا يوجد محتوى للمعاينة
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperationalFormFillModal;
