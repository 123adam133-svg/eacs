/* ═══════════════════════════════════════════════════════════
 * PDF FIELD MAPPER — v6.0
 * 
 * تحديث آلية تعيين الحقول:
 * - أداة رسم وتحديد المربع (Drag-to-select Bounding Box) على أي خانة في المستند
 * - التحكم الكامل بأبعاد المربع (العرض، الارتفاع، الموضع X و Y)
 * - مقابض السحب والتحجيم التفاعلية (8 Resize & Move Handles)
 * - التحكم الكامل بالخط (حجم الخط، عريض، محاذاة أفقية وعمودية)
 * - محاذاة النص في وسط المربع المحدد أفقياً وعمودياً مع المعاينة الحية المباشرة
 * - إمكانية تكرار المربع لنفس المعلومة أو الحذف
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  MousePointer2,
  Square,
  Sparkles,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  Move,
  Eye,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Search,
  Maximize2,
  Layers,
} from "lucide-react";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import {
  fetchPDFBytes,
  extractPDFFormFields,
} from "../utils/pdfFiller";
import { PERMIT_FIELD_CATALOG } from "../config/permitCatalog";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/* ═══ REALISTIC SAMPLE AVIATION DATA CATALOG FOR LIVE PREVIEW ═══ */
const SAMPLE_VALUES_CATALOG = {
  flightNo: "LN-101",
  date: "2026-11-04",
  departure: "HLLB",
  departureFull: "HLLB - BENINA INTL, LIBYA",
  arrival: "HECA",
  arrivalFull: "HECA - CAIRO INTL, EGYPT",
  std: "08:30Z",
  sta: "11:45Z",
  route: "HLLB / HECA",
  altn: "HEAX / HEGN",
  flightType: "SCHEDULED PASSENGER",
  flightNature: "PAX",
  purpose: "PASSENGER OPERATIONAL FLIGHT",
  pax: "142",
  cargo: "1250 KG",
  aircraft: "5A-ONE",
  aircraftType: "B737-800",
  coaExpiry: "2027-05-15",
  insuranceExpiry: "2027-08-20",
  noiseCertExpiry: "2028-01-10",
  seatCapacity: "189",
  operatorName: "AIR LIBYA FLIGHT OPS",
  operatorNameAr: "طيران ليبيا للعمليات الجوية",
  operatorCode: "LAA",
  operatorCountry: "LIBYA",
  address: "TRIPOLI AIRPORT ROAD, TOWER 3",
  phone: "+218 91 2345678",
  fax: "+218 21 9876543",
  email: "ops@airlibya.aero",
  sita: "TIPOWLN",
  contactPerson: "CAPT. AHMAD AL-MANSOURI",
  picName: "CAPT. AHMAD AL-MANSOURI",
  picLicense: "ATPL-784920",
  picPassport: "A98765432",
  picNationality: "LIBYAN",
  foName: "FO. OMAR EL-SHARIF",
  foLicense: "CPL-654321",
  foPassport: "B12345678",
  crewCount: "6",
  crew: "PIC: Capt. Ahmad Al-Mansouri, FO: Omar El-Sharif",
  handlingAgent: "SWISSPORT GROUND HANDLING",
  // Flight 2 Samples
  flightNo_2: "LN-102",
  flightNature_2: "FERRY",
  date_2: "2026-11-04",
  departure_2: "HECA",
  departureFull_2: "HECA - CAIRO INTL, EGYPT",
  arrival_2: "HLLB",
  arrivalFull_2: "HLLB - BENINA INTL, LIBYA",
  std_2: "13:00Z",
  sta_2: "16:15Z",
  route_2: "HECA / HLLB",
  altn_2: "HLLT / HEAX",
  pax_2: "138",
  cargo_2: "1100 KG",
  aircraft_2: "5A-ONE",
  aircraftType_2: "B737-800",
  picName_2: "CAPT. AHMAD AL-MANSOURI",

  // Flight 3 Samples
  flightNo_3: "LN-201",
  flightNature_3: "PAX",
  date_3: "2026-11-05",
  departure_3: "HLLB",
  departureFull_3: "HLLB - BENINA INTL, LIBYA",
  arrival_3: "OMDB",
  arrivalFull_3: "OMDB - DUBAI INTL, UAE",
  std_3: "18:00Z",
  sta_3: "22:30Z",
  route_3: "HLLB / OMDB",
  altn_3: "OMSJ / OMDW",
  pax_3: "155",
  cargo_3: "1800 KG",
  aircraft_3: "5A-TWO",
  aircraftType_3: "A320-200",
  picName_3: "CAPT. TARIQ ZUWAY",

  // Flight 4 Samples
  flightNo_4: "LN-202",
  flightNature_4: "FERRY",
  date_4: "2026-11-06",
  departure_4: "OMDB",
  departureFull_4: "OMDB - DUBAI INTL, UAE",
  arrival_4: "HLLB",
  arrivalFull_4: "HLLB - BENINA INTL, LIBYA",
  std_4: "02:00Z",
  sta_4: "06:30Z",
  route_4: "OMDB / HLLB",
  altn_4: "HLLT / HECA",
  pax_4: "148",
  cargo_4: "1400 KG",
  aircraft_4: "5A-TWO",
  aircraftType_4: "A320-200",
  picName_4: "CAPT. TARIQ ZUWAY",

  // Combined Multi-Flight Samples
  allFlightNos: "LN-101 / LN-102",
  allFlightNatures: "LN-101: PAX | LN-102: FERRY",
  allRoutes: "HLLB → HECA → HLLB",
  allDates: "2026-11-04",
  allAircraft: "5A-ONE",
  totalPax: "280",
  totalCargo: "2350 KG",
  flightsCount: "2",
  flightsScheduleSummary: "1) LN-101: HLLB-HECA (08:30-11:45Z) | 2) LN-102: HECA-HLLB (13:00-16:15Z)",

  actualStd: "08:32Z",
  takeoff: "08:45Z",
  landing: "11:40Z",
  actualSta: "11:48Z",
  blockTime: "03:16",
  blockFuel: "8400 KG",
  fuelUsed: "6200 KG",
  fuelRemaining: "2200 KG",
  delayCode: "93 (LATE ARRIVAL)",
  status: "DEPARTED",
  preparedBy: "DISPATCHER OMAR KHAN",
  issuedDate: "2026-11-04",
  expiryDate: "2026-11-04",
};

export function getSampleValueForField(field) {
  if (!field) return "";
  const k = field.systemKey || field.key || "";
  if (SAMPLE_VALUES_CATALOG[k]) {
    return SAMPLE_VALUES_CATALOG[k];
  }
  if (field.label && field.label !== field.key) {
    return field.label;
  }
  return field.key || "بيانات المعاينة";
}

export function PDFFieldMapper({
  pdfUrl,
  initialFields = [],
  onSave,
  onClose,
}) {
  const [fields, setFields] = useState(
    Array.isArray(initialFields) ? initialFields : []
  );
  const [toolMode, setToolMode] = useState("draw"); // "draw" | "select"
  const [selectedPresetKey, setSelectedPresetKey] = useState("flightNo");
  const [customKey, setCustomKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [fontSize, setFontSize] = useState(11);
  const [bold, setBold] = useState(true);
  const [align, setAlign] = useState("center"); // "center" | "left" | "right"
  const [valign, setValign] = useState("middle"); // "middle" | "top" | "bottom"
  const [previewSampleData, setPreviewSampleData] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const [acroDetected, setAcroDetected] = useState([]);
  const [pdfRendered, setPdfRendered] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [pdfDoc, setPdfDoc] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Drawing Box State
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentDrawRect, setCurrentDrawRect] = useState(null);

  // Dragging & Resizing Box State
  const [dragAction, setDragAction] = useState(null); // null | { type: 'move'|'resize', handle: string, idx: number, startMouseX, startMouseY, startField }

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const [fieldSearch, setFieldSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const CATEGORIES = useMemo(
    () => [
      { id: "all", label: "الكل (All)" },
      { id: "flight_1", label: "الرحلة 1 (Flt 1)" },
      { id: "flight_2", label: "الرحلة 2 (Flt 2)" },
      { id: "flight_3_4", label: "الرحلات 3 و 4" },
      { id: "combined", label: "مجمعة (All Flights)" },
      { id: "nature", label: "ركاب / فيري (PAX/FERRY)" },
      { id: "crew", label: "الطاقم (Crew)" },
      { id: "acft", label: "الطائرة (Aircraft)" },
      { id: "manual", label: "يدوي (Manual)" },
    ],
    []
  );

  const filteredCatalog = useMemo(() => {
    return PERMIT_FIELD_CATALOG.filter((item) => {
      if (activeCategory === "flight_1") {
        if (!item.group.includes("Flight 1")) return false;
      } else if (activeCategory === "flight_2") {
        if (!item.group.includes("Flight 2")) return false;
      } else if (activeCategory === "flight_3_4") {
        if (!item.group.includes("Flight 3") && !item.group.includes("Flight 4"))
          return false;
      } else if (activeCategory === "combined") {
        if (!item.group.includes("Combined")) return false;
      } else if (activeCategory === "nature") {
        const k = item.key.toLowerCase();
        const l = item.label.toLowerCase();
        if (
          !k.includes("nature") &&
          !k.includes("pax") &&
          !l.includes("pax") &&
          !l.includes("ركاب") &&
          !l.includes("فيري")
        )
          return false;
      } else if (activeCategory === "crew") {
        if (!item.group.includes("Crew")) return false;
      } else if (activeCategory === "acft") {
        if (!item.group.includes("Aircraft") && !item.group.includes("CAMO"))
          return false;
      } else if (activeCategory === "manual") {
        if (!item.group.includes("Manual")) return false;
      }

      if (fieldSearch.trim()) {
        const q = fieldSearch.toLowerCase();
        const kMatch = item.key.toLowerCase().includes(q);
        const lMatch = item.label.toLowerCase().includes(q);
        const gMatch = item.group.toLowerCase().includes(q);
        return kMatch || lMatch || gMatch;
      }
      return true;
    });
  }, [activeCategory, fieldSearch]);

  const addBoxAtCenter = () => {
    const centerX = Math.round(595 / 2 - 70);
    const centerY = Math.round(842 / 2 - 12);
    commitBoxField(centerX, centerY, 140, 24);
  };


  // Sync controls with selected field
  useEffect(() => {
    if (selectedIdx !== null && fields[selectedIdx]) {
      const f = fields[selectedIdx];
      if (f.fontSize) setFontSize(Number(f.fontSize) || 11);
      if (f.bold !== undefined) setBold(Boolean(f.bold));
      if (f.align) setAlign(f.align);
      if (f.valign) setValign(f.valign);
    }
  }, [selectedIdx, fields]);

  // Load PDF with PDF.js
  // Load PDF with PDF.js
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        extractPDFFormFields(pdfUrl)
          .then((acro) => {
            if (!cancelled && acro.length > 0) {
              setAcroDetected(acro);
            }
          })
          .catch(() => {});

        const arrayBuffer = await fetchPDFBytes(pdfUrl);
        const clonedBytes = new Uint8Array(arrayBuffer.byteLength);
        clonedBytes.set(new Uint8Array(arrayBuffer));
        const loadingTask = pdfjsLib.getDocument({
          data: clonedBytes,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          try { pdf.destroy(); } catch {}
          return;
        }

        setPdfDoc((prev) => {
          if (prev && prev !== pdf) {
            try { prev.destroy(); } catch {}
          }
          return pdf;
        });
        setTotalPages(pdf.numPages);
        await renderPage(pdf, 0);
        setPdfRendered(true);
        setLoading(false);
      } catch (err) {
        console.error("PDF load error:", err);
        if (!cancelled) {
          setError("فشل تحميل ملف PDF: " + err.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  // Clean up pdfDoc on unmount
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
    };
  }, [pdfDoc]);

  const renderPage = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum + 1);
    const viewport = page.getViewport({ scale: 1.35 });
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setPageSize({ width: viewport.width, height: viewport.height });
    await page.render({ canvasContext: context, viewport }).promise;
  };

  const changePage = async (delta) => {
    const newPage = currentPage + delta;
    if (newPage < 0 || newPage >= totalPages || !pdfDoc) return;
    setCurrentPage(newPage);
    setSelectedIdx(null);
    await renderPage(pdfDoc, newPage);
  };

  // Convert mouse event coordinates on canvas container to PDF points (595x842)
  const getPdfCoordinatesFromEvent = useCallback(
    (e) => {
      if (!canvasRef.current || !pageSize.width || !pageSize.height) {
        return { x: 0, yFromTop: 0 };
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const domX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const domY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const ptX = (domX / rect.width) * 595;
      const ptYFromTop = (domY / rect.height) * 842;
      return { x: ptX, yFromTop: ptYFromTop };
    },
    [pageSize]
  );

  // Commit a newly drawn or clicked rectangle
  const commitBoxField = useCallback(
    (leftPt, topPt, widthPt, heightPt) => {
      const finalWidth = Math.max(25, Math.round(widthPt));
      const finalHeight = Math.max(12, Math.round(heightPt));
      const finalLeft = Math.max(0, Math.min(595 - finalWidth, Math.round(leftPt)));
      const finalTop = Math.max(0, Math.min(842 - finalHeight, Math.round(topPt)));

      // Bottom-up PDF Y coordinate:
      const pdfY = 842 - (finalTop + finalHeight);

      let baseSysKey = selectedPresetKey;
      let labelToUse = "";
      let autoFlag = true;

      if (selectedPresetKey === "__custom__") {
        const cleanKey = customKey.trim().replace(/\s+/g, "_");
        if (!cleanKey) {
          setError("⚠️ أدخل اسم الحقل اليدوي المخصص أولاً في القائمة الجانبية");
          return;
        }
        baseSysKey = cleanKey;
        labelToUse = customLabel.trim() || cleanKey;
        autoFlag = false;
      } else {
        const cat = PERMIT_FIELD_CATALOG.find((c) => c.key === selectedPresetKey);
        labelToUse = cat ? cat.label : selectedPresetKey;
        autoFlag = cat ? cat.auto : false;
      }

      const existingCount = fields.filter(
        (f) => f.systemKey === baseSysKey || f.key === baseSysKey
      ).length;

      const keyToUse =
        existingCount > 0
          ? `${baseSysKey}_pos_${existingCount + 1}`
          : baseSysKey;

      const newFieldObj = {
        key: keyToUse,
        systemKey: baseSysKey,
        label:
          existingCount > 0
            ? `${labelToUse} (موقع ${existingCount + 1})`
            : labelToUse,
        auto: autoFlag,
        x: finalLeft,
        y: pdfY,
        width: finalWidth,
        maxWidth: finalWidth,
        height: finalHeight,
        page: currentPage,
        fontSize: Number(fontSize) || 11,
        bold: Boolean(bold),
        align,
        valign,
        coordOrigin: "bottom",
      };

      const nextFields = [...fields, newFieldObj];
      setFields(nextFields);
      setSelectedIdx(nextFields.length - 1);
      setError("");

      // Advance to next preset key if standard
      if (selectedPresetKey !== "__custom__") {
        const currCatIdx = PERMIT_FIELD_CATALOG.findIndex(
          (c) => c.key === selectedPresetKey
        );
        if (currCatIdx >= 0 && currCatIdx + 1 < PERMIT_FIELD_CATALOG.length) {
          setSelectedPresetKey(PERMIT_FIELD_CATALOG[currCatIdx + 1].key);
        }
      }
    },
    [
      fields,
      selectedPresetKey,
      customKey,
      customLabel,
      currentPage,
      fontSize,
      bold,
      align,
      valign,
    ]
  );

  // Mouse Down on Canvas (Start Drawing Box)
  const handleCanvasMouseDown = (e) => {
    if (dragAction !== null) return;
    if (toolMode !== "draw") {
      setSelectedIdx(null);
      return;
    }

    const { x, yFromTop } = getPdfCoordinatesFromEvent(e);
    setIsDrawing(true);
    setDrawStart({ x, yFromTop });
    setCurrentDrawRect({
      left: x,
      top: yFromTop,
      width: 0,
      height: 0,
    });
  };

  // Mouse Move on Canvas Window (Drawing Box or Dragging/Resizing)
  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      // 1. Box Drawing Mode
      if (isDrawing && drawStart) {
        const { x, yFromTop } = getPdfCoordinatesFromEvent(e);
        const left = Math.min(drawStart.x, x);
        const top = Math.min(drawStart.yFromTop, yFromTop);
        const width = Math.abs(x - drawStart.x);
        const height = Math.abs(yFromTop - drawStart.yFromTop);
        setCurrentDrawRect({ left, top, width, height });
        return;
      }

      // 2. Moving / Resizing Selected Box
      if (dragAction) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scaleX = 595 / rect.width;
        const scaleY = 842 / rect.height;

        const deltaPtX = (e.clientX - dragAction.startMouseX) * scaleX;
        const deltaPtY = (e.clientY - dragAction.startMouseY) * scaleY;
        const start = dragAction.startField;
        const idx = dragAction.idx;

        setFields((prev) =>
          prev.map((f, i) => {
            if (i !== idx) return f;

            const startHeight = start.height || 22;
            const startWidth = start.width || start.maxWidth || 120;
            // start.y is bottom-up coordinate: topFromBottom = start.y + startHeight
            // In top-down deltaPtY: dragging down increases topFromTop -> decreases topFromBottom

            if (dragAction.type === "move") {
              const newLeft = Math.max(0, Math.min(595 - startWidth, Math.round(start.x + deltaPtX)));
              const newBottomY = Math.max(0, Math.min(842 - startHeight, Math.round(start.y - deltaPtY)));
              return { ...f, x: newLeft, y: newBottomY };
            }

            // Handle individual resize anchor points
            const h = dragAction.handle;
            let newX = start.x;
            let newWidth = startWidth;
            let newBottomY = start.y;
            let newHeight = startHeight;

            if (h.includes("e")) {
              newWidth = Math.max(20, Math.round(startWidth + deltaPtX));
              newWidth = Math.min(595 - newX, newWidth);
            }
            if (h.includes("w")) {
              const maxDelta = startWidth - 20;
              const appliedDelta = Math.min(maxDelta, deltaPtX);
              newX = Math.max(0, Math.round(start.x + appliedDelta));
              newWidth = Math.max(20, Math.round(startWidth - appliedDelta));
            }
            if (h.includes("s")) {
              // Dragging bottom edge downward: deltaPtY > 0 -> height increases, bottom-up y decreases
              newHeight = Math.max(12, Math.round(startHeight + deltaPtY));
              newBottomY = Math.max(0, Math.round(start.y - deltaPtY));
            }
            if (h.includes("n")) {
              // Dragging top edge upward: deltaPtY < 0 -> height increases, bottom-up y stays unchanged
              newHeight = Math.max(12, Math.round(startHeight - deltaPtY));
            }

            return {
              ...f,
              x: newX,
              y: newBottomY,
              width: newWidth,
              maxWidth: newWidth,
              height: newHeight,
            };
          })
        );
      }
    };

    const handleWindowMouseUp = (e) => {
      // 1. Commit drawn box
      if (isDrawing && drawStart) {
        setIsDrawing(false);
        const { x, yFromTop } = getPdfCoordinatesFromEvent(e);
        const left = Math.min(drawStart.x, x);
        const top = Math.min(drawStart.yFromTop, yFromTop);
        const width = Math.abs(x - drawStart.x);
        const height = Math.abs(yFromTop - drawStart.yFromTop);

        setCurrentDrawRect(null);
        setDrawStart(null);

        // If dragged significantly, use rectangle. If clicked without dragging, create standard box.
        if (width >= 15 && height >= 10) {
          commitBoxField(left, top, width, height);
        } else {
          commitBoxField(left - 60, top - 12, 120, 24);
        }
      }

      // 2. Commit move/resize
      if (dragAction) {
        setDragAction(null);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDrawing, drawStart, dragAction, getPdfCoordinatesFromEvent, commitBoxField]);

  // Start Move Drag
  const handleBoxMouseDown = (idx, e) => {
    e.stopPropagation();
    setSelectedIdx(idx);
    const field = fields[idx];
    if (!field) return;

    setDragAction({
      type: "move",
      handle: "center",
      idx,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startField: { ...field },
    });
  };

  // Start Resize Drag
  const handleResizeHandleMouseDown = (idx, handleName, e) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedIdx(idx);
    const field = fields[idx];
    if (!field) return;

    setDragAction({
      type: "resize",
      handle: handleName,
      idx,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startField: { ...field },
    });
  };

  // Nudge Selected Field Position
  const nudgeField = (dx, dy) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== selectedIdx) return f;
        const newX = Math.max(0, Math.min(595 - (f.width || 120), (f.x || 0) + dx));
        const newY = Math.max(0, Math.min(842 - (f.height || 22), (f.y || 0) + dy));
        return { ...f, x: newX, y: newY };
      })
    );
  };

  // Adjust Box Width
  const adjustFieldWidth = (delta) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== selectedIdx) return f;
        const curW = Number(f.width || f.maxWidth || 120);
        const nextW = Math.max(25, Math.min(595 - f.x, curW + delta));
        return { ...f, width: nextW, maxWidth: nextW };
      })
    );
  };

  // Adjust Box Height
  const adjustFieldHeight = (delta) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== selectedIdx) return f;
        const curH = Number(f.height || 22);
        const nextH = Math.max(12, Math.min(842 - f.y, curH + delta));
        return { ...f, height: nextH };
      })
    );
  };

  // Update Font Size
  const updateSelectedFontSize = (deltaOrVal) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== selectedIdx) return f;
        const nextSize =
          typeof deltaOrVal === "number" && deltaOrVal > 0 && deltaOrVal <= 36
            ? deltaOrVal
            : Math.max(6, Math.min(36, (f.fontSize || 11) + deltaOrVal));
        setFontSize(nextSize);
        return { ...f, fontSize: nextSize };
      })
    );
  };

  // Toggle Bold
  const toggleSelectedBold = () => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== selectedIdx) return f;
        const nextBold = !f.bold;
        setBold(nextBold);
        return { ...f, bold: nextBold };
      })
    );
  };

  // Change Alignment
  const updateSelectedAlign = (newAlign) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setAlign(newAlign);
    setFields((prev) =>
      prev.map((f, i) => (i === selectedIdx ? { ...f, align: newAlign } : f))
    );
  };

  // Change Vertical Alignment
  const updateSelectedValign = (newValign) => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    setValign(newValign);
    setFields((prev) =>
      prev.map((f, i) => (i === selectedIdx ? { ...f, valign: newValign } : f))
    );
  };

  // Duplicate Selected Field
  const duplicateSelectedField = () => {
    if (selectedIdx === null || !fields[selectedIdx]) return;
    const cur = fields[selectedIdx];
    const sysKey = cur.systemKey || cur.key;
    const instId = Date.now().toString(36).slice(-3);
    const newKey = `${sysKey}_dup_${instId}`;

    const sameCount = fields.filter((f) => f.systemKey === sysKey || f.key === sysKey).length;
    const newLabel = `${String(cur.label).replace(/\(موقع \d+\)/, "").trim()} (موقع ${sameCount + 1})`;

    const dup = {
      ...cur,
      key: newKey,
      systemKey: sysKey,
      label: newLabel,
      x: Math.min(580 - (cur.width || 120), cur.x + 12),
      y: Math.max(10, cur.y - 15),
      page: currentPage,
    };

    const next = [...fields, dup];
    setFields(next);
    setSelectedIdx(next.length - 1);
  };

  // Import detected AcroForm fields
  const importAcroFields = () => {
    const merged = [...fields];
    acroDetected.forEach((af) => {
      if (!merged.some((m) => m.acroName === af.acroName || m.key === af.key)) {
        merged.push({
          key: af.key,
          systemKey: af.key,
          acroName: af.acroName,
          label: af.label,
          auto: af.autoMatched,
          isAcro: true,
        });
      }
    });
    setFields(merged);
  };

  const removeField = (idx) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  };

  const handleSave = () => {
    onSave(fields);
  };

  const selectedField = selectedIdx !== null ? fields[selectedIdx] : null;

  return (
    <div
      className="fixed inset-0 z-[95] w-screen h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: "rgba(10, 15, 29, 0.95)" }}
      onClick={onClose}
    >
      <div
        className="w-full h-full flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ HEADER ═══ */}
        <div
          className="flex justify-between items-center px-4 py-2.5 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Square className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-sm md:text-base font-bold truncate flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <span>تحديد مواضع حقول النموذج وضبط الخط (Visual Field Box Mapper)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Maximize2 className="w-2.5 h-2.5" /> شاشة كاملة
                </span>
              </h2>
              <p
                className="text-xs truncate"
                style={{ color: "var(--text-muted)" }}
              >
                اسحب بالماوس لرسم مربع على كامل الخانة، وستظهر الكتابة في وسط المربع المحدد تماماً بالخط والمعاينة المعينة
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border transition hover:opacity-80"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ WORKSPACE BODY ═══ */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* LEFT / SIDEBAR CONTROLS */}
          <div
            className="w-full md:w-[420px] p-3.5 border-b md:border-b-0 md:border-e overflow-y-auto space-y-3.5 shrink-0"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-card)",
            }}
          >
            {/* Tool Mode Selector */}
            <div
              className="p-1 rounded-xl border flex gap-1 text-xs font-bold"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              <button
                type="button"
                onClick={() => setToolMode("draw")}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  toolMode === "draw"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                رسم مربع جديد (Draw)
              </button>
              <button
                type="button"
                onClick={() => setToolMode("select")}
                className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  toolMode === "select"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                تحريك وضبط المربع
              </button>
            </div>

            {/* Field Preset Selector with Categories & Instant Search */}
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold flex items-center gap-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Layers className="w-3.5 h-3.5 text-sky-500" />
                  المعلومة المُراد تحديد مربعها:
                </span>
                <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-bold">
                  {filteredCatalog.length} حقل متاح
                </span>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="بحث سريع (PAX, FERRY, Route, Crew...)..."
                  className="w-full ps-8 pe-7 py-1.5 text-xs rounded-lg border outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus:border-sky-500"
                />
                {fieldSearch && (
                  <button
                    type="button"
                    onClick={() => setFieldSearch("")}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pt-0.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition border ${
                      activeCategory === cat.id
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Main Field Dropdown + Direct Add to Center Button */}
              <div className="flex items-center gap-1.5">
                <Select
                  value={selectedPresetKey}
                  onChange={(e) => setSelectedPresetKey(e.target.value)}
                  className="text-xs flex-1"
                >
                  {filteredCatalog.map((it) => (
                    <option key={it.key} value={it.key}>
                      {it.auto ? "⚡ " : "✍️ "}
                      {it.label}
                    </option>
                  ))}
                  <option value="__custom__">
                    ➕ حقل يدوي مخصص آخر (Custom Field)...
                  </option>
                </Select>
                <button
                  type="button"
                  onClick={addBoxAtCenter}
                  className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold whitespace-nowrap shadow-xs flex items-center gap-1 transition"
                  title="إضافة مربع الحقل إلى مركز الصفحة مباشرة"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>

              {/* Quick Preset Chips for Faster Tap */}
              {filteredCatalog.length > 0 && (
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1 border-t border-sky-500/20">
                  {filteredCatalog.slice(0, 8).map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setSelectedPresetKey(it.key)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition border truncate max-w-[130px] ${
                        selectedPresetKey === it.key
                          ? "bg-purple-600 text-white border-purple-600 font-bold"
                          : "bg-white/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-sky-400"
                      }`}
                      title={it.label}
                    >
                      {it.key}
                    </button>
                  ))}
                </div>
              )}

              {selectedPresetKey === "__custom__" && (
                <div className="space-y-1.5 pt-1">
                  <Input
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="المفتاح بالإنجليزية (مثال: handlingAgentNote)"
                    className="text-xs"
                  />
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="عنوان الحقل للمستخدم (مثال: ملاحظة المناولة)"
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Inspector for Selected Box */}
            {selectedField ? (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5" />
                    التحكم بالمربع المحدد:
                  </span>
                  <span className="font-mono text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                    #{selectedIdx + 1}
                  </span>
                </div>

                <div
                  className="font-bold text-xs truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {selectedField.label || selectedField.key}
                </div>

                {/* Live Sample Value Box */}
                <div
                  className="p-2.5 rounded-lg border text-xs font-mono space-y-1"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block">
                    💬 عينة النص في وسط المربع:
                  </span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-center py-0.5">
                    "{getSampleValueForField(selectedField)}"
                  </div>
                </div>

                {/* Box Dimensions (Width & Height) */}
                <div className="space-y-2 pt-1 border-t border-purple-500/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      عرض المربع (Width):
                    </span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {selectedField.width || selectedField.maxWidth || 120} pt
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustFieldWidth(-10)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      -10
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustFieldWidth(-5)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min={20}
                      max={550}
                      value={selectedField.width || selectedField.maxWidth || 120}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 20;
                        setFields((prev) =>
                          prev.map((f, i) =>
                            i === selectedIdx ? { ...f, width: val, maxWidth: val } : f
                          )
                        );
                      }}
                      className="w-16 px-1.5 py-1 text-xs font-mono text-center rounded border bg-white dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => adjustFieldWidth(5)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustFieldWidth(10)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      +10
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      ارتفاع المربع (Height):
                    </span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {selectedField.height || 22} pt
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustFieldHeight(-5)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustFieldHeight(-2)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      -2
                    </button>
                    <input
                      type="number"
                      min={10}
                      max={250}
                      value={selectedField.height || 22}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 10;
                        setFields((prev) =>
                          prev.map((f, i) =>
                            i === selectedIdx ? { ...f, height: val } : f
                          )
                        );
                      }}
                      className="w-16 px-1.5 py-1 text-xs font-mono text-center rounded border bg-white dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => adjustFieldHeight(2)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      +2
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustFieldHeight(5)}
                      className="px-2 py-1 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 hover:text-white transition"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Font Size & Bold Controls */}
                <div className="space-y-2 pt-1 border-t border-purple-500/20">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 font-bold">
                      <Type className="w-3.5 h-3.5 text-purple-500" />
                      <span>حجم الخط:</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedFontSize(-1)}
                        className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 font-bold text-xs hover:bg-purple-600 hover:text-white transition"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-xs px-1">
                        {selectedField.fontSize || 11} pt
                      </span>
                      <button
                        type="button"
                        onClick={() => updateSelectedFontSize(1)}
                        className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 font-bold text-xs hover:bg-purple-600 hover:text-white transition"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedField.bold)}
                      onChange={toggleSelectedBold}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span>خط عريض (Bold)</span>
                  </label>
                </div>

                {/* Horizontal & Vertical Centering Controls */}
                <div className="space-y-2 pt-1 border-t border-purple-500/20 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">المحاذاة الأفقية:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedAlign("right")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          selectedField.align === "right"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                        title="محاذاة يمين"
                      >
                        يمين
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedAlign("center")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          (selectedField.align || "center") === "center"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                        title="وسط المربع (افتراضي)"
                      >
                        وسط
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedAlign("left")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          selectedField.align === "left"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                        title="محاذاة يسار"
                      >
                        يسار
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold">المحاذاة العمودية:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedValign("top")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          selectedField.valign === "top"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        أعلى
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedValign("middle")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          (selectedField.valign || "middle") === "middle"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        وسط (Middle)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedValign("bottom")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          selectedField.valign === "bottom"
                            ? "bg-purple-600 text-white"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        أسفل
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fine-Tuning Nudge Controls */}
                <div className="flex flex-col items-center gap-1 py-1 pt-2 border-t border-purple-500/20">
                  <span className="text-[10px] font-bold text-slate-500 mb-0.5">
                    التحريك الدقيق (Nudge):
                  </span>
                  <button
                    type="button"
                    onClick={() => nudgeField(0, 2)}
                    className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <ArrowUp className="w-3.5 h-3.5" /> أعلى (+2)
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => nudgeField(-2, 0)}
                      className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> يسار
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeField(2, 0)}
                      className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1"
                    >
                      يمين <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => nudgeField(0, -2)}
                    className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <ArrowDown className="w-3.5 h-3.5" /> أسفل (-2)
                  </button>
                </div>

                {/* Duplicate / Delete Buttons */}
                <div className="flex gap-2 pt-2 border-t border-purple-500/20">
                  <button
                    type="button"
                    onClick={duplicateSelectedField}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                    title="تكرار المربع لنفس المعلومة في موقع آخر على الصفحة"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    تكرار المربع
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(selectedIdx)}
                    className="p-1.5 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                    title="حذف هذا المربع"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="p-4 rounded-xl border border-dashed text-center text-xs space-y-1"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                <Square className="w-6 h-6 mx-auto opacity-40 text-sky-500" />
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  اسحب بالماوس لتحديد مربع الخانة
                </div>
                <p className="text-[11px] leading-relaxed">
                  أو انقر على أي خانة موجودة لضبط أبعادها وخطها وتوسيط النص بداخلها.
                </p>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-500 text-xs font-bold">
                {error}
              </div>
            )}

            {/* Mapped Fields List */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  الحقول المعينة ({fields.length})
                </span>
                {fields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFields([]);
                      setSelectedIdx(null);
                    }}
                    className="text-[10px] text-rose-500 hover:underline"
                  >
                    مسح الكل
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {fields.map((f, idx) => {
                  const isSelected = selectedIdx === idx;
                  const sampleVal = getSampleValueForField(f);
                  return (
                    <div
                      key={`${f.key}-${idx}`}
                      onClick={() => setSelectedIdx(idx)}
                      className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition border ${
                        isSelected
                          ? "bg-purple-500/20 border-purple-500 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-bold truncate flex items-center gap-1"
                          style={{ color: "var(--text-primary)" }}
                        >
                          <span>{f.auto !== false ? "⚡" : "✍️"}</span>
                          <span className="truncate">{f.label || f.key}</span>
                        </div>
                        <div className="text-[10px] font-mono text-purple-600 dark:text-purple-300 truncate">
                          "{sampleVal}" · {f.width || 120}×{f.height || 22}pt
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(idx);
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-500/20 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT / MAIN CANVAS WORKSPACE */}
          <div
            className="flex-1 overflow-auto p-4 flex flex-col items-center relative"
            style={{ backgroundColor: "var(--bg-app)" }}
            ref={canvasContainerRef}
          >
            {/* Top Toolbar */}
            <div
              className="mb-3 flex items-center justify-between gap-3 text-xs w-full max-w-3xl p-2 rounded-xl border shadow-xs flex-wrap"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
              }}
            >
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(-1)}
                    disabled={currentPage === 0}
                    className="px-3 py-1 rounded-lg border font-bold disabled:opacity-40"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    ◀ السابق
                  </button>
                  <span
                    className="font-bold font-mono"
                    style={{ color: "var(--text-primary)" }}
                  >
                    صفحة {currentPage + 1} من {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => changePage(1)}
                    disabled={currentPage === totalPages - 1}
                    className="px-3 py-1 rounded-lg border font-bold disabled:opacity-40"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    التالي ▶
                  </button>
                </div>
              ) : (
                <span
                  className="font-bold font-mono text-slate-500"
                >
                  صفحة PDF 1 من 1
                </span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewSampleData(!previewSampleData)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition ${
                    previewSampleData
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  }`}
                  title="التبديل بين معاينة عينة البيانات ومعاينة اسم الحقل"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {previewSampleData
                    ? "معاينة عينة النص الحقيقي"
                    : "عرض مسميات الحقول"}
                </button>
              </div>
            </div>

            {/* Canvas Box Drawing Container */}
            <div
              className="relative border-2 shadow-2xl inline-block bg-white select-none"
              style={{
                borderColor: toolMode === "draw" ? "#0284c7" : "var(--border-default)",
                cursor: toolMode === "draw" ? "crosshair" : "default",
              }}
              onMouseDown={handleCanvasMouseDown}
            >
              <canvas
                ref={canvasRef}
                className="block max-w-full h-auto pointer-events-none"
              />

              {/* Dynamic In-Progress Drawing Box Overlay */}
              {isDrawing && currentDrawRect && (
                <div
                  className="absolute pointer-events-none z-30"
                  style={{
                    left: `${(currentDrawRect.left / 595) * 100}%`,
                    top: `${(currentDrawRect.top / 842) * 100}%`,
                    width: `${(currentDrawRect.width / 595) * 100}%`,
                    height: `${(currentDrawRect.height / 842) * 100}%`,
                    border: "2px dashed #0284c7",
                    backgroundColor: "rgba(14, 165, 233, 0.25)",
                    borderRadius: "2px",
                  }}
                >
                  <span className="absolute -top-6 start-0 bg-sky-700 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
                    {Math.round(currentDrawRect.width)} × {Math.round(currentDrawRect.height)} pt
                  </span>
                </div>
              )}

              {/* Rendered Interactive Field Boxes */}
              {pdfRendered && pageSize.width > 0 && (
                <>
                  {fields
                    .map((f, idx) => ({ ...f, origIdx: idx }))
                    .filter((f) => !f.isAcro && (f.page || 0) === currentPage)
                    .map((f) => {
                      const boxW = Number(f.width || f.maxWidth || 120);
                      const boxH = Number(f.height || 22);

                      const leftPct = (f.x / 595) * 100;
                      // Distance from top = 842 - (f.y + boxH)
                      const topPct = ((842 - (f.y + boxH)) / 842) * 100;
                      const widthPct = (boxW / 595) * 100;
                      const heightPct = (boxH / 842) * 100;

                      const isSelected = selectedIdx === f.origIdx;

                      // Scaled font size in DOM canvas pixels
                      const rawFontSize = Number(f.fontSize) || 11;
                      const canvasScale = pageSize.height > 0 ? pageSize.height / 842 : 1;
                      const scaledFontSizePx = Math.max(8, Math.round(rawFontSize * canvasScale));

                      const displayText = previewSampleData
                        ? getSampleValueForField(f)
                        : f.label || f.key;

                      const hAlign = f.align || "center";
                      const vAlign = f.valign || "middle";

                      const justifyContent =
                        hAlign === "left"
                          ? "flex-start"
                          : hAlign === "right"
                          ? "flex-end"
                          : "center";

                      const alignItems =
                        vAlign === "top"
                          ? "flex-start"
                          : vAlign === "bottom"
                          ? "flex-end"
                          : "center";

                      return (
                        <div
                          key={`${f.key}-${f.origIdx}`}
                          onMouseDown={(e) => handleBoxMouseDown(f.origIdx, e)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIdx(f.origIdx);
                          }}
                          className={`absolute cursor-move transition-shadow ${
                            isSelected ? "z-20 ring-2 ring-purple-600" : "z-10 hover:ring-1 hover:ring-purple-400"
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                            display: "flex",
                            alignItems,
                            justifyContent,
                            textAlign: hAlign,
                            backgroundColor: isSelected
                              ? "rgba(147, 51, 234, 0.42)"
                              : f.auto !== false
                              ? "rgba(16, 185, 129, 0.32)"
                              : "rgba(245, 158, 11, 0.35)",
                            border: isSelected
                              ? "2px solid #7e22ce"
                              : f.auto !== false
                              ? "1.5px solid #059669"
                              : "1.5px solid #d97706",
                            borderRadius: "2px",
                            padding: "0 3px",
                            fontSize: `${scaledFontSizePx}px`,
                            fontFamily: "Arial, Tahoma, sans-serif",
                            fontWeight: f.bold ? "bold" : "normal",
                            color: isSelected ? "#ffffff" : "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            userSelect: "none",
                            boxShadow: isSelected
                              ? "0 4px 14px rgba(126,34,206,0.35)"
                              : "0 1px 3px rgba(0,0,0,0.1)",
                          }}
                        >
                          <span className="truncate drop-shadow-xs">
                            {displayText}
                          </span>

                          {/* 8 Interactive Resize Handles when Selected */}
                          {isSelected && (
                            <>
                              {/* Corners */}
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "nw", e)}
                                className="absolute -top-1.5 -start-1.5 w-3 h-3 bg-purple-700 border-2 border-white rounded-xs cursor-nw-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "ne", e)}
                                className="absolute -top-1.5 -end-1.5 w-3 h-3 bg-purple-700 border-2 border-white rounded-xs cursor-ne-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "se", e)}
                                className="absolute -bottom-1.5 -end-1.5 w-3 h-3 bg-purple-700 border-2 border-white rounded-xs cursor-se-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "sw", e)}
                                className="absolute -bottom-1.5 -start-1.5 w-3 h-3 bg-purple-700 border-2 border-white rounded-xs cursor-sw-resize z-30"
                              />
                              {/* Edges */}
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "n", e)}
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-purple-700 border border-white rounded-xs cursor-n-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "s", e)}
                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-2 bg-purple-700 border border-white rounded-xs cursor-s-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "e", e)}
                                className="absolute top-1/2 -translate-y-1/2 -end-1.5 w-2 h-3 bg-purple-700 border border-white rounded-xs cursor-e-resize z-30"
                              />
                              <div
                                onMouseDown={(e) => handleResizeHandleMouseDown(f.origIdx, "w", e)}
                                className="absolute top-1/2 -translate-y-1/2 -start-1.5 w-2 h-3 bg-purple-700 border border-white rounded-xs cursor-w-resize z-30"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </div>

            {loading && !error && (
              <div
                className="text-center py-12 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                جاري تحميل ملف PDF...
              </div>
            )}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div
          className="p-3 md:p-4 border-t flex flex-wrap justify-between items-center gap-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div
            className="text-xs flex items-center gap-1.5 font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              الكتابة تظهر في وسط المربع المحدد تماماً بالخط المعين، وتُحفظ كإحداثيات صندوق كامل
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition hover:opacity-80"
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
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white flex items-center gap-2 shadow-sm transition hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" /> حفظ مواضع الحقول ({fields.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PDFFieldMapper;
