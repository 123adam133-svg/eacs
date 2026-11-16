/* ═══════════════════════════════════════════════════════════
 * FLIGHT TIMING & AUTOMATIC NIGHT TIME CALCULATOR
 * Calculates airborne night minutes from sunset in flight (T/O → LDG)
 * with smooth departure→arrival solar window interpolation and block fallback.
 * ═══════════════════════════════════════════════════════════ */
import { findAirportDetails, calcAirportSunTimes, parseUtcOffsetHours } from "./airportDatabase";

export function calcDuration24(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return { hhmm: "00:00", minutes: 0 };
  const [sh, sm] = String(startHHMM).split(":").map(Number);
  const [eh, em] = String(endHHMM).split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) {
    return { hhmm: "00:00", minutes: 0 };
  }
  let min = eh * 60 + em - (sh * 60 + sm);
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return {
    hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    minutes: min,
  };
}

export function minutesToHHMM(totalMinutes) {
  const m = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${String(h).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm) {
  if (!hhmm || !String(hhmm).includes(":")) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, h * 60 + m);
}

/**
 * Resolve sunset/sunrise UTC minute-of-day bounds for night window at an airport.
 */
function getAirportNightWindowUtc(code, dateStr) {
  const details = code ? findAirportDetails(code) : null;
  if (details && details.lat != null && details.lon != null && (Number(details.lat) !== 0 || Number(details.lon) !== 0)) {
    const sun = calcAirportSunTimes(details.lat, details.lon, dateStr, details.timezone);
    if (sun) {
      if (sun.polarNight) return { polarNight: true, source: "solar" };
      if (sun.polarDay) return { polarDay: true, source: "solar" };
      if (sun.sunriseUtc && sun.sunriseUtc !== "—" && sun.sunsetUtc && sun.sunsetUtc !== "—") {
        return {
          sunriseMin: hhmmToMinutes(sun.sunriseUtc),
          sunsetMin: hhmmToMinutes(sun.sunsetUtc),
          source: "solar",
          sunriseUtc: sun.sunriseUtc,
          sunsetUtc: sun.sunsetUtc,
        };
      }
    }
  }
  const offsetMin = Math.round(parseUtcOffsetHours(details?.timezone || "UTC") * 60);
  const sunriseMin = ((360 - offsetMin) % 1440 + 1440) % 1440;
  const sunsetMin = ((1080 - offsetMin) % 1440 + 1440) % 1440;
  return {
    sunriseMin,
    sunsetMin,
    source: details?.timezone && details.timezone !== "UTC" ? "timezone" : "utc",
    sunriseUtc: minutesToHHMM(sunriseMin),
    sunsetUtc: minutesToHHMM(sunsetMin),
  };
}

function isMinuteInNightWindow(utcMinOfDay, win) {
  if (!win) return false;
  if (win.polarNight) return true;
  if (win.polarDay) return false;
  const sr = win.sunriseMin;
  const ss = win.sunsetMin;
  if (sr <= ss) {
    return utcMinOfDay < sr || utcMinOfDay >= ss;
  }
  return utcMinOfDay >= ss && utcMinOfDay < sr;
}

/**
 * Computes Night Time from Sunset while Airborne (T/O → LDG).
 * If T/O or LDG are not yet filled, falls back to BLOFF → BLON so a live estimate is still shown.
 */
export function calcAirborneNightMinutes({
  depCode,
  arrCode,
  dateStr,
  toHHMM,
  ldgHHMM,
  bloffHHMM,
  blonHHMM,
}) {
  const hasAirTimes = Boolean(toHHMM && ldgHHMM);
  const spanStart = hasAirTimes ? toHHMM : bloffHHMM;
  const spanEnd = hasAirTimes ? ldgHHMM : blonHHMM;
  const dur = calcDuration24(spanStart, spanEnd);

  if (dur.minutes <= 0) {
    return {
      minutes: 0,
      hhmm: "00:00",
      spanMinutes: 0,
      basis: hasAirTimes ? "air" : "block",
      source: "none",
    };
  }

  const startMin = hhmmToMinutes(spanStart);
  const depWin = getAirportNightWindowUtc(depCode, dateStr);
  const arrWin = getAirportNightWindowUtc(arrCode, dateStr);

  let nightMinutes = 0;
  for (let i = 0; i < dur.minutes; i++) {
    const progress = dur.minutes > 1 ? i / (dur.minutes - 1) : 0;
    const utcMin = (startMin + i) % 1440;
    const win = progress < 0.5 ? (depWin || arrWin) : (arrWin || depWin);
    if (isMinuteInNightWindow(utcMin, win)) {
      nightMinutes++;
    }
  }

  return {
    minutes: nightMinutes,
    hhmm: minutesToHHMM(nightMinutes),
    spanMinutes: dur.minutes,
    basis: hasAirTimes ? "air" : "block",
    source: depWin.source === "solar" || arrWin.source === "solar" ? "solar" : "fallback",
    depSun: depWin,
    arrSun: arrWin,
  };
}

/**
 * Legacy helper: computes night time across BLOFF → BLON.
 */
export function calcBlockNightMinutes({
  depCode,
  arrCode,
  dateStr,
  bloffHHMM,
  blonHHMM,
}) {
  return calcAirborneNightMinutes({
    depCode,
    arrCode,
    dateStr,
    toHHMM: "",
    ldgHHMM: "",
    bloffHHMM,
    blonHHMM,
  });
}
