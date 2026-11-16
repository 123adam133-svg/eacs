/* ═══════════════════════════════════════════════════════════
 * AUDIT LOG HELPERS
 * تسجيل النشاطات + سجل الدخول
 * ═══════════════════════════════════════════════════════════ */
import { auditAPI, loginHistoryAPI, readSheetCache, writeSheetCache } from "../api";

/* ⭐ معلومات العميل (Browser, OS) */
export const getClientInfo = () => {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";

  let browser = "Unknown";
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
    os = "iOS";

  return {
    userAgent: ua.substring(0, 200),
    browser,
    os,
  };
};

function getCrewCodeShort(member, fallbackId = "") {
  if (!member) return String(fallbackId || "").slice(0, 5).toUpperCase();
  if (member.code) return String(member.code).trim().toUpperCase();
  if (member.empNo) return String(member.empNo).trim().toUpperCase();
  const fullStr = String(member.fullName || "").trim();
  if (!fullStr) return String(fallbackId || "").slice(0, 5).toUpperCase();
  const parts = fullStr.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase();
}

function calcHhmmDiff(stdStr, staStr) {
  const s1 = String(stdStr || "");
  const s2 = String(staStr || "");
  const m1 = s1.includes("T") ? s1.slice(11, 16) : s1.slice(0, 5);
  const m2 = s2.includes("T") ? s2.slice(11, 16) : s2.slice(0, 5);
  const p1 = m1.split(":").map(Number);
  const p2 = m2.split(":").map(Number);
  if (p1.length < 2 || p2.length < 2 || isNaN(p1[0]) || isNaN(p2[0])) return "00:00";
  let diff = p2[0] * 60 + p2[1] - (p1[0] * 60 + p1[1]);
  if (diff < 0) diff += 1440;
  return `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`;
}

/** Build a compact, comparable flight snapshot stored in AuditLog details */
export const buildFlightHistorySnapshot = (flight, crewList = []) => {
  if (!flight) return {};
  const slots = Array.isArray(flight.crewSlots) ? flight.crewSlots : [];
  const crewById = new Map(
    (Array.isArray(crewList) ? crewList : []).map((c) => [String(c.id), c])
  );

  const slotEntries = slots
    .filter((s) => s && (s.crewId || s.code || s.crewName))
    .map((s) => {
      const m = crewById.get(String(s.crewId));
      const code = getCrewCodeShort(m, s.code || s.crewName || s.crewId);
      return {
        position: String(s.position || "").toUpperCase(),
        code,
        crewId: String(s.crewId || ""),
      };
    });

  const picSlot = slotEntries.find((s) =>
    ["CPT", "PIC", "CAPTAIN", "INS", "TRI"].includes(s.position)
  );
  const crewCodes = Array.from(new Set(slotEntries.map((s) => s.code).filter(Boolean)));

  const stdTime = String(flight.std || "").includes("T")
    ? String(flight.std).slice(11, 16)
    : String(flight.std || "").slice(0, 5);
  const staTime = String(flight.sta || "").includes("T")
    ? String(flight.sta).slice(11, 16)
    : String(flight.sta || "").slice(0, 5);
  const dateStr =
    flight.date ||
    (String(flight.std || "").includes("T") ? String(flight.std).slice(0, 10) : "");

  const fType = String(flight.flightType || "SCHEDULED").toUpperCase();
  const fNature = String(flight.flightNature || "PAX").toUpperCase();

  return {
    flightNo: String(flight.flightNo || "").toUpperCase(),
    date: dateStr,
    dep: String(flight.dep || "").toUpperCase(),
    arr: String(flight.arr || "").toUpperCase(),
    std: stdTime,
    sta: staTime,
    blockTime: flight.blockTime || calcHhmmDiff(flight.std, flight.sta),
    altn: String(flight.altn || "").toUpperCase(),
    altn2: String(flight.altn2 || "").toUpperCase(),
    acft: String(flight.acft || "").toUpperCase(),
    status: String(flight.status || "SCHEDULED").toUpperCase(),
    flightType: fType,
    flightNature: fNature,
    commercial: fNature !== "FERRY" && fType !== "TRAINING" ? "Yes" : "No",
    flightRules: flight.flightRules || "I",
    icaoType: fType === "SCHEDULED" ? "S" : fType === "PRIVATE" ? "G" : "N",
    pax: Number(flight.pax) || 0,
    cargo: Number(flight.cargo) || 0,
    pic: picSlot?.code || "",
    crewCodes,
    notes: String(flight.notes || ""),
    permits: String(flight.permits || ""),
    services: String(flight.services || ""),
    legsCount: Array.isArray(flight.legs) ? flight.legs.length : 0,
    sectors: (Array.isArray(flight.legs) ? flight.legs : []).map((l) => ({
      flightNo: String(l.flightNo || flight.flightNo || "").toUpperCase(),
      dep: String(l.dep || "").toUpperCase(),
      arr: String(l.arr || "").toUpperCase(),
      std: String(l.std || "").includes("T")
        ? String(l.std).slice(11, 16)
        : String(l.std || "").slice(0, 5),
      sta: String(l.sta || "").includes("T")
        ? String(l.sta).slice(11, 16)
        : String(l.sta || "").slice(0, 5),
      acft: String(l.acft || flight.acft || "").toUpperCase(),
      status: String(l.status || "SCHEDULED").toUpperCase(),
      pax: Number(l.pax) || 0,
      crewCodes: (Array.isArray(l.crewSlots) ? l.crewSlots : [])
        .map((s) => getCrewCodeShort(crewById.get(String(s.crewId)), s.code || s.crewId))
        .filter(Boolean),
    })),
  };
};

/* ⭐ تسجيل نشاط */
export const logAction = async (
  user,
  action,
  entity,
  entityId,
  entityName,
  details = {}
) => {
  if (!user) return null;

  const client = getClientInfo();
  const log = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId: user.id || "",
    userName: user.fullName || user.username || "",
    userRole: user.role || "",
    action,
    entity,
    entityId: entityId || "",
    entityName: entityName || "",
    details: typeof details === "string" ? details : JSON.stringify(details),
    ipAddress: "",
    userAgent: client.userAgent,
  };

  try {
    const prev = readSheetCache("AuditLog", []);
    if (Array.isArray(prev)) {
      writeSheetCache("AuditLog", [log, ...prev].slice(0, 500));
    }
  } catch {
    // Ignore local cache write error
  }

  try {
    await auditAPI.create(log);
    return log;
  } catch (e) {
    console.warn("Audit log failed:", e.message);
    return null;
  }
};

/* ⭐ تسجيل آمن (لا يعطل العملية الأصلية) */
export const logSafe = (
  user,
  action,
  entity,
  entityId,
  entityName,
  details
) => {
  if (!user) return;
  logAction(user, action, entity, entityId, entityName, details).catch((err) =>
    console.warn("Audit error:", err)
  );
};

/* ⭐ تسجيل دخول/خروج */
export const logLogin = async (user, action, success = true, reason = "") => {
  const client = getClientInfo();
  try {
    await loginHistoryAPI.create({
      timestamp: new Date().toISOString(),
      userId: user?.id || "",
      userName: user?.fullName || "",
      username: user?.username || "",
      userRole: user?.role || "",
      action,
      browser: client.browser,
      os: client.os,
      userAgent: client.userAgent,
      success,
      reason,
    });
  } catch (e) {
    console.warn("Login history failed:", e.message);
  }
};

/* ⭐ تسجيل دخول آمن */
export const logLoginSafe = (user, action, success = true, reason = "") => {
  logLogin(user, action, success, reason).catch(() => {});
};
