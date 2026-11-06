/* ═══════════════════════════════════════════════════════════
 * SAFE PARSING — تحويلات آمنة
 * ═══════════════════════════════════════════════════════════ */

/* ⭐ تحويل آمن إلى مصفوفة */
export const safeArray = (val) => {
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
};

/* ⭐ تحويل آمن إلى كائن */
export const safeObject = (val) => {
  if (!val) return null;
  if (typeof val === "object" && !Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return null;
};

/* ⭐ تحويل آمن إلى رقم */
export const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

/* ⭐ تحويل آمن إلى boolean */
export const safeBool = (val) => {
  return (
    val === true || val === "true" || val === "TRUE" || val === 1 || val === "1"
  );
};

/* ⭐ تحويل آمن إلى نص */
export const safeString = (val, fallback = "") => {
  if (val === null || val === undefined) return fallback;
  return String(val);
};

/* ⭐ تحويل آمن لتاريخ ISO */
export const safeDateISO = (val) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    return d.toISOString();
  } catch {
    return "";
  }
};
