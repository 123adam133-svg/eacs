/* ═══════════════════════════════════════════════════════════
 * GEN DEC — EACS Template v88 (Iframe-Safe Preview, Print & PDF)
 * Multi-Sector: Separate page per sector
 * ═══════════════════════════════════════════════════════════ */

import { findAirport } from "../airports.js";
import { openPreviewModal, printHTMLContent, showToast } from "./dialog";

const fmtDateLong = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
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
  return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const fmtDateParts = (iso) => {
  if (!iso) return { d: "", m: "", y: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { d: "", m: "", y: "" };
  return {
    d: String(d.getUTCDate()).padStart(2, "0"),
    m: String(d.getUTCMonth() + 1).padStart(2, "0"),
    y: String(d.getUTCFullYear()),
  };
};

const roleToPlace = (role) =>
  ({
    captain: "PIC",
    firstOfficer: "FO",
    observer: "ACM",
    tri: "TRI",
    flightAttendant: "FA",
    fa1: "FA",
    fa2: "CC",
    engineer: "ENG1",
    security: "SEC",
    loadmaster: "LMC",
    flightDispatcher: "FD",
    dispatcher: "FD",
  }[role] || "");

const natShort = (nat) => {
  if (!nat) return "LBY";
  const key = String(nat).toLowerCase().trim();
  const map = {
    libya: "LBY",
    libyan: "LBY",
    ليبيا: "LBY",
    egypt: "EGY",
    مصر: "EGY",
    tunisia: "TUN",
    تونس: "TUN",
    algeria: "ALG",
    الجزائر: "ALG",
    morocco: "MAR",
    المغرب: "MAR",
    sudan: "SDN",
    السودان: "SDN",
    italy: "ITA",
    إيطاليا: "ITA",
    france: "FRA",
    فرنسا: "FRA",
    germany: "DEU",
    ألمانيا: "DEU",
    spain: "ESP",
    إسبانيا: "ESP",
    turkey: "TUR",
    تركيا: "TUR",
    uk: "GBR",
    بريطانيا: "GBR",
    usa: "USA",
    أمريكا: "USA",
  };
  return map[key] || String(nat).slice(0, 3).toUpperCase();
};

const logoToDisplayUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  const match = url.match(/[?&]id=([^&]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  const pathMatch = url.match(/\/d\/([^/]+)/);
  if (pathMatch) return `https://lh3.googleusercontent.com/d/${pathMatch[1]}`;
  return url;
};

const getAirportInfo = (code) => {
  if (!code) return { code: "", city: "", country: "", full: "", iata: "" };
  const ap = findAirport(code);
  if (!ap) {
    const upper = String(code).toUpperCase().trim();
    return { code: upper, city: upper, country: "", full: upper, iata: "" };
  }
  return {
    code: ap.icao,
    iata: ap.iata,
    city: ap.city.toUpperCase(),
    country: ap.country.toUpperCase(),
    full: `${ap.city.toUpperCase()} / ${ap.country.toUpperCase()}`,
  };
};

function extractSectors(flight) {
  const sectors = [
    {
      index: 1,
      dep: flight.dep || "",
      arr: flight.arr || "",
      std: flight.std || "",
      sta: flight.sta || "",
      date: flight.std ? String(flight.std).slice(0, 10) : "",
      acft: flight.acft || "",
    },
  ];

  const legs = Array.isArray(flight.legs) ? flight.legs : [];
  legs.forEach((leg, idx) => {
    let date = leg.date || "";
    if (!date && leg.std) date = String(leg.std).slice(0, 10);
    sectors.push({
      index: idx + 2,
      dep: leg.dep || "",
      arr: leg.arr || "",
      std: leg.std || "",
      sta: leg.sta || "",
      date: date || (flight.std ? String(flight.std).slice(0, 10) : ""),
      acft: leg.acft || flight.acft || "",
    });
  });

  return sectors;
}

function fillTemplateDoc(doc, flight, crew, settings = {}, options = {}) {
  const showStamp = options.showStamp !== false;
  const sector = options.sector || null;

  const sectorDep = sector ? sector.dep : flight.dep;
  const sectorArr = sector ? sector.arr : flight.arr;
  const sectorDate = sector
    ? sector.date
    : flight.std
    ? String(flight.std).slice(0, 10)
    : "";
  const sectorAcft = sector ? sector.acft || flight.acft : flight.acft;

  const roster = (flight.crewSlots || [])
    .map((s) => ({ slot: s, member: crew.find((c) => c.id === s.crewId) }))
    .filter((x) => x.member);

  const companyNameEn =
    settings.companyNameEn ||
    settings.companyName ||
    "EXECUTIVE AUTHORITY FOR SPECIAL FLIGHTS";
  const companyNameAr =
    settings.companyNameAr || "الجهاز التنفيذي للطيران الخاص";
  const operatorCode = (settings.operatorCode || "EACS").toUpperCase().trim();

  const logoUrl = settings.logo ? logoToDisplayUrl(settings.logo) : "";
  const stampUrl = settings.stamp ? logoToDisplayUrl(settings.stamp) : "";
  const flightNo = flight.flightNo || "";
  const dateParts = fmtDateParts(sectorDate);

  const depInfo = getAirportInfo(sectorDep);
  const arrInfo = getAirportInfo(sectorArr);

  const set = (id, v) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = v || "";
  };

  set("fld-company-en", companyNameEn);
  set("fld-company-ar", companyNameAr);
  set("fld-operator-code", operatorCode);
  set("fld-marks", sectorAcft);
  set("fld-flightno", flightNo);
  set("fld-date-d", dateParts.d);
  set("fld-date-m", dateParts.m);
  set("fld-date-y", dateParts.y);
  set("fld-dep", depInfo.full);
  set("fld-dep-code", depInfo.code);
  set("fld-arr", arrInfo.full);
  set("fld-arr-code", arrInfo.code);
  set("fld-dep-place", depInfo.code);
  set("fld-arr-place", arrInfo.code);

  if (logoUrl) {
    const img = doc.getElementById("fld-logo");
    if (img) {
      img.src = logoUrl;
      img.style.display = "block";
    }
  }

  const tbody = doc.getElementById("crew-body");
  if (tbody) {
    tbody.innerHTML = "";
    const MAX_ROWS = 10;

    roster.forEach((r, i) => {
      if (i >= MAX_ROWS) return;
      const m = r.member;
      const no = String(i + 1).padStart(2, "0");
      const place = roleToPlace(m.role);
      const name = m.fullName || "";
      const passport = m.passportNo || "////////////";
      const eacNo = m.eNumber || "////////////";
      const dob = m.dob ? fmtDateLong(m.dob) : "////////////";
      const expiry = m.passportExpiry
        ? fmtDateLong(m.passportExpiry)
        : "////////////";
      const nat = natShort(m.nationality);

      const tr = doc.createElement("tr");
      tr.innerHTML = `
        <td><strong>${no}</strong></td>
        <td><strong>${place}</strong></td>
        <td style="text-align: left; padding-left: 4px;">${name}</td>
        <td>${passport}</td>
        <td>${eacNo}</td>
        <td>${dob}</td>
        <td>${expiry}</td>
        <td><strong>${nat}</strong></td>
      `;
      tbody.appendChild(tr);
    });

    const filledCount = Math.min(roster.length, MAX_ROWS);
    for (let i = filledCount; i < MAX_ROWS; i++) {
      const no = String(i + 1).padStart(2, "0");
      const tr = doc.createElement("tr");
      tr.className = "empty-row";
      tr.innerHTML = `
        <td><strong>${no}</strong></td>
        <td>/////</td>
        <td>//////////////////</td>
        <td>/////////////</td>
        <td>/////////////</td>
        <td>/////////////</td>
        <td>/////////////</td>
        <td>/////</td>
      `;
      tbody.appendChild(tr);
    }
  }

  const stampArea = doc.querySelector(".stamp-area");
  if (stampArea) {
    stampArea.innerHTML = "";
    if (stampUrl && showStamp) {
      stampArea.style.cssText = `
        display: flex; align-items: center; justify-content: center;
        padding: 1.5mm; min-height: 55mm;
        height: calc(100% - 12mm); border: 0;
      `;
      const img = doc.createElement("img");
      img.src = stampUrl;
      img.style.cssText = `
        max-width: 45mm; max-height: 45mm;
        object-fit: contain; opacity: 0.9;
      `;
      stampArea.appendChild(img);
    }
  }
}

const PRINT_CSS = `
  <style id="print-force-a4">
    @page { size: 210mm 297mm !important; margin: 0 !important; }
    html, body {
      width: 210mm !important; height: 297mm !important;
      margin: 0 auto !important; padding: 0 !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page {
      width: 210mm !important; height: 297mm !important;
      margin: 0 auto !important;
      padding: 3mm !important; padding-top: 8mm !important;
      box-sizing: border-box !important;
      background: #fff !important; position: relative !important;
      overflow: visible !important;
      transform: scale(0.92) !important;
      transform-origin: top center !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
    .top-header {
      border: 1.5px solid #000 !important;
      border-bottom: 0 !important;
    }
    table.main {
      height: 100% !important;
      border: 1.5px solid #000 !important;
      border-top: 0 !important;
    }
    table, tr, td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
`;

async function buildFilledGenDecHTML(flight, crew, settings = {}, options = {}) {
  const res = await fetch("/templates/gendec-template.html");
  if (!res.ok) throw new Error("Template not found");
  let html = await res.text();
  html = html.replace(/@page\s*\{[^}]*\}/g, "");
  html = html.replace("</head>", PRINT_CSS + "</head>");

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  fillTemplateDoc(doc, flight, crew, settings, options);
  return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
}

export async function previewGenDec(flight, crew, settings = {}, options = {}) {
  try {
    const fullHtml = await buildFilledGenDecHTML(flight, crew, settings, options);
    openPreviewModal({
      title: `General Declaration — ${flight.flightNo || ""}`,
      html: fullHtml,
    });
  } catch (e) {
    showToast("Preview failed: " + e.message, "error");
    console.error(e);
  }
}

export async function printGenDec(flight, crew, settings = {}, options = {}) {
  try {
    const fullHtml = await buildFilledGenDecHTML(flight, crew, settings, options);
    printHTMLContent(fullHtml, `General Declaration - ${flight.flightNo || ""}`);
  } catch (e) {
    showToast("Print failed: " + e.message, "error");
    console.error(e);
  }
}

export async function downloadGenDec(flight, crew, settings = {}, options = {}) {
  try {
    const jspdfModule = await import("jspdf");
    const html2canvasModule = await import("html2canvas");

    const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
    const html2canvas = html2canvasModule.default || html2canvasModule;

    const fullHtml = await buildFilledGenDecHTML(flight, crew, settings, options);

    const iframe = document.createElement("iframe");
    iframe.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 210mm;
      height: 297mm;
      border: 0;
      visibility: hidden;
    `;
    document.body.appendChild(iframe);

    iframe.contentDocument.open();
    iframe.contentDocument.write(fullHtml);
    iframe.contentDocument.close();

    await new Promise((r) => setTimeout(r, 1200));

    const element = iframe.contentDocument.querySelector(".page");
    if (!element) {
      document.body.removeChild(iframe);
      throw new Error("Page element not found");
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 210 * 3.7795,
      windowHeight: 297 * 3.7795,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    pdf.addImage(
      imgData,
      "JPEG",
      0,
      0,
      pdf.internal.pageSize.getWidth(),
      pdf.internal.pageSize.getHeight()
    );

    const stampSuffix = options.showStamp === false ? "_NoStamp" : "_Stamped";
    const fileName = `GD_${flight.flightNo || "flight"}_${flight.dep || ""}-${
      flight.arr || ""
    }_${(flight.std || "").slice(0, 10)}${stampSuffix}.pdf`;

    pdf.save(fileName);
    document.body.removeChild(iframe);
    showToast(`✅ PDF downloaded: ${fileName}`, "success");
  } catch (e) {
    showToast("Download failed: " + e.message, "error");
    console.error("Download error:", e);
  }
}

export async function downloadMultiGenDec(
  flights,
  crew,
  settings = {},
  options = {}
) {
  try {
    const jspdfModule = await import("jspdf");
    const html2canvasModule = await import("html2canvas");

    const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
    const html2canvas = html2canvasModule.default || html2canvasModule;

    if (!Array.isArray(flights) || flights.length === 0) {
      showToast("⚠️ لم يتم تحديد أي رحلة", "warning");
      return;
    }

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    let pageCount = 0;

    for (let fi = 0; fi < flights.length; fi++) {
      const flight = flights[fi];
      const sectors = extractSectors(flight);

      for (let si = 0; si < sectors.length; si++) {
        const sector = sectors[si];
        if (pageCount > 0) pdf.addPage();

        const fullHtml = await buildFilledGenDecHTML(flight, crew, settings, {
          ...options,
          sector,
        });

        const iframe = document.createElement("iframe");
        iframe.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
          width: 210mm;
          height: 297mm;
          border: 0;
          visibility: hidden;
        `;
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(fullHtml);
        iframe.contentDocument.close();

        await new Promise((r) => setTimeout(r, 1100));

        const element = iframe.contentDocument.querySelector(".page");
        if (!element) {
          document.body.removeChild(iframe);
          continue;
        }

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 210 * 3.7795,
          windowHeight: 297 * 3.7795,
        });

        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          0,
          pdfWidth,
          pdfHeight
        );

        document.body.removeChild(iframe);
        pageCount++;
      }
    }

    if (pageCount === 0) {
      showToast("⚠️ لم يتم إنشاء أي صفحة", "warning");
      return;
    }

    const stampSuffix = options.showStamp === false ? "_NoStamp" : "_Stamped";
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `GenDec_${today}_${flights.length}flights_${pageCount}pages${stampSuffix}.pdf`;

    pdf.save(fileName);
    showToast(
      `✅ تم توليد ${pageCount} صفحة من ${flights.length} رحلة (${fileName})`,
      "success"
    );
  } catch (e) {
    showToast("Multi-download failed: " + e.message, "error");
    console.error("Multi-download error:", e);
  }
}
