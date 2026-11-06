/* ═══════════════════════════════════════════════════════════
 * UTILS — BARREL EXPORT
 * All helpers from a single place
 * ═══════════════════════════════════════════════════════════ */

/* ⭐ كل شيء من helpers.js (Dates + Time + Safe + Strings + Validation + Files + Colors + Arrays) */
export {
  /* Safe Parsing */
  safeArray,
  safeObject,
  safeNumber,
  safeBool,
  safeString,
  safeDateISO,

  /* Dates */
  daysUntil,
  docStatus,
  fmtDate,
  fmtDateClassic,
  fmtTime,
  fmtDateTime,
  fmtTimeAgo,
  fmtDateParts,
  todayISO,
  daysAgoISO,
  daysAheadISO,
  dateRange,

  /* Time */
  timeDiffMin,
  minToHM,
  minToHMText,
  hmToMin,
  fmtDuty,
  fmtDutyHM,

  /* IDs */
  uid,
  uuid,

  /* Strings */
  initials,
  truncate,
  slugify,

  /* Validation */
  isValidEmail,
  isValidPhone,
  isValidDate,

  /* Files */
  formatFileSize,
  fileTypeIcon,
  canPreviewFile,

  /* Colors */
  getStatusColor,
  getProgressColor,

  /* Arrays */
  groupBy,
  sortBy,
  unique,
  sum,
} from "./helpers";

/* ⭐ Audit (logSafe, logAction, logLogin, logLoginSafe, getClientInfo) */
export {
  getClientInfo,
  logAction,
  logSafe,
  logLogin,
  logLoginSafe,
} from "./audit";

/* ⭐ PDF (pdfSafe, generateCrewCardPDF, generateGenDecPDF, downloadPDF, openPDF) */
export {
  pdfSafe,
  generateCrewCardPDF,
  generateGenDecPDF,
  downloadPDF,
  openPDF,
} from "./pdf";

/* ⭐ Alerts (computeAlerts) */
export { computeAlerts } from "./alerts";
