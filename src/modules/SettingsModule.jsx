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
} from "lucide-react";

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

/* ═══ Settings Categories & Grouping ═══ */
export const SETTINGS_CATEGORIES = [
  {
    id: "system",
    label_ar: "النظام والمظهر",
    label_en: "System & Themes",
    desc_ar: "بيانات الشركة، الشعار والختم، الثيمات الموحدة، وتفضيلات القوائم والأصوات",
    desc_en: "Company identity, unified themes, layout preferences, and audio alerts",
    icon: Palette,
    tabIds: ["general", "appearance", "sounds"],
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
  setSyncStatus,
}) {
  const t = useT();
  const { user } = useAuth();
  const langCode = document.documentElement.lang || "en";
  const isAr = langCode === "ar";
  const [activeTab, setActiveTab] = useState("general");
  const [searchQuery, setSearchQuery] = useState("");

  const visibleTabs = TABS.filter((tab) => checkPerm(user, tab.perm));

  // Determine which category the current activeTab belongs to
  const currentTabObj = visibleTabs.find((tab) => tab.id === activeTab) || visibleTabs[0];
  const [selectedCategory, setSelectedCategory] = useState(
    () => currentTabObj?.categoryId || "system"
  );

  useEffect(() => {
    if (!visibleTabs.find((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "general");
    }
  }, [user]);

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
    <div className="space-y-4 fade-in">
      {/* ═══ Header Banner ═══ */}
      <div
        className="rounded-2xl p-4 md:p-5 text-white shadow-md-theme"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Info */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
              <SettingsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">
                  {t.settingsTitle || (isAr ? "إعدادات المنظومة" : "System Settings")}
                </h2>
                {/* Active Theme Quick Badge */}
                <button
                  type="button"
                  onClick={() => handleSelectTab("appearance")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30 backdrop-blur-sm transition cursor-pointer"
                  title={isAr ? "انقر لتغيير نمط وثيم المنظومة" : "Click to change theme"}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-sm"
                    style={{ backgroundColor: activeThemeObj.preview || "var(--brand-primary)" }}
                  />
                  <span>
                    {isAr ? "النمط:" : "Theme:"}{" "}
                    {isAr ? activeThemeObj.nameAr : activeThemeObj.name}
                  </span>
                </button>
              </div>
              <div className="text-xs opacity-85 mt-0.5">
                {isAr
                  ? `لوحة التحكم المركزية بالهوية، الكادر، الرسائل، وأمان المنظومة (${visibleTabs.length} قسماً)`
                  : `Central control for identity, personnel, comms, and compliance (${visibleTabs.length} sections)`}
              </div>
            </div>
          </div>

          {/* Quick Search Input */}
          <div className="relative min-w-[260px] md:min-w-[320px]">
            <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none text-white/70">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? "بحث سريع في الإعدادات (ثيم، شعار، مستخدمين...)"
                  : "Quick search settings (theme, logo, users...)"
              }
              className="w-full bg-white/15 border border-white/30 rounded-xl py-2 px-9 text-xs md:text-sm text-white placeholder-white/65 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 end-2.5 flex items-center text-white/70 hover:text-white"
                title={isAr ? "مسح البحث" : "Clear search"}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Search Results View (When Query Active) ═══ */}
      {searchQuery.trim() ? (
        <div
          className="rounded-2xl p-4 space-y-3"
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
            <div className="text-center py-8 text-sm text-muted-foreground">
              {isAr
                ? "لم يتم العثور على إعداد مطابق. جرب كلمة أخرى مثل: ثيم، شعار، كرو، بريد، صلاحيات..."
                : "No matching setting found. Try keywords like: theme, logo, crew, email, permissions..."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {searchResults.map((tab) => {
                const Icon = tab.icon;
                const catObj = SETTINGS_CATEGORIES.find((c) => c.id === tab.categoryId);
                const isCurrent = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(tab.id)}
                    className="p-3 rounded-xl border text-start transition flex items-start gap-3 hover:-translate-y-0.5"
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
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isCurrent
                          ? "var(--brand-primary)"
                          : "var(--bg-app)",
                        color: isCurrent ? "#ffffff" : "var(--brand-primary)",
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-bold text-xs truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {isAr ? tab.label_ar : tab.label_en}
                        </span>
                        {catObj && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            {isAr ? catObj.label_ar : catObj.label_en}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-[11px] truncate mt-0.5"
                        style={{ color: "var(--text-muted)" }}
                      >
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
        /* ═══ Standard Categorized Navigation ═══ */
        <div className="space-y-3">
          {/* Category Cards (4 Core Pillars) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {accessibleCategories.map((cat) => {
              const Icon = cat.icon;
              const isCatActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className="p-3.5 rounded-2xl border-2 text-start transition relative overflow-hidden group flex flex-col justify-between"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: isCatActive
                      ? "var(--brand-primary)"
                      : "var(--border-default)",
                    boxShadow: isCatActive
                      ? "0 4px 14px rgba(0, 0, 0, 0.08)"
                      : "var(--shadow-sm)",
                  }}
                >
                  {isCatActive && (
                    <div
                      className="absolute top-0 inset-x-0 h-1"
                      style={{ background: "var(--brand-gradient)" }}
                    />
                  )}

                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition"
                      style={{
                        backgroundColor: isCatActive
                          ? "var(--brand-primary)"
                          : "var(--bg-app)",
                        color: isCatActive ? "#ffffff" : "var(--brand-primary)",
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isCatActive
                          ? "var(--brand-primary)"
                          : "var(--bg-app)",
                        color: isCatActive ? "#ffffff" : "var(--text-muted)",
                      }}
                    >
                      {cat.count} {isAr ? "أقسام" : "tabs"}
                    </span>
                  </div>

                  <div>
                    <h3
                      className="font-bold text-sm leading-tight"
                      style={{
                        color: isCatActive
                          ? "var(--brand-primary)"
                          : "var(--text-primary)",
                      }}
                    >
                      {isAr ? cat.label_ar : cat.label_en}
                    </h3>
                    <p
                      className="text-[11px] line-clamp-1 mt-1 opacity-80"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {isAr ? cat.desc_ar : cat.desc_en}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sub-Tabs Segmented Bar (For Active Category) */}
          <div
            className="rounded-2xl p-2.5 flex flex-wrap items-center gap-1.5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 text-xs font-bold text-muted-foreground border-e me-1" style={{ borderColor: "var(--border-default)" }}>
              <span>{isAr ? currentCategoryObj.label_ar : currentCategoryObj.label_en}</span>
            </div>

            {currentCategoryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
                  style={
                    isActive
                      ? {
                          background: "var(--brand-gradient)",
                          color: "white",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : {
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-primary)",
                        }
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
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

  return (
    <div className="max-w-2xl space-y-4">
      {!editable && (
        <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-500 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* Logo + Stamp */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="p-4 rounded-2xl" style={sectionStyle}>
          <h4
            className="text-sm font-bold mb-3 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <Camera className="w-4 h-4" /> {t.companyLogo || "شعار الشركة"}
          </h4>
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed flex items-center justify-center flex-shrink-0"
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
                <Plane
                  className="w-8 h-8"
                  style={{ color: "var(--text-muted)", opacity: 0.4 }}
                />
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                type="button"
                disabled={!canUploadLogo || uploadingLogo}
                onClick={() => logoRef.current?.click()}
                className="px-3 py-2 rounded-lg text-white text-xs flex items-center gap-2 disabled:opacity-50 transition"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Upload className="w-4 h-4" />{" "}
                {uploadingLogo ? "…" : "رفع الشعار"}
              </button>
              {draft.logo && canRemoveLogo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="px-3 py-2 rounded-lg bg-rose-500/15 text-rose-500 text-xs hover:bg-rose-500/25 transition"
                >
                  إزالة
                </button>
              )}
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              PNG/JPG · max 2 MB
            </p>
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            onChange={uploadLogo}
            className="hidden"
          />
        </section>

        <section className="p-4 rounded-2xl" style={sectionStyle}>
          <h4
            className="text-sm font-bold mb-3 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <ImageIcon className="w-4 h-4" /> {t.stamp || "الختم / Stamp"}
          </h4>
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              {!canViewStamp ? (
                <Lock
                  className="w-8 h-8"
                  style={{ color: "var(--text-muted)" }}
                  title="ليس لديك صلاحية رؤية الختم"
                />
              ) : logoToDisplayUrl(draft.stamp) && !stampError ? (
                <img
                  src={logoToDisplayUrl(draft.stamp)}
                  alt="stamp"
                  className="w-full h-full object-contain p-1"
                  onError={() => setStampError(true)}
                />
              ) : (
                <ImageIcon
                  className="w-8 h-8"
                  style={{ color: "var(--text-muted)", opacity: 0.4 }}
                />
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <button
                type="button"
                disabled={!canEditStamp || uploadingStamp}
                onClick={() => stampRef.current?.click()}
                className="px-3 py-2 rounded-lg text-white text-xs flex items-center gap-2 disabled:opacity-50 transition"
                style={{
                  background: "var(--brand-gradient)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Upload className="w-4 h-4" />{" "}
                {uploadingStamp ? "…" : "رفع الختم"}
              </button>
              {draft.stamp && canEditStamp && (
                <button
                  type="button"
                  onClick={removeStamp}
                  className="px-3 py-2 rounded-lg bg-rose-500/15 text-rose-500 text-xs hover:bg-rose-500/25 transition"
                >
                  إزالة
                </button>
              )}
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              PNG/JPG · max 2 MB
            </p>
          </div>
          <input
            ref={stampRef}
            type="file"
            accept="image/*"
            onChange={uploadStamp}
            className="hidden"
          />
        </section>
      </div>

      {/* Company Info + Country + Language */}
      <section className="p-4 rounded-2xl space-y-3" style={sectionStyle}>
        <Field label={t.companyName || "Company Name (EN)"}>
          <Input
            disabled={!editable}
            value={draft.companyName || ""}
            onChange={(e) =>
              setDraft({ ...draft, companyName: e.target.value })
            }
          />
        </Field>
        <Field label={t.companyNameAr || "Company Name (AR)"}>
          <Input
            disabled={!editable}
            value={draft.companyNameAr || ""}
            onChange={(e) =>
              setDraft({ ...draft, companyNameAr: e.target.value })
            }
          />
        </Field>
        <Field label={t.operatorCode || "Operator Code"}>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Hash
                className="w-4 h-4"
                style={{ color: "var(--brand-primary)" }}
              />
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
                fontSize: "15px",
                color: "var(--brand-primary)",
              }}
            />
          </div>
        </Field>

        {/* ⭐ v9.0 — Country */}
        <Field label={t.country || "الدولة"}>
          <Input
            disabled={!editable}
            value={draft.country || ""}
            onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            placeholder="Libya / ليبيا"
          />
        </Field>

        {/* ⭐ Unified Time System & Time Zone Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={lang === "ar" ? "نظام عرض الساعات (12H / 24H)" : "Hour Format System (12H / 24H)"}>
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
                  window.dispatchEvent(
                    new CustomEvent("aeroops:timeFormatChanged", {
                      detail: nextTf,
                    })
                  );
                }
                setSettings((prev) => ({ ...(prev || {}), timeFormat: nextTf }));
              }}
            >
              <option value="24">
                {lang === "ar" ? "24 ساعة (مثال: 14:30) — قياسي" : "24 Hours (e.g. 14:30) — Standard"}
              </option>
              <option value="12">
                {lang === "ar" ? "12 ساعة (مثال: 02:30 PM)" : "12 Hours (e.g. 02:30 PM)"}
              </option>
            </Select>
          </Field>

          <Field label={lang === "ar" ? "نطاق التوقيت المعتمد (زولو / محلي)" : "Base Time Mode (Zulu / Local)"}>
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
                  window.dispatchEvent(
                    new CustomEvent("aeroops:timeModeChanged", {
                      detail: nextTm,
                    })
                  );
                }
                setSettings((prev) => ({ ...(prev || {}), timeMode: nextTm }));
              }}
            >
              <option value="UTC">
                {lang === "ar" ? "توقيت زولو العالمي (UTC / Zulu) — المعيار الجوي" : "Zulu Universal Time (UTC / Zulu) — Aviation Standard"}
              </option>
              <option value="LOCAL">
                {lang === "ar" ? "التوقيت المحلي للجهاز (Local Time)" : "Device Local Time"}
              </option>
            </Select>
          </Field>
        </div>

        <Field label={t.language || "اللغة"}>
          <Select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ar">{t.arabic || "العربية"}</option>
            <option value="en">{t.english || "English"}</option>
          </Select>
        </Field>
      </section>

      <button
        disabled={!editable || saving}
        onClick={save}
        className="w-full px-4 py-3 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-2 font-bold transition hover:-translate-y-0.5"
        style={{
          background: "var(--brand-gradient)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <Save className="w-4 h-4" />{" "}
        {saving ? "…" : t.saveChanges || "حفظ التغييرات"}
      </button>
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

  return (
    <div className="max-w-2xl space-y-4">
      {!canEdit && (
        <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-500 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* Header Banner */}
      <div
        className="rounded-2xl text-white shadow-md-theme flex items-center gap-3 p-4"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
          <Bell className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold">
            {lang === "ar" ? "الأصوات والإشعارات" : "Sounds & Notifications"}
          </h3>
          <div className="text-xs opacity-80">
            {lang === "ar"
              ? "إدارة إشعارات وتنبيهات تحديث الرحلات والطواقم والأصوات التفاعلية للمنظومة"
              : "Manage flight updates, crew alerts, system audio, and notifications"}
          </div>
        </div>
      </div>

      {/* ═══ SECTION 1: SYSTEM NOTIFICATIONS (الرحلات والطاقم) ═══ */}
      <section className="space-y-4 p-4 rounded-2xl" style={cardStyle}>
        <div
          className="flex items-center gap-2 pb-2"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <Bell
            className="w-5 h-5"
            style={{ color: "var(--brand-primary)" }}
          />
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {lang === "ar"
              ? "إشعارات تحديث الرحلات والطاقم"
              : "Flight & Crew Notifications"}
          </h3>
        </div>

        {/* Flight Changes Toggle */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={innerStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-500/15 text-sky-500">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {lang === "ar"
                  ? "إشعارات تحديث وجدولة الرحلات"
                  : "Flight Updates & Scheduling"}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {lang === "ar"
                  ? "تنبيه فوري عند إضافة رحلة، تعديل توقيتها أو مسارها، أو تغيير حالتها"
                  : "Instant alert on flight creation, rescheduling, or status change"}
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              updateConfig({ flightUpdates: !notifConfig.flightUpdates })
            }
            disabled={!canEdit}
            className="relative w-14 h-8 rounded-full transition disabled:opacity-50 shrink-0"
            style={{
              backgroundColor: notifConfig.flightUpdates
                ? "var(--brand-primary)"
                : "var(--border-default)",
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
              style={{
                transform: notifConfig.flightUpdates
                  ? "translateX(28px)"
                  : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Crew Changes Toggle */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={innerStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-500">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {lang === "ar"
                  ? "إشعارات تعيينات وجدول الطواقم"
                  : "Crew Assignment & Roster Alerts"}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {lang === "ar"
                  ? "تنبيه الطاقم والمشرفين فور تعيين طاقم على رحلة أو تعديل جدول الخدمة"
                  : "Notify crew and dispatchers upon flight assignments or roster adjustments"}
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              updateConfig({ crewUpdates: !notifConfig.crewUpdates })
            }
            disabled={!canEdit}
            className="relative w-14 h-8 rounded-full transition disabled:opacity-50 shrink-0"
            style={{
              backgroundColor: notifConfig.crewUpdates
                ? "var(--brand-primary)"
                : "var(--border-default)",
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
              style={{
                transform: notifConfig.crewUpdates
                  ? "translateX(28px)"
                  : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Desktop / Browser Push */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={innerStyle}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/15 text-purple-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div
                className="font-bold text-sm flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                {lang === "ar"
                  ? "إشعارات المتصفح والنظام (PWA Push)"
                  : "Browser & System Desktop Alerts"}
                {browserPerm === "granted" && (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/15 px-2 py-0.5 rounded">
                    مفعل ومسموح
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {lang === "ar"
                  ? "إرسال إشعارات لسطح المكتب أو الهاتف حتى عند العمل في نافذة أخرى"
                  : "Send desktop/mobile alerts even when working on other tabs"}
              </div>
            </div>
          </div>

          {browserPerm === "granted" ? (
            <button
              onClick={() =>
                updateConfig({ browserPush: !notifConfig.browserPush })
              }
              disabled={!canEdit}
              className="relative w-14 h-8 rounded-full transition disabled:opacity-50 shrink-0"
              style={{
                backgroundColor: notifConfig.browserPush
                  ? "var(--brand-primary)"
                  : "var(--border-default)",
              }}
            >
              <span
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
                style={{
                  transform: notifConfig.browserPush
                    ? "translateX(28px)"
                    : "translateX(4px)",
                }}
              />
            </button>
          ) : (
            <button
              onClick={handleRequestBrowserPerm}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm shrink-0"
            >
              طلب إذن الإشعارات
            </button>
          )}
        </div>
      </section>

      {/* ═══ SECTION 2: AUDIO FEEDBACK & VOLUMES ═══ */}
      <section className="space-y-4 p-4 rounded-2xl" style={cardStyle}>
        <div
          className="flex items-center gap-2 pb-2"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <Volume2
            className="w-5 h-5"
            style={{ color: "var(--brand-primary)" }}
          />
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {lang === "ar" ? "أصوات المنظومة التفاعلية" : "Interactive Audio"}
          </h3>
        </div>

        {/* Master Audio Toggle */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={innerStyle}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: soundsEnabled
                  ? "rgba(34, 197, 94, 0.15)"
                  : "var(--bg-card)",
              }}
            >
              {soundsEnabled ? (
                <Volume2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <VolumeX
                  className="w-5 h-5"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </div>
            <div>
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {t.enableSounds ||
                  (lang === "ar" ? "تشغيل الأصوات العامة" : "Enable Sounds")}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {lang === "ar"
                  ? "تفعيل المؤثرات الصوتية للأزرار والحفظ والعمليات الناجحة"
                  : "Enable sound effects for buttons, saves, and operations"}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !soundsEnabled;
              setSoundsEnabled(next);
              updateConfig({ systemSounds: next });
            }}
            disabled={!canEdit}
            className="relative w-14 h-8 rounded-full transition disabled:opacity-50 shrink-0"
            style={{
              backgroundColor: soundsEnabled
                ? "var(--brand-primary)"
                : "var(--border-default)",
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
              style={{
                transform: soundsEnabled
                  ? "translateX(28px)"
                  : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {/* Alert Sounds Toggle */}
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={innerStyle}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: alertSoundsEnabled
                  ? "rgba(245, 158, 11, 0.15)"
                  : "var(--bg-card)",
              }}
            >
              {alertSoundsEnabled ? (
                <Bell className="w-5 h-5 text-amber-500" />
              ) : (
                <BellOff
                  className="w-5 h-5"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </div>
            <div>
              <div
                className="font-bold text-sm"
                style={{ color: "var(--text-primary)" }}
              >
                {t.enableAlertSounds ||
                  (lang === "ar" ? "نغمات وأصوات التنبيه" : "Alert Sounds")}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {lang === "ar"
                  ? "نغمات خاصة للتحذيرات والأخطاء وتنبيهات الطيران الحساسة"
                  : "Special tones for critical aviation warnings and errors"}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const next = !alertSoundsEnabled;
              setAlertSoundsEnabled(next);
              updateConfig({ alertSounds: next });
            }}
            disabled={!canEdit}
            className="relative w-14 h-8 rounded-full transition disabled:opacity-50 shrink-0"
            style={{
              backgroundColor: alertSoundsEnabled
                ? "#f59e0b"
                : "var(--border-default)",
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform"
              style={{
                transform: alertSoundsEnabled
                  ? "translateX(28px)"
                  : "translateX(4px)",
              }}
            />
          </button>
        </div>

        {soundsEnabled && (
          <>
            {/* Volume Range */}
            <div className="p-3 rounded-xl" style={innerStyle}>
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-xs font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t.volume || (lang === "ar" ? "مستوى الصوت العام" : "Volume")}
                </div>
                <div
                  className="text-xs font-mono font-bold"
                  style={{ color: "var(--brand-primary)" }}
                >
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

            {/* Sound Types Preview Grid */}
            <div className="p-3 rounded-xl" style={innerStyle}>
              <div
                className="text-xs font-bold mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                {t.testSounds ||
                  (lang === "ar"
                    ? "معاينة أصوات المنظومة (انقر للاستماع)"
                    : "Test System Sounds")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SOUND_TYPES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => s.play()}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl transition active:scale-95 hover:border-amber-500/50"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                    }}
                    title="انقر للاستماع للنغمة"
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <span
                      className="text-[10px] font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {lang === "ar" ? s.label_ar : s.label_en}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Instant Comprehensive Test Button */}
            <button
              onClick={() => testNotificationSystem()}
              className="w-full px-4 py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md"
              style={{
                background: "var(--brand-gradient)",
              }}
            >
              <Bell className="w-5 h-5 animate-bounce" />
              {lang === "ar"
                ? "🔊 تجربة الإشعار والصوت الفوري لكامل المنظومة (Test Notification & Sound)"
                : "🔊 Test Instant System Notification & Audio"}
            </button>
          </>
        )}
      </section>

      {/* ═══ SECTION 3: RECENT NOTIFICATIONS LOG ═══ */}
      <section className="space-y-3 p-4 rounded-2xl" style={cardStyle}>
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            <Clock className="w-4 h-4 text-sky-500" />
            <span>سجل الإشعارات الأخيرة ({history.length})</span>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-xs text-rose-500 hover:underline"
            >
              مسح السجل
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            لا توجد إشعارات سابقة مسجلة
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2"
                style={innerStyle}
              >
                <div>
                  <div className="font-bold text-foreground">{item.title}</div>
                  {item.body && <div className="text-[11px] text-muted-foreground">{item.body}</div>}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono shrink-0">
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
function AppearanceTab({ settings, setSettings, lang, user, t }) {
  const [draft, setDraft] = useState(settings || {});
  const [saving, setSaving] = useState(false);
  const isAr = lang === "ar";

  useEffect(() => {
    setDraft(settings || {});
  }, [settings]);

  const editable = checkPerm(user, "settings.appearance_edit");
  const canChangeTheme =
    editable &&
    (checkPerm(user, "settings.global_theme") ||
      checkPerm(user, "settings.portal_theme"));
  const canChangeNavLayout = checkPerm(user, "settings.nav_layout");
  const canChangeTabPrefs = checkPerm(user, "settings.tab_prefs");

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
      const cleanTabPreferences = {
        ...(updatedDraft.tabPreferences || {}),
        __customMenus: cleanCustomMenus,
        __tabOrder: cleanTabOrder,
        __moreMenuConfig: cleanMoreMenu,
        __navItemsOrder: cleanNavItemsOrder,
      };

      localStorage.setItem("aeroops.tabPreferences", JSON.stringify(cleanTabPreferences));
      localStorage.setItem("aeroops.customMenus", JSON.stringify(cleanCustomMenus));
      localStorage.setItem("aeroops.tabOrder", JSON.stringify(cleanTabOrder));
      localStorage.setItem("aeroops.moreMenu", JSON.stringify(cleanMoreMenu));
      localStorage.setItem("aeroops.navItemsOrder", JSON.stringify(cleanNavItemsOrder));

      setSettings?.((prev) => ({
        ...(prev || {}),
        tabPreferences: cleanTabPreferences,
        customMenus: cleanCustomMenus,
        tabOrder: cleanTabOrder,
        moreMenuConfig: cleanMoreMenu,
        navItemsOrder: cleanNavItemsOrder,
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

  const save = async () => {
    setSaving(true);
    try {
      const unifiedTheme =
        draft.globalTheme || draft.portalTheme || DEFAULT_GLOBAL_THEME;
      const cleanCustomMenus = customMenus;
      const cleanTabOrder = tabOrder;
      const cleanTabPreferences = {
        ...(draft.tabPreferences || {}),
        __customMenus: cleanCustomMenus,
        __tabOrder: cleanTabOrder,
      };
      const payload = {
        ...settings,
        ...draft,
        globalTheme: unifiedTheme,
        portalTheme: unifiedTheme,
        customMenus: cleanCustomMenus,
        tabOrder: cleanTabOrder,
        tabPreferences: cleanTabPreferences,
      };
      await settingsAPI.save(payload);
      const fresh = await settingsAPI.get();
      setSettings(
        fresh
          ? { ...fresh, globalTheme: unifiedTheme, portalTheme: unifiedTheme }
          : payload
      );
      localStorage.setItem(
        "aeroops.tabPreferences",
        JSON.stringify(cleanTabPreferences)
      );
      localStorage.setItem(
        "aeroops.customMenus",
        JSON.stringify(cleanCustomMenus)
      );
      localStorage.setItem("aeroops.tabOrder", JSON.stringify(cleanTabOrder));
      localStorage.setItem("aeroops.navLayout", draft.navLayout || "top");
      window.dispatchEvent(new Event("aeroops:prefsChanged"));
      showToast(
        isAr
          ? "✅ تم حفظ التغييرات وتعميم القوائم والنمط وترتيب التبويبات"
          : "✅ Settings saved & custom menus and tab order synced"
      );
    } catch (e) {
      showToast("❌ " + (t.failedSave || "فشل الحفظ") + ": " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setDraft({
      ...draft,
      tabPreferences: { ...DEFAULT_TAB_PREFERENCES },
      customMenus: [],
      navLayout: "top",
      globalTheme: DEFAULT_GLOBAL_THEME,
      portalTheme: DEFAULT_GLOBAL_THEME,
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

  return (
    <div className="max-w-4xl space-y-5">
      {!editable && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 text-sm flex items-center gap-2 font-medium">
          <Lock className="w-4 h-4 shrink-0" /> {t.readOnly || "عرض فقط"}
        </div>
      )}

      {/* ═══ SECTION 1: UNIFIED THEMES GALLERY ═══ */}
      <section className="p-4 md:p-6 rounded-2xl space-y-4" style={cardStyle}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div>
            <h4
              className="text-base font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Palette className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              {isAr
                ? "أنماط وهوية المنظومة الموحدة (System & Crew Portal)"
                : "Unified System & Crew Portal Themes"}
              {!canChangeTheme && (
                <Lock
                  className="w-4 h-4"
                  style={{ color: "var(--text-muted)" }}
                  title="ليس لديك صلاحية تغيير الثيم"
                />
              )}
            </h4>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "اختر النمط المناسب لعملياتكم الجوية — يُطبّق فورياً بنقرة واحدة وبنفس الهوية البصرية المتناسقة على كامل المنظومة وبوابة الطاقم (Crew Portal) في الوضعين النهاري والليلي"
                : "Choose an aviation theme — instantaneously synced across all modules and Crew Portal in light & dark modes"}
            </p>
          </div>

          <button
            type="button"
            disabled={!editable || saving}
            onClick={save}
            className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 shrink-0 transition active:scale-95 disabled:opacity-50"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "…" : isAr ? "حفظ النمط المعتمد" : "Save Active Theme"}</span>
          </button>
        </div>

        {/* 10 Themes Visual Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
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

      {/* ═══ SECTION 2: NAVIGATION LAYOUT ═══ */}
      <section className="p-4 md:p-6 rounded-2xl" style={cardStyle}>
        <h4
          className="text-sm font-bold mb-3 flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          <Layout className="w-4 h-4" />
          {isAr ? "تخطيط شريط التنقل الرئيسي" : "Navigation Layout"}
          {!canChangeNavLayout && (
            <Lock
              className="w-3.5 h-3.5"
              style={{ color: "var(--text-muted)" }}
              title="ليس لديك صلاحية تغيير تخطيط التنقل"
            />
          )}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              id: "top",
              icon: Layout,
              label: isAr ? "أفقي أعلى الصفحة (Top Nav)" : "Top Navigation",
              desc: isAr ? "شريط علوي كلاسيكي مدمج مع قوائم سريعة" : "Classic horizontal bar with dropdowns",
            },
            {
              id: "side",
              icon: PanelLeft,
              label: isAr ? "جانبي عمودي (Sidebar)" : "Side Navigation",
              desc: isAr ? "قائمة جانبية عصرية قابلة للطي لعمليات الطيران" : "Vertical modern collapsible sidebar",
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
                className="p-4 rounded-xl border-2 transition flex items-center gap-3.5 text-start disabled:opacity-60"
                style={{
                  borderColor: isActive
                    ? "var(--brand-primary)"
                    : "var(--border-default)",
                  backgroundColor: isActive
                    ? "var(--bg-app)"
                    : "var(--bg-card)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isActive
                      ? "var(--brand-primary)"
                      : "var(--bg-app)",
                    color: isActive ? "#ffffff" : "var(--brand-primary)",
                  }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div
                    className="text-sm font-bold"
                    style={{
                      color: isActive
                        ? "var(--brand-primary)"
                        : "var(--text-primary)",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {opt.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ SECTION 3: CUSTOM DROPDOWN MENUS (إدارة القوائم الإضافية مثل 'المزيد') ═══ */}
      <section className="p-4 md:p-6 rounded-2xl" style={cardStyle}>
        {/* ⭐ More Menu Settings Card */}
        <div
          className="p-4 rounded-xl border mb-5 space-y-3"
          style={{
            backgroundColor: "var(--bg-app)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  color: "#d97706",
                }}
              >
                <MoreHorizontal className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {isAr ? "تخصيص / إلغاء قائمة المزيد الأساسية (More Menu)" : "More Menu Settings"}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "يمكنك تفعيل أو إلغاء ظهور قائمة المزيد بالكامل، أو تعديل اسمها وأيقونتها المتروكة في الشريط"
                    : "Enable, disable, or customize the label and icon of the default 'More' menu"}
                </div>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              disabled={!canChangeTabPrefs}
              onClick={() => {
                const nextMore = {
                  ...moreMenuConfig,
                  enabled: !moreMenuConfig.enabled,
                };
                const nextDraft = { ...draft, moreMenuConfig: nextMore };
                setDraft(nextDraft);
                notifyAndSyncLive(nextDraft);
              }}
              className={`relative w-12 h-6 rounded-full transition disabled:opacity-50 shrink-0 cursor-pointer ${
                moreMenuConfig.enabled ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-xs"
                style={{
                  transform: moreMenuConfig.enabled ? "translateX(26px)" : "translateX(4px)",
                }}
              />
            </button>
          </div>

          {/* Editable Fields when More Menu is Enabled */}
          {moreMenuConfig.enabled && (
            <div
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "اسم القائمة (عربي)" : "Label (AR)"}
                </label>
                <input
                  type="text"
                  value={moreMenuConfig.label_ar || "المزيد"}
                  disabled={!canChangeTabPrefs}
                  onChange={(e) => {
                    const nextMore = { ...moreMenuConfig, label_ar: e.target.value };
                    const nextDraft = { ...draft, moreMenuConfig: nextMore };
                    setDraft(nextDraft);
                    notifyAndSyncLive(nextDraft);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border bg-transparent outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "اسم القائمة (إنجليزي)" : "Label (EN)"}
                </label>
                <input
                  type="text"
                  value={moreMenuConfig.label_en || "More"}
                  disabled={!canChangeTabPrefs}
                  onChange={(e) => {
                    const nextMore = { ...moreMenuConfig, label_en: e.target.value };
                    const nextDraft = { ...draft, moreMenuConfig: nextMore };
                    setDraft(nextDraft);
                    notifyAndSyncLive(nextDraft);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border bg-transparent outline-none focus:ring-1 focus:ring-amber-500"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "الأيقونة" : "Icon"}
                </label>
                <select
                  value={moreMenuConfig.icon || "MoreHorizontal"}
                  disabled={!canChangeTabPrefs}
                  onChange={(e) => {
                    const nextMore = { ...moreMenuConfig, icon: e.target.value };
                    const nextDraft = { ...draft, moreMenuConfig: nextMore };
                    setDraft(nextDraft);
                    notifyAndSyncLive(nextDraft);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border bg-transparent outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                >
                  <option value="MoreHorizontal" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                    MoreHorizontal (افتراضي)
                  </option>
                  {CUSTOM_MENU_ICON_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {customMenus.map((cm, index) => {
              const MenuIcon = getMenuIconComponent(cm.icon);
              const tabsCount = getMenuTabsCount(cm.id);
              return (
                <div
                  key={cm.id}
                  className="p-3.5 rounded-xl border transition flex items-center justify-between gap-3"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "rgba(37, 99, 235, 0.1)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <MenuIcon className="w-5 h-5" />
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
      <section className="p-4 md:p-6 rounded-2xl" style={cardStyle}>
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

      {/* ═══ SECTION 4: TAB PREFERENCES & VISIBILITY ═══ */}
      <section className="p-4 md:p-6 rounded-2xl" style={cardStyle}>
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
                      ⭐️ {isAr ? "الشريط الأساسي (Top Bar)" : "Primary Bar"}
                    </option>
                    <option value="more" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      ⋯ {isAr ? "قائمة المزيد (More)" : "More Menu"}
                    </option>
                    {customMenus.length > 0 && (
                      <optgroup label={isAr ? "القوائم الإضافية المخصصة" : "Custom Menus"}>
                        {customMenus.map((cm) => (
                          <option
                            key={cm.id}
                            value={cm.id}
                            style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}
                          >
                            📂 {isAr ? cm.label_ar || cm.label_en : cm.label_en || cm.label_ar}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="hidden" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}>
                      🚫 {isAr ? "مخفي تماماً (Hidden)" : "Hidden"}
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

      {/* Master Save Button */}
      <button
        disabled={!editable || saving}
        onClick={save}
        className="w-full px-4 py-3.5 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-2 font-bold transition shadow-md hover:-translate-y-0.5 cursor-pointer"
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
    </div>
  );
}

export default SettingsModule;

