/* ═══════════════════════════════════════════════════════════
 * AEROOPS — Main Application v13.1
 * LiveClock + UserProfile + CAMO/Permits/Catering + SideNav + PWA
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plane,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
  MoreHorizontal,
  BookOpen,
  User,
  ShieldCheck,
  FileSignature,
  UtensilsCrossed,
  LayoutDashboard,
  Calendar,
  Clock,
  BarChart3,
  CalendarDays,
  Zap,
  GraduationCap,
  Navigation,
  Settings,
  Users,
  ClipboardList,
  Gauge,
  FolderLock,
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
  Activity,
  FileText,
  List,
} from "lucide-react";

export const MENU_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
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
  Activity,
  FileText,
  List,
  Plane,
  Settings,
  Users,
  MoreHorizontal,
  ShieldCheck,
  BookOpen,
  Navigation,
  Clock,
  Calendar,
  BarChart3,
};

export function getMenuIcon(name?: string) {
  if (name && MENU_ICONS[name]) return MENU_ICONS[name];
  return Layers;
}


/* ═══════ API ═══════ */
import {
  usersAPI,
  crewAPI,
  fleetAPI,
  flightsAPI,
  settingsAPI,
  rolesAPI,
  auditAPI,
  rosterAPI,
  standbyAPI,
  leaveAPI,
  trainingAPI,
  loginHistoryAPI,
  camoAPI,
  melAPI,
  notificationsAPI,
  namedDashboardsAPI,
  qualityAuditsAPI,
  readSheetCache,
  hasPendingSheetMutations,
  toDisplayImageUrl,
} from "./api";

/* ═══════ Config ═══════ */
import {
  setGlobalRoles,
  setGlobalNamedDashboards,
  can as checkPerm,
} from "./config/permissions";
import { getGlobalTheme, DEFAULT_GLOBAL_THEME } from "./config/constants";

/* ═══════ Contexts ═══════ */
import { LangProvider, useT } from "./contexts/LangContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { db, useFirebase } from "./contexts/FirebaseProvider";
import { collection, getDocs, query, where } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "./utils/firebaseUtils";

/* ═══════ Hooks ═══════ */
import { useLocalStorage } from "./hooks/useLocalStorage";

/* ═══════ Utils ═══════ */
import { logSafe, logLoginSafe } from "./utils/audit";
import { unlockAudio } from "./utils/sounds";
import { buildUnifiedFleetAndCamo } from "./utils/fleetCamoSync";
import { hydrateNotificationSettingsFromSheet } from "./utils/notifications";
import { hydrateEmailAccountsFromSheet } from "./utils/emailAccounts";
import { getWhatsAppSettings } from "./utils/whatsapp";

/* ═══════ UI Components ═══════ */
import { SyncBadge } from "./components/ui/SyncBadge";
import { LiveClock } from "./components/ui/LiveClock";
import { DialogHost } from "./components/ui/DialogHost";
import { PWAInstallButton } from "./components/ui/PWAInstallButton";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { AlertsPanel } from "./components/AlertsPanel";
import { Login } from "./components/Login";
import { GenDecModal } from "./components/GenDecModal";
import { SoundNotifications } from "./components/SoundNotifications";
import { UserProfileModal } from "./components/UserProfileModal";

/* ═══════ Modules ═══════ */
import { Dashboard as DashboardRaw } from "./modules/Dashboard";
import { ScheduleBoard as ScheduleBoardRaw } from "./modules/ScheduleBoard";
import { FTLModule as FTLModuleRaw } from "./modules/FTLModule";
import { ReportsModule as ReportsModuleRaw } from "./modules/ReportsModule";
import { Crew as CrewRaw } from "./modules/Crew";
import { Fleet as FleetRaw } from "./modules/Fleet";
import { SettingsModule as SettingsModuleRaw } from "./modules/SettingsModule";
import { RosterModule as RosterModuleRaw } from "./modules/RosterModule";
import { StandbyModule as StandbyModuleRaw } from "./modules/StandbyModule";
import { LeaveModule as LeaveModuleRaw } from "./modules/LeaveModule";
import { TrainingModule as TrainingModuleRaw } from "./modules/TrainingModule";
import { FlightFollowingModule as FlightFollowingModuleRaw } from "./modules/FlightFollowingModule";
import { ChartsModule as ChartsModuleRaw } from "./modules/ChartsModule";
import { ManualsModule as ManualsModuleRaw } from "./modules/ManualsModule";
import { CAMOModule as CAMOModuleRaw } from "./modules/CAMOModule";
import { PermitsModule as PermitsModuleRaw } from "./modules/PermitsModule";
import { FormsModule as FormsModuleRaw } from "./modules/FormsModule";
import { CateringModule as CateringModuleRaw } from "./modules/CateringModule";
import { QualityDashboardModule as QualityDashboardModuleRaw } from "./modules/QualityDashboardModule";
import { CrewPortal as CrewPortalRaw } from "./modules/CrewPortal";
import { DocumentsModule as DocumentsModuleRaw } from "./modules/DocumentsModule";
import { CrewTableIcon } from "./crewIcons";

const Dashboard = DashboardRaw as React.ComponentType<any>;
const ScheduleBoard = ScheduleBoardRaw as React.ComponentType<any>;
const FTLModule = FTLModuleRaw as React.ComponentType<any>;
const ReportsModule = ReportsModuleRaw as React.ComponentType<any>;
const Crew = CrewRaw as React.ComponentType<any>;
const Fleet = FleetRaw as React.ComponentType<any>;
const SettingsModule = SettingsModuleRaw as React.ComponentType<any>;
const RosterModule = RosterModuleRaw as React.ComponentType<any>;
const StandbyModule = StandbyModuleRaw as React.ComponentType<any>;
const LeaveModule = LeaveModuleRaw as React.ComponentType<any>;
const TrainingModule = TrainingModuleRaw as React.ComponentType<any>;
const FlightFollowingModule = FlightFollowingModuleRaw as React.ComponentType<any>;
const ChartsModule = ChartsModuleRaw as React.ComponentType<any>;
const ManualsModule = ManualsModuleRaw as React.ComponentType<any>;
const CAMOModule = CAMOModuleRaw as React.ComponentType<any>;
const PermitsModule = PermitsModuleRaw as React.ComponentType<any>;
const FormsModule = FormsModuleRaw as React.ComponentType<any>;
const CateringModule = CateringModuleRaw as React.ComponentType<any>;
const QualityDashboardModule = QualityDashboardModuleRaw as React.ComponentType<any>;
const CrewPortal = CrewPortalRaw as React.ComponentType<any>;
const DocumentsModule = DocumentsModuleRaw as React.ComponentType<any>;

const REPORTS_SUBTABS = [
  {
    id: "crewHours",
    icon: BarChart3,
    label_en: "Crew Hours",
    label_ar: "ساعات الطاقم",
  },
  {
    id: "fullReport",
    icon: Users,
    label_en: "Full Report",
    label_ar: "تقرير شامل",
  },
  {
    id: "completedFlights",
    icon: Plane,
    label_en: "Completed Flights",
    label_ar: "الرحلات المنفذة",
  },
  {
    id: "dutyTime",
    icon: Clock,
    label_en: "Duty Time",
    label_ar: "ساعات الخدمة",
  },
];

const ALL_TABS_CONFIG = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label_en: "Dashboard",
    label_ar: "الرئيسية",
    perm: "schedule.view",
    position: "primary",
  },
  {
    id: "schedule",
    icon: Calendar,
    label_en: "Schedule",
    label_ar: "الجدول",
    perm: "schedule.view",
    position: "primary",
  },
  {
    id: "ftl",
    icon: Clock,
    label_en: "FTL",
    label_ar: "ساعات الطيران",
    perm: "ftl.view",
    position: "primary",
  },
  {
    id: "reports",
    icon: BarChart3,
    label_en: "Reports",
    label_ar: "التقارير",
    perm: ["reports.view", "charts.view"],
    position: "primary",
  },
  {
    id: "documents",
    icon: FolderLock,
    label_en: "Documents Hub",
    label_ar: "مركز المستندات والامتثال",
    perm: "documents.view",
    position: "primary",
  },
  {
    id: "quality",
    icon: ShieldCheck,
    label_en: "Quality Management",
    label_ar: "إدارة الجودة والامتثال",
    perm: "quality.view",
    position: "more",
  },
  {
    id: "roster",
    icon: CalendarDays,
    label_en: "Roster & Planning",
    label_ar: "الجداول والمناوبات والراحات",
    perm: "roster.view",
    position: "more",
  },
  {
    id: "training",
    icon: GraduationCap,
    label_en: "Training",
    label_ar: "التدريب",
    perm: "training.view",
    position: "more",
  },
  {
    id: "tracking",
    icon: Navigation,
    label_en: "Following",
    label_ar: "متابعة الرحلات",
    perm: "tracking.view",
    position: "more",
  },
  {
    id: "fleet",
    icon: Plane,
    label_en: "Fleet",
    label_ar: "الأسطول",
    perm: "fleet.view",
    position: "more",
  },
  {
    id: "crew",
    icon: CrewTableIcon,
    label_en: "Crew",
    label_ar: "الطاقم",
    perm: "crew.view",
    position: "more",
  },
  {
    id: "camo",
    icon: ShieldCheck,
    label_en: "CAMO",
    label_ar: "إدارة الصلاحية",
    perm: "camo.view",
    position: "more",
  },
  {
    id: "permits",
    icon: FileSignature,
    label_en: "Permits & Forms",
    label_ar: "التصاريح والنماذج",
    perm: ["permits.view", "forms.view"],
    position: "more",
  },
  {
    id: "catering",
    icon: UtensilsCrossed,
    label_en: "Catering",
    label_ar: "التموين",
    perm: "catering.view",
    position: "more",
  },
  {
    id: "manuals",
    icon: BookOpen,
    label_en: "Manuals",
    label_ar: "الأدلة والمراجع",
    perm: "schedule.view",
    position: "more",
  },
  {
    id: "settings",
    icon: Settings,
    label_en: "Settings",
    label_ar: "الإعدادات",
    perm: "settings.view",
    position: "more",
  },
];

function logoToDisplayUrl(url?: string | null): string | null {
  return toDisplayImageUrl(url);
}

function AppInner({
  lang,
  setLang,
}: {
  lang: string;
  setLang: (val: string) => void;
}) {
  const t = useT() as any;
  const { user, setUser, logout: authLogout } = useAuth() as any;
  const { firebaseUser, authReady, signOutFirebase } = useFirebase() as any;

  const [tab, setTab] = useLocalStorage("aeroops.tab", "dashboard");
  const [darkMode, setDarkMode] = useLocalStorage("aeroops.darkMode", false);

  const [users, setUsers] = useState<any[]>(() => readSheetCache("Users", []));
  const [crew, setCrew] = useState<any[]>(() => readSheetCache("Crew", []));
  const [fleet, setFleet] = useState<any[]>(() => readSheetCache("Fleet", []));
  const [camoList, setCamoList] = useState<any[]>(() =>
    readSheetCache("CAMO", [])
  );
  const [melList, setMelList] = useState<any[]>(() =>
    readSheetCache("MEL", [])
  );
  const [flights, setFlights] = useState<any[]>(() =>
    readSheetCache("Flights", [])
  );
  const [roles, setRoles] = useState<any[]>(() => {
    const cachedRoles = readSheetCache("Roles", []);
    if (Array.isArray(cachedRoles) && cachedRoles.length > 0) {
      setGlobalRoles(cachedRoles);
    }
    const cachedNamedDash = readSheetCache("NamedDashboards", []);
    if (Array.isArray(cachedNamedDash) && cachedNamedDash.length > 0) {
      setGlobalNamedDashboards(cachedNamedDash);
    }
    return cachedRoles;
  });
  const [roster, setRoster] = useState<any[]>(() =>
    readSheetCache("Roster", [])
  );
  const [standby, setStandby] = useState<any[]>(() =>
    readSheetCache("Standby", [])
  );
  const [leave, setLeave] = useState<any[]>(() => readSheetCache("Leave", []));
  const [training, setTraining] = useState<any[]>(() =>
    readSheetCache("Training", [])
  );
  const [auditLogs, setAuditLogs] = useState<any[]>(() =>
    readSheetCache("AuditLog", [])
  );
  const [loginHistory, setLoginHistory] = useState<any[]>(() =>
    readSheetCache("LoginHistory", [])
  );

  const { unifiedFleet, unifiedCamo } = useMemo(
    () => buildUnifiedFleetAndCamo(fleet, camoList),
    [fleet, camoList]
  );

  const [settings, setSettings] = useState<any>(() => {
    let cached: any = readSheetCache("Settings", null);
    if (!cached && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("aeroops.settingsCache");
        if (raw) cached = JSON.parse(raw);
      } catch {}
    }
    const initialTf = cached?.timeFormat === "12" ? "12" : "24";
    if (typeof window !== "undefined") {
      (window as any).__AEROOPS_TIME_FORMAT = initialTf;
      try {
        window.localStorage.setItem("aeroops.timeFormat", initialTf);
      } catch {}
    }
    return {
      id: cached?.id || null,
      companyName: cached?.companyName || "Flight Operations",
      companyNameAr: cached?.companyNameAr || "إدارة العمليات الجوية",
      operatorCode: (cached?.operatorCode || "EACS").toUpperCase(),
      country: cached?.country || "",
      timeFormat: initialTf,
      navLayout: cached?.navLayout || "top",
      tabPreferences: cached?.tabPreferences || null,
      customMenus:
        cached?.customMenus ||
        cached?.tabPreferences?.__customMenus ||
        (() => {
          try {
            const raw = localStorage.getItem("aeroops.customMenus");
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        })(),
      logo: cached?.logo || null,
      stamp: cached?.stamp || null,
      timeMode: cached?.timeMode || "utc",
      globalTheme: cached?.globalTheme || DEFAULT_GLOBAL_THEME,
      portalTheme: cached?.portalTheme || DEFAULT_GLOBAL_THEME,
      ...(cached || {}),
    };
  });

  const [loading, setLoading] = useState(
    () => readSheetCache("Users", []).length === 0
  );
  const [syncStatus, setSyncStatus] = useState("idle");
  const [genDec, setGenDec] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const moreOpen = openMenuId === "more";
  const moreRef = useRef<HTMLDivElement>(null);
  const toggleMenu = (menuId: string) => {
    setOpenMenuId((prev) => (prev === menuId ? null : menuId));
  };
  const [reportsOpen, setReportsOpen] = useState(false);
  const reportsRef = useRef<HTMLDivElement>(null);
  const [viewingProfile, setViewingProfile] = useState<any>(null);

  const [navLayout, setNavLayout] = useState(() => {
    if (typeof window === "undefined") return "top";
    return localStorage.getItem("aeroops.navLayout") || "top";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const nextTf = settings?.timeFormat === "12" ? "12" : "24";
      (window as any).__AEROOPS_TIME_FORMAT = nextTf;
    }
  }, [settings?.timeFormat]);

  useEffect(() => {
    const onTimeFormatChanged = (e: Event) => {
      const detailTf = (e as CustomEvent)?.detail;
      const nextTf =
        detailTf === "12" ||
        (typeof window !== "undefined" &&
          window.localStorage.getItem("aeroops.timeFormat") === "12")
          ? "12"
          : "24";
      (window as any).__AEROOPS_TIME_FORMAT = nextTf;
      setSettings((prev: any) =>
        prev?.timeFormat === nextTf ? prev : { ...prev, timeFormat: nextTf }
      );
    };
    const onTimeModeChanged = (e: Event) => {
      const detailTm = (e as CustomEvent)?.detail;
      const nextTm =
        detailTm === "LOCAL" ||
        (typeof window !== "undefined" &&
          window.localStorage.getItem("aeroops.timeMode") === "LOCAL")
          ? "LOCAL"
          : "UTC";
      (window as any).__AEROOPS_TIME_MODE = nextTm;
      setSettings((prev: any) =>
        prev?.timeMode === nextTm ? prev : { ...prev, timeMode: nextTm }
      );
    };
    window.addEventListener("aeroops:timeFormatChanged", onTimeFormatChanged);
    window.addEventListener("aeroops:timeModeChanged", onTimeModeChanged);
    return () => {
      window.removeEventListener(
        "aeroops:timeFormatChanged",
        onTimeFormatChanged
      );
      window.removeEventListener("aeroops:timeModeChanged", onTimeModeChanged);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem("aeroops.navLayout") || "top";
      setNavLayout(saved);
      try {
        const rawTp = localStorage.getItem("aeroops.tabPreferences");
        const rawCm = localStorage.getItem("aeroops.customMenus");
        const rawTo = localStorage.getItem("aeroops.tabOrder");
        const nextTp = rawTp ? JSON.parse(rawTp) : null;
        const nextCm = rawCm ? JSON.parse(rawCm) : null;
        const nextTo = rawTo ? JSON.parse(rawTo) : null;
        setSettings((prev: any) => ({
          ...prev,
          tabPreferences: nextTp ?? prev?.tabPreferences,
          customMenus: nextCm ?? prev?.customMenus,
          tabOrder: nextTo ?? prev?.tabOrder,
        }));
      } catch {}
    };
    window.addEventListener("aeroops:prefsChanged", handler);
    return () => window.removeEventListener("aeroops:prefsChanged", handler);
  }, []);

  useEffect(() => {
    if (settings?.navLayout && settings.navLayout !== navLayout) {
      setNavLayout(settings.navLayout);
      localStorage.setItem("aeroops.navLayout", settings.navLayout);
    }
  }, [settings?.navLayout]);

  const isSideNav = navLayout === "side";

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  useEffect(() => {
    const themeId =
      settings?.globalTheme || settings?.portalTheme || DEFAULT_GLOBAL_THEME;
    const theme = getGlobalTheme(themeId);
    const isDark = darkMode;
    const vars =
      isDark && Object.keys(theme.darkVars || {}).length > 0
        ? { ...theme.vars, ...theme.darkVars }
        : theme.vars;
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value as string);
    });
    document.documentElement.setAttribute("data-theme", themeId);
  }, [settings?.globalTheme, settings?.portalTheme, darkMode]);

  /* Dynamic PWA icons, title, and manifest refresh from Settings */
  useEffect(() => {
    const companyTitle = String(
      settings?.companyName || settings?.companyNameAr || ""
    ).trim();
    const operatorCode = String(settings?.operatorCode || "").trim().toUpperCase();
    const appTitle = operatorCode
      ? `${companyTitle ? `${companyTitle} (${operatorCode})` : operatorCode} — Flight Operations`
      : `${companyTitle || "Flight Operations"} — Flight Operations`;

    if (companyTitle || operatorCode) {
      document.title = appTitle;
      const appleTitle = document.querySelector(
        "meta[name='apple-mobile-web-app-title']"
      ) as HTMLMetaElement | null;
      if (appleTitle)
        appleTitle.content = operatorCode || companyTitle || "Flight Ops";
    }

    if (settings?.logo) {
      const url = logoToDisplayUrl(settings.logo);
      if (url) {
        let iconLink = document.querySelector(
          "link[rel='icon']"
        ) as HTMLLinkElement | null;
        if (!iconLink) {
          iconLink = document.createElement("link");
          iconLink.rel = "icon";
          document.head.appendChild(iconLink);
        }
        iconLink.href = url;

        let appleIcon = document.querySelector(
          "link[rel='apple-touch-icon']"
        ) as HTMLLinkElement | null;
        if (!appleIcon) {
          appleIcon = document.createElement("link");
          appleIcon.rel = "apple-touch-icon";
          document.head.appendChild(appleIcon);
        }
        appleIcon.href = url;
      }
    }

    const manifestLink = document.querySelector(
      "link[rel='manifest']"
    ) as HTMLLinkElement | null;
    if (
      manifestLink &&
      (settings?.companyName ||
        settings?.companyNameAr ||
        settings?.operatorCode ||
        settings?.logo)
    ) {
      manifestLink.href = `/api/manifest.json?v=${encodeURIComponent(
        `${settings.companyName || ""}_${settings.companyNameAr || ""}_${settings.operatorCode || ""}_${settings.logo ? "1" : "0"}`
      )}`;
    }
  }, [
    settings?.logo,
    settings?.companyName,
    settings?.companyNameAr,
    settings?.operatorCode,
  ]);

  useEffect(() => {
    setGlobalRoles(roles);
  }, [roles]);

  /* Keep logged-in session user in sync with fresh backend Users records */
  useEffect(() => {
    if (!user || !Array.isArray(users) || users.length === 0) return;
    const freshUser = users.find(
      (u) =>
        (user.id != null && String(u.id) === String(user.id)) ||
        (user.username &&
          u.username &&
          String(u.username).toLowerCase() ===
            String(user.username).toLowerCase())
    );
    if (!freshUser) return;
    const prevPermsJson = JSON.stringify(user.perms || []);
    const nextPermsJson = JSON.stringify(freshUser.perms || []);
    if (
      user.role !== freshUser.role ||
      prevPermsJson !== nextPermsJson ||
      String(user.crewId || "") !== String(freshUser.crewId || "") ||
      user.fullName !== freshUser.fullName
    ) {
      setUser({ ...user, ...freshUser });
    }
  }, [users, user, setUser]);

  /* Sync Cloud Firestore ACL roles when authenticated */
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) return;
    let cancelled = false;
    const isBootstrappedAdmin =
      String(firebaseUser.email || "").toLowerCase() === "123adam133@gmail.com";
    const q = isBootstrappedAdmin
      ? collection(db, "roles")
      : query(collection(db, "roles"), where("active", "==", true));

    getDocs(q)
      .then((snap) => {
        if (cancelled || snap.empty) return;
        setRoles((prev) => {
          const map = new Map<string, any>();
          prev.forEach((r) => {
            if (r?.name) map.set(String(r.name).toLowerCase(), r);
          });
          snap.docs.forEach((d) => {
            const data = d.data();
            if (!data?.name) return;
            const key = String(data.name).toLowerCase();
            const existing = map.get(key) || {};
            map.set(key, {
              ...existing,
              id: existing.id || d.id,
              name: data.name,
              nameAr: data.nameAr || existing.nameAr || data.name,
              description: data.description || existing.description || "",
              perms: Array.isArray(data.perms) ? data.perms : existing.perms || [],
              active: data.active !== false,
            });
          });
          const merged = Array.from(map.values());
          setGlobalRoles(merged);
          return merged;
        });
      })
      .catch((err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, "roles");
        } catch {
          // Logged via handleFirestoreError; keep Google Sheets / local roles active
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser?.uid, firebaseUser?.emailVerified]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (openMenuId && !target?.closest("[data-nav-dropdown]")) {
        setOpenMenuId(null);
      }
      if (reportsRef.current && !reportsRef.current.contains(e.target as Node)) {
        setReportsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId]);

  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("click", handler);
    window.addEventListener("touchstart", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const loadData = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && users.length === 0) {
      setLoading(true);
    }
    setSyncStatus("syncing");
    try {
      // Tier 1: Critical Login, Roles, Crew, Fleet, Flights, & Notifications (fast ~1s)
      const [u, s, r, c, fl, f] = await Promise.all([
        usersAPI.list().catch((e) => {
          console.error("Error loading Users:", e);
          return readSheetCache("Users", []);
        }),
        settingsAPI.get().catch((e) => {
          console.error("Error loading Settings:", e);
          return null;
        }),
        rolesAPI.list().catch((e) => {
          console.error("Error loading Roles:", e);
          return readSheetCache("Roles", []);
        }),
        crewAPI.list().catch((e) => {
          console.error("Error loading Crew:", e);
          return readSheetCache("Crew", []);
        }),
        flightsAPI.list().catch((e) => {
          console.error("Error loading Flights:", e);
          return readSheetCache("Flights", []);
        }),
        fleetAPI.list().catch((e) => {
          console.error("Error loading Fleet:", e);
          return readSheetCache("Fleet", []);
        }),
        notificationsAPI.list().catch(() => []),
      ]);

      if (Array.isArray(u)) setUsers(u);
      if (s) {
        setSettings(s);
        try {
          window.localStorage.setItem("aeroops.settingsCache", JSON.stringify(s));
        } catch {}
      }
      if (Array.isArray(r)) {
        setRoles(r);
        setGlobalRoles(r);
      }
      if (Array.isArray(c)) setCrew(c);
      if (Array.isArray(fl)) setFlights(fl);
      if (Array.isArray(f)) setFleet(f);

      // Unblock UI immediately after Tier 1 completes
      setLoading(false);

      // Tier 2: Secondary operational sheets & AppConfig hydration in background
      const [cm, ml, ro, st, lv, tr, al, lh, nd] = await Promise.all([
        camoAPI.list().catch(() => readSheetCache("CAMO", [])),
        melAPI.list().catch(() => readSheetCache("MEL", [])),
        rosterAPI.list().catch(() => readSheetCache("Roster", [])),
        standbyAPI.list().catch(() => readSheetCache("Standby", [])),
        leaveAPI.list().catch(() => readSheetCache("Leave", [])),
        trainingAPI.list().catch(() => readSheetCache("Training", [])),
        auditAPI.list().catch(() => readSheetCache("AuditLog", [])),
        loginHistoryAPI.list().catch(() => readSheetCache("LoginHistory", [])),
        namedDashboardsAPI.list().catch(() => readSheetCache("NamedDashboards", [])),
        qualityAuditsAPI.list().catch(() => readSheetCache("QualityAudits", [])),
        hydrateNotificationSettingsFromSheet().catch(() => null),
        hydrateEmailAccountsFromSheet().catch(() => null),
        getWhatsAppSettings().catch(() => null),
      ]);

      if (Array.isArray(cm)) setCamoList(cm);
      if (Array.isArray(ml)) setMelList(ml);
      if (Array.isArray(ro)) setRoster(ro);
      if (Array.isArray(st)) setStandby(st);
      if (Array.isArray(lv)) setLeave(lv);
      if (Array.isArray(tr)) setTraining(tr);
      if (Array.isArray(al)) setAuditLogs(al);
      if (Array.isArray(lh)) setLoginHistory(lh);
      if (Array.isArray(nd) && nd.length > 0) setGlobalNamedDashboards(nd);
      setSyncStatus("synced");
    } catch (e) {
      console.error("Critical load failure:", e);
      setSyncStatus("error");
      setLoading(false);
    }
  };

  const reloadFlights = async () => {
    const fl = await flightsAPI.list();
    setFlights(fl);
    return fl;
  };

  useEffect(() => {
    loadData();
  }, []);

  // Periodic fast Google Sheets sync while tab is visible (respecting active mutations)
  useEffect(() => {
    const quickSync = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (hasPendingSheetMutations()) return;
      try {
        const [fl, c, u, r] = await Promise.all([
          flightsAPI.list().catch(() => null),
          crewAPI.list().catch(() => null),
          usersAPI.list().catch(() => null),
          rolesAPI.list().catch(() => null),
          notificationsAPI.list().catch(() => null),
        ]);
        if (hasPendingSheetMutations()) return;
        if (Array.isArray(fl)) setFlights(fl);
        if (Array.isArray(c)) setCrew(c);
        if (Array.isArray(u)) setUsers(u);
        if (Array.isArray(r)) {
          setRoles(r);
          setGlobalRoles(r);
        }
      } catch {}
    };

    const interval = setInterval(quickSync, 25000);
    window.addEventListener("focus", quickSync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", quickSync);
    };
  }, []);

  const handleLogin = (u: any) => {
    setUser(u);
  };

  const handleLogout = () => {
    if (user) {
      logLoginSafe(user, "LOGOUT", true);
      logSafe(user, "LOGOUT", "Auth", user.id, user.fullName, {});
    }
    if (typeof signOutFirebase === "function") signOutFirebase();
    if (typeof authLogout === "function") authLogout();
    else setUser(null);
  };

  if (!user) {
    return (
      <>
        <DialogHost />
        <OfflineIndicator />
        <Login
          users={users}
          onLogin={handleLogin}
          settings={settings}
          loading={loading}
        />
      </>
    );
  }

  const prefs = (() => {
    if (
      settings.tabPreferences &&
      typeof settings.tabPreferences === "object" &&
      Object.keys(settings.tabPreferences).length > 0
    ) {
      return settings.tabPreferences;
    }
    try {
      const local = JSON.parse(
        localStorage.getItem("aeroops.tabPreferences") || "{}"
      );
      if (Object.keys(local).length > 0) return local;
    } catch {}
    return ALL_TABS_CONFIG.reduce((acc: any, item) => {
      acc[item.id] = item.position;
      return acc;
    }, {});
  })();

  const hasTabPerm = (perm: string | string[]) =>
    Array.isArray(perm)
      ? perm.some((p) => checkPerm(user, p))
      : checkPerm(user, perm);

  const tabOrder: string[] = useMemo(() => {
    if (Array.isArray(settings?.tabOrder)) return settings.tabOrder;
    const tp = settings?.tabPreferences;
    if (Array.isArray(tp?.__tabOrder)) return tp.__tabOrder;
    try {
      const raw = localStorage.getItem("aeroops.tabOrder");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [settings?.tabOrder, settings?.tabPreferences]);

  const moreMenuConfig = useMemo(() => {
    if (settings?.moreMenuConfig && typeof settings.moreMenuConfig === "object") {
      return settings.moreMenuConfig;
    }
    const tp = settings?.tabPreferences;
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
  }, [settings?.moreMenuConfig, settings?.tabPreferences]);

  const isMoreEnabled = moreMenuConfig.enabled !== false;

  const getTabsByPosition = (position: string) => {
    const list = ALL_TABS_CONFIG.filter((item) => hasTabPerm(item.perm)).filter(
      (item) => {
        const tabPos = prefs[item.id] || item.position || "more";
        if (position === "primary") {
          if (tabPos === "primary") return true;
          if (tabPos === "more" && !isMoreEnabled) return true;
          return false;
        }
        if (position === "more") {
          if (!isMoreEnabled) return false;
          return tabPos === "more";
        }
        return tabPos === position;
      }
    );
    if (tabOrder.length > 0) {
      return [...list].sort((a, b) => {
        const idxA = tabOrder.indexOf(a.id);
        const idxB = tabOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    return list;
  };

  const primaryTabs = getTabsByPosition("primary");
  const moreTabs = getTabsByPosition("more");

  const customMenus: Array<{ id: string; label_en: string; label_ar: string; icon?: string }> = useMemo(() => {
    if (Array.isArray(settings?.customMenus)) return settings.customMenus;
    const tp = settings?.tabPreferences;
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
  }, [settings?.customMenus, settings?.tabPreferences]);

  const navItemsOrder: string[] = useMemo(() => {
    if (Array.isArray(settings?.navItemsOrder)) return settings.navItemsOrder;
    const tp = settings?.tabPreferences;
    if (Array.isArray(tp?.__navItemsOrder)) return tp.__navItemsOrder;
    try {
      const raw = localStorage.getItem("aeroops.navItemsOrder");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [settings?.navItemsOrder, settings?.tabPreferences]);

  const customMenuTabsMap = useMemo(() => {
    const map: Record<string, typeof ALL_TABS_CONFIG> = {};
    for (const m of customMenus) {
      map[m.id] = getTabsByPosition(m.id);
    }
    return map;
  }, [customMenus, prefs, user]);

  const unifiedTopNavItems = useMemo(() => {
    const items: Array<{
      kind: "tab" | "menu" | "more";
      id: string;
      tab?: typeof ALL_TABS_CONFIG[0];
      menu?: { id: string; label_en: string; label_ar: string; icon?: string };
      tabs?: typeof ALL_TABS_CONFIG;
    }> = [];

    // Add primary tabs
    primaryTabs.forEach((tab) => {
      items.push({ kind: "tab", id: tab.id, tab });
    });

    // Add custom menus that have assigned tabs
    customMenus.forEach((menu) => {
      const mTabs = customMenuTabsMap[menu.id] || [];
      if (mTabs.length > 0) {
        items.push({ kind: "menu", id: menu.id, menu, tabs: mTabs });
      }
    });

    // Add More menu if enabled and has tabs
    if (isMoreEnabled && moreTabs.length > 0) {
      items.push({ kind: "more", id: "more", tabs: moreTabs });
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
  }, [primaryTabs, customMenus, customMenuTabsMap, isMoreEnabled, moreTabs, navItemsOrder]);

  const isCrewMember = user?.role === "crewMember";
  const hasLinkedCrewRecord =
    !!user?.crewId ||
    crew.some((c: any) => {
      const uEmail = String(user?.email || "").trim().toLowerCase();
      const uName = String(user?.username || "").trim().toLowerCase();
      if (uEmail && String(c.email || "").trim().toLowerCase() === uEmail)
        return true;
      if (uName && String(c.empNo || "").trim().toLowerCase() === uName)
        return true;
      return false;
    });
  const shouldShowCrewPortal =
    (hasLinkedCrewRecord && (isCrewMember || checkPerm(user, "crew.portal"))) ||
    (isCrewMember && !checkPerm(user, "dashboard.view"));

  const VALID_BASE_TABS = new Set([
    "dashboard",
    "quality",
    "quality_dashboard",
    "schedule",
    "ftl",
    "reports",
    "roster",
    "standby",
    "leave",
    "training",
    "tracking",
    "charts",
    "fleet",
    "crew",
    "camo",
    "permits",
    "forms",
    "catering",
    "documents",
    "manuals",
    "settings",
  ]);
  const rawTab = typeof tab === "string" && tab.trim() ? tab.trim() : "dashboard";
  const effectiveTab = shouldShowCrewPortal ? "dashboard" : rawTab;
  const candidateBaseTab = effectiveTab.includes(".")
    ? effectiveTab.split(".")[0]
    : effectiveTab;
  const baseTabId = VALID_BASE_TABS.has(candidateBaseTab)
    ? candidateBaseTab
    : "dashboard";

  const isReportsActive =
    baseTabId === "reports" || baseTabId === "charts";

  const isNavTabActive = (id: string) => {
    if (id === "reports") return baseTabId === "reports" || baseTabId === "charts";
    if (id === "permits") return baseTabId === "permits" || baseTabId === "forms";
    if (id === "roster")
      return (
        baseTabId === "roster" ||
        baseTabId === "standby" ||
        baseTabId === "leave"
      );
    if (id === "quality")
      return baseTabId === "quality" || baseTabId === "quality_dashboard";
    return baseTabId === id;
  };

  const goTab = (id: string) => {
    setTab(id);
    setOpenMenuId(null);
    setReportsOpen(false);
    setDrawerOpen(false);
  };

  const displayName = user.fullName || user.username || "User";
  const operatorCode = (settings.operatorCode || "EACS").toUpperCase();
  const logoDisplayUrl = logoToDisplayUrl(settings.logo);

  const showChrome = !(shouldShowCrewPortal && effectiveTab === "dashboard");

  const renderMain = () => (
    <div className={shouldShowCrewPortal ? "pb-0" : "p-2 md:p-3 pb-20 md:pb-3"}>
      {loading && users.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20"
          style={{ color: "var(--text-muted)" }}
        >
          <div
            className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-4"
            style={{
              borderColor: "var(--brand-primary)",
              borderTopColor: "transparent",
            }}
          />
          <p>{t.loadingData}</p>
        </div>
      ) : (
        <>
          {shouldShowCrewPortal && (crew.length > 0 || !loading) && (
            <CrewPortal
              crew={crew}
              flights={flights}
              setFlights={setFlights}
              reloadFlights={reloadFlights}
              fleet={unifiedFleet}
              rawFleet={fleet}
              camoList={camoList}
              melList={melList}
              roles={roles}
              settings={settings}
              currentUser={user}
              users={users}
              setUsers={setUsers}
              setSyncStatus={setSyncStatus}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              lang={lang}
              setLang={setLang}
            />
          )}

          {!shouldShowCrewPortal &&
            baseTabId === "dashboard" &&
            (loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--brand-primary)]"></div>
              </div>
            ) : (
              <Dashboard
                flights={flights}
                crew={crew}
                fleet={unifiedFleet}
                camoList={unifiedCamo}
                melList={melList}
                users={users}
                roles={roles}
                leave={leave}
                roster={roster}
                standby={standby}
                training={training}
                auditLogs={auditLogs}
                loginHistory={loginHistory}
                settings={settings}
                syncStatus={syncStatus}
                onRefresh={loadData}
                setTab={goTab}
                loading={loading}
                lang={lang}
              />
            ))}

          {(baseTabId === "quality" ||
            baseTabId === "quality_dashboard") && (
            <QualityDashboardModule
              flights={flights}
              crew={crew}
              fleet={unifiedFleet}
              camoList={unifiedCamo}
              melList={melList}
              users={users}
              roles={roles}
              leave={leave}
              roster={roster}
              standby={standby}
              training={training}
              auditLogs={auditLogs}
              loginHistory={loginHistory}
              settings={settings}
              syncStatus={syncStatus}
              onRefresh={loadData}
              setTab={goTab}
              setSyncStatus={setSyncStatus}
              lang={lang}
            />
          )}

          {baseTabId === "schedule" && (
            <ScheduleBoard
              flights={flights}
              setFlights={setFlights}
              reloadFlights={reloadFlights}
              crew={crew}
              fleet={unifiedFleet}
              camoList={unifiedCamo}
              settings={settings}
              onGenDec={setGenDec}
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "ftl" && <FTLModule crew={crew} flights={flights} />}
          {(baseTabId === "reports" || baseTabId === "charts") && (
            <ReportsModule
              flights={flights}
              setFlights={setFlights}
              reloadFlights={reloadFlights}
              setSyncStatus={setSyncStatus}
              crew={crew}
              fleet={unifiedFleet}
              leave={leave}
              settings={settings}
              user={user}
              lang={lang}
              initialSubTab={
                baseTabId === "charts"
                  ? "charts"
                  : effectiveTab.includes(".")
                  ? effectiveTab.split(".")[1]
                  : "crewHours"
              }
            />
          )}
          {(baseTabId === "roster" ||
            baseTabId === "standby" ||
            baseTabId === "leave") && (
            <RosterModule
              crew={crew}
              roster={roster}
              setRoster={setRoster}
              standby={standby}
              setStandby={setStandby}
              leave={leave}
              setLeave={setLeave}
              currentUser={user}
              user={user}
              users={users}
              roles={roles}
              settings={settings}
              setSyncStatus={setSyncStatus}
              initialSubTab={
                baseTabId === "standby"
                  ? "standby"
                  : baseTabId === "leave"
                  ? "leave"
                  : tab.includes(".")
                  ? tab.split(".")[1]
                  : "roster"
              }
              lang={lang}
            />
          )}
          {baseTabId === "training" && (
            <TrainingModule
              crew={crew}
              training={training}
              setTraining={setTraining}
              flights={flights}
              fleet={unifiedFleet}
              camoList={unifiedCamo}
              melList={melList}
              users={users}
              roles={roles}
              leave={leave}
              roster={roster}
              standby={standby}
              auditLogs={auditLogs}
              loginHistory={loginHistory}
              settings={settings}
              syncStatus={syncStatus}
              onRefresh={loadData}
              setTab={goTab}
              user={user}
              lang={lang}
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "tracking" && (
            <FlightFollowingModule flights={flights} fleet={unifiedFleet} />
          )}
          {baseTabId === "fleet" && (
            <Fleet
              fleet={unifiedFleet}
              rawFleet={fleet}
              setFleet={setFleet}
              camoList={camoList}
              setCamoList={setCamoList}
              melList={melList}
              lang={lang}
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "crew" && (
            <Crew
              crew={crew}
              setCrew={setCrew}
              users={users}
              setUsers={setUsers}
              fleet={unifiedFleet}
              companyName={settings.companyName}
              setSyncStatus={setSyncStatus}
              settings={settings}
            />
          )}
          {baseTabId === "camo" && (
            <CAMOModule
              fleet={unifiedFleet}
              rawFleet={fleet}
              setFleet={setFleet}
              camoList={camoList}
              setCamoList={setCamoList}
              unifiedCamo={unifiedCamo}
              melList={melList}
              setMelList={setMelList}
              flights={flights}
              crew={crew}
              users={users}
              roles={roles}
              leave={leave}
              roster={roster}
              standby={standby}
              training={training}
              auditLogs={auditLogs}
              loginHistory={loginHistory}
              settings={settings}
              user={user}
              syncStatus={syncStatus}
              onRefresh={loadData}
              setTab={goTab}
              lang={lang}
              setSyncStatus={setSyncStatus}
            />
          )}
          {(baseTabId === "permits" || baseTabId === "forms") && (
            <PermitsModule
              flights={flights}
              fleet={unifiedFleet}
              camoList={unifiedCamo}
              crew={crew}
              settings={settings}
              user={user}
              lang={lang}
              initialSubTab={
                baseTabId === "forms"
                  ? "forms"
                  : effectiveTab.includes(".")
                  ? effectiveTab.split(".")[1]
                  : undefined
              }
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "catering" && (
            <CateringModule
              flights={flights}
              settings={settings}
              user={user}
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "documents" && (
            <DocumentsModule
              crew={crew}
              users={users}
              fleet={unifiedFleet}
              settings={settings}
              user={user}
              lang={lang}
              setSyncStatus={setSyncStatus}
            />
          )}
          {baseTabId === "manuals" && (
            <ManualsModule
              settings={settings}
              companyName={settings.companyName}
              lang={lang}
            />
          )}
          {baseTabId === "settings" && (
            <SettingsModule
              settings={settings}
              setSettings={setSettings}
              lang={lang}
              setLang={setLang}
              users={users}
              setUsers={setUsers}
              roles={roles}
              setRoles={setRoles}
              loginHistory={loginHistory}
              setLoginHistory={setLoginHistory}
              auditLogs={auditLogs}
              setAuditLogs={setAuditLogs}
              crew={crew}
              setSyncStatus={setSyncStatus}
            />
          )}
        </>
      )}
    </div>
  );

  const renderSideNav = () => {
    const allTabs = [...primaryTabs, ...moreTabs];
    return (
      <>
        {/* Mobile Header when SideNav is active */}
        <header
          className="md:hidden sticky top-0 z-40 px-3 py-2 flex items-center justify-between border-b shadow-sm"
          style={{
            backgroundColor: "var(--bg-sidebar)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-lg"
              style={{
                backgroundColor: "var(--bg-app)",
                color: "var(--text-primary)",
              }}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span
              className="font-black text-base tracking-wider font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {operatorCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <PWAInstallButton settings={settings} />
            <SyncBadge status={syncStatus} onRetry={loadData} />
            <AlertsPanel crew={crew} users={users} fleet={unifiedFleet} />
            {checkPerm(user, "settings.view") && (
              <button
                onClick={() => goTab("settings")}
                className={`p-2 rounded-lg transition ${
                  effectiveTab === "settings"
                    ? "ring-2 ring-blue-500 shadow-sm"
                    : ""
                }`}
                style={{
                  backgroundColor:
                    effectiveTab === "settings"
                      ? "var(--bg-card)"
                      : "var(--bg-app)",
                  color:
                    effectiveTab === "settings"
                      ? "var(--brand-primary)"
                      : "var(--text-muted)",
                }}
                title={lang === "ar" ? "الإعدادات" : "Settings"}
                aria-label={lang === "ar" ? "الإعدادات" : "Settings"}
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg transition"
              style={{
                backgroundColor: "var(--bg-app)",
                color: "var(--text-muted)",
              }}
            >
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </header>

        <aside
          className="hidden md:flex fixed inset-y-0 start-0 z-40 w-64 flex-col shadow-xl border-e"
          style={{
            backgroundColor: "var(--bg-sidebar)",
            borderColor: "var(--border-default)",
          }}
        >
          <div
            className="p-4 flex items-center gap-3 border-b flex-shrink-0"
            style={{ borderColor: "var(--border-default)" }}
          >
            {logoDisplayUrl ? (
              <img
                src={logoDisplayUrl}
                alt="logo"
                className="w-11 h-11 rounded-lg object-contain bg-white p-1"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plane className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="font-black text-lg font-mono tracking-widest truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {operatorCode}
              </div>
              <div
                className="text-[10px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {lang === "ar" ? settings.companyNameAr : settings.companyName}
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {primaryTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
              const isActive = isNavTabActive(id);
              return (
                <button
                  key={id}
                  onClick={() => goTab(id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition text-start"
                  style={
                    isActive
                      ? { background: "var(--brand-gradient)", color: "white" }
                      : { color: "var(--text-muted)" }
                  }
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.2)"
                        : "var(--bg-app)",
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="truncate">
                    {lang === "ar" ? label_ar : label_en}
                  </span>
                </button>
              );
            })}

            {customMenus.map((cMenu) => {
              const menuTabs = customMenuTabsMap[cMenu.id] || [];
              if (menuTabs.length === 0) return null;
              const MenuIcon = getMenuIcon(cMenu.icon);
              return (
                <div key={cMenu.id} className="pt-2">
                  <div
                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <MenuIcon className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {lang === "ar"
                        ? cMenu.label_ar || cMenu.label_en
                        : cMenu.label_en || cMenu.label_ar}
                    </span>
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {menuTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
                      const isActive = isNavTabActive(id);
                      return (
                        <button
                          key={id}
                          onClick={() => goTab(id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition text-start"
                          style={
                            isActive
                              ? {
                                  background: "var(--brand-gradient)",
                                  color: "white",
                                }
                              : { color: "var(--text-muted)" }
                          }
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: isActive
                                ? "rgba(255,255,255,0.2)"
                                : "var(--bg-app)",
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="truncate">
                            {lang === "ar" ? label_ar : label_en}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {moreTabs.length > 0 && (
              <div className="pt-2">
                <div
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span>{lang === "ar" ? "المزيد" : "More"}</span>
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {moreTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
                    const isActive = isNavTabActive(id);
                    return (
                      <button
                        key={id}
                        onClick={() => goTab(id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition text-start"
                        style={
                          isActive
                            ? {
                                background: "var(--brand-gradient)",
                                color: "white",
                              }
                            : { color: "var(--text-muted)" }
                        }
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: isActive
                              ? "rgba(255,255,255,0.2)"
                              : "var(--bg-app)",
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="truncate">
                          {lang === "ar" ? label_ar : label_en}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div
            className="p-3 border-t flex-shrink-0 space-y-2"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex justify-center">
              <LiveClock />
            </div>

            <div className="flex items-center gap-1.5 w-full">
              <button
                onClick={() => setViewingProfile(user)}
                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700/60"
                title={lang === "ar" ? "عرض الملف الشخصي" : "View profile"}
              >
                <User
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: "var(--brand-primary)" }}
                />
                <span
                  className="flex-1 text-xs font-bold text-start truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {displayName}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    color: "var(--brand-primary)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  {operatorCode}
                </span>
              </button>

              {checkPerm(user, "settings.view") && (
                <button
                  onClick={() => goTab("settings")}
                  className={`p-2 rounded-lg transition shrink-0 ${
                    effectiveTab === "settings"
                      ? "ring-2 ring-blue-500 shadow-sm"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  }`}
                  style={{
                    backgroundColor:
                      effectiveTab === "settings"
                        ? "var(--bg-app)"
                        : "transparent",
                    color:
                      effectiveTab === "settings"
                        ? "var(--brand-primary)"
                        : "var(--text-muted)",
                  }}
                  title={lang === "ar" ? "الإعدادات" : "Settings"}
                  aria-label={lang === "ar" ? "الإعدادات" : "Settings"}
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <PWAInstallButton settings={settings} />
                <SyncBadge status={syncStatus} onRetry={loadData} />
                <AlertsPanel crew={crew} users={users} fleet={unifiedFleet} />
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 rounded-lg transition"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    color: "var(--text-muted)",
                  }}
                >
                  {darkMode ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </>
    );
  };

  const renderTopHeader = () => (
    <header
      className="sticky top-0 z-40 shadow-md transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-sidebar)",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      {/* Top Status Bar */}
      <div
        className="px-4 py-0 flex items-center justify-between gap-3 border-b text-xs transition-colors duration-300 flex-wrap"
        style={{
          backgroundColor: "var(--bg-app)",
          borderColor: "var(--border-default)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium text-[11px]">System Online</span>
          </div>

          <span style={{ color: "var(--border-default)" }}>|</span>

          <LiveClock />
        </div>

        {/* User Profile & Top Control Icons Group */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setViewingProfile(user)}
            className="flex items-center gap-1.5 flex-shrink-0 px-2 py-0.5 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700/60"
            title={lang === "ar" ? "عرض الملف الشخصي" : "View profile"}
          >
            <User
              className="w-3.5 h-3.5"
              style={{ color: "var(--brand-primary)" }}
            />
            <span className="font-bold text-xs" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
              style={{
                backgroundColor: "var(--bg-card)",
                color: "var(--brand-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              {operatorCode}
            </span>
          </button>

          {/* Settings Icon beside User Name */}
          {checkPerm(user, "settings.view") && (
            <button
              onClick={() => goTab("settings")}
              className={`p-1.5 rounded-lg transition flex items-center justify-center shrink-0 ${
                effectiveTab === "settings"
                  ? "ring-2 ring-blue-500 shadow-xs"
                  : "hover:bg-slate-100 dark:hover:bg-slate-700/60"
              }`}
              style={{
                backgroundColor:
                  effectiveTab === "settings"
                    ? "var(--bg-card)"
                    : "transparent",
                color:
                  effectiveTab === "settings"
                    ? "var(--brand-primary)"
                    : "var(--text-muted)",
              }}
              title={lang === "ar" ? "الإعدادات" : "Settings"}
              aria-label={lang === "ar" ? "الإعدادات" : "Settings"}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Notifications Icon beside Settings */}
          <AlertsPanel crew={crew} users={users} fleet={unifiedFleet} />

          {/* Dark / Light Mode Toggle beside Notifications */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg transition hover:bg-slate-100 dark:hover:bg-slate-700/60 shrink-0"
            style={{ color: "var(--text-muted)" }}
            title={lang === "ar" ? "تبديل المظهر" : "Toggle Theme"}
          >
            {darkMode ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>

          <span style={{ color: "var(--border-default)" }}>|</span>

          <button
            onClick={handleLogout}
            className="transition hover:opacity-80 flex-shrink-0 p-1"
            style={{ color: "var(--brand-primary)" }}
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sleek Compact Main Nav */}
      <div
        className="px-4 py-0 flex items-center gap-3 md:gap-5"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden p-1.5 rounded-lg"
          style={{
            backgroundColor: "var(--bg-app)",
            color: "var(--text-primary)",
          }}
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 py-0.5">
          {logoDisplayUrl ? (
            <img
              src={logoDisplayUrl}
              alt="logo"
              className="w-7 h-7 rounded object-contain bg-white"
            />
          ) : (
            <div
              className="w-7 h-7 rounded flex items-center justify-center"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Plane className="w-4 h-4 text-white" />
            </div>
          )}
          <span
            className="font-black text-base tracking-wider"
            style={{ color: "var(--text-primary)" }}
          >
            {operatorCode}
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-1 flex-1">
          {unifiedTopNavItems.map((item) => {
            if (item.kind === "tab" && item.tab) {
              const { id, icon: Icon, label_en, label_ar } = item.tab;
              const isActive = isNavTabActive(id);
              const label = lang === "ar" ? label_ar : label_en;

              return (
                <button
                  key={`nav_tab_${id}`}
                  onClick={() => goTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all border-b-2 ${
                    isActive
                      ? "border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-app)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)]/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              );
            }

            if (item.kind === "menu" && item.menu && item.tabs) {
              const cMenu = item.menu;
              const tabsInMenu = item.tabs;
              const isMenuOpen = openMenuId === cMenu.id;
              const hasActiveChild = tabsInMenu.some((t) => isNavTabActive(t.id));
              const MenuIcon = getMenuIcon(cMenu.icon);
              const menuLabel =
                lang === "ar"
                  ? cMenu.label_ar || cMenu.label_en
                  : cMenu.label_en || cMenu.label_ar;

              return (
                <div key={`nav_menu_${cMenu.id}`} className="relative" data-nav-dropdown>
                  <button
                    onClick={() => toggleMenu(cMenu.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition border-b-2 ${
                      hasActiveChild
                        ? "border-[var(--brand-primary)] text-[var(--brand-primary)] bg-[var(--bg-app)]"
                        : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-app)]/50"
                    }`}
                  >
                    <MenuIcon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{menuLabel}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        isMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isMenuOpen && (
                    <div
                      className="absolute top-full end-0 mt-1 w-56 rounded-lg shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto border"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                      }}
                    >
                      <div
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b"
                        style={{
                          color: "var(--text-muted)",
                          borderColor: "var(--border-default)",
                          backgroundColor: "var(--bg-app)",
                        }}
                      >
                        {menuLabel}
                      </div>
                      {tabsInMenu.map(({ id, icon: Icon, label_en, label_ar }) => {
                        const isItemActive = isNavTabActive(id);
                        return (
                          <button
                            key={id}
                            onClick={() => goTab(id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition text-start"
                            style={
                              isItemActive
                                ? {
                                    background: "var(--brand-gradient)",
                                    color: "white",
                                  }
                                : { color: "var(--text-muted)" }
                            }
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {lang === "ar" ? label_ar : label_en}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (item.kind === "more" && item.tabs) {
              const tabsInMore = item.tabs;
              return (
                <div key="nav_more_menu" className="relative" ref={moreRef} data-nav-dropdown>
                  <button
                    onClick={() => toggleMenu("more")}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {(() => {
                      const IconComp = getMenuIcon(moreMenuConfig.icon || "MoreHorizontal");
                      return <IconComp className="w-3.5 h-3.5" />;
                    })()}
                    <span className="hidden lg:inline">
                      {lang === "ar"
                        ? moreMenuConfig.label_ar || "المزيد"
                        : moreMenuConfig.label_en || "More"}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        moreOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {moreOpen && (
                    <div
                      className="absolute top-full end-0 mt-1 w-56 rounded-lg shadow-2xl overflow-hidden z-50 max-h-[70vh] overflow-y-auto border"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                      }}
                    >
                      {tabsInMore.map(({ id, icon: Icon, label_en, label_ar }) => {
                        const isMoreItemActive = isNavTabActive(id);
                        return (
                          <button
                            key={id}
                            onClick={() => goTab(id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition text-start"
                            style={
                              isMoreItemActive
                                ? {
                                    background: "var(--brand-gradient)",
                                    color: "white",
                                  }
                                : { color: "var(--text-muted)" }
                            }
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {lang === "ar" ? label_ar : label_en}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2 py-0.5">
          <PWAInstallButton settings={settings} />
          <SyncBadge status={syncStatus} onRetry={loadData} />
        </div>
      </div>
    </header>
  );

  return (
    <div
      className="min-h-screen theme-transition"
      style={{ backgroundColor: "var(--bg-app)", color: "var(--text-primary)" }}
      dir={t.dir}
    >
      <DialogHost />
      <OfflineIndicator />
      <SoundNotifications />

      {showChrome && !isSideNav && renderTopHeader()}
      {showChrome && isSideNav && renderSideNav()}

      <main
        className={`min-w-0 overflow-x-hidden ${
          showChrome && isSideNav ? "md:ms-64" : ""
        }`}
      >
        {renderMain()}
      </main>

      {/* Mobile Navigation Drawer */}
      {drawerOpen && !shouldShowCrewPortal && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="md:hidden fixed inset-y-0 start-0 z-50 w-[85%] max-w-sm flex flex-col shadow-2xl"
            style={{
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
            }}
          >
            <div
              className="p-4 flex items-center gap-3 border-b"
              style={{ borderColor: "var(--border-default)" }}
            >
              {logoDisplayUrl ? (
                <img
                  src={logoDisplayUrl}
                  alt="logo"
                  className="w-12 h-12 rounded-2xl object-contain bg-white p-1"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plane className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div
                  className="font-black text-xl font-mono tracking-widest"
                  style={{ color: "var(--text-primary)" }}
                >
                  {operatorCode}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    onClick={() => {
                      setDrawerOpen(false);
                      setViewingProfile(user);
                    }}
                    className="flex items-center gap-1 text-xs font-bold truncate transition hover:opacity-80"
                    style={{ color: "var(--text-muted)" }}
                    title={lang === "ar" ? "عرض الملف الشخصي" : "View profile"}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--brand-primary)" }} />
                    <span className="truncate">{displayName}</span>
                  </button>
                  {checkPerm(user, "settings.view") && (
                    <button
                      onClick={() => goTab("settings")}
                      className={`p-1 rounded-md transition shrink-0 ${
                        effectiveTab === "settings"
                          ? "ring-2 ring-blue-500 shadow-sm"
                          : ""
                      }`}
                      style={{
                        backgroundColor:
                          effectiveTab === "settings"
                            ? "var(--bg-app)"
                            : "transparent",
                        color:
                          effectiveTab === "settings"
                            ? "var(--brand-primary)"
                            : "var(--text-muted)",
                      }}
                      title={lang === "ar" ? "الإعدادات" : "Settings"}
                      aria-label={lang === "ar" ? "الإعدادات" : "Settings"}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "var(--bg-app)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {primaryTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
                const isActive = isNavTabActive(id);
                return (
                  <button
                    key={id}
                    onClick={() => goTab(id)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-start transition"
                    style={
                      isActive
                        ? {
                            background: "var(--brand-gradient)",
                            color: "white",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.2)"
                          : "var(--bg-app)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="flex-1 truncate">
                      {lang === "ar" ? label_ar : label_en}
                    </span>
                  </button>
                );
              })}

              {customMenus.map((cMenu) => {
                const menuTabs = customMenuTabsMap[cMenu.id] || [];
                if (menuTabs.length === 0) return null;
                const MenuIcon = getMenuIcon(cMenu.icon);
                return (
                  <React.Fragment key={cMenu.id}>
                    <div
                      className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <MenuIcon className="w-3.5 h-3.5" />
                      <span>
                        {lang === "ar"
                          ? cMenu.label_ar || cMenu.label_en
                          : cMenu.label_en || cMenu.label_ar}
                      </span>
                    </div>
                    {menuTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
                      const isActive = isNavTabActive(id);
                      return (
                        <button
                          key={id}
                          onClick={() => goTab(id)}
                          className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-start transition"
                          style={
                            isActive
                              ? {
                                  background: "var(--brand-gradient)",
                                  color: "white",
                                }
                              : { color: "var(--text-muted)" }
                          }
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                              backgroundColor: isActive
                                ? "rgba(255,255,255,0.2)"
                                : "var(--bg-app)",
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate">
                            {lang === "ar" ? label_ar : label_en}
                          </span>
                        </button>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {moreTabs.length > 0 && (
                <div
                  className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {lang === "ar" ? "المزيد" : "More"}
                </div>
              )}

              {moreTabs.map(({ id, icon: Icon, label_en, label_ar }) => {
                const isActive = isNavTabActive(id);
                return (
                  <button
                    key={id}
                    onClick={() => goTab(id)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-start transition"
                    style={
                      isActive
                        ? {
                            background: "var(--brand-gradient)",
                            color: "white",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: isActive
                          ? "rgba(255,255,255,0.2)"
                          : "var(--bg-app)",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="flex-1 truncate">
                      {lang === "ar" ? label_ar : label_en}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div
              className="p-3 border-t space-y-2"
              style={{ borderColor: "var(--border-default)" }}
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLang("ar")}
                  className="px-3 py-3 rounded-xl font-bold text-sm transition"
                  style={
                    lang === "ar"
                      ? { background: "var(--brand-gradient)", color: "white" }
                      : {
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-muted)",
                        }
                  }
                >
                  العربية
                </button>
                <button
                  onClick={() => setLang("en")}
                  className="px-3 py-3 rounded-xl font-bold text-sm transition"
                  style={
                    lang === "en"
                      ? { background: "var(--brand-gradient)", color: "white" }
                      : {
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-muted)",
                        }
                  }
                >
                  English
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 font-bold"
              >
                <LogOut className="w-5 h-5" /> {t.logout}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Modals */}
      {genDec && (
        <GenDecModal
          flight={genDec}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setGenDec(null)}
        />
      )}

      {viewingProfile && (
        <UserProfileModal
          user={viewingProfile}
          crew={crew}
          settings={settings}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const [lang, setLang] = useLocalStorage("aeroops.lang", "en");
  const Provider = LangProvider as React.ComponentType<any>;
  return (
    <Provider lang={lang}>
      <AppInner lang={lang} setLang={setLang} />
    </Provider>
  );
}
