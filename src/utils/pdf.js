/* ═══════════════════════════════════════════════════════════
 * PDF HELPERS
 * Crew Card + Operations Manual + General Declaration
 * ═══════════════════════════════════════════════════════════ */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { openPreviewModal } from "./dialog";

export const pdfSafe = (str) => {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/×/g, "x")
    .replace(/✓/g, "OK")
    .replace(/☒/g, "[X]")
    .replace(/☐/g, "[ ]")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/═/g, "=")
    .replace(/─/g, "-")
    .replace(/│/g, "|")
    .replace(/·/g, ".")
    .replace(/[^\x00-\xFF]/g, "");
};

const roleToPlace = (role) => {
  const map = {
    captain: "PIC",
    firstOfficer: "CPT",
    observer: "ACM",
    flightAttendant: "FA",
    fa1: "FA",
    fa2: "CC",
    engineer: "A/S",
    security: "SEC",
    loadmaster: "LMC",
  };
  return map[role] || "/////";
};

/* ═══════════════════════════════════════════════════════════
 * CREW CARD PDF
 * ═══════════════════════════════════════════════════════════ */
export async function generateCrewCardPDF(crewMember, companyName) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([340, 540]);
  const { width, height } = page.getSize();
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.06, 0.09, 0.16),
  });
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.02, 0.55, 0.85),
  });
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height: 90,
    color: rgb(0.02, 0.35, 0.55),
  });

  page.drawText(pdfSafe(companyName || "Flight Operations"), {
    x: 20,
    y: height - 40,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("CREW IDENTIFICATION CARD", {
    x: 20,
    y: height - 65,
    size: 9,
    font,
    color: rgb(0.85, 0.92, 1),
  });

  page.drawText(pdfSafe(crewMember.fullName || ""), {
    x: 20,
    y: height - 290,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(pdfSafe((crewMember.role || "").toUpperCase()), {
    x: 20,
    y: height - 312,
    size: 11,
    font: fontBold,
    color: rgb(0.55, 0.8, 1),
  });
  page.drawText(pdfSafe(`Emp No: ${crewMember.empNo || "-"}`), {
    x: 20,
    y: height - 330,
    size: 9,
    font,
    color: rgb(0.85, 0.9, 1),
  });
  page.drawText(pdfSafe(`Base: ${crewMember.base || "-"}`), {
    x: 20,
    y: height - 344,
    size: 9,
    font,
    color: rgb(0.85, 0.9, 1),
  });
  page.drawText(pdfSafe(`License: ${crewMember.licenseNo || "-"}`), {
    x: 20,
    y: height - 370,
    size: 9,
    font,
    color: rgb(0.85, 0.9, 1),
  });

  const payload = JSON.stringify({
    id: crewMember.id,
    name: crewMember.fullName,
  });
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
  const qrB64 = qrDataUrl.split(",")[1];
  const qrBin = atob(qrB64);
  const qrBytes = new Uint8Array(qrBin.length);
  for (let i = 0; i < qrBin.length; i++) qrBytes[i] = qrBin.charCodeAt(i);
  const qrImg = await pdf.embedPng(qrBytes);
  page.drawImage(qrImg, { x: width - 120, y: 20, width: 100, height: 100 });

  return await pdf.save();
}

/* ═══════════════════════════════════════════════════════════
 * OPERATIONS MANUAL PDF (Used by ManualsModule)
 * ═══════════════════════════════════════════════════════════ */
export async function generateManualPDF(manual, companyName = "Flight Operations") {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: rgb(0.06, 0.14, 0.28),
  });

  page.drawText(pdfSafe(companyName || "Flight Operations").toUpperCase(), {
    x: 40,
    y: height - 45,
    size: 13,
    font: fontBold,
    color: rgb(0.55, 0.82, 1),
  });

  page.drawText(
    pdfSafe(`${manual.code || "OM"} — ${manual.title_en || "Operations Manual"}`),
    {
      x: 40,
      y: height - 74,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    }
  );

  page.drawText(
    pdfSafe(
      `Category: ${manual.category || "Operations"}   |   Revision: ${
        manual.rev || "Rev 1.0"
      }   |   Approval: ${manual.approval || "-"}`
    ),
    {
      x: 40,
      y: height - 98,
      size: 9.5,
      font,
      color: rgb(0.82, 0.9, 1),
    }
  );

  let y = height - 160;

  // Metadata Box
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: width - 80,
    height: 65,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.82, 0.86, 0.92),
    borderWidth: 1,
  });

  page.drawText(
    pdfSafe(`Effective Date: ${manual.effectiveDate || "-"}`),
    { x: 55, y: y - 14, size: 10, font: fontBold, color: rgb(0.12, 0.16, 0.24) }
  );
  page.drawText(
    pdfSafe(`Status: ${(manual.status || "ACTIVE").toUpperCase()}`),
    { x: 260, y: y - 14, size: 10, font: fontBold, color: rgb(0.08, 0.5, 0.28) }
  );
  page.drawText(
    pdfSafe(`Pages: ${manual.pages || "-"}   |   Last Updated By: ${manual.lastUpdatedBy || "System"}`),
    { x: 55, y: y - 36, size: 9.5, font, color: rgb(0.32, 0.38, 0.48) }
  );

  y -= 90;

  // Summary Section
  page.drawText("EXECUTIVE SUMMARY", {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.08, 0.24, 0.48),
  });
  y -= 20;

  const summaryWords = pdfSafe(manual.summary || "No summary provided.").split(/\s+/);
  let line = "";
  for (const w of summaryWords) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, 10) > width - 80) {
      page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.18, 0.22, 0.3) });
      y -= 15;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.18, 0.22, 0.3) });
    y -= 28;
  }

  // Chapters Table
  page.drawText("TABLE OF CONTENTS / CHAPTERS", {
    x: 40,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.08, 0.24, 0.48),
  });
  y -= 18;

  page.drawRectangle({
    x: 40,
    y: y - 18,
    width: width - 80,
    height: 22,
    color: rgb(0.9, 0.93, 0.97),
  });
  page.drawText("CH.", { x: 50, y: y - 11, size: 9, font: fontBold });
  page.drawText("CHAPTER TITLE", { x: 100, y: y - 11, size: 9, font: fontBold });
  page.drawText("PAGES", { x: width - 110, y: y - 11, size: 9, font: fontBold });
  y -= 24;

  const chapters = Array.isArray(manual.chapters) ? manual.chapters : [];
  chapters.forEach((ch, idx) => {
    if (y < 90) return;
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: 40,
        y: y - 16,
        width: width - 80,
        height: 20,
        color: rgb(0.97, 0.98, 1),
      });
    }
    page.drawText(pdfSafe(ch.num || String(idx + 1).padStart(2, "0")), {
      x: 50,
      y: y - 10,
      size: 9.5,
      font: fontBold,
    });
    page.drawText(pdfSafe(ch.title || "-"), {
      x: 100,
      y: y - 10,
      size: 9.5,
      font,
    });
    page.drawText(pdfSafe(ch.pages || "-"), {
      x: width - 110,
      y: y - 10,
      size: 9.5,
      font,
    });
    y -= 20;
  });

  // Footer
  page.drawText(
    pdfSafe(
      `Controlled Electronic Document — Generated ${new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")} UTC`
    ),
    {
      x: 40,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.55, 0.62),
    }
  );

  return await pdf.save();
}

/* ═══════════════════════════════════════════════════════════
 * GENERAL DECLARATION — EACS-Libya Format (A4 Portrait)
 * ═══════════════════════════════════════════════════════════ */
export async function generateGenDecPDF(flight, crew, opts = {}) {
  const pdf = await PDFDocument.create();
  const pageW = 595;
  const pageH = 842;
  const page = pdf.addPage([pageW, pageH]);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const BLUE = rgb(0.12, 0.28, 0.49);
  const LIGHT_GRAY = rgb(0.94, 0.94, 0.94);
  const WHITE = rgb(1, 1, 1);
  const BLACK = rgb(0, 0, 0);

  const drawRect = (x, y, w, h, fill = WHITE, border = BLACK, borderW = 0.5) => {
    if (fill) page.drawRectangle({ x, y, width: w, height: h, color: fill });
    if (border) {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: border,
        borderWidth: borderW,
        color: undefined,
      });
    }
  };

  const txt = (
    text,
    x,
    y,
    size = 8,
    isBold = false,
    color = BLACK,
    maxWidth = 0
  ) => {
    const safe = pdfSafe(text);
    if (!safe) return;
    if (maxWidth > 0) {
      let display = safe;
      const fontRef = isBold ? fontBold : font;
      let tw = fontRef.widthOfTextAtSize(display, size);
      while (tw > maxWidth && display.length > 3) {
        display = display.slice(0, -2);
        tw = fontRef.widthOfTextAtSize(display + "...", size);
      }
      if (display !== safe) display = display + "...";
      page.drawText(display, {
        x,
        y,
        size,
        font: isBold ? fontBold : font,
        color,
      });
    } else {
      page.drawText(safe, {
        x,
        y,
        size,
        font: isBold ? fontBold : font,
        color,
      });
    }
  };

  const M = 20;
  const W = pageW - M * 2;
  let y = pageH - M;

  txt("Executive Authority for Special Flights", M, y - 10, 10, true, BLUE);
  txt("EACS-Libya", pageW - M - 60, y - 10, 10, true, BLUE);
  y -= 22;

  const cx = pageW / 2;
  const cy = y + 5;
  page.drawCircle({ x: cx, y: cy, size: 18, color: BLUE, opacity: 1 });
  txt("EACS", cx - 12, cy - 3, 10, true, WHITE);
  y -= 10;

  const titleH = 22;
  drawRect(M, y - titleH, W, titleH, LIGHT_GRAY);
  txt("GENERAL DECLARATION (Outward/Inward)", M + 6, y - 14, 10, true);
  y -= titleH;

  const rowOpH = 26;
  drawRect(M, y - rowOpH, 90, rowOpH, WHITE);
  txt("Operator", M + 4, y - 15, 8, false);
  drawRect(M + 90, y - rowOpH, W - 90, rowOpH, WHITE);
  txt(
    "EXECUTIVE AUTHORITY FOR SPECIAL FLIGHTS (EACS)",
    M + 96,
    y - 16,
    11,
    true,
    BLUE
  );
  y -= rowOpH;

  const regH = 20;
  const col1 = W * 0.35;
  const col2 = W * 0.35;
  const col3 = W * 0.3;

  drawRect(M, y - regH, col1, regH, LIGHT_GRAY);
  drawRect(M + col1, y - regH, col2, regH, LIGHT_GRAY);
  drawRect(M + col1 + col2, y - regH, col3, regH, LIGHT_GRAY);
  txt("Marks of Nationality & Registration", M + 4, y - 13, 7, true);
  txt("Flight No", M + col1 + 4, y - 13, 7, true);
  txt("Date", M + col1 + col2 + 4, y - 13, 7, true);
  y -= regH;

  const valH = 24;
  drawRect(M, y - valH, col1, valH, WHITE);
  drawRect(M + col1, y - valH, col2, valH, WHITE);
  drawRect(M + col1 + col2, y - valH, col3, valH, WHITE);

  txt(flight.acft || "-", M + 6, y - 16, 13, true);
  txt(flight.flightNo || "-", M + col1 + 6, y - 16, 13, true);

  const flightDate = flight.std ? new Date(flight.std) : new Date();
  const d = String(flightDate.getUTCDate()).padStart(2, "0");
  const m = String(flightDate.getUTCMonth() + 1).padStart(2, "0");
  const yr = flightDate.getUTCFullYear();
  txt(`${d} / ${m} / ${yr}`, M + col1 + col2 + 6, y - 16, 12, true);
  y -= valH;

  const arrH = 20;
  drawRect(M, y - arrH, W / 2, arrH, LIGHT_GRAY);
  drawRect(M + W / 2, y - arrH, W / 2, arrH, LIGHT_GRAY);
  txt("Departure from", M + 4, y - 13, 7, true);
  txt("Arrival at", M + W / 2 + 4, y - 13, 7, true);
  y -= arrH;

  const arrValH = 26;
  drawRect(M, y - arrValH, W / 2, arrValH, WHITE);
  drawRect(M + W / 2, y - arrValH, W / 2, arrValH, WHITE);
  txt(flight.dep || "-", M + 6, y - 17, 13, true, BLACK, W / 2 - 12);
  txt(flight.arr || "-", M + W / 2 + 6, y - 17, 13, true, BLACK, W / 2 - 12);
  y -= arrValH;

  const crewHeaderH = 24;
  const colNo = 25;
  const colPlace = 45;
  const colName = 220;
  const colPass = 130;
  const colE = W - colNo - colPlace - colName - colPass;

  drawRect(M, y - crewHeaderH, colNo, crewHeaderH, LIGHT_GRAY);
  drawRect(M + colNo, y - crewHeaderH, colPlace, crewHeaderH, LIGHT_GRAY);
  drawRect(M + colNo + colPlace, y - crewHeaderH, colName, crewHeaderH, LIGHT_GRAY);
  drawRect(M + colNo + colPlace + colName, y - crewHeaderH, colPass, crewHeaderH, LIGHT_GRAY);
  drawRect(M + colNo + colPlace + colName + colPass, y - crewHeaderH, colE, crewHeaderH, LIGHT_GRAY);

  txt("No.", M + 4, y - 15, 7, true);
  txt("PLACE", M + colNo + 4, y - 15, 7, true);
  txt("CREW MEMBER NAME", M + colNo + colPlace + 4, y - 15, 7, true);
  txt("PASSPORT NO", M + colNo + colPlace + colName + 4, y - 15, 7, true);
  txt("E-NUMBER", M + colNo + colPlace + colName + colPass + 4, y - 15, 7, true);
  y -= crewHeaderH;

  const roster = (flight.crewSlots || [])
    .map((s) => ({
      slot: s,
      member: crew.find((c) => c.id === s.crewId),
    }))
    .filter((x) => x.member)
    .slice(0, 10);

  while (roster.length < 8) {
    roster.push({ slot: { position: "" }, member: null });
  }

  const crewRowH = 24;
  for (let i = 0; i < roster.length; i++) {
    const r = roster[i];
    const member = r.member;
    const place = member ? roleToPlace(member.role) : "/////";

    drawRect(M, y - crewRowH, colNo, crewRowH, WHITE);
    drawRect(M + colNo, y - crewRowH, colPlace, crewRowH, WHITE);
    drawRect(M + colNo + colPlace, y - crewRowH, colName, crewRowH, WHITE);
    drawRect(M + colNo + colPlace + colName, y - crewRowH, colPass, crewRowH, WHITE);
    drawRect(M + colNo + colPlace + colName + colPass, y - crewRowH, colE, crewRowH, WHITE);

    txt(String(i + 1).padStart(2, "0"), M + 6, y - 15, 8, false);
    txt(place, M + colNo + 6, y - 15, 8, true);

    if (member) {
      txt(member.fullName || "", M + colNo + colPlace + 6, y - 15, 9, true, BLACK, colName - 12);
      txt(member.passportNo || "/////////", M + colNo + colPlace + colName + 6, y - 15, 8, false);
      txt(member.eNumber || "////////////", M + colNo + colPlace + colName + colPass + 6, y - 15, 8, false);
    } else {
      txt("///////////////", M + colNo + colPlace + 6, y - 15, 8, false);
      txt("/////////", M + colNo + colPlace + colName + 6, y - 15, 8, false);
      txt("////////////", M + colNo + colPlace + colName + colPass + 6, y - 15, 8, false);
    }
    y -= crewRowH;
  }

  return await pdf.save();
}

export function downloadPDF(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "document.pdf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openPDF(bytes, title = "PDF Document") {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  openPreviewModal({ title, blobUrl: url, fileName: `${title}.pdf` });
}