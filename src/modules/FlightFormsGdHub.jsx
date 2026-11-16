/* ═══════════════════════════════════════════════════════════
 * FLIGHT FORMS & GENDEC HUB — النماذج التشغيلية والإقرار العام (GD)
 * - Select any flight (search / date / upcoming filter)
 * - Instantly displays linked GenDec (with/without stamp) + Operational & Country Forms
 * - One-click Preview, Print, and Direct PDF Download auto-populated with flight & crew data
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  Printer,
  Plane,
  Search,
  Stamp,
  FileX,
  Lock,
  Users,
  Calendar,
  Loader2,
  ClipboardList,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { Input } from "../components/ui/Input";
import { OperationalFormFillModal } from "../components/OperationalFormFillModal";
import { PermitGenerateModal } from "../components/PermitGenerateModal";
import {
  listOperationalFormsSync,
  fetchOperationalForms,
} from "../utils/operationalFormsService";
import { permitTemplatesAPI, toPreviewFileUrl } from "../api";
import {
  previewGenDec,
  printGenDec,
  downloadGenDec,
  downloadMultiGenDec,
} from "../utils/gendecHTML";
import {
  buildSystemAutoData,
  recognizeHtmlTemplateFields,
  fillHtmlTemplate,
  buildPrintableHtmlDocument,
} from "../utils/htmlTemplateEngine";
import { fillPermitPDF, downloadPDF } from "../utils/pdfFiller";
import { getCountryFromAirport } from "../config/airportCountries";
import { can as checkPerm } from "../config/permissions";
import { todayISO, safeArray } from "../utils/helpers";
import { showToast } from "../utils/dialog";

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

const innerStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

export function FlightFormsGdHub({
  flights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user = null,
  lang = "ar",
  previewMode = false,
  initialFlightId = null,
}) {
  const isAr = lang === "ar";

  const [opForms, setOpForms] = useState(() => listOperationalFormsSync());
  const [permitTemplates, setPermitTemplates] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);

  const [flightSearch, setFlightSearch] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState("all"); // all | today | custom
  const [customDate, setCustomDate] = useState(todayISO());
  const [selectedFlightId, setSelectedFlightId] = useState(
    initialFlightId ? String(initialFlightId) : ""
  );

  const [formSearch, setFormSearch] = useState("");
  const [formKindFilter, setFormKindFilter] = useState("all"); // all | operational | permits

  const [busyKey, setBusyKey] = useState("");
  const [activeOpFormModal, setActiveOpFormModal] = useState(null);
  const [activePermitModal, setActivePermitModal] = useState(null);

  const canGenDecStamp =
    previewMode ||
    checkPerm(user, "schedule.gendec_stamp") ||
    checkPerm(user, "portal.print_with_stamp");
  const canGenDecNoStamp =
    previewMode ||
    checkPerm(user, "schedule.gendec_no_stamp") ||
    checkPerm(user, "portal.print_without_stamp") ||
    checkPerm(user, "portal.flight_forms");
  const canAnyGenDec =
    canGenDecStamp ||
    canGenDecNoStamp ||
    checkPerm(user, "schedule.gendec_view") ||
    checkPerm(user, "portal.flight_forms");
  const canViewForms =
    previewMode ||
    checkPerm(user, "portal.flight_forms") ||
    checkPerm(user, "portal.flight_forms_download") ||
    checkPerm(user, "forms.view");
  const canDownloadForms =
    previewMode ||
    checkPerm(user, "portal.flight_forms_download") ||
    checkPerm(user, "forms.print_with_stamp") ||
    checkPerm(user, "forms.print_without_stamp") ||
    checkPerm(user, "forms.edit");

  useEffect(() => {
    if (initialFlightId) {
      setSelectedFlightId(String(initialFlightId));
    }
  }, [initialFlightId]);

  useEffect(() => {
    let mounted = true;
    setLoadingForms(true);
    Promise.all([
      fetchOperationalForms().catch(() => listOperationalFormsSync()),
      permitTemplatesAPI.list().catch(() => []),
    ])
      .then(([ops, perms]) => {
        if (!mounted) return;
        setOpForms(Array.isArray(ops) ? ops : listOperationalFormsSync());
        setPermitTemplates(Array.isArray(perms) ? perms : []);
      })
      .finally(() => {
        if (mounted) setLoadingForms(false);
      });

    const onSync = () => setOpForms(listOperationalFormsSync());
    window.addEventListener("aeroops:forms-updated", onSync);
    return () => {
      mounted = false;
      window.removeEventListener("aeroops:forms-updated", onSync);
    };
  }, []);

  const filteredFlights = useMemo(() => {
    const q = flightSearch.trim().toLowerCase();
    const today = todayISO();
    return [...(flights || [])]
      .sort((a, b) => String(b.std || "").localeCompare(String(a.std || "")))
      .filter((f) => {
        const fDate = f.std ? String(f.std).slice(0, 10) : "";
        if (dateFilterMode === "today" && fDate !== today) return false;
        if (dateFilterMode === "custom" && customDate && fDate !== customDate) {
          return false;
        }
        if (!q) return true;
        return `${f.flightNo || ""} ${f.dep || ""} ${f.arr || ""} ${f.acft || ""}`
          .toLowerCase()
          .includes(q);
      });
  }, [flights, flightSearch, dateFilterMode, customDate]);

  useEffect(() => {
    if (
      (!selectedFlightId || !flights.some((f) => String(f.id) === String(selectedFlightId))) &&
      filteredFlights.length > 0
    ) {
      setSelectedFlightId(String(filteredFlights[0].id));
    }
  }, [filteredFlights, flights, selectedFlightId]);

  const selectedFlight = useMemo(
    () =>
      (flights || []).find((f) => String(f.id) === String(selectedFlightId)) ||
      filteredFlights[0] ||
      null,
    [flights, filteredFlights, selectedFlightId]
  );

  // Extract all sectors + countries for selectedFlight
  const flightSummary = useMemo(() => {
    if (!selectedFlight) {
      return { sectors: [], countries: new Set(), crewList: [] };
    }
    const legs = Array.isArray(selectedFlight.legs) ? selectedFlight.legs : [];
    const sectors = [
      {
        dep: selectedFlight.dep || "",
        arr: selectedFlight.arr || "",
        std: selectedFlight.std ? String(selectedFlight.std).slice(11, 16) : "",
        sta: selectedFlight.sta ? String(selectedFlight.sta).slice(11, 16) : "",
        date: selectedFlight.std ? String(selectedFlight.std).slice(0, 10) : "",
      },
      ...legs.map((l) => ({
        dep: l.dep || "",
        arr: l.arr || "",
        std: l.std ? String(l.std).slice(11, 16) : "",
        sta: l.sta ? String(l.sta).slice(11, 16) : "",
        date: l.date || (l.std ? String(l.std).slice(0, 10) : ""),
      })),
    ];

    const countries = new Set();
    sectors.forEach((s) => {
      const cDep = getCountryFromAirport(s.dep);
      const cArr = getCountryFromAirport(s.arr);
      if (cDep?.country) countries.add(String(cDep.country).toLowerCase());
      if (cArr?.country) countries.add(String(cArr.country).toLowerCase());
    });

    const crewList = safeArray(selectedFlight.crewSlots)
      .map((s) => {
        const m = (crew || []).find((c) => String(c.id) === String(s.crewId));
        return m ? { position: s.position, member: m } : null;
      })
      .filter(Boolean);

    return { sectors, countries, crewList };
  }, [selectedFlight, crew]);

  // Unified list of operational forms + country permit templates
  const combinedForms = useMemo(() => {
    const opsItems = (opForms || []).map((f) => ({
      uid: `op:${f.id}`,
      kind: "operational",
      raw: f,
      name: f.name || "Operational Form",
      category: f.category || "Ground Ops",
      format:
        f.format === "pdf" ||
        (f.attachments || []).some(
          (a) =>
            a.type === "application/pdf" ||
            String(a.name || "").toLowerCase().endsWith(".pdf")
        )
          ? "PDF"
          : "HTML",
      routeMatched: false,
      notes: f.notes || "",
    }));

    const permitItems = (permitTemplates || []).map((tpl) => {
      const cLower = String(tpl.country || "").toLowerCase();
      const matched =
        cLower &&
        Array.from(flightSummary.countries).some(
          (fc) => fc.includes(cLower) || cLower.includes(fc)
        );
      return {
        uid: `perm:${tpl.id}`,
        kind: "permits",
        raw: tpl,
        name: tpl.name || `${tpl.country || ""} Permit`,
        category: tpl.country ? `${tpl.country} · ${tpl.type || "PERMIT"}` : tpl.type || "PERMIT",
        format:
          tpl.format === "pdf" ||
          (tpl.attachments || []).some(
            (a) =>
              a.type === "application/pdf" ||
              String(a.name || "").toLowerCase().endsWith(".pdf")
          )
            ? "PDF"
            : "HTML",
        routeMatched: Boolean(matched),
        notes: tpl.notes || "",
      };
    });

    const q = formSearch.trim().toLowerCase();
    return [...opsItems, ...permitItems]
      .filter((item) => {
        if (formKindFilter !== "all" && item.kind !== formKindFilter) return false;
        if (!q) return true;
        return `${item.name} ${item.category} ${item.notes}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (a.routeMatched !== b.routeMatched) return a.routeMatched ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === "operational" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [opForms, permitTemplates, flightSummary.countries, formSearch, formKindFilter]);

  /* ═══ GenDec Actions ═══ */
  const handleGenDecDownload = async (showStamp) => {
    if (!selectedFlight) return;
    if (showStamp && !canGenDecStamp) return;
    if (!showStamp && !canGenDecNoStamp) return;
    const key = showStamp ? "gd_stamp" : "gd_nostamp";
    setBusyKey(key);
    try {
      const hasMulti =
        Array.isArray(selectedFlight.legs) && selectedFlight.legs.length > 0;
      if (hasMulti) {
        await downloadMultiGenDec([selectedFlight], crew, settings, {
          showStamp,
        });
      } else {
        await downloadGenDec(selectedFlight, crew, settings, { showStamp });
      }
    } finally {
      setBusyKey("");
    }
  };

  /* ═══ Direct Form Download Helper (PDF or HTML -> A4 PDF) ═══ */
  const handleDirectFormDownload = async (item) => {
    if (!selectedFlight || !canDownloadForms) return;
    setBusyKey(item.uid);
    try {
      const tpl = item.raw;
      const autoData = buildSystemAutoData({
        flight: selectedFlight,
        selectedFlights: [selectedFlight],
        fleet,
        camoList,
        crew,
        settings,
        user,
      });

      const safeTitle = String(item.name || "Form").replace(
        /[^\w\u0600-\u06FF-]+/g,
        "_"
      );
      const fileName = `${safeTitle}_${selectedFlight.flightNo || "Flight"}.pdf`;

      const pdfAtt = (tpl.attachments || []).find(
        (a) =>
          a.type === "application/pdf" ||
          String(a.name || "").toLowerCase().endsWith(".pdf")
      );

      if (item.format === "PDF" && pdfAtt?.url) {
        const coordFields = Array.isArray(tpl.pdfFields)
          ? tpl.pdfFields
          : Array.isArray(tpl.fields)
          ? tpl.fields.filter((f) => typeof f.xPct === "number")
          : [];
        const acroMappings = {};
        (tpl.fields || []).forEach((f) => {
          if (f.acroName && f.systemKey) acroMappings[f.acroName] = f.systemKey;
        });
        if (tpl.acroMappings && typeof tpl.acroMappings === "object") {
          Object.assign(acroMappings, tpl.acroMappings);
        }

        const bytes = await fillPermitPDF(
          pdfAtt.url,
          coordFields,
          autoData,
          acroMappings,
          { stampUrl: "" }
        );
        downloadPDF(bytes, fileName);
        showToast(
          isAr ? `تم تحميل ${item.name}` : `Downloaded ${item.name}`,
          "success"
        );
        return;
      }

      // Resolve HTML source
      let htmlSource = tpl.htmlContent || "";
      if (!htmlSource) {
        const htmlAtt = (tpl.attachments || []).find(
          (a) =>
            a.isHtml ||
            a.type === "text/html" ||
            a.mime === "text/html" ||
            /\.html?$/i.test(String(a.name || ""))
        );
        if (htmlAtt?.htmlContent) {
          htmlSource = htmlAtt.htmlContent;
        } else if (htmlAtt?.url && htmlAtt.url.startsWith("data:text/html")) {
          const commaIdx = htmlAtt.url.indexOf(",");
          if (commaIdx >= 0) {
            htmlSource = decodeURIComponent(htmlAtt.url.slice(commaIdx + 1));
          }
        } else if (htmlAtt?.url && htmlAtt.url !== "[Data URL - Local Only]") {
          const res = await fetch(toPreviewFileUrl(htmlAtt.url, htmlAtt.name));
          if (res.ok) htmlSource = await res.text();
        }
      }

      if (!htmlSource) {
        // Fallback: open modal if template needs setup
        if (item.kind === "operational") {
          setActiveOpFormModal(tpl);
        } else {
          setActivePermitModal(tpl);
        }
        return;
      }

      const { annotatedHtml, fields: autoFields } =
        recognizeHtmlTemplateFields(htmlSource);
      const effectiveFields =
        Array.isArray(tpl.fields) && tpl.fields.length > 0
          ? tpl.fields
          : autoFields;

      const filledHtml = fillHtmlTemplate(annotatedHtml, effectiveFields, autoData, {
        highlightEmpty: false,
      });
      const fullDoc = buildPrintableHtmlDocument(
        filledHtml,
        `${item.name} — ${selectedFlight.flightNo || ""}`,
        { stampUrl: "" }
      );

      const jspdfModule = await import("jspdf");
      const html2canvasModule = await import("html2canvas");
      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;border:0;visibility:hidden;background:#fff;";
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(fullDoc);
      iframe.contentDocument.close();
      await new Promise((r) => setTimeout(r, 700));

      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      document.body.removeChild(iframe);

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pdfW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, imgH);
      let yOffset = 0;
      let remaining = imgH - pdfH;
      while (remaining > 5) {
        yOffset -= pdfH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, yOffset, pdfW, imgH);
        remaining -= pdfH;
      }
      pdf.save(fileName);
      showToast(
        isAr ? `تم تحميل ${fileName}` : `Downloaded ${fileName}`,
        "success"
      );
    } catch (err) {
      console.error("Form download error:", err);
      showToast(
        (isAr ? "تعذر التحميل: " : "Download failed: ") + (err?.message || err),
        "error"
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="w-full p-2 md:p-4 space-y-3" style={{ color: "var(--text-primary)" }}>
      {/* ═══ HEADER ═══ */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
        style={cardStyle}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: "var(--brand-gradient)" }}
          >
            <ClipboardList className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-bold truncate">
              {isAr ? "النماذج والإقرار العام (Forms & GenDec)" : "Flight Forms & GenDec Hub"}
            </h1>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "اختر الرحلة لعرض جميع النماذج التشغيلية والإقرار العام معبأة تلقائياً وجاهزة للتحميل"
                : "Select a flight to preview and download auto-filled operational forms & GenDec"}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {filteredFlights.length} {isAr ? "رحلة" : "flights"} · {combinedForms.length}{" "}
          {isAr ? "نموذج" : "forms"}
        </div>
      </div>

      {/* ═══ SPLIT WORKSPACE: FLIGHT PICKER (LEFT) + GENDEC & FORMS (RIGHT) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* LEFT COLUMN: FLIGHT SELECTION */}
        <div className="lg:col-span-4 rounded-xl p-3 space-y-2.5" style={cardStyle}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-sky-500" />
              <span>{isAr ? "اختر الرحلة" : "Select Flight"}</span>
            </span>
            <div className="flex items-center gap-1 text-[11px]">
              {[
                { id: "all", label: isAr ? "الكل" : "All" },
                { id: "today", label: isAr ? "اليوم" : "Today" },
                { id: "custom", label: isAr ? "تاريخ" : "Date" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDateFilterMode(m.id)}
                  className={`px-2 py-1 rounded-md font-semibold transition ${
                    dateFilterMode === m.id
                      ? "bg-sky-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {dateFilterMode === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
            <Input
              value={flightSearch}
              onChange={(e) => setFlightSearch(e.target.value)}
              placeholder={isAr ? "بحث برقم الرحلة أو المطار أو الطائرة..." : "Search flight, airport, reg..."}
              className="ps-8 h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5 max-h-[62vh] overflow-y-auto pe-0.5">
            {filteredFlights.length === 0 ? (
              <div className="py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                {isAr ? "لا توجد رحلات مطابقة" : "No matching flights"}
              </div>
            ) : (
              filteredFlights.map((f) => {
                const isSelected = selectedFlight && String(selectedFlight.id) === String(f.id);
                const legsCount = Array.isArray(f.legs) ? f.legs.length : 0;
                const crewCnt = safeArray(f.crewSlots).filter((s) => s.crewId).length;
                const fDate = f.std ? String(f.std).slice(0, 10) : "—";
                const stdT = f.std ? String(f.std).slice(11, 16) : "";
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFlightId(String(f.id))}
                    className={`w-full p-2.5 rounded-lg border text-start transition ${
                      isSelected ? "ring-1 ring-sky-500" : "hover:border-sky-400"
                    }`}
                    style={{
                      backgroundColor: isSelected ? "rgba(14,165,233,0.08)" : "var(--bg-app)",
                      borderColor: isSelected ? "#0ea5e9" : "var(--border-default)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-mono">
                        {f.flightNo || "—"} · {f.dep || "—"} → {f.arr || "—"}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {f.acft || "—"}
                      </span>
                    </div>
                    <div
                      className="text-[11px] font-mono mt-0.5 flex items-center gap-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{fDate} {stdT ? `${stdT}Z` : ""}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {1 + legsCount} {isAr ? "سكتر" : "sec"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {crewCnt} {isAr ? "طاقم" : "crew"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: GENDEC + OPERATIONAL & COUNTRY FORMS */}
        <div className="lg:col-span-8 space-y-3">
          {!selectedFlight ? (
            <div
              className="rounded-xl p-10 text-center text-xs"
              style={{ ...cardStyle, color: "var(--text-muted)" }}
            >
              {isAr
                ? "اختر رحلة من القائمة لعرض النماذج والإقرار العام"
                : "Select a flight from the list to view its GenDec & forms"}
            </div>
          ) : (
            <>
              {/* SELECTED FLIGHT SUMMARY */}
              <div className="rounded-xl p-3 space-y-2" style={cardStyle}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={innerStyle}
                    >
                      <Plane className="w-4 h-4 text-sky-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold font-mono truncate">
                        {selectedFlight.flightNo} —{" "}
                        {flightSummary.sectors.map((s) => `${s.dep}→${s.arr}`).join(" / ")}
                      </div>
                      <div
                        className="text-[11px] font-mono flex flex-wrap items-center gap-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span>
                          {selectedFlight.std ? String(selectedFlight.std).slice(0, 10) : "—"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{selectedFlight.acft || "—"}</span>
                        <span aria-hidden="true">·</span>
                        <span>PAX: {selectedFlight.pax ?? 0}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {flightSummary.crewList.length}{" "}
                          {isAr ? "طاقم معيّن" : "crew assigned"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {flightSummary.crewList.length > 0 && (
                  <div
                    className="pt-2 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                  >
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                      {isAr ? "الطاقم:" : "Crew:"}
                    </span>
                    {flightSummary.crewList.map((c, idx) => (
                      <span key={idx} className="font-mono">
                        <strong style={{ color: "var(--text-primary)" }}>
                          {c.position}:
                        </strong>{" "}
                        {c.member.fullName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* GENDEC CARD */}
              <div className="rounded-xl p-3 space-y-2.5" style={cardStyle}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={innerStyle}
                    >
                      <Stamp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <h2 className="text-xs md:text-sm font-bold">
                        {isAr
                          ? "الإقرار العام (General Declaration — GenDec)"
                          : "General Declaration (GenDec — ICAO Annex 9)"}
                      </h2>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {isAr
                          ? `يتم توليد صفحة لكل قطاع (${flightSummary.sectors.length} ${
                              flightSummary.sectors.length > 1 ? "سكترات" : "سكتر"
                            }) مع قائمة الطاقم تلقائياً`
                          : `Auto-generates 1 page per sector (${flightSummary.sectors.length} sector(s)) with assigned crew`}
                      </p>
                    </div>
                  </div>
                </div>

                {!canAnyGenDec ? (
                  <div
                    className="p-2.5 rounded-lg text-xs flex items-center gap-2 border"
                    style={{ ...innerStyle, color: "var(--text-muted)" }}
                  >
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      {isAr
                        ? "ليس لديك صلاحية عرض أو تحميل الإقرار العام"
                        : "You do not have permission to view or download GenDec"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!canGenDecStamp && !canGenDecNoStamp}
                      onClick={() =>
                        previewGenDec(selectedFlight, crew, settings, {
                          showStamp: canGenDecStamp,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-45"
                      style={innerStyle}
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-500" />
                      <span>{isAr ? "معاينة" : "Preview"}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canGenDecStamp || busyKey === "gd_stamp"}
                      onClick={() => handleGenDecDownload(true)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition disabled:opacity-45"
                    >
                      {busyKey === "gd_stamp" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isAr ? "تحميل PDF بالختم الرسمي" : "Download PDF (Stamped)"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!canGenDecNoStamp || busyKey === "gd_nostamp"}
                      onClick={() => handleGenDecDownload(false)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-800 text-white flex items-center gap-1.5 transition disabled:opacity-45"
                    >
                      {busyKey === "gd_nostamp" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileX className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isAr ? "تحميل PDF بدون ختم" : "Download PDF (No Stamp)"}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!canGenDecStamp && !canGenDecNoStamp}
                      onClick={() =>
                        printGenDec(selectedFlight, crew, settings, {
                          showStamp: canGenDecStamp,
                        })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-45"
                      style={innerStyle}
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{isAr ? "طباعة" : "Print"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* LINKED OPERATIONAL & COUNTRY FORMS */}
              {canViewForms && (
                <div className="rounded-xl p-3 space-y-2.5" style={cardStyle}>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={innerStyle}
                      >
                        <FileText className="w-4 h-4 text-sky-500" />
                      </div>
                      <div>
                        <h2 className="text-xs md:text-sm font-bold">
                          {isAr
                            ? `النماذج المربوطة بالرحلة (${combinedForms.length})`
                            : `Flight-Linked Forms (${combinedForms.length})`}
                        </h2>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {isAr
                            ? "تُعبّأ جميع الحقول ببيانات الرحلة والطاقم والطائرة المختارة تلقائياً"
                            : "All fields auto-populate from selected flight, aircraft & crew"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={innerStyle}>
                        {[
                          { id: "all", label: isAr ? "الكل" : "All" },
                          { id: "operational", label: isAr ? "تشغيلية" : "Operational" },
                          { id: "permits", label: isAr ? "تصاريح الدول" : "Permits" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFormKindFilter(tab.id)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                              formKindFilter === tab.id
                                ? "bg-sky-600 text-white"
                                : "text-slate-500 dark:text-slate-300"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative w-48">
                        <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
                        <Input
                          value={formSearch}
                          onChange={(e) => setFormSearch(e.target.value)}
                          placeholder={isAr ? "بحث في النماذج..." : "Filter forms..."}
                          className="ps-8 h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {loadingForms ? (
                    <div className="py-10 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                      <span>{isAr ? "جاري تحميل النماذج..." : "Loading forms..."}</span>
                    </div>
                  ) : combinedForms.length === 0 ? (
                    <div className="py-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                      {isAr
                        ? "لا توجد نماذج مضافة حتى الآن — يمكنك إضافتها من التصاريح والنماذج"
                        : "No forms configured yet"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {combinedForms.map((item) => {
                        const isDownloading = busyKey === item.uid;
                        return (
                          <div
                            key={item.uid}
                            className="p-2.5 rounded-xl border flex flex-col justify-between gap-2"
                            style={innerStyle}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                                style={{
                                  backgroundColor: "var(--bg-card)",
                                  borderColor: "var(--border-default)",
                                }}
                              >
                                {item.kind === "permits" ? (
                                  <Globe className="w-4 h-4 text-indigo-500" />
                                ) : (
                                  <FileText className="w-4 h-4 text-sky-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">
                                  {item.name}
                                </div>
                                <div
                                  className="text-[11px] truncate flex items-center gap-1.5 mt-0.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <span>{item.category}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono">{item.format}</span>
                                  {item.routeMatched && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" />
                                        {isAr ? "مطابق للمسار" : "Route Match"}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-1.5 pt-1 border-t" style={{ borderColor: "var(--border-default)" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  item.kind === "operational"
                                    ? setActiveOpFormModal(item.raw)
                                    : setActivePermitModal(item.raw)
                                }
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition hover:opacity-90"
                                style={{
                                  backgroundColor: "var(--bg-card)",
                                  borderColor: "var(--border-default)",
                                  color: "var(--text-primary)",
                                }}
                              >
                                <Eye className="w-3.5 h-3.5 text-sky-500" />
                                <span>{isAr ? "معاينة وتعديل" : "Preview / Edit"}</span>
                              </button>

                              <button
                                type="button"
                                disabled={!canDownloadForms || isDownloading}
                                onClick={() => handleDirectFormDownload(item)}
                                title={
                                  canDownloadForms
                                    ? isAr
                                      ? "تحميل PDF"
                                      : "Download PDF"
                                    : isAr
                                    ? "مقفل: يتطلب صلاحية تحميل النماذج"
                                    : "Locked: requires download permission"
                                }
                                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1 transition disabled:opacity-45"
                              >
                                {isDownloading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : !canDownloadForms ? (
                                  <Lock className="w-3.5 h-3.5" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>{isAr ? "تحميل PDF" : "Download PDF"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* MODALS */}
      {activeOpFormModal && selectedFlight && (
        <OperationalFormFillModal
          form={activeOpFormModal}
          flight={selectedFlight}
          selectedFlights={[selectedFlight]}
          flights={flights}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setActiveOpFormModal(null)}
        />
      )}

      {activePermitModal && selectedFlight && (
        <PermitGenerateModal
          template={activePermitModal}
          availableTemplates={permitTemplates}
          flight={selectedFlight}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setActivePermitModal(null)}
        />
      )}
    </div>
  );
}

export default FlightFormsGdHub;
