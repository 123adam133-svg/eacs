/* ═══════════════════════════════════════════════════════════
 * STANDARD IATA DELAY CODES & HELPERS
 * Supports live prefix/substring search, dropdown selection, and numeric entry.
 * ═══════════════════════════════════════════════════════════ */

export const IATA_DELAY_CODES = [
  // Airline Internal / Scheduled (00-09)
  { code: "00", ar: "أسباب تشغيلية داخلية أخرى", en: "Airline internal / Miscellaneous", category: "OPS" },
  { code: "01", ar: "تعديل جدول الرحلات لأسباب تجارية", en: "Airline internal commercial schedule change", category: "OPS" },
  { code: "02", ar: "إعادة جدولة / نقص طائرات الأسطول", en: "Airline internal fleet shortage", category: "OPS" },
  { code: "03", ar: "نقص طاقم أو تعديل مناوبات داخلية", en: "Airline internal crew scheduling", category: "OPS" },
  { code: "04", ar: "تحديث متطلبات التشغيل والعمليات", en: "Airline internal operations requirement", category: "OPS" },
  { code: "05", ar: "تجهيز طائرة بديلة احتياطية", en: "Airline internal standby aircraft prep", category: "OPS" },
  { code: "06", ar: "عدم توفر بوابة أو موقف طائرة", en: "No gate / stand availability due to airline", category: "OPS" },
  { code: "09", ar: "وقت المكوث الأرضي أقل من الحد الأدنى المعلن", en: "Scheduled ground time less than declared minimum ground time", category: "OPS" },

  // Passenger & Baggage (11-19)
  { code: "11", ar: "تأخر وصول الركاب (Late Check-in)", en: "Late check-in after deadline", category: "PAX" },
  { code: "12", ar: "ازدحام أو خطأ في إجراءات السفر", en: "Late check-in congestion in check-in area", category: "PAX" },
  { code: "13", ar: "خطأ في تسجيل الركاب أو المقاعد", en: "Check-in error, passenger and baggage", category: "PAX" },
  { code: "14", ar: "زيادة الحجز / تعديل المقاعد", en: "Oversales / booking discrepancy", category: "PAX" },
  { code: "15", ar: "تأخر صعود الركاب للطائرة (Boarding)", en: "Boarding discrepancies and paging, missing checked-in PAX", category: "PAX" },
  { code: "16", ar: "ركاب VIP / احتياجات تجارية خاصة", en: "Commercial publicity / passenger convenience / VIP", category: "PAX" },
  { code: "17", ar: "تأخر طلب وتجهيز التموين الخاص", en: "Catering order / special passenger requests", category: "PAX" },
  { code: "18", ar: "فرز وتحميل الأمتعة", en: "Baggage processing, sorting etc.", category: "PAX" },
  { code: "19", ar: "صعود ونزول الركاب ذوي الاحتياجات الخاصة", en: "Reduced Mobility, Boarding/Deboarding of passengers with reduced mobility", category: "PAX" },

  // Cargo & Mail (21-29)
  { code: "21", ar: "توثيق وتجهيز الشحن", en: "Cargo documentation, errors etc.", category: "CGO" },
  { code: "22", ar: "تأخر تحميل وترتيب الشحن", en: "Late positioning of cargo", category: "CGO" },
  { code: "23", ar: "قبول متأخر للشحن الجوي", en: "Late acceptance of cargo", category: "CGO" },
  { code: "24", ar: "تغليف غير مطابق لمعايير الشحن", en: "Inadequate packing of cargo", category: "CGO" },
  { code: "26", ar: "تجهيز البضائع الخطرة أو الخاصة", en: "Late preparation in warehouse (DG / Special)", category: "CGO" },
  { code: "27", ar: "وثائق البريد الجوي", en: "Mail documentation, packing etc.", category: "CGO" },
  { code: "28", ar: "تأخر نقل البريد إلى الطائرة", en: "Mail late positioning", category: "CGO" },
  { code: "29", ar: "تأخر قبول البريد الجوي", en: "Mail Late acceptance", category: "CGO" },

  // Aircraft & Ramp Handling (31-39)
  { code: "31", ar: "تأخر وثائق الطائرة والوزن والتوازن", en: "Aircraft documentation late/inaccurate, weight and balance", category: "RAMP" },
  { code: "32", ar: "تأخر تحميل أو تفريغ الطائرة", en: "Loading/unloading, bulky/special load, lack of staff", category: "RAMP" },
  { code: "33", ar: "تأخر معدات التحميل الأرضية", en: "Loading equipment, lack of or breakdown", category: "RAMP" },
  { code: "34", ar: "تأخر معدات الخدمات وتنظيف المقصورة", en: "Servicing equipment, lack of or breakdown, cabin cleaning", category: "RAMP" },
  { code: "35", ar: "تنظيف وتجهيز المقصورة", en: "Aircraft cleaning", category: "RAMP" },
  { code: "36", ar: "تأخر التزود بالوقود (Fuelling)", en: "Fuelling/defuelling, fuel supplier", category: "RAMP" },
  { code: "37", ar: "تأخر تموين الطائرة والوجبات (Catering)", en: "Catering, late delivery or loading", category: "RAMP" },
  { code: "38", ar: "نقص أو تأخر وحدات التحميل (ULD)", en: "ULD, lack of or serviceability", category: "RAMP" },
  { code: "39", ar: "نقص المعدات الفنية أو طاقم الدفع الخلفي", en: "Technical equipment, lack of or breakdown, lack of staff, e.g. pushback", category: "RAMP" },

  // Technical & Aircraft Equipment (41-46)
  { code: "41", ar: "عطل فني في الطائرة / MEL", en: "Aircraft defects / MEL", category: "TECH" },
  { code: "42", ar: "تجاوز وقت الصيانة المجدولة", en: "Scheduled maintenance, late release", category: "TECH" },
  { code: "43", ar: "فحوصات صيانة غير مجدولة", en: "Non-scheduled maintenance, special checks", category: "TECH" },
  { code: "44", ar: "نقص قطع غيار أو معدات صيانة", en: "Spares and maintenance equipment, lack of or breakdown", category: "TECH" },
  { code: "45", ar: "انتظار وصول قطعة غيار (AOG)", en: "AOG spares, to be carried to another station", category: "TECH" },
  { code: "46", ar: "تغيير الطائرة لأسباب فنية", en: "Aircraft change for technical reasons", category: "TECH" },

  // Damage & EDP (51-58)
  { code: "51", ar: "ضرر أثناء الرحلة (اصطدام طيور / مطبات)", en: "Damage during flight operations (bird/lightning strike)", category: "TECH" },
  { code: "52", ar: "ضرر أثناء الخدمة الأرضية", en: "Damage during ground operations", category: "TECH" },
  { code: "55", ar: "تعطل أنظمة التحكم بالمغادرة", en: "Departure control system failure", category: "OPS" },
  { code: "57", ar: "تأخر خطة الطيران الآلية", en: "Flight plans / automated systems failure", category: "OPS" },

  // Flight Operations & Crew (61-69)
  { code: "61", ar: "تأخر استكمال خطة الطيران والوثائق", en: "Flight plan, late completion or change of flight documentation", category: "CREW" },
  { code: "62", ar: "تعديلات تشغيلية (وقود / حمولة)", en: "Operational requirements, fuel, load alteration", category: "CREW" },
  { code: "63", ar: "تأخر صعود طاقم القيادة أو إجراءاتهم", en: "Late crew boarding or departure procedures", category: "CREW" },
  { code: "64", ar: "نقص أو راحة طاقم القيادة (FTL)", en: "Flight deck crew shortage, sickness, standby, FTL", category: "CREW" },
  { code: "65", ar: "طلب خاص من طاقم القيادة", en: "Flight deck crew special request", category: "CREW" },
  { code: "66", ar: "تأخر طاقم الضيافة", en: "Late cabin crew boarding or departure procedures", category: "CREW" },
  { code: "67", ar: "نقص طاقم الضيافة", en: "Cabin crew shortage, sickness, standby, FTL", category: "CREW" },
  { code: "68", ar: "أخطاء أو ظروف طاقم الضيافة الخاصة", en: "Cabin crew error or special request", category: "CREW" },
  { code: "69", ar: "طلب القبطان لفحص أمني استثنائي", en: "Captain request for security check, extraordinary", category: "CREW" },

  // Weather (71-79)
  { code: "71", ar: "سوء الأحوال الجوية بمطار الإقلاع", en: "Weather at departure station below limits", category: "WX" },
  { code: "72", ar: "سوء الأحوال الجوية بمطار الوصول", en: "Weather at destination below limits", category: "WX" },
  { code: "73", ar: "أحوال جوية في المسار أو المطار البديل", en: "Weather en-route or alternate", category: "WX" },
  { code: "75", ar: "إزالة الجليد عن الطائرة (De-icing)", en: "De-icing of aircraft, removal of ice/snow", category: "WX" },
  { code: "76", ar: "إزالة الثلوج وإغلاق المدرج أو الساحة", en: "Removal of snow/ice/water/sand from airport", category: "WX" },
  { code: "77", ar: "ظروف مناخية وأتربة بالمطار الأرضي", en: "Ground handling impaired by adverse weather", category: "WX" },

  // ATC & ATFM (81-84)
  { code: "81", ar: "قيود المراقبة الجوية (ATFM En-route)", en: "ATFM due to ATC en-route demand/capacity", category: "ATC" },
  { code: "82", ar: "تقييد المراقبة الجوية بمطار الإقلاع", en: "ATFM due to ATC staff/equipment en-route", category: "ATC" },
  { code: "83", ar: "قيود المراقبة الجوية بمطار الوصول / السلوت", en: "ATFM due to restriction at destination airport", category: "ATC" },
  { code: "84", ar: "تقييد المجال الجوي أو الطقس من ATFM", en: "ATFM due to weather at destination", category: "ATC" },

  // Airport & Governmental Authorities (85-89)
  { code: "85", ar: "إجراءات أمنية إلزامية / إغلاق مدرج / نوتام", en: "Mandatory security / NOTAM / runway closure", category: "APT" },
  { code: "86", ar: "إجراءات الجمارك والهجرة والصحة", en: "Immigration, customs, health", category: "APT" },
  { code: "87", ar: "محدودية مرافق ومواقف المطار", en: "Airport facilities, parking stands, ramp congestion", category: "APT" },
  { code: "88", ar: "قيود المطار بالوجهة", en: "Restrictions at airport of destination", category: "APT" },
  { code: "89", ar: "قيود مطار المغادرة / السلوت وتصاريح الحركة", en: "Restrictions at airport of departure with or without ATFM", category: "APT" },

  // Reactionary & Miscellaneous (91-99)
  { code: "91", ar: "انتظار ركاب أو حمولة من رحلة قادمة", en: "Load connection, awaiting load from another flight", category: "REAC" },
  { code: "92", ar: "تأخر تسجيل الركاب عبر الرحلات المترابطة", en: "Through check-in error, passenger and baggage", category: "REAC" },
  { code: "93", ar: "دوران الطائرة (تأخر وصول الرحلة السابقة)", en: "Aircraft rotation, late arrival from previous sector", category: "REAC" },
  { code: "94", ar: "دوران طاقم الضيافة", en: "Cabin crew rotation, awaiting crew from another flight", category: "REAC" },
  { code: "95", ar: "دوران طاقم القيادة أو الطاقم المشترك", en: "Crew rotation, awaiting flight deck crew from another flight", category: "REAC" },
  { code: "96", ar: "إعادة توجيه أو تغيير مسار العمليات", en: "Operations control, rerouting, diversion, aircraft change", category: "REAC" },
  { code: "97", ar: "إضراب أو ظروف عمالية داخل الشركة", en: "Industrial action within own airline", category: "MISC" },
  { code: "98", ar: "إضراب أو ظروف عمالية خارج الشركة", en: "Industrial action outside own airline", category: "MISC" },
  { code: "99", ar: "أسباب أخرى غير مصنفة", en: "Miscellaneous / Unclassified", category: "MISC" },
];

export function normalizeDelayCode(raw) {
  const clean = String(raw ?? "").trim().toUpperCase();
  if (!clean) return "";
  return clean.slice(0, 6);
}

export function searchDelayCodes(query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return IATA_DELAY_CODES;
  return IATA_DELAY_CODES.filter((d) => {
    return (
      d.code.toLowerCase().includes(q) ||
      d.en.toLowerCase().includes(q) ||
      d.ar.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    );
  });
}

export function findDelayCodeInfo(rawCode) {
  const code = normalizeDelayCode(rawCode);
  if (!code) return null;
  const exact = IATA_DELAY_CODES.find((d) => d.code === code);
  if (exact) return exact;
  // Also try padded 2-digit match if user typed e.g. "9" -> check "09" only if exact match fails? Keep exact "9" fallback unless 2 digits
  const padded = code.length === 1 && /^\d$/.test(code) ? `0${code}` : null;
  if (padded) {
    const padMatch = IATA_DELAY_CODES.find((d) => d.code === padded);
    if (padMatch) return padMatch;
  }
  const num = parseInt(code, 10);
  if (!Number.isNaN(num)) {
    if (num >= 0 && num <= 9) return { code, ar: "أسباب تشغيلية داخلية (كود مخصص)", en: "Airline internal (Custom)", category: "OPS" };
    if (num >= 10 && num <= 19) return { code, ar: "تأخير ركاب وأمتعة (كود مخصص)", en: "Passenger / Baggage", category: "PAX" };
    if (num >= 20 && num <= 29) return { code, ar: "تأخير شحن وبريد (كود مخصص)", en: "Cargo / Mail", category: "CGO" };
    if (num >= 30 && num <= 39) return { code, ar: "تأخير مناولة وساحة (كود مخصص)", en: "Aircraft & Ramp Handling", category: "RAMP" };
    if (num >= 40 && num <= 49) return { code, ar: "تأخير فني / صيانة (كود مخصص)", en: "Technical / Maintenance", category: "TECH" };
    if (num >= 50 && num <= 59) return { code, ar: "تضرر أو أنظمة (كود مخصص)", en: "Damage / Systems", category: "TECH" };
    if (num >= 60 && num <= 69) return { code, ar: "تأخير عمليات وطاقم (كود مخصص)", en: "Flight Ops / Crew", category: "CREW" };
    if (num >= 70 && num <= 79) return { code, ar: "تأخير أحوال جوية (كود مخصص)", en: "Weather", category: "WX" };
    if (num >= 80 && num <= 84) return { code, ar: "تأخير مراقبة جوية ATFM (كود مخصص)", en: "ATFM / ATC", category: "ATC" };
    if (num >= 85 && num <= 89) return { code, ar: "تأخير مطار وتصاريح (كود مخصص)", en: "Airport / Authority", category: "APT" };
    if (num >= 90 && num <= 96) return { code, ar: "تأخير تتابعي / دوران (كود مخصص)", en: "Reactionary", category: "REAC" };
  }
  return {
    code,
    ar: `رمز تأخير مخصص (${code})`,
    en: `Custom Delay (${code})`,
    category: "CUSTOM",
  };
}

export function formatDelaySummary(rawCode, delayMinutes, isAr = true) {
  const info = findDelayCodeInfo(rawCode);
  if (!info) return "";
  const mins = Number(delayMinutes) || 0;
  const durStr = mins > 0 ? ` · ${mins}m` : "";
  return `${info.code} - ${isAr ? info.ar : info.en}${durStr}`;
}
