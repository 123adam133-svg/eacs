/* ═══════════════════════════════════════════════════════════
 * SETTINGS MODULE — Theme-aware (CSS Variables) + Modern Design
 * v9.0 — FINAL: Country + CAMO/Permits/Catering + navLayout fix
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Camera,
  Upload,
  Save,
  Lock,
  Plane,
  Settings as SettingsIcon,
  Users as UsersIcon,
  Key,
  Shield,
  FileText,
  MessageCircle,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Hash,
  Layout,
  PanelLeft,
  LayoutDashboard,
  Calendar,
  Clock,
  BarChart3,
  CalendarDays,
  Zap,
  Plane as PlaneIcon,
  GraduationCap,
  Navigation,
  Users,
  Sparkles,
  Image as ImageIcon,
  Mail,
  ListChecks,
  Palette,
  Globe,
  Check,
  ShieldCheck,
  FileSignature,
  UtensilsCrossed,
  Gauge,
  Search,
  X,
  SlidersHorizontal,
  Menu,
  Layers,
  CheckCircle2,
  Folder,
  Briefcase,
  Boxes,
  Grid,
  Compass,
  Sliders,
  Package,
  Wrench,
  Bookmark,
  Star,
  Activity,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  BookOpen,
  Phone,
  PhoneCall,
  MapPin,
  ShieldAlert,
  MousePointer,
  User,
  Sun,
  Moon,
  FileDown,
  Eye,
  XCircle,
  AlertTriangle,
  Siren,
  Radio,
} from "lucide-react";
import { generateSystemGuidePdf } from "../utils/systemGuidePdf";

const CUSTOM_MENU_ICON_OPTIONS = [
  { id: "Layers", label: "طبقات / Layers" },
  { id: "Folder", label: "مجلد / Folder" },
  { id: "Briefcase", label: "حقيبة أعمال / Briefcase" },
  { id: "Boxes", label: "صناديق / Boxes" },
  { id: "Grid", label: "شبكة / Grid" },
  { id: "Compass", label: "بوصلة / Compass" },
  { id: "Sliders", label: "تحكم / Sliders" },
  { id: "Globe", label: "عالمي / Globe" },
  { id: "Package", label: "طرد / Package" },
  { id: "Wrench", label: "صيانة / Wrench" },
  { id: "Bookmark", label: "إشارة / Bookmark" },
  { id: "Star", label: "نجمة / Star" },
  { id: "Shield", label: "أمان / Shield" },
  { id: "Activity", label: "نشاط / Activity" },
  { id: "FileText", label: "ملفات / Documents" },
  { id: "Plane", label: "طيران / Aviation" },
];

const MENU_ICON_COMPONENTS = {
  Layers,
  Folder,
  Briefcase,
  Boxes,
  Grid,
  Compass,
  Sliders,
  Globe,
  Package,
  Wrench,
  Bookmark,
  Star,
  Shield,
  Activity,
  FileText,
  Plane,
  MoreHorizontal,
};

function getMenuIconComponent(iconName) {
  return MENU_ICON_COMPONENTS[iconName] || Layers;
}

import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { settingsAPI, uploadFile, toDisplayImageUrl } from "../api";
import { can as checkPerm } from "../config/permissions";
import { SOUND_TYPES, testSound } from "../utils/sounds";
import { useSounds } from "../hooks/useSounds";
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestBrowserNotificationPermission,
  testNotificationSystem,
  getNotificationHistory,
  clearNotificationHistory,
} from "../utils/notifications";
import {
  GLOBAL_THEMES,
  DEFAULT_GLOBAL_THEME,
  DEFAULT_PORTAL_THEME,
  getGlobalTheme,
} from "../config/constants";

/* ⭐ Modules */
import { UsersModule } from "./UsersModule";
import { RolesModule } from "./RolesModule";
import { LoginHistoryModule } from "./LoginHistoryModule";
import { AuditLogModule } from "./AuditLogModule";
import { WhatsAppModule } from "./WhatsAppModule";
import { EmailModule } from "./EmailModule";
import { PositionsSettingsTab } from "./PositionsSettingsTab";
import { PermissionsModule } from "./PermissionsModule";
import { WhatsAppSettingsTab } from "./WhatsAppSettingsTab";
import { FlightSettingsTab } from "./FlightSettingsTab";
import { AirportsManagementTab } from "./AirportsManagementTab";
import { DashboardSettingsTab } from "./DashboardSettingsTab";
import {
  getHeaderToolsConfig,
  saveHeaderToolsConfig,
  moveHeaderToolUp,
  moveHeaderToolDown,
  toggleHeaderToolDirect,
} from "../utils/headerToolsConfig";
import {
  DEFAULT_CREW_CARD_CONFIG,
  CREW_CARD_SIZE_MAP,
  getCrewContactCardConfig,
  saveCrewContactCardConfig,
  CrewContactCard,
} from "../components/CrewContactCard";
import {
  DEFAULT_AIRPORT_CARD_CONFIG,
  AIRPORT_CARD_SIZE_MAP,
  getAirportCardConfig,
  saveAirportCardConfig,
  AirportHoverCard,
} from "../components/AirportHoverCard";
import {
  SCHEDULE_DESIGNS,
  DEFAULT_SCHEDULE_DESIGN,
  SCHEDULE_DESIGN_EVENT,
  getScheduleDesign,
  applyScheduleDesign,
} from "../utils/scheduleDesigns";
import {
  DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS,
  getFlightContextMenuConfig,
  saveFlightContextMenuConfig,
  FLIGHT_CONTEXT_MENU_EVENT,
} from "../utils/flightContextMenuConfig";
import {
  listOperationalFormsSync,
  fetchOperationalForms,
  saveOperationalForm,
} from "../utils/operationalFormsService";
import { SmartDocumentScannerModal } from "../components/SmartDocumentScannerModal";

/* ═══ Settings Categories & Grouping ═══ */
export const SETTINGS_CATEGORIES = [
  {
    id: "system",
    label_ar: "النظام والمظهر واللوحات",
    label_en: "System, Themes & Boards",
    desc_ar: "بيانات الشركة، الشعار والختم، الثيمات الموحدة، تخصيص وتسمية اللوحات، والأصوات",
    desc_en: "Company identity, unified themes, dashboards builder & naming, and audio alerts",
    icon: Palette,
    tabIds: ["general", "appearance", "dashboards", "sounds"],
  },
  {
    id: "personnel",
    label_ar: "الكادر والصلاحيات",
    label_en: "Personnel & Access",
    desc_ar: "إدارة المستخدمين، الأدوار، المسميات الوظيفية للطواقم، ومصفوفة الصلاحيات",
    desc_en: "User accounts, roles, aviation crew positions, and permission matrix",
    icon: UsersIcon,
    tabIds: ["users", "roles", "positions", "permissions"],
  },
  {
    id: "comms",
    label_ar: "الاتصالات والرسائل",
    label_en: "Communications",
    desc_ar: "خوادم البريد الإلكتروني، إرسال واتساب المباشر، وتهيئة مفاتيح الربط",
    desc_en: "SMTP/IMAP email, WhatsApp messenger, and API credentials",
    icon: MessageCircle,
    tabIds: ["email", "whatsapp", "whatsappSettings"],
  },
  {
    id: "security",
    label_ar: "الأمان والرقابة",
    label_en: "Security & Audit",
    desc_ar: "سجل تتبع جلسات الدخول وعناوين IP وسجل التدقيق والامتثال العملياتي",
    desc_en: "Login tracking, IP sessions, and operational compliance audit log",
    icon: Shield,
    tabIds: ["login-history", "audit-log"],
  },
  {
    id: "operations",
    label_ar: "العمليات والرحلات",
    label_en: "Operations & Flights",
    desc_ar: "أوضاع وحالات الطائرات المخصصة في جدول الرحلات وإدارة وتحديث قاعدة بيانات المطارات",
    desc_en: "Custom aircraft statuses, flight indicators, and aerodrome airport database",
    icon: Plane,
    tabIds: ["flight-settings", "airports"],
  },
];

/* ═══ Crew Portal Custom Tab Icons Config ═══ */
const PORTAL_TABS_CUSTOM_CONFIG = [
  {
    id: "home",
    label_ar: "الرئيسية",
    label_en: "Home",
    defaultIcon: "Home",
    options: ["Home", "Compass", "Gauge", "LayoutDashboard", "Sparkles"],
  },
  {
    id: "schedule",
    label_ar: "جدولي",
    label_en: "My Schedule",
    defaultIcon: "Calendar",
    options: ["Calendar", "CalendarDays", "Clock", "List", "Layout"],
  },
  {
    id: "completed-flights",
    label_ar: "الرحلات المكتملة",
    label_en: "Completed Flights",
    defaultIcon: "CheckCircle2",
    options: ["CheckCircle2", "ShieldCheck", "FileSignature", "BadgeCheck", "Award"],
  },
  {
    id: "catering",
    label_ar: "التموين",
    label_en: "Catering",
    defaultIcon: "UtensilsCrossed",
    options: ["UtensilsCrossed", "Coffee", "Package", "Boxes", "ShoppingBag"],
  },
  {
    id: "aircraft-status",
    label_ar: "حالة طائرتي",
    label_en: "My Aircraft",
    defaultIcon: "Plane",
    options: ["Plane", "Wrench", "Activity", "Gauge", "Navigation"],
  },
  {
    id: "certificates",
    label_ar: "الشهادات والمرفقات",
    label_en: "Certificates",
    defaultIcon: "Award",
    options: ["Award", "FileText", "BadgeCheck", "Shield", "GraduationCap"],
  },
  {
    id: "ftl",
    label_ar: "FTL وساعات الخدمة",
    label_en: "FTL & Duty Limits",
    defaultIcon: "Clock",
    options: ["Clock", "Timer", "Hourglass", "Activity", "Bell"],
  },
  {
    id: "manuals",
    label_ar: "الأدلة والمراجع",
    label_en: "Manuals",
    defaultIcon: "BookOpen",
    options: ["BookOpen", "Book", "FileText", "Folder", "Bookmark"],
  },
  {
    id: "hours",
    label_ar: "ساعاتي",
    label_en: "My Hours",
    defaultIcon: "TrendingUp",
    options: ["TrendingUp", "BarChart3", "Activity", "Zap", "Layers"],
  },
  {
    id: "operations",
    label_ar: "العمليات السريعة",
    label_en: "Quick Operations",
    defaultIcon: "PlaneTakeoff",
    options: ["PlaneTakeoff", "Plane", "Navigation", "Zap", "Layers"],
  },
  {
    id: "flight-forms",
    label_ar: "النماذج والجي دي",
    label_en: "Forms & GD",
    defaultIcon: "FileCheck2",
    options: ["FileCheck2", "FileText", "FileSignature", "ShieldCheck", "Bookmark"],
  },
  {
    id: "journey-log",
    label_ar: "سجل الرحلة (Journey Log)",
    label_en: "Journey Log (24H)",
    defaultIcon: "ClipboardCheck",
    options: ["ClipboardCheck", "CheckCircle2", "Clock", "FileText", "Activity"],
  },
];

/* ═══ Categorized Tabs ═══ */
const TABS = [
  {
    id: "general",
    categoryId: "system",
    icon: SettingsIcon,
    label_en: "General & Identity",
    label_ar: "عام والهوية",
    subLabel_ar: "اسم الشركة، الشعار والختم، رمز المشغل، ونظام الوقت",
    subLabel_en: "Company details, logo, stamp, operator code & time system",
    perm: "settings.general_view",
    keywords: ["general", "company", "logo", "stamp", "operator", "time", "عام", "شعار", "ختم", "مشغل", "وقت", "لغة", "دولة"],
  },
  {
    id: "appearance",
    categoryId: "system",
    icon: Palette,
    label_en: "Appearance & Themes",
    label_ar: "المظهر والثيمات",
    subLabel_ar: "أنماط المنظومة وبوابة الطاقم، تخطيط التنقل، وتفضيلات التبويبات",
    subLabel_en: "System & crew portal themes, navigation layout & tab preferences",
    perm: "settings.appearance_view",
    keywords: ["appearance", "theme", "colors", "portal", "layout", "tabs", "مظهر", "ثيم", "انماط", "الوان", "بورتال", "كرو", "قوائم", "شريط"],
  },
  {
    id: "dashboards",
    categoryId: "system",
    icon: LayoutDashboard,
    label_en: "Dashboards & Layout",
    label_ar: "تخصيص وتسمية اللوحات",
    subLabel_ar: "إنشاء وتسمية كل لوحة تحكم على حدة وتحديد صلاحياتها وبطاقاتها للعرض في الداشبورد",
    subLabel_en: "Create, name, assign permissions, and customize dashboard cards from Settings",
    perm: [
      "settings.dashboards_manage",
      "dashboard.manage_named",
      "quality.manage_dashboards",
      "camo.manage_dashboards",
      "training.manage_dashboards",
      "users.perms",
    ],
    keywords: ["dashboard", "dashboards", "widgets", "layout", "cards", "boards", "داشبورد", "لوحة", "لوحات", "بطاقات", "تخصيص", "تسمية"],
  },
  {
    id: "sounds",
    categoryId: "system",
    icon: Volume2,
    label_en: "Sounds & Alerts",
    label_ar: "الأصوات والإشعارات",
    subLabel_ar: "أصوات المنظومة التفاعلية، نغمات التنبيه، وإشعارات سطح المكتب",
    subLabel_en: "System audio feedback, alert chimes & desktop push alerts",
    perm: "settings.sounds_view",
    keywords: ["sounds", "audio", "notifications", "alerts", "push", "volume", "اصوات", "تنبيهات", "اشعارات", "نغمات", "صوت"],
  },
  {
    id: "users",
    categoryId: "personnel",
    icon: UsersIcon,
    label_en: "Users",
    label_ar: "المستخدمون",
    subLabel_ar: "إدارة حسابات مستخدمي النظام وربطهم بالكادر",
    subLabel_en: "System user credentials, link to crew & account status",
    perm: "users.view",
    keywords: ["users", "accounts", "passwords", "crew", "مستخدمين", "حسابات", "كلمات المرور", "كادر"],
  },
  {
    id: "roles",
    categoryId: "personnel",
    icon: Key,
    label_en: "Roles & Groups",
    label_ar: "الأدوار والمجموعات",
    subLabel_ar: "تعريف الأدوار التنظيمية ومجموعات الصلاحيات",
    subLabel_en: "Define operational roles and permission group tiers",
    perm: "users.view",
    keywords: ["roles", "groups", "admin", "dispatcher", "ادوار", "مجموعات", "مشرفين"],
  },
  {
    id: "positions",
    categoryId: "personnel",
    icon: ListChecks,
    label_en: "Aviation Positions",
    label_ar: "الوظائف والمسميات",
    subLabel_ar: "مسميات الطواقم والكادر الجوي والأرضي (CPT, FO, FA...)",
    subLabel_en: "Cockpit, cabin & ground crew designations and ranks",
    perm: "settings.positions_view",
    keywords: ["positions", "captain", "crew", "dispatch", "fa", "fo", "وظائف", "مسميات", "كابتن", "مساعد", "ضيافة", "مهندس"],
  },
  {
    id: "permissions",
    categoryId: "personnel",
    icon: ShieldCheck,
    label_en: "Permissions Matrix",
    label_ar: "مصفوفة الصلاحيات",
    subLabel_ar: "التحكم التفصيلي في صلاحيات كل دور في المنظومة",
    subLabel_en: "Granular access control and permission toggles per role",
    perm: "users.perms",
    keywords: ["permissions", "matrix", "access", "control", "صلاحيات", "مصفوفة", "تحكم"],
  },
  {
    id: "email",
    categoryId: "comms",
    icon: Mail,
    label_en: "Email Accounts",
    label_ar: "البريد الإلكتروني",
    subLabel_ar: "ربط خوادم SMTP/IMAP لإرسال تنبيهات الرحلات والتقارير",
    subLabel_en: "Configure SMTP/IMAP servers for automated dispatches",
    perm: "email.view",
    keywords: ["email", "smtp", "imap", "mail", "بريد", "ايميل", "خادم", "رسائل"],
  },
  {
    id: "whatsapp",
    categoryId: "comms",
    icon: MessageCircle,
    label_en: "WhatsApp Portal",
    label_ar: "بوابة واتساب",
    subLabel_ar: "إرسال الجداول والرسائل المباشرة عبر واتساب للطاقم",
    subLabel_en: "Send rosters and instant dispatch messages to crew",
    perm: "whatsapp.view",
    keywords: ["whatsapp", "chat", "messages", "portal", "واتساب", "شات", "رسائل", "بوابة"],
  },
  {
    id: "whatsappSettings",
    categoryId: "comms",
    icon: MessageCircle,
    label_en: "WhatsApp Settings",
    label_ar: "إعدادات ربط واتساب",
    subLabel_ar: "تهيئة مزودي خدمة WhatsApp API والمفاتيح",
    subLabel_en: "API providers, gateway tokens and webhook endpoints",
    perm: "settings.edit",
    keywords: ["whatsapp", "api", "token", "webhook", "ربط", "مفتاح", "اعدادات واتساب"],
  },
  {
    id: "login-history",
    categoryId: "security",
    icon: Shield,
    label_en: "Login History",
    label_ar: "سجل تسجيلات الدخول",
    subLabel_ar: "مراقبة جلسات الدخول وعناوين IP للمستخدمين",
    subLabel_en: "Monitor sign-in attempts, active IP addresses & devices",
    perm: "security.login_history",
    keywords: ["login", "history", "security", "ip", "session", "دخول", "سجل", "جلسات", "امان"],
  },
  {
    id: "audit-log",
    categoryId: "security",
    icon: FileText,
    label_en: "Audit Log",
    label_ar: "سجل النشاطات والتدقيق",
    subLabel_ar: "سجل تتبع التعديلات والعمليات الحساسة في المنظومة",
    subLabel_en: "Compliance audit trail of flight & user modifications",
    perm: "security.audit_log",
    keywords: ["audit", "log", "compliance", "history", "تدقيق", "نشاطات", "سجل التعديلات"],
  },
  {
    id: "flight-settings",
    categoryId: "operations",
    icon: Plane,
    label_en: "Flight & A/C Statuses",
    label_ar: "أوضاع الرحلات والطائرات",
    subLabel_ar: "تخصيص وإضافة أوضاع الطائرات وحالات الرحلات في شريط الرحلات",
    subLabel_en: "Customize aircraft statuses and flight badges in schedule board",
    perm: ["settings.flight_statuses_manage", "settings.general_edit"],
    keywords: ["flight", "status", "aircraft", "a/c", "board", "رحلات", "اوضاع", "طائرة", "حالات"],
  },
  {
    id: "airports",
    categoryId: "operations",
    icon: Compass,
    label_en: "Airports Database",
    label_ar: "قاعدة بيانات المطارات",
    subLabel_ar: "إدارة وتحديث بيانات المطارات والمدارج وإضافة مطارات غير مدرجة",
    subLabel_en: "Manage aerodromes, runways, elevation & add custom airports",
    perm: ["settings.airports_manage", "settings.general_edit"],
    keywords: ["airports", "icao", "iata", "runways", "elevation", "aerodromes", "مطارات", "مدارج", "ايكاو", "احداثيات", "ملاحة"],
  },
];

/* ═══ ALL TABS CONFIG ═══ */
const ALL_TABS_CONFIG = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label_en: "Dashboard",
    label_ar: "الرئيسية",
    perm: "schedule.view",
  },
  {
    id: "schedule",
    icon: Calendar,
    label_en: "Schedule",
    label_ar: "الجدول",
    perm: "schedule.view",
  },
  {
    id: "ftl",
    icon: Clock,
    label_en: "FTL",
    label_ar: "ساعات الطيران",
    perm: "ftl.view",
  },
  {
    id: "reports",
    icon: BarChart3,
    label_en: "Reports & Analytics",
    label_ar: "التقارير والإحصائيات",
    perm: "reports.view",
  },
  {
    id: "documents",
    icon: FileText,
    label_en: "Documents",
    label_ar: "الوثائق المركزية",
    perm: "documents.view",
  },
  {
    id: "manuals",
    icon: BookOpen,
    label_en: "Manuals",
    label_ar: "الأدلة والمراجع",
    perm: "schedule.view",
  },
  {
    id: "quality_dashboard",
    icon: Gauge,
    label_en: "Quality Dashboard",
    label_ar: "لوحة الجودة",
    perm: "quality.view",
  },
  {
    id: "roster",
    icon: CalendarDays,
    label_en: "Roster & Planning",
    label_ar: "الجداول والمناوبات والراحات",
    perm: "roster.view",
  },
  {
    id: "training",
    icon: GraduationCap,
    label_en: "Training",
    label_ar: "التدريب",
    perm: "training.view",
  },
  {
    id: "tracking",
    icon: Navigation,
    label_en: "Flight Following",
    label_ar: "متابعة الرحلات",
    perm: "tracking.view",
  },
  {
    id: "fleet",
    icon: Plane,
    label_en: "Fleet",
    label_ar: "الأسطول",
    perm: "fleet.view",
  },
  {
    id: "crew",
    icon: Users,
    label_en: "Crew",
    label_ar: "الطاقم",
    perm: "crew.view",
  },
  {
    id: "camo",
    icon: ShieldCheck,
    label_en: "CAMO",
    label_ar: "إدارة الصلاحية",
    perm: "camo.view",
  },
  {
    id: "permits",
    icon: FileSignature,
    label_en: "Permits & Forms",
    label_ar: "التصاريح والنماذج",
    perm: "permits.view",
  },
  {
    id: "catering",
    icon: UtensilsCrossed,
    label_en: "Catering",
    label_ar: "التموين",
    perm: "catering.view",
  },
  {
    id: "settings",
    icon: SettingsIcon,
    label_en: "Settings",
    label_ar: "الإعدادات",
    perm: "settings.view",
  },
];

/* ═══ DEFAULT TAB PREFERENCES ═══ */
const DEFAULT_TAB_PREFERENCES = {
  dashboard: "primary",
  schedule: "primary",
  ftl: "primary",
  reports: "primary",
  documents: "primary",
  quality_dashboard: "more",
  roster: "more",
  training: "more",
  tracking: "more",
  fleet: "more",
  crew: "more",
  camo: "more",
  permits: "more",
  catering: "more",
  manuals: "more",
  settings: "more",
};

function logoToDisplayUrl(url) {
  return toDisplayImageUrl(url);
}

/* ═══════════════════════════════════════════════════════════
 * MAIN MODULE
 * ═══════════════════════════════════════════════════════════ */
export function SettingsModule({
  settings,
  setSettings,
  lang,
  setLang,
  users = [],
  setUsers,
  roles = [],
  setRoles,
  loginHistory = [],
  setLoginHistory,
  auditLogs = [],
  setAuditLogs,
  crew = [],
  flights = [],
  fleet = [],
  camoList = [],
  melList = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  setTab,
  initialSubTab,
  setSyncStatus,
}) {
  const t = useT();
  const { user } = useAuth();
  const langCode = document.documentElement.lang || "en";
  const isAr = langCode === "ar";
  const [searchQuery, setSearchQuery] = useState("");

  const hasSettingPerm = useCallback(
    (perm) =>
      Array.isArray(perm)
        ? perm.some((p) => checkPerm(user, p))
        : checkPerm(user, perm),
    [user]
  );

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => hasSettingPerm(tab.perm)),
    [hasSettingPerm]
  );

  const [activeTab, setActiveTab] = useState(() => {
    if (initialSubTab && TABS.some((tb) => tb.id === initialSubTab)) {
      return initialSubTab;
    }
    return "general";
  });

  // Determine which category the current activeTab belongs to
  const currentTabObj = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0];
  const [selectedCategory, setSelectedCategory] = useState(
    () => currentTabObj?.categoryId || "system"
  );

  useEffect(() => {
    if (initialSubTab && visibleTabs.some((tb) => tb.id === initialSubTab)) {
      setActiveTab(initialSubTab);
      const tabObj = visibleTabs.find((tb) => tb.id === initialSubTab);
      if (tabObj?.categoryId) {
        setSelectedCategory(tabObj.categoryId);
      }
    }
  }, [initialSubTab, visibleTabs]);

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "general");
    }
  }, [user, visibleTabs, activeTab]);

  // Keep selectedCategory synced with activeTab
  useEffect(() => {
    const tabObj = visibleTabs.find((t) => t.id === activeTab);
    if (tabObj?.categoryId && tabObj.categoryId !== selectedCategory) {
      setSelectedCategory(tabObj.categoryId);
    }
  }, [activeTab]);

  // Accessible categories with visible tabs
  const accessibleCategories = SETTINGS_CATEGORIES.map((cat) => {
    const tabsInCat = visibleTabs.filter((t) => cat.tabIds.includes(t.id));
    return {
      ...cat,
      tabs: tabsInCat,
      count: tabsInCat.length,
    };
  }).filter((cat) => cat.count > 0);

  // Tabs for the currently selected category
  const currentCategoryTabs = visibleTabs.filter(
    (t) => t.categoryId === selectedCategory
  );

  // Search filter across all visible tabs
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return visibleTabs.filter((tab) => {
      const matchLabel =
        (tab.label_ar && tab.label_ar.toLowerCase().includes(q)) ||
        (tab.label_en && tab.label_en.toLowerCase().includes(q));
      const matchSub =
        (tab.subLabel_ar && tab.subLabel_ar.toLowerCase().includes(q)) ||
        (tab.subLabel_en && tab.subLabel_en.toLowerCase().includes(q));
      const matchKeywords =
        Array.isArray(tab.keywords) &&
        tab.keywords.some((k) => k.toLowerCase().includes(q));
      return matchLabel || matchSub || matchKeywords;
    });
  }, [visibleTabs, searchQuery]);

  const activeThemeId =
    settings?.globalTheme || settings?.portalTheme || DEFAULT_GLOBAL_THEME;
  const activeThemeObj = getGlobalTheme(activeThemeId);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setSearchQuery("");
    const tabsInCat = visibleTabs.filter((t) => t.categoryId === catId);
    if (tabsInCat.length > 0 && !tabsInCat.some((t) => t.id === activeTab)) {
      setActiveTab(tabsInCat[0].id);
    }
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchQuery("");
    const tabObj = visibleTabs.find((t) => t.id === tabId);
    if (tabObj?.categoryId) {
      setSelectedCategory(tabObj.categoryId);
    }
  };

  const currentCategoryObj =
    SETTINGS_CATEGORIES.find((c) => c.id === selectedCategory) ||
    SETTINGS_CATEGORIES[0];

  return (
    <div className="space-y-2.5 fade-in">
      {/* ═══ Compact Header Banner ═══ */}
      <div
        className="rounded-xl px-3.5 py-2 text-white shadow-xs"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Title & Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-xs shrink-0">
              <SettingsIcon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h2 className="text-sm font-bold truncate">
                {t.settingsTitle || (isAr ? "إعدادات المنظومة" : "System Settings")}
              </h2>
              {/* Active Theme Quick Badge */}
              <button
                type="button"
                onClick={() => handleSelectTab("appearance")}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 hover:bg-white/30 backdrop-blur-xs transition cursor-pointer"
                title={isAr ? "انقر لتغيير نمط وثيم المنظومة" : "Click to change theme"}
              >
                <span
                  className="w-2 h-2 rounded-full border border-white/60"
                  style={{ backgroundColor: activeThemeObj.preview || "var(--brand-primary)" }}
                />
                <span className="truncate">
                  {isAr ? activeThemeObj.nameAr : activeThemeObj.name}
                </span>
              </button>
            </div>
          </div>

          {/* Compact Quick Search Input + PDF System Guide */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => generateSystemGuidePdf({ settings, lang, mode: "download" })}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 border border-white/30 text-white transition cursor-pointer"
              title={isAr ? "تحميل دليل ومزايا النظام الكامل (PDF)" : "Download Full System Guide & Features (PDF)"}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isAr ? "دليل النظام PDF" : "System Guide PDF"}</span>
            </button>

            <div className="relative w-44 sm:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-white/70 absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? "بحث سريع..."
                    : "Quick search..."
                }
                className="w-full bg-white/15 border border-white/30 rounded-lg py-1 ps-8 pe-6 text-xs text-white placeholder-white/65 focus:outline-none focus:ring-1 focus:ring-white/50 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
                  title={isAr ? "مسح البحث" : "Clear search"}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Search Results View (When Query Active) ═══ */}
      {searchQuery.trim() ? (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              <span>
                {isAr ? "نتائج البحث عن:" : "Search results for:"}{" "}
                <strong className="text-foreground">"{searchQuery.trim()}"</strong> (
                {searchResults.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs font-semibold text-rose-500 hover:underline"
            >
              {isAr ? "إلغاء البحث" : "Cancel search"}
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              {isAr
                ? "لم يتم العثور على إعداد مطابق."
                : "No matching setting found."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {searchResults.map((tab) => {
                const Icon = tab.icon;
                const catObj = SETTINGS_CATEGORIES.find((c) => c.id === tab.categoryId);
                const isCurrent = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(tab.id)}
                    className="p-2 rounded-lg border text-start transition flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    style={{
                      borderColor: isCurrent
                        ? "var(--brand-primary)"
                        : "var(--border-default)",
                      backgroundColor: isCurrent
                        ? "var(--bg-app)"
                        : "var(--bg-card)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isCurrent
                          ? "var(--brand-primary)"
                          : "var(--bg-app)",
                        color: isCurrent ? "#ffffff" : "var(--brand-primary)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                        {isAr ? tab.label_ar : tab.label_en}
                      </div>
                      <p className="text-[10px] truncate opacity-70" style={{ color: "var(--text-muted)" }}>
                        {isAr ? tab.subLabel_ar : tab.subLabel_en}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ═══ Compact Categorized Navigation Strip ═══ */
        <div
          className="rounded-xl p-1.5 space-y-1.5"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Category Pills (Category Switcher) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
            {accessibleCategories.map((cat) => {
              const Icon = cat.icon;
              const isCatActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isCatActive
                      ? "bg-blue-600 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isAr ? cat.label_ar : cat.label_en}</span>
                  <span className={`text-[9px] px-1 rounded-full font-mono ${
                    isCatActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-Tabs for Active Category */}
          <div className="flex flex-wrap items-center gap-1">
            {currentCategoryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white dark:bg-sky-500 dark:text-slate-950 shadow-2xs font-extrabold"
                      : "bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isAr ? tab.label_ar : tab.label_en}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Section Sub-Header / Breadcrumb Indicator ═══ */}
      {currentTabObj && (
        <div className="flex items-center justify-between px-1 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="flex items-center gap-1.5 font-medium">
            <span>{isAr ? currentCategoryObj.label_ar : currentCategoryObj.label_en}</span>
            <span>/</span>
            <span className="font-bold text-foreground">
              {isAr ? currentTabObj.label_ar : currentTabObj.label_en}
            </span>
            <span className="hidden sm:inline opacity-70">
              — {isAr ? currentTabObj.subLabel_ar : currentTabObj.subLabel_en}
            </span>
          </div>
        </div>
      )}

      {/* ═══ Tab Content ═══ */}
      <div>
        {activeTab === "general" && (
          <GeneralTab
            settings={settings}
            setSettings={setSettings}
            lang={lang}
            setLang={setLang}
            user={user}
            t={t}
          />
        )}
        {activeTab === "positions" && (
          <PositionsSettingsTab
            settings={settings}
            setSettings={setSettings}
            t={t}
            lang={langCode}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "appearance" && (
          <AppearanceTab
            settings={settings}
            setSettings={setSettings}
            lang={lang}
            user={user}
            t={t}
            flights={flights}
            fleet={fleet}
            crew={crew}
          />
        )}
        {activeTab === "dashboards" && (
          <DashboardSettingsTab
            roles={roles}
            users={users}
            flights={flights}
            crew={crew}
            fleet={fleet}
            camoList={camoList}
            melList={melList}
            leave={leave}
            roster={roster}
            standby={standby}
            training={training}
            auditLogs={auditLogs}
            loginHistory={loginHistory}
            settings={settings}
            setTab={setTab}
            lang={langCode}
          />
        )}
        {activeTab === "sounds" && <SoundsTab lang={lang} t={t} user={user} />}
        {activeTab === "email" && (
          <EmailModule
            crew={crew}
            users={users}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "users" && (
          <UsersModule
            users={users}
            setUsers={setUsers}
            roles={roles}
            lang={langCode}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "roles" && (
          <RolesModule
            roles={roles}
            setRoles={setRoles}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "login-history" && (
          <LoginHistoryModule
            loginHistory={loginHistory}
            setLoginHistory={setLoginHistory}
            currentUser={user}
          />
        )}
        {activeTab === "audit-log" && (
          <AuditLogModule auditLogs={auditLogs} setAuditLogs={setAuditLogs} />
        )}
        {activeTab === "whatsapp" && (
          <WhatsAppModule
            crew={crew}
            users={users}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "whatsappSettings" && (
          <WhatsAppSettingsTab />
        )}
        {activeTab === "permissions" && (
          <PermissionsModule
            roles={roles}
            setRoles={setRoles}
            setSyncStatus={setSyncStatus}
          />
        )}
        {activeTab === "flight-settings" && (
          <FlightSettingsTab lang={lang} t={t} user={user} />
        )}
        {activeTab === "airports" && (
          <AirportsManagementTab lang={lang} t={t} user={user} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * GENERAL TAB
 * ═══════════════════════════════════════════════════════════ */
function GeneralTab({ settings, setSettings, lang, setLang, user, t }) {
  const [draft, setDraft] = useState(settings || {});
  const [saving, setSaving] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const logoRef = useRef();

  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [stampError, setStampError] = useState(false);
  const stampRef = useRef();

  useEffect(() => {
    setDraft(settings || {});
    setLogoError(false);
    setStampError(false);
  }, [settings]);

  const editable = checkPerm(user, "settings.general_edit");
  const canUploadLogo = checkPerm(user, "settings.logo_upload");
  const canRemoveLogo = checkPerm(user, "settings.logo_remove");
  const canViewStamp = checkPerm(user, "settings.view_stamp");
  const canEditStamp = checkPerm(user, "settings.edit_stamp");

  const uploadLogo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      showToast("⚠️ الحد الأقصى 2 MB");
      if (logoRef.current) logoRef.current.value = "";
      return;
    }
    if (!f.type.startsWith("image/")) {
      showToast("⚠️ الرجاء اختيار صورة");
      if (logoRef.current) logoRef.current.value = "";
      return;
    }
    setUploadingLogo(true);
    try {
      const r = await uploadFile(f, "logos");
      if (!r || !r.fileUrl) throw new Error("لم يُرجع رابط الملف");
      const updated = { ...draft, logo: r.fileUrl };
      setDraft(updated);
      setLogoError(false);
      await settingsAPI.save({ logo: r.fileUrl });
      const fresh = await settingsAPI.get();
      setSettings(fresh || updated);
      showToast("✅ " + (t.logoUploaded || "تم رفع الشعار"));
    } catch (err) {
      showToast("❌ " + (t.failedUpload || "فشل الرفع") + "\n\n" + err.message);
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  const uploadStamp = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      showToast("⚠️ الحد الأقصى 2 MB");
      if (stampRef.current) stampRef.current.value = "";
      return;
    }
    if (!f.type.startsWith("image/")) {
      showToast("⚠️ الرجاء اختيار صورة");
      if (stampRef.current) stampRef.current.value = "";
      return;
    }
    setUploadingStamp(true);
    try {
      const r = await uploadFile(f, "stamps");
      if (!r || !r.fileUrl) throw new Error("لم يُرجع رابط الملف");
      const updated = { ...draft, stamp: r.fileUrl };
      setDraft(updated);
      setStampError(false);
      await settingsAPI.save({ stamp: r.fileUrl });
      const fresh = await settingsAPI.get();
      setSettings(fresh || updated);
      showToast("✅ تم رفع الختم");
    } catch (err) {
      showToast("❌ فشل رفع الختم\n\n" + err.message);
    } finally {
      setUploadingStamp(false);
      if (stampRef.current) stampRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const chosenTf = draft.timeFormat === "12" ? "12" : "24";
      const chosenTm = draft.timeMode === "LOCAL" ? "LOCAL" : "UTC";
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("aeroops.timeFormat", chosenTf);
          window.localStorage.setItem("aeroops.timeMode", chosenTm);
        } catch {}
        window.__AEROOPS_TIME_FORMAT = chosenTf;
        window.__AEROOPS_TIME_MODE = chosenTm;
        window.dispatchEvent(
          new CustomEvent("aeroops:timeFormatChanged", { detail: chosenTf })
        );
        window.dispatchEvent(
          new CustomEvent("aeroops:timeModeChanged", { detail: chosenTm })
        );
      }
      await settingsAPI.save({ ...draft, timeFormat: chosenTf, timeMode: chosenTm });
      const fresh = await settingsAPI.get();
      setSettings({ ...(fresh || draft), timeFormat: chosenTf, timeMode: chosenTm });
      showToast("✅ " + (t.settingsSaved || "تم الحفظ"));
    } catch (e) {
      showToast("❌ " + (t.failedSave || "فشل الحفظ") + ": " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!canRemoveLogo) return;
    if (!(await confirmAction("إزالة الشعار؟"))) return;
    const updated = { ...draft, logo: "" };
    setDraft(updated);
    setLogoError(false);
    try {
      await settingsAPI.save({ logo: "" });
      const fresh = await settingsAPI.get();
      setSettings(fresh || updated);
    } catch (e) {
      console.error(e);
    }
  };

  const removeStamp = async () => {
    if (!canEditStamp) return;
    if (!(await confirmAction("إزالة الختم؟"))) return;
    const updated = { ...draft, stamp: "" };
    setDraft(updated);
    setStampError(false);
    try {
      await settingsAPI.save({ stamp: "" });
      const fresh = await settingsAPI.get();
      setSettings(fresh || updated);
    } catch (e) {
      console.error(e);
    }
  };

  const sectionStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    boxShadow: "var(--shadow-sm)",
  };

  const isAr = lang === "ar";

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      {!editable && (
        <div className="lg:col-span-12 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* Left Column (8 cols): Company Identity & Time/Language Standards */}
      <section className="lg:col-span-8 p-4 rounded-xl space-y-3" style={sectionStyle}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
          <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
              <Globe className="w-4 h-4" />
            </div>
            <span>{isAr ? "الهوية التشغيلية والمعايير الزمنية" : "Company Identity & Operational Standards"}</span>
          </h4>
          <button
            disabled={!editable || saving}
            onClick={save}
            className="px-4 py-1.5 disabled:opacity-50 text-white rounded-lg text-xs flex items-center gap-1.5 font-bold transition hover:opacity-95 cursor-pointer"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "…" : t.saveChanges || (isAr ? "حفظ التغييرات" : "Save Changes")}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t.companyName || "Company Name (EN)"}>
            <Input
              disabled={!editable}
              value={draft.companyName || ""}
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
            />
          </Field>

          <Field label={t.companyNameAr || "Company Name (AR)"}>
            <Input
              disabled={!editable}
              value={draft.companyNameAr || ""}
              onChange={(e) => setDraft({ ...draft, companyNameAr: e.target.value })}
            />
          </Field>

          <Field label={t.operatorCode || "Operator Code"}>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Hash className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              </div>
              <Input
                disabled={!editable}
                value={draft.operatorCode || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    operatorCode: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 8),
                  })
                }
                placeholder="EACS"
                maxLength={8}
                className="pl-9 font-mono font-bold tracking-widest"
                style={{
                  letterSpacing: "2px",
                  fontSize: "14px",
                  color: "var(--brand-primary)",
                }}
              />
            </div>
          </Field>

          <Field label={t.country || (isAr ? "الدولة" : "Country")}>
            <Input
              disabled={!editable}
              value={draft.country || ""}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              placeholder="Libya / ليبيا"
            />
          </Field>

          <Field label={isAr ? "نظام عرض الساعات (12H / 24H)" : "Hour Format System (12H / 24H)"}>
            <Select
              disabled={!editable}
              value={draft.timeFormat || "24"}
              onChange={(e) => {
                const nextTf = e.target.value === "12" ? "12" : "24";
                setDraft({ ...draft, timeFormat: nextTf });
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.setItem("aeroops.timeFormat", nextTf);
                  } catch {}
                  window.__AEROOPS_TIME_FORMAT = nextTf;
                  window.dispatchEvent(new CustomEvent("aeroops:timeFormatChanged", { detail: nextTf }));
                }
                setSettings((prev) => ({ ...(prev || {}), timeFormat: nextTf }));
              }}
            >
              <option value="24">
                {isAr ? "24 ساعة (مثال: 14:30) — قياسي" : "24 Hours (e.g. 14:30) — Standard"}
              </option>
              <option value="12">
                {isAr ? "12 ساعة (مثال: 02:30 PM)" : "12 Hours (e.g. 02:30 PM)"}
              </option>
            </Select>
          </Field>

          <Field label={isAr ? "نطاق التوقيت المعتمد (زولو / محلي)" : "Base Time Mode (Zulu / Local)"}>
            <Select
              disabled={!editable}
              value={draft.timeMode === "LOCAL" ? "LOCAL" : "UTC"}
              onChange={(e) => {
                const nextTm = e.target.value === "LOCAL" ? "LOCAL" : "UTC";
                setDraft({ ...draft, timeMode: nextTm });
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.setItem("aeroops.timeMode", nextTm);
                  } catch {}
                  window.__AEROOPS_TIME_MODE = nextTm;
                  window.dispatchEvent(new CustomEvent("aeroops:timeModeChanged", { detail: nextTm }));
                }
                setSettings((prev) => ({ ...(prev || {}), timeMode: nextTm }));
              }}
            >
              <option value="UTC">
                {isAr ? "توقيت زولو العالمي (UTC / Zulu) — المعيار الجوي" : "Zulu Universal Time (UTC / Zulu) — Aviation Standard"}
              </option>
              <option value="LOCAL">
                {isAr ? "التوقيت المحلي للجهاز (Local Time)" : "Device Local Time"}
              </option>
            </Select>
          </Field>

          <Field label={t.language || (isAr ? "لغة الواجهة" : "Interface Language")}>
            <Select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="ar">{t.arabic || "العربية"}</option>
              <option value="en">{t.english || "English"}</option>
            </Select>
          </Field>
        </div>
      </section>

      {/* Right Column (4 cols): Compact Logo + Stamp + System Guide PDF */}
      <div className="lg:col-span-4 space-y-3">
        {/* Logo & Stamp Side-by-Side */}
        <div className="grid grid-cols-2 gap-2.5">
          <section className="p-3 rounded-xl flex flex-col items-center gap-2" style={sectionStyle}>
            <h4 className="text-xs font-bold flex items-center gap-1.5 self-start" style={{ color: "var(--text-primary)" }}>
              <Camera className="w-3.5 h-3.5" style={{ color: "var(--brand-primary)" }} />
              <span>{t.companyLogo || (isAr ? "الشعار" : "Logo")}</span>
            </h4>
            <div
              className="w-16 h-16 rounded-lg overflow-hidden border border-dashed flex items-center justify-center"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              {logoToDisplayUrl(draft.logo) && !logoError ? (
                <img
                  src={logoToDisplayUrl(draft.logo)}
                  alt="logo"
                  className="w-full h-full object-contain p-1"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Plane className="w-6 h-6" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                disabled={!canUploadLogo || uploadingLogo}
                onClick={() => logoRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingLogo ? "…" : isAr ? "رفع" : "Upload"}</span>
              </button>
              {draft.logo && canRemoveLogo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold hover:bg-rose-500/25 cursor-pointer"
                >
                  {isAr ? "إزالة" : "Remove"}
                </button>
              )}
            </div>
            <input ref={logoRef} type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
          </section>

          <section className="p-3 rounded-xl flex flex-col items-center gap-2" style={sectionStyle}>
            <h4 className="text-xs font-bold flex items-center gap-1.5 self-start" style={{ color: "var(--text-primary)" }}>
              <ImageIcon className="w-3.5 h-3.5" style={{ color: "var(--brand-primary)" }} />
              <span>{t.stamp || (isAr ? "الختم" : "Stamp")}</span>
            </h4>
            <div
              className="w-16 h-16 rounded-lg overflow-hidden border border-dashed flex items-center justify-center"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              {!canViewStamp ? (
                <Lock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
              ) : logoToDisplayUrl(draft.stamp) && !stampError ? (
                <img
                  src={logoToDisplayUrl(draft.stamp)}
                  alt="stamp"
                  className="w-full h-full object-contain p-1"
                  onError={() => setStampError(true)}
                />
              ) : (
                <ImageIcon className="w-6 h-6" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                disabled={!canEditStamp || uploadingStamp}
                onClick={() => stampRef.current?.click()}
                className="px-2.5 py-1 rounded-lg text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingStamp ? "…" : isAr ? "رفع" : "Upload"}</span>
              </button>
              {draft.stamp && canEditStamp && (
                <button
                  type="button"
                  onClick={removeStamp}
                  className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-500 text-[11px] font-bold hover:bg-rose-500/25 cursor-pointer"
                >
                  {isAr ? "إزالة" : "Remove"}
                </button>
              )}
            </div>
            <input ref={stampRef} type="file" accept="image/*" onChange={uploadStamp} className="hidden" />
          </section>
        </div>

        {/* Executive System Guide & Features PDF Card */}
        <section className="p-3.5 rounded-xl space-y-2.5" style={sectionStyle}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {isAr ? "الدليل الشامل لطريقة عمل ومزايا النظام (PDF)" : "System Guide & Features (PDF)"}
              </h4>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                {isAr ? "وثيقة رسمية من 6 صفحات بالعربية والإنجليزية" : "Official 6-page bilingual operational guide"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => generateSystemGuidePdf({ settings: draft, lang, mode: "download" })}
              className="px-3 py-2 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5 transition hover:opacity-95 cursor-pointer"
              style={{ background: "var(--brand-gradient)" }}
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isAr ? "تنزيل PDF" : "Download PDF"}</span>
            </button>

            <button
              type="button"
              onClick={() => generateSystemGuidePdf({ settings: draft, lang, mode: "preview" })}
              className="px-3 py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isAr ? "معاينة" : "Preview"}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * SOUNDS TAB
 * ═══════════════════════════════════════════════════════════ */
function SoundsTab({ lang, t, user }) {
  const {
    soundsEnabled,
    setSoundsEnabled,
    soundsVolume,
    setSoundsVolume,
    alertSoundsEnabled,
    setAlertSoundsEnabled,
  } = useSounds();

  const [notifConfig, setNotifConfig] = useState(() => getNotificationSettings());
  const [history, setHistory] = useState(() => getNotificationHistory());
  const [browserPerm, setBrowserPerm] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

  const canEdit = checkPerm(user, "settings.sounds_edit");

  const updateConfig = (patch) => {
    if (!canEdit) return;
    const updated = saveNotificationSettings(patch);
    setNotifConfig(updated);
    if ("systemSounds" in patch) setSoundsEnabled(patch.systemSounds);
    if ("alertSounds" in patch) setAlertSoundsEnabled(patch.alertSounds);
    if ("volume" in patch) setSoundsVolume(patch.volume);
    showToast("✅ تم حفظ إعدادات الأصوات والإشعارات", "success");
  };

  const handleRequestBrowserPerm = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPerm(res);
    if (res === "granted") {
      updateConfig({ browserPush: true });
      showToast("✅ تم تفعيل إشعارات المتصفح بنجاح", "success");
    } else {
      showToast("⚠️ تم رفض إذن إشعارات المتصفح أو غير مدعوم", "warning");
    }
  };

  const handleClearHistory = () => {
    clearNotificationHistory();
    setHistory([]);
    showToast("تم مسح سجل الإشعارات", "info");
  };

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    boxShadow: "var(--shadow-sm)",
  };
  const innerStyle = {
    backgroundColor: "var(--bg-app)",
    border: "1px solid var(--border-default)",
  };

  const SOUND_ICON_MAP = {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Bell,
    MousePointer,
    Siren,
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      {!canEdit && (
        <div className="lg:col-span-12 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs font-bold flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* Column 1 (4 cols): System Notifications */}
      <section className="lg:col-span-4 space-y-2.5 p-3.5 rounded-xl" style={cardStyle}>
        <div
          className="flex items-center gap-2 pb-2"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
            <Bell className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {lang === "ar" ? "إشعارات الرحلات والطاقم" : "Flight & Crew Alerts"}
          </h3>
        </div>

        {/* Flight Changes Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={innerStyle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-500 shrink-0">
              <Plane className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                {lang === "ar" ? "تحديث وجدولة الرحلات" : "Flight Updates & Scheduling"}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {lang === "ar" ? "عند إضافة رحلة أو تعديل حالتها" : "On flight creation or status edit"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ flightUpdates: !notifConfig.flightUpdates })}
            disabled={!canEdit}
            className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
            style={{
              backgroundColor: notifConfig.flightUpdates ? "var(--brand-primary)" : "var(--border-default)",
            }}
          >
            <span
              className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-xs transition-transform"
              style={{
                transform: notifConfig.flightUpdates ? "translateX(24px)" : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Crew Changes Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={innerStyle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-500 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                {lang === "ar" ? "تعيينات وجدول الطواقم" : "Crew Assignments & Roster"}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {lang === "ar" ? "تنبيه فوري لتعيين الطاقم" : "Instant crew roster alert"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ crewUpdates: !notifConfig.crewUpdates })}
            disabled={!canEdit}
            className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
            style={{
              backgroundColor: notifConfig.crewUpdates ? "var(--brand-primary)" : "var(--border-default)",
            }}
          >
            <span
              className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-xs transition-transform"
              style={{
                transform: notifConfig.crewUpdates ? "translateX(24px)" : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Desktop / Browser Push */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={innerStyle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/15 text-purple-500 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs flex items-center gap-1.5 truncate" style={{ color: "var(--text-primary)" }}>
                <span className="truncate">{lang === "ar" ? "إشعارات المتصفح (PWA)" : "Browser Alerts"}</span>
                {browserPerm === "granted" && (
                  <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded shrink-0">
                    {lang === "ar" ? "مفعل" : "ON"}
                  </span>
                )}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {lang === "ar" ? "تنبيهات سطح المكتب والهاتف" : "Desktop & mobile alerts"}
              </div>
            </div>
          </div>

          {browserPerm === "granted" ? (
            <button
              type="button"
              onClick={() => updateConfig({ browserPush: !notifConfig.browserPush })}
              disabled={!canEdit}
              className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
              style={{
                backgroundColor: notifConfig.browserPush ? "var(--brand-primary)" : "var(--border-default)",
              }}
            >
              <span
                className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-xs transition-transform"
                style={{
                  transform: notifConfig.browserPush ? "translateX(24px)" : "translateX(4px)",
                }}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRequestBrowserPerm}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-700 shrink-0 cursor-pointer"
            >
              {lang === "ar" ? "تفعيل الإذن" : "Allow"}
            </button>
          )}
        </div>
      </section>

      {/* Column 2 (4 cols): Audio Feedback & Preview */}
      <section className="lg:col-span-4 space-y-2.5 p-3.5 rounded-xl" style={cardStyle}>
        <div
          className="flex items-center gap-2 pb-2"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
            <Volume2 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {lang === "ar" ? "أصوات المنظومة التفاعلية" : "Interactive Audio"}
          </h3>
        </div>

        {/* Master Audio Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={innerStyle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: soundsEnabled ? "rgba(34, 197, 94, 0.15)" : "var(--bg-card)",
              }}
            >
              {soundsEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                {t.enableSounds || (lang === "ar" ? "تشغيل الأصوات العامة" : "Enable Sounds")}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {lang === "ar" ? "المؤثرات الصوتية للعمليات" : "Audio effects on actions"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !soundsEnabled;
              setSoundsEnabled(next);
              updateConfig({ systemSounds: next });
            }}
            disabled={!canEdit}
            className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
            style={{
              backgroundColor: soundsEnabled ? "var(--brand-primary)" : "var(--border-default)",
            }}
          >
            <span
              className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-xs transition-transform"
              style={{
                transform: soundsEnabled ? "translateX(24px)" : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Alert Sounds Toggle */}
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg" style={innerStyle}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: alertSoundsEnabled ? "rgba(245, 158, 11, 0.15)" : "var(--bg-card)",
              }}
            >
              {alertSoundsEnabled ? (
                <Bell className="w-4 h-4 text-amber-500" />
              ) : (
                <BellOff className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs truncate" style={{ color: "var(--text-primary)" }}>
                {t.enableAlertSounds || (lang === "ar" ? "نغمات وأصوات التنبيه" : "Alert Sounds")}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                {lang === "ar" ? "تحذيرات الطيران الحساسة" : "Critical warnings audio"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !alertSoundsEnabled;
              setAlertSoundsEnabled(next);
              updateConfig({ alertSounds: next });
            }}
            disabled={!canEdit}
            className="relative w-11 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer"
            style={{
              backgroundColor: alertSoundsEnabled ? "#f59e0b" : "var(--border-default)",
            }}
          >
            <span
              className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-xs transition-transform"
              style={{
                transform: alertSoundsEnabled ? "translateX(24px)" : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {soundsEnabled && (
          <>
            <div className="p-2.5 rounded-lg" style={innerStyle}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                  {t.volume || (lang === "ar" ? "مستوى الصوت العام" : "Volume")}
                </div>
                <div className="text-xs font-mono font-bold" style={{ color: "var(--brand-primary)" }}>
                  {Math.round(soundsVolume * 100)}%
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundsVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSoundsVolume(val);
                  updateConfig({ volume: val });
                }}
                disabled={!canEdit}
                className="w-full disabled:opacity-50 cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-lg" style={innerStyle}>
              <div className="text-[11px] font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
                {t.testSounds || (lang === "ar" ? "معاينة النغمات" : "Test System Sounds")}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {SOUND_TYPES.map((s) => {
                  const SIcon = SOUND_ICON_MAP[s.iconName] || Bell;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => s.play()}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg transition active:scale-95 hover:opacity-90 cursor-pointer"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                      }}
                      title={lang === "ar" ? "انقر للاستماع للنغمة" : "Click to test sound"}
                    >
                      <SIcon className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
                      <span className="text-[10px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {lang === "ar" ? s.label_ar : s.label_en}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => testNotificationSystem()}
              className="w-full px-3 py-2 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>
                {lang === "ar" ? "تجربة الإشعار والصوت الفوري" : "Test Notification & Audio"}
              </span>
            </button>
          </>
        )}
      </section>

      {/* Column 3 (4 cols): Recent Notifications Log */}
      <section className="lg:col-span-4 space-y-2.5 p-3.5 rounded-xl" style={cardStyle}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <span>{lang === "ar" ? `سجل الإشعارات (${history.length})` : `Notifications (${history.length})`}</span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
            >
              {lang === "ar" ? "مسح السجل" : "Clear"}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
            {lang === "ar" ? "لا توجد إشعارات سابقة مسجلة" : "No recorded notifications"}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {history.slice(0, 15).map((item) => (
              <div
                key={item.id}
                className="p-2 rounded-lg border text-xs flex items-start justify-between gap-2"
                style={innerStyle}
              >
                <div className="min-w-0">
                  <div className="font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </div>
                  {item.body && (
                    <div className="text-[11px] line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {item.body}
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
                  {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * APPEARANCE TAB
 * ═══════════════════════════════════════════════════════════ */
function AppearanceTab({
  settings,
  setSettings,
  lang,
  user,
  t,
  flights = [],
  fleet = [],
  crew = [],
}) {
  const [draft, setDraft] = useState(settings || {});
  const [saving, setSaving] = useState(false);
  const [activeSubSection, setActiveSubSection] = useState("all");
  const isAr = lang === "ar";
  const [headerToolsList, setHeaderToolsList] = useState(() => getHeaderToolsConfig());
  const [contextMenuDraft, setContextMenuDraft] = useState(() =>
    getFlightContextMenuConfig()
  );
  const [opForms, setOpForms] = useState(() => listOperationalFormsSync());
  const [showAiFormScanner, setShowAiFormScanner] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchOperationalForms()
      .then((list) => {
        if (mounted && Array.isArray(list)) setOpForms(list);
      })
      .catch(() => {});
    const onFormsUpdated = () => setOpForms(listOperationalFormsSync());
    window.addEventListener("aeroops:forms-updated", onFormsUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("aeroops:forms-updated", onFormsUpdated);
    };
  }, []);

  const handleToggleOpFormContextMenu = async (form) => {
    const nextShow = form.showInContextMenu === false;
    try {
      const updated = await saveOperationalForm({
        ...form,
        showInContextMenu: nextShow,
      });
      setOpForms(listOperationalFormsSync());
      if (nextShow) {
        // Ensure the parent Operational Forms section in the dropdown menu is also enabled
        const parentDisabled = contextMenuDraft.some(
          (it) => it.id === "operational_forms" && it.enabled === false
        );
        if (parentDisabled) {
          const nextMenu = contextMenuDraft.map((it) =>
            it.id === "operational_forms" ? { ...it, enabled: true } : it
          );
          setContextMenuDraft(nextMenu);
          saveFlightContextMenuConfig(nextMenu);
          const nextDraft = { ...draft, flightContextMenuConfig: nextMenu };
          setDraft(nextDraft);
          notifyAndSyncLive(nextDraft);
        }
      }
      showToast(
        nextShow
          ? isAr
            ? `✅ يظهر النموذج "${updated.name}" الآن في القائمة المنسدلة للرحلة`
            : `"${updated.name}" added to flight dropdown menu`
          : isAr
          ? `تم إخفاء "${updated.name}" من القائمة المنسدلة للرحلة`
          : `"${updated.name}" hidden from flight dropdown menu`,
        "info"
      );
    } catch (err) {
      showToast("❌ تعذر تحديث حالة النموذج: " + err.message, "error");
    }
  };

  const toggleFlightMenuItem = (id) => {
    const next = contextMenuDraft.map((it) =>
      it.id === id ? { ...it, enabled: it.enabled === false } : it
    );
    setContextMenuDraft(next);
    saveFlightContextMenuConfig(next);
    const nextDraft = { ...draft, flightContextMenuConfig: next };
    setDraft(nextDraft);
    notifyAndSyncLive(nextDraft);
  };

  const moveFlightMenuItem = (idx, direction) => {
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= contextMenuDraft.length) return;
    const list = [...contextMenuDraft];
    const tmp = list[idx];
    list[idx] = list[target];
    list[target] = tmp;
    const normalized = list.map((it, i) => ({ ...it, order: i + 1 }));
    setContextMenuDraft(normalized);
    saveFlightContextMenuConfig(normalized);
    const nextDraft = { ...draft, flightContextMenuConfig: normalized };
    setDraft(nextDraft);
    notifyAndSyncLive(nextDraft);
  };

  const resetFlightMenuDefault = () => {
    setContextMenuDraft(DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS);
    saveFlightContextMenuConfig(DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS);
    const nextDraft = {
      ...draft,
      flightContextMenuConfig: DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS,
    };
    setDraft(nextDraft);
    notifyAndSyncLive(nextDraft);
    showToast(
      isAr
        ? "تمت استعادة الترتيب والعناصر الافتراضية للقائمة المنسدلة للرحلة"
        : "Reset flight dropdown menu to defaults",
      "info"
    );
  };

  const syncHeaderToolsChange = (updatedList) => {
    setHeaderToolsList(updatedList);
    saveHeaderToolsConfig(updatedList);
    if (typeof window !== "undefined") {
      localStorage.setItem("aeroops.headerToolsLayout", "direct");
      window.dispatchEvent(new Event("aeroops:headerToolsConfigChanged"));
      window.dispatchEvent(new Event("aeroops:headerToolsLayoutChanged"));
    }
    const nextDraft = { ...draft, headerToolsList: updatedList, headerToolsLayout: "direct" };
    setDraft(nextDraft);
    setSettings?.((prev) => ({ ...prev, headerToolsList: updatedList, headerToolsLayout: "direct" }));
    notifyAndSyncLive(nextDraft);
  };

  const handleToggleHeaderTool = (id) => {
    const updated = headerToolsList.map((item) =>
      item.id === id ? { ...item, enabled: !item.enabled } : item
    );
    syncHeaderToolsChange(updated);
    showToast(isAr ? "تم تحديث إظهار/إخفاء الأداة" : "Tool visibility updated", "success");
  };

  const handleToggleHeaderToolDirect = (id) => {
    const updated = toggleHeaderToolDirect(headerToolsList, id);
    syncHeaderToolsChange(updated);
    showToast(isAr ? "تم تحديث مكان عرض الأداة" : "Tool placement updated", "success");
  };

  const handleMoveHeaderToolUp = (idx) => {
    const updated = moveHeaderToolUp(headerToolsList, idx);
    syncHeaderToolsChange(updated);
  };

  const handleMoveHeaderToolDown = (idx) => {
    const updated = moveHeaderToolDown(headerToolsList, idx);
    syncHeaderToolsChange(updated);
  };

  const [crewCardDraft, setCrewCardDraft] = useState(() => {
    return draft.crewContactCard || getCrewContactCardConfig();
  });
  const [airportCardDraft, setAirportCardDraft] = useState(() => {
    return draft.airportCard || getAirportCardConfig();
  });

  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const watermarkRef = useRef();

  const uploadWatermarkLogo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      showToast("⚠️ الحد الأقصى 2 MB");
      if (watermarkRef.current) watermarkRef.current.value = "";
      return;
    }
    setUploadingWatermark(true);
    try {
      const r = await uploadFile(f, "logos");
      if (!r || !r.fileUrl) throw new Error("لم يُرجع رابط الملف");
      const updated = { ...draft, portalWatermarkLogo: r.fileUrl };
      setDraft(updated);
      notifyAndSyncLive(updated);
      showToast("✅ تم رفع شعار العلامة المائية بنجاح");
    } catch (err) {
      showToast("❌ فشل الرفع: " + err.message);
    } finally {
      setUploadingWatermark(false);
      if (watermarkRef.current) watermarkRef.current.value = "";
    }
  };

  const removeWatermarkLogo = () => {
    const updated = { ...draft, portalWatermarkLogo: "" };
    setDraft(updated);
    notifyAndSyncLive(updated);
    showToast("تمت إزالة الشعار المائي الخاص والرجوع لشعار الشركة الرئيسي");
  };

  useEffect(() => {
    setDraft(settings || {});
    if (settings?.crewContactCard) {
      setCrewCardDraft(settings.crewContactCard);
    }
    if (settings?.airportCard) {
      setAirportCardDraft(settings.airportCard);
    }
  }, [settings]);

  useEffect(() => {
    const onDesignChange = (e) => {
      const next = e?.detail?.design;
      if (next) {
        setDraft((prev) => ({ ...(prev || {}), scheduleDesign: next }));
      }
    };
    const onFlightMenuChange = () => {
      setContextMenuDraft(getFlightContextMenuConfig());
    };
    window.addEventListener(SCHEDULE_DESIGN_EVENT, onDesignChange);
    window.addEventListener(FLIGHT_CONTEXT_MENU_EVENT, onFlightMenuChange);
    return () => {
      window.removeEventListener(SCHEDULE_DESIGN_EVENT, onDesignChange);
      window.removeEventListener(FLIGHT_CONTEXT_MENU_EVENT, onFlightMenuChange);
    };
  }, []);

  const updateCrewCardConfig = (partial) => {
    const next = { ...crewCardDraft, ...partial };
    setCrewCardDraft(next);
    const nextDraft = { ...draft, crewContactCard: next };
    setDraft(nextDraft);
    saveCrewContactCardConfig(next);
    notifyAndSyncLive(nextDraft);
  };

  const updateAirportCardConfig = (partial) => {
    const next = { ...airportCardDraft, ...partial };
    setAirportCardDraft(next);
    const nextDraft = { ...draft, airportCard: next };
    setDraft(nextDraft);
    saveAirportCardConfig(next);
    notifyAndSyncLive(nextDraft);
  };

  const editable = checkPerm(user, "settings.appearance_edit");
  const canChangeTheme =
    editable &&
    (checkPerm(user, "settings.global_theme") ||
      checkPerm(user, "settings.portal_theme"));
  const canChangeNavLayout = checkPerm(user, "settings.nav_layout");
  const canChangeTabPrefs = checkPerm(user, "settings.tab_prefs");
  const canConfigureHeaderTools = checkPerm(user, "settings.header_tools") || canChangeTabPrefs;
  const canUseAiFormScanner = checkPerm(user, "forms.ai_scanner");

  const [menuModalOpen, setMenuModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [menuDraft, setMenuDraft] = useState({
    id: "",
    label_ar: "",
    label_en: "",
    icon: "Layers",
  });

  const customMenus = useMemo(() => {
    if (Array.isArray(draft.customMenus)) return draft.customMenus;
    const tp = draft.tabPreferences;
    if (Array.isArray(tp?.__customMenus)) return tp.__customMenus;
    if (Array.isArray(tp?.customMenus)) return tp.customMenus;
    try {
      const raw = localStorage.getItem("aeroops.customMenus");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [draft.customMenus, draft.tabPreferences]);

  const prefs = { ...DEFAULT_TAB_PREFERENCES, ...(draft.tabPreferences || {}) };
  const getTabPosition = (id) =>
    prefs[id] || DEFAULT_TAB_PREFERENCES[id] || "more";

  const moreMenuConfig = useMemo(() => {
    if (draft.moreMenuConfig && typeof draft.moreMenuConfig === "object") {
      return draft.moreMenuConfig;
    }
    if (settings?.moreMenuConfig && typeof settings.moreMenuConfig === "object") {
      return settings.moreMenuConfig;
    }
    const tp = draft.tabPreferences || settings?.tabPreferences;
    if (tp?.__moreMenuConfig && typeof tp.__moreMenuConfig === "object") {
      return tp.__moreMenuConfig;
    }
    try {
      const raw = localStorage.getItem("aeroops.moreMenu");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {}
    return { enabled: true, label_ar: "المزيد", label_en: "More", icon: "MoreHorizontal" };
  }, [draft.moreMenuConfig, draft.tabPreferences, settings]);

  const navItemsOrder = useMemo(() => {
    if (Array.isArray(draft.navItemsOrder)) return draft.navItemsOrder;
    if (Array.isArray(draft.tabPreferences?.__navItemsOrder))
      return draft.tabPreferences.__navItemsOrder;
    try {
      const raw = localStorage.getItem("aeroops.navItemsOrder");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [draft.navItemsOrder, draft.tabPreferences]);

  const notifyAndSyncLive = (updatedDraft) => {
    try {
      const cleanCustomMenus = updatedDraft.customMenus || customMenus;
      const cleanTabOrder = updatedDraft.tabOrder || tabOrder;
      const cleanMoreMenu = updatedDraft.moreMenuConfig || moreMenuConfig;
      const cleanNavItemsOrder = updatedDraft.navItemsOrder || navItemsOrder;
      const cleanHeaderToolsList = updatedDraft.headerToolsList || headerToolsList;
      const cleanHeaderToolsLayout =
        updatedDraft.headerToolsLayout ||
        (typeof window !== "undefined" && localStorage.getItem("aeroops.headerToolsLayout")) ||
        "direct";
      const cleanCrewCard = updatedDraft.crewContactCard || crewCardDraft;
      const cleanAirportCard = updatedDraft.airportCard || airportCardDraft;
      const cleanScheduleDesign =
        updatedDraft.scheduleDesign ||
        draft.scheduleDesign ||
        getScheduleDesign(DEFAULT_SCHEDULE_DESIGN);
      const cleanFlightContextMenu =
        updatedDraft.flightContextMenuConfig || contextMenuDraft;
      const cleanTabPreferences = {
        ...(updatedDraft.tabPreferences || {}),
        __customMenus: cleanCustomMenus,
        __tabOrder: cleanTabOrder,
        __moreMenuConfig: cleanMoreMenu,
        __navItemsOrder: cleanNavItemsOrder,
        __headerToolsList: cleanHeaderToolsList,
        __headerToolsLayout: cleanHeaderToolsLayout,
        __crewContactCard: cleanCrewCard,
        __airportCard: cleanAirportCard,
        __scheduleDesign: cleanScheduleDesign,
        __flightContextMenuConfig: cleanFlightContextMenu,
      };

      localStorage.setItem("aeroops.tabPreferences", JSON.stringify(cleanTabPreferences));
      localStorage.setItem("aeroops.customMenus", JSON.stringify(cleanCustomMenus));
      localStorage.setItem("aeroops.tabOrder", JSON.stringify(cleanTabOrder));
      localStorage.setItem("aeroops.moreMenu", JSON.stringify(cleanMoreMenu));
      localStorage.setItem("aeroops.navItemsOrder", JSON.stringify(cleanNavItemsOrder));
      localStorage.setItem("aeroops.crewContactCard", JSON.stringify(cleanCrewCard));
      localStorage.setItem("aeroops.airportCard", JSON.stringify(cleanAirportCard));

      try {
        const cache = JSON.parse(localStorage.getItem("aeroops.settingsCache") || "{}");
        if (updatedDraft.portalIconStyle !== undefined) cache.portalIconStyle = updatedDraft.portalIconStyle;
        if (updatedDraft.portalCustomIcons !== undefined) cache.portalCustomIcons = updatedDraft.portalCustomIcons;
        if (updatedDraft.portalWatermarkLogo !== undefined) cache.portalWatermarkLogo = updatedDraft.portalWatermarkLogo;
        if (updatedDraft.portalWatermarkOpacity !== undefined) cache.portalWatermarkOpacity = updatedDraft.portalWatermarkOpacity;
        cache.scheduleDesign = cleanScheduleDesign;
        localStorage.setItem("aeroops.settingsCache", JSON.stringify(cache));
      } catch {}

      setSettings?.((prev) => ({
        ...(prev || {}),
        ...(updatedDraft || {}),
        tabPreferences: cleanTabPreferences,
        customMenus: cleanCustomMenus,
        tabOrder: cleanTabOrder,
        moreMenuConfig: cleanMoreMenu,
        navItemsOrder: cleanNavItemsOrder,
        crewContactCard: cleanCrewCard,
        airportCard: cleanAirportCard,
        scheduleDesign: cleanScheduleDesign,
        portalIconStyle: updatedDraft.portalIconStyle !== undefined ? updatedDraft.portalIconStyle : prev?.portalIconStyle,
        portalCustomIcons: updatedDraft.portalCustomIcons !== undefined ? updatedDraft.portalCustomIcons : prev?.portalCustomIcons,
        portalWatermarkLogo: updatedDraft.portalWatermarkLogo !== undefined ? updatedDraft.portalWatermarkLogo : prev?.portalWatermarkLogo,
        portalWatermarkOpacity: updatedDraft.portalWatermarkOpacity !== undefined ? updatedDraft.portalWatermarkOpacity : prev?.portalWatermarkOpacity,
      }));

      window.dispatchEvent(new Event("aeroops:prefsChanged"));
    } catch (e) {
      console.warn("Live sync error:", e);
    }
  };

  const setTabPosition = (id, position) => {
    const updatedDraft = {
      ...draft,
      tabPreferences: { ...(draft.tabPreferences || {}), [id]: position },
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
  };

  const getMenuTabsCount = (menuId) => {
    return ALL_TABS_CONFIG.filter((t) => getTabPosition(t.id) === menuId).length;
  };

  const handleSaveMenu = (data) => {
    const list = [...customMenus];
    let updated;
    if (editingMenu) {
      updated = list.map((m) =>
        m.id === editingMenu.id ? { ...m, ...data } : m
      );
    } else {
      const newId = `menu_${Date.now()}`;
      updated = [...list, { id: newId, ...data }];
    }
    const updatedDraft = {
      ...draft,
      customMenus: updated,
      tabPreferences: {
        ...(draft.tabPreferences || {}),
        __customMenus: updated,
      },
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
    setMenuModalOpen(false);
    setEditingMenu(null);
    showToast(isAr ? "تم حفظ القائمة بنجاح" : "Menu saved successfully");
  };

  const handleDeleteMenu = async (menuId) => {
    const ok = await confirmAction(
      isAr
        ? "هل أنت متأكد من حذف هذه القائمة؟ سيتم نقل جميع التبويبات التابعة لها تلقائياً إلى قائمة المزيد (More)."
        : "Are you sure you want to delete this menu? Tabs inside it will be moved to 'More'."
    );
    if (!ok) return;

    const updated = customMenus.filter((m) => m.id !== menuId);
    const updatedPrefs = { ...(draft.tabPreferences || {}) };
    Object.keys(updatedPrefs).forEach((k) => {
      if (updatedPrefs[k] === menuId) {
        updatedPrefs[k] = "more";
      }
    });
    updatedPrefs.__customMenus = updated;

    const updatedDraft = {
      ...draft,
      customMenus: updated,
      tabPreferences: updatedPrefs,
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
    showToast(
      isAr
        ? "تم حذف القائمة ونقل التبويبات إلى المزيد"
        : "Menu deleted and tabs moved to More"
    );
  };

  const moveCustomMenu = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customMenus.length) return;
    const list = [...customMenus];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    const updatedDraft = {
      ...draft,
      customMenus: list,
      tabPreferences: {
        ...(draft.tabPreferences || {}),
        __customMenus: list,
      },
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
  };

  const tabOrder = useMemo(() => {
    if (Array.isArray(draft.tabOrder)) return draft.tabOrder;
    if (Array.isArray(draft.tabPreferences?.__tabOrder))
      return draft.tabPreferences.__tabOrder;
    return ALL_TABS_CONFIG.map((t) => t.id);
  }, [draft.tabOrder, draft.tabPreferences]);

  const sortedTabs = useMemo(() => {
    const currentOrder = tabOrder;
    return [...ALL_TABS_CONFIG].sort((a, b) => {
      const idxA = currentOrder.indexOf(a.id);
      const idxB = currentOrder.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }, [tabOrder]);

  const moveTab = (tabId, direction) => {
    const list = sortedTabs.map((t) => t.id);
    const index = list.indexOf(tabId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;
    const updatedDraft = {
      ...draft,
      tabOrder: list,
      tabPreferences: {
        ...(draft.tabPreferences || {}),
        __tabOrder: list,
      },
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
  };

  const unifiedTopBarElements = useMemo(() => {
    const items = [];

    // Primary tabs
    ALL_TABS_CONFIG.forEach((t) => {
      const pos = getTabPosition(t.id);
      if (pos === "primary" || (pos === "more" && !moreMenuConfig.enabled)) {
        items.push({
          id: t.id,
          kind: "tab",
          label_ar: t.label_ar,
          label_en: t.label_en,
          icon: t.icon,
        });
      }
    });

    // Custom dropdown menus
    customMenus.forEach((cm) => {
      const count = getMenuTabsCount(cm.id);
      if (count > 0) {
        items.push({
          id: cm.id,
          kind: "menu",
          label_ar: cm.label_ar || cm.label_en,
          label_en: cm.label_en || cm.label_ar,
          icon: getMenuIconComponent(cm.icon),
        });
      }
    });

    // More menu
    const moreTabsCount = ALL_TABS_CONFIG.filter((t) => getTabPosition(t.id) === "more").length;
    if (moreMenuConfig.enabled && moreTabsCount > 0) {
      items.push({
        id: "more",
        kind: "more",
        label_ar: moreMenuConfig.label_ar || "المزيد",
        label_en: moreMenuConfig.label_en || "More",
        icon: getMenuIconComponent(moreMenuConfig.icon || "MoreHorizontal"),
      });
    }

    if (navItemsOrder.length > 0) {
      items.sort((a, b) => {
        const idxA = navItemsOrder.indexOf(a.id);
        const idxB = navItemsOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    return items;
  }, [prefs, customMenus, moreMenuConfig, navItemsOrder]);

  const moveTopBarItem = (id, direction) => {
    const list = unifiedTopBarElements.map((el) => el.id);
    const index = list.indexOf(id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const updatedDraft = {
      ...draft,
      navItemsOrder: list,
      tabPreferences: {
        ...(draft.tabPreferences || {}),
        __navItemsOrder: list,
      },
    };
    setDraft(updatedDraft);
    notifyAndSyncLive(updatedDraft);
  };

  // Deduplicate themes list (eliminating aliases)
  const themeList = useMemo(() => {
    const seen = new Set();
    const list = [];
    Object.values(GLOBAL_THEMES).forEach((thm) => {
      if (thm?.id && !seen.has(thm.id)) {
        seen.add(thm.id);
        list.push(thm);
      }
    });
    return list;
  }, []);

  const selectUnifiedTheme = (themeId) => {
    if (!canChangeTheme) return;

    setDraft((prev) => ({
      ...prev,
      globalTheme: themeId,
      portalTheme: themeId,
    }));

    // Instant live application to document root CSS variables
    const themeObj = getGlobalTheme(themeId);
    if (themeObj && typeof document !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      const vars =
        isDark && Object.keys(themeObj.darkVars || {}).length > 0
          ? { ...themeObj.vars, ...themeObj.darkVars }
          : themeObj.vars;

      Object.entries(vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      document.documentElement.setAttribute("data-theme", themeId);
    }

    // Inform App & CrewPortal state
    setSettings?.((prev) => ({
      ...(prev || {}),
      globalTheme: themeId,
      portalTheme: themeId,
    }));

    // Cache locally for instant persistence
    try {
      localStorage.setItem("aeroops.activeTheme", themeId);
      const cache = JSON.parse(
        localStorage.getItem("aeroops.settingsCache") || "{}"
      );
      cache.globalTheme = themeId;
      cache.portalTheme = themeId;
      localStorage.setItem("aeroops.settingsCache", JSON.stringify(cache));
    } catch {}

    window.dispatchEvent(new Event("aeroops:prefsChanged"));

    showToast(
      isAr
        ? `✨ تم تطبيق نمط (${themeObj?.nameAr || themeId}) فورياً على كامل النظام وكرو بورتال`
        : `✨ Applied theme (${themeObj?.name || themeId}) across system & Crew Portal`,
      "info"
    );
  };

  const selectScheduleDesign = (designId) => {
    const applied = applyScheduleDesign(designId, { persist: true });
    const designObj = SCHEDULE_DESIGNS.find((d) => d.id === applied);
    const nextDraft = { ...draft, scheduleDesign: applied };
    setDraft(nextDraft);
    notifyAndSyncLive(nextDraft);
    showToast(
      isAr
        ? `تم اعتماد تصميم جدول الرحلات: ${designObj?.nameAr || applied}`
        : `Applied Schedule Board design: ${designObj?.nameEn || applied}`,
      "success"
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const unifiedTheme =
        draft.globalTheme || draft.portalTheme || DEFAULT_GLOBAL_THEME;
      const cleanScheduleDesign =
        draft.scheduleDesign ||
        settings?.scheduleDesign ||
        getScheduleDesign(DEFAULT_SCHEDULE_DESIGN);
      const cleanCustomMenus = customMenus;
      const cleanTabOrder = tabOrder;
      const cleanMoreMenu = moreMenuConfig;
      const cleanNavItemsOrder = navItemsOrder;
      const cleanHeaderToolsList = headerToolsList;
      const cleanHeaderToolsLayout =
        draft.headerToolsLayout ||
        (typeof window !== "undefined" && localStorage.getItem("aeroops.headerToolsLayout")) ||
        "direct";
      const cleanFlightContextMenu = contextMenuDraft;
      const cleanTabPreferences = {
        ...(draft.tabPreferences || {}),
        __customMenus: cleanCustomMenus,
        __tabOrder: cleanTabOrder,
        __moreMenuConfig: cleanMoreMenu,
        __navItemsOrder: cleanNavItemsOrder,
        __headerToolsList: cleanHeaderToolsList,
        __headerToolsLayout: cleanHeaderToolsLayout,
        __crewContactCard: crewCardDraft,
        __airportCard: airportCardDraft,
        __scheduleDesign: cleanScheduleDesign,
        __flightContextMenuConfig: cleanFlightContextMenu,
      };
      const payload = {
        ...settings,
        ...draft,
        globalTheme: unifiedTheme,
        portalTheme: unifiedTheme,
        scheduleDesign: cleanScheduleDesign,
        flightContextMenuConfig: cleanFlightContextMenu,
        portalIconStyle: draft.portalIconStyle || "vector3d",
        portalCustomIcons: draft.portalCustomIcons || {},
        portalWatermarkLogo: draft.portalWatermarkLogo || "",
        portalWatermarkOpacity: draft.portalWatermarkOpacity ?? 0.18,
        customMenus: cleanCustomMenus,
        tabOrder: cleanTabOrder,
        moreMenuConfig: cleanMoreMenu,
        navItemsOrder: cleanNavItemsOrder,
        headerToolsList: cleanHeaderToolsList,
        headerToolsLayout: cleanHeaderToolsLayout,
        tabPreferences: cleanTabPreferences,
        crewContactCard: crewCardDraft,
        airportCard: airportCardDraft,
      };
      await settingsAPI.save(payload);
      applyScheduleDesign(cleanScheduleDesign, { persist: true });
      saveFlightContextMenuConfig(cleanFlightContextMenu);
      const fresh = await settingsAPI.get();
      setSettings(
        fresh
          ? {
              ...fresh,
              globalTheme: unifiedTheme,
              portalTheme: unifiedTheme,
              scheduleDesign: cleanScheduleDesign,
              flightContextMenuConfig: cleanFlightContextMenu,
              portalIconStyle: draft.portalIconStyle || fresh.portalIconStyle || "vector3d",
              portalCustomIcons: draft.portalCustomIcons || fresh.portalCustomIcons || {},
              portalWatermarkLogo: draft.portalWatermarkLogo !== undefined ? draft.portalWatermarkLogo : fresh.portalWatermarkLogo,
              portalWatermarkOpacity: draft.portalWatermarkOpacity !== undefined ? draft.portalWatermarkOpacity : fresh.portalWatermarkOpacity,
              moreMenuConfig: cleanMoreMenu,
              navItemsOrder: cleanNavItemsOrder,
              headerToolsList: cleanHeaderToolsList,
              headerToolsLayout: cleanHeaderToolsLayout,
              crewContactCard: crewCardDraft,
              airportCard: airportCardDraft,
            }
          : payload
      );
      localStorage.setItem("aeroops.tabPreferences", JSON.stringify(cleanTabPreferences));
      localStorage.setItem("aeroops.customMenus", JSON.stringify(cleanCustomMenus));
      localStorage.setItem("aeroops.tabOrder", JSON.stringify(cleanTabOrder));
      localStorage.setItem("aeroops.moreMenu", JSON.stringify(cleanMoreMenu));
      localStorage.setItem("aeroops.navItemsOrder", JSON.stringify(cleanNavItemsOrder));
      localStorage.setItem("aeroops.navLayout", draft.navLayout || "top");
      localStorage.setItem("aeroops.headerToolsLayout", cleanHeaderToolsLayout);
      saveHeaderToolsConfig(cleanHeaderToolsList);
      localStorage.setItem("aeroops.crewContactCard", JSON.stringify(crewCardDraft));
      localStorage.setItem("aeroops.airportCard", JSON.stringify(airportCardDraft));
      window.dispatchEvent(new Event("aeroops:headerToolsConfigChanged"));
      window.dispatchEvent(new Event("aeroops:headerToolsLayoutChanged"));
      window.dispatchEvent(new Event("aeroops:prefsChanged"));
      showToast(
        isAr
          ? "✅ تم حفظ التغييرات وتعميم القوائم والنمط والشريط الرئيسي وتصميم الجدول"
          : "✅ Settings saved & synced across system"
      );
    } catch (e) {
      showToast("❌ " + (t.failedSave || "فشل الحفظ") + ": " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setCrewCardDraft(DEFAULT_CREW_CARD_CONFIG);
    saveCrewContactCardConfig(DEFAULT_CREW_CARD_CONFIG);
    setAirportCardDraft(DEFAULT_AIRPORT_CARD_CONFIG);
    saveAirportCardConfig(DEFAULT_AIRPORT_CARD_CONFIG);
    setContextMenuDraft(DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS);
    saveFlightContextMenuConfig(DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS);
    applyScheduleDesign(DEFAULT_SCHEDULE_DESIGN, { persist: true });
    setDraft({
      ...draft,
      tabPreferences: { ...DEFAULT_TAB_PREFERENCES },
      customMenus: [],
      navLayout: "top",
      globalTheme: DEFAULT_GLOBAL_THEME,
      portalTheme: DEFAULT_GLOBAL_THEME,
      scheduleDesign: DEFAULT_SCHEDULE_DESIGN,
      flightContextMenuConfig: DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS,
    });
    if (canChangeTheme) {
      selectUnifiedTheme(DEFAULT_GLOBAL_THEME);
    }
  };

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    boxShadow: "var(--shadow-sm)",
  };

  const activeUnifiedTheme =
    draft.globalTheme || draft.portalTheme || DEFAULT_GLOBAL_THEME;
  const activeScheduleDesign =
    draft.scheduleDesign ||
    settings?.scheduleDesign ||
    settings?.tabPreferences?.__scheduleDesign ||
    getScheduleDesign(DEFAULT_SCHEDULE_DESIGN);

  const SUB_SECTIONS = [
    { id: "all", ar: "عرض شامل (الكل)", en: "All Sections" },
    { id: "schedule_design", ar: "تصميم جدول الرحلات", en: "Schedule Designs" },
    { id: "flight_menu", ar: "القائمة المنسدلة للرحلة", en: "Flight Dropdown Menu" },
    { id: "themes", ar: "الثيمات والأنماط", en: "Themes" },
    { id: "header_nav", ar: "الشريط العلوي والقائمة المجمعة", en: "Top Bar & Grouped Menu" },
    { id: "menus_tabs", ar: "التبويبات والقوائم المخصصة", en: "Menus & Tabs" },
    { id: "portal", ar: "بوابة الطاقم", en: "Crew Portal" },
    { id: "crew_card", ar: "بطاقات الطاقم والمطار", en: "Crew & Airport Cards" },
  ];

  return (
    <div className="w-full space-y-3">
      {!editable && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs flex items-center gap-2 font-bold">
          <Lock className="w-4 h-4 shrink-0" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* Compact Sticky Filter + Action Strip */}
      <div
        className="p-2 rounded-xl flex flex-wrap items-center justify-between gap-2"
        style={cardStyle}
      >
        <div className="flex flex-wrap items-center gap-1">
          {SUB_SECTIONS.map((sec) => {
            const isSel = activeSubSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSubSection(sec.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isSel ? "text-white shadow-2xs" : "hover:opacity-80"
                }`}
                style={
                  isSel
                    ? { background: "var(--brand-gradient)" }
                    : {
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border-default)",
                      }
                }
              >
                {isAr ? sec.ar : sec.en}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={!canChangeTabPrefs}
            onClick={resetToDefault}
            className="px-2.5 py-1 rounded-lg text-xs font-bold border transition disabled:opacity-50 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            {isAr ? "الافتراضي" : "Reset"}
          </button>
          <button
            type="button"
            disabled={!editable || saving}
            onClick={save}
            className="px-3.5 py-1 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "…" : isAr ? "حفظ وتثبيت المظهر" : "Save & Sync"}</span>
          </button>
        </div>
      </div>

      {/* ═══ SECTION 1: UNIFIED THEMES GALLERY ═══ */}
      {(activeSubSection === "all" || activeSubSection === "themes") && (
      <section className="p-3.5 rounded-xl space-y-3" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h4
                className="text-sm font-bold flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <span>
                  {isAr
                    ? "أنماط وهوية المنظومة الموحدة (System & Crew Portal)"
                    : "Unified System & Crew Portal Themes"}
                </span>
                {!canChangeTheme && (
                  <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                )}
              </h4>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "يُطبّق فورياً بنقرة واحدة على كامل المنظومة وبوابة الطاقم في الوضعين النهاري والليلي"
                  : "Applied instantaneously across all modules and Crew Portal in light & dark modes"}
              </p>
            </div>
          </div>
        </div>

        {/* 10 Themes Visual Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {themeList.map((themeObj) => {
            const isSelected = activeUnifiedTheme === themeObj.id;
            const isDefault = themeObj.id === DEFAULT_GLOBAL_THEME;
            return (
              <div
                key={themeObj.id}
                onClick={() => selectUnifiedTheme(themeObj.id)}
                className="relative rounded-2xl border-2 transition overflow-hidden text-start group cursor-pointer flex flex-col justify-between"
                style={{
                  borderColor: isSelected
                    ? "var(--brand-primary)"
                    : "var(--border-default)",
                  boxShadow: isSelected
                    ? `0 0 0 3px var(--brand-accent), 0 8px 20px rgba(0, 0, 0, 0.12)`
                    : "var(--shadow-sm)",
                  backgroundColor: "var(--bg-card)",
                }}
              >
                {/* Top Theme Gradient Swatch */}
                <div
                  className="h-3 w-full"
                  style={{ background: themeObj.vars["--brand-gradient"] }}
                />

                {/* Card Inner Content */}
                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                  {/* Badges & Status */}
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? "var(--brand-primary)"
                          : "var(--bg-app)",
                        color: isSelected ? "#ffffff" : "var(--text-muted)",
                      }}
                    >
                      {themeObj.badge || (isDefault ? "الافتراضي" : "Aviation")}
                    </span>

                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isAr ? "مفعل حالياً" : "Active"}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground opacity-60 group-hover:opacity-100 transition">
                        {isAr ? "انقر للتفعيل" : "Click to apply"}
                      </span>
                    )}
                  </div>

                  {/* UI Simulation Mockup Mini Preview */}
                  <div
                    className="w-full rounded-xl p-2 space-y-1.5 relative overflow-hidden border"
                    style={{
                      backgroundColor: themeObj.vars["--bg-app"],
                      borderColor: themeObj.vars["--border-default"],
                    }}
                  >
                    {/* Simulated Header */}
                    <div
                      className="h-5 px-2 rounded-lg flex items-center justify-between border"
                      style={{
                        backgroundColor: themeObj.vars["--bg-header"],
                        borderColor: themeObj.vars["--border-default"],
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: themeObj.vars["--brand-primary"] }}
                        />
                        <span
                          className="w-8 h-1.5 rounded"
                          style={{ backgroundColor: themeObj.vars["--text-primary"], opacity: 0.7 }}
                        />
                      </div>
                      <span
                        className="w-3.5 h-1.5 rounded"
                        style={{ backgroundColor: themeObj.vars["--text-muted"], opacity: 0.5 }}
                      />
                    </div>

                    {/* Simulated Main Content Card */}
                    <div
                      className="p-2 rounded-lg border space-y-1.5"
                      style={{
                        backgroundColor: themeObj.vars["--bg-card"],
                        borderColor: themeObj.vars["--border-default"],
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="w-16 h-2 rounded font-mono"
                          style={{ backgroundColor: themeObj.vars["--text-primary"], opacity: 0.8 }}
                        />
                        <span
                          className="px-1.5 py-0.5 rounded text-[8px] font-bold text-white"
                          style={{ backgroundColor: themeObj.vars["--brand-primary"] }}
                        >
                          FLIGHT
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <span
                          className="flex-1 h-3 rounded"
                          style={{ backgroundColor: themeObj.vars["--bg-app"] }}
                        />
                        <span
                          className="w-6 h-3 rounded"
                          style={{ backgroundColor: themeObj.vars["--brand-secondary"] }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Theme Info */}
                  <div>
                    <h5
                      className="font-bold text-sm leading-tight flex items-center justify-between"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <span>{isAr ? themeObj.nameAr : themeObj.name}</span>
                    </h5>
                    <div
                      className="text-[11px] font-medium opacity-75 mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {themeObj.name}
                    </div>
                    {themeObj.tagAr && (
                      <div
                        className="text-[11px] mt-1 line-clamp-1 opacity-90"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {isAr ? themeObj.tagAr : themeObj.tagAr}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div
                  className="px-3.5 py-2 border-t flex items-center justify-between text-xs font-bold transition"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor: isSelected
                      ? "var(--brand-primary)"
                      : "var(--bg-app)",
                    color: isSelected ? "#ffffff" : "var(--text-primary)",
                  }}
                >
                  <span>{isSelected ? (isAr ? "النمط النشط المعتمد ✓" : "Active Theme ✓") : (isAr ? "تطبيق فوري على المنظومة" : "Apply to System & Portal")}</span>
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/50 shrink-0"
                    style={{ backgroundColor: themeObj.preview }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* ═══ SECTION: EXECUTIVE SCHEDULE BOARD DESIGNS (5 LAYOUT ARCHITECTURES) ═══ */}
      {(activeSubSection === "all" || activeSubSection === "themes" || activeSubSection === "schedule_design") && (
      <section className="p-3.5 rounded-xl space-y-3" style={cardStyle}>
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}
            >
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {isAr
                  ? "تصاميم جدول الرحلات الاحترافية (Schedule Board Designs)"
                  : "Executive Schedule Board Layouts"}
              </h4>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "اختر القالب البصري لجدول العمليات — يتغيّر فوراً كما يمكن تبديله مباشرة من شريط الجدول"
                  : "Switch between 5 OCC layouts anytime here or directly from the Schedule Board toolbar"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
            {SCHEDULE_DESIGNS.length} {isAr ? "تصاميم معتمدة" : "Layouts"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {SCHEDULE_DESIGNS.map((dsn) => {
            const isSel = activeScheduleDesign === dsn.id;
            const pal = dsn.previewPalette || {};
            return (
              <button
                key={dsn.id}
                type="button"
                onClick={() => selectScheduleDesign(dsn.id)}
                className="rounded-xl border transition text-start overflow-hidden flex flex-col justify-between cursor-pointer hover:opacity-95"
                style={{
                  borderColor: isSel ? "var(--brand-primary)" : "var(--border-default)",
                  backgroundColor: "var(--bg-card)",
                  boxShadow: isSel ? "0 0 0 2px var(--brand-accent)" : "none",
                }}
              >
                {/* Miniature Architecture Wireframe */}
                <div className="p-2.5 space-y-2 flex-1 w-full">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold uppercase tracking-wider" style={{ color: dsn.accentColor }}>
                      {dsn.badge}
                    </span>
                    <span style={{ color: isSel ? "var(--brand-primary)" : "var(--text-muted)" }}>
                      {isSel ? (isAr ? "نشط ✓" : "Active ✓") : isAr ? "تطبيق" : "Select"}
                    </span>
                  </div>

                  {/* Mockup Screen Preview */}
                  <div
                    className="rounded-lg p-1.5 border space-y-1"
                    style={{
                      backgroundColor: pal.bg || "#f8fafc",
                      borderColor: pal.border || "#cbd5e1",
                    }}
                  >
                    <div
                      className="h-3 rounded flex items-center justify-between px-1.5"
                      style={{ backgroundColor: pal.header || "#0f172a" }}
                    >
                      <span className="w-8 h-1 rounded bg-white/75" />
                      <span className="w-3 h-1 rounded" style={{ backgroundColor: pal.accent || "#0284c7" }} />
                    </div>

                    {dsn.id === "executive_strips" ? (
                      <div className="space-y-1">
                        {[0, 1].map((r) => (
                          <div
                            key={r}
                            className="p-1 rounded border flex items-center justify-between gap-1"
                            style={{ backgroundColor: pal.surface, borderColor: pal.border }}
                          >
                            <span className="w-6 h-1.5 rounded" style={{ backgroundColor: pal.accent }} />
                            <span className="flex-1 h-1 rounded" style={{ backgroundColor: pal.text, opacity: 0.35 }} />
                            <span className="w-4 h-1.5 rounded" style={{ backgroundColor: pal.muted, opacity: 0.4 }} />
                          </div>
                        ))}
                      </div>
                    ) : dsn.id === "compact_matrix" ? (
                      <div className="space-y-0.5">
                        {[0, 1, 2, 3].map((r) => (
                          <div
                            key={r}
                            className="h-2 px-1 flex items-center gap-1 border-b"
                            style={{ borderColor: pal.border }}
                          >
                            <span className="w-4 h-1 rounded" style={{ backgroundColor: pal.accent }} />
                            <span className="flex-1 h-0.5 rounded" style={{ backgroundColor: pal.text, opacity: 0.4 }} />
                            <span className="w-3 h-1 rounded" style={{ backgroundColor: pal.muted, opacity: 0.5 }} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {[0, 1, 2].map((r) => (
                          <div
                            key={r}
                            className="h-2.5 px-1 rounded flex items-center justify-between gap-1"
                            style={{ backgroundColor: pal.surface, border: `1px solid ${pal.border}` }}
                          >
                            <span className="w-4 h-1 rounded" style={{ backgroundColor: pal.accent }} />
                            <span className="w-7 h-1 rounded" style={{ backgroundColor: pal.text, opacity: 0.65 }} />
                            <span className="w-4 h-1 rounded" style={{ backgroundColor: pal.muted, opacity: 0.5 }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {isAr ? dsn.nameAr : dsn.nameEn}
                    </div>
                    <div className="text-[11px] leading-snug mt-0.5 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {isAr ? dsn.subtitleAr : dsn.subtitleEn}
                    </div>
                  </div>
                </div>

                <div
                  className="w-full px-3 py-1.5 border-t text-[11px] font-bold flex items-center justify-between"
                  style={{
                    borderColor: "var(--border-default)",
                    backgroundColor: isSel ? "var(--brand-primary)" : "var(--bg-app)",
                    color: isSel ? "#ffffff" : "var(--text-primary)",
                  }}
                >
                  <span>{isSel ? (isAr ? "التصميم المعتمد" : "Active Layout") : (isAr ? "تفعيل التصميم" : "Use Layout")}</span>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: dsn.accentColor }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* ═══ SECTION 2 & HEADER TOOLS SIDE-BY-SIDE ═══ */}
      {(activeSubSection === "all" || activeSubSection === "header_nav") && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Left (5 cols): Navigation Layout + Header Tools Mode */}
        <div className="lg:col-span-5 space-y-3">
          <section className="p-3.5 rounded-xl space-y-2.5" style={cardStyle}>
            <h4
              className="text-xs font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
                <Layout className="w-4 h-4" />
              </div>
              <span>{isAr ? "تخطيط شريط التنقل الرئيسي" : "Navigation Layout"}</span>
              {!canChangeNavLayout && <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {[
                {
                  id: "top",
                  icon: Layout,
                  label: isAr ? "أفقي أعلى الصفحة (Top Nav)" : "Top Navigation",
                  desc: isAr ? "شريط علوي مدمج مع قوائم سريعة" : "Classic horizontal bar with dropdowns",
                },
                {
                  id: "side",
                  icon: PanelLeft,
                  label: isAr ? "جانبي عمودي (Sidebar)" : "Side Navigation",
                  desc: isAr ? "قائمة جانبية قابلة للطي لعمليات الطيران" : "Vertical collapsible sidebar",
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const isActive = (draft.navLayout || "top") === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canChangeNavLayout}
                    onClick={() => setDraft({ ...draft, navLayout: opt.id })}
                    className="p-2.5 rounded-lg border-2 transition flex items-center gap-2.5 text-start disabled:opacity-60 cursor-pointer"
                    style={{
                      borderColor: isActive ? "var(--brand-primary)" : "var(--border-default)",
                      backgroundColor: isActive ? "var(--bg-app)" : "var(--bg-card)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isActive ? "var(--brand-primary)" : "var(--bg-app)",
                        color: isActive ? "#ffffff" : "var(--brand-primary)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate" style={{ color: isActive ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-3.5 rounded-xl space-y-2.5" style={cardStyle}>
            <div>
              <h4 className="text-xs font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <span>{isAr ? "نمط أدوات الشريط العلوي" : "Top Header Tools Display Mode"}</span>
              </h4>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "تحكم في عرض الأدوات مباشرة على الشريط أو تجميعها داخل زر 3 أشرطة"
                  : "Show tool buttons directly on top bar or group them inside the 3-bars menu"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {[
                {
                  id: "direct",
                  icon: Grid,
                  label: isAr ? "عرض مباشر على الشريط (Direct)" : "Direct on Header Bar",
                  desc: isAr ? "أزرار مستقلة على الشريط العلوي" : "Separate buttons on top bar",
                },
                {
                  id: "menu",
                  icon: Menu,
                  label: isAr ? "تجميع داخل 3 أشرطة (Grouped Menu)" : "Grouped in 3-Bars Menu",
                  desc: isAr ? "تجميع الأدوات داخل قائمة مختصرة أنيقة" : "Collapse tools in a clean menu",
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const currentVal =
                  draft.headerToolsLayout ||
                  (typeof window !== "undefined" && localStorage.getItem("aeroops.headerToolsLayout")) ||
                  "direct";
                const isActive = currentVal === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!canConfigureHeaderTools}
                    onClick={() => {
                      const nextDraft = { ...draft, headerToolsLayout: opt.id };
                      setDraft(nextDraft);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("aeroops.headerToolsLayout", opt.id);
                        window.dispatchEvent(new Event("aeroops:headerToolsLayoutChanged"));
                      }
                      notifyAndSyncLive(nextDraft);
                      showToast(
                        isAr
                          ? opt.id === "menu"
                            ? "تم تفعيل نمط تجميع الأيقونات داخل قائمة 3 أشرطة"
                            : "تم تفعيل نمط العرض المباشر للأيقونات على الشريط"
                          : "Header tools layout updated"
                      );
                    }}
                    className="p-2.5 rounded-lg border-2 transition flex items-center gap-2.5 text-start cursor-pointer disabled:opacity-50"
                    style={{
                      borderColor: isActive ? "var(--brand-primary)" : "var(--border-default)",
                      backgroundColor: isActive ? "var(--bg-app)" : "var(--bg-card)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isActive ? "var(--brand-primary)" : "var(--bg-app)",
                        color: isActive ? "#ffffff" : "var(--brand-primary)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate" style={{ color: isActive ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right (7 cols): Header Tools Items Reordering & Visibility (Semantic CSS Vars) */}
        <section className="lg:col-span-7 p-3.5 rounded-xl space-y-2.5" style={cardStyle}>
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
                <Menu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  {isAr
                    ? "ترتيب وإظهار الأيقونات في الشريط الرئيسي وقائمة 3 أشرطة"
                    : "Top Bar & Grouped Menu Items Order & Visibility"}
                </h4>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "حدد كل أداة: مباشرة على الشريط أم في القائمة المجمعة ورتّب ظهورها" : "Choose direct bar vs grouped menu per tool and reorder"}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}>
              {headerToolsList.filter((t) => t.enabled).length} / {headerToolsList.length} {isAr ? "مُفعّل" : "Active"}
            </span>
          </div>

          <div className="space-y-1.5">
            {headerToolsList.map((tool, idx) => {
              const ToolIcon =
                tool.id === "airports"
                  ? Compass
                  : tool.id === "settings"
                  ? SettingsIcon
                  : tool.id === "lang"
                  ? Globe
                  : tool.id === "notifications"
                  ? Bell
                  : tool.id === "directory"
                  ? Phone
                  : Sun;

              return (
                <div
                  key={tool.id}
                  className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 ${
                    tool.enabled ? "" : "opacity-55"
                  }`}
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      #{idx + 1}
                    </span>

                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <ToolIcon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {isAr ? tool.label_ar : tool.label_en}
                      </div>
                      <div className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                        {tool.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!canConfigureHeaderTools}
                      onClick={() => handleToggleHeaderToolDirect(tool.id)}
                      className="px-2 py-1 rounded-md text-[10px] font-bold border transition flex items-center gap-1 cursor-pointer disabled:opacity-45"
                      style={
                        tool.showDirect !== false
                          ? {
                              backgroundColor: "rgba(14, 165, 233, 0.12)",
                              color: "var(--brand-primary)",
                              borderColor: "rgba(14, 165, 233, 0.35)",
                            }
                          : {
                              backgroundColor: "var(--bg-card)",
                              color: "var(--text-primary)",
                              borderColor: "var(--border-default)",
                            }
                      }
                      title={isAr ? "تبديل بين العرض المباشر أو قائمة 3 أشرطة" : "Toggle Direct vs Grouped Menu"}
                    >
                      {tool.showDirect !== false ? (
                        <>
                          <Zap className="w-3 h-3" />
                          <span>{isAr ? "مباشر" : "Direct"}</span>
                        </>
                      ) : (
                        <>
                          <Menu className="w-3 h-3" />
                          <span>{isAr ? "3 أشرطة" : "Menu"}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={!canConfigureHeaderTools || idx === 0}
                      onClick={() => handleMoveHeaderToolUp(idx)}
                      className="p-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                      title={isAr ? "تحريك لأعلى" : "Move Up"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={!canConfigureHeaderTools || idx === headerToolsList.length - 1}
                      onClick={() => handleMoveHeaderToolDown(idx)}
                      className="p-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                      title={isAr ? "تحريك لأسفل" : "Move Down"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <label className="flex items-center gap-1 cursor-pointer ms-1">
                      <input
                        type="checkbox"
                        disabled={!canConfigureHeaderTools}
                        checked={tool.enabled}
                        onChange={() => handleToggleHeaderTool(tool.id)}
                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>
                        {tool.enabled ? (isAr ? "مفعل" : "On") : (isAr ? "مخفي" : "Off")}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      )}

      {/* ═══ SECTION: CREW PORTAL ICONS & STYLE (تخصيص أيقونات ونمط بوابة الطاقم) ═══ */}
      {(activeSubSection === "all" || activeSubSection === "portal") && (
      <section className="p-3.5 rounded-xl space-y-3" style={cardStyle}>
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Sparkles className="w-4 h-4 text-amber-500" />
              {isAr ? "نمط وأيقونات بوابة الطاقم (Crew Portal)" : "Crew Portal Icons & Style"}
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "تخصيص أيقونات الأقسام ونمط عرضها على بوابات الطاقم (بدون إيموجي - عصرية واحترافية)"
                : "Customize icon style and individual tab icons across Crew Portal (Clean & modern, no emojis)"}
            </p>
          </div>
        </div>

        {/* Icon Style Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold block" style={{ color: "var(--text-primary)" }}>
            {isAr ? "نمط التصميم البصري للأيقونات في كرو بورتال:" : "Crew Portal Visual Icon Style:"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: "vector3d",
                label: isAr ? "ثلاثية الأبعاد (3D Vector)" : "3D Vector Illuminated",
                desc: isAr ? "أيقونات ثلاثية الأبعاد مجسمة بلمعان تفاعلي" : "3D isometric illuminated vector icons",
                Icon: Layers,
              },
              {
                id: "minimalist",
                label: isAr ? "خطية عصرية (Lucide Minimalist)" : "Modern Minimalist Lines",
                desc: isAr ? "أيقونات خطية عصرية مدمجة وأنيقة" : "Clean vector line icons with accent tint",
                Icon: Grid,
              },
              {
                id: "glassmorphism",
                label: isAr ? "زجاجية متوهجة (Glassmorphism)" : "Glass Badged Glow",
                desc: isAr ? "أيقونات شفافة زجاجية بتأثير التوهج" : "Glass frosted badge with ambient glow",
                Icon: Sparkles,
              },
              {
                id: "watermark_logo",
                label: isAr ? "شعار الشركة المائي (Watermark Logo)" : "Company Logo Watermark",
                desc: isAr ? "عرض شعار الشركة خلفية مائية شفافة خلف الأيقونات والكروت" : "Company logo watermark displayed behind icons & cards",
                Icon: ImageIcon,
              },
            ].map((st) => {
              const StIcon = st.Icon;
              const isActive = (draft.portalIconStyle || "vector3d") === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    const updated = { ...draft, portalIconStyle: st.id };
                    setDraft(updated);
                    notifyAndSyncLive(updated);
                  }}
                  className="p-3 rounded-xl border-2 transition text-start flex flex-col justify-between cursor-pointer"
                  style={{
                    borderColor: isActive ? "var(--brand-primary)" : "var(--border-default)",
                    backgroundColor: isActive ? "var(--bg-app)" : "var(--bg-card)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <StIcon
                      className="w-5 h-5"
                      style={{ color: isActive ? "var(--brand-primary)" : "var(--text-muted)" }}
                    />
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                        {isAr ? "محدد" : "Selected"}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {st.label}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {st.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Watermark Logo Customization Subsection */}
        <div
          className="p-3.5 rounded-xl border space-y-3"
          style={{
            backgroundColor: "var(--bg-app)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <ImageIcon className="w-4 h-4 text-sky-500" />
                <span>{isAr ? "إعدادات شعار الشركة المائي في كرو بورتال:" : "Watermark Logo Settings:"}</span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "يُعرض هذا الشعار كعلامة مائية شفافة أنيقة خلف كروت وأيقونات الطاقم عند اختيار نمط «شعار الشركة المائي»"
                  : "Rendered as a watermark background behind Crew Portal cards when Watermark Logo style is active"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={watermarkRef}
                type="file"
                accept="image/*"
                onChange={uploadWatermarkLogo}
                className="hidden"
                disabled={!editable || uploadingWatermark}
              />
              <button
                type="button"
                onClick={() => watermarkRef.current?.click()}
                disabled={!editable || uploadingWatermark}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingWatermark ? "…" : isAr ? "تغيير الشعار المائي" : "Upload Watermark Logo"}</span>
              </button>
              {draft.portalWatermarkLogo && (
                <button
                  type="button"
                  onClick={removeWatermarkLogo}
                  disabled={!editable}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition"
                  title={isAr ? "إزالة واستخدام الشعار الرئيسي" : "Remove & use main logo"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Opacity Slider & Live Watermark Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center pt-2 border-t" style={{ borderColor: "var(--border-default)" }}>
            <div className="md:col-span-2 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span style={{ color: "var(--text-primary)" }}>
                  {isAr ? "درجة شفافية الشعار المائي (Opacity):" : "Watermark Opacity:"}
                </span>
                <span className="font-mono text-sky-500">
                  {Math.round((draft.portalWatermarkOpacity ?? 0.18) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={draft.portalWatermarkOpacity ?? 0.18}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const updated = { ...draft, portalWatermarkOpacity: val };
                  setDraft(updated);
                  notifyAndSyncLive(updated);
                }}
                className="w-full cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span>{isAr ? "خفيف جداً (5%)" : "Subtle (5%)"}</span>
                <span>{isAr ? "قياسي (18%)" : "Standard (18%)"}</span>
                <span>{isAr ? "بارز (50%)" : "Prominent (50%)"}</span>
              </div>
            </div>

            {/* Mini Card Preview */}
            <div
              className="relative p-3 rounded-xl border flex flex-col items-center justify-center text-center overflow-hidden min-h-[90px]"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
              }}
            >
              {/* Background Watermark Preview */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-2">
                {toDisplayImageUrl(draft.portalWatermarkLogo || settings?.logo) ? (
                  <img
                    src={toDisplayImageUrl(draft.portalWatermarkLogo || settings?.logo)}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain"
                    style={{ opacity: draft.portalWatermarkOpacity ?? 0.18 }}
                  />
                ) : (
                  <Shield
                    className="w-12 h-12 text-muted-foreground"
                    style={{ opacity: draft.portalWatermarkOpacity ?? 0.18 }}
                  />
                )}
              </div>

              {/* Foreground content mockup */}
              <div className="relative z-10 space-y-1">
                <Plane className="w-5 h-5 mx-auto" style={{ color: "var(--brand-primary)" }} />
                <span className="font-bold text-xs block" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "معاينة كارت الطاقم" : "Crew Card Preview"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Individual Tab Customization */}
        <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--border-default)" }}>
          <label className="text-xs font-bold block" style={{ color: "var(--text-primary)" }}>
            {isAr ? "تخصيص أيقونات الأقسام الفردية:" : "Individual Tab Icons Customization:"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {PORTAL_TABS_CUSTOM_CONFIG.map((pt) => {
              const currentIconName = draft.portalCustomIcons?.[pt.id] || pt.defaultIcon;
              return (
                <div
                  key={pt.id}
                  className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                  style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {isAr ? pt.label_ar : pt.label_en}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {currentIconName}
                    </div>
                  </div>
                  <select
                    value={currentIconName}
                    onChange={(e) => {
                      const nextCustom = {
                        ...(draft.portalCustomIcons || {}),
                        [pt.id]: e.target.value,
                      };
                      const updated = { ...draft, portalCustomIcons: nextCustom };
                      setDraft(updated);
                      notifyAndSyncLive(updated);
                    }}
                    className="bg-transparent text-xs font-bold border rounded px-2 py-1 focus:outline-none cursor-pointer"
                    style={{
                      borderColor: "var(--border-default)",
                      color: "var(--brand-primary)",
                      backgroundColor: "var(--bg-card)",
                    }}
                  >
                    {pt.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ═══ SECTION 3 & 4: MENUS & TAB PREFERENCES (FULL-PAGE 12-COL GRID) ═══ */}
      {(activeSubSection === "all" || activeSubSection === "menus_tabs") && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className="lg:col-span-5 space-y-3">
      <section className="p-3.5 rounded-xl" style={cardStyle}>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Layers className="w-4 h-4 text-brand-primary" style={{ color: "var(--brand-primary)" }} />
              {isAr
                ? "إدارة القوائم المنسدلة الإضافية (مثل 'المزيد')"
                : "Custom Dropdown Menus (like 'More')"}
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "يمكنك إنشاء وتسمية قوائم منسدلة جديدة لتجميع التبويبات حسب رغبتك (مثل: العمليات، السلامة، الإدارة، الأدلة) وتحديد أيقونتها"
                : "Create custom dropdown menus to group your modules (e.g. Operations, Safety, Admin) and pick custom icons"}
            </p>
          </div>

          <button
            type="button"
            disabled={!canChangeTabPrefs}
            onClick={() => {
              setEditingMenu(null);
              setMenuDraft({
                id: "",
                label_ar: "",
                label_en: "",
                icon: "Layers",
              });
              setMenuModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? "إضافة قائمة جديدة" : "Add New Menu"}</span>
          </button>
        </div>

        {customMenus.length === 0 ? (
          <div
            className="p-6 rounded-xl border border-dashed text-center flex flex-col items-center justify-center gap-2"
            style={{
              borderColor: "var(--border-default)",
              backgroundColor: "var(--bg-app)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                color: "var(--brand-primary)",
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {isAr ? "لا توجد قوائم إضافية مخصصة حتى الآن" : "No custom dropdown menus yet"}
            </div>
            <div className="text-[11px] max-w-sm text-center" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "انقر على زر 'إضافة قائمة جديدة' أعلاه لإنشاء قائمة منسدلة خاصة مثل (المزيد) وتجميع التبويبات بداخلها."
                : "Click 'Add New Menu' above to create a custom dropdown menu like 'More' and assign modules into it."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {customMenus.map((cm, index) => {
              const MenuIcon = getMenuIconComponent(cm.icon);
              const tabsCount = getMenuTabsCount(cm.id);
              return (
                <div
                  key={cm.id}
                  className="p-2.5 rounded-lg border transition flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "rgba(37, 99, 235, 0.1)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <MenuIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-sm font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {isAr ? cm.label_ar || cm.label_en : cm.label_en || cm.label_ar}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="truncate">{isAr ? cm.label_en : cm.label_ar}</span>
                        <span>•</span>
                        <span className="font-semibold text-brand-primary" style={{ color: "var(--brand-primary)" }}>
                          {tabsCount} {isAr ? "تبويب" : "tabs"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || index === 0}
                      onClick={() => moveCustomMenu(index, "up")}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-30"
                      title={isAr ? "تقديم القائمة للأعلى في الشريط" : "Move Menu Up"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || index === customMenus.length - 1}
                      onClick={() => moveCustomMenu(index, "down")}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-30"
                      title={isAr ? "تأخير القائمة للأسفل في الشريط" : "Move Menu Down"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={!canChangeTabPrefs}
                      onClick={() => {
                        setEditingMenu(cm);
                        setMenuDraft({
                          id: cm.id,
                          label_ar: cm.label_ar || "",
                          label_en: cm.label_en || "",
                          icon: cm.icon || "Layers",
                        });
                        setMenuModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700/60 disabled:opacity-50"
                      style={{ color: "var(--brand-primary)" }}
                      title={isAr ? "تعديل الاسم أو الأيقونة" : "Edit Name or Icon"}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs}
                      onClick={() => handleDeleteMenu(cm.id)}
                      className="p-1.5 rounded-lg transition hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 disabled:opacity-50"
                      title={isAr ? "حذف القائمة" : "Delete Menu"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ SECTION 3.5: UNIFIED TOP BAR DISPLAY & ORDERING ═══ */}
      <section className="p-3.5 rounded-xl" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4
              className="text-sm font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Layout className="w-4 h-4 text-brand-primary" style={{ color: "var(--brand-primary)" }} />
              {isAr
                ? "ترتيب وتداخل عناصر شريط التنقل العلوي المباشر"
                : "Top Navigation Bar Unified Items Order"}
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "التحكم في الترتيب المباشر لجميع التبويبات والقوائم المنسدلة (بما فيها قائمة 'المزيد') على شريط التنقل العلوي في الواجهة. يمكنك ترتيبها بأي تسلسل تريده وتتحدث فورياً"
                : "Reorder primary tabs, custom dropdown menus, and the 'More' menu seamlessly across the top navigation bar"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {unifiedTopBarElements.map((el, idx) => {
            const IconComp = el.icon || Layers;
            const label = isAr ? el.label_ar : el.label_en;

            return (
              <div
                key={`top_bar_el_${el.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border transition"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === 0}
                      onClick={() => moveTopBarItem(el.id, "up")}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-20 text-slate-500 cursor-pointer"
                      title={isAr ? "تقديم العنصر للأمام في الشريط" : "Move Item Left/Up"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === unifiedTopBarElements.length - 1}
                      onClick={() => moveTopBarItem(el.id, "down")}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-20 text-slate-500 cursor-pointer"
                      title={isAr ? "تأخير العنصر للخلف في الشريط" : "Move Item Right/Down"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        el.kind === "tab"
                          ? "rgba(37, 99, 235, 0.1)"
                          : el.kind === "menu"
                          ? "rgba(147, 51, 234, 0.1)"
                          : "rgba(245, 158, 11, 0.1)",
                      color:
                        el.kind === "tab"
                          ? "var(--brand-primary)"
                          : el.kind === "menu"
                          ? "#9333ea"
                          : "#d97706",
                    }}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {label}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <span>{el.id}</span>
                      <span>•</span>
                      <span className="font-semibold">
                        {el.kind === "tab"
                          ? (isAr ? "تبويب مباشر" : "Direct Tab")
                          : el.kind === "menu"
                          ? (isAr ? "قائمة منسدلة مخصصة" : "Custom Dropdown Menu")
                          : (isAr ? "قائمة المزيد (More)" : "More Menu")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold border"
                    style={
                      el.kind === "tab"
                        ? {
                            backgroundColor: "rgba(37, 99, 235, 0.1)",
                            color: "var(--brand-primary)",
                            borderColor: "rgba(37, 99, 235, 0.3)",
                          }
                        : el.kind === "menu"
                        ? {
                            backgroundColor: "rgba(147, 51, 234, 0.1)",
                            color: "#9333ea",
                            borderColor: "rgba(147, 51, 234, 0.3)",
                          }
                        : {
                            backgroundColor: "rgba(245, 158, 11, 0.1)",
                            color: "#d97706",
                            borderColor: "rgba(245, 158, 11, 0.3)",
                          }
                    }
                  >
                    #{idx + 1} {isAr ? "في الشريط" : "on Bar"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
        </div>

      {/* ═══ SECTION 4: TAB PREFERENCES & VISIBILITY (7 cols) ═══ */}
      <section className="lg:col-span-7 p-3.5 rounded-xl" style={cardStyle}>
        <h4
          className="text-sm font-bold mb-1.5 flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          <Sparkles className="w-4 h-4" />
          {isAr ? "تخصيص وترتيب تبويبات المنظومة" : "Tab Preferences & Visibility"}
          {!canChangeTabPrefs && (
            <Lock
              className="w-3.5 h-3.5"
              style={{ color: "var(--text-muted)" }}
              title="ليس لديك صلاحية تخصيص التبويبات"
            />
          )}
        </h4>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          {isAr
            ? "اختر موضع وترتيب كل تبويب في الواجهة: يمكنك التقديم/التأخير بأزرار الأسهم، وتعيين التبويب إما في الشريط الأساسي المباشر، أو تحت إحدى القوائم المنسدلة المخصصة، أو مخفياً"
            : "Reorder and choose which tabs appear in the primary bar, under a custom dropdown menu, or hidden entirely"}
        </p>

        <div className="space-y-1.5 mt-2 max-h-96 overflow-y-auto pr-1">
          {sortedTabs.map((tab, idx) => {
            const Icon = tab.icon;
            const label = isAr ? tab.label_ar : tab.label_en;
            const position = getTabPosition(tab.id);
            const isCustom = customMenus.some((m) => m.id === position);
            const activeCustomMenu = customMenus.find((m) => m.id === position);

            return (
              <div
                key={tab.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border transition"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Move Up / Down Buttons for Tab */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === 0}
                      onClick={() => moveTab(tab.id, "up")}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-20 text-slate-500"
                      title={isAr ? "تقديم التبويب للأعلى" : "Move Up"}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === sortedTabs.length - 1}
                      onClick={() => moveTab(tab.id, "down")}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition disabled:opacity-20 text-slate-500"
                      title={isAr ? "تأخير التبويب للأسفل" : "Move Down"}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--bg-app)" }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: "var(--brand-primary)" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-xs sm:text-sm font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {label}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {tab.id}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                  {/* Current Position Badge */}
                  <span
                    className="px-2 py-1 rounded-md text-[11px] font-bold border flex items-center gap-1 shrink-0"
                    style={
                      position === "primary"
                        ? {
                            backgroundColor: "rgba(37, 99, 235, 0.1)",
                            color: "var(--brand-primary)",
                            borderColor: "rgba(37, 99, 235, 0.3)",
                          }
                        : position === "more"
                        ? {
                            backgroundColor: "rgba(245, 158, 11, 0.1)",
                            color: "#d97706",
                            borderColor: "rgba(245, 158, 11, 0.3)",
                          }
                        : isCustom
                        ? {
                            backgroundColor: "rgba(147, 51, 234, 0.1)",
                            color: "#9333ea",
                            borderColor: "rgba(147, 51, 234, 0.3)",
                          }
                        : {
                            backgroundColor: "var(--bg-app)",
                            color: "var(--text-muted)",
                            borderColor: "var(--border-default)",
                          }
                    }
                  >
                    {position === "primary" && (isAr ? "الشريط الأساسي" : "Primary Bar")}
                    {position === "more" && (isAr ? "قائمة المزيد (More)" : "More Menu")}
                    {isCustom && (
                      <>
                        <Layers className="w-3 h-3" />
                        <span>{isAr ? activeCustomMenu?.label_ar : activeCustomMenu?.label_en}</span>
                      </>
                    )}
                    {position === "hidden" && (isAr ? "مخفي" : "Hidden")}
                  </span>

                  {/* Destination Dropdown */}
                  <select
                    disabled={!canChangeTabPrefs}
                    value={position}
                    onChange={(e) => setTabPosition(tab.id, e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border transition bg-transparent cursor-pointer disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-primary)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <option value="primary" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      {isAr ? "الشريط الأساسي (Top Bar)" : "Primary Bar"}
                    </option>
                    <option value="more" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      {isAr ? "قائمة المزيد (More)" : "More Menu"}
                    </option>
                    {customMenus.length > 0 && (
                      <optgroup label={isAr ? "القوائم الإضافية المخصصة" : "Custom Menus"}>
                        {customMenus.map((cm) => (
                          <option
                            key={cm.id}
                            value={cm.id}
                            style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}
                          >
                            {isAr ? cm.label_ar || cm.label_en : cm.label_en || cm.label_ar}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="hidden" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      {isAr ? "مخفي تماماً (Hidden)" : "Hidden"}
                    </option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="flex gap-2 mt-4 pt-4"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <button
            type="button"
            disabled={!canChangeTabPrefs}
            onClick={resetToDefault}
            className="px-3 py-2 rounded-xl text-xs font-bold transition disabled:opacity-60 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-app)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
          >
            {isAr ? "استعادة التفضيلات الافتراضية" : "Reset Tabs to Default"}
          </button>
        </div>
      </section>
      </div>
      )}

      {/* ═══ SECTION 5: CREW CONTACT CARD SETTINGS (تخصيص بطاقة معلومات الطاقم) ═══ */}
      {(activeSubSection === "all" || activeSubSection === "crew_card") && (
      <section className="p-3.5 rounded-xl" style={cardStyle}>
        {/* Section Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                color: "var(--brand-primary)",
              }}
            >
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                {isAr ? "تخصيص بطاقة معلومات الطاقم (Crew Contact Card)" : "Crew Contact Card Customization"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "تحكم دقيق في حجم، وحقول، وطريقة تفاعل بطاقة الطاقم التفاعلية عند تمرير الفأرة أو النقر في جدول الرحلات وسكجول"
                  : "Full control over card size, display fields, and trigger mode in Schedule & FTL boards"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => updateCrewCardConfig(DEFAULT_CREW_CARD_CONFIG)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition border hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            {isAr ? "استعادة الافتراضي" : "Reset Card"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Controls (Cols 1-7) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Card Size / Zoom Selector (xs..xl) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                  <Sliders className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isAr ? "حجم وتكبير البطاقة (Zoom / Size)" : "Card Zoom & Size"}</span>
                </label>
                <div className="flex items-center gap-1">
                  {(() => {
                    const order = ["xs", "sm", "md", "lg", "xl"];
                    const curIdx = Math.max(0, order.indexOf(crewCardDraft.cardSize || "sm"));
                    return (
                      <>
                        <button
                          type="button"
                          disabled={curIdx === 0}
                          onClick={() => updateCrewCardConfig({ cardSize: order[curIdx - 1] })}
                          className="px-2 py-0.5 rounded border text-xs font-mono font-bold disabled:opacity-40 cursor-pointer"
                          style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
                          title={isAr ? "تصغير أكثر" : "Zoom Out"}
                        >
                          −
                        </button>
                        <span className="px-2 py-0.5 text-[11px] font-mono tabular-nums font-bold text-blue-600">
                          {CREW_CARD_SIZE_MAP[order[curIdx]]?.width || 248}px
                        </span>
                        <button
                          type="button"
                          disabled={curIdx === order.length - 1}
                          onClick={() => updateCrewCardConfig({ cardSize: order[curIdx + 1] })}
                          className="px-2 py-0.5 rounded border text-xs font-mono font-bold disabled:opacity-40 cursor-pointer"
                          style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
                          title={isAr ? "تكبير أكثر" : "Zoom In"}
                        >
                          +
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: "xs", label_ar: "مصغّرة", label_en: "XS", w: "215px" },
                  { id: "sm", label_ar: "مدمجة ★", label_en: "SM ★", w: "248px" },
                  { id: "md", label_ar: "متوسطة", label_en: "MD", w: "290px" },
                  { id: "lg", label_ar: "كبيرة", label_en: "LG", w: "340px" },
                  { id: "xl", label_ar: "موسّعة", label_en: "XL", w: "390px" },
                ].map((s) => {
                  const isSel = (crewCardDraft.cardSize || "sm") === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateCrewCardConfig({ cardSize: s.id })}
                      className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                        isSel
                          ? "ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-500/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                      style={{
                        backgroundColor: isSel ? undefined : "var(--bg-app)",
                        borderColor: isSel ? undefined : "var(--border-default)",
                      }}
                    >
                      <div className="text-[11px] font-bold" style={{ color: isSel ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {isAr ? s.label_ar : s.label_en}
                      </div>
                      <div className="text-[9.5px] font-mono tabular-nums text-muted-foreground mt-0.5">
                        {s.w}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Trigger Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <MousePointer className="w-3.5 h-3.5 text-blue-500" />
                <span>{isAr ? "طريقة الفتح والتفاعل (Trigger Mode)" : "Trigger Mode"}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    id: "both",
                    label_ar: "تمرير ونقر (Both)",
                    label_en: "Hover & Click",
                    desc_ar: "يفتح بالمرور أو الضغط",
                  },
                  {
                    id: "hover",
                    label_ar: "تمرير فقط (Hover)",
                    label_en: "Hover Only",
                    desc_ar: "يفتح عند الوقوف بالمؤشر",
                  },
                  {
                    id: "click",
                    label_ar: "نقر فقط (Click)",
                    label_en: "Click Only",
                    desc_ar: "يفتح عند الضغط بالماوس",
                  },
                ].map((m) => {
                  const isSel = (crewCardDraft.triggerMode || "both") === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateCrewCardConfig({ triggerMode: m.id })}
                      className={`p-2.5 rounded-xl border text-start transition cursor-pointer ${
                        isSel
                          ? "ring-2 ring-blue-500/50 bg-blue-500/10 border-blue-500/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                      style={{
                        backgroundColor: isSel ? undefined : "var(--bg-app)",
                        borderColor: isSel ? undefined : "var(--border-default)",
                      }}
                    >
                      <div className="text-xs font-bold" style={{ color: isSel ? "var(--brand-primary)" : "var(--text-primary)" }}>
                        {isAr ? m.label_ar : m.label_en}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {m.desc_ar}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Display Field Toggles */}
            <div className="space-y-2.5">
              <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                <span>{isAr ? "الحقول والمعلومات المعروضة (Visible Information)" : "Visible Fields & Information"}</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    key: "showAvatar",
                    label_ar: "صورة الطاقم / الرمز",
                    label_en: "Crew Photo / Avatar",
                    icon: User,
                  },
                  {
                    key: "showEmpNo",
                    label_ar: "كود الطاقم ورقم الموظف (#EMP)",
                    label_en: "Employee ID Code (#EMP)",
                    icon: Hash,
                  },
                  {
                    key: "showRole",
                    label_ar: "الرتبة والوظيفة (CP/FO/CC)",
                    label_en: "Role & Rank Badge",
                    icon: ShieldCheck,
                  },
                  {
                    key: "showBase",
                    label_ar: "مقر العمل والمحطة الرئيسية (Base)",
                    label_en: "Duty Station Base",
                    icon: MapPin,
                  },
                  {
                    key: "showPhone",
                    label_ar: "رقم الهاتف وزر الاتصال السريع",
                    label_en: "Phone & Quick Call Button",
                    icon: Phone,
                  },
                  {
                    key: "showWhatsApp",
                    label_ar: "زر مراسلة واتساب المباشرة",
                    label_en: "1-Click WhatsApp Button",
                    icon: MessageCircle,
                  },
                  {
                    key: "showEmail",
                    label_ar: "البريد الإلكتروني وزر المراسلة",
                    label_en: "Email & Send Mail Button",
                    icon: Mail,
                  },
                  {
                    key: "showFtlStats",
                    label_ar: "ساعات الخدمة والقطاعات (FTL)",
                    label_en: "Daily FTL Stats & Progress",
                    icon: Clock,
                  },
                  {
                    key: "showFtlAlert",
                    label_ar: "تمييز الطاقم بالأحمر عند تجاوز الحد",
                    label_en: "Red Exceedance Alert & Shield",
                    icon: ShieldAlert,
                  },
                ].map((item) => {
                  const isChecked = crewCardDraft[item.key] !== false;
                  const IconComp = item.icon;
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-2.5 rounded-xl border cursor-pointer hover:opacity-90 transition"
                      style={{
                        backgroundColor: isChecked ? "rgba(37, 99, 235, 0.05)" : "var(--bg-app)",
                        borderColor: isChecked ? "rgba(37, 99, 235, 0.3)" : "var(--border-default)",
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {isAr ? item.label_ar : item.label_en}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => updateCrewCardConfig({ [item.key]: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Interactive Preview (Cols 8-12) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="text-xs font-extrabold flex items-center justify-between mb-2" style={{ color: "var(--text-primary)" }}>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isAr ? "معاينة حية ومباشرة (Live Preview)" : "Live Interactive Preview"}</span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {isAr ? "تتغير فوراً مع خياراتك" : "Updates dynamically"}
              </span>
            </div>

            <div
              className="p-4 rounded-xl border flex-1 flex flex-col items-center justify-center space-y-4"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                minHeight: "360px",
              }}
            >
              {/* Interactive badge test */}
              <div className="text-center space-y-1">
                <div className="text-[11px] text-muted-foreground font-medium">
                  {isAr ? "جرّب التفاعل مع كود الطاقم في الجدول:" : "Test trigger badge as in Schedule:"}
                </div>
                <div className="inline-block p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10">
                  <CrewContactCard
                    member={{
                      id: "preview-pilot",
                      fullName: isAr ? "كابتن أحمد المنصوري" : "Capt. Ahmed Al-Mansouri",
                      role: "CP",
                      rank: "Captain",
                      empNo: "1042",
                      base: "TIP",
                      phone: "+218912345678",
                      email: "a.mansouri@airline.com",
                      avatar: null,
                    }}
                    flights={[
                      {
                        id: "pf-1",
                        std: new Date().toISOString().slice(0, 10) + "T06:00:00Z",
                        sta: new Date().toISOString().slice(0, 10) + "T09:30:00Z",
                        crewSlots: [{ crewId: "preview-pilot" }],
                      },
                      {
                        id: "pf-2",
                        std: new Date().toISOString().slice(0, 10) + "T11:00:00Z",
                        sta: new Date().toISOString().slice(0, 10) + "T15:00:00Z",
                        crewSlots: [{ crewId: "preview-pilot" }],
                      },
                      {
                        id: "pf-3",
                        std: new Date().toISOString().slice(0, 10) + "T16:00:00Z",
                        sta: new Date().toISOString().slice(0, 10) + "T20:30:00Z",
                        crewSlots: [{ crewId: "preview-pilot" }],
                      },
                      {
                        id: "pf-4",
                        std: new Date().toISOString().slice(0, 10) + "T21:00:00Z",
                        sta: new Date().toISOString().slice(0, 10) + "T23:30:00Z",
                        crewSlots: [{ crewId: "preview-pilot" }],
                      },
                    ]}
                    configOverride={crewCardDraft}
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border cursor-pointer transition ${
                        crewCardDraft.showFtlAlert !== false
                          ? "bg-rose-500 text-white border-rose-600 font-black"
                          : "bg-blue-500/15 text-blue-600 border-blue-500/30"
                      }`}
                    >
                      1042
                    </span>
                  </CrewContactCard>
                </div>
                <div className="text-[10px] text-muted-foreground italic">
                  {crewCardDraft.triggerMode === "click"
                    ? (isAr ? "(انقر بالماوس على الرقم 1042 لفتح البطاقة)" : "(Click badge 1042 to open card)")
                    : (isAr ? "(مرر الفأرة أو انقر على الرقم 1042 لفتح البطاقة)" : "(Hover or click badge 1042 to open card)")}
                </div>
              </div>

              {/* Static Preview of Card Content */}
              <div
                className={`rounded-xl border shadow-xl space-y-2 text-xs transition-all max-w-full ${
                  crewCardDraft.cardSize === "xs" || crewCardDraft.cardSize === "sm" ? "p-2.5" : "p-3.5"
                }`}
                style={{
                  width: CREW_CARD_SIZE_MAP[crewCardDraft.cardSize || "sm"]?.width || 248,
                  backgroundColor: "var(--bg-card)",
                  borderColor:
                    crewCardDraft.showFtlAlert !== false ? "rgba(225, 29, 72, 0.45)" : "var(--border-default)",
                  color: "var(--text-primary)",
                  boxShadow:
                    crewCardDraft.showFtlAlert !== false
                      ? "0 10px 25px -5px rgba(225, 29, 72, 0.25)"
                      : "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                }}
              >
                {/* Header */}
                <div className="flex items-start gap-2 pb-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
                  {crewCardDraft.showAvatar !== false && (
                    <div
                      className={`${
                        crewCardDraft.cardSize === "xs"
                          ? "w-7 h-7"
                          : crewCardDraft.cardSize === "sm"
                            ? "w-8 h-8"
                            : crewCardDraft.cardSize === "lg" || crewCardDraft.cardSize === "xl"
                              ? "w-11 h-11"
                              : "w-9 h-9"
                      } rounded-lg bg-slate-100 dark:bg-slate-800 border shrink-0 flex items-center justify-center`}
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div
                      className={`font-bold truncate ${
                        crewCardDraft.cardSize === "xs" || crewCardDraft.cardSize === "sm"
                          ? "text-[11px]"
                          : crewCardDraft.cardSize === "lg" || crewCardDraft.cardSize === "xl"
                            ? "text-sm"
                            : "text-xs"
                      }`}
                    >
                      {isAr ? "كابتن أحمد المنصوري" : "Capt. Ahmed Al-Mansouri"}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {crewCardDraft.showRole !== false && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          CP (Captain)
                        </span>
                      )}
                      {crewCardDraft.showEmpNo !== false && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-black/5">
                          #1042
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Daily FTL stats */}
                {crewCardDraft.showFtlStats !== false && (
                  <div
                    className={`rounded-xl border p-2 text-[10px] ${
                      crewCardDraft.showFtlAlert !== false
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-300"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>ساعات الخدمة والقطاعات (FTL)</span>
                      </span>
                      {crewCardDraft.showFtlAlert !== false ? (
                        <span className="font-black text-rose-600 dark:text-rose-400">
                          متجاوز للحد
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ضمن الحدود ✓
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[9px] mt-1">
                      <div className="p-1 rounded bg-white/60 dark:bg-slate-900/60 border border-black/5">
                        <span className="block opacity-75">الحد الأقصى (Max):</span>
                        <span className="font-bold font-mono">11h 00m</span>
                      </div>
                      <div className="p-1 rounded bg-white/60 dark:bg-slate-900/60 border border-black/5">
                        <span className="block opacity-75">الفعلي (Actual):</span>
                        <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                          17h 30m (4 Sct)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full bg-rose-500 w-full" />
                    </div>
                  </div>
                )}

                {/* Contacts */}
                <div className="space-y-1.5 text-xs">
                  {crewCardDraft.showPhone !== false && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-mono truncate">+218 91 234 5678</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="p-1 rounded-md bg-blue-500/15 text-blue-600">
                          <Phone className="w-3 h-3" />
                        </span>
                        {crewCardDraft.showWhatsApp !== false && (
                          <span className="p-1 rounded-md bg-emerald-500/15 text-emerald-600">
                            <MessageCircle className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {crewCardDraft.showEmail !== false && (
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="font-mono truncate">a.mansouri@airline.com</span>
                      </div>
                      <span className="p-1 rounded-md bg-amber-500/15 text-amber-600 shrink-0">
                        <Mail className="w-3 h-3" />
                      </span>
                    </div>
                  )}

                  {crewCardDraft.showBase !== false && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] pt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>
                        مقر العمل (Base): <strong className="text-foreground">TIP (Tripoli)</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ AIRPORT HOVER CARD CUSTOMIZATION SUB-PANEL ═══ */}
        <div className="mt-6 pt-5 border-t space-y-4" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(14, 165, 233, 0.12)",
                  color: "#0284c7",
                }}
              >
                <PlaneIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "تخصيص بطاقة المطار التفاعلية (Airport Hover Card)" : "Airport Card Size & Fields"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "تكبير وتصغير بطاقة معلومات المطار والشروق/الغروب والحقول الظاهرة عند المرور على كود المطار في الجدول"
                    : "Adjust airport popover size, sunrise/sunset strip, and aerodrome spec tiles"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateAirportCardConfig(DEFAULT_AIRPORT_CARD_CONFIG)}
              className="px-3 py-1 rounded-lg text-xs font-bold border hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {isAr ? "الافتراضي" : "Reset"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-4">
              {/* Size + Zoom Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-extrabold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    <Sliders className="w-3.5 h-3.5 text-sky-500" />
                    <span>{isAr ? "حجم وتكبير بطاقة المطار (Zoom / Size)" : "Airport Card Size"}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {(() => {
                      const order = ["xs", "sm", "md", "lg", "xl"];
                      const curIdx = Math.max(0, order.indexOf(airportCardDraft.cardSize || "sm"));
                      return (
                        <>
                          <button
                            type="button"
                            disabled={curIdx === 0}
                            onClick={() => updateAirportCardConfig({ cardSize: order[curIdx - 1] })}
                            className="px-2 py-0.5 rounded border text-xs font-mono font-bold disabled:opacity-40 cursor-pointer"
                            style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
                          >
                            −
                          </button>
                          <span className="px-2 py-0.5 text-[11px] font-mono tabular-nums font-bold text-sky-600">
                            {AIRPORT_CARD_SIZE_MAP[order[curIdx]]?.width || 258}px
                          </span>
                          <button
                            type="button"
                            disabled={curIdx === order.length - 1}
                            onClick={() => updateAirportCardConfig({ cardSize: order[curIdx + 1] })}
                            className="px-2 py-0.5 rounded border text-xs font-mono font-bold disabled:opacity-40 cursor-pointer"
                            style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
                          >
                            +
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: "xs", label_ar: "مصغّرة", label_en: "XS", w: "225px" },
                    { id: "sm", label_ar: "مدمجة ★", label_en: "SM ★", w: "258px" },
                    { id: "md", label_ar: "متوسطة", label_en: "MD", w: "298px" },
                    { id: "lg", label_ar: "كبيرة", label_en: "LG", w: "342px" },
                    { id: "xl", label_ar: "موسّعة", label_en: "XL", w: "390px" },
                  ].map((s) => {
                    const isSel = (airportCardDraft.cardSize || "sm") === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => updateAirportCardConfig({ cardSize: s.id })}
                        className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                          isSel
                            ? "ring-2 ring-sky-500/50 bg-sky-500/10 border-sky-500/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                        style={{
                          backgroundColor: isSel ? undefined : "var(--bg-app)",
                          borderColor: isSel ? undefined : "var(--border-default)",
                        }}
                      >
                        <div className="text-[11px] font-bold" style={{ color: isSel ? "#0284c7" : "var(--text-primary)" }}>
                          {isAr ? s.label_ar : s.label_en}
                        </div>
                        <div className="text-[9.5px] font-mono tabular-nums text-muted-foreground mt-0.5">
                          {s.w}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Airport Field Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: "showSunTimes", ar: "أوقات الشروق والغروب", en: "Sunrise & Sunset", icon: Sun },
                  { key: "showWeatherNotam", ar: "الطقس والنوتام (METAR/TAF/NOTAM)", en: "METAR / TAF / NOTAM", icon: Radio },
                  { key: "showCoordinates", ar: "الإحداثيات", en: "Coordinates", icon: Compass },
                  { key: "showElevation", ar: "الارتفاع (Elevation)", en: "Elevation", icon: Layers },
                  { key: "showTimezone", ar: "المنطقة الزمنية", en: "Timezone", icon: Clock },
                  { key: "showRunways", ar: "بيانات المدارج", en: "Runways", icon: PlaneIcon },
                ].map((item) => {
                  const isChecked = airportCardDraft[item.key] !== false;
                  const IconC = item.icon;
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-2 rounded-xl border cursor-pointer hover:opacity-90 transition"
                      style={{
                        backgroundColor: isChecked ? "rgba(14, 165, 233, 0.06)" : "var(--bg-app)",
                        borderColor: isChecked ? "rgba(14, 165, 233, 0.3)" : "var(--border-default)",
                      }}
                    >
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold truncate">
                        <IconC className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span className="truncate">{isAr ? item.ar : item.en}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => updateAirportCardConfig({ [item.key]: e.target.checked })}
                        className="w-3.5 h-3.5 rounded text-sky-600 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Airport Interactive Preview */}
            <div
              className="lg:col-span-5 p-4 rounded-xl border flex flex-col items-center justify-center space-y-2 min-h-[160px]"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              <div className="text-[11px] text-muted-foreground font-medium">
                {isAr ? "مرر الفأرة أو انقر لمعاينة بطاقة المطار:" : "Hover or click to preview Airport Card:"}
              </div>
              <AirportHoverCard code="HLLM" configOverride={airportCardDraft}>
                <span className="px-3 py-1 rounded-lg font-mono font-black text-xs bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 cursor-pointer">
                  HLLM (MJI)
                </span>
              </AirportHoverCard>
              <div className="text-[10px] font-mono tabular-nums text-muted-foreground">
                {isAr ? "العرض الحالي:" : "Current width:"} {AIRPORT_CARD_SIZE_MAP[airportCardDraft.cardSize || "sm"]?.width || 258}px
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ═══ SECTION: SCHEDULE FLIGHT DROPDOWN MENU CUSTOMIZATION ═══ */}
      {(activeSubSection === "all" || activeSubSection === "flight_menu") && (
      <section className="p-3.5 rounded-xl space-y-3" style={cardStyle}>
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--bg-app)", color: "var(--brand-primary)" }}
            >
              <ListChecks className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {isAr
                  ? "تخصيص القائمة المنسدلة للرحلة في جدول العمليات (⋮ / Right-Click)"
                  : "Customize Schedule Flight Dropdown Menu"}
              </h4>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "اختر العناصر التي تظهر عند فتح قائمة خيارات الرحلة (بما فيها GenDec بالختم وبدونه والرحلة المكتملة JL) مع إمكانية ترتيبها"
                  : "Enable, disable, and reorder items displayed in the Schedule row dropdown menu"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canUseAiFormScanner && (
              <button
                type="button"
                onClick={() => setShowAiFormScanner(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-xs transition hover:opacity-95 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #059669, #0284c7)" }}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                {isAr
                  ? "+ إضافة نموذج بالذكاء الاصطناعي (صورة / PDF)"
                  : "+ Add AI Form (Image / PDF)"}
              </button>
            )}
            <button
              type="button"
              disabled={!canChangeTabPrefs}
              onClick={resetFlightMenuDefault}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-50 cursor-pointer shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {isAr ? "استعادة الافتراضي" : "Reset Menu"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {contextMenuDraft.map((item, idx) => {
            const isEnabled = item.enabled !== false;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition"
                style={{
                  backgroundColor: isEnabled ? "var(--bg-card)" : "var(--bg-app)",
                  borderColor: isEnabled ? "rgba(37, 99, 235, 0.35)" : "var(--border-default)",
                  opacity: isEnabled ? 1 : 0.65,
                }}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === 0}
                      onClick={() => moveFlightMenuItem(idx, "up")}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 cursor-pointer"
                      title={isAr ? "تحريك للأعلى" : "Move Up"}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!canChangeTabPrefs || idx === contextMenuDraft.length - 1}
                      onClick={() => moveFlightMenuItem(idx, "down")}
                      className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 cursor-pointer"
                      title={isAr ? "تحريك للأسفل" : "Move Down"}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {isAr ? item.label_ar : item.label_en}
                    </div>
                    {item.desc_ar && (
                      <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                        {isAr ? item.desc_ar : item.label_en}
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    disabled={!canChangeTabPrefs}
                    checked={isEnabled}
                    onChange={() => toggleFlightMenuItem(item.id)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            );
          })}
        </div>

        {/* ── Operational Forms & AI-Recognized Forms Linked to Flight Context Menu ── */}
        <div
          className="mt-3 pt-3 border-t space-y-2.5"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5
                className="text-xs font-bold flex items-center gap-1.5"
                style={{ color: "var(--text-primary)" }}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                {isAr
                  ? `النماذج التشغيلية والنماذج المضافة بالذكاء الاصطناعي في القائمة المنسدلة (${opForms.filter((f) => f.showInContextMenu !== false).length}/${opForms.length})`
                  : `Operational & AI Forms in Flight Dropdown Menu (${opForms.filter((f) => f.showInContextMenu !== false).length}/${opForms.length})`}
              </h5>
              <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "فعّل أو أوقف ظهور أي نموذج داخل القائمة المنسدلة للرحلة، أو أضف نموذجاً جديداً (صورة / PDF) للتعرف عليه بالذكاء الاصطناعي وإدراجه فوراً."
                  : "Toggle which operational or AI-scanned forms appear directly inside the flight right-click dropdown menu."}
              </p>
            </div>
          </div>

          {opForms.length === 0 ? (
            <div
              className="p-4 rounded-xl border border-dashed text-center space-y-2"
              style={{
                borderColor: "var(--border-default)",
                backgroundColor: "var(--bg-app)",
              }}
            >
              <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "لا توجد نماذج تشغيلية محفوظة حالياً."
                  : "No operational forms saved yet."}
              </div>
              {canUseAiFormScanner && (
                <button
                  type="button"
                  onClick={() => setShowAiFormScanner(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #059669, #0284c7)" }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  {isAr ? "ارفع صورة أو PDF للتعرف الذكي وإضافته للقائمة" : "Upload Image/PDF for AI Recognition"}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {opForms.map((form) => {
                const isFormShown = form.showInContextMenu !== false;
                const fieldCount = Array.isArray(form.fields) ? form.fields.length : 0;
                return (
                  <label
                    key={form.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border cursor-pointer transition"
                    style={{
                      backgroundColor: isFormShown
                        ? "rgba(16, 185, 129, 0.06)"
                        : "var(--bg-app)",
                      borderColor: isFormShown
                        ? "rgba(16, 185, 129, 0.35)"
                        : "var(--border-default)",
                      opacity: isFormShown ? 1 : 0.7,
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-xs font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {form.name}
                      </div>
                      <div
                        className="text-[10px] font-mono tabular-nums flex items-center gap-1.5 mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className="text-sky-600 dark:text-sky-400 font-bold">
                          {form.format === "pdf" ? "PDF" : "HTML"}
                        </span>
                        <span>·</span>
                        <span>{form.category || "General"}</span>
                        <span>·</span>
                        <span>{fieldCount} حقل</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isFormShown}
                      onChange={() => handleToggleOpFormContextMenu(form)}
                      disabled={!canChangeTabPrefs}
                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {/* Master Save Button */}
      <button
        disabled={!editable || saving}
        onClick={save}
        className="w-full px-4 py-2.5 disabled:opacity-50 text-white rounded-xl text-xs flex items-center justify-center gap-2 font-bold transition shadow-md cursor-pointer"
        style={{
          background: "var(--brand-gradient)",
        }}
      >
        <Save className="w-4 h-4" />{" "}
        {saving ? "…" : isAr ? "حفظ وتثبيت إعدادات المظهر والأنماط" : "Save & Sync Appearance Settings"}
      </button>

      {/* ═══ MODAL: ADD / EDIT CUSTOM MENU ═══ */}
      {menuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "rgba(37, 99, 235, 0.1)", color: "var(--brand-primary)" }}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  {editingMenu
                    ? isAr
                      ? "تعديل القائمة المنسدلة"
                      : "Edit Dropdown Menu"
                    : isAr
                    ? "إضافة قائمة منسدلة جديدة"
                    : "Add New Dropdown Menu"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setMenuModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "اسم القائمة بالعربية *" : "Menu Name (Arabic) *"}
                </label>
                <input
                  type="text"
                  value={menuDraft.label_ar}
                  onChange={(e) => setMenuDraft({ ...menuDraft, label_ar: e.target.value })}
                  placeholder={isAr ? "مثال: العمليات والرحلات" : "e.g. العمليات"}
                  dir="rtl"
                  className="w-full px-3 py-2 rounded-xl border text-sm font-medium"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "اسم القائمة بالإنجليزية *" : "Menu Name (English) *"}
                </label>
                <input
                  type="text"
                  value={menuDraft.label_en}
                  onChange={(e) => setMenuDraft({ ...menuDraft, label_en: e.target.value })}
                  placeholder="e.g. Operations & Flights"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border text-sm font-medium"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "اختر أيقونة القائمة" : "Pick Menu Icon"}
                </label>
                <div
                  className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-2 rounded-xl border max-h-40 overflow-y-auto"
                  style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
                >
                  {CUSTOM_MENU_ICON_OPTIONS.map((item) => {
                    const IconComp = getMenuIconComponent(item.id);
                    const isSelected = menuDraft.icon === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMenuDraft({ ...menuDraft, icon: item.id })}
                        className={`p-2 rounded-lg flex flex-col items-center justify-center transition border ${
                          isSelected
                            ? "ring-2 ring-blue-500 shadow-sm"
                            : "hover:bg-slate-100 dark:hover:bg-slate-700/40"
                        }`}
                        style={{
                          backgroundColor: isSelected ? "var(--bg-card)" : "transparent",
                          borderColor: isSelected ? "var(--brand-primary)" : "transparent",
                          color: isSelected ? "var(--brand-primary)" : "var(--text-muted)",
                        }}
                        title={item.label}
                      >
                        <IconComp className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
              <button
                type="button"
                onClick={() => setMenuModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border transition"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!menuDraft.label_ar.trim() && !menuDraft.label_en.trim()) {
                    showToast(isAr ? "يرجى كتابة اسم القائمة" : "Please enter a menu name");
                    return;
                  }
                  handleSaveMenu({
                    label_ar: menuDraft.label_ar.trim() || menuDraft.label_en.trim(),
                    label_en: menuDraft.label_en.trim() || menuDraft.label_ar.trim(),
                    icon: menuDraft.icon || "Layers",
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm cursor-pointer"
                style={{ background: "var(--brand-gradient)" }}
              >
                {isAr ? "حفظ وتطبيق" : "Save Menu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAiFormScanner && (
        <SmartDocumentScannerModal
          mode="form"
          flights={flights}
          fleet={fleet}
          crew={crew}
          settings={settings}
          user={user}
          onTemplateSaved={() => {
            setOpForms(listOperationalFormsSync());
            fetchOperationalForms().then(setOpForms).catch(() => {});
            const parentDisabled = contextMenuDraft.some(
              (it) => it.id === "operational_forms" && it.enabled === false
            );
            if (parentDisabled) {
              const nextMenu = contextMenuDraft.map((it) =>
                it.id === "operational_forms" ? { ...it, enabled: true } : it
              );
              setContextMenuDraft(nextMenu);
              saveFlightContextMenuConfig(nextMenu);
              const nextDraft = { ...draft, flightContextMenuConfig: nextMenu };
              setDraft(nextDraft);
              notifyAndSyncLive(nextDraft);
            }
          }}
          onClose={() => setShowAiFormScanner(false)}
        />
      )}
    </div>
  );
}

export default SettingsModule;

