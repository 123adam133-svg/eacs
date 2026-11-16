/* ═══════════════════════════════════════════════════════════
 * AIRPORT DATABASE UTILITIES & LOCALSTORAGE EXTENSIONS
 * Supports built-in 250+ airports + user custom airports +
 * periodic update/sync capabilities + rich aerodrome specs.
 * ═══════════════════════════════════════════════════════════ */
import { AIRPORTS } from "../airports";
import { appConfigAPI } from "../api";

const CUSTOM_AIRPORTS_KEY = "aeroops.customAirports";
const AIRPORTS_LAST_SYNC_KEY = "aeroops.airportsLastSync";
const AIRPORT_NOTAMS_KEY = "aeroops.airportNotams";

// Common elevation, runway and timezone metadata map for prominent aerodromes
const AERODROME_SPECS = {
  HLLM: {
    nameAr: "مطار معيتيقة الدولي",
    cityAr: "طرابلس",
    countryAr: "ليبيا",
    elevationFt: 36,
    runways: ["11/29 · 3,376m (Asphalt)"],
    timezone: "UTC+2",
    iata: "MJI",
  },
  HLLT: {
    nameAr: "مطار طرابلس الدولي",
    cityAr: "طرابلس",
    countryAr: "ليبيا",
    elevationFt: 263,
    runways: ["09/27 · 3,600m (Asphalt)", "18/36 · 2,236m"],
    timezone: "UTC+2",
    iata: "TIP",
  },
  HLLB: {
    nameAr: "مطار بنينا الدولي",
    cityAr: "بنغازي",
    countryAr: "ليبيا",
    elevationFt: 433,
    runways: ["15R/33L · 3,576m (Asphalt)", "15L/33R · 3,576m"],
    timezone: "UTC+2",
    iata: "BEN",
  },
  HLMS: {
    nameAr: "مطار مصراتة الدولي",
    cityAr: "مصراتة",
    countryAr: "ليبيا",
    elevationFt: 59,
    runways: ["15/33 · 3,400m (Asphalt)"],
    timezone: "UTC+2",
    iata: "MRA",
  },
  HLLS: {
    nameAr: "مطار سبها الدولي",
    cityAr: "سبها",
    countryAr: "ليبيا",
    elevationFt: 1424,
    runways: ["13/31 · 3,600m (Asphalt)"],
    timezone: "UTC+2",
    iata: "SEB",
  },
  HLLQ: {
    nameAr: "مطار الأبرق الدولي",
    cityAr: "البيضاء",
    countryAr: "ليبيا",
    elevationFt: 2156,
    runways: ["10/28 · 3,600m (Asphalt)"],
    timezone: "UTC+2",
    iata: "LAQ",
  },
  HLKF: {
    nameAr: "مطار الكفرة الدولي",
    cityAr: "الكفرة",
    countryAr: "ليبيا",
    elevationFt: 1368,
    runways: ["02L/20R · 3,650m (Asphalt)"],
    timezone: "UTC+2",
    iata: "AKF",
  },
  HLGT: {
    nameAr: "مطار غدامس",
    cityAr: "غدامس",
    countryAr: "ليبيا",
    elevationFt: 1122,
    runways: ["17/35 · 3,000m (Asphalt)"],
    timezone: "UTC+2",
    iata: "GAT",
  },
  HLUB: {
    nameAr: "مطار أوباري",
    cityAr: "أوباري",
    countryAr: "ليبيا",
    elevationFt: 1522,
    runways: ["06/24 · 3,000m (Asphalt)"],
    timezone: "UTC+2",
    iata: "QUB",
  },
  HLZW: {
    nameAr: "مطار زوارة",
    cityAr: "زوارة",
    countryAr: "ليبيا",
    elevationFt: 10,
    runways: ["08/26 · 1,800m (Asphalt)"],
    timezone: "UTC+2",
    iata: "WAX",
  },
  HLCH: {
    nameAr: "مطار حقل الشرارة",
    cityAr: "حقل الشرارة",
    countryAr: "ليبيا",
    elevationFt: 1450,
    runways: ["09/27 · 2,600m (Asphalt)"],
    timezone: "UTC+2",
    iata: "SHR",
  },
  HECA: {
    nameAr: "مطار القاهرة الدولي",
    cityAr: "القاهرة",
    countryAr: "مصر",
    elevationFt: 382,
    runways: ["05L/23R · 3,301m", "05C/23C · 3,999m", "05R/23L · 4,000m"],
    timezone: "UTC+2",
    iata: "CAI",
  },
  HEBA: {
    nameAr: "مطار برج العرب الدولي",
    cityAr: "الإسكندرية",
    countryAr: "مصر",
    elevationFt: 177,
    runways: ["14/32 · 3,400m (Asphalt)"],
    timezone: "UTC+2",
    iata: "HBE",
  },
  DTTA: {
    nameAr: "مطار تونس قرطاج الدولي",
    cityAr: "تونس",
    countryAr: "تونس",
    elevationFt: 22,
    runways: ["01/19 · 3,200m", "11/29 · 2,840m"],
    timezone: "UTC+1",
    iata: "TUN",
  },
  DTTJ: {
    nameAr: "مطار جربة جرجيس الدولي",
    cityAr: "جربة",
    countryAr: "تونس",
    elevationFt: 19,
    runways: ["09/27 · 3,100m (Asphalt)"],
    timezone: "UTC+1",
    iata: "DJE",
  },
  DTTX: {
    nameAr: "مطار صفاقس طينة الدولي",
    cityAr: "صفاقس",
    countryAr: "تونس",
    elevationFt: 85,
    runways: ["15/33 · 3,000m (Asphalt)"],
    timezone: "UTC+1",
    iata: "SFA",
  },
  LMML: {
    nameAr: "مطار مالطا الدولي",
    cityAr: "فاليتا",
    countryAr: "مالطا",
    elevationFt: 300,
    runways: ["13/31 · 3,544m", "05/23 · 2,377m"],
    timezone: "UTC+1",
    iata: "MLA",
  },
  LTFM: {
    nameAr: "مطار إسطنبول الدولي",
    cityAr: "إسطنبول",
    countryAr: "تركيا",
    elevationFt: 325,
    runways: ["16R/34L · 3,750m", "17L/35R · 4,100m", "18/36 · 3,060m"],
    timezone: "UTC+3",
    iata: "IST",
  },
  LTFJ: {
    nameAr: "مطار صبيحة كوكجن الدولي",
    cityAr: "إسطنبول",
    countryAr: "تركيا",
    elevationFt: 312,
    runways: ["06/24 · 3,000m (Concrete)"],
    timezone: "UTC+3",
    iata: "SAW",
  },
  OMDB: {
    nameAr: "مطار دبي الدولي",
    cityAr: "دبي",
    countryAr: "الإمارات",
    elevationFt: 62,
    runways: ["12L/30R · 4,000m", "12R/30L · 4,450m"],
    timezone: "UTC+4",
    iata: "DXB",
  },
  OEJN: {
    nameAr: "مطار الملك عبد العزيز الدولي",
    cityAr: "جدة",
    countryAr: "السعودية",
    elevationFt: 48,
    runways: ["16C/34C · 4,000m", "16L/34R · 4,000m", "16R/34L · 3,800m"],
    timezone: "UTC+3",
    iata: "JED",
  },
  OERK: {
    nameAr: "مطار الملك خالد الدولي",
    cityAr: "الرياض",
    countryAr: "السعودية",
    elevationFt: 2049,
    runways: ["15L/33R · 4,205m", "15R/33L · 4,205m"],
    timezone: "UTC+3",
    iata: "RUH",
  },
  OJAI: {
    nameAr: "مطار الملكة علياء الدولي",
    cityAr: "عمان",
    countryAr: "الأردن",
    elevationFt: 2395,
    runways: ["08R/26L · 3,660m", "08L/26R · 3,660m"],
    timezone: "UTC+3",
    iata: "AMM",
  },
  DAAG: {
    nameAr: "مطار هواري بومدين الدولي",
    cityAr: "الجزائر",
    countryAr: "الجزائر",
    elevationFt: 82,
    runways: ["05/23 · 3,500m", "09/27 · 3,500m"],
    timezone: "UTC+1",
    iata: "ALG",
  },
  GMMN: {
    nameAr: "مطار محمد الخامس الدولي",
    cityAr: "الدار البيضاء",
    countryAr: "المغرب",
    elevationFt: 656,
    runways: ["17L/35R · 3,720m", "17R/35L · 3,720m"],
    timezone: "UTC+1",
    iata: "CMN",
  },
  HSSS: {
    nameAr: "مطار الخرطوم الدولي",
    cityAr: "الخرطوم",
    countryAr: "السودان",
    elevationFt: 1265,
    runways: ["18/36 · 2,980m (Asphalt)"],
    timezone: "UTC+2",
    iata: "KRT",
  },
  LIRF: {
    nameAr: "مطار روما فيوميتشينو",
    cityAr: "روما",
    countryAr: "إيطاليا",
    elevationFt: 14,
    runways: ["16R/34L · 3,900m", "16L/34R · 3,900m", "07/25 · 3,300m"],
    timezone: "UTC+1",
    iata: "FCO",
  },
  LFPG: {
    nameAr: "مطار باريس شارل ديغول",
    cityAr: "باريس",
    countryAr: "فرنسا",
    elevationFt: 392,
    runways: ["09L/27R · 4,215m", "08R/26L · 4,215m"],
    timezone: "UTC+1",
    iata: "CDG",
  },
  EGLL: {
    nameAr: "مطار لندن هيثرو",
    cityAr: "لندن",
    countryAr: "المملكة المتحدة",
    elevationFt: 83,
    runways: ["09L/27R · 3,902m", "09R/27L · 3,660m"],
    timezone: "UTC+0",
    iata: "LHR",
  },
};

/**
 * Get all custom airports from localStorage
 */
export function getCustomAirports() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_AIRPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed reading custom airports:", err);
    return [];
  }
}

/**
 * Save custom airport
 */
export function saveCustomAirport(airport) {
  if (typeof window === "undefined" || !airport?.icao) return false;
  try {
    const icao = String(airport.icao).toUpperCase().trim();
    const current = getCustomAirports();
    const existingIdx = current.findIndex((a) => a.icao === icao);
    const enriched = {
      ...airport,
      icao,
      iata: airport.iata ? String(airport.iata).toUpperCase().trim() : "",
      name: airport.name || icao,
      city: airport.city || "",
      country: airport.country || "",
      lat: airport.lat != null ? Number(airport.lat) : 0,
      lon: airport.lon != null ? Number(airport.lon) : 0,
      elevationFt: airport.elevationFt != null ? Number(airport.elevationFt) : undefined,
      runways: Array.isArray(airport.runways)
        ? airport.runways
        : airport.runways
        ? [String(airport.runways)]
        : [],
      timezone: airport.timezone || "UTC",
      isCustom: true,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      current[existingIdx] = enriched;
    } else {
      current.push(enriched);
    }

    localStorage.setItem(CUSTOM_AIRPORTS_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event("aeroops:airportsChanged"));
    appConfigAPI.set("customAirports", current).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed saving custom airport:", err);
    return false;
  }
}

/**
 * Delete custom airport
 */
export function deleteCustomAirport(icao) {
  if (typeof window === "undefined" || !icao) return false;
  try {
    const code = String(icao).toUpperCase().trim();
    const current = getCustomAirports();
    const filtered = current.filter((a) => a.icao !== code);
    localStorage.setItem(CUSTOM_AIRPORTS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("aeroops:airportsChanged"));
    appConfigAPI.set("customAirports", filtered).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed deleting custom airport:", err);
    return false;
  }
}

/**
 * Hydrate custom airports from Google Sheets AppConfig
 */
export async function hydrateCustomAirportsFromSheet() {
  if (typeof window === "undefined") return null;
  try {
    const cloud = await appConfigAPI.get("customAirports");
    if (Array.isArray(cloud)) {
      localStorage.setItem(CUSTOM_AIRPORTS_KEY, JSON.stringify(cloud));
      window.dispatchEvent(new Event("aeroops:airportsChanged"));
      return cloud;
    }
  } catch {}
  return null;
}

/**
 * Parse UTC offset hours from strings like "UTC+2", "UTC-5", "UTC+3:30", "UTC"
 */
export function parseUtcOffsetHours(tz) {
  if (!tz) return 0;
  const m = String(tz).trim().match(/^UTC\s*([+-])\s*(\d{1,2})(?::(\d{2}))?/i);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hrs = parseInt(m[2], 10) || 0;
  const mins = parseInt(m[3] || "0", 10) || 0;
  return sign * (hrs + mins / 60);
}

function formatMinutesAsHHMM(totalMinutes) {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) return "—";
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * Pure astronomical NOAA Sunrise / Sunset calculator for any aerodrome.
 * Returns UTC times, Local times (if timezone parsed), day length & daylight flag.
 */
export function calcAirportSunTimes(lat, lon, dateInput = null, timezoneStr = "UTC") {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    return null;
  }
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (latNum === 0 && lonNum === 0) return null;

  const d = dateInput ? new Date(dateInput) : new Date();
  const baseDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth();
  const day = baseDate.getUTCDate();

  // Day of year (1..366)
  const startOfYear = Date.UTC(year, 0, 0);
  const currentUtc = Date.UTC(year, month, day);
  const doy = Math.floor((currentUtc - startOfYear) / 86400000);

  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const gamma = ((2 * Math.PI) / 365) * (doy - 1);

  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const zenith = 90.833 * rad;
  const latRad = latNum * rad;
  const cosHa =
    Math.cos(zenith) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);

  if (cosHa > 1) {
    return { polarNight: true, sunriseUtc: "—", sunsetUtc: "—", sunriseLocal: "—", sunsetLocal: "—", dayLength: "00:00", isDaytimeNow: false };
  }
  if (cosHa < -1) {
    return { polarDay: true, sunriseUtc: "00:00", sunsetUtc: "24:00", sunriseLocal: "00:00", sunsetLocal: "24:00", dayLength: "24:00", isDaytimeNow: true };
  }

  const haDeg = Math.acos(cosHa) * deg;
  const sunriseUtcMin = 720 - 4 * (lonNum + haDeg) - eqTime;
  const sunsetUtcMin = 720 - 4 * (lonNum - haDeg) - eqTime;

  const offsetHours = parseUtcOffsetHours(timezoneStr);
  const offsetMin = offsetHours * 60;
  const durationMin = Math.max(0, Math.round(sunsetUtcMin - sunriseUtcMin));
  const durH = Math.floor(durationMin / 60);
  const durM = durationMin % 60;

  const now = new Date();
  const nowUtcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const srNorm = ((sunriseUtcMin % 1440) + 1440) % 1440;
  const ssNorm = ((sunsetUtcMin % 1440) + 1440) % 1440;
  const isDaytimeNow =
    srNorm <= ssNorm
      ? nowUtcMin >= srNorm && nowUtcMin <= ssNorm
      : nowUtcMin >= srNorm || nowUtcMin <= ssNorm;

  return {
    sunriseUtc: formatMinutesAsHHMM(sunriseUtcMin),
    sunsetUtc: formatMinutesAsHHMM(sunsetUtcMin),
    sunriseLocal: formatMinutesAsHHMM(sunriseUtcMin + offsetMin),
    sunsetLocal: formatMinutesAsHHMM(sunsetUtcMin + offsetMin),
    timezoneLabel: timezoneStr || "UTC",
    hasOffset: offsetHours !== 0,
    dayLength: `${String(durH).padStart(2, "0")}:${String(durM).padStart(2, "0")}`,
    isDaytimeNow,
  };
}

/* ═══════════════════════════════════════════════════════════
 * NOTAM CLOSURE STATUS MANAGEMENT (Built-in + Custom Airports)
 * ═══════════════════════════════════════════════════════════ */
export function getAirportNotams() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AIRPORT_NOTAMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAirportNotam(icao, notam = {}) {
  if (typeof window === "undefined" || !icao) return false;
  try {
    const code = String(icao).toUpperCase().trim();
    const map = { ...getAirportNotams() };
    if (!notam?.closed) {
      delete map[code];
    } else {
      map[code] = {
        closed: true,
        note: String(notam.note || "").trim(),
        until: String(notam.until || "").trim(),
        updatedAt: new Date().toISOString(),
      };
    }
    localStorage.setItem(AIRPORT_NOTAMS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event("aeroops:airportsChanged"));
    appConfigAPI.set("airportNotams", map).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed saving airport NOTAM:", err);
    return false;
  }
}

export function deleteAirportNotam(icao) {
  return saveAirportNotam(icao, { closed: false });
}

export async function hydrateAirportNotamsFromSheet() {
  if (typeof window === "undefined") return null;
  try {
    const cloud = await appConfigAPI.get("airportNotams");
    if (cloud && typeof cloud === "object" && !Array.isArray(cloud)) {
      localStorage.setItem(AIRPORT_NOTAMS_KEY, JSON.stringify(cloud));
      window.dispatchEvent(new Event("aeroops:airportsChanged"));
      return cloud;
    }
  } catch {}
  return null;
}

/**
 * Get all merged airports (built-in + custom + NOTAM status)
 */
export function getAllAirportsList() {
  const custom = getCustomAirports();
  const customMap = new Map(custom.map((a) => [a.icao, a]));
  const notams = getAirportNotams();

  const attachNotam = (item) => {
    const code = String(item.icao || "").toUpperCase().trim();
    const n = notams[code];
    if (n?.closed) {
      return {
        ...item,
        notamClosed: true,
        notamNote: n.note || "",
        notamUntil: n.until || "",
        notamUpdatedAt: n.updatedAt || "",
      };
    }
    return {
      ...item,
      notamClosed: false,
      notamNote: "",
      notamUntil: "",
    };
  };

  const merged = AIRPORTS.map((a) => {
    const override = customMap.get(a.icao);
    const specs = AERODROME_SPECS[a.icao] || {};
    if (override) {
      customMap.delete(a.icao);
      return attachNotam({ ...a, ...specs, ...override });
    }
    return attachNotam({ ...a, ...specs });
  });

  // Append newly added custom airports not in built-in list
  customMap.forEach((ca) => {
    merged.push(attachNotam(ca));
  });

  return merged;
}

/**
 * Find airport details with enhanced aerodrome specs & NOTAM status
 */
export function findAirportDetails(code) {
  if (!code) return null;
  const c = String(code).toUpperCase().trim();
  const all = getAllAirportsList();
  const notams = getAirportNotams();
  const found = all.find((a) => a.icao === c || a.iata === c);
  if (!found) {
    const n = notams[c];
    // If unknown airport code, return fallback structure
    return {
      icao: c,
      iata: c.length === 3 ? c : "—",
      name: `${c} Aerodrome`,
      nameAr: `مطار ${c}`,
      city: "Unknown",
      cityAr: "غير محدد",
      country: "International",
      countryAr: "دولي",
      lat: null,
      lon: null,
      elevationFt: null,
      runways: [],
      timezone: "UTC",
      isUnknown: true,
      notamClosed: Boolean(n?.closed),
      notamNote: n?.note || "",
      notamUntil: n?.until || "",
    };
  }

  const specs = AERODROME_SPECS[found.icao] || {};
  const n = notams[found.icao] || notams[c];
  return {
    ...specs,
    ...found,
    icao: found.icao || c,
    iata: found.iata && found.iata !== "—" ? found.iata : specs.iata || "—",
    name: found.name || specs.name || c,
    nameAr: found.nameAr || specs.nameAr || found.name || c,
    city: found.city || specs.city || "",
    cityAr: found.cityAr || specs.cityAr || found.city || "",
    country: found.country || specs.country || "",
    countryAr: found.countryAr || specs.countryAr || found.country || "",
    elevationFt: found.elevationFt ?? specs.elevationFt ?? null,
    runways: found.runways || specs.runways || [],
    timezone: found.timezone || specs.timezone || "UTC",
    notamClosed: Boolean(n?.closed || found.notamClosed),
    notamNote: n?.note ?? found.notamNote ?? "",
    notamUntil: n?.until ?? found.notamUntil ?? "",
  };
}

/**
 * Get last sync timestamp
 */
export function getAirportsLastSyncTime() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AIRPORTS_LAST_SYNC_KEY);
}

/**
 * Record sync timestamp
 */
export function setAirportsLastSyncTime() {
  if (typeof window === "undefined") return;
  localStorage.setItem("aeroops.airportsLastSync", new Date().toISOString());
}
