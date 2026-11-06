/* ═══════════════════════════════════════════════════════════
 * SMART HTML & OPERATIONAL TEMPLATE ENGINE — v1.0
 * - Recognizes fields inside HTML templates ({{placeholders}},
 *   <input>/<select>/<textarea>, data-field attributes, and
 *   Arabic/English aviation table label cells)
 * - Links recognized fields to AeroOps system data (Flight,
 *   Multi-Sector Legs, Actual JL Times/Fuel, Aircraft/CAMO,
 *   Crew/PIC/SIC, and Operator Settings)
 * - Auto-fills HTML templates live for Permits & Operational Forms
 * ═══════════════════════════════════════════════════════════ */
import { buildPermitAutoData } from "./pdfFiller";
import { PERMIT_FIELD_CATALOG } from "../config/permitCatalog";
import { toDisplayImageUrl } from "../api";

export const SYSTEM_DATA_CATALOG = [
  ...PERMIT_FIELD_CATALOG,
  // Extended Operational & Actual JL Fields
  { key: "status", label: "Flight Status / حالة الرحلة", group: "Flight", auto: true },
  { key: "actualStd", label: "Actual Block Off (24h) / وقت التحرك الفعلي", group: "Journey Log", auto: true },
  { key: "takeoff", label: "Actual Takeoff (24h) / وقت الإقلاع الفعلي", group: "Journey Log", auto: true },
  { key: "landing", label: "Actual Landing (24h) / وقت الهبوط الفعلي", group: "Journey Log", auto: true },
  { key: "actualSta", label: "Actual Block On (24h) / وقت التوقف الفعلي", group: "Journey Log", auto: true },
  { key: "blockTime", label: "Block Time (HH:MM) / زمن البلوك", group: "Journey Log", auto: true },
  { key: "blockFuel", label: "Block Fuel / وقود الإقلاع", group: "Journey Log", auto: true },
  { key: "fuelUsed", label: "Fuel Used / الوقود المستهلك", group: "Journey Log", auto: true },
  { key: "fuelRemaining", label: "Fuel Remaining / الوقود المتبقي", group: "Journey Log", auto: true },
  { key: "delayCode", label: "Delay Code / كود التأخير", group: "Journey Log", auto: true },
  { key: "foName", label: "First Officer (SIC) / المساعد الأول", group: "Crew", auto: true },
  { key: "foLicense", label: "FO License No / رخصة المساعد الأول", group: "Crew", auto: true },
  { key: "foPassport", label: "FO Passport No / جواز المساعد الأول", group: "Crew", auto: true },
  { key: "crewTableHtml", label: "Crew Manifest Table (HTML) / جدول قائمة الطاقم", group: "Crew", auto: true, isHtml: true },
  { key: "sectorsTableHtml", label: "Flight Sectors Table (HTML) / جدول قطاعات الرحلة", group: "Flight", auto: true, isHtml: true },
  { key: "permitsNotes", label: "Flight Permits Text / ملاحظات التصاريح", group: "Flight", auto: true },
  { key: "logoUrl", label: "Company Logo URL / رابط شعار الشركة", group: "Operator", auto: true },
  { key: "preparedBy", label: "Prepared By / أُعد بواسطة", group: "Operator", auto: true },
];

function logoToDirectDisplay(url) {
  return toDisplayImageUrl(url);
}

function calcBlock24(stdIso, staIso) {
  const s = stdIso ? String(stdIso).slice(11, 16) : "";
  const e = staIso ? String(staIso).slice(11, 16) : "";
  if (!s.includes(":") || !e.includes(":")) return "";
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return "";
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(
    diff % 60
  ).padStart(2, "0")}`;
}

/**
 * Builds the full dictionary of system values for any flight
 */
export function buildSystemAutoData({
  flight,
  selectedFlights = [],
  fleet = [],
  camoList = [],
  crew = [],
  settings = {},
  user = null,
}) {
  const base = buildPermitAutoData({
    flight,
    selectedFlights,
    fleet,
    camoList,
    crew,
    settings,
  });

  const resolvedCrew = (flight?.crewSlots || [])
    .map((s) => {
      const m = (crew || []).find((c) => String(c.id) === String(s.crewId));
      return m ? { slot: s, member: m } : null;
    })
    .filter(Boolean);

  const foEntry = resolvedCrew.find(
    (x) =>
      x.slot.position === "firstOfficer" ||
      x.slot.position === "FO" ||
      x.member.role === "firstOfficer"
  );
  const fo = foEntry?.member || null;

  const actual = flight?.actual || {};
  const actualStd = actual.std ? String(actual.std).slice(11, 16) : "";
  const actualSta = actual.sta ? String(actual.sta).slice(11, 16) : "";
  const takeoff = actual.takeoff ? String(actual.takeoff).slice(11, 16) : "";
  const landing = actual.landing ? String(actual.landing).slice(11, 16) : "";
  const blockTime = calcBlock24(actual.std || flight?.std, actual.sta || flight?.sta);

  const crewTableRows = resolvedCrew
    .map(
      (x, idx) =>
        `<tr>
          <td style="border:1px solid #334155;padding:4px 8px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-weight:bold;">${String(x.slot.position || "").toUpperCase()}</td>
          <td style="border:1px solid #334155;padding:4px 8px;">${x.member.fullName || "—"}</td>
          <td style="border:1px solid #334155;padding:4px 8px;">${x.member.nationality || "—"}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${x.member.passportNo || "—"}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${x.member.licenseNo || "—"}</td>
        </tr>`
    )
    .join("");

  const crewTableHtml =
    resolvedCrew.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:4px 0;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="border:1px solid #334155;padding:4px 8px;">#</th>
              <th style="border:1px solid #334155;padding:4px 8px;">POS</th>
              <th style="border:1px solid #334155;padding:4px 8px;">Full Name</th>
              <th style="border:1px solid #334155;padding:4px 8px;">Nat</th>
              <th style="border:1px solid #334155;padding:4px 8px;">Passport</th>
              <th style="border:1px solid #334155;padding:4px 8px;">License</th>
            </tr>
          </thead>
          <tbody>${crewTableRows}</tbody>
        </table>`
      : "—";

  const allSectors = [
    {
      seq: 1,
      date: flight?.std ? String(flight.std).slice(0, 10) : "",
      dep: flight?.dep || "—",
      arr: flight?.arr || "—",
      std: flight?.std ? String(flight.std).slice(11, 16) + "Z" : "—",
      sta: flight?.sta ? String(flight.sta).slice(11, 16) + "Z" : "—",
      acft: flight?.acft || "—",
    },
    ...(Array.isArray(flight?.legs)
      ? flight.legs.map((l, i) => ({
          seq: i + 2,
          date: l?.date || (l?.std ? String(l.std).slice(0, 10) : ""),
          dep: l?.dep || "—",
          arr: l?.arr || "—",
          std: l?.std ? String(l.std).slice(11, 16) + "Z" : "—",
          sta: l?.sta ? String(l.sta).slice(11, 16) + "Z" : "—",
          acft: l?.acft || flight?.acft || "—",
        }))
      : []),
  ];

  const sectorsTableHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:4px 0;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="border:1px solid #334155;padding:4px 8px;">Leg</th>
        <th style="border:1px solid #334155;padding:4px 8px;">Date</th>
        <th style="border:1px solid #334155;padding:4px 8px;">ADEP</th>
        <th style="border:1px solid #334155;padding:4px 8px;">STD (UTC)</th>
        <th style="border:1px solid #334155;padding:4px 8px;">ADES</th>
        <th style="border:1px solid #334155;padding:4px 8px;">STA (UTC)</th>
        <th style="border:1px solid #334155;padding:4px 8px;">ACFT</th>
      </tr>
    </thead>
    <tbody>
      ${allSectors
        .map(
          (s) => `<tr>
          <td style="border:1px solid #334155;padding:4px 8px;text-align:center;">${s.seq}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${s.date}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-weight:bold;font-family:monospace;">${s.dep}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${s.std}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-weight:bold;font-family:monospace;">${s.arr}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${s.sta}</td>
          <td style="border:1px solid #334155;padding:4px 8px;font-family:monospace;">${s.acft}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>`;

  return {
    ...base,
    status: flight?.status || "SCHEDULED",
    actualStd,
    takeoff,
    landing,
    actualSta,
    blockTime,
    blockFuel: actual.blockFuel ? String(actual.blockFuel) : "",
    fuelUsed: actual.fuelUsed ? String(actual.fuelUsed) : "",
    fuelRemaining: actual.fuelRemaining ? String(actual.fuelRemaining) : "",
    delayCode: actual.delayCode || "",
    foName: fo?.fullName || "",
    foLicense: fo?.licenseNo || "",
    foPassport: fo?.passportNo || "",
    crewTableHtml,
    sectorsTableHtml,
    permitsNotes: flight?.permits || "",
    logoUrl: logoToDirectDisplay(settings?.logo),
    preparedBy: user?.fullName || user?.username || settings?.contactPerson || "",
  };
}

/**
 * Matches an arbitrary English OR Arabic label/token to a known AeroOps system key
 */
export function matchLabelOrTokenToSystemKey(rawLabel) {
  if (!rawLabel) return null;
  const raw = String(rawLabel).trim();
  const exact = SYSTEM_DATA_CATALOG.find(
    (c) => c.key.toLowerCase() === raw.toLowerCase()
  );
  if (exact) return exact.key;

  const en = raw.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, "");
  if (!en) return null;

  // English & token matching
  if (
    en.includes("callsign") ||
    en.includes("flightno") ||
    en.includes("flightnumber") ||
    en.includes("fltno") ||
    raw.includes("رقم الرحلة") ||
    raw.includes("رمز النداء") ||
    raw.includes("نداء الطائرة")
  )
    return "flightNo";

  if (
    en.includes("aircrafttype") ||
    en.includes("actype") ||
    en.includes("typeofaircraft") ||
    raw.includes("طراز الطائرة") ||
    raw.includes("نوع الطائرة")
  )
    return "aircraftType";

  if (
    en.includes("registration") ||
    en.includes("acreg") ||
    en.includes("regmark") ||
    en === "aircraft" ||
    en === "reg" ||
    en === "acft" ||
    raw.includes("تسجيل الطائرة") ||
    raw.includes("علامات التسجيل") ||
    raw.includes("حروف التسجيل")
  )
    return "aircraft";

  if (
    en.includes("operatornamear") ||
    raw.includes("اسم المشغل بالعربية")
  )
    return "operatorNameAr";

  if (
    en.includes("operatorcode") ||
    en.includes("icaocode") ||
    raw.includes("رمز المشغل")
  )
    return "operatorCode";

  if (
    en.includes("operatorname") ||
    en.includes("aircarrier") ||
    en === "operator" ||
    raw.includes("مشغل الرحلة") ||
    raw.includes("اسم المشغل") ||
    raw.includes("الجهة المشغلة") ||
    raw.includes("الشركة المشغلة")
  )
    return "operatorName";

  if (
    en.includes("crewtable") ||
    raw.includes("جدول الطاقم") ||
    raw.includes("كشف الطاقم")
  )
    return "crewTableHtml";

  if (
    en.includes("sectorstable") ||
    raw.includes("جدول القطاعات")
  )
    return "sectorsTableHtml";

  if (
    en.includes("route") ||
    en.includes("sectors") ||
    en.includes("routing") ||
    raw.includes("خط السير") ||
    raw.includes("القطاعات") ||
    raw.includes("مسار الرحلة")
  )
    return "route";

  if (
    en.includes("departurefull") ||
    raw.includes("مدينة المغادرة")
  )
    return "departureFull";

  if (
    en.includes("arrivalfull") ||
    raw.includes("مدينة الوصول")
  )
    return "arrivalFull";

  if (
    en.includes("departure") ||
    en === "adep" ||
    en === "dep" ||
    en === "origin" ||
    raw.includes("مطار المغادرة") ||
    raw.includes("مطار الإقلاع")
  )
    return "departure";

  if (
    en.includes("arrival") ||
    en === "ades" ||
    en === "arr" ||
    en === "destination" ||
    raw.includes("مطار الوصول") ||
    raw.includes("مطار الهبوط") ||
    raw.includes("الوجهة")
  )
    return "arrival";

  if (
    en.includes("actualstd") ||
    en.includes("bloff") ||
    en.includes("blockoff") ||
    raw.includes("وقت التحرك الفعلي")
  )
    return "actualStd";

  if (
    en.includes("actualsta") ||
    en.includes("blon") ||
    en.includes("blockon") ||
    raw.includes("وقت التوقف الفعلي")
  )
    return "actualSta";

  if (
    en.includes("takeoff") ||
    raw.includes("الإقلاع الفعلي")
  )
    return "takeoff";

  if (
    en.includes("landing") && !en.includes("permit") ||
    raw.includes("الهبوط الفعلي")
  )
    return "landing";

  if (
    en.includes("blocktime") ||
    raw.includes("زمن البلوك")
  )
    return "blockTime";

  if (
    en === "std" ||
    en === "etd" ||
    en.includes("deptime") ||
    raw.includes("وقت الإقلاع") ||
    raw.includes("موعد الإقلاع") ||
    raw.includes("ساعة الإقلاع")
  )
    return "std";

  if (
    en === "sta" ||
    en === "eta" ||
    en.includes("arrtime") ||
    raw.includes("وقت الوصول") ||
    raw.includes("موعد الوصول") ||
    raw.includes("ساعة الوصول")
  )
    return "sta";

  if (
    en.includes("dateofflight") ||
    en.includes("flightdate") ||
    en === "dof" ||
    en === "date" ||
    raw.includes("تاريخ التشغيل") ||
    raw.includes("تاريخ الرحلة") ||
    raw === "التاريخ"
  )
    return "date";

  if (
    en.includes("purpose") ||
    en.includes("natureofflight") ||
    raw.includes("الغرض من الرحلة") ||
    raw.includes("طبيعة الرحلة") ||
    raw.includes("هدف الرحلة")
  )
    return "purpose";

  if (
    en.includes("coa") ||
    en.includes("airworthiness") ||
    raw.includes("شهادة الصلاحية") ||
    raw.includes("صلاحية الطائرة")
  )
    return "coaExpiry";

  if (
    en.includes("insurance") ||
    raw.includes("التأمين") ||
    raw.includes("وثيقة التأمين")
  )
    return "insuranceExpiry";

  if (
    en.includes("noise") ||
    raw.includes("الضوضاء")
  )
    return "noiseCertExpiry";

  if (
    en.includes("seatcapacity") ||
    en.includes("capacity") ||
    raw.includes("سعة المقاعد")
  )
    return "seatCapacity";

  if (
    en === "pax" ||
    en.includes("passenger") ||
    en.includes("paxcount") ||
    raw.includes("عدد الركاب") ||
    raw.includes("الركاب")
  )
    return "pax";

  if (
    en.includes("cargo") ||
    en.includes("freight") ||
    raw.includes("الشحن") ||
    raw.includes("الحمولة")
  )
    return "cargo";

  if (
    en.includes("piclicense") ||
    raw.includes("رخصة الكابتن") ||
    raw.includes("رقم الرخصة")
  )
    return "picLicense";

  if (
    en.includes("picpassport") ||
    raw.includes("جواز الكابتن") ||
    raw.includes("جواز السفر")
  )
    return "picPassport";

  if (
    en.includes("picnationality") ||
    raw.includes("جنسية الكابتن")
  )
    return "picNationality";

  if (
    en.includes("pic") ||
    en.includes("captain") ||
    en.includes("commander") ||
    raw.includes("قائد الطائرة") ||
    raw.includes("اسم الكابتن") ||
    raw.includes("الكابتن")
  )
    return "picName";

  if (
    en.includes("firstofficer") ||
    en.includes("foname") ||
    en === "sic" ||
    raw.includes("المساعد الأول")
  )
    return "foName";

  if (
    en.includes("crewcount") ||
    raw.includes("عدد الطاقم") ||
    raw.includes("عدد أفراد الطاقم")
  )
    return "crewCount";

  if (
    en === "crew" ||
    en.includes("crewlist") ||
    raw.includes("قائمة الطاقم") ||
    raw.includes("أفراد الطاقم")
  )
    return "crew";

  if (
    en.includes("handling") ||
    raw.includes("المناولة") ||
    raw.includes("وكيل الخدمة")
  )
    return "handlingAgent";

  if (
    en.includes("entrypoint") ||
    en.includes("firentry") ||
    raw.includes("نقطة الدخول") ||
    raw.includes("دخول المجال")
  )
    return "entryPoint";

  if (
    en.includes("exitpoint") ||
    en.includes("firexit") ||
    raw.includes("نقطة الخروج") ||
    raw.includes("خروج المجال")
  )
    return "exitPoint";

  if (
    en.includes("atsroute") ||
    en.includes("airway") ||
    raw.includes("المسار الجوي")
  )
    return "atsRoute";

  if (
    en.includes("permitno") ||
    en.includes("permitnumber") ||
    raw.includes("رقم التصريح")
  )
    return "permitNo";

  if (en.includes("sita") || raw.includes("سيتا")) return "sita";
  if (en.includes("fax") || raw.includes("فاكس")) return "fax";
  if (en.includes("phone") || en.includes("tel") || raw.includes("هاتف")) return "phone";
  if (en.includes("email") || raw.includes("البريد الإلكتروني")) return "email";
  if (en.includes("address") || raw.includes("العنوان")) return "address";
  if (en.includes("blockfuel") || raw.includes("وقود الإقلاع")) return "blockFuel";
  if (en.includes("fuelused") || raw.includes("الوقود المستهلك")) return "fuelUsed";
  if (en.includes("fuelremaining") || raw.includes("الوقود المتبقي")) return "fuelRemaining";
  if (en.includes("preparedby") || raw.includes("أعد بواسطة") || raw.includes("مقدم الطلب")) return "preparedBy";

  return null;
}

/**
 * Recognizes fields in any HTML document/snippet:
 * 1) Placeholders: {{token}}, [[token]], {token} (single-word tokens)
 * 2) Form controls: <input>, <textarea>, <select>, [data-field], [data-key], [data-bind]
 * 3) Table label -> empty/placeholder value cells: <td>Label</td><td></td>
 *
 * Returns { annotatedHtml, fields } where annotatedHtml tags discovered DOM cells
 * with data-aero-slot="<slotId>" so fillHtmlTemplate can populate them accurately!
 */
export function recognizeHtmlTemplateFields(rawHtml = "") {
  const html = String(rawHtml || "");
  if (!html.trim()) return { annotatedHtml: "", fields: [] };

  const discovered = [];
  const seenKeys = new Set();

  const registerField = ({ slotId, token, rawLabel, suggestedKey, sourceType }) => {
    const matchedKey = suggestedKey || matchLabelOrTokenToSystemKey(token || rawLabel);
    const catalogItem = matchedKey
      ? SYSTEM_DATA_CATALOG.find((c) => c.key === matchedKey)
      : null;

    const finalKey =
      matchedKey ||
      "manual_" +
        String(token || rawLabel || "field")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .slice(0, 28) +
        (slotId ? `_${slotId}` : "");

    // Avoid duplicating exact same placeholder token twice in UI list
    const dedupeSig = token ? `tok:${token}` : `slot:${slotId}`;
    if (seenKeys.has(dedupeSig)) return finalKey;
    seenKeys.add(dedupeSig);

    discovered.push({
      slotId: slotId || "",
      token: token || "",
      key: finalKey,
      systemKey: matchedKey || "",
      label: catalogItem?.label || rawLabel || token || finalKey,
      rawLabel: rawLabel || token || finalKey,
      auto: Boolean(matchedKey && catalogItem?.auto !== false),
      sourceType, // 'placeholder' | 'input' | 'table_cell' | 'data_attr'
    });
    return finalKey;
  };

  // 1. Scan {{token}} and [[token]] placeholders first
  const doubleBraceRegex = /\{\{\s*([a-zA-Z0-9_.\-\u0600-\u06FF\s]{1,50}?)\s*\}\}|\[\[\s*([a-zA-Z0-9_.\-\u0600-\u06FF\s]{1,50}?)\s*\]\]/g;
  let match;
  while ((match = doubleBraceRegex.exec(html)) !== null) {
    const tok = (match[1] || match[2] || "").trim();
    if (!tok) continue;
    registerField({
      slotId: "",
      token: match[0],
      rawLabel: tok,
      suggestedKey: matchLabelOrTokenToSystemKey(tok),
      sourceType: "placeholder",
    });
  }

  // Also scan single-brace {token} when not inside <style> or <script>
  const strippedScripts = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  const singleBraceRegex = /(?<!\{)\{([a-zA-Z][a-zA-Z0-9_]{1,32})\}(?!\})/g;
  while ((match = singleBraceRegex.exec(strippedScripts)) !== null) {
    const tok = match[1].trim();
    registerField({
      slotId: "",
      token: `{${tok}}`,
      rawLabel: tok,
      suggestedKey: matchLabelOrTokenToSystemKey(tok),
      sourceType: "placeholder",
    });
  }

  // 2. Parse DOM for <input>/<textarea>/<select>, [data-field], and <table> label-value pairs
  let annotatedHtml = html;
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      let slotCounter = 1;

      // 2a. Explicit [data-field], [data-key], [data-bind]
      doc.querySelectorAll("[data-field], [data-key], [data-bind]").forEach((el) => {
        const attrKey =
          el.getAttribute("data-field") ||
          el.getAttribute("data-key") ||
          el.getAttribute("data-bind") ||
          "";
        if (!attrKey) return;
        const slotId = el.getAttribute("data-aero-slot") || `s${slotCounter++}`;
        el.setAttribute("data-aero-slot", slotId);
        registerField({
          slotId,
          token: "",
          rawLabel: attrKey,
          suggestedKey: matchLabelOrTokenToSystemKey(attrKey),
          sourceType: "data_attr",
        });
      });

      // 2b. Form inputs (<input>, <textarea>, <select>)
      doc.querySelectorAll("input, textarea, select").forEach((el) => {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        if (["submit", "button", "hidden", "reset"].includes(type)) return;
        const slotId = el.getAttribute("data-aero-slot") || `s${slotCounter++}`;
        el.setAttribute("data-aero-slot", slotId);

        const nameHint =
          el.getAttribute("data-field") ||
          el.getAttribute("name") ||
          el.getAttribute("id") ||
          el.getAttribute("placeholder") ||
          "";

        // Check preceding <label> or parent cell text if nameHint is generic
        let labelHint = nameHint;
        const idAttr = el.getAttribute("id");
        if (idAttr) {
          const lbl = doc.querySelector(`label[for="${CSS.escape(idAttr)}"]`);
          if (lbl?.textContent?.trim()) labelHint = lbl.textContent.trim();
        }
        if (!labelHint) {
          const parentTd = el.closest("td, th");
          const prevTd = parentTd?.previousElementSibling;
          if (prevTd?.textContent?.trim()) {
            labelHint = prevTd.textContent.trim();
          }
        }

        registerField({
          slotId,
          token: "",
          rawLabel: labelHint || `حقل إدخال #${slotCounter}`,
          suggestedKey:
            matchLabelOrTokenToSystemKey(nameHint) ||
            matchLabelOrTokenToSystemKey(labelHint),
          sourceType: "input",
        });
      });

      // 2c. Table label -> empty/placeholder value cell detection
      doc.querySelectorAll("tr").forEach((tr) => {
        const cells = Array.from(tr.children).filter(
          (c) => c.tagName === "TD" || c.tagName === "TH"
        );
        for (let i = 0; i < cells.length - 1; i++) {
          const labelCell = cells[i];
          const valCell = cells[i + 1];
          if (
            valCell.hasAttribute("data-aero-slot") ||
            valCell.querySelector("input, textarea, select, table")
          ) {
            continue;
          }
          const valText = (valCell.textContent || "").trim();
          // Only auto-bind value cells that are blank or contain filler markers ("—", "...", "---", "N/A")
          const isBlankOrFiller =
            valText === "" ||
            /^[-—_.…/\s]+$/.test(valText) ||
            /^\{\{.*\}\}$/.test(valText);
          if (!isBlankOrFiller || /^\{\{.*\}\}$/.test(valText)) continue;

          const labelText = (labelCell.textContent || "").trim();
          if (!labelText || labelText.length > 90) continue;

          const matchedKey = matchLabelOrTokenToSystemKey(labelText);
          if (matchedKey) {
            const slotId = `s${slotCounter++}`;
            valCell.setAttribute("data-aero-slot", slotId);
            registerField({
              slotId,
              token: "",
              rawLabel: labelText,
              suggestedKey: matchedKey,
              sourceType: "table_cell",
            });
            i++; // Advance past the value cell
          }
        }
      });

      const hasFullDoc = /<html[\s>]/i.test(html);
      annotatedHtml = hasFullDoc
        ? "<!DOCTYPE html>\n" + doc.documentElement.outerHTML
        : doc.body.innerHTML;
    } catch (e) {
      console.warn("HTML template DOM recognition warning:", e);
    }
  }

  return { annotatedHtml, fields: discovered };
}

/**
 * Fills an HTML template using recognized field mappings and flight/system data
 */
export function fillHtmlTemplate(
  htmlTemplate = "",
  fields = [],
  data = {},
  options = { highlightEmpty: true }
) {
  let output = String(htmlTemplate || "");
  if (!output.trim()) return "";

  const resolveValueForField = (f) => {
    if (!f) return "";
    if (f.systemKey && data[f.systemKey] !== undefined && data[f.systemKey] !== "") {
      return data[f.systemKey];
    }
    if (f.key && data[f.key] !== undefined && data[f.key] !== "") {
      return data[f.key];
    }
    const matched = matchLabelOrTokenToSystemKey(
      f.systemKey || f.key || f.label || f.rawLabel || f.token
    );
    if (matched && data[matched] !== undefined && data[matched] !== "") {
      return data[matched];
    }
    return "";
  };

  // 1. Replace explicit mapped placeholder tokens first
  (fields || []).forEach((f) => {
    if (f.token) {
      const val = resolveValueForField(f);
      const isHtmlField =
        f.systemKey === "crewTableHtml" || f.systemKey === "sectorsTableHtml";
      const replacement =
        val !== ""
          ? String(val)
          : options.highlightEmpty
          ? `<span style="background:#fef3c7;color:#b45309;padding:1px 6px;border-radius:3px;font-size:11px;">[${f.label || f.rawLabel}]</span>`
          : "";
      output = output.split(f.token).join(isHtmlField ? replacement : replacement);
    }
  });

  // 2. Replace any standard {{systemKey}} or {systemKey} directly from data dictionary
  output = output.replace(
    /\{\{\s*([a-zA-Z0-9_.\-\u0600-\u06FF\s]{1,50}?)\s*\}\}|\[\[\s*([a-zA-Z0-9_.\-\u0600-\u06FF\s]{1,50}?)\s*\]\]/g,
    (full, g1, g2) => {
      const tok = (g1 || g2 || "").trim();
      const direct = data[tok];
      if (direct !== undefined && direct !== "") return String(direct);
      const sysKey = matchLabelOrTokenToSystemKey(tok);
      if (sysKey && data[sysKey] !== undefined && data[sysKey] !== "") {
        return String(data[sysKey]);
      }
      return options.highlightEmpty
        ? `<span style="background:#fef3c7;color:#b45309;padding:1px 6px;border-radius:3px;font-size:11px;">[${tok}]</span>`
        : "";
    }
  );

  // 3. Populate DOM [data-aero-slot] elements (<input>, <textarea>, <select>, <td>)
  if (typeof DOMParser !== "undefined" && output.includes("data-aero-slot")) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(output, "text/html");

      (fields || []).forEach((f) => {
        if (!f.slotId) return;
        const el = doc.querySelector(`[data-aero-slot="${f.slotId}"]`);
        if (!el) return;
        const val = resolveValueForField(f);
        const tag = el.tagName.toUpperCase();
        const isHtmlField =
          f.systemKey === "crewTableHtml" || f.systemKey === "sectorsTableHtml";

        if (tag === "INPUT") {
          el.setAttribute("value", val !== "" ? String(val) : "");
        } else if (tag === "TEXTAREA") {
          el.textContent = val !== "" ? String(val) : "";
        } else if (tag === "SELECT") {
          Array.from(el.querySelectorAll("option")).forEach((opt) => {
            if (opt.value === String(val) || opt.textContent?.trim() === String(val)) {
              opt.setAttribute("selected", "selected");
            }
          });
        } else if (isHtmlField && val) {
          el.innerHTML = String(val);
        } else if (val !== "") {
          el.textContent = String(val);
        } else if (options.highlightEmpty) {
          el.innerHTML = `<span style="background:#fef3c7;color:#b45309;padding:1px 6px;border-radius:3px;font-size:11px;">[${
            f.label || f.rawLabel || "—"
          }]</span>`;
        }
      });

      const hasFullDoc = /<html[\s>]/i.test(output);
      output = hasFullDoc
        ? "<!DOCTYPE html>\n" + doc.documentElement.outerHTML
        : doc.body.innerHTML;
    } catch (e) {
      console.warn("DOM fill warning:", e);
    }
  }

  return output;
}

/**
 * Wraps an HTML snippet in a clean printable A4 page if it isn't already a full HTML document
 */
export function buildPrintableHtmlDocument(
  filledHtml,
  title = "Document",
  options = {}
) {
  const trimmed = String(filledHtml || "").trim();
  const stampSrc = options?.stampUrl
    ? logoToDirectDisplay(options.stampUrl)
    : "";
  const stampBlock = stampSrc
    ? `\n<div class="aeroops-official-stamp" style="margin-top:18px;padding-top:10px;display:flex;justify-content:flex-end;page-break-inside:avoid;">
  <div style="text-align:center;">
    <img src="${stampSrc}" alt="Official Stamp" style="max-height:85px;max-width:140px;object-fit:contain;opacity:0.88;" />
  </div>
</div>\n`
    : "";

  if (/^<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    if (stampBlock && !trimmed.includes("aeroops-official-stamp")) {
      if (/<\/body>/i.test(trimmed)) {
        return trimmed.replace(/<\/body>/i, `${stampBlock}</body>`);
      }
      return trimmed + stampBlock;
    }
    return trimmed;
  }
  const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
  return `<!DOCTYPE html>
<html dir="${hasArabic ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 16px;
      line-height: 1.5;
    }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #334155; padding: 6px 8px; vertical-align: middle; }
    th { background: #f1f5f9; font-weight: 700; }
    img { max-height: 85px; object-fit: contain; }
  </style>
</head>
<body>
${trimmed}${stampBlock}
</body>
</html>`;
}
