/* ═══════════════════════════════════════════════════════════
 * AeroOps API Client — Google Sheets + Drive
 * Version 5.2 — Added Settings fields (aircraft, COA, etc.)
 *              + route in Flights + toDirectDriveUrl + clearAll
 * ═══════════════════════════════════════════════════════════ */

export const API_URL =
  "https://script.google.com/macros/s/AKfycbyWvE4E4dCzWIpm4t6Vul_27CqqYQJ1MsKIUVDZVxAdGogXf76MlR0_Bzs1WHtqYvEXQQ/exec";
import { sendNotification } from "./utils/notificationService";
import {
  listEmailAccounts,
  sendThroughEmailAccount,
} from "./utils/emailAccounts";
/* ═══════════════════════════════════════════════════════════
 * SAFE HELPERS
 * ═══════════════════════════════════════════════════════════ */
function safeArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function safeObject(val) {
  if (!val) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    if (val instanceof Date) return null;
    return Object.keys(val).length > 0 ? val : null;
  }
  if (typeof val === "string") {
    let trimmed = val.trim();
    if (trimmed.startsWith("'")) trimmed = trimmed.slice(1);
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        return parsed;
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

function safeNumber(val, fallback = 0) {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function safeBool(val) {
  return (
    val === true || val === "true" || val === "TRUE" || val === 1 || val === "1"
  );
}

function safeString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

function safeActiveBool(val) {
  if (val === false || val === 0 || val === "0") return false;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "false" || s === "no" || s === "inactive") return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════
 * FAST GOOGLE SHEETS CACHE & MUTATION GUARD
 * Enables instant 0ms login & hydration + safe background sync
 * ═══════════════════════════════════════════════════════════ */
const SHEET_CACHE_PREFIX = "aeroops.sheetCache.";
let _pendingMutations = 0;
let _lastMutationAt = 0;

export function hasPendingSheetMutations() {
  return _pendingMutations > 0 || Date.now() - _lastMutationAt < 2500;
}

/**
 * @param {string} sheetName
 * @param {any} [fallbackArg]
 */
export function readSheetCache(sheetName, fallbackArg) {
  const fallback = arguments.length >= 2 ? fallbackArg : [];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${SHEET_CACHE_PREFIX}${sheetName}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeSheetCache(sheetName, data) {
  if (typeof window === "undefined") return data;
  try {
    window.localStorage.setItem(
      `${SHEET_CACHE_PREFIX}${sheetName}`,
      JSON.stringify(data)
    );
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("aeroops:sheetCacheUpdated", { detail: { sheetName } })
      );
    });
  } catch {}
  return data;
}

function cleanUrl(url) {
  if (!url) return "";
  let str = String(url).trim();
  if (str.startsWith("'")) str = str.slice(1);
  if (str === "undefined" || str === "null") return "";
  return str;
}

/* ═══ Google Drive File ID & Same-Origin Preview/Download Helpers ═══ */
export function extractDriveFileId(url) {
  if (!url || typeof url !== "string") return "";
  const str = url.trim().replace(/^'/, "");
  if (
    !str ||
    str === "undefined" ||
    str === "null" ||
    str.startsWith("data:") ||
    str.startsWith("blob:") ||
    str.includes("[Data URL")
  ) {
    return "";
  }

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
    if (match && match[1]) return match[1];
  }
  return "";
}

export function toDirectDriveUrl(url) {
  if (!url) return null;
  const str = cleanUrl(url);
  if (!str || str.includes("[Data URL")) return null;

  const fileId = extractDriveFileId(str);
  if (!fileId) return str;

  return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
}

export function toPreviewFileUrl(url, fileName = "") {
  if (!url) return null;
  const str = cleanUrl(url);
  if (!str || str.includes("[Data URL")) return null;
  if (str.startsWith("data:") || str.startsWith("blob:")) return str;
  const fileId = extractDriveFileId(str);
  if (fileId) {
    const qs = fileName ? `?name=${encodeURIComponent(fileName)}` : "";
    return `/api/drive-file/${fileId}${qs}`;
  }
  return str;
}

export function toDownloadFileUrl(url, fileName = "") {
  if (!url) return undefined;
  const str = cleanUrl(url);
  if (!str || str.includes("[Data URL")) return undefined;
  if (str.startsWith("data:") || str.startsWith("blob:")) return str;
  const fileId = extractDriveFileId(str);
  if (fileId) {
    const nameParam = fileName ? `&name=${encodeURIComponent(fileName)}` : "";
    return `/api/drive-file/${fileId}?download=1${nameParam}`;
  }
  return str;
}

export function toDisplayImageUrl(url) {
  if (!url) return null;
  const str = cleanUrl(url);
  if (!str || str.includes("[Data URL")) return null;
  if (str.startsWith("data:") || str.startsWith("blob:")) return str;
  const fileId = extractDriveFileId(str);
  if (fileId) {
    return `/api/drive-file/${fileId}`;
  }
  return str;
}

/* ═══ Attachments ═══ */
function serializeAttachments(att) {
  if (att === null || att === undefined) return "[]";
  const cleaned = sanitizeAttachmentsForSheets(att);
  const json = JSON.stringify(cleaned);
  if (json.length <= 48000) return json;
  // Secondary trim if many attachments with large inline htmlContent exist
  const compact = cleaned.map((item) => {
    if (item && typeof item === "object" && item.htmlContent) {
      const { htmlContent, ...rest } = item;
      return { ...rest, htmlContent: String(htmlContent).slice(0, 12000) };
    }
    return item;
  });
  return JSON.stringify(compact);
}

function normalizeAttachments(val) {
  if (!val) return [];
  let current = val;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(current)) return current;
    if (typeof current !== "string") break;
    const trimmed = current.trim();
    if (!trimmed) return [];
    try {
      current = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  return Array.isArray(current) ? current : [];
}

export function sanitizeAttachmentsForSheets(val) {
  const norm = normalizeAttachments(val);
  if (!Array.isArray(norm)) return [];
  return norm.map((item) => {
    if (item && typeof item === "object") {
      const copy = { ...item };
      // Normalize fileUrl -> url if needed
      if (!copy.url && copy.fileUrl) {
        copy.url = copy.fileUrl;
      }
      // Cap inline htmlContent so Google Sheets 50,000-char cell limit is never exceeded
      if (typeof copy.htmlContent === "string" && copy.htmlContent.length > 32000) {
        copy.htmlContent = copy.htmlContent.slice(0, 32000);
      }
      // Strip raw base64 data URLs > 4KB to prevent Google Sheets cell overflow
      if (
        typeof copy.url === "string" &&
        (copy.url.startsWith("data:") || copy.url.length > 5000)
      ) {
        if (copy.viewUrl && !copy.viewUrl.startsWith("data:")) {
          copy.url = toDirectDriveUrl(copy.viewUrl);
        } else if (copy.fileId) {
          copy.url = `https://drive.google.com/uc?export=download&confirm=t&id=${copy.fileId}`;
        } else {
          copy.url = copy.isHtml ? "" : "[Data URL - Local Only]";
        }
      }
      return copy;
    }
    return item;
  });
}

/* ═══ Aircraft ═══ */
function normalizeAircraft(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function serializeAircraft(arr) {
  if (arr === null || arr === undefined) return "[]";
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    if (!trimmed) return "[]";
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      return JSON.stringify(
        trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  if (Array.isArray(arr)) return JSON.stringify(arr);
  return "[]";
}

/* ═══ Positions ═══ */
function normalizePositions(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function serializePositions(arr) {
  if (arr === null || arr === undefined) return "";
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      return "";
    }
  }
  if (Array.isArray(arr)) return JSON.stringify(arr);
  return "";
}

/* ═══ Secondary Roles ═══ */
function normalizeSecondaryRoles(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function serializeSecondaryRoles(arr) {
  if (arr === null || arr === undefined) return "[]";
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    if (!trimmed) return "[]";
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      return JSON.stringify(
        trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );
    }
  }
  if (Array.isArray(arr)) return JSON.stringify(arr);
  return "[]";
}

/* ═══ Legs ═══ */
function normalizeLegs(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serializeLegs(arr) {
  if (arr === null || arr === undefined) return "[]";
  if (Array.isArray(arr)) return JSON.stringify(arr);
  if (typeof arr === "string") {
    const trimmed = arr.trim();
    if (!trimmed) return "[]";
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {}
  }
  return "[]";
}

function normalizeCamoAttachments(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeMenuItems(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* ═══════════════════════════════════════════════════════════
 * Core (Same-Origin Express Proxy -> Apps Script Fallback)
 * ═══════════════════════════════════════════════════════════ */
async function postAppsScriptPayload(payloadObj) {
  const payloadStr = JSON.stringify(payloadObj);

  // Primary: Same-Origin Express Proxy (/api/gsheet) — immune to iframe CORS & 302 issues
  try {
    const proxyRes = await fetch("/api/gsheet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadStr,
    });
    const proxyContentType = proxyRes.headers.get("content-type") || "";
    if (proxyContentType.includes("application/json")) {
      const parsed = await proxyRes.json();
      if (proxyRes.ok || parsed?.error) {
        return parsed;
      }
    }
  } catch {
    // Fallback to direct Apps Script URL below
  }

  // Fallback: Direct Google Apps Script Web App
  const body = "payload=" + encodeURIComponent(payloadStr);
  const res = await fetch(API_URL, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    redirect: "follow",
  });

  const text = await res.text();
  if (text.trim().startsWith("<")) {
    const m = text.match(/<title>(.*?)<\/title>/i);
    throw new Error("Apps Script error: " + (m ? m[1] : "HTML"));
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Non-JSON: " + text.substring(0, 500));
  }
}

export async function apiCall(action, sheet, data = {}, id = null) {
  const isMutation =
    action === "create" ||
    action === "update" ||
    action === "delete" ||
    action === "clearAll";

  if (isMutation) {
    _pendingMutations++;
    _lastMutationAt = Date.now();
  }

  try {
    const result = await postAppsScriptPayload({ action, sheet, data, id });
    if (!result || !result.ok) {
      throw new Error(result?.error || "API Error");
    }
    return result.data;
  } catch (e) {
    console.warn(`Fetch failed for ${action}/${sheet}:`, e?.message || e);
    throw e;
  } finally {
    if (isMutation) {
      _pendingMutations = Math.max(0, _pendingMutations - 1);
      _lastMutationAt = Date.now();
    }
  }
}

export async function apiRead(sheet) {
  // Primary: Same-Origin Express Proxy (/api/gsheet)
  try {
    const proxyRes = await fetch(
      `/api/gsheet?sheet=${encodeURIComponent(sheet)}`,
      { method: "GET" }
    );
    const ct = proxyRes.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const parsed = await proxyRes.json();
      if (parsed?.ok) return parsed.data || [];
      if (parsed?.error) throw new Error(parsed.error);
    }
  } catch (proxyErr) {
    // Only rethrow if it was an explicit Apps Script logical error (e.g. sheet missing)
    if (
      proxyErr?.message &&
      !proxyErr.message.includes("Failed to fetch") &&
      !proxyErr.message.includes("NetworkError") &&
      !proxyErr.message.includes("proxy failed")
    ) {
      throw proxyErr;
    }
  }

  // Fallback: Direct Google Apps Script GET
  const res = await fetch(`${API_URL}?sheet=${encodeURIComponent(sheet)}`, {
    method: "GET",
    redirect: "follow",
  });

  const text = await res.text();
  if (text.trim().startsWith("<")) {
    const m = text.match(/<title>(.*?)<\/title>/i);
    throw new Error("Apps Script error: " + (m ? m[1] : "HTML"));
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Non-JSON: " + text.substring(0, 200));
  }

  if (!result.ok) throw new Error(result.error || "Read Error");
  return result.data || [];
}

/* ═══════════════════════════════════════════════════════════
 * CREW
 * ═══════════════════════════════════════════════════════════ */
export const crewAPI = {
  list: async () => {
    const list = await apiRead("Crew");
    const normalized = list.map((c) => ({
      ...c,
      id: safeString(c.id),
      fullName: safeString(c.fullName),
      role: safeString(c.role),
      empNo: safeString(c.empNo),
      email: safeString(c.email),
      phone: safeString(c.phone),
      nationality: safeString(c.nationality),
      dob: safeString(c.dob),
      gender: safeString(c.gender, "male"),
      base: safeString(c.base),
      licenseNo: safeString(c.licenseNo),
      licenseExpiry: safeString(c.licenseExpiry),
      medicalExpiry: safeString(c.medicalExpiry),
      passportNo: safeString(c.passportNo),
      passportExpiry: safeString(c.passportExpiry),
      eNumber: safeString(c.eNumber),
      avatar: cleanUrl(c.avatar),
      attachments: normalizeAttachments(c.attachments),
      assignedAircraft: normalizeAircraft(c.assignedAircraft),
      secondaryRoles: normalizeSecondaryRoles(c.secondaryRoles),
      ftl28: safeNumber(c.ftl28, 0),
      active: safeActiveBool(c.active),
      status: safeString(c.status, "active") || "active",
    }));
    return writeSheetCache("Crew", normalized);
  },
  create: async (c) => {
    const res = await apiCall("create", "Crew", {
      fullName: safeString(c.fullName),
      role: safeString(c.role),
      secondaryRoles: serializeSecondaryRoles(c.secondaryRoles),
      empNo: safeString(c.empNo),
      email: safeString(c.email),
      phone: safeString(c.phone),
      nationality: safeString(c.nationality),
      dob: safeString(c.dob),
      gender: safeString(c.gender, "male"),
      base: safeString(c.base),
      licenseNo: safeString(c.licenseNo),
      licenseExpiry: safeString(c.licenseExpiry),
      medicalExpiry: safeString(c.medicalExpiry),
      passportNo: safeString(c.passportNo),
      passportExpiry: safeString(c.passportExpiry),
      eNumber: safeString(c.eNumber),
      ftl28: safeNumber(c.ftl28, 0),
      avatar: c.avatar || "",
      status: safeString(c.status, "active") || "active",
      attachments: serializeAttachments(c.attachments),
      assignedAircraft: serializeAircraft(c.assignedAircraft),
    });
    return res;
  },
  update: async (id, c) => {
    const prevList = readSheetCache("Crew", []);
    const prevMember = prevList.find((m) => String(m.id) === String(id));
    const res = await apiCall(
      "update",
      "Crew",
      {
        fullName: safeString(c.fullName),
        role: safeString(c.role),
        secondaryRoles: serializeSecondaryRoles(c.secondaryRoles),
        empNo: safeString(c.empNo),
        email: safeString(c.email),
        phone: safeString(c.phone),
        nationality: safeString(c.nationality),
        dob: safeString(c.dob),
        gender: safeString(c.gender, "male"),
        base: safeString(c.base),
        licenseNo: safeString(c.licenseNo),
        licenseExpiry: safeString(c.licenseExpiry),
        medicalExpiry: safeString(c.medicalExpiry),
        passportNo: safeString(c.passportNo),
        passportExpiry: safeString(c.passportExpiry),
        eNumber: safeString(c.eNumber),
        ftl28: safeNumber(c.ftl28, 0),
        avatar: c.avatar || "",
        status: safeString(c.status, "active") || "active",
        attachments: serializeAttachments(c.attachments),
        assignedAircraft: serializeAircraft(c.assignedAircraft),
      },
      id
    );

    const prevAcft = normalizeAircraft(prevMember?.assignedAircraft).join(",");
    const nextAcftList = normalizeAircraft(c.assignedAircraft);
    if (nextAcftList.join(",") !== prevAcft && nextAcftList.length > 0) {
      Promise.resolve().then(() =>
        sendNotification(
          String(id),
          `✈️ تم تحديث الطائرات المؤهلة لك: ${nextAcftList.join(", ")}`,
          {
            type: "GENERAL",
            recipientEmail: safeString(c.email),
            crewName: safeString(c.fullName),
          }
        ).catch(() => {})
      );
    }
    return res;
  },
  remove: (id) => apiCall("delete", "Crew", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * FLEET
 * ═══════════════════════════════════════════════════════════ */
export const fleetAPI = {
  list: async () => {
    const list = await apiRead("Fleet");
    const normalized = list.map((a) => ({
      ...a,
      id: safeString(a.id),
      reg: safeString(a.reg).toUpperCase().trim(),
      type: safeString(a.type),
      lastCheck: safeString(a.lastCheck),
      nextCheck: safeString(a.nextCheck),
      attachments: normalizeAttachments(a.attachments),
      tah: safeNumber(a.tah, 0),
      tac: safeNumber(a.tac, 0),
      status: safeString(a.status, "AIRWORTHY"),
    }));
    return writeSheetCache("Fleet", normalized);
  },
  create: (a) =>
    apiCall("create", "Fleet", {
      reg: safeString(a.reg).toUpperCase().trim(),
      type: safeString(a.type),
      status: a.status || "AIRWORTHY",
      tah: safeNumber(a.tah, 0),
      tac: safeNumber(a.tac, 0),
      lastCheck: safeString(a.lastCheck),
      nextCheck: safeString(a.nextCheck),
      attachments: serializeAttachments(a.attachments),
    }),
  update: (id, a) =>
    apiCall(
      "update",
      "Fleet",
      {
        reg: safeString(a.reg).toUpperCase().trim(),
        type: safeString(a.type),
        status: a.status || "AIRWORTHY",
        tah: safeNumber(a.tah, 0),
        tac: safeNumber(a.tac, 0),
        lastCheck: safeString(a.lastCheck),
        nextCheck: safeString(a.nextCheck),
        attachments: serializeAttachments(a.attachments),
      },
      id
    ),
  remove: (id) => apiCall("delete", "Fleet", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * FLIGHT CREW NOTIFICATION DISPATCHER (NON-BLOCKING)
 * ═══════════════════════════════════════════════════════════ */
function resolveCrewMeta(crewId, slot = {}) {
  const cachedCrew = readSheetCache("Crew", []);
  const cachedUsers = readSheetCache("Users", []);
  const member = cachedCrew.find((c) => String(c.id) === String(crewId));
  const linkedUser = cachedUsers.find(
    (u) =>
      (u.crewId && String(u.crewId) === String(crewId)) ||
      (member?.email &&
        u.email &&
        String(u.email).trim().toLowerCase() ===
          String(member.email).trim().toLowerCase()) ||
      (member?.fullName &&
        u.fullName &&
        String(u.fullName).trim().toLowerCase() ===
          String(member.fullName).trim().toLowerCase())
  );

  return {
    crewName: safeString(slot.crewName || member?.fullName || linkedUser?.fullName),
    recipientEmail: safeString(
      slot.email || member?.email || linkedUser?.email
    )
      .trim()
      .toLowerCase(),
    recipientUsername: safeString(linkedUser?.username).trim().toLowerCase(),
  };
}

function formatFlightSummaryForNotif(f) {
  const fn = safeString(f.flightNo, "Flight").trim();
  const dep = safeString(f.dep).toUpperCase().trim() || "—";
  const arr = safeString(f.arr).toUpperCase().trim() || "—";
  const datePart = f.std ? String(f.std).slice(0, 10) : safeString(f.date);
  const stdTime = f.std && String(f.std).length >= 16 ? String(f.std).slice(11, 16) : safeString(f.std);
  const staTime = f.sta && String(f.sta).length >= 16 ? String(f.sta).slice(11, 16) : safeString(f.sta);
  const timePart = stdTime ? ` · ${stdTime}${staTime ? `-${staTime}` : ""} UTC` : "";
  const acftPart = f.acft ? ` · ${f.acft}` : "";
  return { fn, dep, arr, datePart, stdTime, staTime, summary: `${fn} (${dep} → ${arr})${datePart ? ` [${datePart}]` : ""}${timePart}${acftPart}` };
}

function dispatchFlightNotificationsAsync(mode, flight, prevFlight = null) {
  if (flight?.skipNotifications) return;

  Promise.resolve().then(async () => {
    const nextSlots = safeArray(flight?.crewSlots).filter(
      (s) => s && safeString(s.crewId).trim()
    );
    const prevSlots = safeArray(prevFlight?.crewSlots).filter(
      (s) => s && safeString(s.crewId).trim()
    );
    const prevMap = new Map(
      prevSlots.map((s) => [String(s.crewId).trim(), safeString(s.position)])
    );
    const nextMap = new Map(
      nextSlots.map((s) => [String(s.crewId).trim(), safeString(s.position)])
    );

    const { fn, dep, arr, stdTime, staTime, summary } =
      formatFlightSummaryForNotif(flight);

    const tasks = [];

    for (const slot of nextSlots) {
      const cid = String(slot.crewId).trim();
      const pos = safeString(slot.position || "Crew").toUpperCase();
      const wasAssigned = prevMap.has(cid);
      const prevPos = prevMap.get(cid);
      const isNewAssignment =
        mode === "create" || !wasAssigned || (prevPos && prevPos.toUpperCase() !== pos);

      const metaInfo = resolveCrewMeta(cid, slot);
      const msg = isNewAssignment
        ? `✈️ رحلة جديدة مسندة إليك (${pos}): ${summary}`
        : `🔄 تحديث بيانات الرحلة (${pos}): ${summary}`;

      tasks.push(
        sendNotification(cid, msg, {
          flightId: safeString(flight.id),
          flightNo: fn,
          dep,
          arr,
          std: safeString(flight.std),
          sta: safeString(flight.sta),
          acft: safeString(flight.acft),
          position: safeString(slot.position),
          type: isNewAssignment ? "FLIGHT_ASSIGNED" : "FLIGHT_UPDATED",
          recipientEmail: metaInfo.recipientEmail,
          recipientUsername: metaInfo.recipientUsername,
          crewName: metaInfo.crewName,
        }).catch((err) => console.warn("Crew notification warning:", err))
      );
    }

    if (mode === "update" && prevSlots.length > 0) {
      for (const oldSlot of prevSlots) {
        const oldCid = String(oldSlot.crewId).trim();
        if (!nextMap.has(oldCid)) {
          const metaInfo = resolveCrewMeta(oldCid, oldSlot);
          tasks.push(
            sendNotification(
              oldCid,
              `ℹ️ تم رفع تكليفك من الرحلة: ${summary}`,
              {
                flightId: safeString(flight.id),
                flightNo: fn,
                dep,
                arr,
                std: safeString(flight.std),
                sta: safeString(flight.sta),
                acft: safeString(flight.acft),
                type: "FLIGHT_UPDATED",
                recipientEmail: metaInfo.recipientEmail,
                recipientUsername: metaInfo.recipientUsername,
                crewName: metaInfo.crewName,
              }
            ).catch(() => {})
          );
        }
      }
    }

    await Promise.allSettled(tasks);
  });
}

/* ═══════════════════════════════════════════════════════════
 * FLIGHTS
 * ═══════════════════════════════════════════════════════════ */
function normalizeFlightRecord(f) {
  const actual = safeObject(f.actual);
  const dep = safeString(f.dep).toUpperCase().trim();
  const arr = safeString(f.arr).toUpperCase().trim();
  const rawSlots = safeArray(f.crewSlots);
  const crewSlots = rawSlots
    .filter((s) => s && safeString(s.crewId).trim())
    .map((s) => ({
      ...s,
      crewId: safeString(s.crewId).trim(),
      position: safeString(s.position).trim(),
      email: safeString(s.email).trim().toLowerCase(),
    }));

  return {
    ...f,
    id: safeString(f.id),
    flightNo: safeString(f.flightNo).trim(),
    dep,
    arr,
    altn: safeString(f.altn).toUpperCase().trim(),
    altn2: safeString(f.altn2).toUpperCase().trim(),
    std: safeString(f.std),
    sta: safeString(f.sta),
    acft: safeString(f.acft).trim(),
    crewSlots,
    legs: normalizeLegs(f.legs),
    actual: actual || {},
    pax: safeNumber(f.pax, 0),
    cargo: safeNumber(f.cargo, 0),
    status: safeString(f.status, "SCHEDULED") || "SCHEDULED",
    flightType: safeString(f.flightType, "SCHEDULED") || "SCHEDULED",
    notes: safeString(f.notes),
    permits: safeString(f.permits),
    services: safeString(f.services),
    route: safeString(f.route, `${dep}/${arr}`),
  };
}

export const flightsAPI = {
  list: async () => {
    const list = await apiRead("Flights");
    const normalized = list.map(normalizeFlightRecord);
    return writeSheetCache("Flights", normalized);
  },
  create: async (f) => {
    const cleanSlots = safeArray(f.crewSlots)
      .filter((s) => s && safeString(s.crewId).trim() && safeString(s.position).trim())
      .map((s) => ({
        crewId: safeString(s.crewId).trim(),
        position: safeString(s.position).trim(),
        ...(s.email ? { email: safeString(s.email).trim().toLowerCase() } : {}),
      }));
    const dep = safeString(f.dep).toUpperCase().trim();
    const arr = safeString(f.arr).toUpperCase().trim();
    const payload = {
      flightNo: safeString(f.flightNo).trim(),
      dep,
      arr,
      altn: safeString(f.altn).toUpperCase().trim(),
      altn2: safeString(f.altn2).toUpperCase().trim(),
      std: safeString(f.std),
      sta: safeString(f.sta),
      acft: safeString(f.acft).trim(),
      status: safeString(f.status, "SCHEDULED") || "SCHEDULED",
      flightType: safeString(f.flightType, "SCHEDULED") || "SCHEDULED",
      notes: safeString(f.notes),
      permits: safeString(f.permits),
      services: safeString(f.services),
      pax: safeNumber(f.pax, 0),
      cargo: safeNumber(f.cargo, 0),
      crewSlots: JSON.stringify(cleanSlots),
      actual:
        f.actual && Object.keys(f.actual).length > 0
          ? JSON.stringify(f.actual)
          : "",
      legs: serializeLegs(f.legs || []),
      route: safeString(f.route) || `${dep}/${arr}`,
    };

    const res = await apiCall("create", "Flights", payload);
    const createdRecord = normalizeFlightRecord({
      ...f,
      ...payload,
      crewSlots: cleanSlots,
      legs: f.legs || [],
      actual: f.actual || {},
      id: res?.id || f.id || `fl_${Date.now()}`,
    });

    const cached = readSheetCache("Flights", []);
    writeSheetCache("Flights", [
      ...cached.filter((x) => String(x.id) !== String(createdRecord.id)),
      createdRecord,
    ]);

    dispatchFlightNotificationsAsync("create", {
      ...createdRecord,
      skipNotifications: f.skipNotifications,
    });

    return { ...(res || {}), id: createdRecord.id };
  },
  update: async (id, f) => {
    const cached = readSheetCache("Flights", []);
    const prevFlight = cached.find((x) => String(x.id) === String(id)) || null;

    const cleanSlots = safeArray(f.crewSlots)
      .filter((s) => s && safeString(s.crewId).trim() && safeString(s.position).trim())
      .map((s) => ({
        crewId: safeString(s.crewId).trim(),
        position: safeString(s.position).trim(),
        ...(s.email ? { email: safeString(s.email).trim().toLowerCase() } : {}),
      }));
    const dep = safeString(f.dep).toUpperCase().trim();
    const arr = safeString(f.arr).toUpperCase().trim();
    const payload = {
      flightNo: safeString(f.flightNo).trim(),
      dep,
      arr,
      altn: safeString(f.altn).toUpperCase().trim(),
      altn2: safeString(f.altn2).toUpperCase().trim(),
      std: safeString(f.std),
      sta: safeString(f.sta),
      acft: safeString(f.acft).trim(),
      status: safeString(f.status, "SCHEDULED") || "SCHEDULED",
      flightType: safeString(f.flightType, "SCHEDULED") || "SCHEDULED",
      notes: safeString(f.notes),
      permits: safeString(f.permits),
      services: safeString(f.services),
      pax: safeNumber(f.pax, 0),
      cargo: safeNumber(f.cargo, 0),
      crewSlots: JSON.stringify(cleanSlots),
      actual:
        f.actual && Object.keys(f.actual).length > 0
          ? JSON.stringify(f.actual)
          : "",
      legs: serializeLegs(f.legs || []),
      route: safeString(f.route) || `${dep}/${arr}`,
    };

    const res = await apiCall("update", "Flights", payload, id);
    const updatedRecord = normalizeFlightRecord({
      ...prevFlight,
      ...f,
      ...payload,
      crewSlots: cleanSlots,
      legs: f.legs || [],
      actual: f.actual || {},
      id: safeString(id),
    });

    writeSheetCache(
      "Flights",
      cached.some((x) => String(x.id) === String(id))
        ? cached.map((x) => (String(x.id) === String(id) ? updatedRecord : x))
        : [...cached, updatedRecord]
    );

    dispatchFlightNotificationsAsync(
      "update",
      { ...updatedRecord, skipNotifications: f.skipNotifications },
      prevFlight
    );

    return res;
  },
  remove: async (id) => {
    const res = await apiCall("delete", "Flights", {}, id);
    const cached = readSheetCache("Flights", []);
    writeSheetCache(
      "Flights",
      cached.filter((x) => String(x.id) !== String(id))
    );
    return res;
  },
};

/* ═══════════════════════════════════════════════════════════
 * USERS / ROLES
 * ═══════════════════════════════════════════════════════════ */
export const usersAPI = {
  list: async () => {
    const list = await apiRead("Users");
    const normalized = list.map((u) => ({
      ...u,
      id: safeString(u.id),
      perms: safeArray(u.perms),
      active: safeActiveBool(u.active),
      username: safeString(u.username).trim(),
      password: safeString(u.password),
      fullName: safeString(u.fullName),
      email: safeString(u.email).trim(),
      phone: safeString(u.phone),
      jobTitle: safeString(u.jobTitle),
      crewId: safeString(u.crewId).trim(),
      avatar: cleanUrl(u.avatar),
      role: safeString(u.role, "crewMember") || "crewMember",
    }));
    return writeSheetCache("Users", normalized);
  },
  create: (u) =>
    apiCall("create", "Users", {
      username: safeString(u.username).trim(),
      password: safeString(u.password),
      fullName: safeString(u.fullName),
      role: u.role || "dispatcher",
      email: safeString(u.email).trim(),
      phone: safeString(u.phone),
      jobTitle: safeString(u.jobTitle),
      active: u.active !== false,
      crewId: safeString(u.crewId).trim(),
      perms: JSON.stringify(u.perms || []),
      avatar: u.avatar || "",
    }),
  update: (id, u) =>
    apiCall(
      "update",
      "Users",
      {
        username: safeString(u.username).trim(),
        password: safeString(u.password),
        fullName: safeString(u.fullName),
        role: u.role || "dispatcher",
        email: safeString(u.email).trim(),
        phone: safeString(u.phone),
        jobTitle: safeString(u.jobTitle),
        active: u.active !== false,
        crewId: safeString(u.crewId).trim(),
        perms: JSON.stringify(u.perms || []),
        avatar: u.avatar || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "Users", {}, id),
};

export const rolesAPI = {
  list: async () => {
    const list = await apiRead("Roles");
    const normalized = list.map((r) => ({
      id: safeString(r.id),
      name: safeString(r.name),
      nameAr: safeString(r.nameAr, r.name),
      description: safeString(r.description),
      perms: safeArray(r.perms),
      active: safeActiveBool(r.active),
    }));
    return writeSheetCache("Roles", normalized);
  },
  create: (role) =>
    apiCall("create", "Roles", {
      name: role.name || "",
      nameAr: role.nameAr || role.name || "",
      description: role.description || "",
      perms: JSON.stringify(role.perms || []),
      active: role.active !== false,
    }),
  update: (id, role) =>
    apiCall(
      "update",
      "Roles",
      {
        name: role.name || "",
        nameAr: role.nameAr || role.name || "",
        description: role.description || "",
        perms: JSON.stringify(role.perms || []),
        active: role.active !== false,
      },
      id
    ),
  remove: (id) => apiCall("delete", "Roles", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * SETTINGS
 * ═══════════════════════════════════════════════════════════ */
const LOCAL_TIME_FORMAT_KEY = "aeroops.timeFormat";

function readLocalTimeFormat() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(LOCAL_TIME_FORMAT_KEY);
    return v === "12" || v === "24" ? v : null;
  } catch {
    return null;
  }
}

export function applyGlobalTimeFormat(tf) {
  const normalized = String(tf) === "12" ? "12" : "24";
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_TIME_FORMAT_KEY, normalized);
    } catch {}
    window.__AEROOPS_TIME_FORMAT = normalized;
    window.dispatchEvent(
      new CustomEvent("aeroops:timeFormatChanged", { detail: normalized })
    );
  }
  return normalized;
}

export const settingsAPI = {
  get: async () => {
    const list = await apiRead("Settings");
    if (!list[0]) return null;
    const s = list[0];
    const sheetTf =
      s.timeFormat === "12" || s.timeFormat === 12
        ? "12"
        : s.timeFormat === "24" || s.timeFormat === 24
        ? "24"
        : null;
    const localTf = readLocalTimeFormat();
    const resolvedTimeFormat = localTf || sheetTf || "24";
    if (typeof window !== "undefined") {
      window.__AEROOPS_TIME_FORMAT = resolvedTimeFormat;
    }

    const resolvedSettings = {
      ...s,
      companyName: safeString(s.companyName, "Flight Operations"),
      companyNameAr: safeString(s.companyNameAr, "إدارة العمليات الجوية"),
      operatorCode: safeString(s.operatorCode, "EACS"),
      country: safeString(s.country, ""),
      navLayout: safeString(s.navLayout, "top"),
      tabPreferences: safeObject(s.tabPreferences) || null,
      customMenus: (() => {
        if (Array.isArray(s.customMenus)) return s.customMenus;
        const tp = safeObject(s.tabPreferences);
        if (Array.isArray(tp?.__customMenus)) return tp.__customMenus;
        if (Array.isArray(tp?.customMenus)) return tp.customMenus;
        try {
          if (typeof s.customMenus === "string") {
            const p = JSON.parse(s.customMenus);
            if (Array.isArray(p)) return p;
          }
        } catch {}
        return [];
      })(),
      logo: cleanUrl(s.logo),
      stamp: cleanUrl(s.stamp),
      timeMode: safeString(s.timeMode, "utc"),
      timeFormat: resolvedTimeFormat,
      emailFrom: cleanUrl(s.emailFrom || ""),
      autoFlightEmails: s.autoFlightEmails !== false,
      autoExpiryAlerts: s.autoExpiryAlerts !== false,
      positions: normalizePositions(s.positions),
      globalTheme: safeString(s.globalTheme || s.portalTheme, "modern"),
      portalTheme: safeString(s.globalTheme || s.portalTheme, "modern"),
      aircraftType: safeString(s.aircraftType, "A319"),
      coaExpiry: safeString(s.coaExpiry, ""),
      address: safeString(s.address, ""),
      phone: safeString(s.phone, ""),
      email: safeString(s.email, ""),
      sita: safeString(s.sita, ""),
      fax: safeString(s.fax, ""),
      contactPerson: safeString(s.contactPerson, ""),
      seatCapacity: safeNumber(s.seatCapacity, 0),
      cargoCapacity: safeNumber(s.cargoCapacity, 0),
      noiseCertificate: safeString(s.noiseCertificate, ""),
    };
    writeSheetCache("Settings", resolvedSettings);
    return resolvedSettings;
  },
  save: async (data) => {
    let existing = null;
    try {
      existing = await settingsAPI.get();
    } catch {}

    const pick = (key, fallback) =>
      data[key] !== undefined ? data[key] : existing?.[key] ?? fallback;

    const chosenTimeFormat =
      String(pick("timeFormat", readLocalTimeFormat() || "24")) === "12"
        ? "12"
        : "24";
    applyGlobalTimeFormat(chosenTimeFormat);

    const unifiedTheme = safeString(
      data.globalTheme ??
        data.portalTheme ??
        existing?.globalTheme ??
        existing?.portalTheme,
      "modern"
    );

    const merged = {
      companyName: pick("companyName", ""),
      companyNameAr: pick("companyNameAr", ""),
      operatorCode: String(pick("operatorCode", "EACS")).toUpperCase(),
      country: pick("country", ""),
      navLayout: pick("navLayout", "top"),
      customMenus: pick("customMenus", existing?.customMenus || []),
      tabPreferences: (() => {
        const incoming = pick("tabPreferences", null);
        const prevLayouts = existing?.tabPreferences?.__dashboardLayouts;
        const prevMenus =
          existing?.tabPreferences?.__customMenus || existing?.customMenus;
        if (!incoming && !prevLayouts && !prevMenus) return null;
        const base =
          incoming && typeof incoming === "object" ? { ...incoming } : {};
        if (prevLayouts && !base.__dashboardLayouts) {
          base.__dashboardLayouts = prevLayouts;
        }
        if (!base.__customMenus) {
          if (Array.isArray(data.customMenus)) {
            base.__customMenus = data.customMenus;
          } else if (Array.isArray(prevMenus)) {
            base.__customMenus = prevMenus;
          }
        }
        return Object.keys(base).length > 0 ? base : null;
      })(),
      logo: pick("logo", ""),
      stamp: pick("stamp", ""),
      timeMode: pick("timeMode", "utc"),
      timeFormat: chosenTimeFormat,
      emailFrom: pick("emailFrom", ""),
      autoFlightEmails: pick("autoFlightEmails", true),
      autoExpiryAlerts: pick("autoExpiryAlerts", true),
      positions: pick("positions", []),
      globalTheme: unifiedTheme,
      portalTheme: unifiedTheme,
      aircraftType: pick("aircraftType", ""),
      coaExpiry: pick("coaExpiry", ""),
      address: pick("address", ""),
      phone: pick("phone", ""),
      email: pick("email", ""),
      sita: pick("sita", ""),
      fax: pick("fax", ""),
      contactPerson: pick("contactPerson", ""),
      seatCapacity: pick("seatCapacity", 0),
      cargoCapacity: pick("cargoCapacity", 0),
      noiseCertificate: pick("noiseCertificate", ""),
    };

    const payload = {
      ...merged,
      tabPreferences: merged.tabPreferences
        ? JSON.stringify(merged.tabPreferences)
        : "",
      positions: serializePositions(merged.positions),
    };

    if (existing && existing.id)
      return apiCall("update", "Settings", payload, existing.id);
    return apiCall("create", "Settings", payload);
  },
};

/* ═══════════════════════════════════════════════════════════
 * AUDIT / ROSTER / STANDBY / LEAVE / TRAINING
 * ═══════════════════════════════════════════════════════════ */
export const auditAPI = {
  list: async () => {
    const list = await apiRead("AuditLog");
    const normalized = list.map((l) => ({
      ...l,
      id: safeString(l.id),
      timestamp: safeString(l.timestamp),
      userId: safeString(l.userId),
      userName: safeString(l.userName),
      userRole: safeString(l.userRole),
      action: safeString(l.action),
      entity: safeString(l.entity),
      entityId: safeString(l.entityId),
      entityName: safeString(l.entityName),
      details: safeString(l.details, "{}"),
      ipAddress: safeString(l.ipAddress),
      userAgent: safeString(l.userAgent),
    }));
    return writeSheetCache("AuditLog", normalized);
  },
  create: (log) =>
    apiCall("create", "AuditLog", {
      timestamp: log.timestamp || new Date().toISOString(),
      userId: log.userId || "",
      userName: log.userName || "",
      userRole: log.userRole || "",
      action: log.action || "",
      entity: log.entity || "",
      entityId: log.entityId || "",
      entityName: log.entityName || "",
      details:
        typeof log.details === "string"
          ? log.details
          : JSON.stringify(log.details || {}),
      ipAddress: log.ipAddress || "",
      userAgent: log.userAgent || "",
    }),
  remove: (id) => apiCall("delete", "AuditLog", {}, id),
  clearAll: async () => {
    try {
      return await apiCall("clearAll", "AuditLog", {});
    } catch {
      const items = await auditAPI.list();
      for (const item of items) {
        if (item.id) await auditAPI.remove(item.id).catch(() => {});
      }
      return { ok: true };
    }
  },
};

export const rosterAPI = {
  list: async () => {
    const list = await apiRead("Roster");
    const normalized = list.map((r) => ({
      ...r,
      id: safeString(r.id),
      date: safeString(r.date),
      crewId: safeString(r.crewId),
      crewName: safeString(r.crewName),
      groupId: safeString(r.groupId),
      type: safeString(r.type, "FLIGHT"),
      flightIds: safeArray(r.flightIds),
      startTime: safeString(r.startTime),
      endTime: safeString(r.endTime),
      notes: safeString(r.notes),
      status: safeString(r.status, "published"),
      publishedAt: safeString(r.publishedAt),
    }));
    return writeSheetCache("Roster", normalized);
  },
  create: async (r) => {
    const res = await apiCall("create", "Roster", {
      date: r.date || "",
      crewId: r.crewId || "",
      crewName: r.crewName || "",
      groupId: r.groupId || "",
      type: r.type || "FLIGHT",
      flightIds: JSON.stringify(r.flightIds || []),
      startTime: r.startTime || "",
      endTime: r.endTime || "",
      notes: r.notes || "",
      status: r.status || "published",
      publishedAt: r.publishedAt || "",
    });
    if (r.crewId) {
      const meta = resolveCrewMeta(r.crewId, { crewName: r.crewName });
      Promise.resolve().then(() =>
        sendNotification(
          String(r.crewId),
          `📅 تحديث الجدول الشهري (Roster): ${r.type || "FLIGHT"} بتاريخ ${r.date || ""}${r.startTime ? ` (${r.startTime}${r.endTime ? `-${r.endTime}` : ""} UTC)` : ""}`,
          {
            type: "FLIGHT_ASSIGNED",
            recipientEmail: meta.recipientEmail,
            recipientUsername: meta.recipientUsername,
            crewName: meta.crewName,
          }
        ).catch(() => {})
      );
    }
    return res;
  },
  update: async (id, r) => {
    const res = await apiCall(
      "update",
      "Roster",
      {
        date: r.date || "",
        crewId: r.crewId || "",
        crewName: r.crewName || "",
        groupId: r.groupId || "",
        type: r.type || "FLIGHT",
        flightIds: JSON.stringify(r.flightIds || []),
        startTime: r.startTime || "",
        endTime: r.endTime || "",
        notes: r.notes || "",
        status: r.status || "published",
        publishedAt: r.publishedAt || "",
      },
      id
    );
    if (r.crewId) {
      const meta = resolveCrewMeta(r.crewId, { crewName: r.crewName });
      Promise.resolve().then(() =>
        sendNotification(
          String(r.crewId),
          `📅 تعديل في الجدول الشهري (Roster): ${r.type || "FLIGHT"} بتاريخ ${r.date || ""}`,
          {
            type: "FLIGHT_UPDATED",
            recipientEmail: meta.recipientEmail,
            recipientUsername: meta.recipientUsername,
            crewName: meta.crewName,
          }
        ).catch(() => {})
      );
    }
    return res;
  },
  remove: (id) => apiCall("delete", "Roster", {}, id),
};

export const standbyAPI = {
  list: async () => {
    const list = await apiRead("Standby");
    const normalized = list.map((s) => ({
      ...s,
      id: safeString(s.id),
      date: safeString(s.date),
      crewId: safeString(s.crewId),
      crewName: safeString(s.crewName),
      type: safeString(s.type, "AIRPORT"),
      startTime: safeString(s.startTime),
      endTime: safeString(s.endTime),
      durationMin: safeNumber(s.durationMin, 0),
      activated: safeBool(s.activated),
      activatedAt: safeString(s.activatedAt),
      flightId: safeString(s.flightId),
      notes: safeString(s.notes),
    }));
    return writeSheetCache("Standby", normalized);
  },
  create: async (s) => {
    const res = await apiCall("create", "Standby", {
      date: s.date || "",
      crewId: s.crewId || "",
      crewName: s.crewName || "",
      type: s.type || "AIRPORT",
      startTime: s.startTime || "",
      endTime: s.endTime || "",
      durationMin: s.durationMin || 0,
      activated: s.activated || false,
      activatedAt: s.activatedAt || "",
      flightId: s.flightId || "",
      notes: s.notes || "",
    });
    if (s.crewId) {
      const meta = resolveCrewMeta(s.crewId, { crewName: s.crewName });
      Promise.resolve().then(() =>
        sendNotification(
          String(s.crewId),
          `⚡ تكليف نوبة احتياط (Standby - ${s.type || "AIRPORT"}): ${s.date || ""} (${s.startTime || ""} - ${s.endTime || ""} UTC)`,
          {
            type: "FLIGHT_ASSIGNED",
            recipientEmail: meta.recipientEmail,
            recipientUsername: meta.recipientUsername,
            crewName: meta.crewName,
          }
        ).catch(() => {})
      );
    }
    return res;
  },
  update: async (id, s) => {
    const res = await apiCall(
      "update",
      "Standby",
      {
        date: s.date || "",
        crewId: s.crewId || "",
        crewName: s.crewName || "",
        type: s.type || "AIRPORT",
        startTime: s.startTime || "",
        endTime: s.endTime || "",
        durationMin: s.durationMin || 0,
        activated: s.activated || false,
        activatedAt: s.activatedAt || "",
        flightId: s.flightId || "",
        notes: s.notes || "",
      },
      id
    );
    if (s.crewId) {
      const meta = resolveCrewMeta(s.crewId, { crewName: s.crewName });
      Promise.resolve().then(() =>
        sendNotification(
          String(s.crewId),
          s.activated
            ? `🚨 تفعيل نوبة الاحتياط (Standby Activated): ${s.date || ""}`
            : `⚡ تحديث نوبة الاحتياط (Standby): ${s.date || ""} (${s.startTime || ""} - ${s.endTime || ""} UTC)`,
          {
            type: "FLIGHT_UPDATED",
            recipientEmail: meta.recipientEmail,
            recipientUsername: meta.recipientUsername,
            crewName: meta.crewName,
          }
        ).catch(() => {})
      );
    }
    return res;
  },
  remove: (id) => apiCall("delete", "Standby", {}, id),
};

export const leaveAPI = {
  list: async () => {
    const list = await apiRead("Leave");
    const normalized = list.map((l) => ({
      ...l,
      id: safeString(l.id),
      crewId: safeString(l.crewId),
      crewName: safeString(l.crewName),
      type: safeString(l.type, "ANNUAL"),
      fromDate: safeString(l.fromDate),
      toDate: safeString(l.toDate),
      days: safeNumber(l.days, 0),
      reason: safeString(l.reason),
      status: safeString(l.status, "pending"),
      requestedAt: safeString(l.requestedAt),
      approvedBy: safeString(l.approvedBy),
      approvedAt: safeString(l.approvedAt),
      notes: safeString(l.notes),
    }));
    return writeSheetCache("Leave", normalized);
  },
  create: (l) =>
    apiCall("create", "Leave", {
      crewId: l.crewId || "",
      crewName: l.crewName || "",
      type: l.type || "ANNUAL",
      fromDate: l.fromDate || "",
      toDate: l.toDate || "",
      days: l.days || 0,
      reason: l.reason || "",
      status: l.status || "pending",
      requestedAt: l.requestedAt || new Date().toISOString(),
      approvedBy: l.approvedBy || "",
      approvedAt: l.approvedAt || "",
      notes: l.notes || "",
    }),
  update: (id, l) =>
    apiCall(
      "update",
      "Leave",
      {
        crewId: l.crewId || "",
        crewName: l.crewName || "",
        type: l.type || "ANNUAL",
        fromDate: l.fromDate || "",
        toDate: l.toDate || "",
        days: l.days || 0,
        reason: l.reason || "",
        status: l.status || "pending",
        requestedAt: l.requestedAt || "",
        approvedBy: l.approvedBy || "",
        approvedAt: l.approvedAt || "",
        notes: l.notes || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "Leave", {}, id),
};

export const trainingAPI = {
  list: async () => {
    const list = await apiRead("Training");
    const normalized = list.map((t) => ({
      ...t,
      id: safeString(t.id),
      crewId: safeString(t.crewId),
      crewName: safeString(t.crewName),
      type: safeString(t.type, "SIMULATOR"),
      title: safeString(t.title),
      date: safeString(t.date),
      expiryDate: safeString(t.expiryDate),
      instructor: safeString(t.instructor),
      location: safeString(t.location),
      result: safeString(t.result, "PASS"),
      score: safeString(t.score),
      notes: safeString(t.notes),
      certificate: safeString(t.certificate),
    }));
    return writeSheetCache("Training", normalized);
  },
  create: (t) =>
    apiCall("create", "Training", {
      crewId: t.crewId || "",
      crewName: t.crewName || "",
      type: t.type || "SIMULATOR",
      title: t.title || "",
      date: t.date || "",
      expiryDate: t.expiryDate || "",
      instructor: t.instructor || "",
      location: t.location || "",
      result: t.result || "PASS",
      score: t.score || "",
      notes: t.notes || "",
      certificate: t.certificate || "",
    }),
  update: (id, t) =>
    apiCall(
      "update",
      "Training",
      {
        crewId: t.crewId || "",
        crewName: t.crewName || "",
        type: t.type || "SIMULATOR",
        title: t.title || "",
        date: t.date || "",
        expiryDate: t.expiryDate || "",
        instructor: t.instructor || "",
        location: t.location || "",
        result: t.result || "PASS",
        score: t.score || "",
        notes: t.notes || "",
        certificate: t.certificate || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "Training", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * LOGIN HISTORY / MANUALS / MANUALS AUDIT
 * ═══════════════════════════════════════════════════════════ */
export const loginHistoryAPI = {
  list: async () => {
    const list = await apiRead("LoginHistory");
    const normalized = list.map((h) => ({
      ...h,
      id: safeString(h.id),
      timestamp: safeString(h.timestamp),
      userId: safeString(h.userId),
      userName: safeString(h.userName),
      username: safeString(h.username),
      userRole: safeString(h.userRole),
      action: safeString(h.action, "LOGIN"),
      browser: safeString(h.browser),
      os: safeString(h.os),
      userAgent: safeString(h.userAgent),
      ipAddress: safeString(h.ipAddress),
      success: safeBool(h.success) || h.success === undefined,
      reason: safeString(h.reason),
    }));
    return writeSheetCache("LoginHistory", normalized);
  },
  create: (h) =>
    apiCall("create", "LoginHistory", {
      timestamp: h.timestamp || new Date().toISOString(),
      userId: h.userId || "",
      userName: h.userName || "",
      username: h.username || "",
      userRole: h.userRole || "",
      action: h.action || "LOGIN",
      browser: h.browser || "",
      os: h.os || "",
      userAgent: h.userAgent || "",
      ipAddress: h.ipAddress || "",
      success: h.success !== false,
      reason: h.reason || "",
    }),
  remove: (id) => apiCall("delete", "LoginHistory", {}, id),
  clearAll: async () => {
    try {
      return await apiCall("clearAll", "LoginHistory", {});
    } catch {
      const items = await loginHistoryAPI.list();
      for (const item of items) {
        if (item.id) await loginHistoryAPI.remove(item.id).catch(() => {});
      }
      return { ok: true };
    }
  },
};

export const manualsAPI = {
  list: async () => {
    const list = await apiRead("Manuals");
    const normalized = list.map((m) => ({
      ...m,
      id: safeString(m.id),
      code: safeString(m.code, ""),
      title_en: safeString(m.title_en, "Untitled"),
      title_ar: safeString(m.title_ar, ""),
      category: safeString(m.category, "Operations"),
      rev: safeString(m.rev, ""),
      effectiveDate: safeString(m.effectiveDate, ""),
      approval: safeString(m.approval, ""),
      status: safeString(m.status, "active"),
      pages: safeNumber(m.pages, 0),
      fileSize: safeString(m.fileSize, ""),
      pdfData: cleanUrl(m.pdfData || ""),
      pdfName: safeString(m.pdfName, ""),
      visibleTo: safeString(m.visibleTo, "all"),
      lastUpdated: safeString(m.lastUpdated, ""),
      lastUpdatedBy: safeString(m.lastUpdatedBy, ""),
      lastUpdatedById: safeString(m.lastUpdatedById, ""),
      summary: safeString(m.summary, ""),
      chapters: safeArray(m.chapters),
    }));
    return writeSheetCache("Manuals", normalized);
  },
  create: (m) => {
    const safePdfUrl =
      typeof m.pdfData === "string" &&
      !m.pdfData.startsWith("data:") &&
      m.pdfData.length <= 45000
        ? m.pdfData
        : "";
    return apiCall("create", "Manuals", {
      code: m.code || "",
      title_en: m.title_en || "",
      title_ar: m.title_ar || "",
      category: m.category || "Operations",
      rev: m.rev || "",
      effectiveDate: m.effectiveDate || "",
      approval: m.approval || "",
      status: m.status || "active",
      pages: m.pages || 0,
      fileSize: m.fileSize || "",
      pdfData: safePdfUrl,
      pdfName: m.pdfName || "",
      visibleTo: m.visibleTo || "all",
      lastUpdated: m.lastUpdated || new Date().toISOString(),
      lastUpdatedBy: m.lastUpdatedBy || "",
      lastUpdatedById: m.lastUpdatedById || "",
      summary: String(m.summary || "").slice(0, 20000),
      chapters: JSON.stringify(m.chapters || []),
    });
  },
  update: (id, m) => {
    const safePdfUrl =
      typeof m.pdfData === "string" &&
      !m.pdfData.startsWith("data:") &&
      m.pdfData.length <= 45000
        ? m.pdfData
        : "";
    return apiCall(
      "update",
      "Manuals",
      {
        code: m.code || "",
        title_en: m.title_en || "",
        title_ar: m.title_ar || "",
        category: m.category || "Operations",
        rev: m.rev || "",
        effectiveDate: m.effectiveDate || "",
        approval: m.approval || "",
        status: m.status || "active",
        pages: m.pages || 0,
        fileSize: m.fileSize || "",
        pdfData: safePdfUrl,
        pdfName: m.pdfName || "",
        visibleTo: m.visibleTo || "all",
        lastUpdated: m.lastUpdated || new Date().toISOString(),
        lastUpdatedBy: m.lastUpdatedBy || "",
        lastUpdatedById: m.lastUpdatedById || "",
        summary: String(m.summary || "").slice(0, 20000),
        chapters: JSON.stringify(m.chapters || []),
      },
      id
    );
  },
  remove: (id) => apiCall("delete", "Manuals", {}, id),
};

export const manualAuditAPI = {
  list: async () => {
    const list = await apiRead("ManualsAuditLog");
    return list.map((l) => ({
      ...l,
      timestamp: safeString(l.timestamp),
      userId: safeString(l.userId),
      userName: safeString(l.userName),
      userRole: safeString(l.userRole),
      action: safeString(l.action),
      manualId: safeString(l.manualId),
      manualCode: safeString(l.manualCode),
      manualTitle: safeString(l.manualTitle),
      previousUpdate: safeString(l.previousUpdate),
      newUpdate: safeString(l.newUpdate),
      details: safeString(l.details, "{}"),
    }));
  },
  create: (log) => apiCall("logManualAudit", null, log),
  remove: (id) => apiCall("deleteManualAuditLog", null, {}, id),
  clearOld: async (beforeDate) =>
    apiCall("clearOldManualAuditLog", null, { beforeDate }),
};

/* ═══════════════════════════════════════════════════════════
 * ALERTS
 * ═══════════════════════════════════════════════════════════ */
export const alertsAPI = {
  listDismissed: async () => {
    const list = await apiRead("DismissedAlerts");
    return list.map((d) => ({
      id: safeString(d.id),
      alertKey: safeString(d.alertKey),
      dismissedBy: safeString(d.dismissedBy),
      dismissedAt: safeString(d.dismissedAt),
      reason: safeString(d.reason),
    }));
  },
  dismiss: (alertKey, userId, userName, reason = "") =>
    apiCall("dismissAlert", null, { alertKey, dismissedBy: userName, reason }),
  undismiss: (alertKey) => apiCall("undismissAlert", null, { alertKey }),
};

/* ═══════════════════════════════════════════════════════════
 * CAMO / MEL
 * ═══════════════════════════════════════════════════════════ */
export const camoAPI = {
  list: async () => {
    const list = await apiRead("CAMO");
    const normalized = list.map((c) => ({
      ...c,
      id: safeString(c.id),
      reg: safeString(c.reg).toUpperCase().trim(),
      type: safeString(c.type),
      tah: safeNumber(c.tah, 0),
      tac: safeNumber(c.tac, 0),
      engine1Hours: safeNumber(c.engine1Hours, 0),
      engine1Cycles: safeNumber(c.engine1Cycles, 0),
      engine2Hours: safeNumber(c.engine2Hours, 0),
      engine2Cycles: safeNumber(c.engine2Cycles, 0),
      apuHours: safeNumber(c.apuHours, 0),
      apuCycles: safeNumber(c.apuCycles, 0),
      llpHours: safeNumber(c.llpHours, 0),
      llpCycles: safeNumber(c.llpCycles, 0),
      adCompliance: safeArray(c.adCompliance),
      sbCompliance: safeArray(c.sbCompliance),
      damageList: safeArray(c.damageList),
      attachments: normalizeCamoAttachments(c.attachments),
      status: safeString(c.status, "AIRWORTHY"),
    }));
    return writeSheetCache("CAMO", normalized);
  },
  create: (c) =>
    apiCall("create", "CAMO", {
      reg: c.reg || "",
      type: c.type || "",
      tah: c.tah || 0,
      tac: c.tac || 0,
      lastCheckDate: c.lastCheckDate || "",
      lastCheckType: c.lastCheckType || "",
      nextCheckDate: c.nextCheckDate || "",
      nextCheckType: c.nextCheckType || "",
      coaExpiry: c.coaExpiry || "",
      insuranceExpiry: c.insuranceExpiry || "",
      noiseCertExpiry: c.noiseCertExpiry || "",
      engine1Hours: c.engine1Hours || 0,
      engine1Cycles: c.engine1Cycles || 0,
      engine2Hours: c.engine2Hours || 0,
      engine2Cycles: c.engine2Cycles || 0,
      apuHours: c.apuHours || 0,
      apuCycles: c.apuCycles || 0,
      llpHours: c.llpHours || 0,
      llpCycles: c.llpCycles || 0,
      adCompliance: JSON.stringify(c.adCompliance || []),
      sbCompliance: JSON.stringify(c.sbCompliance || []),
      damageList: JSON.stringify(c.damageList || []),
      notes: c.notes || "",
      status: c.status || "AIRWORTHY",
        attachments: serializeAttachments(c.attachments),
        lastUpdated: new Date().toISOString(),
        updatedBy: c.updatedBy || "",
      }),
  update: (id, c) =>
    apiCall(
      "update",
      "CAMO",
      {
        reg: c.reg || "",
        type: c.type || "",
        tah: c.tah || 0,
        tac: c.tac || 0,
        lastCheckDate: c.lastCheckDate || "",
        lastCheckType: c.lastCheckType || "",
        nextCheckDate: c.nextCheckDate || "",
        nextCheckType: c.nextCheckType || "",
        coaExpiry: c.coaExpiry || "",
        insuranceExpiry: c.insuranceExpiry || "",
        noiseCertExpiry: c.noiseCertExpiry || "",
        engine1Hours: c.engine1Hours || 0,
        engine1Cycles: c.engine1Cycles || 0,
        engine2Hours: c.engine2Hours || 0,
        engine2Cycles: c.engine2Cycles || 0,
        apuHours: c.apuHours || 0,
        apuCycles: c.apuCycles || 0,
        llpHours: c.llpHours || 0,
        llpCycles: c.llpCycles || 0,
        adCompliance: JSON.stringify(c.adCompliance || []),
        sbCompliance: JSON.stringify(c.sbCompliance || []),
        damageList: JSON.stringify(c.damageList || []),
        notes: c.notes || "",
        status: c.status || "AIRWORTHY",
        attachments: serializeAttachments(c.attachments),
        lastUpdated: new Date().toISOString(),
        updatedBy: c.updatedBy || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "CAMO", {}, id),
};

export const melAPI = {
  list: async () => {
    const list = await apiRead("MEL");
    const normalized = list.map((m) => ({
      ...m,
      id: safeString(m.id),
      reg: safeString(m.reg).toUpperCase().trim(),
      status: safeString(m.status, "OPEN"),
      category: safeString(m.category, "C"),
      attachments: normalizeCamoAttachments(m.attachments),
    }));
    return writeSheetCache("MEL", normalized);
  },
  create: (m) =>
    apiCall("create", "MEL", {
      reg: m.reg || "",
      melRef: m.melRef || "",
      item: m.item || "",
      status: m.status || "OPEN",
      category: m.category || "C",
      openedDate: m.openedDate || "",
      dueDate: m.dueDate || "",
      closedDate: m.closedDate || "",
      restrictions: m.restrictions || "",
      remarks: m.remarks || "",
      deferredReason: m.deferredReason || "",
      reportedBy: m.reportedBy || "",
      closedBy: m.closedBy || "",
      attachments: serializeAttachments(m.attachments),
    }),
  update: (id, m) =>
    apiCall(
      "update",
      "MEL",
      {
        reg: m.reg || "",
        melRef: m.melRef || "",
        item: m.item || "",
        status: m.status || "OPEN",
        category: m.category || "C",
        openedDate: m.openedDate || "",
        dueDate: m.dueDate || "",
        closedDate: m.closedDate || "",
        restrictions: m.restrictions || "",
        remarks: m.remarks || "",
        deferredReason: m.deferredReason || "",
        reportedBy: m.reportedBy || "",
        closedBy: m.closedBy || "",
        attachments: serializeAttachments(m.attachments),
      },
      id
    ),
  remove: (id) => apiCall("delete", "MEL", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * PERMITS
 * ═══════════════════════════════════════════════════════════ */
export const permitTemplatesAPI = {
  list: async () => {
    const list = await apiRead("PermitTemplates");
    return list.map((t) => ({
      ...t,
      fields: safeArray(t.fields),
      flightFields: safeArray(t.flightFields),
      attachments: normalizeCamoAttachments(t.attachments),
    }));
  },
  create: (t) =>
    apiCall("create", "PermitTemplates", {
      country: t.country || "",
      name: t.name || "",
      permitType: t.permitType || "OVERFLIGHT",
      fields: JSON.stringify(t.fields || []),
      flightFields: JSON.stringify(t.flightFields || []),
      attachments: serializeAttachments(t.attachments),
      notes: t.notes || "",
    }),
  update: (id, t) =>
    apiCall(
      "update",
      "PermitTemplates",
      {
        country: t.country || "",
        name: t.name || "",
        permitType: t.permitType || "OVERFLIGHT",
        fields: JSON.stringify(t.fields || []),
        flightFields: JSON.stringify(t.flightFields || []),
        attachments: serializeAttachments(t.attachments),
        notes: t.notes || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "PermitTemplates", {}, id),
};

export const flightPermitsAPI = {
  list: async () => {
    const list = await apiRead("FlightPermits");
    return list.map((p) => ({
      ...p,
      customFields: safeObject(p.customFields) || {},
      attachments: normalizeCamoAttachments(p.attachments),
      status: safeString(p.status, "DRAFT"),
    }));
  },
  listByFlight: async (flightId) => {
    const all = await flightPermitsAPI.list();
    return all.filter((p) => String(p.flightId) === String(flightId));
  },
  create: (p) =>
    apiCall("create", "FlightPermits", {
      flightId: p.flightId || "",
      country: p.country || "",
      permitType: p.permitType || "",
      permitNo: p.permitNo || "",
      issuedDate: p.issuedDate || "",
      expiryDate: p.expiryDate || "",
      issuedBy: p.issuedBy || "",
      customFields: JSON.stringify(p.customFields || {}),
      attachments: serializeAttachments(p.attachments),
      status: p.status || "DRAFT",
      notes: p.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: p.updatedBy || "",
    }),
  update: (id, p) =>
    apiCall(
      "update",
      "FlightPermits",
      {
        flightId: p.flightId || "",
        country: p.country || "",
        permitType: p.permitType || "",
        permitNo: p.permitNo || "",
        issuedDate: p.issuedDate || "",
        expiryDate: p.expiryDate || "",
        issuedBy: p.issuedBy || "",
        customFields: JSON.stringify(p.customFields || {}),
        attachments: serializeAttachments(p.attachments),
        status: p.status || "DRAFT",
        notes: p.notes || "",
        updatedAt: new Date().toISOString(),
        updatedBy: p.updatedBy || "",
      },
      id
    ),
  remove: (id) => apiCall("delete", "FlightPermits", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * CATERING (Templates, Orders, & Pre-Stored Items Catalog)
 * ═══════════════════════════════════════════════════════════ */
let _cateringItemsSheetAvailable = null;

function normalizeCateringItemRecord(item = {}) {
  const nameAr = safeString(item.nameAr).trim();
  const nameEn = safeString(item.nameEn).trim();
  const fallbackName = safeString(item.name || item.item).trim();
  return {
    id: safeString(item.id || item.itemId),
    code: safeString(item.code || item.itemCode),
    nameAr: nameAr || (!nameEn ? fallbackName : ""),
    nameEn,
    category: safeString(item.category, "HOT_MEAL") || "HOT_MEAL",
    unit: safeString(item.unit, "وجبة / Meal") || "وجبة / Meal",
    defaultQty: safeString(item.defaultQty, "1 per pax") || "1 per pax",
    notes: safeString(item.notes),
    active: safeActiveBool(item.active),
    createdAt: safeString(item.createdAt),
    updatedAt: safeString(item.updatedAt),
  };
}

function serializeCateringItemForSheet(item) {
  const norm = normalizeCateringItemRecord(item);
  return {
    itemId: norm.id,
    code: norm.code,
    nameAr: norm.nameAr,
    nameEn: norm.nameEn,
    category: norm.category,
    unit: norm.unit,
    defaultQty: norm.defaultQty,
    notes: norm.notes,
    active: Boolean(norm.active),
    createdAt: norm.createdAt || new Date().toISOString(),
    updatedAt: norm.updatedAt || new Date().toISOString(),
  };
}

async function persistCateringItemsFallback(cleanList) {
  try {
    await appConfigAPI.set("catering_items_v1", cleanList);
    return { ok: true, via: "AppConfig" };
  } catch {}

  const currentSettings = (await settingsAPI.get().catch(() => null)) || {};
  const prevTabPrefs =
    currentSettings.tabPreferences &&
    typeof currentSettings.tabPreferences === "object"
      ? currentSettings.tabPreferences
      : {};
  await settingsAPI.save({
    tabPreferences: {
      ...prevTabPrefs,
      __cateringItems: cleanList,
    },
  });
  return { ok: true, via: "Settings" };
}

export const cateringItemsAPI = {
  list: async () => {
    if (_cateringItemsSheetAvailable !== false) {
      try {
        const rows = await apiRead("CateringItems");
        _cateringItemsSheetAvailable = true;
        const normalized = (rows || [])
          .map((r) =>
            normalizeCateringItemRecord({
              ...r,
              id: safeString(r.itemId || r.id),
              _sheetRowId: safeString(r.id),
            })
          )
          .filter((x) => x.id && (x.nameAr || x.nameEn));
        if (normalized.length > 0) {
          return writeSheetCache("CateringItems", normalized);
        }
      } catch {
        _cateringItemsSheetAvailable = false;
      }
    }

    try {
      const cfgList = await appConfigAPI.get("catering_items_v1");
      if (Array.isArray(cfgList)) {
        const normalized = cfgList
          .map((it) => normalizeCateringItemRecord(it))
          .filter((x) => x.id && (x.nameAr || x.nameEn));
        return writeSheetCache("CateringItems", normalized);
      }
    } catch {}

    try {
      const s = await settingsAPI.get();
      const sList = s?.tabPreferences?.__cateringItems;
      if (Array.isArray(sList)) {
        const normalized = sList
          .map((it) => normalizeCateringItemRecord(it))
          .filter((x) => x.id && (x.nameAr || x.nameEn));
        return writeSheetCache("CateringItems", normalized);
      }
    } catch {}

    return readSheetCache("CateringItems", null);
  },

  saveAll: async (itemsList = []) => {
    const cleanList = (Array.isArray(itemsList) ? itemsList : [])
      .map((it) => normalizeCateringItemRecord(it))
      .filter((x) => x.id && (x.nameAr || x.nameEn));

    writeSheetCache("CateringItems", cleanList);

    if (_cateringItemsSheetAvailable !== false) {
      try {
        const existingRows = await apiRead("CateringItems");
        _cateringItemsSheetAvailable = true;
        const rowByItemId = new Map();
        (existingRows || []).forEach((r) => {
          const key = safeString(r.itemId || r.id);
          if (key) rowByItemId.set(key, r);
        });

        const nextIds = new Set(cleanList.map((it) => it.id));
        for (const it of cleanList) {
          const rowPayload = serializeCateringItemForSheet(it);
          const match = rowByItemId.get(it.id);
          if (match && match.id) {
            await apiCall("update", "CateringItems", rowPayload, match.id);
          } else {
            await apiCall("create", "CateringItems", rowPayload);
          }
        }
        for (const [itId, row] of rowByItemId.entries()) {
          if (!nextIds.has(itId) && row?.id) {
            await apiCall("delete", "CateringItems", {}, row.id).catch(() => {});
          }
        }
        return { ok: true, via: "CateringItems", items: cleanList };
      } catch {
        _cateringItemsSheetAvailable = false;
      }
    }

    await persistCateringItemsFallback(cleanList);
    return { ok: true, via: "Fallback", items: cleanList };
  },

  create: async (item) => {
    const nowIso = new Date().toISOString();
    const norm = normalizeCateringItemRecord({
      ...item,
      id:
        safeString(item?.id) ||
        `cat_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: item?.createdAt || nowIso,
      updatedAt: nowIso,
    });
    const current = readSheetCache("CateringItems", []) || [];
    const nextList = [
      ...current.filter((x) => String(x.id) !== String(norm.id)),
      norm,
    ];
    await cateringItemsAPI.saveAll(nextList);
    return norm;
  },

  update: async (id, patch) => {
    const current = readSheetCache("CateringItems", []) || [];
    const existing = current.find((x) => String(x.id) === String(id)) || {};
    const updated = normalizeCateringItemRecord({
      ...existing,
      ...patch,
      id: safeString(id),
      updatedAt: new Date().toISOString(),
    });
    const nextList = current.some((x) => String(x.id) === String(id))
      ? current.map((x) => (String(x.id) === String(id) ? updated : x))
      : [...current, updated];
    await cateringItemsAPI.saveAll(nextList);
    return updated;
  },

  remove: async (id) => {
    const current = readSheetCache("CateringItems", []) || [];
    const nextList = current.filter((x) => String(x.id) !== String(id));
    await cateringItemsAPI.saveAll(nextList);
    return { ok: true };
  },
};

export const cateringTemplatesAPI = {
  list: async () => {
    const list = await apiRead("CateringTemplates");
    const normalized = list.map((t) => ({
      ...t,
      id: safeString(t.id),
      items: normalizeMenuItems(t.items),
      mealType: safeString(t.mealType, "LUNCH"),
    }));
    return writeSheetCache("CateringTemplates", normalized);
  },
  create: async (t) => {
    const res = await apiCall("create", "CateringTemplates", {
      name: t.name || "",
      mealType: t.mealType || "LUNCH",
      items: JSON.stringify(t.items || []),
      notes: t.notes || "",
    });
    const created = {
      ...t,
      id: safeString(res?.id || t.id || `tpl_${Date.now()}`),
      items: normalizeMenuItems(t.items),
      mealType: safeString(t.mealType, "LUNCH"),
    };
    const cached = readSheetCache("CateringTemplates", []);
    writeSheetCache("CateringTemplates", [
      ...cached.filter((x) => String(x.id) !== String(created.id)),
      created,
    ]);
    return { ...(res || {}), id: created.id };
  },
  update: async (id, t) => {
    const res = await apiCall(
      "update",
      "CateringTemplates",
      {
        name: t.name || "",
        mealType: t.mealType || "LUNCH",
        items: JSON.stringify(t.items || []),
        notes: t.notes || "",
      },
      id
    );
    const cached = readSheetCache("CateringTemplates", []);
    const updated = {
      ...t,
      id: safeString(id),
      items: normalizeMenuItems(t.items),
      mealType: safeString(t.mealType, "LUNCH"),
    };
    writeSheetCache(
      "CateringTemplates",
      cached.some((x) => String(x.id) === String(id))
        ? cached.map((x) => (String(x.id) === String(id) ? updated : x))
        : [...cached, updated]
    );
    return res;
  },
  remove: async (id) => {
    const res = await apiCall("delete", "CateringTemplates", {}, id);
    const cached = readSheetCache("CateringTemplates", []);
    writeSheetCache(
      "CateringTemplates",
      cached.filter((x) => String(x.id) !== String(id))
    );
    return res;
  },
};

export const cateringOrdersAPI = {
  list: async () => {
    const list = await apiRead("CateringOrders");
    const normalized = list.map((o) => ({
      ...o,
      id: safeString(o.id),
      items: normalizeMenuItems(o.items),
      attachments: normalizeCamoAttachments(o.attachments),
      paxCount: safeNumber(o.paxCount, 0),
      crewCount: safeNumber(o.crewCount, 0),
      status: safeString(o.status, "PENDING"),
    }));
    return writeSheetCache("CateringOrders", normalized);
  },
  create: async (o) => {
    const res = await apiCall("create", "CateringOrders", {
      flightId: o.flightId || "",
      flightNo: o.flightNo || "",
      date: o.date || "",
      templateId: o.templateId || "",
      templateName: o.templateName || "",
      mealType: o.mealType || "LUNCH",
      paxCount: o.paxCount || 0,
      crewCount: o.crewCount || 0,
      items: JSON.stringify(o.items || []),
      specialMeals: o.specialMeals || "",
      status: o.status || "PENDING",
      notes: o.notes || "",
      attachments: serializeAttachments(o.attachments),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: o.updatedBy || "",
    });
    const created = {
      ...o,
      id: safeString(res?.id || o.id || `ord_${Date.now()}`),
      items: normalizeMenuItems(o.items),
      attachments: normalizeCamoAttachments(o.attachments),
      paxCount: safeNumber(o.paxCount, 0),
      crewCount: safeNumber(o.crewCount, 0),
      status: safeString(o.status, "PENDING"),
    };
    const cached = readSheetCache("CateringOrders", []);
    writeSheetCache("CateringOrders", [
      ...cached.filter((x) => String(x.id) !== String(created.id)),
      created,
    ]);
    return { ...(res || {}), id: created.id };
  },
  update: async (id, o) => {
    const res = await apiCall(
      "update",
      "CateringOrders",
      {
        flightId: o.flightId || "",
        flightNo: o.flightNo || "",
        date: o.date || "",
        templateId: o.templateId || "",
        templateName: o.templateName || "",
        mealType: o.mealType || "LUNCH",
        paxCount: o.paxCount || 0,
        crewCount: o.crewCount || 0,
        items: JSON.stringify(o.items || []),
        specialMeals: o.specialMeals || "",
        status: o.status || "PENDING",
        notes: o.notes || "",
        attachments: serializeAttachments(o.attachments),
        updatedAt: new Date().toISOString(),
        updatedBy: o.updatedBy || "",
      },
      id
    );
    const cached = readSheetCache("CateringOrders", []);
    const updated = {
      ...o,
      id: safeString(id),
      items: normalizeMenuItems(o.items),
      attachments: normalizeCamoAttachments(o.attachments),
      paxCount: safeNumber(o.paxCount, 0),
      crewCount: safeNumber(o.crewCount, 0),
      status: safeString(o.status, "PENDING"),
    };
    writeSheetCache(
      "CateringOrders",
      cached.some((x) => String(x.id) === String(id))
        ? cached.map((x) => (String(x.id) === String(id) ? updated : x))
        : [...cached, updated]
    );
    return res;
  },
  remove: async (id) => {
    const res = await apiCall("delete", "CateringOrders", {}, id);
    const cached = readSheetCache("CateringOrders", []);
    writeSheetCache(
      "CateringOrders",
      cached.filter((x) => String(x.id) !== String(id))
    );
    return res;
  },
};

/* ═══════════════════════════════════════════════════════════
 * FILES — Upload to Google Drive via Apps Script
 * ═══════════════════════════════════════════════════════════ */
export async function uploadFile(file, folder = "general") {
  if (!file) throw new Error("لم يتم اختيار ملف");
  if (file.size === 0) throw new Error("الملف فارغ");
  if (file.size > 25 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 25 MB");

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!result || typeof result !== "string")
        return reject(new Error("FileReader result invalid"));
      const parts = result.split(",");
      if (parts.length < 2 || !parts[1])
        return reject(new Error("Cannot extract base64"));
      resolve(parts[1]);
    };
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });

  const result = await postAppsScriptPayload({
    action: "upload",
    fileName: file.name || "file",
    mimeType: file.type || "application/octet-stream",
    base64,
    folder,
  });

  if (!result || !result.ok) {
    throw new Error(result?.error || "فشل رفع الملف إلى Google Drive");
  }

  const rawData = result.data || {};
  const fileId =
    rawData.fileId ||
    rawData.id ||
    extractDriveFileId(rawData.fileUrl || rawData.url || rawData.viewUrl || "");
  const fileUrl =
    rawData.fileUrl ||
    rawData.url ||
    (fileId ? `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}` : "");
  const viewUrl =
    rawData.viewUrl ||
    (fileId ? `https://drive.google.com/file/d/${fileId}/view` : fileUrl);

  return {
    ...rawData,
    fileId: fileId || "",
    fileName: rawData.fileName || rawData.name || file.name,
    fileUrl,
    viewUrl,
    imageUrl: fileId ? `/api/drive-file/${fileId}` : rawData.imageUrl || fileUrl,
    proxyUrl: fileId ? `/api/drive-file/${fileId}` : fileUrl,
    filePath: rawData.filePath || rawData.path || fileId || "",
    mimeType: rawData.mimeType || file.type || "application/octet-stream",
    size: rawData.size || file.size || 0,
  };
}

export async function deleteFile(filePath) {
  if (!filePath) return { ok: true };
  return apiCall("deleteFile", null, { filePath });
}

/* ═══════════════════════════════════════════════════════════
 * CENTRAL AVIATION DEPARTMENTS & DOCUMENTS DASHBOARD
 * Google Drive file storage + Google Sheets multi-tier persistence
 * ═══════════════════════════════════════════════════════════ */
export const DEFAULT_AVIATION_DEPARTMENTS = [
  {
    id: "flight_ops",
    nameAr: "عمليات الطيران (Flight Operations)",
    nameEn: "Flight Operations",
    icon: "Plane",
    color: "#0284c7",
    headName: "Captain Ahmed Mansoor (Chief Pilot)",
    headEmail: "ops@aeroops.aero",
    roles: ["CPT", "FO", "FE", "TRE", "TRI"],
    allowedUserRoles: ["superAdmin", "dispatcher", "captain"],
    description: "طياري الخطوط، طاقم قمرة القيادة، مدربي الطيران، ورخص الطيران ATPL/CPL والشهادات الطبية",
  },
  {
    id: "cabin_crew",
    nameAr: "الضيافة الجوية (In-Flight Services)",
    nameEn: "Cabin Crew & In-Flight Services",
    icon: "Users",
    color: "#ec4899",
    headName: "Sarah Al-Ghamdi (In-Flight Manager)",
    headEmail: "cabin@aeroops.aero",
    roles: ["CC", "SCC", "PURSER", "FA"],
    allowedUserRoles: ["superAdmin", "dispatcher", "cabinCrewManager"],
    description: "طواقم الضيافة الجوية، شهادات السلامة، التدريب الأمني، وشهادات اللياقة",
  },
  {
    id: "dispatch",
    nameAr: "الترحيل الجوي والعمليات الأرضية (Dispatch & Ground Ops)",
    nameEn: "Flight Dispatch & Ground Operations",
    icon: "Compass",
    color: "#f59e0b",
    headName: "Khaled Al-Otaibi (Operations Controller)",
    headEmail: "dispatch@aeroops.aero",
    roles: ["DISP", "OPS", "OCC"],
    allowedUserRoles: ["superAdmin", "dispatcher"],
    description: "مرحلي الطيران، مراقبو العمليات، وتصاريح الطيران والعبور والتصاريح الأمنية",
  },
  {
    id: "camo_eng",
    nameAr: "الصيانة وصلاحية الطيران (CAMO & Maintenance)",
    nameEn: "CAMO & Engineering",
    icon: "Wrench",
    color: "#8b5cf6",
    headName: "Eng. Tariq Al-Najjar (CAMO Postholder)",
    headEmail: "camo@aeroops.aero",
    roles: ["ENG", "CAMO", "TECH", "MECH"],
    allowedUserRoles: ["superAdmin", "camo", "dispatcher"],
    description: "مهندسي وفنيي الطيران، رخص صيانة الطائرات EASA/FAA/GACA، وشهادات الصلاحية",
  },
  {
    id: "safety_quality",
    nameAr: "الجودة والسلامة والامتثال (Safety & Compliance)",
    nameEn: "Safety, Security & Quality Compliance",
    icon: "ShieldCheck",
    color: "#10b981",
    headName: "Dr. Faisal Al-Harbi (Quality & Safety Director)",
    headEmail: "safety@aeroops.aero",
    roles: ["SAFETY", "QUALITY", "AUDITOR", "SMS"],
    allowedUserRoles: ["superAdmin", "dispatcher"],
    description: "سجلات التدقيق، تراخيص المشغل الجوي AOC، تصاريح سلطات الطيران المدني وإدارة السلامة SMS",
  },
  {
    id: "hr_admin",
    nameAr: "الموارد البشرية والإدارة (HR & Administration)",
    nameEn: "Human Resources & Administration",
    icon: "Building2",
    color: "#64748b",
    headName: "Mona Al-Saleh (HR Director)",
    headEmail: "hr@aeroops.aero",
    roles: ["HR", "ADMIN", "LEGAL", "FINANCE"],
    allowedUserRoles: ["superAdmin"],
    description: "عقود التوظيف، الإقامات، التأمينات الطبية، الجوازات، والبطاقات الأمنية للموظفين",
  },
  {
    id: "catering_logistics",
    nameAr: "التموين والإمداد اللوجستي (Catering & Logistics)",
    nameEn: "Catering & Logistics",
    icon: "UtensilsCrossed",
    color: "#06b6d4",
    headName: "Zaid Al-Dossari (Catering Supervisor)",
    headEmail: "catering@aeroops.aero",
    roles: ["CATERING", "LOGISTICS", "STORE"],
    allowedUserRoles: ["superAdmin", "dispatcher"],
    description: "شهادات صحة الغذاء، تصاريح الدخول لساحة المطار، والاتفاقيات مع مزودي التموين",
  },
];

const STORAGE_KEY_DOCUMENTS = "aeroops.documents_v1";
const STORAGE_KEY_DOC_DEPTS = "aeroops.doc_departments_v1";

export const documentDepartmentsAPI = {
  list: async () => {
    try {
      const sheetData = await apiRead("DocumentDepartments").catch(() => null);
      if (Array.isArray(sheetData) && sheetData.length > 0) {
        const normalized = sheetData.map((d) => ({
          ...d,
          id: safeString(d.id),
          nameAr: safeString(d.nameAr, d.name),
          nameEn: safeString(d.nameEn, d.name),
          icon: safeString(d.icon, "Building2"),
          color: safeString(d.color, "#0284c7"),
          headName: safeString(d.headName),
          headEmail: safeString(d.headEmail),
          roles: safeArray(d.roles),
          allowedUserRoles: safeArray(d.allowedUserRoles),
          description: safeString(d.description),
        }));
        writeSheetCache("DocumentDepartments", normalized);
        return normalized;
      }
    } catch {}

    const cached = readSheetCache("DocumentDepartments", null);
    if (Array.isArray(cached) && cached.length > 0) return cached;

    try {
      const saved = localStorage.getItem(STORAGE_KEY_DOC_DEPTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return DEFAULT_AVIATION_DEPARTMENTS;
  },

  saveAll: async (departments) => {
    const safe = Array.isArray(departments) ? departments : [];
    try {
      localStorage.setItem(STORAGE_KEY_DOC_DEPTS, JSON.stringify(safe));
    } catch {}
    writeSheetCache("DocumentDepartments", safe);
    try {
      await apiCall("saveAll", "DocumentDepartments", { data: safe });
    } catch {}
    return safe;
  },

  create: async (dept) => {
    const list = await documentDepartmentsAPI.list();
    const id = dept.id || `dept_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newDept = { ...dept, id };
    const nextList = [...list, newDept];
    await documentDepartmentsAPI.saveAll(nextList);
    return newDept;
  },

  update: async (id, patch) => {
    const list = await documentDepartmentsAPI.list();
    const nextList = list.map((d) =>
      String(d.id) === String(id) ? { ...d, ...patch } : d
    );
    await documentDepartmentsAPI.saveAll(nextList);
    return nextList.find((d) => String(d.id) === String(id));
  },

  remove: async (id) => {
    const list = await documentDepartmentsAPI.list();
    const nextList = list.filter((d) => String(d.id) !== String(id));
    await documentDepartmentsAPI.saveAll(nextList);
    return { ok: true };
  },
};

export const documentsAPI = {
  list: async () => {
    let rawDocs = null;
    try {
      rawDocs = await apiRead("Documents").catch(() => null);
    } catch {}

    if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
      const cached = readSheetCache("Documents", null);
      if (Array.isArray(cached) && cached.length > 0) {
        rawDocs = cached;
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY_DOCUMENTS);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) rawDocs = parsed;
          }
        } catch {}
      }
    }

    // Auto-seed: If documents list is empty, aggregate any existing crew licenses/medicals/passports
    if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
      const crewList = readSheetCache("Crew", []);
      const usersList = readSheetCache("Users", []);
      const seeded = [];

      crewList.forEach((c) => {
        const personId = String(c.id || "");
        const personName = String(c.fullName || "").trim();
        const personRole = String(c.role || "").toUpperCase();
        const personEmail = String(c.email || "").trim();
        const isPilot = ["CPT", "FO", "FE", "TRE", "TRI"].includes(personRole);
        const deptId = isPilot ? "flight_ops" : "cabin_crew";
        const deptName = isPilot ? "عمليات الطيران" : "الضيافة الجوية";

        if (c.licenseNo || c.licenseExpiry) {
          seeded.push({
            id: `doc_lic_${personId}`,
            title: isPilot ? "رخصة طيار نقل جوي (ATPL / CPL)" : "رخصة طيران / مرحل جوي",
            category: "license",
            categoryLabel: "رخص الطيران",
            docNo: c.licenseNo || "LIC-AERO",
            issuingAuthority: "الهيئة العامة للطيران المدني (GACA)",
            departmentId: deptId,
            departmentName: deptName,
            personId,
            personName,
            personRole,
            personEmail,
            issueDate: "",
            expiryDate: c.licenseExpiry || "",
            reminderDays: 30,
            fileId: "",
            fileUrl: "",
            viewUrl: "",
            proxyUrl: "",
            fileName: "License_Document.pdf",
            fileType: "application/pdf",
            status: "VALID",
            notes: "رخصة أساسية معتمدة من سلطات الطيران",
            renewalHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (c.medicalExpiry) {
          seeded.push({
            id: `doc_med_${personId}`,
            title: isPilot ? "شهادة لياقة طبية من الدرجة الأولى (Class 1 Medical)" : "شهادة فحص طبي (Aviation Medical)",
            category: "medical",
            categoryLabel: "شهادات طبية",
            docNo: `MED-${personId.slice(-4)}`,
            issuingAuthority: "Aviation Medical Center",
            departmentId: deptId,
            departmentName: deptName,
            personId,
            personName,
            personRole,
            personEmail,
            issueDate: "",
            expiryDate: c.medicalExpiry,
            reminderDays: 30,
            fileId: "",
            fileUrl: "",
            viewUrl: "",
            proxyUrl: "",
            fileName: "Medical_Certificate.pdf",
            fileType: "application/pdf",
            status: "VALID",
            notes: "الفحص الدوري لطاقم الطيران",
            renewalHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (c.passportNo || c.passportExpiry) {
          seeded.push({
            id: `doc_pass_${personId}`,
            title: "جواز السفر الرسمي (Passport)",
            category: "passport",
            categoryLabel: "جوازات سفر",
            docNo: c.passportNo || "PASS-OFFICIAL",
            issuingAuthority: c.nationality || "Ministry of Interior",
            departmentId: deptId,
            departmentName: deptName,
            personId,
            personName,
            personRole,
            personEmail,
            issueDate: "",
            expiryDate: c.passportExpiry || "",
            reminderDays: 60,
            fileId: "",
            fileUrl: "",
            viewUrl: "",
            proxyUrl: "",
            fileName: "Passport_Scan.jpg",
            fileType: "image/jpeg",
            status: "VALID",
            notes: "وثيقة السفر للرحلات الدولية",
            renewalHistory: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // Also incorporate any files from c.attachments
        if (Array.isArray(c.attachments) && c.attachments.length > 0) {
          c.attachments.forEach((att, ai) => {
            const fileUrl = att.url || att.fileUrl || "";
            const fileId = extractDriveFileId(fileUrl);
            seeded.push({
              id: `doc_att_${personId}_${ai}`,
              title: att.name || `مرفق معتمد ${ai + 1}`,
              category: "certificate",
              categoryLabel: "شهادات ومرفقات",
              docNo: `ATT-${ai + 1}`,
              issuingAuthority: "Operations Compliance",
              departmentId: deptId,
              departmentName: deptName,
              personId,
              personName,
              personRole,
              personEmail,
              issueDate: "",
              expiryDate: att.expiry || "",
              reminderDays: 30,
              fileId,
              fileUrl: fileUrl,
              viewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : fileUrl,
              proxyUrl: fileId ? `/api/drive-file/${fileId}` : fileUrl,
              fileName: att.name || "Attachment",
              fileType: att.type || (att.name?.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
              status: "VALID",
              notes: "مستند مستورد من ملف الطاقم",
              renewalHistory: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
        }
      });

      rawDocs = seeded;
    }

    const normalized = (rawDocs || []).map((doc) => {
      const fileId = doc.fileId || extractDriveFileId(doc.fileUrl || doc.url || doc.viewUrl || "");
      const fileUrl = doc.fileUrl || doc.url || (fileId ? `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}` : "");
      const viewUrl = doc.viewUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : fileUrl);
      const proxyUrl = fileId ? `/api/drive-file/${fileId}` : fileUrl;

      return {
        ...doc,
        id: safeString(doc.id),
        title: safeString(doc.title, "Untitled Document"),
        category: safeString(doc.category, "license"),
        categoryLabel: safeString(doc.categoryLabel),
        docNo: safeString(doc.docNo),
        issuingAuthority: safeString(doc.issuingAuthority),
        departmentId: safeString(doc.departmentId, "flight_ops"),
        departmentName: safeString(doc.departmentName, "عمليات الطيران"),
        personId: safeString(doc.personId),
        personName: safeString(doc.personName),
        personRole: safeString(doc.personRole),
        personEmail: safeString(doc.personEmail),
        issueDate: safeString(doc.issueDate),
        expiryDate: safeString(doc.expiryDate),
        reminderDays: safeNumber(doc.reminderDays, 30),
        fileId,
        fileUrl,
        viewUrl,
        proxyUrl,
        fileName: safeString(doc.fileName, "file"),
        fileType: safeString(doc.fileType, "application/pdf"),
        fileSize: safeString(doc.fileSize),
        status: safeString(doc.status, "VALID"),
        notes: safeString(doc.notes),
        renewalHistory: safeArray(doc.renewalHistory),
        createdAt: safeString(doc.createdAt, new Date().toISOString()),
        updatedAt: safeString(doc.updatedAt, new Date().toISOString()),
        updatedBy: safeString(doc.updatedBy),
      };
    });

    writeSheetCache("Documents", normalized);
    try {
      localStorage.setItem(STORAGE_KEY_DOCUMENTS, JSON.stringify(normalized));
    } catch {}
    return normalized;
  },

  saveAll: async (docs) => {
    const safe = Array.isArray(docs) ? docs : [];
    writeSheetCache("Documents", safe);
    try {
      localStorage.setItem(STORAGE_KEY_DOCUMENTS, JSON.stringify(safe));
    } catch {}
    try {
      await apiCall("saveAll", "Documents", { data: safe });
    } catch {}
    return safe;
  },

  create: async (doc) => {
    const list = await documentsAPI.list();
    const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newDoc = {
      ...doc,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const nextList = [newDoc, ...list];
    await documentsAPI.saveAll(nextList);
    try {
      await apiCall("create", "Documents", newDoc);
    } catch {}
    return newDoc;
  },

  update: async (id, patch) => {
    const list = await documentsAPI.list();
    const nextList = list.map((d) =>
      String(d.id) === String(id)
        ? { ...d, ...patch, updatedAt: new Date().toISOString() }
        : d
    );
    await documentsAPI.saveAll(nextList);
    try {
      await apiCall("update", "Documents", patch, id);
    } catch {}
    return nextList.find((d) => String(d.id) === String(id));
  },

  renew: async (id, { newIssueDate, newExpiryDate, renewalNotes, updatedBy, fileMeta }) => {
    const list = await documentsAPI.list();
    const target = list.find((d) => String(d.id) === String(id));
    if (!target) throw new Error("المستند غير موجود");

    const renewalEntry = {
      date: new Date().toISOString(),
      previousExpiry: target.expiryDate,
      newExpiry: newExpiryDate,
      previousIssueDate: target.issueDate,
      newIssueDate: newIssueDate || target.issueDate,
      notes: renewalNotes || "تجديد دوري معتمد",
      updatedBy: updatedBy || "Operations",
    };

    const patch = {
      issueDate: newIssueDate || target.issueDate,
      expiryDate: newExpiryDate,
      status: "VALID",
      notes: renewalNotes ? `${target.notes ? `${target.notes} | ` : ""}${renewalNotes}` : target.notes,
      renewalHistory: [...(target.renewalHistory || []), renewalEntry],
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || "Operations",
      ...(fileMeta || {}),
    };

    return documentsAPI.update(id, patch);
  },

  remove: async (id) => {
    const list = await documentsAPI.list();
    const nextList = list.filter((d) => String(d.id) !== String(id));
    await documentsAPI.saveAll(nextList);
    try {
      await apiCall("delete", "Documents", {}, id);
    } catch {}
    return { ok: true };
  },
};

/* ═══════════════════════════════════════════════════════════
 * OPERATIONAL FORMS (النماذج التشغيلية المعتمدة)
 * ═══════════════════════════════════════════════════════════ */
export const operationalFormsAPI = {
  list: async () => {
    const list = await apiRead("OperationalForms");
    return list.map((f) => ({
      ...f,
      fields: safeArray(f.fields),
      attachments: normalizeCamoAttachments(f.attachments),
      showInContextMenu: f.showInContextMenu !== false && f.showInContextMenu !== "false",
    }));
  },
  create: (f) =>
    apiCall("create", "OperationalForms", {
      name: f.name || "",
      category: f.category || "Operations",
      format: f.format || "html",
      htmlContent: f.htmlContent && f.htmlContent.length > 45000 ? f.htmlContent.slice(0, 45000) : (f.htmlContent || ""),
      fields: typeof f.fields === "string" ? f.fields : JSON.stringify(f.fields || []),
      attachments: JSON.stringify(sanitizeAttachmentsForSheets(f.attachments)),
      showInContextMenu: f.showInContextMenu !== false,
      notes: f.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  update: (id, f) =>
    apiCall(
      "update",
      "OperationalForms",
      {
        name: f.name || "",
        category: f.category || "Operations",
        format: f.format || "html",
        htmlContent: f.htmlContent && f.htmlContent.length > 45000 ? f.htmlContent.slice(0, 45000) : (f.htmlContent || ""),
        fields: typeof f.fields === "string" ? f.fields : JSON.stringify(f.fields || []),
        attachments: JSON.stringify(sanitizeAttachmentsForSheets(f.attachments)),
        showInContextMenu: f.showInContextMenu !== false,
        notes: f.notes || "",
        updatedAt: new Date().toISOString(),
      },
      id
    ),
  remove: (id) => apiCall("delete", "OperationalForms", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * EMAIL
 * ═══════════════════════════════════════════════════════════ */
export async function sendEmail({
  to,
  subject,
  body,
  html,
  accountId,
  account,
  attachments,
}) {
  try {
    return await sendThroughEmailAccount({
      to,
      subject,
      body,
      html,
      accountId,
      account,
      attachments,
    });
  } catch (err) {
    // Fallback to Google Apps Script only if no explicit SMTP account was forced and backend route was unreachable
    const chosen = account || listEmailAccounts().find((a) => a.id === accountId || a.isDefault);
    if (chosen?.mode === "smtp") {
      throw err;
    }
    const data = await apiCall("sendEmail", null, { to, subject, body: body || "" });
    return data ?? { ok: true };
  }
}

export async function sendFlightEmail(flight, crewList = [], accountId = "") {
  const accounts = listEmailAccounts();
  const hasSenderAccount = Boolean(accountId) || accounts.length > 0;

  if (hasSenderAccount && Array.isArray(crewList) && crewList.length > 0) {
    const slots = safeArray(flight?.crewSlots);
    const recipients = [];
    const seen = new Set();

    slots.forEach((s) => {
      const member = crewList.find((c) => String(c.id) === String(s.crewId));
      if (member?.email && !seen.has(member.email)) {
        seen.add(member.email);
        recipients.push({ member, position: s.position });
      }
    });

    if (recipients.length === 0) {
      throw new Error("لا يوجد بريد إلكتروني مسجل لأفراد الطاقم المعينين على هذه الرحلة");
    }

    const flightDate = flight?.std ? String(flight.std).slice(0, 10) : "—";
    const stdUtc = flight?.std ? String(flight.std).slice(11, 16) + " UTC" : "—";
    const staUtc = flight?.sta ? String(flight.sta).slice(11, 16) + " UTC" : "—";
    const legsList = safeArray(flight?.legs);
    const routeChain = [
      `${flight?.dep || "—"} → ${flight?.arr || "—"} (${stdUtc} - ${staUtc})`,
      ...legsList.map(
        (l, idx) =>
          `Sector ${idx + 2}: ${l?.dep || "—"} → ${l?.arr || "—"} (${
            l?.std ? String(l.std).slice(11, 16) + "Z" : "—"
          } - ${l?.sta ? String(l.sta).slice(11, 16) + "Z" : "—"})`
      ),
    ].join("\n");

    let sent = 0;
    for (const r of recipients) {
      const subject = `Flight Assignment: ${flight?.flightNo || ""} (${flightDate}) — ${flight?.dep || ""} → ${flight?.arr || ""}`;
      const body = [
        `Dear ${r.member.fullName},`,
        ``,
        `You are assigned as ${String(r.position || "Crew").toUpperCase()} on flight ${flight?.flightNo || "—"}.`,
        ``,
        `Date: ${flightDate}`,
        `Aircraft: ${flight?.acft || "TBA"}`,
        `Sectors:`,
        routeChain,
        flight?.notes ? `\nNotes: ${flight.notes}` : "",
        ``,
        `Please report 60 minutes prior to STD.`,
        `Flight Operations`,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await sendThroughEmailAccount({
          to: r.member.email,
          subject,
          body,
          accountId,
        });
        sent++;
      } catch (e) {
        console.warn("Failed sending flight email to", r.member.email, e);
      }
    }

    return { ok: sent > 0, sent, total: recipients.length };
  }

  return apiCall("sendFlightEmail", null, { flight });
}

export async function checkExpiryAlerts() {
  return apiCall("checkExpiry", null, {});
}

/* ═══════════════════════════════════════════════════════════
 * DASHBOARD LAYOUTS — Google Sheets Cross-Device Sync
 * Syncs per-user widget order & sizes to "DashboardLayouts"
 * sheet with automatic fallback to Settings.tabPreferences
 * ═══════════════════════════════════════════════════════════ */
let _dashboardLayoutsSheetAvailable = null; // null = unknown, true = sheet ok, false = use Settings fallback

export const dashboardLayoutsAPI = {
  getForUser: async (userKey) => {
    if (!userKey) return null;
    const normalizedKey = String(userKey).trim().toLowerCase();

    if (_dashboardLayoutsSheetAvailable !== false) {
      try {
        const list = await apiRead("DashboardLayouts");
        _dashboardLayoutsSheetAvailable = true;
        const match = (list || []).find(
          (row) =>
            String(row.userKey || row.userId || row.username || "")
              .trim()
              .toLowerCase() === normalizedKey
        );
        if (match) {
          const parsed = safeObject(match.layoutJson) || safeObject(match.layout);
          if (parsed && Array.isArray(parsed.widgets)) {
            return {
              ...parsed,
              rowId: match.id,
              updatedAt: safeString(match.updatedAt || parsed.updatedAt),
            };
          }
        }
      } catch {
        _dashboardLayoutsSheetAvailable = false;
      }
    }

    // Fallback: read from Settings.tabPreferences.__dashboardLayouts
    try {
      const s = await settingsAPI.get();
      const map = s?.tabPreferences?.__dashboardLayouts;
      if (map && typeof map === "object") {
        const found = map[normalizedKey] || map[userKey];
        if (found && Array.isArray(found.widgets)) {
          return found;
        }
      }
    } catch {}

    return null;
  },

  saveForUser: async (userKey, userMeta = {}, layoutPayload = {}) => {
    if (!userKey) return { ok: false };
    const normalizedKey = String(userKey).trim().toLowerCase();
    const updatedAt = layoutPayload.updatedAt || new Date().toISOString();
    const cleanPayload = {
      widgets: Array.isArray(layoutPayload.widgets) ? layoutPayload.widgets : [],
      presetId: layoutPayload.presetId || "custom",
      updatedAt,
    };

    if (_dashboardLayoutsSheetAvailable !== false) {
      try {
        const list = await apiRead("DashboardLayouts");
        _dashboardLayoutsSheetAvailable = true;
        const existing = (list || []).find(
          (row) =>
            String(row.userKey || row.userId || row.username || "")
              .trim()
              .toLowerCase() === normalizedKey
        );
        const sheetRow = {
          userKey: normalizedKey,
          userId: String(userMeta.id || ""),
          username: String(userMeta.username || ""),
          fullName: String(userMeta.fullName || ""),
          role: String(userMeta.role || ""),
          layoutJson: JSON.stringify(cleanPayload),
          updatedAt,
        };
        if (existing && existing.id) {
          await apiCall("update", "DashboardLayouts", sheetRow, existing.id);
        } else {
          await apiCall("create", "DashboardLayouts", sheetRow);
        }
        return { ok: true, via: "DashboardLayouts", updatedAt };
      } catch {
        _dashboardLayoutsSheetAvailable = false;
      }
    }

    // Fallback: persist inside Settings.tabPreferences.__dashboardLayouts
    const currentSettings = (await settingsAPI.get().catch(() => null)) || {};
    const prevTabPrefs =
      currentSettings.tabPreferences &&
      typeof currentSettings.tabPreferences === "object"
        ? currentSettings.tabPreferences
        : {};
    const prevLayouts =
      prevTabPrefs.__dashboardLayouts &&
      typeof prevTabPrefs.__dashboardLayouts === "object"
        ? prevTabPrefs.__dashboardLayouts
        : {};

    await settingsAPI.save({
      tabPreferences: {
        ...prevTabPrefs,
        __dashboardLayouts: {
          ...prevLayouts,
          [normalizedKey]: cleanPayload,
        },
      },
    });
    return { ok: true, via: "Settings", updatedAt };
  },
};

/* ═══════════════════════════════════════════════════════════
 * NOTIFICATIONS — Google Sheets Cross-Device Crew & Ops Sync
 * Persists notifications in "Notifications" sheet so Crew Portal
 * and Operations receive instant updates without Firebase OAuth
 * ═══════════════════════════════════════════════════════════ */
export const notificationsAPI = {
  list: async () => {
    const list = await apiRead("Notifications");
    const normalized = (list || []).map((n) => ({
      id: safeString(n.id),
      crewId: safeString(n.crewId),
      recipientEmail: safeString(n.recipientEmail).trim().toLowerCase(),
      recipientUsername: safeString(n.recipientUsername).trim().toLowerCase(),
      crewName: safeString(n.crewName),
      flightId: safeString(n.flightId),
      flightNo: safeString(n.flightNo),
      dep: safeString(n.dep),
      arr: safeString(n.arr),
      std: safeString(n.std),
      sta: safeString(n.sta),
      acft: safeString(n.acft),
      position: safeString(n.position),
      type: safeString(n.type, "GENERAL"),
      message: safeString(n.message),
      read: safeBool(n.read),
      createdAtIso: safeString(n.createdAtIso || n.createdAt),
      updatedAtIso: safeString(n.updatedAtIso || n.updatedAt),
    }));
    return writeSheetCache("Notifications", normalized);
  },
  create: async (n) => {
    const nowIso = n.createdAtIso || new Date().toISOString();
    const payload = {
      crewId: safeString(n.crewId),
      recipientEmail: safeString(n.recipientEmail).trim().toLowerCase(),
      recipientUsername: safeString(n.recipientUsername).trim().toLowerCase(),
      crewName: safeString(n.crewName),
      flightId: safeString(n.flightId),
      flightNo: safeString(n.flightNo),
      dep: safeString(n.dep),
      arr: safeString(n.arr),
      std: safeString(n.std),
      sta: safeString(n.sta),
      acft: safeString(n.acft),
      position: safeString(n.position),
      type: safeString(n.type, "GENERAL"),
      message: safeString(n.message),
      read: Boolean(n.read),
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    const res = await apiCall("create", "Notifications", payload);
    const created = { ...payload, id: safeString(res?.id || `nt_${Date.now()}`) };
    const cached = readSheetCache("Notifications", []);
    writeSheetCache("Notifications", [
      created,
      ...cached.filter((x) => String(x.id) !== String(created.id)),
    ].slice(0, 300));
    return created;
  },
  update: async (id, patch) => {
    const cached = readSheetCache("Notifications", []);
    const existing = cached.find((x) => String(x.id) === String(id)) || {};
    const merged = {
      ...existing,
      ...patch,
      updatedAtIso: new Date().toISOString(),
    };
    const res = await apiCall("update", "Notifications", merged, id);
    writeSheetCache(
      "Notifications",
      cached.map((x) => (String(x.id) === String(id) ? { ...merged, id: safeString(id) } : x))
    );
    return res;
  },
  remove: async (id) => {
    const res = await apiCall("delete", "Notifications", {}, id);
    const cached = readSheetCache("Notifications", []);
    writeSheetCache(
      "Notifications",
      cached.filter((x) => String(x.id) !== String(id))
    );
    return res;
  },
};

/* ═══════════════════════════════════════════════════════════
 * CATERING DRY STORE — Google Sheets Persistence
 * Syncs DryStoreItems & DryStoreLedger across all devices
 * ═══════════════════════════════════════════════════════════ */
export const dryStoreItemsAPI = {
  list: async () => {
    const list = await apiRead("DryStoreItems");
    const normalized = (list || []).map((i) => ({
      id: safeString(i.id),
      itemCode: safeString(i.itemCode || i.id),
      nameAr: safeString(i.nameAr),
      nameEn: safeString(i.nameEn),
      category: safeString(i.category),
      unit: safeString(i.unit, "قطعة / Piece"),
      currentStock: safeNumber(i.currentStock, 0),
      minThreshold: safeNumber(i.minThreshold, 10),
      binLocation: safeString(i.binLocation),
      notes: safeString(i.notes),
      updatedAt: safeString(i.updatedAt),
    }));
    return writeSheetCache("DryStoreItems", normalized);
  },
  create: (item) =>
    apiCall("create", "DryStoreItems", {
      itemCode: safeString(item.itemCode || item.id),
      nameAr: safeString(item.nameAr),
      nameEn: safeString(item.nameEn),
      category: safeString(item.category),
      unit: safeString(item.unit, "قطعة / Piece"),
      currentStock: safeNumber(item.currentStock, 0),
      minThreshold: safeNumber(item.minThreshold, 10),
      binLocation: safeString(item.binLocation),
      notes: safeString(item.notes),
      updatedAt: new Date().toISOString(),
    }),
  update: (id, item) =>
    apiCall(
      "update",
      "DryStoreItems",
      {
        itemCode: safeString(item.itemCode || item.id),
        nameAr: safeString(item.nameAr),
        nameEn: safeString(item.nameEn),
        category: safeString(item.category),
        unit: safeString(item.unit, "قطعة / Piece"),
        currentStock: safeNumber(item.currentStock, 0),
        minThreshold: safeNumber(item.minThreshold, 10),
        binLocation: safeString(item.binLocation),
        notes: safeString(item.notes),
        updatedAt: new Date().toISOString(),
      },
      id
    ),
  remove: (id) => apiCall("delete", "DryStoreItems", {}, id),
};

export const dryStoreLedgerAPI = {
  list: async () => {
    const list = await apiRead("DryStoreLedger");
    const normalized = (list || []).map((entry) => ({
      id: safeString(entry.id),
      type: safeString(entry.type, "IN"),
      itemId: safeString(entry.itemId),
      itemName: safeString(entry.itemName),
      qty: safeNumber(entry.qty, 0),
      ref: safeString(entry.ref),
      flightNo: safeString(entry.flightNo),
      recipient: safeString(entry.recipient),
      date: safeString(entry.date),
      operator: safeString(entry.operator),
      notes: safeString(entry.notes),
    }));
    return writeSheetCache("DryStoreLedger", normalized);
  },
  create: (entry) =>
    apiCall("create", "DryStoreLedger", {
      type: safeString(entry.type, "IN"),
      itemId: safeString(entry.itemId),
      itemName: safeString(entry.itemName),
      qty: safeNumber(entry.qty, 0),
      ref: safeString(entry.ref),
      flightNo: safeString(entry.flightNo),
      recipient: safeString(entry.recipient),
      date: safeString(entry.date || new Date().toISOString()),
      operator: safeString(entry.operator),
      notes: safeString(entry.notes),
    }),
  remove: (id) => apiCall("delete", "DryStoreLedger", {}, id),
};

/* ═══════════════════════════════════════════════════════════
 * APP CONFIG — Google Sheets Key-Value Store ("AppConfig")
 * Syncs WhatsApp, Notification Config, & Email Accounts
 * ═══════════════════════════════════════════════════════════ */
export const appConfigAPI = {
  listAll: async () => {
    const rows = await apiRead("AppConfig");
    const normalized = (rows || []).map((r) => ({
      id: safeString(r.id),
      configKey: safeString(r.configKey),
      valueJson: safeString(r.valueJson),
      updatedAt: safeString(r.updatedAt),
    }));
    return writeSheetCache("AppConfig", normalized);
  },
  get: async (configKey) => {
    const rows = await appConfigAPI.listAll();
    const found = rows.find(
      (r) => String(r.configKey).trim() === String(configKey).trim()
    );
    if (!found || !found.valueJson) return null;
    try {
      return JSON.parse(found.valueJson);
    } catch {
      return null;
    }
  },
  set: async (configKey, value) => {
    const key = String(configKey).trim();
    const rows = await apiRead("AppConfig").catch(() => []);
    const existing = (rows || []).find(
      (r) => String(r.configKey || "").trim() === key
    );
    const payload = {
      configKey: key,
      valueJson: JSON.stringify(value ?? null),
      updatedAt: new Date().toISOString(),
    };
    if (existing && existing.id) {
      return apiCall("update", "AppConfig", payload, existing.id);
    }
    return apiCall("create", "AppConfig", payload);
  },
};

/* ═══════════════════════════════════════════════════════════
 * NAMED DASHBOARDS — Multi-Dashboard Storage, Naming & RBAC
 * Syncs multiple named dashboards + per-dashboard role/user
 * permissions to Google Sheets ("NamedDashboards" -> AppConfig
 * -> Settings fallback) + instant localStorage cache.
 * ═══════════════════════════════════════════════════════════ */
let _namedDashboardsSheetAvailable = null;

function normalizeNamedDashboardRecord(d = {}) {
  const widgetsRaw = d.widgetsJson || d.widgets;
  const viewRolesRaw = d.viewRolesJson || d.viewRoles;
  const editRolesRaw = d.editRolesJson || d.editRoles;
  const viewUsersRaw = d.viewUsersJson || d.viewUsers;
  const editUsersRaw = d.editUsersJson || d.editUsers;

  return {
    id: safeString(d.id || d.dashboardId),
    name: safeString(d.name || d.nameAr),
    nameAr: safeString(d.nameAr || d.name),
    description: safeString(d.description),
    scope: ["main", "quality", "camo", "training", "both"].includes(
      safeString(d.scope)
    )
      ? safeString(d.scope)
      : "quality",
    widgets: safeArray(widgetsRaw),
    visibility: safeString(d.visibility, "restricted") === "all" ? "all" : "restricted",
    viewRoles: safeArray(viewRolesRaw).map((x) => safeString(x)).filter(Boolean),
    editRoles: safeArray(editRolesRaw).map((x) => safeString(x)).filter(Boolean),
    viewUsers: safeArray(viewUsersRaw).map((x) => safeString(x)).filter(Boolean),
    editUsers: safeArray(editUsersRaw).map((x) => safeString(x)).filter(Boolean),
    isDefault: safeBool(d.isDefault),
    createdBy: safeString(d.createdBy),
    createdAt: safeString(d.createdAt),
    updatedAt: safeString(d.updatedAt),
  };
}

function serializeNamedDashboardForSheet(d) {
  const norm = normalizeNamedDashboardRecord(d);
  return {
    dashboardId: norm.id,
    name: norm.name,
    nameAr: norm.nameAr,
    description: norm.description,
    scope: norm.scope,
    widgetsJson: JSON.stringify(norm.widgets),
    visibility: norm.visibility,
    viewRolesJson: JSON.stringify(norm.viewRoles),
    editRolesJson: JSON.stringify(norm.editRoles),
    viewUsersJson: JSON.stringify(norm.viewUsers),
    editUsersJson: JSON.stringify(norm.editUsers),
    isDefault: Boolean(norm.isDefault),
    createdBy: norm.createdBy,
    createdAt: norm.createdAt || new Date().toISOString(),
    updatedAt: norm.updatedAt || new Date().toISOString(),
  };
}

async function persistNamedDashboardsFallback(cleanList) {
  try {
    await appConfigAPI.set("named_dashboards_v1", cleanList);
    return { ok: true, via: "AppConfig" };
  } catch {}

  const currentSettings = (await settingsAPI.get().catch(() => null)) || {};
  const prevTabPrefs =
    currentSettings.tabPreferences &&
    typeof currentSettings.tabPreferences === "object"
      ? currentSettings.tabPreferences
      : {};
  await settingsAPI.save({
    tabPreferences: {
      ...prevTabPrefs,
      __namedDashboards: cleanList,
    },
  });
  return { ok: true, via: "Settings" };
}

export const namedDashboardsAPI = {
  list: async () => {
    if (_namedDashboardsSheetAvailable !== false) {
      try {
        const rows = await apiRead("NamedDashboards");
        _namedDashboardsSheetAvailable = true;
        const normalized = (rows || [])
          .map((r) =>
            normalizeNamedDashboardRecord({
              ...r,
              id: safeString(r.dashboardId || r.id),
              _sheetRowId: safeString(r.id),
            })
          )
          .filter((x) => x.id);
        if (normalized.length > 0) {
          return writeSheetCache("NamedDashboards", normalized);
        }
      } catch {
        _namedDashboardsSheetAvailable = false;
      }
    }

    try {
      const cfgList = await appConfigAPI.get("named_dashboards_v1");
      if (Array.isArray(cfgList) && cfgList.length > 0) {
        const normalized = cfgList
          .map((d) => normalizeNamedDashboardRecord(d))
          .filter((x) => x.id);
        return writeSheetCache("NamedDashboards", normalized);
      }
    } catch {}

    try {
      const s = await settingsAPI.get();
      const sList = s?.tabPreferences?.__namedDashboards;
      if (Array.isArray(sList) && sList.length > 0) {
        const normalized = sList
          .map((d) => normalizeNamedDashboardRecord(d))
          .filter((x) => x.id);
        return writeSheetCache("NamedDashboards", normalized);
      }
    } catch {}

    return readSheetCache("NamedDashboards", []);
  },

  saveAll: async (dashboardsList = []) => {
    const cleanList = (Array.isArray(dashboardsList) ? dashboardsList : [])
      .map((d) => normalizeNamedDashboardRecord(d))
      .filter((x) => x.id);

    writeSheetCache("NamedDashboards", cleanList);

    if (_namedDashboardsSheetAvailable !== false) {
      try {
        const existingRows = await apiRead("NamedDashboards");
        _namedDashboardsSheetAvailable = true;
        const rowByDashId = new Map();
        (existingRows || []).forEach((r) => {
          const key = safeString(r.dashboardId || r.id);
          if (key) rowByDashId.set(key, r);
        });

        const nextIds = new Set(cleanList.map((d) => d.id));
        for (const d of cleanList) {
          const rowPayload = serializeNamedDashboardForSheet(d);
          const match = rowByDashId.get(d.id);
          if (match && match.id) {
            await apiCall("update", "NamedDashboards", rowPayload, match.id);
          } else {
            await apiCall("create", "NamedDashboards", rowPayload);
          }
        }
        for (const [dashId, row] of rowByDashId.entries()) {
          if (!nextIds.has(dashId) && row?.id) {
            await apiCall("delete", "NamedDashboards", {}, row.id).catch(() => {});
          }
        }
        return { ok: true, via: "NamedDashboards", items: cleanList };
      } catch {
        _namedDashboardsSheetAvailable = false;
      }
    }

    await persistNamedDashboardsFallback(cleanList);
    return { ok: true, via: "Fallback", items: cleanList };
  },
};

/* ═══════════════════════════════════════════════════════════
 * QUALITY AUDITS & CAPA — Google Sheets Persistence
 * Stores Quality Assurance audits, findings, & corrective actions
 * ═══════════════════════════════════════════════════════════ */
let _qualityAuditsSheetAvailable = null;

function normalizeQualityAudit(a = {}) {
  return {
    id: safeString(a.id),
    refNo: safeString(a.refNo),
    title: safeString(a.title),
    department: safeString(a.department, "Flight Operations"),
    auditType: safeString(a.auditType, "Internal Audit"),
    severity: safeString(a.severity, "LEVEL_2"),
    status: safeString(a.status, "OPEN"),
    auditor: safeString(a.auditor),
    assignee: safeString(a.assignee),
    targetDate: safeString(a.targetDate),
    closedDate: safeString(a.closedDate),
    aircraftReg: safeString(a.aircraftReg),
    flightNo: safeString(a.flightNo),
    rootCause: safeString(a.rootCause),
    correctiveAction: safeString(a.correctiveAction),
    notes: safeString(a.notes),
    createdAt: safeString(a.createdAt || new Date().toISOString()),
    updatedAt: safeString(a.updatedAt || new Date().toISOString()),
  };
}

export const qualityAuditsAPI = {
  list: async () => {
    if (_qualityAuditsSheetAvailable !== false) {
      try {
        const rows = await apiRead("QualityAudits");
        _qualityAuditsSheetAvailable = true;
        const normalized = (rows || [])
          .map((r) => normalizeQualityAudit(r))
          .filter((x) => x.id);
        return writeSheetCache("QualityAudits", normalized);
      } catch {
        _qualityAuditsSheetAvailable = false;
      }
    }

    try {
      const cfg = await appConfigAPI.get("quality_audits_v1");
      if (Array.isArray(cfg)) {
        const normalized = cfg
          .map((r) => normalizeQualityAudit(r))
          .filter((x) => x.id);
        return writeSheetCache("QualityAudits", normalized);
      }
    } catch {}

    return readSheetCache("QualityAudits", []);
  },

  saveAll: async (auditsList = []) => {
    const clean = (Array.isArray(auditsList) ? auditsList : [])
      .map((a) => normalizeQualityAudit(a))
      .filter((x) => x.id);
    writeSheetCache("QualityAudits", clean);

    if (_qualityAuditsSheetAvailable !== false) {
      try {
        const existingRows = await apiRead("QualityAudits");
        _qualityAuditsSheetAvailable = true;
        const existingMap = new Map(
          (existingRows || []).map((r) => [safeString(r.id), r])
        );
        const nextIds = new Set(clean.map((x) => x.id));

        for (const item of clean) {
          const match = existingMap.get(item.id);
          if (match && match.id) {
            await apiCall("update", "QualityAudits", item, match.id);
          } else {
            await apiCall("create", "QualityAudits", item);
          }
        }
        for (const [rowId] of existingMap.entries()) {
          if (!nextIds.has(rowId) && rowId) {
            await apiCall("delete", "QualityAudits", {}, rowId).catch(() => {});
          }
        }
        return { ok: true, via: "QualityAudits", items: clean };
      } catch {
        _qualityAuditsSheetAvailable = false;
      }
    }

    await appConfigAPI.set("quality_audits_v1", clean);
    return { ok: true, via: "AppConfig", items: clean };
  },
};

/* ═══════════════════════════════════════════════════════════
 * ROSTER GROUPS — Multi-Group Roster & Access Control
 * Syncs crew roster groups (Flight Crew, Cabin Crew, Dispatch,
 * Engineering, + custom groups) & per-group permissions to
 * Google Sheets ("RosterGroups" -> AppConfig -> Settings) + cache.
 * ═══════════════════════════════════════════════════════════ */
let _rosterGroupsSheetAvailable = null;

function normalizeRosterGroupRecord(g = {}) {
  const positionsRaw = g.positionsJson || g.positions;
  const crewIdsRaw = g.crewIdsJson || g.crewIds;
  const viewRolesRaw = g.viewRolesJson || g.viewRoles;
  const editRolesRaw = g.editRolesJson || g.editRoles;
  const viewUsersRaw = g.viewUsersJson || g.viewUsers;
  const editUsersRaw = g.editUsersJson || g.editUsers;

  return {
    id: safeString(g.id || g.groupId),
    name: safeString(g.name || g.nameAr),
    nameAr: safeString(g.nameAr || g.name),
    description: safeString(g.description),
    color: safeString(g.color, "sky"),
    positions: safeArray(positionsRaw).map((x) => safeString(x)).filter(Boolean),
    crewIds: safeArray(crewIdsRaw).map((x) => safeString(x)).filter(Boolean),
    visibility:
      safeString(g.visibility, "restricted") === "all" ? "all" : "restricted",
    viewRoles: safeArray(viewRolesRaw).map((x) => safeString(x)).filter(Boolean),
    editRoles: safeArray(editRolesRaw).map((x) => safeString(x)).filter(Boolean),
    viewUsers: safeArray(viewUsersRaw).map((x) => safeString(x)).filter(Boolean),
    editUsers: safeArray(editUsersRaw).map((x) => safeString(x)).filter(Boolean),
    isSystem: safeBool(g.isSystem),
    createdBy: safeString(g.createdBy),
    createdAt: safeString(g.createdAt),
    updatedAt: safeString(g.updatedAt),
  };
}

function serializeRosterGroupForSheet(g) {
  const norm = normalizeRosterGroupRecord(g);
  return {
    groupId: norm.id,
    name: norm.name,
    nameAr: norm.nameAr,
    description: norm.description,
    color: norm.color,
    positionsJson: JSON.stringify(norm.positions),
    crewIdsJson: JSON.stringify(norm.crewIds),
    visibility: norm.visibility,
    viewRolesJson: JSON.stringify(norm.viewRoles),
    editRolesJson: JSON.stringify(norm.editRoles),
    viewUsersJson: JSON.stringify(norm.viewUsers),
    editUsersJson: JSON.stringify(norm.editUsers),
    isSystem: Boolean(norm.isSystem),
    createdBy: norm.createdBy,
    createdAt: norm.createdAt || new Date().toISOString(),
    updatedAt: norm.updatedAt || new Date().toISOString(),
  };
}

async function persistRosterGroupsFallback(cleanList) {
  try {
    await appConfigAPI.set("roster_groups_v1", cleanList);
    return { ok: true, via: "AppConfig" };
  } catch {}

  const currentSettings = (await settingsAPI.get().catch(() => null)) || {};
  const prevTabPrefs =
    currentSettings.tabPreferences &&
    typeof currentSettings.tabPreferences === "object"
      ? currentSettings.tabPreferences
      : {};
  await settingsAPI.save({
    tabPreferences: {
      ...prevTabPrefs,
      __rosterGroups: cleanList,
    },
  });
  return { ok: true, via: "Settings" };
}

export const rosterGroupsAPI = {
  list: async () => {
    if (_rosterGroupsSheetAvailable !== false) {
      try {
        const rows = await apiRead("RosterGroups");
        _rosterGroupsSheetAvailable = true;
        const normalized = (rows || [])
          .map((r) =>
            normalizeRosterGroupRecord({
              ...r,
              id: safeString(r.groupId || r.id),
              _sheetRowId: safeString(r.id),
            })
          )
          .filter((x) => x.id);
        if (normalized.length > 0) {
          return writeSheetCache("RosterGroups", normalized);
        }
      } catch {
        _rosterGroupsSheetAvailable = false;
      }
    }

    try {
      const cfgList = await appConfigAPI.get("roster_groups_v1");
      if (Array.isArray(cfgList) && cfgList.length > 0) {
        const normalized = cfgList
          .map((g) => normalizeRosterGroupRecord(g))
          .filter((x) => x.id);
        return writeSheetCache("RosterGroups", normalized);
      }
    } catch {}

    try {
      const s = await settingsAPI.get();
      const sList = s?.tabPreferences?.__rosterGroups;
      if (Array.isArray(sList) && sList.length > 0) {
        const normalized = sList
          .map((g) => normalizeRosterGroupRecord(g))
          .filter((x) => x.id);
        return writeSheetCache("RosterGroups", normalized);
      }
    } catch {}

    return readSheetCache("RosterGroups", []);
  },

  saveAll: async (groupsList = []) => {
    const cleanList = (Array.isArray(groupsList) ? groupsList : [])
      .map((g) => normalizeRosterGroupRecord(g))
      .filter((x) => x.id);

    writeSheetCache("RosterGroups", cleanList);

    if (_rosterGroupsSheetAvailable !== false) {
      try {
        const existingRows = await apiRead("RosterGroups");
        _rosterGroupsSheetAvailable = true;
        const rowByGroupId = new Map();
        (existingRows || []).forEach((r) => {
          const key = safeString(r.groupId || r.id);
          if (key) rowByGroupId.set(key, r);
        });

        const nextIds = new Set(cleanList.map((g) => g.id));
        for (const g of cleanList) {
          const rowPayload = serializeRosterGroupForSheet(g);
          const match = rowByGroupId.get(g.id);
          if (match && match.id) {
            await apiCall("update", "RosterGroups", rowPayload, match.id);
          } else {
            await apiCall("create", "RosterGroups", rowPayload);
          }
        }
        for (const [grpId, row] of rowByGroupId.entries()) {
          if (!nextIds.has(grpId) && row?.id) {
            await apiCall("delete", "RosterGroups", {}, row.id).catch(() => {});
          }
        }
        return { ok: true, via: "RosterGroups", items: cleanList };
      } catch {
        _rosterGroupsSheetAvailable = false;
      }
    }

    await persistRosterGroupsFallback(cleanList);
    return { ok: true, via: "Fallback", items: cleanList };
  },
};




