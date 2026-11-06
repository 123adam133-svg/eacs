/* ═══════════════════════════════════════════════════════════
 * AIRPORT → COUNTRY MAPPING
 * يربط كود ICAO للمطار بالدولة
 * ═══════════════════════════════════════════════════════════ */

/* ═══ خريطة بادئات ICAO → الدولة ═══
 * كل بادئة من 2 حرف تمثل منطقة/دولة
 * Reference: ICAO Location Indicators (Doc 7910)
 */
export const ICAO_PREFIX_TO_COUNTRY = {
  /* ═══ Africa — North ═══ */
  HL: "Libya",
  HE: "Egypt",
  DT: "Tunisia",
  DA: "Algeria",
  GM: "Morocco",
  GS: "Western Sahara",
  HS: "Sudan",
  HH: "Eritrea",
  HA: "Ethiopia",
  HC: "Somalia",
  HD: "Djibouti",
  HK: "Kenya",
  HR: "Rwanda",
  HT: "Tanzania",
  HU: "Uganda",
  HB: "Burundi",

  /* ═══ Africa — West ═══ */
  DR: "Niger",
  DN: "Nigeria",
  DG: "Ghana",
  DI: "Côte d'Ivoire",
  DB: "Benin",
  DX: "Togo",
  DXXX: "Togo",
  GL: "Liberia",
  GF: "Sierra Leone",
  GB: "Gambia",
  GG: "Guinea-Bissau",
  GU: "Guinea",
  GQ: "Mauritania",
  GA: "Mali",
  GX: "Mali",
  DF: "Burkina Faso",
  DXXX_: "Togo",

  /* ═══ Africa — Central ═══ */
  FE: "Central African Republic",
  FC: "Congo",
  FZ: "DR Congo",
  FQ: "Mozambique",
  FJ: "British Indian Ocean",
  FK: "Cameroon",
  FG: "Equatorial Guinea",
  FP: "São Tomé and Príncipe",
  FN: "Angola",
  FY: "Namibia",
  FB: "Botswana",
  FA: "South Africa",
  FX: "Lesotho",
  FD: "Eswatini",
  FV: "Zimbabwe",
  FL: "Zambia",
  FW: "Malawi",
  FM: "Madagascar",
  FQ_: "Comoros",
  FH: "Saint Helena",

  /* ═══ Africa — East ═══ */
  FQ__: "Comoros",
  FS: "Seychelles",
  FM_: "Madagascar",
  FA_: "South Africa",

  /* ═══ Europe ═══ */
  LI: "Italy",
  LF: "France",
  LE: "Spain",
  LP: "Portugal",
  LG: "Greece",
  LT: "Turkey",
  LB: "Bulgaria",
  LR: "Romania",
  LH: "Hungary",
  LO: "Austria",
  LS: "Switzerland",
  ED: "Germany",
  ET: "Germany",
  EB: "Belgium",
  EH: "Netherlands",
  EL: "Luxembourg",
  EK: "Denmark",
  EN: "Norway",
  ES: "Sweden",
  EF: "Finland",
  EE: "Estonia",
  EV: "Latvia",
  EY: "Lithuania",
  EP: "Poland",
  LK: "Czech Republic",
  LZ: "Slovakia",
  LD: "Croatia",
  LJ: "Slovenia",
  LQ: "Bosnia and Herzegovina",
  LY: "Serbia",
  LA: "Albania",
  LW: "North Macedonia",
  BK: "Kosovo",
  LM: "Malta",
  LC: "Cyprus",
  LU: "Moldova",
  UK: "Ukraine",
  UM: "Belarus",
  UL: "Russia",
  UU: "Russia",
  UH: "Russia",
  UN: "Russia",
  EG: "United Kingdom",
  EI: "Ireland",
  BI: "Iceland",
  BG: "Greenland",
  EH_: "Netherlands",

  /* ═══ Middle East ═══ */
  OB: "Bahrain",
  OE: "Saudi Arabia",
  OI: "Iran",
  OJ: "Jordan",
  OK: "Kuwait",
  OL: "Lebanon",
  OM: "United Arab Emirates",
  OO: "Oman",
  OP: "Pakistan",
  OQ: "Qatar",
  OR: "Iraq",
  OS: "Syria",
  OT: "Qatar",
  OY: "Yemen",
  LL: "Israel",
  LC_: "Cyprus",

  /* ═══ Asia ═══ */
  VA: "India",
  VE: "India",
  VI: "India",
  VO: "India",
  VV: "Vietnam",
  VL: "Laos",
  VT: "Thailand",
  VY: "Myanmar",
  WM: "Malaysia",
  WS: "Singapore",
  WI: "Indonesia",
  WP: "Timor-Leste",
  RP: "Philippines",
  RC: "Taiwan",
  RJ: "Japan",
  RO: "Japan",
  RK: "South Korea",
  ZK: "North Korea",
  ZM: "Mongolia",
  ZB: "China",
  ZG: "China",
  ZH: "China",
  ZJ: "China",
  ZL: "China",
  ZP: "China",
  ZS: "China",
  ZU: "China",
  ZW: "China",
  ZY: "China",
  ZC: "China",
  VH: "Hong Kong",
  VM: "Macau",
  VN: "Nepal",
  VQ: "Bhutan",
  VC: "Sri Lanka",
  VR: "Maldives",
  VG: "Bangladesh",
  VY_: "Myanmar",

  /* ═══ Central Asia ═══ */
  UA: "Kazakhstan",
  UB: "Azerbaijan",
  UG: "Georgia",
  UD: "Armenia",
  UT: "Uzbekistan",
  UA_: "Kazakhstan",
  UZ: "Kyrgyzstan",
  TJ: "Tajikistan",
  TM: "Turkmenistan",
  OA: "Afghanistan",

  /* ═══ Oceania ═══ */
  Y: "Australia",
  NZ: "New Zealand",
  NF: "Fiji",
  NG: "Kiribati",
  NL: "Wallis and Futuna",
  NS: "Samoa",
  NT: "French Polynesia",
  NV: "Vanuatu",
  NW: "New Caledonia",
  PG: "Papua New Guinea",
  PH: "Hawaii (USA)",
  PL: "Kiribati",
  PM: "Marshall Islands",
  PT: "Micronesia",
  PW: "Wake Island (USA)",
  AY: "Papua New Guinea",

  /* ═══ Americas ═══ */
  K: "United States",
  C: "Canada",
  M: "Mexico / Central America",
  T: "Caribbean",
  S: "South America",
  SA: "Argentina",
  SB: "Brazil",
  SC: "Chile",
  SD: "Brazil",
  SE: "Ecuador",
  SF: "Falkland Islands",
  SG: "Paraguay",
  SH: "Chile",
  SI: "Brazil",
  SJ: "Brazil",
  SK: "Colombia",
  SL: "Bolivia",
  SM: "Suriname",
  SN: "Brazil",
  SO: "French Guiana",
  SP: "Peru",
  SS: "Brazil",
  ST: "Suriname",
  SU: "Uruguay",
  SV: "Venezuela",
  SW: "Brazil",
  SY: "Guyana",
  SZ: "Brazil",
  MD: "Dominican Republic",
  MG: "Guatemala",
  MH: "Honduras",
  MK: "Jamaica",
  MM: "Mexico",
  MN: "Nicaragua",
  MP: "Panama",
  MR: "Costa Rica",
  MS: "El Salvador",
  MT: "Haiti",
  MU: "Cuba",
  MW: "Cayman Islands",
  MY: "Bahamas",
  MZ: "Belize",
  TA: "Antigua and Barbuda",
  TB: "Barbados",
  TD: "Dominica",
  TF: "French Antilles",
  TG: "Grenada",
  TI: "US Virgin Islands",
  TJ: "Puerto Rico (USA)",
  TK: "Saint Kitts and Nevis",
  TL: "Saint Lucia",
  TM: "Trinidad and Tobago",
  TN: "Aruba",
  TQ: "Anguilla",
  TR: "Trinidad and Tobago",
  TT: "Trinidad and Tobago",
  TU: "British Virgin Islands",
  TV: "Saint Vincent",
  TX: "Bermuda",
  TZ: "Trinidad and Tobago",

  /* ═══ Atlantic / Pacific islands ═══ */
  BA: "Bermuda",
  CU: "Canada",
  CY: "Canada",
  CZ: "Canada",

  /* ═══ Antarctica ═══ */
  AY_: "Antarctica",
};

/**
 * استخراج الدولة من كود ICAO
 * @param {string} icao - كود المطار (مثل HLLT, LIRF)
 * @returns {string} اسم الدولة أو كود ICAO إذا لم يُعرَف
 */
export function getCountryFromAirport(icao) {
  if (!icao) return "";
  const code = String(icao).toUpperCase().trim();
  if (code.length < 2) return code;

  // جرب البادئة من حرفين (الأكثر شيوعاً)
  const prefix2 = code.slice(0, 2);
  if (ICAO_PREFIX_TO_COUNTRY[prefix2]) {
    return ICAO_PREFIX_TO_COUNTRY[prefix2];
  }

  // جرب البادئة من حرف واحد
  const prefix1 = code.slice(0, 1);
  if (ICAO_PREFIX_TO_COUNTRY[prefix1]) {
    return ICAO_PREFIX_TO_COUNTRY[prefix1];
  }

  return code;
}

/**
 * قائمة فريدة من الدول المتاحة
 * @returns {string[]} مصفوفة أسماء الدول
 */
export function getAvailableCountries() {
  const set = new Set(Object.values(ICAO_PREFIX_TO_COUNTRY));
  return Array.from(set).sort();
}

/**
 * اقتراحات الدول بناءً على نص البحث
 * @param {string} query - نص البحث
 * @returns {string[]} أسماء مطابقة
 */
export function searchCountries(query) {
  if (!query) return getAvailableCountries();
  const q = query.toLowerCase();
  return getAvailableCountries().filter((c) => c.toLowerCase().includes(q));
}
