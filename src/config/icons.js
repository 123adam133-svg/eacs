/* ═══════════════════════════════════════════════════════════
 * ICON MAP — Lucide Icons (Optional)
 * v1.0 — خريطة شاملة لكل الأيقونات في المنظومة
 *
 * الاستخدام:
 *   import { FLIGHT_TYPE_ICONS, getAircraftStatusIcon } from "../config/icons";
 *
 *   // في component:
 *   const Icon = getAircraftStatusIcon(status);
 *   return <Icon className="w-4 h-4" />;
 * ═══════════════════════════════════════════════════════════ */

import {
  /* ═══ Flight Types ═══ */
  Plane,
  Users,
  Package,
  Crown,
  Briefcase,
  GraduationCap,
  ArrowRightLeft,
  Wrench,
  HeartPulse,
  Calendar,

  /* ═══ Aircraft Status ═══ */
  CheckCircle2,
  XCircle,
  CalendarClock,
  Archive,
  Bookmark,
  Ban,
  Send,
  AlertOctagon,
  Radar,

  /* ═══ Crew Roles ═══ */
  UserCog,
  User,
  Eye,
  Award,
  UserRound,
  Shield,
  ClipboardList,
  ShieldCheck,

  /* ═══ General ═══ */
  AlertTriangle,
  Info,
  Lock,
  FileText,
  Mail,
  MessageCircle,
  BarChart3,
  Search,
  Plus,
  Edit,
  Trash2,
  Save,
  Printer,
  Download,
  Upload,
  Clock,
  ShieldCheck as CamoIcon,
  DoorOpen,
  Target,
  Sparkles,
  PlaneTakeoff,
  PlaneLanding,
  Settings,
  Filter,
  Image as ImageIcon,
  FileSignature,
  UtensilsCrossed,
  TrendingUp,
  BookOpen,
  Star,
  Check,
  X,

  /* ═══ Training ═══ */
  Monitor,
  Repeat,
  Activity,

  /* ═══ Leave ═══ */
  Palmtree,
  Heart,
  Baby,
  Book,
  Umbrella,

  /* ═══ Standby ═══ */
  Home,
  Building2,
  Bell,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
 * 1. FLIGHT TYPES
 * ═══════════════════════════════════════════════════════════ */
export const FLIGHT_TYPE_ICONS = {
  SCHEDULED: Calendar,
  PAX: Users,
  CARGO: Package,
  VIP: Crown,
  CHARTER: Briefcase,
  TRAINING: GraduationCap,
  POSITIONING: ArrowRightLeft,
  MAINTENANCE: Wrench,
  AMBULANCE: HeartPulse,
};

export const getFlightTypeIcon = (key) => FLIGHT_TYPE_ICONS[key] || Plane;

/* ═══════════════════════════════════════════════════════════
 * 2. AIRCRAFT STATUS
 * ═══════════════════════════════════════════════════════════ */
export const AIRCRAFT_STATUS_ICONS = {
  AIRWORTHY: CheckCircle2,
  MAINTENANCE: Wrench,
  AOG: AlertOctagon,
  INSPECTION_DUE: CalendarClock,
  STORED: Archive,
  IN_FLIGHT: Radar,
  RESERVED: Bookmark,
  RETIRED: Ban,
  LEASED_OUT: Send,
  GROUNDED: XCircle,
};

export const getAircraftStatusIcon = (key) =>
  AIRCRAFT_STATUS_ICONS[key] || Plane;

/* ═══════════════════════════════════════════════════════════
 * 3. CREW ROLES
 * ═══════════════════════════════════════════════════════════ */
export const CREW_ROLE_ICONS = {
  captain: UserCog,
  firstOfficer: User,
  observer: Eye,
  tri: Award,
  flightAttendant: UserRound,
  fa1: UserRound,
  fa2: UserRound,
  engineer: Wrench,
  security: Shield,
  loadmaster: Package,
  flightDispatcher: ClipboardList,
  dispatcher: ClipboardList,
};

export const getCrewRoleIcon = (role) => CREW_ROLE_ICONS[role] || User;

/* ═══════════════════════════════════════════════════════════
 * 4. TRAINING TYPES
 * ═══════════════════════════════════════════════════════════ */
export const TRAINING_TYPE_ICONS = {
  SIMULATOR: Monitor,
  LINE_CHECK: PlaneTakeoff,
  CRM: Users,
  DG: AlertTriangle,
  SEP: ShieldCheck,
  FIRST_AID: HeartPulse,
  RECURRENT: Repeat,
  TYPE_RATING: Award,
  MEDICAL: Activity,
  LPC: FileSignature,
  OPC: CheckCircle2,
};

export const getTrainingTypeIcon = (key) =>
  TRAINING_TYPE_ICONS[key] || BookOpen;

/* ═══════════════════════════════════════════════════════════
 * 5. LEAVE TYPES
 * ═══════════════════════════════════════════════════════════ */
export const LEAVE_TYPE_ICONS = {
  ANNUAL: Palmtree,
  SICK: Activity,
  MEDICAL: HeartPulse,
  MATERNITY: Baby,
  PATERNITY: Baby,
  UNPAID: Briefcase,
  COMPASSIONATE: Heart,
  STUDY: Book,
  HAJJ: Umbrella,
  EMERGENCY: AlertTriangle,
};

export const getLeaveTypeIcon = (key) => LEAVE_TYPE_ICONS[key] || Umbrella;

/* ═══════════════════════════════════════════════════════════
 * 6. STANDBY TYPES
 * ═══════════════════════════════════════════════════════════ */
export const STANDBY_TYPE_ICONS = {
  AIRPORT: Building2,
  HOME: Home,
  HOTEL: Building2,
  RESERVE: Clock,
  CALL_OUT: Bell,
};

export const getStandbyTypeIcon = (key) => STANDBY_TYPE_ICONS[key] || Clock;

/* ═══════════════════════════════════════════════════════════
 * 7. ROSTER TYPES
 * ═══════════════════════════════════════════════════════════ */
export const ROSTER_TYPE_ICONS = {
  FLIGHT: Plane,
  STANDBY: Clock,
  OFF: Palmtree,
  LEAVE: Umbrella,
  TRAINING: GraduationCap,
  SICK: Activity,
};

export const getRosterTypeIcon = (key) => ROSTER_TYPE_ICONS[key] || Calendar;

/* ═══════════════════════════════════════════════════════════
 * 8. AUDIT ACTIONS
 * ═══════════════════════════════════════════════════════════ */
export const AUDIT_ACTION_ICONS = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  LOGIN: Lock,
  LOGOUT: DoorOpen,
  LOGIN_FAILED: XCircle,
};

export const getAuditActionIcon = (key) => AUDIT_ACTION_ICONS[key] || Info;

/* ═══════════════════════════════════════════════════════════
 * 9. MODULES
 * ═══════════════════════════════════════════════════════════ */
export const MODULE_ICONS = {
  dashboard: BarChart3,
  schedule: Calendar,
  ftl: Clock,
  reports: BarChart3,
  roster: Calendar,
  standby: Clock,
  leave: Umbrella,
  training: GraduationCap,
  tracking: Radar,
  charts: TrendingUp,
  fleet: Plane,
  crew: Users,
  camo: CamoIcon,
  permits: FileSignature,
  catering: UtensilsCrossed,
  manuals: BookOpen,
  settings: Settings,
};

export const getModuleIcon = (key) => MODULE_ICONS[key] || Settings;

/* ═══════════════════════════════════════════════════════════
 * 10. GENERAL ICONS (للأزرار والحالات)
 * ═══════════════════════════════════════════════════════════ */
export const GENERAL_ICONS = {
  // الحالات
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
  info: Info,

  // الأزرار
  add: Plus,
  edit: Edit,
  delete: Trash2,
  save: Save,
  print: Printer,
  download: Download,
  upload: Upload,
  search: Search,
  filter: Filter,
  close: X,
  check: Check,

  // الاتصال
  email: Mail,
  whatsapp: MessageCircle,

  // المستخدم
  user: User,
  users: Users,
  lock: Lock,

  // الملفات
  file: FileText,
  image: ImageIcon,
  notes: FileText,
  paperclip: FileText,

  // الأوقات
  time: Clock,
  date: Calendar,

  // الطيران
  takeoff: PlaneTakeoff,
  landing: PlaneLanding,
  plane: Plane,
  radar: Radar,

  // أخرى
  target: Target,
  sparkles: Sparkles,
  star: Star,
  settings: Settings,
  manual: BookOpen,
  signature: FileSignature,
  catering: UtensilsCrossed,
  camo: CamoIcon,
};

export const getGeneralIcon = (key) => GENERAL_ICONS[key] || Info;

/* ═══════════════════════════════════════════════════════════
 * 11. HELPERS — تحويل الإيموجي إلى Lucide (اختياري)
 * ═══════════════════════════════════════════════════════════ */
export const EMOJI_TO_LUCIDE = {
  "📅": Calendar,
  "👥": Users,
  "📦": Package,
  "👑": Crown,
  "🎫": Briefcase,
  "🎓": GraduationCap,
  "✈️": Plane,
  "🔧": Wrench,
  "🚑": HeartPulse,
  "✅": CheckCircle2,
  "🚨": AlertOctagon,
  "📆": CalendarClock,
  "🗄️": Archive,
  "🔒": Lock,
  "🚫": Ban,
  "📤": Send,
  "⛔": XCircle,
  "🛰️": Radar,
  "👨‍✈️": UserCog,
  "👩‍✈️": UserRound,
  "👁️": Eye,
  "🛡️": Shield,
  "📋": ClipboardList,
  "⚠️": AlertTriangle,
  "❌": XCircle,
  "ℹ️": Info,
  "📧": Mail,
  "💬": MessageCircle,
  "📊": BarChart3,
  "🔍": Search,
  "➕": Plus,
  "✏️": Edit,
  "🗑️": Trash2,
  "💾": Save,
  "🖨️": Printer,
  "📥": Download,
  "🕐": Clock,
  "🎯": Target,
  "✨": Sparkles,
  "⭐": Star,
  "✓": Check,
  "✕": X,
  "📝": FileText,
  "📖": BookOpen,
  "📜": FileSignature,
  "🍽️": UtensilsCrossed,
};

/**
 * تحويل إيموجي إلى Lucide Component
 * @param {string} emoji — الإيموجي
 * @param {any} fallback — إذا لم يوجد
 * @returns {any}
 */
export const emojiToLucide = (emoji, fallback = Info) =>
  EMOJI_TO_LUCIDE[emoji] || fallback;

/* ═══════════════════════════════════════════════════════════
 * DEFAULT EXPORT — خريطة موحدة
 * ═══════════════════════════════════════════════════════════ */
export default {
  FLIGHT_TYPE_ICONS,
  AIRCRAFT_STATUS_ICONS,
  CREW_ROLE_ICONS,
  TRAINING_TYPE_ICONS,
  LEAVE_TYPE_ICONS,
  STANDBY_TYPE_ICONS,
  ROSTER_TYPE_ICONS,
  AUDIT_ACTION_ICONS,
  MODULE_ICONS,
  GENERAL_ICONS,
  EMOJI_TO_LUCIDE,

  getFlightTypeIcon,
  getAircraftStatusIcon,
  getCrewRoleIcon,
  getTrainingTypeIcon,
  getLeaveTypeIcon,
  getStandbyTypeIcon,
  getRosterTypeIcon,
  getAuditActionIcon,
  getModuleIcon,
  getGeneralIcon,
  emojiToLucide,
};
