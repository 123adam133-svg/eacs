/* ═══════════════════════════════════════════════════════════
 * CONSTANTS — AeroOps v3.1
 * - v3.1: FTL calculates based on all assigned flights (scheduled + completed)
 * ═══════════════════════════════════════════════════════════ */

/* ═══════ FLIGHT TYPES ═══════ */
export const FLIGHT_TYPES = [
  {
    key: "SCHEDULED",
    en: "Scheduled",
    ar: "مجدولة",
    icon: "📅",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    dot: "#0284c7",
  },
  {
    key: "PAX",
    en: "Passenger",
    ar: "ركاب",
    icon: "👥",
    color: "bg-cyan-100 text-cyan-700 border-cyan-300",
    dot: "#06b6d4",
  },
  {
    key: "CARGO",
    en: "Cargo",
    ar: "شحن",
    icon: "📦",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "#f59e0b",
  },
  {
    key: "VIP",
    en: "VIP",
    ar: "VIP",
    icon: "👑",
    color: "bg-purple-100 text-purple-700 border-purple-300",
    dot: "#a855f7",
  },
  {
    key: "CHARTER",
    en: "Charter",
    ar: "عارضة",
    icon: "🎫",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    dot: "#6366f1",
  },
  {
    key: "TRAINING",
    en: "Training",
    ar: "تدريب",
    icon: "🎓",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    dot: "#22c55e",
  },
  {
    key: "POSITIONING",
    en: "Positioning",
    ar: "نقل",
    icon: "✈️",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "#94a3b8",
  },
  {
    key: "MAINTENANCE",
    en: "Maintenance Flight",
    ar: "صيانة",
    icon: "🔧",
    color: "bg-rose-100 text-rose-700 border-rose-300",
    dot: "#dc2626",
  },
  {
    key: "AMBULANCE",
    en: "Ambulance",
    ar: "إسعاف",
    icon: "🚑",
    color: "bg-red-100 text-red-700 border-red-300",
    dot: "#b91c1c",
  },
];

export const getFlightType = (key) =>
  FLIGHT_TYPES.find((t) => t.key === key) || FLIGHT_TYPES[0];

/* ═══════ FLIGHT STATUSES ═══════ */
export const FLIGHT_STATUSES = [
  {
    key: "SCHEDULED",
    en: "Scheduled",
    ar: "مجدولة",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    dot: "#0284c7",
  },
  {
    key: "BOARDING",
    en: "Boarding",
    ar: "صعود",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "#f59e0b",
  },
  {
    key: "DELAYED",
    en: "Delayed",
    ar: "متأخرة",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    dot: "#f97316",
  },
  {
    key: "DEPARTED",
    en: "Departed",
    ar: "غادرت",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    dot: "#6366f1",
  },
  {
    key: "ARRIVED",
    en: "Arrived",
    ar: "وصلت",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    dot: "#22c55e",
  },
  {
    key: "CANCELLED",
    en: "Cancelled",
    ar: "ملغاة",
    color: "bg-rose-100 text-rose-700 border-rose-300",
    dot: "#dc2626",
  },
];

export const getFlightStatus = (key) =>
  FLIGHT_STATUSES.find((s) => s.key === key) || FLIGHT_STATUSES[0];

/* ═══════════════════════════════════════════════════════════
 * POSITIONS
 * ═══════════════════════════════════════════════════════════ */

export const DEFAULT_POSITION_OPTIONS = [
  {
    key: "captain",
    en: "Captain (CPT)",
    short: "CPT",
    ar: "كابتن",
    defaultPlace: "PIC",
    locked: true,
  },
  {
    key: "firstOfficer",
    en: "First Officer (FO)",
    short: "FO",
    ar: "ضابط أول",
    defaultPlace: "FO",
    locked: true,
  },
  {
    key: "observer",
    en: "Observer (OBS)",
    short: "OBS",
    ar: "مراقب",
    defaultPlace: "ACM",
    locked: false,
  },
  {
    key: "tri",
    en: "Training Instructor (TRI)",
    short: "TRI",
    ar: "مدرب طيران",
    defaultPlace: "TRI",
    locked: false,
  },
  {
    key: "fa1",
    en: "Flight Attendant 1 (FA1)",
    short: "FA1",
    ar: "مضيف 1",
    defaultPlace: "FA",
    locked: false,
  },
  {
    key: "fa2",
    en: "Flight Attendant 2 (FA2)",
    short: "FA2",
    ar: "مضيف 2",
    defaultPlace: "CC",
    locked: false,
  },
  {
    key: "engineer",
    en: "Engineer (ENG)",
    short: "ENG",
    ar: "مهندس",
    defaultPlace: "ENG1",
    locked: false,
  },
  {
    key: "security",
    en: "Security (SEC)",
    short: "SEC",
    ar: "أمن",
    defaultPlace: "SEC",
    locked: false,
  },
  {
    key: "loadmaster",
    en: "Loadmaster (LTC)",
    short: "LTC",
    ar: "حمولة",
    defaultPlace: "LMC",
    locked: false,
  },
  {
    key: "flightDispatcher",
    en: "Flight Dispatcher (FD)",
    short: "FD",
    ar: "مرسل رحلات",
    defaultPlace: "FD",
    locked: false,
  },
];

export const POSITION_OPTIONS = DEFAULT_POSITION_OPTIONS;

export function getPositionOptions(settings) {
  try {
    let positions = settings?.positions;
    if (typeof positions === "string" && positions.trim()) {
      positions = JSON.parse(positions);
    }
    if (Array.isArray(positions) && positions.length > 0) {
      return positions;
    }
  } catch (e) {
    console.warn("Failed to parse settings.positions:", e);
  }
  return DEFAULT_POSITION_OPTIONS;
}

export const POSITION_ROLE_MAP = {
  captain: ["captain"],
  firstOfficer: ["firstOfficer"],
  observer: ["observer", "captain", "firstOfficer"],
  tri: ["tri", "captain", "firstOfficer"],
  fa1: ["flightAttendant", "fa1"],
  fa2: ["flightAttendant", "fa2"],
  engineer: ["engineer"],
  security: ["security"],
  loadmaster: ["loadmaster"],
  flightDispatcher: ["flightDispatcher", "dispatcher"],
};

export function getAllowedRoles(positionKey) {
  if (!positionKey) return [];
  if (POSITION_ROLE_MAP[positionKey]) return POSITION_ROLE_MAP[positionKey];
  return [positionKey];
}

/* ⭐ CREW_ROLE_ICONS */
export const CREW_ROLE_ICONS = {
  captain: { icon: "👨‍✈️", color: "#0ea5e9", label_en: "CPT", label_ar: "كابتن" },
  firstOfficer: {
    icon: "✈️",
    color: "#22c55e",
    label_en: "FO",
    label_ar: "ضابط أول",
  },
  observer: {
    icon: "👁️",
    color: "#6366f1",
    label_en: "OBS",
    label_ar: "مراقب",
  },
  tri: {
    icon: "🎓",
    color: "#06b6d4",
    label_en: "TRI",
    label_ar: "مدرب طيران",
  },
  flightAttendant: {
    icon: "👩‍✈️",
    color: "#f59e0b",
    label_en: "FA",
    label_ar: "مضيف",
  },
  fa1: { icon: "👩‍✈️", color: "#f59e0b", label_en: "FA1", label_ar: "مضيف 1" },
  fa2: { icon: "👩‍✈️", color: "#f59e0b", label_en: "FA2", label_ar: "مضيف 2" },
  engineer: {
    icon: "🔧",
    color: "#a855f7",
    label_en: "ENG",
    label_ar: "مهندس",
  },
  security: { icon: "🛡️", color: "#ef4444", label_en: "SEC", label_ar: "أمن" },
  loadmaster: {
    icon: "📦",
    color: "#14b8a6",
    label_en: "LTC",
    label_ar: "حمولة",
  },
  flightDispatcher: {
    icon: "📋",
    color: "#8b5cf6",
    label_en: "FD",
    label_ar: "مرسل",
  },
};

export const getCrewIcon = (role) =>
  CREW_ROLE_ICONS[role] || {
    icon: "👤",
    color: "#94a3b8",
    label_en: "—",
    label_ar: "—",
  };

export const ROLE_OPTIONS = [
  "captain",
  "firstOfficer",
  "observer",
  "tri",
  "flightAttendant",
  "engineer",
  "security",
  "loadmaster",
  "flightDispatcher",
];

/* ═══════ NOTE TEMPLATES ═══════ */
export const NOTE_TEMPLATES = [
  { en: "On Time", ar: "في الوقت", icon: "✅", type: "success" },
  { en: "Delayed - Weather", ar: "تأخير - طقس", icon: "🌧️", type: "warning" },
  { en: "Delayed - Technical", ar: "تأخير - فني", icon: "🔧", type: "warning" },
  { en: "Delayed - ATC", ar: "تأخير - المراقبة", icon: "📡", type: "warning" },
  { en: "Cancelled", ar: "ملغاة", icon: "❌", type: "danger" },
  { en: "VIP on Board", ar: "VIP على المتن", icon: "👑", type: "info" },
  { en: "Medical Case", ar: "حالة طبية", icon: "🩺", type: "danger" },
  { en: "Cargo Flight", ar: "رحلة شحن", icon: "📦", type: "info" },
  { en: "Training Flight", ar: "رحلة تدريب", icon: "🎓", type: "info" },
  { en: "Extra Fuel", ar: "وقود إضافي", icon: "⛽", type: "info" },
  { en: "Bird Strike", ar: "اصطدام طير", icon: "🐦", type: "danger" },
  { en: "Turbulence", ar: "اضطراب جوي", icon: "💨", type: "warning" },
  { en: "Aircraft Change", ar: "تغيير الطائرة", icon: "🔄", type: "warning" },
  { en: "Crew Change", ar: "تغيير الطاقم", icon: "👥", type: "warning" },
  { en: "Diverted", ar: "تحويل المسار", icon: "↩️", type: "danger" },
];

export const getNoteTemplate = (note) =>
  NOTE_TEMPLATES.find((nt) => nt.en === note || nt.ar === note) || {
    icon: "📝",
    type: "default",
  };

/* ═══════ AIRCRAFT STATUSES ═══════ */
export const AIRCRAFT_STATUSES = [
  {
    key: "AIRWORTHY",
    en: "Airworthy",
    ar: "صالح",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    dot: "#22c55e",
    icon: "✅",
  },
  {
    key: "MAINTENANCE",
    en: "Maintenance",
    ar: "صيانة",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "#f59e0b",
    icon: "🔧",
  },
  {
    key: "AOG",
    en: "AOG",
    ar: "AOG",
    color: "bg-rose-100 text-rose-700 border-rose-300",
    dot: "#dc2626",
    icon: "🚨",
  },
  {
    key: "INSPECTION_DUE",
    en: "Inspection Due",
    ar: "فحص مستحق",
    color: "bg-orange-100 text-orange-700 border-orange-300",
    dot: "#fb923c",
    icon: "📅",
  },
  {
    key: "STORED",
    en: "Stored",
    ar: "مخزنة",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "#94a3b8",
    icon: "📦",
  },
  {
    key: "IN_FLIGHT",
    en: "In Flight",
    ar: "في الجو",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    dot: "#0ea5e9",
    icon: "✈️",
  },
  {
    key: "RESERVED",
    en: "Reserved",
    ar: "محجوزة",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    dot: "#6366f1",
    icon: "🔒",
  },
  {
    key: "RETIRED",
    en: "Retired",
    ar: "خارج الخدمة",
    color: "bg-slate-200 text-slate-700 border-slate-400",
    dot: "#475569",
    icon: "🚫",
  },
  {
    key: "LEASED_OUT",
    en: "Leased Out",
    ar: "مؤجرة",
    color: "bg-purple-100 text-purple-700 border-purple-300",
    dot: "#a855f7",
    icon: "📤",
  },
  {
    key: "GROUNDED",
    en: "Grounded",
    ar: "موقوفة أرضياً",
    color: "bg-red-100 text-red-700 border-red-300",
    dot: "#b91c1c",
    icon: "⛔",
  },
];

export const getAircraftStatus = (key) =>
  AIRCRAFT_STATUSES.find((s) => s.key === key) || AIRCRAFT_STATUSES[0];

/* ═══════ TRAINING TYPES ═══════ */
export const TRAINING_TYPES = {
  SIMULATOR: {
    label_en: "Simulator",
    label_ar: "محاكي",
    icon: "🖥️",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
  },
  LINE_CHECK: {
    label_en: "Line Check",
    label_ar: "فحص خط",
    icon: "✈️",
    color: "bg-sky-100 text-sky-700 border-sky-300",
  },
  CRM: {
    label_en: "CRM Training",
    label_ar: "تدريب CRM",
    icon: "👥",
    color: "bg-purple-100 text-purple-700 border-purple-300",
  },
  DG: {
    label_en: "Dangerous Goods",
    label_ar: "المواد الخطرة",
    icon: "☢️",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  SEP: {
    label_en: "Safety Equipment",
    label_ar: "معدات السلامة",
    icon: "🦺",
    color: "bg-orange-100 text-orange-700 border-orange-300",
  },
  FIRST_AID: {
    label_en: "First Aid",
    label_ar: "الإسعافات الأولية",
    icon: "🩺",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
  RECURRENT: {
    label_en: "Recurrent Training",
    label_ar: "تدريب دوري",
    icon: "🔄",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  TYPE_RATING: {
    label_en: "Type Rating",
    label_ar: "تصنيف النوع",
    icon: "🎓",
    color: "bg-cyan-100 text-cyan-700 border-cyan-300",
  },
  MEDICAL: {
    label_en: "Medical Check",
    label_ar: "فحص طبي",
    icon: "⚕️",
    color: "bg-red-100 text-red-700 border-red-300",
  },
  LPC: {
    label_en: "License Proficiency Check",
    label_ar: "كفاءة الرخصة",
    icon: "📜",
    color: "bg-teal-100 text-teal-700 border-teal-300",
  },
  OPC: {
    label_en: "Operator Proficiency Check",
    label_ar: "كفاءة المشغل",
    icon: "✅",
    color: "bg-lime-100 text-lime-700 border-lime-300",
  },
};

export const getTrainingType = (key) =>
  TRAINING_TYPES[key] || {
    label_en: key || "—",
    label_ar: key || "—",
    icon: "📝",
    color: "bg-slate-100 text-slate-700 border-slate-300",
  };

export const TRAINING_RESULT = {
  PASS: {
    label_en: "Pass",
    label_ar: "ناجح",
    icon: "✅",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  FAIL: {
    label_en: "Fail",
    label_ar: "راسب",
    icon: "❌",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
  PENDING: {
    label_en: "Pending",
    label_ar: "قيد الانتظار",
    icon: "⏳",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
};

/* ═══════ LEAVE TYPES ═══════ */
export const LEAVE_TYPES = {
  ANNUAL: {
    label_en: "Annual Leave",
    label_ar: "إجازة سنوية",
    icon: "🌴",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  SICK: {
    label_en: "Sick Leave",
    label_ar: "إجازة مرضية",
    icon: "🤒",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
  MEDICAL: {
    label_en: "Medical Leave",
    label_ar: "إجازة طبية",
    icon: "⚕️",
    color: "bg-red-100 text-red-700 border-red-300",
  },
  MATERNITY: {
    label_en: "Maternity Leave",
    label_ar: "إجازة أمومة",
    icon: "👶",
    color: "bg-pink-100 text-pink-700 border-pink-300",
  },
  PATERNITY: {
    label_en: "Paternity Leave",
    label_ar: "إجازة أبوة",
    icon: "👨‍👶",
    color: "bg-blue-100 text-blue-700 border-blue-300",
  },
  UNPAID: {
    label_en: "Unpaid Leave",
    label_ar: "إجازة بدون راتب",
    icon: "💼",
    color: "bg-slate-100 text-slate-700 border-slate-300",
  },
  COMPASSIONATE: {
    label_en: "Compassionate Leave",
    label_ar: "إجازة تعزية",
    icon: "🖤",
    color: "bg-gray-100 text-gray-700 border-gray-300",
  },
  STUDY: {
    label_en: "Study Leave",
    label_ar: "إجازة دراسية",
    icon: "📚",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
  },
  HAJJ: {
    label_en: "Hajj Leave",
    label_ar: "إجازة حج",
    icon: "🕋",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  EMERGENCY: {
    label_en: "Emergency Leave",
    label_ar: "إجازة طارئة",
    icon: "🚨",
    color: "bg-orange-100 text-orange-700 border-orange-300",
  },
};

export const getLeaveType = (key) =>
  LEAVE_TYPES[key] || {
    label_en: key || "—",
    label_ar: key || "—",
    icon: "📝",
    color: "bg-slate-100 text-slate-700 border-slate-300",
  };

export const LEAVE_STATUS = {
  pending: {
    label_en: "Pending",
    label_ar: "قيد الانتظار",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  approved: {
    label_en: "Approved",
    label_ar: "معتمدة",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  rejected: {
    label_en: "Rejected",
    label_ar: "مرفوضة",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
  cancelled: {
    label_en: "Cancelled",
    label_ar: "ملغاة",
    color: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

/* ═══════ STANDBY TYPES ═══════ */
export const STANDBY_TYPES = {
  AIRPORT: {
    label_en: "Airport Standby",
    label_ar: "احتياطي مطار",
    icon: "🛫",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    easa: true,
  },
  HOME: {
    label_en: "Home Standby",
    label_ar: "احتياطي منزل",
    icon: "🏠",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    easa: true,
  },
  HOTEL: {
    label_en: "Hotel Standby",
    label_ar: "احتياطي فندق",
    icon: "🏨",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    easa: true,
  },
  RESERVE: {
    label_en: "Reserve",
    label_ar: "احتياط",
    icon: "⏰",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    easa: false,
  },
  CALL_OUT: {
    label_en: "Call-out",
    label_ar: "استدعاء",
    icon: "📞",
    color: "bg-rose-100 text-rose-700 border-rose-300",
    easa: false,
  },
};

export const getStandbyType = (key) =>
  STANDBY_TYPES[key] || {
    label_en: key || "—",
    label_ar: key || "—",
    icon: "📝",
    color: "bg-slate-100 text-slate-700 border-slate-300",
    easa: false,
  };

/* ═══════ ROSTER TYPES ═══════ */
export const ROSTER_TYPES = {
  FLIGHT: {
    label_en: "Flight Duty",
    label_ar: "رحلة",
    icon: "✈️",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    dot: "#0ea5e9",
  },
  STANDBY: {
    label_en: "Standby",
    label_ar: "احتياطي",
    icon: "⏰",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    dot: "#6366f1",
  },
  OFF: {
    label_en: "Day Off",
    label_ar: "راحة",
    icon: "🏖️",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
    dot: "#22c55e",
  },
  LEAVE: {
    label_en: "Leave",
    label_ar: "إجازة",
    icon: "🌴",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    dot: "#f59e0b",
  },
  TRAINING: {
    label_en: "Training",
    label_ar: "تدريب",
    icon: "🎓",
    color: "bg-purple-100 text-purple-700 border-purple-300",
    dot: "#a855f7",
  },
  SICK: {
    label_en: "Sick",
    label_ar: "مرضية",
    icon: "🤒",
    color: "bg-rose-100 text-rose-700 border-rose-300",
    dot: "#ef4444",
  },
};

/* ═══════ AUDIT ACTIONS ═══════ */
export const AUDIT_ACTIONS = {
  CREATE: {
    label_en: "Create",
    label_ar: "إنشاء",
    icon: "➕",
    color: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
  UPDATE: {
    label_en: "Update",
    label_ar: "تحديث",
    icon: "✏️",
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  DELETE: {
    label_en: "Delete",
    label_ar: "حذف",
    icon: "🗑️",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
  LOGIN: {
    label_en: "Login",
    label_ar: "دخول",
    icon: "🔓",
    color: "bg-sky-100 text-sky-700 border-sky-300",
  },
  LOGOUT: {
    label_en: "Logout",
    label_ar: "خروج",
    icon: "🔒",
    color: "bg-slate-100 text-slate-700 border-slate-300",
  },
  LOGIN_FAILED: {
    label_en: "Login Failed",
    label_ar: "دخول فاشل",
    icon: "⚠️",
    color: "bg-rose-100 text-rose-700 border-rose-300",
  },
};

/* ═══════ DAYS & MONTHS ═══════ */
export const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

/* ═══════ FTL HELPERS ═══════ */
export const diffMinutes = (startIso, endIso) => {
  if (!startIso || !endIso) return 0;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  return Math.max(0, Math.round((b - a) / 60000));
};

export const fmtDuty = (min) => {
  if (!min || min < 0) return "00:00";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const fmtDutyHM = (min) => {
  if (!min || min < 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const isNightTime = (iso) => {
  if (!iso) return false;
  const h = new Date(iso).getUTCHours();
  return h >= 2 && h < 6;
};

export const getLocalHour = (iso, tzOffsetHours = 0) => {
  if (!iso) return 0;
  const d = new Date(iso);
  return (d.getUTCHours() + tzOffsetHours + 24) % 24;
};

export const timeToMinutes = (hhmm) => {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (min) => {
  if (!min || min < 0) return "00:00";
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const calcFlightDuty = (flight) => {
  if (!flight)
    return {
      blockMin: 0,
      flightMin: 0,
      dutyMin: 0,
      nightMin: 0,
      instrumentMin: 0,
      sectors: 0,
    };
  const a = flight.actual || {};
  const std = a.std || flight.std;
  const sta = a.sta || flight.sta;
  const blockMin = diffMinutes(std, sta);
  const flightMin = Math.max(0, blockMin - 30);
  const nightMin = a.night || Math.round(blockMin * 0.2);
  const instrumentMin = a.instrument || Math.round(flightMin * 0.3);
  return {
    blockMin,
    flightMin,
    dutyMin: blockMin,
    nightMin,
    instrumentMin,
    sectors: blockMin > 0 ? 1 : 0,
    std,
    sta,
  };
};

export const calcEasaStandby = (durationMin) => {
  const min = Math.max(0, durationMin);
  const first6h = Math.min(min, 360);
  const after = Math.max(0, min - 360);
  const countMin = Math.round(first6h * 0.25 + after * 0.5);
  let factor = "25%";
  if (min > 360) factor = "25% + 50%";
  else if (min > 0) factor = "25%";
  return {
    durationMin: min,
    countMin,
    factor,
    firstPart: first6h,
    secondPart: after,
  };
};

export const calcFdpLimit = (
  startTimeIso,
  sectorsCount,
  isNightDuty = false
) => {
  if (!startTimeIso) return { maxMin: 13 * 60, label: "13h" };
  const hour = new Date(startTimeIso).getUTCHours();
  let baseMin;
  if (hour >= 6 && hour < 8) baseMin = 13 * 60;
  else if (hour >= 8 && hour < 13) baseMin = 14 * 60;
  else if (hour >= 13 && hour < 17) baseMin = 13 * 60;
  else if (hour >= 17 && hour < 22) baseMin = 12 * 60;
  else baseMin = 11 * 60;
  const deduction = Math.max(0, (sectorsCount - 2) * 30);
  const maxMin = Math.max(9 * 60, baseMin - deduction);
  return {
    maxMin,
    label: `${Math.floor(maxMin / 60)}h${
      maxMin % 60 ? " " + (maxMin % 60) + "m" : ""
    }`,
    isNightDuty: hour >= 22 || hour < 6,
  };
};

/* ═══════ EASA LIMITS ═══════ */
export const EASA_LIMITS = {
  DUTY_7D: {
    maxMin: 60 * 60,
    label_en: "Duty / 7 days",
    label_ar: "الخدمة / 7 أيام",
  },
  DUTY_14D: {
    maxMin: 110 * 60,
    label_en: "Duty / 14 days",
    label_ar: "الخدمة / 14 يوم",
  },
  DUTY_28D: {
    maxMin: 190 * 60,
    label_en: "Duty / 28 days",
    label_ar: "الخدمة / 28 يوم",
  },
  DUTY_365D: {
    maxMin: 2000 * 60,
    label_en: "Duty / Year",
    label_ar: "الخدمة / سنة",
  },
  FLIGHT_28D: {
    maxMin: 100 * 60,
    label_en: "Flight / 28 days",
    label_ar: "الطيران / 28 يوم",
  },
  FLIGHT_365D: {
    maxMin: 900 * 60,
    label_en: "Flight / Year",
    label_ar: "الطيران / سنة",
  },
};

export const limitStatus = (used, max) => {
  if (used >= max) return "exceeded";
  const pct = (used / max) * 100;
  if (pct >= 95) return "critical";
  if (pct >= 85) return "warning";
  return "ok";
};

const groupDutiesByDate = (crewFlights) => {
  const dutiesMap = {};
  crewFlights.forEach((f) => {
    const a = f.actual || {};
    const std = a.std || f.std;
    const sta = a.sta || f.sta;
    if (!std) return;
    const dateKey = String(std).slice(0, 10);
    const blockMin = diffMinutes(std, sta);
    const flightMin = Math.max(0, blockMin - 30);
    if (!dutiesMap[dateKey]) {
      dutiesMap[dateKey] = {
        date: dateKey,
        flights: [],
        sectors: 0,
        blockMin: 0,
        flightMin: 0,
        nightMin: 0,
        instrumentMin: 0,
        firstStd: std,
        lastSta: sta || std,
      };
    }
    const d = dutiesMap[dateKey];
    d.flights.push(f);
    d.sectors += 1;
    d.blockMin += blockMin;
    d.flightMin += flightMin;
    d.nightMin += a.night || Math.round(blockMin * 0.2);
    d.instrumentMin += a.instrument || Math.round(flightMin * 0.3);
    if (std < d.firstStd) d.firstStd = std;
    if (sta && (!d.lastSta || sta > d.lastSta)) d.lastSta = sta;
  });
  return Object.values(dutiesMap)
    .map((d) => {
      const dutyMin = Math.max(
        d.blockMin,
        diffMinutes(d.firstStd, d.lastSta) + 60
      );
      const fdpMin = dutyMin;
      const fdpLimit = calcFdpLimit(d.firstStd, d.sectors);
      const fdpExceeded = fdpMin > fdpLimit.maxMin;
      const startHour = new Date(d.firstStd).getUTCHours();
      const isNightDuty = startHour >= 22 || startHour < 6;
      return {
        date: d.date,
        sectors: d.sectors,
        blockMin: d.blockMin,
        flightMin: d.flightMin,
        dutyMin,
        fdpMin,
        fdpLimit: fdpLimit.label,
        fdpLimitMin: fdpLimit.maxMin,
        fdpExceeded,
        nightMin: d.nightMin,
        instrumentMin: d.instrumentMin,
        isNightDuty,
        usingDiscretion: false,
        flights: d.flights,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
};

const sumInWindow = (duties, days) => {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return duties
    .filter((d) => d.date >= cutoffStr)
    .reduce(
      (acc, d) => {
        acc.dutyMin += d.dutyMin;
        acc.flightMin += d.flightMin;
        acc.sectors += d.sectors;
        return acc;
      },
      { dutyMin: 0, flightMin: 0, sectors: 0 }
    );
};

export const calcCrewDutyEASA = (crewId, flights = [], fromDate, toDate) => {
  if (!crewId)
    return {
      duties: [],
      crewFlights: [],
      limits: {},
      totalDutyMin: 0,
      totalFlightMin: 0,
      totalSectors: 0,
    };
  const crewFlights = flights
    .filter((f) => {
      if (!f.std) return false;
      const hasSlot = (f.crewSlots || []).some((s) => s.crewId === crewId);
      if (!hasSlot) return false;
      const fd = String(f.std).slice(0, 10);
      if (fromDate && fd < fromDate) return false;
      if (toDate && fd > toDate) return false;
      return true;
    })
    .sort((a, b) => String(a.std).localeCompare(String(b.std)));
  const duties = groupDutiesByDate(crewFlights);
  const totals = duties.reduce(
    (acc, d) => {
      acc.dutyMin += d.dutyMin;
      acc.flightMin += d.flightMin;
      acc.sectors += d.sectors;
      return acc;
    },
    { dutyMin: 0, flightMin: 0, sectors: 0 }
  );
  const w7 = sumInWindow(duties, 7);
  const w14 = sumInWindow(duties, 14);
  const w28 = sumInWindow(duties, 28);
  const w365 = sumInWindow(duties, 365);
  const buildLimit = (used, maxMin, label_en, label_ar) => {
    const pct = maxMin > 0 ? Math.round((used / maxMin) * 100) : 0;
    return {
      used,
      max: maxMin,
      pct,
      status: limitStatus(used, maxMin),
      label_en,
      label_ar,
    };
  };
  const limits = {
    duty7: buildLimit(
      w7.dutyMin,
      EASA_LIMITS.DUTY_7D.maxMin,
      EASA_LIMITS.DUTY_7D.label_en,
      EASA_LIMITS.DUTY_7D.label_ar
    ),
    duty14: buildLimit(
      w14.dutyMin,
      EASA_LIMITS.DUTY_14D.maxMin,
      EASA_LIMITS.DUTY_14D.label_en,
      EASA_LIMITS.DUTY_14D.label_ar
    ),
    duty28: buildLimit(
      w28.dutyMin,
      EASA_LIMITS.DUTY_28D.maxMin,
      EASA_LIMITS.DUTY_28D.label_en,
      EASA_LIMITS.DUTY_28D.label_ar
    ),
    duty365: buildLimit(
      w365.dutyMin,
      EASA_LIMITS.DUTY_365D.maxMin,
      EASA_LIMITS.DUTY_365D.label_en,
      EASA_LIMITS.DUTY_365D.label_ar
    ),
    flight28: buildLimit(
      w28.flightMin,
      EASA_LIMITS.FLIGHT_28D.maxMin,
      EASA_LIMITS.FLIGHT_28D.label_en,
      EASA_LIMITS.FLIGHT_28D.label_ar
    ),
    flight365: buildLimit(
      w365.flightMin,
      EASA_LIMITS.FLIGHT_365D.maxMin,
      EASA_LIMITS.FLIGHT_365D.label_en,
      EASA_LIMITS.FLIGHT_365D.label_ar
    ),
  };
  return {
    duties,
    crewFlights,
    limits,
    totalDutyMin: totals.dutyMin,
    totalFlightMin: totals.flightMin,
    totalSectors: totals.sectors,
  };
};

/* ═══════════════════════════════════════════════════════════
 * ⭐ v4.0 — GLOBAL THEMES (أنماط المنظومة وبوابة الطاقم)
 * ═══════════════════════════════════════════════════════════ */
export const GLOBAL_THEMES = {
  modern: {
    id: "modern",
    name: "Modern Indigo",
    nameAr: "إنديغو حديث (النمط الافتراضي)",
    tagAr: "النمط الافتراضي المستقر",
    badge: "الافتراضي",
    preview: "#6366f1",
    vars: {
      "--brand-primary": "#6366f1",
      "--brand-primary-hover": "#4f46e5",
      "--brand-secondary": "#8b5cf6",
      "--brand-accent": "#a78bfa",
      "--brand-gradient": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      "--bg-app": "#f8fafc",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.85)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#0f172a",
      "--text-muted": "#64748b",
      "--border-default": "#e2e8f0",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(99, 102, 241, 0.15)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#0f172a",
      "--bg-card": "#1e293b",
      "--bg-header": "rgba(15, 23, 42, 0.85)",
      "--bg-sidebar": "#1e293b",
      "--text-primary": "#f1f5f9",
      "--text-muted": "#94a3b8",
      "--border-default": "#334155",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.4)",
    },
  },
  navyGold: {
    id: "navyGold",
    name: "Executive Royal Navy & Gold",
    nameAr: "الملكي VIP — كحلي وذهب فاخر",
    tagAr: "طيران خاص VIP وطائرات رجال الأعمال",
    badge: "VIP Royal",
    preview: "#d4af37",
    vars: {
      "--brand-primary": "#d4af37",
      "--brand-primary-hover": "#b89028",
      "--brand-secondary": "#997328",
      "--brand-accent": "#f4d47c",
      "--brand-gradient": "linear-gradient(135deg, #d4af37 0%, #f4d47c 50%, #b89028 100%)",
      "--bg-app": "#fbfaf6",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.90)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#18181b",
      "--text-muted": "#71717a",
      "--border-default": "#e4dfd3",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(212, 175, 55, 0.20)",
      "--radius": "12px",
    },
    darkVars: {
      "--brand-primary": "#f4d47c",
      "--brand-primary-hover": "#e6be57",
      "--brand-secondary": "#d4af37",
      "--brand-accent": "#ffe8a3",
      "--brand-gradient": "linear-gradient(135deg, #d4af37 0%, #f4d47c 60%, #b89028 100%)",
      "--bg-app": "#0a1322",
      "--bg-card": "#132137",
      "--bg-header": "rgba(10, 19, 34, 0.88)",
      "--bg-sidebar": "#0f1c30",
      "--text-primary": "#f8fafc",
      "--text-muted": "#94a3b8",
      "--border-default": "rgba(212, 175, 55, 0.35)",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.5)",
    },
  },
  aeroBlue: {
    id: "aeroBlue",
    name: "Commercial Aero Blue",
    nameAr: "أزرق الطيران التجاري (Aero Sky)",
    tagAr: "الخطوط التجارية والعمليات المنتظمة",
    badge: "Airline Blue",
    preview: "#0284c7",
    vars: {
      "--brand-primary": "#0284c7",
      "--brand-primary-hover": "#0369a1",
      "--brand-secondary": "#06b6d4",
      "--brand-accent": "#38bdf8",
      "--brand-gradient": "linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)",
      "--bg-app": "#f0f7ff",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#0c4a6e",
      "--text-muted": "#64748b",
      "--border-default": "#bae6fd",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(2, 132, 199, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#081a2e",
      "--bg-card": "#0f2d4e",
      "--bg-header": "rgba(8, 26, 46, 0.88)",
      "--bg-sidebar": "#0f2d4e",
      "--text-primary": "#f0f9ff",
      "--text-muted": "#94a3b8",
      "--border-default": "#1e3a5f",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  emeraldHorizon: {
    id: "emeraldHorizon",
    name: "Emerald Green Horizon",
    nameAr: "أخضر زمردي استراتيجي (Emerald)",
    tagAr: "الطيران البيئي والاستدامة الجوية",
    badge: "Eco Aviation",
    preview: "#059669",
    vars: {
      "--brand-primary": "#059669",
      "--brand-primary-hover": "#047857",
      "--brand-secondary": "#10b981",
      "--brand-accent": "#34d399",
      "--brand-gradient": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
      "--bg-app": "#f0fdf4",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#064e3b",
      "--text-muted": "#4b5563",
      "--border-default": "#bbf7d0",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(5, 150, 105, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#062319",
      "--bg-card": "#0e392b",
      "--bg-header": "rgba(6, 35, 25, 0.88)",
      "--bg-sidebar": "#0e392b",
      "--text-primary": "#ecfdf5",
      "--text-muted": "#a7f3d0",
      "--border-default": "#1c523f",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  crimsonFlagship: {
    id: "crimsonFlagship",
    name: "Flagship Crimson Red",
    nameAr: "أحمر قرمزي نخبوي (Flagship Red)",
    tagAr: "الناقل الوطني والخطوط الرمزية",
    badge: "Flagship",
    preview: "#dc2626",
    vars: {
      "--brand-primary": "#dc2626",
      "--brand-primary-hover": "#b91c1c",
      "--brand-secondary": "#be123c",
      "--brand-accent": "#fb7185",
      "--brand-gradient": "linear-gradient(135deg, #dc2626 0%, #be123c 100%)",
      "--bg-app": "#fff5f5",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#450a0a",
      "--text-muted": "#64748b",
      "--border-default": "#fecaca",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(220, 38, 38, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#1f0707",
      "--bg-card": "#341212",
      "--bg-header": "rgba(31, 7, 7, 0.88)",
      "--bg-sidebar": "#341212",
      "--text-primary": "#fef2f2",
      "--text-muted": "#fca5a5",
      "--border-default": "#5c1d1d",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  slateStealth: {
    id: "slateStealth",
    name: "Stealth Tactical Slate",
    nameAr: "رمادي تكتيكي احترافي (Stealth Slate)",
    tagAr: "عمليات الشحن والمراقبة الجوية التكتيكية",
    badge: "Tactical",
    preview: "#475569",
    vars: {
      "--brand-primary": "#475569",
      "--brand-primary-hover": "#334155",
      "--brand-secondary": "#64748b",
      "--brand-accent": "#94a3b8",
      "--brand-gradient": "linear-gradient(135deg, #334155 0%, #64748b 100%)",
      "--bg-app": "#f1f5f9",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#0f172a",
      "--text-muted": "#64748b",
      "--border-default": "#cbd5e1",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(71, 85, 105, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#0b1120",
      "--bg-card": "#151e32",
      "--bg-header": "rgba(11, 17, 32, 0.88)",
      "--bg-sidebar": "#151e32",
      "--text-primary": "#f8fafc",
      "--text-muted": "#94a3b8",
      "--border-default": "#26354f",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  midnightCyber: {
    id: "midnightCyber",
    name: "Midnight Cyber OLED",
    nameAr: "أسود أوليد ليلي مستقبلي (Cyber OLED)",
    tagAr: "شاشات الكوكت والعرض الليلي فائق التباين",
    badge: "OLED Night",
    preview: "#06b6d4",
    vars: {
      "--brand-primary": "#0891b2",
      "--brand-primary-hover": "#0e7490",
      "--brand-secondary": "#2563eb",
      "--brand-accent": "#22d3ee",
      "--brand-gradient": "linear-gradient(135deg, #0891b2 0%, #2563eb 100%)",
      "--bg-app": "#f8fafc",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#0f172a",
      "--text-muted": "#64748b",
      "--border-default": "#e2e8f0",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(8, 145, 178, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--brand-primary": "#06b6d4",
      "--brand-primary-hover": "#22d3ee",
      "--brand-secondary": "#3b82f6",
      "--brand-accent": "#67e8f9",
      "--brand-gradient": "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
      "--bg-app": "#020617",
      "--bg-card": "#0b132b",
      "--bg-header": "rgba(2, 6, 23, 0.88)",
      "--bg-sidebar": "#0b132b",
      "--text-primary": "#f8fafc",
      "--text-muted": "#94a3b8",
      "--border-default": "#1e293b",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.6)",
    },
  },
  desertAmber: {
    id: "desertAmber",
    name: "Gulf Desert Amber",
    nameAr: "عنبر ورمال الصحراء (Gulf Warm Amber)",
    tagAr: "طيران الخليج والصحراء وألوان الشرق",
    badge: "Gulf Amber",
    preview: "#d97706",
    vars: {
      "--brand-primary": "#d97706",
      "--brand-primary-hover": "#b45309",
      "--brand-secondary": "#ea580c",
      "--brand-accent": "#fbbf24",
      "--brand-gradient": "linear-gradient(135deg, #d97706 0%, #ea580c 100%)",
      "--bg-app": "#fffbeb",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#451a03",
      "--text-muted": "#78716c",
      "--border-default": "#fde68a",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(217, 119, 6, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#1a1205",
      "--bg-card": "#2c1d09",
      "--bg-header": "rgba(26, 18, 5, 0.88)",
      "--bg-sidebar": "#2c1d09",
      "--text-primary": "#fef3c7",
      "--text-muted": "#fcd34d",
      "--border-default": "#543914",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  purpleRoyal: {
    id: "purpleRoyal",
    name: "Imperial Royal Violet",
    nameAr: "بنفسجي إمبراطوري فاخر (Imperial Violet)",
    tagAr: "الطيران الدبلوماسي والرئاسي الفاخر",
    badge: "Diplomatic",
    preview: "#9333ea",
    vars: {
      "--brand-primary": "#9333ea",
      "--brand-primary-hover": "#7e22ce",
      "--brand-secondary": "#c026d3",
      "--brand-accent": "#e879f9",
      "--brand-gradient": "linear-gradient(135deg, #9333ea 0%, #c026d3 100%)",
      "--bg-app": "#faf5ff",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#3b0764",
      "--text-muted": "#6b7280",
      "--border-default": "#e9d5ff",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(147, 51, 234, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#180828",
      "--bg-card": "#271040",
      "--bg-header": "rgba(24, 8, 40, 0.88)",
      "--bg-sidebar": "#271040",
      "--text-primary": "#f5f3ff",
      "--text-muted": "#d8b4fe",
      "--border-default": "#4c1d95",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
  nordicFrosted: {
    id: "nordicFrosted",
    name: "Nordic Polar Silver",
    nameAr: "نورديك فضي قطبي (Nordic Silver)",
    tagAr: "الطيران العابر للقارات والخطوط الشمالية",
    badge: "Polar Silver",
    preview: "#2563eb",
    vars: {
      "--brand-primary": "#2563eb",
      "--brand-primary-hover": "#1d4ed8",
      "--brand-secondary": "#4f46e5",
      "--brand-accent": "#60a5fa",
      "--brand-gradient": "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
      "--bg-app": "#f8fafc",
      "--bg-card": "#ffffff",
      "--bg-header": "rgba(255, 255, 255, 0.88)",
      "--bg-sidebar": "#ffffff",
      "--text-primary": "#1e293b",
      "--text-muted": "#64748b",
      "--border-default": "#e2e8f0",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07)",
      "--shadow-lg": "0 10px 25px rgba(37, 99, 235, 0.16)",
      "--radius": "12px",
    },
    darkVars: {
      "--bg-app": "#0f172a",
      "--bg-card": "#1e293b",
      "--bg-header": "rgba(15, 23, 42, 0.88)",
      "--bg-sidebar": "#1e293b",
      "--text-primary": "#f8fafc",
      "--text-muted": "#94a3b8",
      "--border-default": "#334155",
      "--shadow-lg": "0 10px 25px rgba(0, 0, 0, 0.45)",
    },
  },
};

// Aliases for backward compatibility
GLOBAL_THEMES.lightSky = GLOBAL_THEMES.aeroBlue;
GLOBAL_THEMES.aviationGreen = GLOBAL_THEMES.emeraldHorizon;
GLOBAL_THEMES.crimsonRed = GLOBAL_THEMES.crimsonFlagship;

export const DEFAULT_GLOBAL_THEME = "modern";

/* ⭐ PORTAL_THEMES = GLOBAL_THEMES (للتوافق) */
export const PORTAL_THEMES = GLOBAL_THEMES;

export const DEFAULT_PORTAL_THEME = DEFAULT_GLOBAL_THEME;

export const getGlobalTheme = (themeId) => {
  if (!themeId) return GLOBAL_THEMES[DEFAULT_GLOBAL_THEME];
  const legacyAliases = {
    lightSky: "aeroBlue",
    aviationGreen: "emeraldHorizon",
    crimsonRed: "crimsonFlagship",
  };
  const resolved = legacyAliases[themeId] || themeId;
  return GLOBAL_THEMES[resolved] || GLOBAL_THEMES[DEFAULT_GLOBAL_THEME];
};

export const getPortalTheme = (themeId) => getGlobalTheme(themeId);

