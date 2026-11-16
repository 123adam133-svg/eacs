/* ═══════════════════════════════════════════════════════════
 * FLIGHT SETTINGS & AIRCRAFT STATUSES UTILITIES
 * Customizable aircraft statuses with colors, badges, localStorage + cloud sync.
 * ═══════════════════════════════════════════════════════════ */
import { appConfigAPI } from "../api";

export const DEFAULT_AIRCRAFT_STATUSES = [
  {
    id: "IN_SERVICE",
    code: "INS",
    labelAr: "في الخدمة",
    labelEn: "In Service",
    color: "emerald",
    badgeBg: "bg-emerald-500/20",
    badgeBorder: "border-emerald-500/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    isDefault: true,
  },
  {
    id: "READY",
    code: "RDY",
    labelAr: "جاهزة للإقلاع",
    labelEn: "Ready",
    color: "blue",
    badgeBg: "bg-blue-500/20",
    badgeBorder: "border-blue-500/40",
    badgeText: "text-blue-700 dark:text-blue-300",
    isDefault: true,
  },
  {
    id: "AIRBORNE",
    code: "AIR",
    labelAr: "في الجو",
    labelEn: "Airborne",
    color: "sky",
    badgeBg: "bg-sky-500/20",
    badgeBorder: "border-sky-500/40",
    badgeText: "text-sky-700 dark:text-sky-300",
    isDefault: true,
  },
  {
    id: "BOARDING",
    code: "BRD",
    labelAr: "صعود الركاب",
    labelEn: "Boarding",
    color: "indigo",
    badgeBg: "bg-indigo-500/20",
    badgeBorder: "border-indigo-500/40",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    isDefault: true,
  },
  {
    id: "DELAYED",
    code: "DLY",
    labelAr: "متأخرة",
    labelEn: "Delayed",
    color: "amber",
    badgeBg: "bg-amber-500/20",
    badgeBorder: "border-amber-500/40",
    badgeText: "text-amber-700 dark:text-amber-300",
    isDefault: true,
  },
  {
    id: "MAINTENANCE",
    code: "MNT",
    labelAr: "صيانة",
    labelEn: "Maintenance",
    color: "orange",
    badgeBg: "bg-orange-500/20",
    badgeBorder: "border-orange-500/40",
    badgeText: "text-orange-700 dark:text-orange-300",
    isDefault: true,
  },
  {
    id: "AOG",
    code: "AOG",
    labelAr: "متوقفة / AOG",
    labelEn: "AOG",
    color: "rose",
    badgeBg: "bg-rose-500/20",
    badgeBorder: "border-rose-500/40",
    badgeText: "text-rose-700 dark:text-rose-300",
    isDefault: true,
  },
  {
    id: "COMPLETED",
    code: "CMP",
    labelAr: "مكتملة",
    labelEn: "Completed",
    color: "teal",
    badgeBg: "bg-teal-500/20",
    badgeBorder: "border-teal-500/40",
    badgeText: "text-teal-700 dark:text-teal-300",
    isDefault: true,
  },
  {
    id: "STANDBY",
    code: "STB",
    labelAr: "احتياط",
    labelEn: "Standby",
    color: "slate",
    badgeBg: "bg-slate-500/20",
    badgeBorder: "border-slate-500/40",
    badgeText: "text-slate-700 dark:text-slate-300",
    isDefault: true,
  },
];

const AIRCRAFT_STATUSES_KEY = "aeroops.aircraftStatuses";

export function getAircraftStatuses() {
  if (typeof window === "undefined") return [...DEFAULT_AIRCRAFT_STATUSES];
  try {
    const raw = localStorage.getItem(AIRCRAFT_STATUSES_KEY);
    if (!raw) return [...DEFAULT_AIRCRAFT_STATUSES];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed reading aircraftStatuses:", err);
  }
  return [...DEFAULT_AIRCRAFT_STATUSES];
}

export function saveAircraftStatus(status) {
  if (typeof window === "undefined" || !status?.id) return false;
  try {
    const current = getAircraftStatuses();
    const id = String(status.id).toUpperCase().trim();
    const existingIdx = current.findIndex((s) => s.id === id);

    const enriched = {
      ...status,
      id,
      code: (status.code || id.slice(0, 3)).toUpperCase(),
      labelAr: status.labelAr || status.labelEn || id,
      labelEn: status.labelEn || status.labelAr || id,
      color: status.color || "emerald",
      badgeBg: status.badgeBg || `bg-${status.color || "emerald"}-500/20`,
      badgeBorder: status.badgeBorder || `border-${status.color || "emerald"}-500/40`,
      badgeText: status.badgeText || `text-${status.color || "emerald"}-700 dark:text-${status.color || "emerald"}-300`,
      isCustom: existingIdx < 0 ? true : current[existingIdx].isCustom,
    };

    if (existingIdx >= 0) {
      current[existingIdx] = enriched;
    } else {
      current.push(enriched);
    }

    localStorage.setItem(AIRCRAFT_STATUSES_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event("aeroops:aircraftStatusesChanged"));
    appConfigAPI.set("aircraftStatuses", current).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed saving aircraft status:", err);
    return false;
  }
}

export function deleteAircraftStatus(id) {
  if (typeof window === "undefined" || !id) return false;
  try {
    const current = getAircraftStatuses();
    const filtered = current.filter((s) => s.id !== id);
    localStorage.setItem(AIRCRAFT_STATUSES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("aeroops:aircraftStatusesChanged"));
    appConfigAPI.set("aircraftStatuses", filtered).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed deleting aircraft status:", err);
    return false;
  }
}

export function resetAircraftStatuses() {
  if (typeof window === "undefined") return;
  localStorage.setItem(AIRCRAFT_STATUSES_KEY, JSON.stringify(DEFAULT_AIRCRAFT_STATUSES));
  window.dispatchEvent(new Event("aeroops:aircraftStatusesChanged"));
  appConfigAPI.set("aircraftStatuses", DEFAULT_AIRCRAFT_STATUSES).catch(() => {});
}

export async function hydrateFlightSettingsFromSheet() {
  if (typeof window === "undefined") return null;
  try {
    const cloud = await appConfigAPI.get("aircraftStatuses");
    if (Array.isArray(cloud) && cloud.length > 0) {
      localStorage.setItem(AIRCRAFT_STATUSES_KEY, JSON.stringify(cloud));
      window.dispatchEvent(new Event("aeroops:aircraftStatusesChanged"));
      return cloud;
    }
  } catch {}
  return null;
}

export function getAircraftStatusObj(idOrStatus) {
  if (!idOrStatus) return DEFAULT_AIRCRAFT_STATUSES[0];
  const list = getAircraftStatuses();
  const search = String(idOrStatus).toUpperCase().trim();
  const found = list.find(
    (s) =>
      s.id === search ||
      s.code === search ||
      s.labelEn.toUpperCase() === search ||
      s.labelAr === idOrStatus
  );
  if (found) return found;

  return {
    id: search,
    code: search.slice(0, 3),
    labelAr: idOrStatus,
    labelEn: idOrStatus,
    color: "sky",
    badgeBg: "bg-sky-500/20",
    badgeBorder: "border-sky-500/40",
    badgeText: "text-sky-700 dark:text-sky-300",
  };
}
