/* ═══════════════════════════════════════════════════════════
 * AUDIT LOG HELPERS
 * تسجيل النشاطات + سجل الدخول
 * ═══════════════════════════════════════════════════════════ */
import { auditAPI, loginHistoryAPI } from "../api";

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
