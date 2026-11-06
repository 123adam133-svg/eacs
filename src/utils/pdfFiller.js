/* ═══════════════════════════════════════════════════════════
 * PDF FILLER & SMART PERMIT AUTO-FILL ENGINE — v4.0
 * - Auto-fills from Flight + Fleet/CAMO + Crew + Settings
 * - Auto-detects & maps AcroForm fields
 * - Supports Coordinate-mapped fields with Arabic + English rendering
 * ═══════════════════════════════════════════════════════════ */
import { API_URL } from "../api";
import { findAirport } from "../airports";
import { openPreviewModal } from "./dialog";

/* ═══════════════════════════════════════════════════════════
 * MASTER FIELD CATALOG FOR PERMIT TEMPLATES
 * ═══════════════════════════════════════════════════════════ */
import { PERMIT_FIELD_CATALOG } from "../config/permitCatalog";

/**
 * Heuristic matcher to map AcroForm PDF field names automatically to our known keys
 */
export function smartMatchAcroFieldKey(rawName) {
  const n = String(rawName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return null;

  // Extract index if present (e.g. flightno2, flight_2, leg2)
  const numMatch = String(rawName || "").match(/(\d+)/);
  const idx = numMatch ? numMatch[1] : "";
  const suffix = idx && idx !== "1" ? `_${idx}` : "";

  if (n.includes("callsign") || n.includes("flightno") || n.includes("flightnum") || n.startsWith("fltno")) return `flightNo${suffix}`;
  if (n.includes("registration") || n.includes("acreg") || n.includes("regmark") || n === "reg" || n === "acft") return `aircraft${suffix}`;
  if (n.includes("aircrafttype") || n.includes("actype") || n.includes("typeofac") || n === "type") return `aircraftType${suffix}`;
  if (n.includes("operatorcode") || n.includes("icaocode")) return "operatorCode";
  if (n.includes("operatorname") || n.includes("aircarrier") || n === "operator") return "operatorName";
  if (n.includes("departure") || n.includes("origin") || n.includes("adep") || n.includes("dep") || n.includes("from")) return `departure${suffix}`;
  if (n.includes("arrival") || n.includes("destination") || n.includes("ades") || n.includes("arr") || n.includes("to")) return `arrival${suffix}`;
  if (n.includes("route") || n.includes("sector") || n.includes("routing")) return `route${suffix}`;
  if (n.includes("std") || n.includes("etd") || n.includes("deptime")) return `std${suffix}`;
  if (n.includes("sta") || n.includes("eta") || n.includes("arrtime")) return `sta${suffix}`;
  if (n.includes("dof") || n.includes("flightdate") || n.includes("dateofflight") || n === "date") return `date${suffix}`;
  if (n.includes("alternate") || n.includes("altn")) return `altn${suffix}`;
  if (n.includes("purpose") || n.includes("natureofflight")) return `purpose${suffix}`;
  if (n.includes("coa") || n.includes("airworthiness")) return "coaExpiry";
  if (n.includes("insurance")) return "insuranceExpiry";
  if (n.includes("noise")) return "noiseCertExpiry";
  if (n.includes("seat") || n.includes("capacity")) return "seatCapacity";
  if (n.includes("pax") || n.includes("passenger")) return `pax${suffix}`;
  if (n.includes("cargo") || n.includes("freight")) return `cargo${suffix}`;
  if (n.includes("pic") || n.includes("captain") || n.includes("commander")) return `picName${suffix}`;
  if (n.includes("license") || n.includes("licence")) return "picLicense";
  if (n.includes("passport")) return "picPassport";
  if (n.includes("handling")) return "handlingAgent";
  if (n.includes("entrypoint") || n.includes("firentry")) return "entryPoint";
  if (n.includes("exitpoint") || n.includes("firexit")) return "exitPoint";
  if (n.includes("sita")) return "sita";
  if (n.includes("fax")) return "fax";
  if (n.includes("phone") || n.includes("tel")) return "phone";
  if (n.includes("email")) return "email";
  if (n.includes("address")) return "address";

  return null;
}

/**
 * Helper to extract flight parameters for a specific flight leg / index
 */
function extractSingleFlightData(f, idx, fleet, camoList, crew, settings, isPrimary = false) {
  if (!f) return {};
  const regNorm = String(f?.acft || "").trim().toUpperCase();
  const fleetAcft = (fleet || []).find(
    (a) => String(a.reg || "").trim().toUpperCase() === regNorm
  );
  const camoAcft = (camoList || []).find(
    (c) => String(c.reg || "").trim().toUpperCase() === regNorm
  );

  const depAp = findAirport(f?.dep);
  const arrAp = findAirport(f?.arr);

  const resolvedCrew = (f?.crewSlots || [])
    .map((s) => {
      const m = (crew || []).find((c) => String(c.id) === String(s.crewId));
      return m ? { slot: s, member: m } : null;
    })
    .filter(Boolean);

  const picEntry =
    resolvedCrew.find(
      (x) =>
        x.slot.position === "captain" ||
        x.slot.position === "PIC" ||
        x.member.role === "captain"
    ) || resolvedCrew[0];

  const pic = picEntry?.member || null;

  const flightDate = f?.std
    ? String(f.std).slice(0, 10)
    : "";

  const depFull = depAp
    ? `${f?.dep} - ${depAp.city}, ${depAp.country}`
    : f?.dep || "";

  const arrFull = arrAp
    ? `${f?.arr} - ${arrAp.city}, ${arrAp.country}`
    : f?.arr || "";

  const stdTime = f?.std ? String(f.std).slice(11, 16) + "Z" : "";
  const staTime = f?.sta ? String(f.sta).slice(11, 16) + "Z" : "";

  const routeStr = f?.dep && f?.arr ? `${f.dep}/${f.arr}` : "";
  const altnStr = [f?.altn, f?.altn2].filter(Boolean).join(" / ");
  const rawPax = f?.actual?.pax ?? f?.pax;
  const paxStr = rawPax !== undefined && rawPax !== null && rawPax !== "" ? String(rawPax) : "";
  const rawCargo = f?.actual?.cargo ?? f?.cargo;
  const cargoStr = rawCargo !== undefined && rawCargo !== null && rawCargo !== "" ? String(rawCargo) : "";
  const acftType = fleetAcft?.type || camoAcft?.type || settings?.aircraftType || "";
  const flightNature = f?.flightNature || f?.nature || (Number(rawPax) > 0 ? "PAX" : (f?.flightType === "CARGO" ? "CARGO" : "FERRY"));

  const suffix = idx > 1 ? `_${idx}` : "";
  const out = {
    [`flightNo${suffix}`]: f?.flightNo || "",
    [`flightNature${suffix}`]: flightNature,
    [`date${suffix}`]: flightDate,
    [`departure${suffix}`]: f?.dep || "",
    [`dep${suffix}`]: f?.dep || "",
    [`departureFull${suffix}`]: depFull,
    [`arrival${suffix}`]: f?.arr || "",
    [`arr${suffix}`]: f?.arr || "",
    [`arrivalFull${suffix}`]: arrFull,
    [`std${suffix}`]: stdTime,
    [`sta${suffix}`]: staTime,
    [`route${suffix}`]: routeStr,
    [`altn${suffix}`]: altnStr,
    [`pax${suffix}`]: paxStr,
    [`cargo${suffix}`]: cargoStr,
    [`aircraft${suffix}`]: f?.acft || "",
    [`acft${suffix}`]: f?.acft || "",
    [`aircraftType${suffix}`]: acftType,
    [`picName${suffix}`]: pic?.fullName || "",
    [`status${suffix}`]: f?.status || "",
  };

  // If Flight 1 and primary, also populate non-suffixed keys if not already defined
  if (isPrimary) {
    out.flightNo = f?.flightNo || "";
    out.flightNature = flightNature;
    out.date = flightDate;
    out.departure = f?.dep || "";
    out.departureFull = depFull;
    out.arrival = f?.arr || "";
    out.arrivalFull = arrFull;
    out.std = stdTime;
    out.sta = staTime;
    out.route = routeStr;
    out.altn = altnStr;
    out.pax = paxStr;
    out.cargo = cargoStr;
    out.aircraft = f?.acft || "";
    out.aircraftType = acftType;
    out.picName = pic?.fullName || "";
    out.flightType = f?.flightType || "SCHEDULED PASSENGER";
    out.purpose = f?.notes || f?.flightType || "PASSENGER OPERATIONAL FLIGHT";
  }

  return out;
}

/**
 * Builds complete auto-filled data object from Flight + Fleet/CAMO + Crew + Settings
 * Supports multiple selected flights (selectedFlights: [f1, f2, f3, f4])
 */
export function buildPermitAutoData({
  flight,
  selectedFlights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
}) {
  const flightList =
    Array.isArray(selectedFlights) && selectedFlights.length > 0
      ? selectedFlights
      : flight
      ? [flight]
      : [];

  const f1 = flightList[0] || flight || null;
  const f2 = flightList[1] || f1?.legs?.[0] || null;
  const f3 = flightList[2] || f1?.legs?.[1] || null;
  const f4 = flightList[3] || f1?.legs?.[2] || null;

  const regNorm = String(f1?.acft || "").trim().toUpperCase();
  const fleetAcft = (fleet || []).find(
    (a) => String(a.reg || "").trim().toUpperCase() === regNorm
  );
  const camoAcft = (camoList || []).find(
    (c) => String(c.reg || "").trim().toUpperCase() === regNorm
  );

  const depAp = findAirport(f1?.dep);
  const arrAp = findAirport(f1?.arr);

  // Build full sectors string including multi-sector legs
  const sectorParts = [];
  flightList.forEach((flt) => {
    if (flt?.dep || flt?.arr) {
      const t1 = flt?.std ? String(flt.std).slice(11, 16) + "Z" : "";
      const t2 = flt?.sta ? String(flt.sta).slice(11, 16) + "Z" : "";
      sectorParts.push(
        `${flt.dep || ""}/${flt.arr || ""}${t1 ? ` (${t1}-${t2})` : ""}`
      );
    }
    if (Array.isArray(flt?.legs)) {
      flt.legs.forEach((leg) => {
        if (leg?.dep || leg?.arr) {
          const lt1 = leg?.std ? String(leg.std).slice(11, 16) + "Z" : "";
          const lt2 = leg?.sta ? String(leg.sta).slice(11, 16) + "Z" : "";
          sectorParts.push(
            `${leg.dep || ""}/${leg.arr || ""}${lt1 ? ` (${lt1}-${lt2})` : ""}`
          );
        }
      });
    }
  });

  // Crew & Captain (PIC) from flight 1
  const resolvedCrew = (f1?.crewSlots || [])
    .map((s) => {
      const m = (crew || []).find((c) => String(c.id) === String(s.crewId));
      return m ? { slot: s, member: m } : null;
    })
    .filter(Boolean);

  const picEntry =
    resolvedCrew.find(
      (x) =>
        x.slot.position === "captain" ||
        x.slot.position === "PIC" ||
        x.member.role === "captain"
    ) || resolvedCrew[0];

  const pic = picEntry?.member || null;

  const flightDate = f1?.std
    ? String(f1.std).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Default realistic fallback values
  const fallbackFlightNo = "LN-101";
  const fallbackDep = "HLLB";
  const fallbackArr = "HECA";
  const fallbackAcft = "5A-ONE";
  const fallbackAcftType = "B737-800";
  const fallbackPicName = "CAPT. AHMAD AL-MANSOURI";
  const fallbackHandling = "SWISSPORT GROUND HANDLING";

  // Multi-flight per-sector data (Flight 1..4)
  const f1Data = extractSingleFlightData(f1, 1, fleet, camoList, crew, settings, true);
  const f2Data = extractSingleFlightData(f2, 2, fleet, camoList, crew, settings, false);
  const f3Data = extractSingleFlightData(f3, 3, fleet, camoList, crew, settings, false);
  const f4Data = extractSingleFlightData(f4, 4, fleet, camoList, crew, settings, false);

  // Aggregated multi-flight calculations
  const allFlightNos = flightList.length > 0
    ? flightList.map((f) => f.flightNo).filter(Boolean).join(" / ")
    : f1?.flightNo || fallbackFlightNo;

  const allRoutes = flightList.length > 0
    ? flightList.map((f) => `${f.dep || ""} → ${f.arr || ""}`).filter(Boolean).join(" / ")
    : sectorParts.join(" , ") || `${fallbackDep} → ${fallbackArr}`;

  const allDates = [...new Set(flightList.map((f) => (f.std ? String(f.std).slice(0, 10) : "")))].filter(Boolean).join(" / ") || flightDate;
  const allAircraft = [...new Set(flightList.map((f) => f.acft))].filter(Boolean).join(" / ") || (f1?.acft || fallbackAcft);

  const totalPaxNum = flightList.reduce((sum, f) => {
    const raw = f.actual?.pax ?? f.pax;
    return sum + (Number(raw) || 0);
  }, 0);
  const totalPax = totalPaxNum > 0 ? String(totalPaxNum) : (f1?.pax ? String(f1.pax) : "142");

  const totalCargoNum = flightList.reduce((sum, f) => {
    const raw = f.actual?.cargo ?? f.cargo;
    return sum + (Number(raw) || 0);
  }, 0);
  const totalCargo = totalCargoNum > 0 ? `${totalCargoNum} KG` : (f1?.cargo ? `${f1.cargo} KG` : "1250 KG");

  const flightsCount = String(flightList.length || 1);

  const flightsScheduleSummary = flightList.length > 0
    ? flightList
        .map(
          (f, idx) =>
            `${idx + 1}) ${f.flightNo || "FLT"}: ${f.dep || ""}-${f.arr || ""} (${
              f.std ? String(f.std).slice(11, 16) : ""
            }Z-${f.sta ? String(f.sta).slice(11, 16) : ""}Z)`
        )
        .join(" | ")
    : `${fallbackFlightNo}: ${fallbackDep}-${fallbackArr} (08:30Z-11:45Z)`;

  const allFlightNatures = flightList.length > 0
    ? flightList
        .map(
          (f, idx) =>
            `${f.flightNo || `Leg ${idx + 1}`}: ${
              f.flightNature || f.nature || (Number(f.pax) > 0 ? "PAX" : "FERRY")
            }`
        )
        .join(" | ")
    : "PAX";

  return {
    ...f1Data,
    ...f2Data,
    ...f3Data,
    ...f4Data,

    // Aggregated multi-flight fields
    allFlightNos,
    allFlightNatures,
    allRoutes,
    allDates,
    allAircraft,
    totalPax,
    totalCargo,
    flightsCount,
    flightsScheduleSummary,

    // When multiple flights are selected, also update general fields for forms that only mapped flightNo or route
    ...(flightList.length > 1
      ? {
          flightNo: allFlightNos,
          route: allRoutes,
          pax: totalPax,
          cargo: totalCargo,
        }
      : {}),

    // Base fallback & operator information
    date: flightDate,
    departure: f1?.dep || fallbackDep,
    departureFull: depAp
      ? `${f1?.dep} - ${depAp.city}, ${depAp.country}`
      : f1?.dep || `${fallbackDep} - BENINA INTL, LIBYA`,
    arrival: (flightList.length > 1 ? flightList[flightList.length - 1]?.arr : f1?.arr) || fallbackArr,
    arrivalFull: arrAp
      ? `${f1?.arr} - ${arrAp.city}, ${arrAp.country}`
      : f1?.arr || `${fallbackArr} - CAIRO INTL, EGYPT`,
    std: f1?.std ? String(f1.std).slice(11, 16) + "Z" : "08:30Z",
    sta: (flightList.length > 1 ? flightList[flightList.length - 1]?.sta : f1?.sta)
      ? String((flightList.length > 1 ? flightList[flightList.length - 1]?.sta : f1?.sta)).slice(11, 16) + "Z"
      : "11:45Z",
    altn: [f1?.altn, f1?.altn2].filter(Boolean).join(" / ") || "HEAX / HEGN",
    flightType: f1?.flightType || "SCHEDULED PASSENGER",
    purpose: f1?.notes || f1?.flightType || "PASSENGER OPERATIONAL FLIGHT",

    // Aircraft & CAMO
    aircraft: f1?.acft || fallbackAcft,
    aircraftType:
      fleetAcft?.type || camoAcft?.type || settings?.aircraftType || fallbackAcftType,
    coaExpiry:
      camoAcft?.coaExpiry ||
      fleetAcft?.coaExpiry ||
      settings?.coaExpiry ||
      "2027-05-15",
    insuranceExpiry:
      camoAcft?.insuranceExpiry || fleetAcft?.insuranceExpiry || "2027-08-20",
    noiseCertExpiry:
      camoAcft?.noiseCertExpiry ||
      fleetAcft?.noiseCertExpiry ||
      settings?.noiseCertificate ||
      "2028-01-10",
    seatCapacity:
      settings?.seatCapacity && Number(settings.seatCapacity) > 0
        ? String(settings.seatCapacity)
        : "189",

    // Operator / Settings
    operatorName: settings?.companyName || "AIR LIBYA FLIGHT OPS",
    operatorNameAr: settings?.companyNameAr || "طيران ليبيا للعمليات الجوية",
    operatorCode: settings?.operatorCode || "LAA",
    operatorCountry: settings?.country || "LIBYA",
    address: settings?.address || "TRIPOLI AIRPORT ROAD, TOWER 3",
    phone: settings?.phone || "+218 91 2345678",
    fax: settings?.fax || "+218 21 9876543",
    email: settings?.email || settings?.emailFrom || "ops@airlibya.aero",
    sita: settings?.sita || "TIPOWLN",
    contactPerson: settings?.contactPerson || fallbackPicName,

    // Crew
    picName: pic?.fullName || fallbackPicName,
    picLicense: pic?.licenseNo || "ATPL-784920",
    picPassport: pic?.passportNo || "A98765432",
    picNationality: pic?.nationality || "LIBYAN",
    crewCount: resolvedCrew.length > 0 ? String(resolvedCrew.length) : "6",
    crew:
      resolvedCrew.length > 0
        ? resolvedCrew
            .map((x) => `${x.slot.position}: ${x.member.fullName}`)
            .join(", ")
        : `PIC: ${fallbackPicName}, FO: FO. OMAR EL-SHARIF`,

    // Handling from flight if entered
    handlingAgent: f1?.services || fallbackHandling,
    issuedDate: new Date().toISOString().slice(0, 10),
    expiryDate: flightDate,
  };
}

export function extractFileId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const proxyMatch = str.match(/\/api\/drive-file\/([a-zA-Z0-9_-]+)/);
  if (proxyMatch) return proxyMatch[1];
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchPDFBytes(pdfUrl) {
  if (!pdfUrl) throw new Error("لا يوجد رابط لملف PDF");

  const trimmedUrl = String(pdfUrl).trim();
  if (trimmedUrl.includes("[Data URL")) {
    throw new Error(
      "هذا النموذج لم يُرفع ملفه الأصلي إلى Google Drive مسبقاً — يرجى تعديل النموذج وإعادة رفع ملف PDF ليُحفظ في Google Drive"
    );
  }

  // Support data:application/pdf;base64,... directly via synchronous decode
  if (trimmedUrl.startsWith("data:")) {
    try {
      const commaIdx = trimmedUrl.indexOf(",");
      if (commaIdx >= 0) {
        const base64Str = trimmedUrl.slice(commaIdx + 1);
        const binaryString = atob(base64Str);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    } catch (e) {
      console.warn("Direct Base64 PDF decode failed, trying fetch:", e);
    }
  }

  if (trimmedUrl.startsWith("blob:")) {
    const res = await fetch(trimmedUrl);
    return await res.arrayBuffer();
  }

  const fileId = extractFileId(trimmedUrl);
  if (!fileId) {
    const res = await fetch(trimmedUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.arrayBuffer();
  }

  /* Method 0: Same-Origin Express Drive Proxy (/api/drive-file/:fileId) */
  try {
    const proxyRes = await fetch(`/api/drive-file/${encodeURIComponent(fileId)}`);
    if (proxyRes.ok) {
      const arrayBuffer = await proxyRes.arrayBuffer();
      const header = new TextDecoder().decode(arrayBuffer.slice(0, 8));
      if (header.startsWith("%PDF-")) {
        return arrayBuffer;
      }
    }
  } catch (err) {
    console.warn("Same-origin Drive proxy warning:", err?.message);
  }

  /* Method 1: Same-Origin /api/gsheet?action=getPDF */
  try {
    const response = await fetch(
      `/api/gsheet?action=getPDF&fileId=${encodeURIComponent(fileId)}`,
      { method: "GET" }
    );
    if (response.ok) {
      const result = await response.json();
      if (result?.ok && result?.base64) {
        const binaryString = atob(result.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const header = new TextDecoder().decode(bytes.slice(0, 8));
        if (header.startsWith("%PDF-")) {
          return bytes.buffer;
        }
      }
    }
  } catch (err) {
    console.warn("GSheet proxy getPDF warning:", err?.message);
  }

  /* Method 2: Direct Apps Script getPDF */
  try {
    const apiUrl = `${API_URL}?action=getPDF&fileId=${fileId}`;
    const response = await fetch(apiUrl, { method: "GET", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text.trim().startsWith("{")) throw new Error("Response is not JSON");
    const result = JSON.parse(text);
    if (!result.ok || !result.base64) {
      throw new Error(result.error || "No base64 in response");
    }

    const binaryString = atob(result.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const header = new TextDecoder().decode(bytes.slice(0, 8));
    if (!header.startsWith("%PDF-")) {
      throw new Error(`Not a PDF. Header: "${header}"`);
    }
    return bytes.buffer;
  } catch (err) {
    console.warn("Method 2 failed:", err.message);
  }

  throw new Error("فشل تحميل ملف PDF من Google Drive — تأكد من صلاحية الملف");
}

/**
 * Renders Unicode / Arabic text to a crisp high-DPI PNG via HTML5 Canvas
 * so pdf-lib never crashes on non-WinAnsi characters!
 */
function renderUnicodeTextToPngBytes(text, fontSize = 12, bold = false) {
  const scale = 3;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSpec = `${bold ? "bold " : ""}${fontSize * scale}px Arial, Tahoma, sans-serif`;
  ctx.font = fontSpec;
  const metrics = ctx.measureText(text);
  const w = Math.max(20, Math.ceil(metrics.width + 12 * scale));
  const h = Math.max(16, Math.ceil(fontSize * scale * 1.55));
  canvas.width = w;
  canvas.height = h;

  const isRTL = /[\u0600-\u06FF]/.test(text);
  ctx.font = fontSpec;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "middle";
  if (isRTL) {
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillText(text, w - 4 * scale, h / 2);
  } else {
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillText(text, 2 * scale, h / 2);
  }

  const dataUrl = canvas.toDataURL("image/png");
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, widthPt: w / scale, heightPt: h / scale };
}

function hasNonWinAnsi(str) {
  return /[^\x20-\x7E\xA0-\xFF]/.test(str);
}

/**
 * Unified PDF Filler: fills BOTH AcroForm fields (if any) AND Coordinate-mapped fields (if any)
 */
export async function fillPermitPDF(
  pdfUrl,
  fields = [],
  data = {},
  acroMappings = [],
  options = {}
) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdfBytes = await fetchPDFBytes(pdfUrl);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Fill AcroForm fields if PDF has interactive form fields
  try {
    const form = pdfDoc.getForm();
    const formFields = form.getFields();
    if (formFields.length > 0) {
      formFields.forEach((pdfField) => {
        const rawName = pdfField.getName();
        const mapped = (acroMappings || []).find((m) => m.acroName === rawName);
        const dataKey = mapped?.key || smartMatchAcroFieldKey(rawName) || rawName;
        const val = data[dataKey] ?? data[rawName];
        if (val === undefined || val === null || val === "") return;
        const strVal = String(val);

        try {
          const typeName = pdfField.constructor.name;
          if (typeName.includes("Text")) {
            if (!hasNonWinAnsi(strVal)) {
              pdfField.setText(strVal);
            }
          } else if (typeName.includes("CheckBox")) {
            if (val === true || strVal === "true" || strVal === "1" || strVal === "yes") {
              pdfField.check();
            }
          } else if (typeName.includes("Dropdown") || typeName.includes("Radio")) {
            pdfField.select(strVal);
          }
        } catch (e) {
          console.warn(`AcroForm field ${rawName} skip:`, e.message);
        }
      });
    }
  } catch {
    // Non-AcroForm PDF
  }

  // 2. Fill Coordinate-mapped fields (supports both English & Arabic!)
  for (const field of fields || []) {
    const value =
      data[field.key] !== undefined && data[field.key] !== ""
        ? data[field.key]
        : field.systemKey
        ? data[field.systemKey]
        : undefined;
    if (value === undefined || value === null || value === "") continue;

    const pageIndex = field.page || 0;
    const page = pages[pageIndex];
    if (!page) continue;

    const strVal = String(value);
    const fontSize = Number(field.fontSize) || 11;
    // Note: PDFFieldMapper stores pdfY from bottom (0..842) or top; let's check how PDFFieldMapper saved it!
    // In PDFFieldMapper: pdfY = Math.round(((pageSize.height - y) / pageSize.height) * 842) -> bottom-up PDF coordinates!
    // Scale to actual page dimensions (in case page is not 595x842)
    const actualW = page.getWidth();
    const actualH = page.getHeight();
    const boxX = (Number(field.x || 0) / 595) * actualW;
    const boxHeight = (Number(field.height || 22) / 842) * actualH;
    const boxY =
      field.coordOrigin === "top"
        ? actualH - (Number(field.y || 0) / 842) * actualH
        : (Number(field.y || 0) / 842) * actualH;

    const targetBoxWidth = (Number(field.width || field.maxWidth || 120) / 595) * actualW;
    const alignMode = field.align || "center"; // "center" | "left" | "right"
    const vAlignMode = field.valign || "middle"; // "middle" | "top" | "bottom"

    try {
      if (hasNonWinAnsi(strVal)) {
        const rendered = renderUnicodeTextToPngBytes(strVal, fontSize, !!field.bold);
        const pngImg = await pdfDoc.embedPng(rendered.bytes);

        // Auto-scale down PNG if rendered dimensions exceed box boundaries
        const scaleX = rendered.widthPt > targetBoxWidth ? (targetBoxWidth * 0.96) / rendered.widthPt : 1;
        const scaleY = rendered.heightPt > boxHeight ? (boxHeight * 0.95) / rendered.heightPt : 1;
        const widthScale = Math.min(scaleX, scaleY);
        const drawWidth = rendered.widthPt * widthScale;
        const drawHeight = rendered.heightPt * widthScale;

        // Calculate horizontal position
        let drawX = boxX;
        if (alignMode === "center") {
          drawX = boxX + Math.max(0, (targetBoxWidth - drawWidth) / 2);
        } else if (alignMode === "right") {
          drawX = boxX + Math.max(0, targetBoxWidth - drawWidth - 2);
        } else {
          drawX = boxX + 2;
        }

        // Calculate vertical position (centered inside box)
        let drawY = boxY;
        if (vAlignMode === "middle" || !vAlignMode) {
          drawY = boxY + Math.max(0, (boxHeight - drawHeight) / 2);
        } else if (vAlignMode === "top") {
          drawY = boxY + Math.max(0, boxHeight - drawHeight - 1);
        } else {
          drawY = boxY + 1;
        }

        page.drawImage(pngImg, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
      } else {
        const fontObj = field.bold ? fontBold : font;
        const rawTextWidth = fontObj.widthOfTextAtSize(strVal, fontSize);

        // Auto-scale font size if text dimensions exceed box boundaries
        const fontScaleW = rawTextWidth > targetBoxWidth ? (targetBoxWidth * 0.95) / rawTextWidth : 1;
        const fontScaleH = fontSize > boxHeight * 0.85 ? (boxHeight * 0.85) / fontSize : 1;
        const finalScale = Math.min(fontScaleW, fontScaleH);
        const scaledFontSize = Math.max(6, Math.floor(fontSize * finalScale));
        const finalWidth = fontObj.widthOfTextAtSize(strVal, scaledFontSize);
        const textHeight = fontObj.heightAtSize(scaledFontSize);

        // Calculate horizontal position
        let drawX = boxX;
        if (alignMode === "center") {
          drawX = boxX + Math.max(0, (targetBoxWidth - finalWidth) / 2);
        } else if (alignMode === "right") {
          drawX = boxX + Math.max(0, targetBoxWidth - finalWidth - 2);
        } else {
          drawX = boxX + 2;
        }

        // Calculate vertical position (baseline adjusted for middle centering)
        let drawY = boxY;
        if (vAlignMode === "middle" || !vAlignMode) {
          drawY = boxY + Math.max(1, (boxHeight - textHeight) / 2 + textHeight * 0.22);
        } else if (vAlignMode === "top") {
          drawY = boxY + Math.max(1, boxHeight - textHeight);
        } else {
          drawY = boxY + 2;
        }

        page.drawText(strVal, {
          x: drawX,
          y: drawY,
          size: scaledFontSize,
          font: fontObj,
          color: rgb(0, 0, 0),
          maxWidth: targetBoxWidth,
        });
      }
    } catch (err) {
      console.warn(`Failed drawing field ${field.key}:`, err);
    }
  }

  // 3. Optional Official Stamp embedding when permitted & selected
  if (options?.stampUrl && pages.length > 0) {
    try {
      const rawStamp = String(options.stampUrl).trim();
      const m1 = rawStamp.match(/[?&]id=([^&]+)/);
      const m2 = rawStamp.match(/\/d\/([^/?]+)/);
      const displayUrl = rawStamp.startsWith("data:")
        ? rawStamp
        : m1
        ? `https://lh3.googleusercontent.com/d/${m1[1]}`
        : m2
        ? `https://lh3.googleusercontent.com/d/${m2[1]}`
        : rawStamp;
      const sRes = await fetch(displayUrl);
      const sBytes = await sRes.arrayBuffer();
      let stampImg = null;
      try {
        stampImg = await pdfDoc.embedPng(new Uint8Array(sBytes));
      } catch {
        stampImg = await pdfDoc.embedJpg(new Uint8Array(sBytes));
      }
      if (stampImg) {
        const lastPage = pages[pages.length - 1];
        const { width: pw } = lastPage.getSize();
        const dims = stampImg.scale(0.5);
        const scale = Math.min(1, 70 / dims.height);
        const drawW = dims.width * scale;
        const drawH = dims.height * scale;
        lastPage.drawImage(stampImg, {
          x: Math.max(30, pw - drawW - 45),
          y: 35,
          width: drawW,
          height: drawH,
          opacity: 0.85,
        });
      }
    } catch (e) {
      console.warn("PDF stamp embed skipped:", e?.message);
    }
  }

  return await pdfDoc.save();
}

export function downloadPDF(pdfBytes, fileName = "permit.pdf") {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPDF(pdfBytes, title = "Permit PDF") {
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  openPreviewModal({ title, blobUrl: url, fileName: "permit.pdf" });
}

export async function extractPDFFormFields(pdfUrl) {
  const { PDFDocument } = await import("pdf-lib");
  const pdfBytes = await fetchPDFBytes(pdfUrl);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    return fields.map((f) => {
      const acroName = f.getName();
      const matchedKey = smartMatchAcroFieldKey(acroName);
      const catalogItem = PERMIT_FIELD_CATALOG.find((c) => c.key === matchedKey);
      return {
        acroName,
        key: matchedKey || acroName,
        label: catalogItem ? catalogItem.label : acroName,
        autoMatched: !!matchedKey,
        type: f.constructor.name.replace("PDF", "").replace("Field", ""),
      };
    });
  } catch {
    return [];
  }
}

export async function fillPDFAcroForm(pdfUrl, data) {
  return fillPermitPDF(pdfUrl, [], data, []);
}

export function toDirectDriveUrl(url) {
  const fileId = extractFileId(url);
  if (!fileId) return url;
  return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
}
