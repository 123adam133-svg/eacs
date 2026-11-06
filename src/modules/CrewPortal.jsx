/* ═══════════════════════════════════════════════════════════
 * CREW PORTAL — Unified Theme + Per-Icon RBAC + Catering + Completed Flights
 * v5.0 — Unified Global/Portal Theme (Light & Dark), Granular Icon Permissions,
 *        Full Catering Module, Full Completed Flights + 24H Journey Log
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Menu,
  Calendar,
  Award,
  Clock,
  BookOpen,
  FileText,
  ShieldAlert,
  Download,
  LogOut,
  User,
  Home,
  TrendingUp,
  Activity,
  Plane,
  Timer,
  Target,
  Eye,
  AlertTriangle,
  Bell,
  CheckCheck,
  Cloud,
  UtensilsCrossed,
  CheckCircle2,
  Edit,
  Stamp,
  FileX,
  Search,
  Sun,
  Moon,
  Languages,
  Lock,
  Key,
  KeyRound,
  EyeOff,
  Check,
  Sparkles,
  ShieldCheck,
  XCircle,
  Wrench,
  RefreshCw,
} from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdfSafe } from "../utils/pdf";
import { useT, useAuth } from "../contexts";
import { useFirebase } from "../contexts/FirebaseProvider";
import { setGlobalRoles, can as checkPerm } from "../config/permissions";
import {
  camoAPI,
  melAPI,
  fleetAPI,
  flightsAPI,
  notificationsAPI,
  usersAPI,
  readSheetCache,
  hasPendingSheetMutations,
  toPreviewFileUrl,
  toDisplayImageUrl,
} from "../api";
import { logSafe } from "../utils/audit";
import { buildUnifiedFleetAndCamo, normalizeReg } from "../utils/fleetCamoSync";
import { getAssignedAircrafts } from "./Crew";
import { FTLModule } from "./FTLModule";
import { ManualsModule } from "./ManualsModule";
import { CalendarView } from "./CalendarView";
import { CateringModule } from "./CateringModule";
import { CompleteFlightModal } from "../components/CompleteFlightModal";
import { ThreeDIcon } from "../components/ui/ThreeDIcon";
import { computeAutoStatus } from "./ScheduleBoard";
import {
  docStatus,
  daysUntil,
  getStatusColor,
  fmtTime,
  fmtDuty,
  safeArray,
} from "../utils/helpers";
import { getGlobalTheme, DEFAULT_GLOBAL_THEME } from "../config/constants";
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../utils/notificationService";
import { alertNotification } from "../utils/sounds";
import {
  requestBrowserNotificationPermission,
  triggerLockscreenNotification,
} from "../utils/notifications";

/* ⭐ خريطة اختصارات الوظائف */
const POS_SHORT_MAP = {
  captain: "CPT",
  firstOfficer: "FO",
  observer: "OBS",
  tri: "TRI",
  fa1: "FA1",
  fa2: "FA2",
  flightAttendant: "FA",
  engineer: "ENG1",
  security: "SEC",
  loadmaster: "LMC",
  flightDispatcher: "FD",
};

const POS_ORDER = [
  "CPT",
  "FO",
  "OBS",
  "TRI",
  "FA1",
  "FA2",
  "FA",
  "ENG1",
  "SEC",
  "LMC",
  "FD",
];

function logoToDisplayUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  const match = url.match(/[?&]id=([^&]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  const pathMatch = url.match(/\/d\/([^/]+)/);
  if (pathMatch) return `https://lh3.googleusercontent.com/d/${pathMatch[1]}`;
  return url;
}

function getDocs(c) {
  let att = c?.attachments;
  if (!att) return [];
  if (Array.isArray(att)) return att;
  if (typeof att === "string") {
    const trimmed = att.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      try {
        const fixed = trimmed.replace(/,\s*$/, "") + "]";
        const parsed = JSON.parse(fixed);
        if (Array.isArray(parsed)) return parsed;
      } catch (e2) {}
    }
  }
  return [];
}

function normalizeDoc(doc, idx) {
  if (!doc) return null;
  if (typeof doc === "string") {
    return {
      name: doc.split("/").pop() || `File ${idx + 1}`,
      url: doc,
      type: "",
      size: 0,
      expiry: "",
    };
  }
  const url = doc.url || doc.fileUrl || doc.path || doc.data || doc.href || "";
  if (!url) return null;
  return {
    name: doc.name || doc.fileName || doc.title || `Document ${idx + 1}`,
    url,
    type: doc.type || doc.mimeType || doc.mime || "",
    size: doc.size || 0,
    expiry: doc.expiry || "",
  };
}

const fmtHM = (iso) => fmtTime(iso, "UTC");

const fmtShortDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
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
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
};

const fmtReportDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}-${String(
    d.getUTCMonth() + 1
  ).padStart(2, "0")}-${d.getUTCFullYear()}`;
};

const calcDuration = (std, sta) => {
  if (!std || !sta) return "—";
  const t1 = new Date(std).getTime();
  const t2 = new Date(sta).getTime();
  if (isNaN(t1) || isNaN(t2) || t2 <= t1) return "—";
  const mins = Math.round((t2 - t1) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const getStatusColorHex = (status) => {
  const s = (status || "").toUpperCase();
  if (s === "CANCELLED") return "#ef4444";
  if (s === "ARRIVED") return "#22c55e";
  if (s === "DEPARTED" || s === "IN_FLIGHT") return "#3b82f6";
  if (s === "DELAYED") return "#f59e0b";
  return null;
};

const isFlightCompleted = (f) => {
  const a = f?.actual || {};
  return Boolean(a.std && a.sta && !a.cancelled && f?.status !== "CANCELLED");
};

export function CrewPortal({
  crew = [],
  flights = [],
  setFlights,
  reloadFlights,
  fleet = [],
  rawFleet,
  camoList: propCamoList,
  melList: propMelList,
  roles = [],
  settings = {},
  previewCrewPortal = false,
  currentUser,
  users = [],
  setUsers,
  setSyncStatus,
  darkMode = false,
  setDarkMode,
  lang = "en",
  setLang,
}) {
  const t = useT();
  const { user, setUser, logout } = useAuth();
  const targetUser = currentUser || user;
  const isAr = lang === "ar";

  useEffect(() => {
    if (Array.isArray(roles) && roles.length > 0) {
      setGlobalRoles(roles);
    }
  }, [roles]);

  const [activeView, setActiveView] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* Calendar state */
  const [selectedDateForCalendar, setSelectedDateForCalendar] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedFlight, setSelectedFlight] = useState(null);

  const { firebaseUser, authReady, signInWithGoogle } = useFirebase();

  /* Notification state */
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [syncingNotifs, setSyncingNotifs] = useState(false);
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const seenUnreadIdsRef = React.useRef(new Set());
  const initialNotifToastShownRef = React.useRef(false);

  const handleEnableLockscreenNotifs = async () => {
    const res = await requestBrowserNotificationPermission();
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPerm(Notification.permission);
    }
    if (res === "granted") {
      showToast(
        isAr
          ? "✅ تم تفعيل إشعارات الشاشة المقفلة بنجاح!"
          : "✅ Lock screen notifications enabled!",
        "success"
      );
    } else if (res === "denied") {
      showToast(
        isAr
          ? "⚠️ إذن الإشعارات محظور. يرجى السماح به من إعدادات المتصفح/الهاتف"
          : "⚠️ Notification permission denied in browser settings",
        "warning"
      );
    }
  };

  const handleTestLockscreenNotif = async () => {
    const res = await triggerLockscreenNotification({
      title: isAr ? "📲 تجربة إشعار الشاشة المقفلة" : "📲 Lock Screen Test Alert",
      body: isAr
        ? "الإشعارات تعمل بنجاح! ستصلك الرحلات والتحديثات مباشرة على الهاتف حتى أثناء قفل الشاشة."
        : "Notifications working! Updates will appear directly on your phone lock screen.",
      category: "test",
    });

    if (res?.success) {
      showToast(
        isAr ? "🔔 تم إرسال إشعار التجربة لهاتفك بنجاح!" : "🔔 Test notification dispatched!",
        "success"
      );
    } else if (res?.reason === "unsupported") {
      showToast(
        isAr
          ? "⚠️ متصفحك الحالي لا يدعم إشعارات النظام مباشرة."
          : "⚠️ Notifications not supported on this browser.",
        "warning"
      );
    } else if (res?.reason === "permission_not_granted") {
      showToast(
        isAr
          ? "⚠️ إذن الإشعارات لم يتم منحه بعد. انقر على تفعيل الإشعارات أولاً."
          : "⚠️ Notification permission is not granted yet.",
        "warning"
      );
    } else {
      showToast(
        isAr
          ? "⚠️ تعذر إرسال الإشعار. تأكد من تفعيل إشعارات التطبيق في إعدادات الهاتف."
          : "⚠️ Could not display notification. Check phone settings.",
        "warning"
      );
    }
  };

  /* File preview */
  const [previewDoc, setPreviewDoc] = useState(null);

  /* My Aircraft Status state */
  const [camoData, setCamoData] = useState(() => safeArray(propCamoList));
  const [melData, setMelData] = useState(() => safeArray(propMelList));
  const [fleetLocal, setFleetLocal] = useState([]);
  const [camoLoading, setCamoLoading] = useState(false);

  /* Completed Flights state */
  const [completedFromDate, setCompletedFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [completedToDate, setCompletedToDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [completedAcft, setCompletedAcft] = useState("");
  const [completedSearch, setCompletedSearch] = useState("");
  const [completedTz, setCompletedTz] = useState("UTC");
  const [completedScope, setCompletedScope] = useState("mine");
  const [editingCompletedFlight, setEditingCompletedFlight] = useState(null);
  const [quickCompleteFlightId, setQuickCompleteFlightId] = useState("");
  const [busyCompletedPdf, setBusyCompletedPdf] = useState(false);

  /* ═══ Personal Password Change (Current Member Only) ═══ */
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const resolveOwnUserFromList = (list, refUser) => {
    if (!refUser || !Array.isArray(list) || list.length === 0) return null;
    if (refUser.id) {
      const byId = list.find((u) => String(u.id) === String(refUser.id));
      if (byId) return byId;
    }
    const uName = String(refUser.username || "").trim().toLowerCase();
    if (uName) {
      const byUsername = list.find(
        (u) => String(u.username || "").trim().toLowerCase() === uName
      );
      if (byUsername) return byUsername;
    }
    const uEmail = String(refUser.email || "").trim().toLowerCase();
    if (uEmail) {
      const byEmail = list.find(
        (u) => String(u.email || "").trim().toLowerCase() === uEmail
      );
      if (byEmail) return byEmail;
    }
    return null;
  };

  const myOwnUserObj = useMemo(() => {
    if (!targetUser) return null;
    const list =
      Array.isArray(users) && users.length > 0
        ? users
        : readSheetCache("Users", []);
    const matched = resolveOwnUserFromList(list, targetUser);
    if (matched) return matched;
    return targetUser.id ? targetUser : null;
  }, [users, targetUser]);

  const hasExistingPassword = Boolean(
    String(myOwnUserObj?.password ?? "").trim()
  );

  const openMyPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordText(false);
    setPwdError("");
    setPasswordModalOpen(true);
  };

  const handleSavePassword = async (e) => {
    e?.preventDefault();
    if (pwdSaving) return;
    setPwdError("");

    if (!targetUser) {
      setPwdError(
        isAr
          ? "يجب تسجيل الدخول لتغيير كلمة المرور"
          : "You must be signed in to change your password"
      );
      return;
    }

    const cleanPwd = String(newPassword || "").trim();
    if (!cleanPwd || cleanPwd.length < 4) {
      setPwdError(
        isAr
          ? "يجب أن تتكون كلمة المرور الجديدة من 4 أحرف أو أرقام على الأقل"
          : "New password must be at least 4 characters"
      );
      return;
    }
    if (cleanPwd !== String(confirmPassword || "").trim()) {
      setPwdError(
        isAr
          ? "كلمة المرور الجديدة وتأكيدها غير متطابقين"
          : "New password and confirmation do not match"
      );
      return;
    }

    setPwdSaving(true);
    setSyncStatus?.("syncing");
    try {
      const localList =
        Array.isArray(users) && users.length > 0
          ? users
          : readSheetCache("Users", []);
      let resolvedUser = resolveOwnUserFromList(localList, targetUser);

      if (!resolvedUser) {
        const freshList = await usersAPI.list().catch(() => []);
        resolvedUser = resolveOwnUserFromList(freshList, targetUser);
      }

      if (!resolvedUser || !resolvedUser.id) {
        setPwdError(
          isAr
            ? "تعذر العثور على حسابك في سجل المستخدمين"
            : "Could not locate your account record"
        );
        setSyncStatus?.("synced");
        return;
      }

      const storedPass = String(resolvedUser.password ?? "");
      if (storedPass.trim().length > 0) {
        const curInput = String(currentPassword ?? "");
        if (curInput !== storedPass && curInput.trim() !== storedPass.trim()) {
          setPwdError(
            isAr
              ? "كلمة المرور الحالية غير صحيحة"
              : "Current password is incorrect"
          );
          setSyncStatus?.("synced");
          return;
        }
      }

      const updatedUser = {
        ...resolvedUser,
        password: cleanPwd,
      };
      await usersAPI.update(resolvedUser.id, updatedUser);

      if (typeof setUsers === "function") {
        setUsers((prev) =>
          (prev || []).map((u) =>
            String(u.id) === String(resolvedUser.id)
              ? { ...u, password: cleanPwd }
              : u
          )
        );
      }

      if (
        typeof setUser === "function" &&
        user &&
        (String(user.id) === String(resolvedUser.id) ||
          (user.username &&
            resolvedUser.username &&
            String(user.username).trim().toLowerCase() ===
              String(resolvedUser.username).trim().toLowerCase()))
      ) {
        setUser({ ...user, password: cleanPwd });
      }

      logSafe(
        targetUser,
        "UPDATE_PASSWORD",
        "Users",
        resolvedUser.id,
        `Self-service password updated: ${
          resolvedUser.username || resolvedUser.fullName
        }`,
        {}
      );

      setSyncStatus?.("synced");
      showToast(
        isAr
          ? "تم تحديث كلمة المرور الخاصة بك بنجاح"
          : "Your password has been updated successfully",
        "success"
      );
      setPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordText(false);
    } catch (err) {
      setPwdError(
        err?.message ||
          (isAr ? "فشل تحديث كلمة المرور" : "Failed to update password")
      );
      setSyncStatus?.("error");
    } finally {
      setPwdSaving(false);
    }
  };

  /* ═══ Unified Theme (System & Crew Portal) ═══ */
  const unifiedThemeId =
    settings?.globalTheme || settings?.portalTheme || DEFAULT_GLOBAL_THEME;
  const themeData = getGlobalTheme(unifiedThemeId);
  const activeVars =
    darkMode && Object.keys(themeData.darkVars || {}).length > 0
      ? { ...themeData.vars, ...themeData.darkVars }
      : themeData.vars;
  const isDarkSurface = Boolean(darkMode || unifiedThemeId === "navyGold");

  const THEME = {
    bg: activeVars["--bg-app"],
    header: activeVars["--bg-header"],
    card: activeVars["--bg-card"],
    surfaceSubtle: isDarkSurface
      ? "rgba(255, 255, 255, 0.06)"
      : "rgba(15, 23, 42, 0.04)",
    hoverBg: isDarkSurface
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(15, 23, 42, 0.06)",
    border: activeVars["--brand-primary"],
    borderLight: activeVars["--border-default"],
    text: activeVars["--text-primary"],
    textMuted: activeVars["--text-muted"],
    accent: activeVars["--brand-primary"],
    accentHover: activeVars["--brand-primary-hover"],
    danger: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
    info: activeVars["--brand-accent"],
    gradient: activeVars["--brand-gradient"],
  };

  /* My Hours filter */
  const [hoursFromDate, setHoursFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [hoursToDate, setHoursToDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (!selectedFlight) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedFlight(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedFlight]);

  useEffect(() => {
    if (!previewDoc) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPreviewDoc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewDoc]);

  useEffect(() => {
    if (!passwordModalOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !pwdSaving) setPasswordModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [passwordModalOpen, pwdSaving]);

  /* ═══ Resolve User & Crew Record ═══ */
  const foundCrew = useMemo(() => {
    if (!Array.isArray(crew) || crew.length === 0) return null;
    if (targetUser?.crewId) {
      const byId = crew.find((c) => String(c.id) === String(targetUser.crewId));
      if (byId) return byId;
    }
    const uEmail = String(targetUser?.email || "").trim().toLowerCase();
    if (uEmail) {
      const byEmail = crew.find(
        (c) => String(c.email || "").trim().toLowerCase() === uEmail
      );
      if (byEmail) return byEmail;
    }
    const uName = String(targetUser?.username || "").trim().toLowerCase();
    if (uName) {
      const byEmp = crew.find(
        (c) => String(c.empNo || "").trim().toLowerCase() === uName
      );
      if (byEmp) return byEmp;
    }
    const fName = String(targetUser?.fullName || "").trim().toLowerCase();
    if (fName) {
      const byFull = crew.find(
        (c) => String(c.fullName || "").trim().toLowerCase() === fName
      );
      if (byFull) return byFull;
    }
    return null;
  }, [crew, targetUser]);

  const myCrewData = previewCrewPortal
    ? crew[0] || { fullName: "Preview Mode" }
    : foundCrew || {
        fullName: targetUser?.fullName || "User",
        role: targetUser?.role || "Crew Member",
      };

  /* ═══ Per-Icon Crew Portal Permissions ═══ */
  const portalPerms = useMemo(() => {
    void roles;
    return {
      canSeeSchedule:
        previewCrewPortal || checkPerm(targetUser, "portal.schedule"),
      canSeeCompletedFlights:
        previewCrewPortal || checkPerm(targetUser, "portal.completed_flights"),
      canSeeCatering:
        previewCrewPortal || checkPerm(targetUser, "portal.catering"),
      canSeeAircraft:
        previewCrewPortal || checkPerm(targetUser, "portal.aircraft_status"),
      canSeeCerts:
        previewCrewPortal || checkPerm(targetUser, "portal.certificates"),
      canSeeFTL: previewCrewPortal || checkPerm(targetUser, "portal.ftl"),
      canSeeManuals:
        previewCrewPortal || checkPerm(targetUser, "portal.manuals"),
      canSeeHours: previewCrewPortal || checkPerm(targetUser, "portal.hours"),
      canViewAllCompleted:
        previewCrewPortal ||
        checkPerm(targetUser, "reports.view_all") ||
        checkPerm(targetUser, "schedule.edit"),
      canEditCompleted:
        previewCrewPortal ||
        checkPerm(targetUser, "schedule.edit") ||
        checkPerm(targetUser, "portal.completed_flights_edit"),
      canExportCompletedStamp:
        previewCrewPortal || checkPerm(targetUser, "portal.print_with_stamp"),
      canExportCompletedNoStamp:
        previewCrewPortal || checkPerm(targetUser, "portal.print_without_stamp"),
      canExportCompletedPdf:
        previewCrewPortal ||
        checkPerm(targetUser, "portal.print_with_stamp") ||
        checkPerm(targetUser, "portal.print_without_stamp"),
      canCateringCreate:
        previewCrewPortal || checkPerm(targetUser, "catering.create"),
      canCateringEdit:
        previewCrewPortal || checkPerm(targetUser, "catering.edit"),
      canCateringDelete:
        previewCrewPortal || checkPerm(targetUser, "catering.delete"),
    };
  }, [previewCrewPortal, targetUser, roles]);

  const {
    canSeeSchedule,
    canSeeCompletedFlights,
    canSeeCatering,
    canSeeAircraft,
    canSeeCerts,
    canSeeFTL,
    canSeeManuals,
    canSeeHours,
    canViewAllCompleted,
    canEditCompleted,
    canExportCompletedPdf,
    canExportCompletedStamp,
    canExportCompletedNoStamp,
    canCateringCreate,
    canCateringEdit,
    canCateringDelete,
  } = portalPerms;

  useEffect(() => {
    if (!canViewAllCompleted) {
      setCompletedScope("mine");
    } else if (!myCrewData?.id) {
      setCompletedScope("all");
    }
  }, [canViewAllCompleted, myCrewData?.id]);

  /* Reset activeView if permission for that icon is turned off */
  useEffect(() => {
    if (!activeView) return;
    const permByView = {
      schedule: canSeeSchedule,
      "completed-flights": canSeeCompletedFlights,
      catering: canSeeCatering,
      "aircraft-status": canSeeAircraft,
      certificates: canSeeCerts,
      ftl: canSeeFTL,
      manuals: canSeeManuals,
      hours: canSeeHours,
    };
    if (permByView[activeView] === false) {
      setActiveView(null);
    }
  }, [
    activeView,
    canSeeSchedule,
    canSeeCompletedFlights,
    canSeeCatering,
    canSeeAircraft,
    canSeeCerts,
    canSeeFTL,
    canSeeManuals,
    canSeeHours,
  ]);

  const hasCrewLink = !!(foundCrew?.id || targetUser?.crewId || user?.crewId);

  const canSeeFiles =
    previewCrewPortal ||
    hasCrewLink ||
    checkPerm(targetUser, "crew.docs") ||
    checkPerm(targetUser, "crew.docs_download");

  const canDownloadDocs =
    previewCrewPortal ||
    hasCrewLink ||
    checkPerm(targetUser, "crew.docs_download");

  const myFlights = useMemo(
    () =>
      (flights || []).filter((f) =>
        safeArray(f.crewSlots).some(
          (slot) =>
            myCrewData?.id && String(slot.crewId) === String(myCrewData.id)
        )
      ),
    [flights, myCrewData?.id]
  );

  const activeCrewId = myCrewData?.id || targetUser?.crewId || user?.crewId || "";
  const activeCrewEmail =
    myCrewData?.email || targetUser?.email || user?.email || "";
  const activeCrewUsername = targetUser?.username || user?.username || "";

  useEffect(() => {
    if (!activeCrewId && !activeCrewEmail && !activeCrewUsername) return;
    const unsubscribe = subscribeToNotifications(
      activeCrewId,
      (items) => {
        const unread = items.filter((n) => !n.read);
        const newlyArrived = unread.filter(
          (n) => !seenUnreadIdsRef.current.has(String(n.id))
        );

        unread.forEach((n) => seenUnreadIdsRef.current.add(String(n.id)));

        if (newlyArrived.length > 0) {
          alertNotification();
          const newest = newlyArrived[0];
          if (!initialNotifToastShownRef.current || newlyArrived.length >= 1) {
            initialNotifToastShownRef.current = true;
            showToast(`🔔 ${newest.message}`, "info");
          }
          // Push to mobile OS lock screen
          triggerLockscreenNotification({
            title: newest.flightNo ? `تحديث الرحلة ${newest.flightNo}` : "AeroOps Crew Portal",
            body: newest.message,
            category: "flight",
          });
          if (typeof reloadFlights === "function" && !hasPendingSheetMutations()) {
            reloadFlights().catch(() => {});
          }
        }
        setNotifications(items);
      },
      { email: activeCrewEmail, username: activeCrewUsername }
    );
    return () => unsubscribe();
  }, [
    activeCrewId,
    activeCrewEmail,
    activeCrewUsername,
    authReady,
    firebaseUser?.uid,
  ]);

  /* Background flight schedule sync for Crew Portal */
  useEffect(() => {
    if (typeof reloadFlights !== "function") return;
    const syncFlights = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      if (hasPendingSheetMutations()) return;
      reloadFlights().catch(() => {});
    };
    const timer = setInterval(syncFlights, 20000);
    window.addEventListener("focus", syncFlights);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", syncFlights);
    };
  }, [reloadFlights]);

  const refreshPortalNotifications = async () => {
    setSyncingNotifs(true);
    try {
      await Promise.allSettled([
        notificationsAPI.list(),
        typeof reloadFlights === "function" ? reloadFlights() : Promise.resolve(),
      ]);
      window.dispatchEvent(new CustomEvent("aeroops:notifications"));
    } finally {
      setSyncingNotifs(false);
    }
  };

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const latestUnreadNotification = useMemo(
    () => notifications.find((n) => !n.read) || null,
    [notifications]
  );

  /* ═══ My Aircraft Status — Sync & Load Fleet + CAMO + MEL ═══ */
  useEffect(() => {
    if (Array.isArray(propCamoList) && propCamoList.length > 0) {
      setCamoData(propCamoList);
    }
  }, [propCamoList]);

  useEffect(() => {
    if (Array.isArray(propMelList)) {
      setMelData(propMelList);
    }
  }, [propMelList]);

  const refreshAircraftStatus = async () => {
    if (!canSeeAircraft) return;
    setCamoLoading(true);
    try {
      const [camoRes, melRes, fleetRes] = await Promise.all([
        camoAPI.list().catch(() => null),
        melAPI.list().catch(() => null),
        fleetAPI.list().catch(() => null),
      ]);
      if (Array.isArray(camoRes)) setCamoData(camoRes);
      if (Array.isArray(melRes)) setMelData(melRes);
      if (Array.isArray(fleetRes)) setFleetLocal(fleetRes);
    } catch (e) {
      console.warn("CAMO/MEL/Fleet load failed:", e);
    } finally {
      setCamoLoading(false);
    }
  };

  useEffect(() => {
    if (!canSeeAircraft) return;
    const hasInitialData =
      (Array.isArray(propCamoList) && propCamoList.length > 0) ||
      (Array.isArray(fleet) && fleet.length > 0);
    if (!hasInitialData || propMelList === undefined) {
      refreshAircraftStatus();
    }
  }, [canSeeAircraft]);

  const rawAssignedAircrafts = useMemo(
    () => getAssignedAircrafts(myCrewData),
    [myCrewData]
  );

  const assignedAircraftRegs = useMemo(
    () =>
      Array.from(
        new Set(
          rawAssignedAircrafts.map((r) => normalizeReg(r)).filter(Boolean)
        )
      ),
    [rawAssignedAircrafts]
  );

  const myAircraftStatus = useMemo(() => {
    if (assignedAircraftRegs.length === 0) return [];

    const sourceFleet =
      fleetLocal.length > 0 ? fleetLocal : safeArray(rawFleet || fleet);
    const sourceCamo =
      camoData.length > 0 ? camoData : safeArray(propCamoList);
    const sourceMel =
      melData.length > 0 || propMelList === undefined
        ? melData
        : safeArray(propMelList);

    const { unifiedFleet, unifiedCamo } = buildUnifiedFleetAndCamo(
      sourceFleet,
      sourceCamo
    );

    const fleetMap = new Map();
    unifiedFleet.forEach((f) => {
      const k = normalizeReg(f.reg);
      if (k) fleetMap.set(k, f);
    });

    const camoMap = new Map();
    unifiedCamo.forEach((c) => {
      const k = normalizeReg(c.reg);
      if (k) camoMap.set(k, c);
    });

    const nonWorkingSet = new Set([
      "GROUNDED",
      "AOG",
      "MAINTENANCE",
      "STORED",
      "OUT_OF_SERVICE",
      "UNSERVICEABLE",
    ]);

    return assignedAircraftRegs.map((regKey) => {
      const rawLabel =
        rawAssignedAircrafts.find((r) => normalizeReg(r) === regKey) || regKey;
      const c = camoMap.get(regKey) || null;
      const fItem = fleetMap.get(regKey) || null;

      const displayReg = c?.reg || fItem?.reg || rawLabel;
      const displayType = c?.type || fItem?.type || "";

      const rawStatus = String(
        fItem?.status && fItem.status !== "AIRWORTHY"
          ? fItem.status
          : c?.status || fItem?.status || "AIRWORTHY"
      )
        .trim()
        .toUpperCase();

      const mels = sourceMel
        .filter((m) => {
          if (normalizeReg(m?.reg) !== regKey) return false;
          const mst = String(m?.status || "OPEN")
            .trim()
            .toUpperCase();
          return mst === "OPEN" || mst === "DEFERRED";
        })
        .map((m) => ({
          ...m,
          dueDays: m?.dueDate ? daysUntil(m.dueDate) : null,
        }));

      const overdueMels = mels.filter(
        (m) => m.dueDays !== null && m.dueDays < 0
      );
      const days = c?.nextCheckDate ? daysUntil(c.nextCheckDate) : null;

      const isWorking =
        !nonWorkingSet.has(rawStatus) &&
        !(days !== null && days < 0) &&
        overdueMels.length === 0;

      const hasMel = mels.length > 0;

      let workingDetailAr = "نشطة وجاهزة للخدمة";
      let workingDetailEn = "Active & Serviceable";

      if (!isWorking) {
        if (rawStatus === "AOG") {
          workingDetailAr = "متوقفة لعطل فني (AOG)";
          workingDetailEn = "Aircraft On Ground (AOG)";
        } else if (rawStatus === "MAINTENANCE") {
          workingDetailAr = "تحت الصيانة حالياً";
          workingDetailEn = "Currently in Maintenance";
        } else if (rawStatus === "STORED") {
          workingDetailAr = "مخزنة خارج الخدمة";
          workingDetailEn = "Stored / Parked";
        } else if (rawStatus === "GROUNDED") {
          workingDetailAr = "متوقفة عن الطيران (Grounded)";
          workingDetailEn = "Grounded";
        } else if (overdueMels.length > 0) {
          workingDetailAr = "تجاوز مهلة إصلاح بند MEL";
          workingDetailEn = "MEL rectification overdue";
        } else {
          workingDetailAr = "غير جاهزة للخدمة حالياً";
          workingDetailEn = "Unserviceable · Out of Service";
        }
      }

      return {
        id: c?.id || fItem?.id || regKey,
        reg: displayReg,
        type: displayType,
        rawStatus,
        mels,
        overdueMels,
        hasMel,
        isWorking,
        workingDetailAr,
        workingDetailEn,
      };
    });
  }, [
    assignedAircraftRegs,
    rawAssignedAircrafts,
    fleetLocal,
    rawFleet,
    fleet,
    camoData,
    propCamoList,
    melData,
    propMelList,
  ]);

  const notOperationalCount = myAircraftStatus.filter(
    (a) => !a.isWorking
  ).length;
  const melAircraftCount = myAircraftStatus.filter((a) => a.hasMel).length;

  /* ═══ Completed Flights Computation ═══ */
  const activeTimeFormat =
    settings?.timeFormat ||
    (typeof window !== "undefined" && window.__AEROOPS_TIME_FORMAT) ||
    "24";

  const fmtCompletedTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const h = completedTz === "UTC" ? d.getUTCHours() : d.getHours();
    const m = completedTz === "UTC" ? d.getUTCMinutes() : d.getMinutes();
    if (activeTimeFormat === "12") {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const effectiveCompletedScope =
    canViewAllCompleted && completedScope === "all" ? "all" : "mine";

  const scopedSourceFlights = useMemo(() => {
    if (effectiveCompletedScope === "all") return flights || [];
    return myFlights;
  }, [effectiveCompletedScope, flights, myFlights]);

  const portalCompletedBadgeCount = useMemo(() => {
    const base = canViewAllCompleted && !myCrewData?.id ? flights || [] : myFlights;
    return base.filter(isFlightCompleted).length;
  }, [canViewAllCompleted, myCrewData?.id, flights, myFlights]);

  const completedFlightsFiltered = useMemo(() => {
    const fromTs = completedFromDate
      ? new Date(completedFromDate + "T00:00:00Z").getTime()
      : null;
    const toTs = completedToDate
      ? new Date(completedToDate + "T23:59:59Z").getTime()
      : null;

    return scopedSourceFlights
      .filter((f) => {
        if (!isFlightCompleted(f)) return false;
        if (completedAcft && f.acft !== completedAcft) return false;
        const ts = new Date(f.actual?.std || f.std).getTime();
        if (isNaN(ts)) return false;
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.actual?.std || b.std).getTime() -
          new Date(a.actual?.std || a.std).getTime()
      );
  }, [
    scopedSourceFlights,
    completedAcft,
    completedFromDate,
    completedToDate,
  ]);

  const completedFlightsRows = useMemo(() => {
    const q = completedSearch.trim().toLowerCase();
    return completedFlightsFiltered
      .map((f) => {
        const a = f.actual || {};
        const baseStd = a.std || f.std;
        const baseSta = a.sta || f.sta;
        let blockMin = 0;
        if (baseStd && baseSta) {
          const t1 = new Date(baseStd).getTime();
          const t2 = new Date(baseSta).getTime();
          if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
            blockMin = Math.round((t2 - t1) / 60000);
          }
        }
        let flightMin = 0;
        if (a.takeoff && a.landing) {
          const t1 = new Date(a.takeoff).getTime();
          const t2 = new Date(a.landing).getTime();
          if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
            flightMin = Math.round((t2 - t1) / 60000);
          }
        }
        const acftType = (fleet || []).find((x) => x.reg === f.acft)?.type || "—";
        const slots = (f.crewSlots || []).map((s) => ({
          ...s,
          member: crew.find((c) => c.id === s.crewId),
        }));
        const com =
          a.pic ||
          slots.find((s) => s.position === "captain")?.member?.fullName ||
          "—";
        const sic =
          a.sic ||
          slots.find((s) => s.position === "firstOfficer")?.member?.fullName ||
          "—";
        const mySlot = slots.find((s) => s.crewId === myCrewData?.id);
        const myPos = mySlot
          ? POS_SHORT_MAP[mySlot.position] || mySlot.position?.toUpperCase()
          : "—";

        return {
          id: f.id,
          date: fmtReportDate(baseStd),
          acftType,
          reg: f.acft || "—",
          flightNo: f.flightNo || "—",
          adep: f.dep || "—",
          ades: f.arr || "—",
          blockOff: fmtCompletedTime(baseStd),
          t_o: a.takeoff ? fmtCompletedTime(a.takeoff) : "—",
          lnd: a.landing ? fmtCompletedTime(a.landing) : "—",
          blockOn: fmtCompletedTime(baseSta),
          blockMin,
          block: blockMin > 0 ? fmtDuty(blockMin) : "—",
          flightMin,
          flight: flightMin > 0 ? fmtDuty(flightMin) : "—",
          myPos,
          com,
          sic,
        };
      })
      .filter((r) => {
        if (!q) return true;
        return (
          `${r.flightNo} ${r.reg} ${r.acftType} ${r.adep} ${r.ades} ${r.com} ${r.sic}`
            .toLowerCase()
            .includes(q)
        );
      });
  }, [
    completedFlightsFiltered,
    fleet,
    crew,
    myCrewData?.id,
    completedTz,
    activeTimeFormat,
    completedSearch,
  ]);

  const completedSummary = useMemo(() => {
    const totals = {
      count: 0,
      blockMin: 0,
      flightMin: 0,
      byType: {},
    };
    completedFlightsRows.forEach((r) => {
      totals.count += 1;
      totals.blockMin += r.blockMin;
      totals.flightMin += r.flightMin;
      if (!totals.byType[r.acftType]) {
        totals.byType[r.acftType] = { count: 0, blockMin: 0, flightMin: 0 };
      }
      totals.byType[r.acftType].count += 1;
      totals.byType[r.acftType].blockMin += r.blockMin;
      totals.byType[r.acftType].flightMin += r.flightMin;
    });
    return totals;
  }, [completedFlightsRows]);

  const setCompletedRange = (range) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    if (range === "thisMonth") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setCompletedFromDate(d.toISOString().slice(0, 10));
      setCompletedToDate(to);
    } else if (range === "last30") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      setCompletedFromDate(d.toISOString().slice(0, 10));
      setCompletedToDate(to);
    } else if (range === "thisYear") {
      const d = new Date(today.getFullYear(), 0, 1);
      setCompletedFromDate(d.toISOString().slice(0, 10));
      setCompletedToDate(to);
    } else if (range === "all") {
      setCompletedFromDate("");
      setCompletedToDate("");
    }
  };

  const saveCompletedFlightInPortal = async (updatedFlight) => {
    if (!canEditCompleted) throw new Error("No permission");
    const autoStatus = computeAutoStatus(updatedFlight);
    const finalFlight = {
      ...updatedFlight,
      status: autoStatus,
      actual: { ...(updatedFlight.actual || {}) },
    };
    setSyncStatus?.("syncing");
    try {
      const apiResponse = await flightsAPI.update(finalFlight.id, finalFlight);
      const savedFlight = {
        ...finalFlight,
        ...(apiResponse || {}),
        id: finalFlight.id,
        actual: { ...(apiResponse?.actual || {}), ...finalFlight.actual },
      };
      setFlights?.((prev) =>
        Array.isArray(prev)
          ? prev.map((f) => (f.id === savedFlight.id ? savedFlight : f))
          : prev
      );
      setSyncStatus?.("synced");
      if (typeof reloadFlights === "function") {
        setTimeout(() => {
          reloadFlights().catch((err) =>
            console.warn("reloadFlights failed:", err)
          );
        }, 400);
      }
    } catch (e) {
      setSyncStatus?.("error");
      throw e;
    }
  };

  const exportCompletedPdf = async (showStamp = false) => {
    if (!canExportCompletedPdf) return;
    if (showStamp && !canExportCompletedStamp) return;
    if (!showStamp && !canExportCompletedNoStamp) return;
    setBusyCompletedPdf(true);
    try {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const fontMono = await pdf.embedFont(StandardFonts.Courier);

      let page = pdf.addPage([842, 595]);
      const { width } = page.getSize();
      let y = 555;

      const companyTitle = pdfSafe(
        settings?.companyName || settings?.operatorCode || "Flight Operations"
      );
      page.drawText(companyTitle, {
        x: 20,
        y,
        size: 15,
        font: fontBold,
        color: rgb(0.08, 0.14, 0.28),
      });
      page.drawText(
        pdfSafe(
          effectiveCompletedScope === "all"
            ? "COMPLETED FLIGHTS REPORT (ALL FLIGHTS)"
            : `COMPLETED FLIGHTS — ${myCrewData?.fullName || "CREW"}`
        ),
        {
          x: 20,
          y: y - 20,
          size: 12,
          font: fontBold,
          color: rgb(0.05, 0.45, 0.32),
        }
      );

      const periodStr = `${completedFromDate || "Start"} -> ${
        completedToDate || "Present"
      } (${completedTz})`;
      page.drawText(pdfSafe(`Period: ${periodStr}`), {
        x: 560,
        y,
        size: 9,
        font,
        color: rgb(0.35, 0.4, 0.48),
      });
      page.drawText(
        pdfSafe(
          `Sectors: ${completedSummary.count} | Block: ${fmtDuty(
            completedSummary.blockMin
          )} | Flight: ${fmtDuty(completedSummary.flightMin)}`
        ),
        {
          x: 560,
          y: y - 16,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.15, 0.22),
        }
      );

      y -= 48;

      const cols = [
        { label: "Date", x: 20 },
        { label: "Type", x: 82 },
        { label: "Reg", x: 132 },
        { label: "Flt No", x: 185 },
        { label: "ADEP", x: 242 },
        { label: "ADES", x: 282 },
        { label: "OFF", x: 324 },
        { label: "T/O", x: 374 },
        { label: "LND", x: 424 },
        { label: "ON", x: 474 },
        { label: "Block", x: 526 },
        { label: "Flight", x: 576 },
        { label: "COM", x: 628 },
        { label: "SIC", x: 732 },
      ];

      const drawHeader = () => {
        page.drawRectangle({
          x: 15,
          y: y - 4,
          width: width - 30,
          height: 18,
          color: rgb(0.9, 0.93, 0.97),
        });
        cols.forEach((c) => {
          page.drawText(c.label, {
            x: c.x,
            y: y + 1,
            size: 8.5,
            font: fontBold,
            color: rgb(0.12, 0.16, 0.24),
          });
        });
        y -= 18;
      };

      drawHeader();

      completedFlightsRows.forEach((r) => {
        if (y < 45) {
          page = pdf.addPage([842, 595]);
          y = 555;
          drawHeader();
        }
        const vals = [
          r.date,
          String(r.acftType || "").slice(0, 8),
          String(r.reg || "").slice(0, 8),
          String(r.flightNo || "").slice(0, 9),
          r.adep,
          r.ades,
          r.blockOff,
          r.t_o,
          r.lnd,
          r.blockOn,
          r.block,
          r.flight,
          String(r.com || "").slice(0, 16),
          String(r.sic || "").slice(0, 16),
        ];
        vals.forEach((v, idx) => {
          page.drawText(pdfSafe(String(v || "")), {
            x: cols[idx].x,
            y,
            size: 8.5,
            font: fontMono,
            color: rgb(0.1, 0.12, 0.16),
          });
        });
        y -= 15;
      });

      y -= 8;
      page.drawRectangle({
        x: 15,
        y: y - 5,
        width: width - 30,
        height: 20,
        color: rgb(0.86, 0.96, 0.9),
      });
      page.drawText(
        pdfSafe(
          `TOTAL SECTORS: ${completedSummary.count}   |   TOTAL BLOCK: ${fmtDuty(
            completedSummary.blockMin
          )}   |   TOTAL FLIGHT: ${fmtDuty(completedSummary.flightMin)}`
        ),
        {
          x: 20,
          y: y + 1,
          size: 10,
          font: fontBold,
          color: rgb(0.05, 0.35, 0.22),
        }
      );

      if (showStamp && settings?.stamp) {
        try {
          const sRes = await fetch(logoToDisplayUrl(settings.stamp));
          const sBytes = await sRes.arrayBuffer();
          let stampImage;
          try {
            stampImage = await pdf.embedPng(new Uint8Array(sBytes));
          } catch {
            stampImage = await pdf.embedJpg(new Uint8Array(sBytes));
          }
          if (stampImage) {
            pdf.getPages().forEach((p) => {
              const dims = stampImage.scale(0.5);
              const scale = Math.min(1, 65 / dims.height);
              p.drawImage(stampImage, {
                x: 50,
                y: 35,
                width: dims.width * scale,
                height: dims.height * scale,
                opacity: 0.8,
              });
            });
          }
        } catch (err) {
          console.warn("Stamp failed in PDF:", err);
        }
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = showStamp ? "_Stamped" : "_NoStamp";
      a.download = `Completed_Flights_${
        completedFromDate || "all"
      }_${completedToDate || "now"}${suffix}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast("PDF failed: " + e.message);
    } finally {
      setBusyCompletedPdf(false);
    }
  };

  /* ═══ Compute Hours (My Hours icon) ═══ */
  const totalHours = useMemo(() => {
    const fmtHM2 = (min) => {
      if (!min || min < 0) return "0h 00m";
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h ${String(m).padStart(2, "0")}m`;
    };

    const computeFor = (flightsList) => {
      let blockMin = 0;
      let flightMin = 0;
      let sectors = 0;
      const byPosition = {};

      flightsList.forEach((f) => {
        const a = f.actual || {};
        const baseStd = a.std || f.std;
        const baseSta = a.sta || f.sta;

        let bMin = 0;
        if (baseStd && baseSta) {
          const t1 = new Date(baseStd).getTime();
          const t2 = new Date(baseSta).getTime();
          if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
            bMin = Math.round((t2 - t1) / 60000);
          }
        }

        let fMin = 0;
        if (a.takeoff && a.landing) {
          const t1 = new Date(a.takeoff).getTime();
          const t2 = new Date(a.landing).getTime();
          if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
            fMin = Math.round((t2 - t1) / 60000);
          }
        }

        blockMin += bMin;
        flightMin += fMin;
        sectors += 1;

        const slots = safeArray(f.crewSlots);
        slots
          .filter((s) => s.crewId === myCrewData.id)
          .forEach((slot) => {
            const pos =
              POS_SHORT_MAP[slot.position] ||
              slot.position?.toUpperCase() ||
              "—";
            if (!byPosition[pos]) byPosition[pos] = { blockMin: 0, sectors: 0 };
            byPosition[pos].blockMin += bMin;
            byPosition[pos].sectors += 1;
          });
      });

      return {
        blockMin,
        flightMin,
        sectors,
        byPosition,
        blockHM: fmtHM2(blockMin),
        flightHM: fmtHM2(flightMin),
      };
    };

    const completedMyFlights = myFlights.filter(isFlightCompleted);
    const all = computeFor(completedMyFlights);
    const fromTs = hoursFromDate
      ? new Date(hoursFromDate + "T00:00:00Z").getTime()
      : null;
    const toTs = hoursToDate
      ? new Date(hoursToDate + "T23:59:59Z").getTime()
      : null;

    const filteredFlights = completedMyFlights.filter((f) => {
      const a = f.actual || {};
      const baseStd = a.std || f.std;
      if (!baseStd) return false;
      const tt = new Date(baseStd).getTime();
      if (isNaN(tt)) return false;
      if (fromTs !== null && tt < fromTs) return false;
      if (toTs !== null && tt > toTs) return false;
      return true;
    });

    const filtered = computeFor(filteredFlights);
    const isFiltered = Boolean(hoursFromDate || hoursToDate);

    return {
      all,
      filtered,
      filteredCount: filteredFlights.length,
      isFiltered,
      totalBlockMin: all.blockMin,
      totalFlightMin: all.flightMin,
      sectors: all.sectors,
      byPosition: all.byPosition,
      blockHM: all.blockHM,
      flightHM: all.flightHM,
    };
  }, [myFlights, myCrewData.id, hoursFromDate, hoursToDate]);

  const myAttachments = useMemo(() => {
    const raw = getDocs(myCrewData);
    return raw.map((d, i) => normalizeDoc(d, i)).filter(Boolean);
  }, [myCrewData]);

  const setRange = (range) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    if (range === "thisMonth") {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      setHoursFromDate(d.toISOString().slice(0, 10));
      setHoursToDate(to);
    } else if (range === "last30") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      setHoursFromDate(d.toISOString().slice(0, 10));
      setHoursToDate(to);
    } else if (range === "thisYear") {
      const d = new Date(today.getFullYear(), 0, 1);
      setHoursFromDate(d.toISOString().slice(0, 10));
      setHoursToDate(to);
    } else if (range === "all") {
      setHoursFromDate("");
      setHoursToDate("");
    }
  };

  const handleLogout = async () => {
    if (
      !(await confirmAction(
        isAr ? "هل تريد تسجيل الخروج؟" : "Do you want to sign out?"
      ))
    )
      return;
    setDrawerOpen(false);
    if (typeof logout === "function") logout();
    else {
      localStorage.clear();
      window.location.reload();
    }
  };

  const getMyPosition = (flight) => {
    const slot = (flight.crewSlots || []).find(
      (s) => s.crewId === myCrewData.id
    );
    return POS_SHORT_MAP[slot?.position] || slot?.position || "—";
  };

  const navItems = [
    { id: "home", icon: Home, threeDIcon: "home", label: isAr ? "الرئيسية" : "Home", show: true },
    {
      id: "schedule",
      icon: Calendar,
      threeDIcon: "schedule",
      label: isAr ? "جدولي" : "My Schedule",
      show: canSeeSchedule,
    },
    {
      id: "completed-flights",
      icon: CheckCircle2,
      threeDIcon: "completed-flights",
      label: isAr ? "الرحلات المكتملة" : "Completed Flights",
      show: canSeeCompletedFlights,
    },
    {
      id: "catering",
      icon: UtensilsCrossed,
      threeDIcon: "catering",
      label: isAr ? "التموين" : "Catering",
      show: canSeeCatering,
    },
    {
      id: "aircraft-status",
      icon: Plane,
      threeDIcon: "aircraft-status",
      label: isAr ? "حالة طائرتي" : "My Aircraft",
      show: canSeeAircraft,
    },
    {
      id: "certificates",
      icon: Award,
      threeDIcon: "certificates",
      label: isAr ? "الشهادات والمرفقات" : "Certificates",
      show: canSeeCerts,
    },
    { id: "ftl", icon: Clock, threeDIcon: "ftl", label: "FTL", show: canSeeFTL },
    {
      id: "manuals",
      icon: BookOpen,
      threeDIcon: "manuals",
      label: isAr ? "الأدلة والمراجع" : "Manuals",
      show: canSeeManuals,
    },
    {
      id: "hours",
      icon: TrendingUp,
      threeDIcon: "hours",
      label: isAr ? "ساعاتي" : "My Hours",
      show: canSeeHours,
    },
  ];

  const anyIconVisible =
    canSeeSchedule ||
    canSeeCompletedFlights ||
    canSeeCatering ||
    canSeeAircraft ||
    canSeeCerts ||
    canSeeFTL ||
    canSeeManuals ||
    canSeeHours;

  const viewTitleMap = {
    schedule: isAr ? "جدول رحلاتي" : "My Schedule",
    "completed-flights": isAr ? "الرحلات المكتملة" : "Completed Flights",
    catering: isAr ? "التموين (Catering)" : "Catering Management",
    "aircraft-status": isAr ? "حالة طائرتي" : "My Aircraft Status",
    certificates: isAr ? "الشهادات والمرفقات" : "Certificates & Files",
    ftl: isAr ? "ساعات الخدمة والراحة (FTL)" : "Flight Time Limitations (FTL)",
    manuals: isAr ? "الأدلة والمراجع" : "Manuals & Library",
    hours: isAr ? "إحصائيات ساعاتي" : "My Hours",
  };

  /* Flights available in Quick 24H Complete dropdown */
  const quickCompletableFlights = useMemo(() => {
    const source =
      canViewAllCompleted || checkPerm(targetUser, "schedule.edit")
        ? flights || []
        : myFlights;
    return [...source].sort(
      (a, b) =>
        new Date(b.std || 0).getTime() - new Date(a.std || 0).getTime()
    );
  }, [canViewAllCompleted, targetUser, flights, myFlights]);

  return (
    <div
      className="min-h-screen font-sans theme-transition"
      style={{
        ...activeVars,
        backgroundColor: THEME.bg,
        color: THEME.text,
      }}
      dir={isAr ? "rtl" : "ltr"}
    >
      {previewCrewPortal && (
        <div className="bg-amber-500 text-white text-xs font-bold py-1.5 px-3 text-center">
          {isAr
            ? "وضع المعاينة لبوابة الطاقم (Admin Preview)"
            : "Crew Portal Preview Mode (Admin Preview)"}
        </div>
      )}

      {/* ═══ Header ═══ */}
      <header
        className="sticky top-0 z-30 shadow-sm"
        style={{
          backgroundColor: THEME.header,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${THEME.borderLight}`,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center gap-2.5 px-4 py-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg transition"
            style={{ backgroundColor: THEME.surfaceSubtle }}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" style={{ color: THEME.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <h1
              className="text-lg sm:text-xl font-bold truncate"
              style={{ color: THEME.text }}
            >
              {isAr ? "بوابة الطاقم" : "Crew Portal"}
            </h1>
          </div>

          <div
            className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border"
            style={{
              color: THEME.textMuted,
              backgroundColor: THEME.surfaceSubtle,
              borderColor: THEME.borderLight,
            }}
          >
            <ThreeDIcon
              name="user"
              size={18}
              theme={THEME}
              darkMode={darkMode}
              className="shrink-0"
            />
            <span className="font-bold truncate max-w-[160px]" style={{ color: THEME.text }}>
              {myCrewData.fullName || "User"}
            </span>
          </div>

          {typeof setDarkMode === "function" && (
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg border transition"
              style={{
                backgroundColor: THEME.surfaceSubtle,
                borderColor: THEME.borderLight,
                color: THEME.text,
              }}
              title={darkMode ? "Light Mode" : "Dark Mode"}
              aria-label="Toggle theme mode"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" style={{ color: THEME.textMuted }} />
              )}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="p-2 rounded-lg border transition relative"
              style={{
                backgroundColor: THEME.surfaceSubtle,
                borderColor: THEME.borderLight,
              }}
              title={isAr ? "إشعارات الرحلات" : "Flight Notifications"}
              aria-label="Flight Notifications"
            >
              <ThreeDIcon
                name="bell"
                size={18}
                theme={THEME}
                darkMode={darkMode}
                className="shrink-0"
              />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold font-mono tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setNotifOpen(false)}
                />
                <div
                  className="absolute end-0 mt-2 w-80 sm:w-96 max-h-[75vh] flex flex-col rounded-xl shadow-2xl z-50 overflow-hidden"
                  style={{
                    backgroundColor: THEME.card,
                    border: `1px solid ${THEME.borderLight}`,
                    color: THEME.text,
                  }}
                >
                  <div
                    className="px-4 py-3 flex items-center justify-between gap-2"
                    style={{ borderBottom: `1px solid ${THEME.borderLight}` }}
                  >
                    <div className="font-bold text-sm flex items-center gap-2">
                      <Bell className="w-4 h-4" style={{ color: THEME.accent }} />
                      <span>{isAr ? "الإشعارات" : "Notifications"}</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-mono tabular-nums">
                          {unreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markAllNotificationsRead(notifications)}
                        className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
                        style={{ color: THEME.accent }}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        {isAr ? "تحديد الكل كمقروء" : "Mark all read"}
                      </button>
                    )}
                  </div>

                  <div
                    className="px-4 py-2 flex items-center justify-between gap-2 text-[11px]"
                    style={{
                      backgroundColor: THEME.bg,
                      borderBottom: `1px solid ${THEME.borderLight}`,
                    }}
                  >
                    <span
                      className="flex items-center gap-1.5"
                      style={{ color: THEME.textMuted }}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {isAr
                        ? "مزامنة مباشرة عبر Google Sheets"
                        : "Live Sync via Google Sheets"}
                    </span>
                    <button
                      type="button"
                      disabled={syncingNotifs}
                      onClick={refreshPortalNotifications}
                      className="px-2.5 py-1 rounded-lg text-white font-bold flex items-center gap-1 text-[11px] whitespace-nowrap disabled:opacity-60"
                      style={{ background: THEME.gradient }}
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${syncingNotifs ? "animate-spin" : ""}`}
                      />
                      {isAr ? "تحديث" : "Sync"}
                    </button>
                  </div>

                  {/* Lock Screen Push Notification Action Card */}
                  <div
                    className="px-3.5 py-2.5 border-b space-y-2"
                    style={{
                      backgroundColor: THEME.surfaceSubtle,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="flex items-center gap-1.5" style={{ color: THEME.text }}>
                        <Bell className="w-3.5 h-3.5 text-sky-500" />
                        {isAr ? "إشعارات الهاتف والشاشة المقفلة:" : "Mobile & Lock Screen Push Alerts:"}
                      </span>
                      {notifPerm === "granted" ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                          🟢 {isAr ? "مفعّلة" : "Enabled"}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono font-bold">
                          🔴 {isAr ? "غير مفعّلة" : "Disabled"}
                        </span>
                      )}
                    </div>

                    {typeof navigator !== "undefined" &&
                      /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase()) &&
                      !(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 leading-tight">
                          💡 <strong>أجهزة iPhone:</strong> تتيح شركة Apple الإشعارات عند اختيار <strong>"مشاركة ➔ إضافة إلى الشاشة الرئيسية"</strong> أولاً.
                        </div>
                      )}

                    {notifPerm === "granted" ? (
                      <button
                        type="button"
                        onClick={handleTestLockscreenNotif}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <span>🔔</span>
                        <span>{isAr ? "اختبر إرسال إشعار للشاشة المقفلة الآن" : "Test Lock Screen Alert Now"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnableLockscreenNotifs}
                        className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-sm transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <span>📲</span>
                        <span>{isAr ? "تفعيل إشعارات الهاتف للشاشة المقفلة بنقرة واحدة" : "Enable Mobile Lock Screen Alerts"}</span>
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto max-h-80">
                    {notifications.length === 0 ? (
                      <div
                        className="p-6 text-center text-xs"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr
                          ? "لا توجد إشعارات حالياً"
                          : "No flight notifications yet."}
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(n);
                            setNotifOpen(false);
                            if (canSeeSchedule) setActiveView("schedule");
                          }}
                          className="w-full text-start px-4 py-3 transition flex items-start gap-3 border-b"
                          style={{
                            borderColor: THEME.borderLight,
                            backgroundColor: !n.read
                              ? "rgba(59, 130, 246, 0.08)"
                              : "transparent",
                          }}
                        >
                          <span
                            className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                              !n.read ? "bg-sky-500" : "bg-transparent"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold leading-snug">
                              {n.message}
                            </div>
                            <div
                              className="text-[10px] mt-1 font-mono tabular-nums"
                              style={{ color: THEME.textMuted }}
                            >
                              {n.createdAtIso
                                ? new Date(n.createdAtIso).toLocaleString()
                                : ""}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition whitespace-nowrap"
            title={isAr ? "تسجيل الخروج" : "Sign Out"}
          >
            <LogOut className="w-4 h-4" />
            <span>{isAr ? "خروج" : "Exit"}</span>
          </button>
        </div>
      </header>

      {/* ═══ Drawer ═══ */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="fixed top-0 start-0 bottom-0 z-50 w-72 max-w-[85vw] shadow-2xl flex flex-col"
            style={{
              backgroundColor: THEME.card,
              borderInlineEnd: `1px solid ${THEME.borderLight}`,
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${THEME.borderLight}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0"
                  style={{ background: THEME.gradient }}
                >
                  {(myCrewData.fullName || "U")
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div
                    className="font-bold text-sm truncate"
                    style={{ color: THEME.text }}
                  >
                    {myCrewData.fullName || "User"}
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: THEME.textMuted }}
                  >
                    {myCrewData.role || targetUser?.role || "Crew Member"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg transition"
                style={{ backgroundColor: THEME.surfaceSubtle }}
                aria-label="Close"
              >
                <X className="w-5 h-5" style={{ color: THEME.text }} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              {navItems
                .filter((n) => n.show !== false)
                .map((item) => {
                  const Icon = item.icon;
                  const active =
                    activeView === item.id ||
                    (item.id === "home" && !activeView);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveView(item.id === "home" ? null : item.id);
                        setDrawerOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition mb-1 font-semibold"
                      style={
                        active
                          ? { background: THEME.gradient, color: "white" }
                          : { color: THEME.text }
                      }
                      onMouseEnter={(e) => {
                        if (!active)
                          e.currentTarget.style.backgroundColor = THEME.hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.backgroundColor = "";
                      }}
                    >
                      <ThreeDIcon
                        name={item.threeDIcon || item.id}
                        size={22}
                        theme={THEME}
                        darkMode={darkMode}
                        interactive={false}
                        className="shrink-0"
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </nav>

            <div
              className="p-3 space-y-2"
              style={{ borderTop: `1px solid ${THEME.borderLight}` }}
            >
              {typeof setLang === "function" && (
                <button
                  type="button"
                  onClick={() => setLang(isAr ? "en" : "ar")}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-bold transition whitespace-nowrap"
                  style={{
                    backgroundColor: THEME.surfaceSubtle,
                    borderColor: THEME.borderLight,
                    color: THEME.text,
                  }}
                  title={isAr ? "Switch to English" : "التبديل للعربية"}
                >
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4" style={{ color: THEME.accent }} />
                    <span>{isAr ? "لغة الواجهة" : "Language"}</span>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-mono font-bold"
                    style={{
                      background: THEME.gradient,
                      color: "#ffffff",
                    }}
                  >
                    {isAr ? "English" : "العربية"}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  openMyPasswordModal();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-bold transition whitespace-nowrap"
                style={{
                  backgroundColor: THEME.surfaceSubtle,
                  borderColor: THEME.borderLight,
                  color: THEME.text,
                }}
              >
                <ThreeDIcon
                  name="lock"
                  size={18}
                  theme={THEME}
                  darkMode={darkMode}
                  interactive={false}
                  className="shrink-0"
                />
                <span>{isAr ? "تغيير كلمة المرور" : "Change My Password"}</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition"
              >
                <LogOut className="w-4 h-4" />
                {isAr ? "تسجيل الخروج" : "Sign Out"}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* ═══ Main Home Grid ═══ */}
      <main className="max-w-6xl mx-auto">
        <div
          className="px-4 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2 text-sm"
          style={{ color: THEME.textMuted }}
        >
          <div>
            {isAr ? "مرحباً، " : "Welcome, "}
            <span className="font-bold" style={{ color: THEME.text }}>
              {myCrewData.fullName || "User"}
            </span>
          </div>
        </div>

        {latestUnreadNotification && (
          <div className="px-4 pt-1 pb-2">
            <div
              className="rounded-xl p-3.5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.10)",
                borderColor: THEME.accent,
                color: THEME.text,
              }}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 shadow-sm"
                  style={{ background: THEME.gradient }}
                >
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">
                      {isAr ? "إشعار عمليات جديد" : "New Operations Notification"}
                    </span>
                    {unreadNotificationsCount > 1 && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold font-mono">
                        +{unreadNotificationsCount - 1}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 font-medium leading-relaxed break-words">
                    {latestUnreadNotification.message}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                {canSeeSchedule && (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(latestUnreadNotification);
                      setActiveView("schedule");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
                    style={{ background: THEME.gradient }}
                  >
                    {isAr ? "عرض جدولي" : "View Schedule"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead(notifications)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition"
                  style={{
                    backgroundColor: THEME.card,
                    borderColor: THEME.borderLight,
                    color: THEME.textMuted,
                  }}
                >
                  {isAr ? "تحديد كمقروء" : "Dismiss"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!anyIconVisible ? (
          <div className="p-4">
            <div
              className="rounded-xl p-10 text-center border"
              style={{
                backgroundColor: THEME.card,
                borderColor: THEME.borderLight,
              }}
            >
              <Lock
                className="w-10 h-10 mx-auto mb-3 opacity-60"
                style={{ color: THEME.accent }}
              />
              <div
                className="font-bold text-base mb-1"
                style={{ color: THEME.text }}
              >
                {isAr
                  ? "لا توجد أيقونات مفعّلة لحسابك في بوابة الطاقم"
                  : "No Crew Portal icons are enabled for your role"}
              </div>
              <p className="text-xs" style={{ color: THEME.textMuted }}>
                {isAr
                  ? "يرجى مراجعة مسؤول النظام لتفعيل صلاحيات أيقونات بوابة الطاقم."
                  : "Please contact your administrator to enable Crew Portal icon permissions."}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 pb-20">
            {canSeeSchedule && (
              <PortalCard
                threeDIcon="schedule"
                icon={Calendar}
                label={isAr ? "جدولي" : "My Schedule"}
                subLabel={isAr ? "رحلاتي المجدولة" : "Assigned Flights"}
                onClick={() => setActiveView("schedule")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeCompletedFlights && (
              <PortalCard
                threeDIcon="completed-flights"
                icon={CheckCircle2}
                label={isAr ? "الرحلات المكتملة" : "Completed Flights"}
                subLabel={
                  canEditCompleted
                    ? isAr
                      ? "عرض + إكمال 24H"
                      : "Log & 24H Edit"
                    : isAr
                    ? "السجل والتقارير"
                    : "Records & PDF"
                }
                badge={
                  portalCompletedBadgeCount > 0
                    ? portalCompletedBadgeCount
                    : null
                }
                badgeColor="emerald"
                onClick={() => setActiveView("completed-flights")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeCatering && (
              <PortalCard
                threeDIcon="catering"
                icon={UtensilsCrossed}
                label={isAr ? "التموين" : "Catering"}
                subLabel={
                  canCateringCreate || canCateringEdit
                    ? isAr
                      ? "طلبات وقوالب التموين"
                      : "Orders & Templates"
                    : isAr
                    ? "عرض وطباعة التموين"
                    : "View & Print"
                }
                onClick={() => setActiveView("catering")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeAircraft && (
              <PortalCard
                threeDIcon="aircraft-status"
                icon={Plane}
                label={isAr ? "حالة طائرتي" : "My Aircraft Status"}
                subLabel={
                  myAircraftStatus.length === 1
                    ? `${myAircraftStatus[0].reg} · ${
                        myAircraftStatus[0].isWorking
                          ? isAr
                            ? "في الخدمة"
                            : "In Service"
                          : isAr
                          ? "خارج الخدمة"
                          : "Out of Service"
                      }`
                    : myAircraftStatus.length > 1
                    ? myAircraftStatus.map((a) => a.reg).join(" · ")
                    : isAr
                    ? "غير معيّنة"
                    : "Not Assigned"
                }
                badge={
                  notOperationalCount > 0
                    ? notOperationalCount
                    : melAircraftCount > 0
                    ? melAircraftCount
                    : myAircraftStatus.length > 0
                    ? myAircraftStatus.length
                    : null
                }
                badgeColor={
                  notOperationalCount > 0
                    ? "rose"
                    : melAircraftCount > 0
                    ? "sky"
                    : "emerald"
                }
                onClick={() => setActiveView("aircraft-status")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeCerts && (
              <PortalCard
                threeDIcon="certificates"
                icon={Award}
                label={isAr ? "الشهادات" : "Certificates"}
                subLabel={isAr ? "الوثائق والمرفقات" : "Licenses & Docs"}
                onClick={() => setActiveView("certificates")}
                badge={
                  canSeeFiles && myAttachments.length > 0
                    ? myAttachments.length
                    : null
                }
                badgeColor="sky"
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeFTL && (
              <PortalCard
                threeDIcon="ftl"
                icon={Clock}
                label="FTL"
                subLabel={isAr ? "حدود الطيران والخدمة" : "Duty & Flight Limits"}
                onClick={() => setActiveView("ftl")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeManuals && (
              <PortalCard
                threeDIcon="manuals"
                icon={BookOpen}
                label={isAr ? "الأدلة" : "Manuals"}
                subLabel={isAr ? "مكتبة العمليات" : "Operations Library"}
                onClick={() => setActiveView("manuals")}
                THEME={THEME}
                darkMode={darkMode}
              />
            )}

            {canSeeHours && (
              <button
                type="button"
                onClick={() => setActiveView("hours")}
                className="relative aspect-[1/1] rounded-2xl flex flex-col items-center justify-between p-4 sm:p-5 transition-all duration-300 border group overflow-hidden text-center cursor-pointer select-none active:scale-[0.97]"
                style={{
                  background: THEME.gradient,
                  borderColor: THEME.border,
                  boxShadow: "0 8px 24px -4px rgba(0, 0, 0, 0.15)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "0 14px 32px -4px rgba(0, 0, 0, 0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(0, 0, 0, 0.15)";
                }}
              >
                {/* Background ambient radial highlight */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {totalHours.totalBlockMin > 0 && (
                  <span className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-mono tabular-nums font-bold border border-white/30 shadow-sm z-10">
                    {Math.floor(totalHours.totalBlockMin / 60)}h
                  </span>
                )}

                <div className="w-full flex-1 flex flex-col items-center justify-center pt-1 z-10">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <ThreeDIcon
                      name="hours"
                      size={46}
                      theme={THEME}
                      darkMode={darkMode}
                      interactive={false}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-center text-white tracking-tight">
                    {isAr ? "ساعاتي" : "My Hours"}
                  </span>
                </div>

                <span className="text-[10px] sm:text-[11px] font-mono font-semibold text-white/90 text-center line-clamp-1 w-full pt-1 border-t border-white/20 z-10">
                  {totalHours.blockHM}
                </span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* ═══ Overlay Views ═══ */}
      {activeView && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{
            ...activeVars,
            backgroundColor: THEME.bg,
            color: THEME.text,
          }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div
            className="sticky top-0 z-20 shadow-sm"
            style={{
              backgroundColor: THEME.header,
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${THEME.borderLight}`,
            }}
          >
            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <ThreeDIcon
                  name={activeView}
                  size={26}
                  theme={THEME}
                  darkMode={darkMode}
                  interactive={false}
                  className="shrink-0"
                />
                <h2
                  className="font-bold text-base sm:text-lg truncate"
                  style={{ color: THEME.text }}
                >
                  {viewTitleMap[activeView] || activeView}
                </h2>
              </div>
              <button
                onClick={() => setActiveView(null)}
                className="px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-bold border"
                style={{
                  backgroundColor: THEME.card,
                  borderColor: THEME.borderLight,
                  color: THEME.text,
                }}
              >
                <X className="w-4 h-4" />
                <span>{isAr ? "إغلاق" : "Close"}</span>
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto p-4 pb-16">
            {/* ═══════════ SCHEDULE ═══════════ */}
            {activeView === "schedule" && canSeeSchedule && (
              <CalendarView
                flights={myFlights}
                selectedDate={selectedDateForCalendar}
                setSelectedDate={setSelectedDateForCalendar}
                timeMode="UTC"
                isPast={(f) => {
                  if (!f.std) return false;
                  const a = f.actual || {};
                  const isCompleted = a.std && a.sta;
                  if (isCompleted) return false;
                  return (
                    new Date(f.std).getTime() < Date.now() - 30 * 60 * 1000
                  );
                }}
                crew={crew}
                onSelectFlight={(flight) => setSelectedFlight(flight)}
              />
            )}

            {/* ═══════════ COMPLETED FLIGHTS ═══════════ */}
            {activeView === "completed-flights" && canSeeCompletedFlights && (
              <div className="space-y-4">
                {/* Quick 24H Flight Completion Bar (Gated by schedule.edit or portal.completed_flights_edit) */}
                {canEditCompleted && (
                  <div
                    className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div className="text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span style={{ color: THEME.text }}>
                        {isAr
                          ? "إدخال / تعديل إكمال الرحلة (نظام 24 ساعة UTC — شاشة كاملة)"
                          : "Complete / Edit Flight Journey Log (24H UTC — Full Screen)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                      <select
                        value={quickCompleteFlightId}
                        onChange={(e) => setQuickCompleteFlightId(e.target.value)}
                        className="flex-1 sm:flex-initial px-3 py-2 text-xs rounded-lg border font-mono tabular-nums min-w-[230px]"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      >
                        <option value="">
                          {isAr
                            ? "— اختر رحلة لإدخال أوقاتها (24H) —"
                            : "— Select flight to complete (24H) —"}
                        </option>
                        {quickCompletableFlights.map((fl) => (
                          <option key={fl.id} value={fl.id}>
                            {fl.flightNo || "—"} | {fl.dep}→{fl.arr} |{" "}
                            {fl.std ? String(fl.std).slice(0, 10) : "—"} (
                            {fl.acft || "—"})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!quickCompleteFlightId}
                        onClick={() => {
                          const target = (flights || []).find(
                            (fl) => fl.id === quickCompleteFlightId
                          );
                          if (target) setEditingCompletedFlight(target);
                        }}
                        className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition whitespace-nowrap flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {isAr
                            ? "فتح نافذة الإكمال (24H)"
                            : "Open 24H Log"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Filters & Controls Card */}
                <div
                  className="p-4 rounded-xl border space-y-3"
                  style={{
                    backgroundColor: THEME.card,
                    borderColor: THEME.borderLight,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Scope Toggle if permitted */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {canViewAllCompleted ? (
                        <div
                          className="inline-flex rounded-lg p-0.5 border"
                          style={{
                            backgroundColor: THEME.bg,
                            borderColor: THEME.borderLight,
                          }}
                        >
                          {myCrewData?.id && (
                            <button
                              type="button"
                              onClick={() => setCompletedScope("mine")}
                              className="px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap"
                              style={
                                effectiveCompletedScope === "mine"
                                  ? { background: THEME.gradient, color: "white" }
                                  : { color: THEME.textMuted }
                              }
                            >
                              {isAr ? "رحلاتي فقط" : "My Flights"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCompletedScope("all")}
                            className="px-3 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap"
                            style={
                              effectiveCompletedScope === "all"
                                ? { background: THEME.gradient, color: "white" }
                                : { color: THEME.textMuted }
                            }
                          >
                            {isAr ? "كل الرحلات" : "All Flights"}
                          </button>
                        </div>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-md text-xs font-bold border"
                          style={{
                            backgroundColor: THEME.surfaceSubtle,
                            borderColor: THEME.borderLight,
                            color: THEME.text,
                          }}
                        >
                          {isAr ? "نطاق العرض: رحلاتي" : "Scope: My Flights"}
                        </span>
                      )}

                      {/* UTC / Local Toggle */}
                      <div
                        className="inline-flex rounded-lg p-0.5 border font-mono"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        {["UTC", "Local"].map((tz) => (
                          <button
                            key={tz}
                            type="button"
                            onClick={() => setCompletedTz(tz)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold transition"
                            style={
                              completedTz === tz
                                ? { background: THEME.gradient, color: "white" }
                                : { color: THEME.textMuted }
                            }
                          >
                            {tz}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PDF Export Buttons (Granular Stamp & No-Stamp RBAC) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={
                          busyCompletedPdf ||
                          completedFlightsRows.length === 0 ||
                          !canExportCompletedStamp
                        }
                        onClick={() => exportCompletedPdf(true)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
                        title={
                          canExportCompletedStamp
                            ? isAr
                              ? "تصدير PDF بالختم الرسمي"
                              : "Export PDF with Official Stamp"
                            : isAr
                            ? "مقفل: يتطلب صلاحية الطباعة بالختم الرسمي في بوابة الطاقم"
                            : "Locked: Requires Portal Print with Stamp permission"
                        }
                      >
                        <Stamp className="w-3.5 h-3.5" />
                        <span>
                          {busyCompletedPdf
                            ? "…"
                            : isAr
                            ? "PDF بالختم"
                            : "Stamped PDF"}
                        </span>
                        {!canExportCompletedStamp && <Lock className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        disabled={
                          busyCompletedPdf ||
                          completedFlightsRows.length === 0 ||
                          !canExportCompletedNoStamp
                        }
                        onClick={() => exportCompletedPdf(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition"
                        title={
                          canExportCompletedNoStamp
                            ? isAr
                              ? "تصدير PDF بدون ختم"
                              : "Export PDF without Stamp"
                            : isAr
                            ? "مقفل: يتطلب صلاحية الطباعة بدون ختم في بوابة الطاقم"
                            : "Locked: Requires Portal Print without Stamp permission"
                        }
                      >
                        <FileX className="w-3.5 h-3.5" />
                        <span>
                          {busyCompletedPdf
                            ? "…"
                            : isAr
                            ? "PDF بدون ختم"
                            : "PDF No Stamp"}
                        </span>
                        {!canExportCompletedNoStamp && <Lock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Filter Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "من تاريخ" : "From Date"}
                      </label>
                      <input
                        type="date"
                        value={completedFromDate}
                        onChange={(e) => setCompletedFromDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs font-mono tabular-nums border"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "إلى تاريخ" : "To Date"}
                      </label>
                      <input
                        type="date"
                        value={completedToDate}
                        onChange={(e) => setCompletedToDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs font-mono tabular-nums border"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "الطائرة" : "Aircraft"}
                      </label>
                      <select
                        value={completedAcft}
                        onChange={(e) => setCompletedAcft(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs font-mono border"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      >
                        <option value="">
                          {isAr ? "كل الطائرات" : "All Aircraft"}
                        </option>
                        {(fleet || []).map((a) => (
                          <option key={a.id || a.reg} value={a.reg}>
                            {a.reg} {a.type ? `(${a.type})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "بحث سريع" : "Search"}
                      </label>
                      <div className="relative">
                        <Search
                          className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2"
                          style={{ color: THEME.textMuted }}
                        />
                        <input
                          type="text"
                          value={completedSearch}
                          onChange={(e) => setCompletedSearch(e.target.value)}
                          placeholder={
                            isAr
                              ? "رقم الرحلة، المطار، الطيار..."
                              : "Flight, ICAO, Reg, Crew..."
                          }
                          className="w-full ps-8 pe-3 py-2 rounded-lg text-xs border"
                          style={{
                            backgroundColor: THEME.bg,
                            borderColor: THEME.borderLight,
                            color: THEME.text,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Date Presets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      {
                        r: "thisMonth",
                        l: isAr ? "هذا الشهر" : "This Month",
                      },
                      {
                        r: "last30",
                        l: isAr ? "آخر 30 يوم" : "Last 30 Days",
                      },
                      {
                        r: "thisYear",
                        l: isAr ? "هذه السنة" : "This Year",
                      },
                      { r: "all", l: isAr ? "كل الأوقات" : "All Time" },
                    ].map((btn) => (
                      <button
                        key={btn.r}
                        type="button"
                        onClick={() => setCompletedRange(btn.r)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition border"
                        style={{
                          backgroundColor: THEME.surfaceSubtle,
                          color: THEME.text,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        {btn.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* KPI Summary Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase"
                      style={{ color: THEME.textMuted }}
                    >
                      {isAr ? "إجمالي القطاعات المكتملة" : "Completed Sectors"}
                    </div>
                    <div
                      className="text-2xl font-black font-mono tabular-nums mt-1"
                      style={{ color: THEME.accent }}
                    >
                      {completedSummary.count}
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase"
                      style={{ color: THEME.textMuted }}
                    >
                      {isAr ? "إجمالي ساعات البلوك" : "Total Block Time"}
                    </div>
                    <div
                      className="text-2xl font-black font-mono tabular-nums mt-1"
                      style={{ color: THEME.text }}
                    >
                      {fmtDuty(completedSummary.blockMin)}
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div
                      className="text-xs font-bold uppercase"
                      style={{ color: THEME.textMuted }}
                    >
                      {isAr ? "إجمالي ساعات الطيران" : "Total Flight Time"}
                    </div>
                    <div
                      className="text-2xl font-black font-mono tabular-nums mt-1 text-emerald-500"
                    >
                      {fmtDuty(completedSummary.flightMin)}
                    </div>
                  </div>
                </div>

                {/* Aircraft Type Breakdown */}
                {Object.keys(completedSummary.byType).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(completedSummary.byType).map(
                      ([type, info]) => (
                        <div
                          key={type}
                          className="px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 font-mono tabular-nums"
                          style={{
                            backgroundColor: THEME.card,
                            borderColor: THEME.borderLight,
                            color: THEME.text,
                          }}
                        >
                          <span className="font-bold">{type}</span>
                          <span style={{ color: THEME.textMuted }}>•</span>
                          <span>
                            {info.count} {isAr ? "قطاع" : "sec"}
                          </span>
                          <span style={{ color: THEME.textMuted }}>•</span>
                          <span style={{ color: THEME.accent }}>
                            {fmtDuty(info.blockMin)}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Completed Flights Table */}
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{
                    backgroundColor: THEME.card,
                    borderColor: THEME.borderLight,
                  }}
                >
                  {completedFlightsRows.length === 0 ? (
                    <div className="p-10 text-center">
                      <CheckCircle2
                        className="w-10 h-10 mx-auto mb-2 opacity-30"
                        style={{ color: THEME.textMuted }}
                      />
                      <div
                        className="font-bold text-sm"
                        style={{ color: THEME.text }}
                      >
                        {isAr
                          ? "لا توجد رحلات مكتملة ضمن الفلتر المحدد"
                          : "No completed flights in selected period"}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead
                          style={{
                            backgroundColor: THEME.surfaceSubtle,
                            borderBottom: `1px solid ${THEME.borderLight}`,
                          }}
                        >
                          <tr>
                            {[
                              isAr ? "التاريخ" : "Date",
                              isAr ? "الطراز" : "Type",
                              isAr ? "التسجيل" : "Reg.",
                              isAr ? "الرحلة" : "Flight",
                              "ADEP",
                              "ADES",
                              "OFF",
                              "T/O",
                              "LND",
                              "ON",
                              "Block",
                              "Flight",
                              "COM",
                              "SIC",
                              ...(canEditCompleted ? ["24H JL"] : []),
                            ].map((h, i) => (
                              <th
                                key={`${h}-${i}`}
                                className="px-3 py-2.5 text-start font-bold whitespace-nowrap"
                                style={{ color: THEME.textMuted }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {completedFlightsRows.map((r) => (
                            <tr
                              key={r.id}
                              className="border-t transition"
                              style={{ borderColor: THEME.borderLight }}
                            >
                              <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {r.date}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                {r.acftType}
                              </td>
                              <td
                                className="px-3 py-2.5 font-bold font-mono whitespace-nowrap"
                                style={{ color: THEME.accent }}
                              >
                                {r.reg}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums font-bold whitespace-nowrap">
                                {r.flightNo}
                              </td>
                              <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                                {r.adep}
                              </td>
                              <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                                {r.ades}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {r.blockOff}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {r.t_o}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {r.lnd}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {r.blockOn}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums font-bold whitespace-nowrap">
                                {r.block}
                              </td>
                              <td className="px-3 py-2.5 font-mono tabular-nums text-emerald-500 font-bold whitespace-nowrap">
                                {r.flight}
                              </td>
                              <td className="px-3 py-2.5 truncate max-w-[130px]">
                                {r.com}
                              </td>
                              <td className="px-3 py-2.5 truncate max-w-[130px]">
                                {r.sic}
                              </td>
                              {canEditCompleted && (
                                <td className="px-3 py-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const target = (flights || []).find(
                                        (fl) => fl.id === r.id
                                      );
                                      if (target)
                                        setEditingCompletedFlight(target);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-600/15 text-emerald-500 hover:bg-emerald-600/25 border border-emerald-500/30 transition whitespace-nowrap"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    <span>
                                      {isAr ? "تعديل (24H)" : "Edit (24H)"}
                                    </span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══════════ CATERING ═══════════ */}
            {activeView === "catering" && canSeeCatering && (
              <div className="space-y-3">
                <div
                  className="px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs"
                  style={{
                    backgroundColor: THEME.card,
                    borderColor: THEME.borderLight,
                  }}
                >
                  <span className="font-bold" style={{ color: THEME.text }}>
                    {isAr
                      ? "صلاحيات التموين المفعّلة لحسابك:"
                      : "Your Active Catering Permissions:"}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 font-semibold">
                      {isAr ? "عرض وطباعة" : "View & Print"}
                    </span>
                    {canCateringCreate && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 font-semibold">
                        {isAr ? "إنشاء طلبات وقوالب" : "Create Orders & Templates"}
                      </span>
                    )}
                    {canCateringEdit && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 font-semibold">
                        {isAr ? "تعديل واعتماد الحالة" : "Edit & Confirm Status"}
                      </span>
                    )}
                    {canCateringDelete && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 font-semibold">
                        {isAr ? "حذف" : "Delete"}
                      </span>
                    )}
                  </div>
                </div>

                <CateringModule
                  flights={flights}
                  settings={settings}
                  user={targetUser}
                  setSyncStatus={setSyncStatus}
                />
              </div>
            )}

            {/* ═══════════ MY AIRCRAFT STATUS ═══════════ */}
            {activeView === "aircraft-status" && canSeeAircraft && (
              <div className="max-w-3xl mx-auto py-2 space-y-5">
                {camoLoading &&
                myAircraftStatus.length === 0 &&
                assignedAircraftRegs.length > 0 ? (
                  <div
                    className="rounded-2xl border overflow-hidden"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div
                      className="px-6 py-4 flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: THEME.surfaceSubtle,
                        borderBottom: `1px solid ${THEME.borderLight}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl"
                          style={{ backgroundColor: `${THEME.accent}18` }}
                        />
                        <div className="space-y-2">
                          <div
                            className="h-5 w-28 rounded"
                            style={{ backgroundColor: THEME.surfaceSubtle }}
                          />
                          <div
                            className="h-3.5 w-36 rounded"
                            style={{ backgroundColor: THEME.surfaceSubtle }}
                          />
                        </div>
                      </div>
                      <RefreshCw
                        className="w-4 h-4 animate-spin"
                        style={{ color: THEME.textMuted }}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <div className="p-6 sm:p-7 space-y-3">
                        <div
                          className="h-4 w-32 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                        <div
                          className="h-5 w-48 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                        <div
                          className="h-4 w-40 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                      </div>
                      <div
                        className="p-6 sm:p-7 space-y-3 border-t sm:border-t-0 sm:border-s"
                        style={{ borderColor: THEME.borderLight }}
                      >
                        <div
                          className="h-4 w-28 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                        <div
                          className="h-5 w-44 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                        <div
                          className="h-4 w-48 rounded"
                          style={{ backgroundColor: THEME.surfaceSubtle }}
                        />
                      </div>
                    </div>
                  </div>
                ) : myAircraftStatus.length === 0 ? (
                  <div
                    className="rounded-2xl border p-10 text-center"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <div
                      className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                      style={{
                        backgroundColor: `${THEME.accent}14`,
                        border: `1px solid ${THEME.accent}28`,
                      }}
                    >
                      <ThreeDIcon
                        name="aircraft-status"
                        size={52}
                        theme={THEME}
                        darkMode={darkMode}
                      />
                    </div>
                    <h3
                      className="text-base font-bold"
                      style={{ color: THEME.text }}
                    >
                      {isAr
                        ? "لا توجد طائرة معيّنة لحسابك حالياً"
                        : "No Assigned Aircraft"}
                    </h3>
                    <p
                      className="text-xs sm:text-sm mt-1.5 max-w-md mx-auto leading-relaxed"
                      style={{ color: THEME.textMuted }}
                    >
                      {isAr
                        ? "تظهر هنا الحالة التشغيلية وحالة MEL الخاصة بالطائرة المعيّنة لك فور ربطها بملفك."
                        : "Operational Status and MEL Status will appear here once an aircraft is assigned to your profile."}
                    </p>
                  </div>
                ) : (
                  myAircraftStatus.map((a, idx) => {
                    const hasOverdueMel = a.overdueMels?.length > 0;
                    const emeraldTone = isDarkSurface ? "#34d399" : "#047857";
                    const roseTone = isDarkSurface ? "#fb7185" : "#be123c";
                    const amberTone = isDarkSurface ? "#fbbf24" : "#b45309";

                    const opColor = a.isWorking ? emeraldTone : roseTone;
                    const opBg = a.isWorking
                      ? isDarkSurface
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(5, 150, 105, 0.09)"
                      : isDarkSurface
                      ? "rgba(244, 63, 94, 0.14)"
                      : "rgba(190, 18, 60, 0.09)";

                    const melColor = !a.hasMel
                      ? emeraldTone
                      : hasOverdueMel
                      ? roseTone
                      : amberTone;
                    const melBg = !a.hasMel
                      ? isDarkSurface
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(5, 150, 105, 0.09)"
                      : hasOverdueMel
                      ? isDarkSurface
                        ? "rgba(244, 63, 94, 0.14)"
                        : "rgba(190, 18, 60, 0.09)"
                      : isDarkSurface
                      ? "rgba(245, 158, 11, 0.14)"
                      : "rgba(180, 83, 9, 0.09)";

                    const melCategoriesEn = a.hasMel
                      ? Array.from(
                          new Set(
                            a.mels.map((m) => `Cat ${m.category || "C"}`)
                          )
                        ).join(", ")
                      : "";
                    const melCategoriesAr = a.hasMel
                      ? Array.from(
                          new Set(
                            a.mels.map((m) => `فئة ${m.category || "C"}`)
                          )
                        ).join("، ")
                      : "";

                    return (
                      <section
                        key={a.id || a.reg}
                        className="rounded-2xl border overflow-hidden"
                        style={{
                          backgroundColor: THEME.card,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        {/* Assigned Aircraft Identity Header */}
                        <div
                          className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3"
                          style={{
                            backgroundColor: THEME.surfaceSubtle,
                            borderBottom: `1px solid ${THEME.borderLight}`,
                          }}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: `${THEME.accent}14`,
                                border: `1px solid ${THEME.accent}28`,
                              }}
                            >
                              <ThreeDIcon
                                name="aircraft-status"
                                size={36}
                                theme={THEME}
                                darkMode={darkMode}
                                interactive={false}
                              />
                            </div>
                            <div className="min-w-0">
                              <div
                                className="font-mono tabular-nums text-xl sm:text-2xl font-extrabold tracking-tight truncate"
                                style={{ color: THEME.text }}
                              >
                                {a.reg}
                              </div>
                              <div
                                className="text-xs font-medium truncate mt-0.5"
                                style={{ color: THEME.textMuted }}
                              >
                                {a.type ? `${a.type} · ` : ""}
                                {isAr ? "الطائرة المعيّنة" : "Assigned Aircraft"}
                              </div>
                            </div>
                          </div>

                          {idx === 0 && (
                            <button
                              type="button"
                              onClick={refreshAircraftStatus}
                              disabled={camoLoading}
                              title={
                                isAr ? "تحديث الحالة" : "Refresh aircraft status"
                              }
                              aria-label={
                                isAr ? "تحديث الحالة" : "Refresh aircraft status"
                              }
                              className="w-9 h-9 rounded-lg border flex items-center justify-center transition shrink-0 disabled:opacity-50"
                              style={{
                                backgroundColor: THEME.card,
                                borderColor: THEME.borderLight,
                                color: THEME.textMuted,
                              }}
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${
                                  camoLoading ? "animate-spin" : ""
                                }`}
                              />
                            </button>
                          )}
                        </div>

                        {/* Two-Panel Status Grid: Operational Status + MEL Status Only */}
                        <div className="grid grid-cols-1 sm:grid-cols-2">
                          {/* 1. Operational Status */}
                          <div className="p-6 sm:p-7 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: opBg,
                                    color: opColor,
                                  }}
                                >
                                  {a.isWorking ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : a.rawStatus === "MAINTENANCE" ? (
                                    <Wrench className="w-4 h-4" />
                                  ) : (
                                    <XCircle className="w-4 h-4" />
                                  )}
                                </div>
                                <span
                                  className="text-xs font-semibold uppercase tracking-wider"
                                  style={{ color: THEME.textMuted }}
                                >
                                  {isAr
                                    ? "الحالة التشغيلية"
                                    : "Operational Status"}
                                </span>
                              </div>

                              <div
                                className="mt-4 text-base sm:text-lg font-bold tracking-tight"
                                style={{ color: opColor }}
                              >
                                {a.isWorking
                                  ? isAr
                                    ? "تعمل (في الخدمة)"
                                    : "Operational (In Service)"
                                  : isAr
                                  ? "خارج الخدمة"
                                  : "Out of Service"}
                              </div>

                              <p
                                className="mt-1 text-sm leading-relaxed"
                                style={{ color: THEME.textMuted }}
                              >
                                {isAr ? a.workingDetailAr : a.workingDetailEn}
                              </p>
                            </div>
                          </div>

                          {/* 2. MEL Status */}
                          <div
                            className="p-6 sm:p-7 flex flex-col justify-between border-t sm:border-t-0 sm:border-s"
                            style={{ borderColor: THEME.borderLight }}
                          >
                            <div>
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: melBg,
                                    color: melColor,
                                  }}
                                >
                                  {a.hasMel ? (
                                    <AlertTriangle className="w-4 h-4" />
                                  ) : (
                                    <ShieldCheck className="w-4 h-4" />
                                  )}
                                </div>
                                <span
                                  className="text-xs font-semibold uppercase tracking-wider"
                                  style={{ color: THEME.textMuted }}
                                >
                                  {isAr ? "حالة MEL" : "MEL Status"}
                                </span>
                              </div>

                              {a.hasMel ? (
                                <>
                                  <div
                                    className="mt-4 text-base sm:text-lg font-bold tracking-tight tabular-nums"
                                    style={{ color: melColor }}
                                  >
                                    {isAr
                                      ? `يوجد MEL نشط (${a.mels.length})`
                                      : `Active MEL (${a.mels.length})`}
                                  </div>
                                  <p
                                    className="mt-1 text-sm leading-relaxed"
                                    style={{ color: THEME.textMuted }}
                                  >
                                    {isAr
                                      ? `${a.mels.length} بند MEL مفتوح أو مؤجل${
                                          melCategoriesAr
                                            ? ` · ${melCategoriesAr}`
                                            : ""
                                        }`
                                      : `${a.mels.length} open or deferred MEL ${
                                          a.mels.length === 1 ? "item" : "items"
                                        }${
                                          melCategoriesEn
                                            ? ` · ${melCategoriesEn}`
                                            : ""
                                        }`}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="mt-4 text-base sm:text-lg font-bold tracking-tight"
                                    style={{ color: melColor }}
                                  >
                                    {isAr
                                      ? "لا يوجد MEL نشط (NIL)"
                                      : "No Active MEL (NIL)"}
                                  </div>
                                  <p
                                    className="mt-1 text-sm leading-relaxed"
                                    style={{ color: THEME.textMuted }}
                                  >
                                    {isAr
                                      ? "لا توجد أي بنود MEL مفتوحة أو مؤجلة"
                                      : "Zero open or deferred MEL items"}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            )}

            {/* ═══════════ CERTIFICATES ═══════════ */}
            {activeView === "certificates" && canSeeCerts && (
              <div className="space-y-6">
                <div>
                  <h3
                    className="font-bold mb-3 flex items-center gap-2"
                    style={{ color: THEME.textMuted }}
                  >
                    <Award className="w-5 h-5" />{" "}
                    {isAr ? "بيانات الشهادات والوثائق" : "Certificates Info"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        label: isAr ? "رقم الرخصة" : "License No",
                        value: myCrewData.licenseNo,
                        exp: myCrewData.licenseExpiry,
                      },
                      {
                        label: isAr ? "الفحص الطبي" : "Medical",
                        value: myCrewData.medicalExpiry
                          ? isAr
                            ? "ساري"
                            : "Valid"
                          : "N/A",
                        exp: myCrewData.medicalExpiry,
                      },
                      {
                        label: isAr ? "جواز السفر" : "Passport No",
                        value: myCrewData.passportNo,
                        exp: myCrewData.passportExpiry,
                      },
                    ].map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border"
                        style={{
                          backgroundColor: THEME.card,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        <div
                          className="font-bold text-sm"
                          style={{ color: THEME.text }}
                        >
                          {doc.label}
                        </div>
                        <div
                          className="text-sm font-mono tabular-nums mt-1"
                          style={{ color: THEME.textMuted }}
                        >
                          {doc.value || "—"}
                        </div>
                        {doc.exp && (
                          <div className="text-xs text-amber-500 font-mono tabular-nums mt-1">
                            {isAr ? "الانتهاء:" : "Expiry:"} {doc.exp}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {canSeeFiles && (
                  <div>
                    <h3
                      className="font-bold mb-3 flex items-center gap-2"
                      style={{ color: THEME.textMuted }}
                    >
                      <FileText className="w-5 h-5" />{" "}
                      {isAr ? "الملفات المرفقة" : "Attached Files"} (
                      {myAttachments.length})
                    </h3>

                    {(() => {
                      const expired = myAttachments.filter(
                        (d) => docStatus(d.expiry) === "expired"
                      ).length;
                      const critical = myAttachments.filter(
                        (d) => docStatus(d.expiry) === "critical"
                      ).length;
                      if (expired === 0 && critical === 0) return null;
                      return (
                        <div className="mb-3 space-y-2">
                          {expired > 0 && (
                            <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-lg text-rose-500 text-xs flex items-center gap-2 font-bold">
                              <ShieldAlert className="w-4 h-4" />
                              {expired}{" "}
                              {isAr
                                ? "مستند منتهي الصلاحية — يرجى التجديد"
                                : "expired document(s) — renewal required"}
                            </div>
                          )}
                          {critical > 0 && (
                            <div className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-500 text-xs flex items-center gap-2 font-bold">
                              <ShieldAlert className="w-4 h-4" />
                              {critical}{" "}
                              {isAr
                                ? "مستند ينتهي خلال 15 يوم"
                                : "document(s) expiring within 15 days"}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {myAttachments.length === 0 ? (
                      <div
                        className="text-center py-8 rounded-xl border"
                        style={{
                          backgroundColor: THEME.card,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        <FileText
                          className="w-10 h-10 mx-auto mb-2 opacity-50"
                          style={{ color: THEME.textMuted }}
                        />
                        <p
                          className="text-sm"
                          style={{ color: THEME.textMuted }}
                        >
                          {isAr ? "لا توجد ملفات مرفقة" : "No attached files"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myAttachments.map((doc, idx) => {
                          const st = docStatus(doc.expiry);
                          const days = daysUntil(doc.expiry);
                          const colorCls = getStatusColor(st);
                          const cardBorder =
                            st === "expired"
                              ? {
                                  borderColor: "#f43f5e",
                                  backgroundColor: "rgba(244,63,94,0.1)",
                                }
                              : st === "critical"
                              ? {
                                  borderColor: "#fb923c",
                                  backgroundColor: "rgba(251,146,60,0.1)",
                                }
                              : st === "expiring"
                              ? {
                                  borderColor: "#f59e0b",
                                  backgroundColor: "rgba(245,158,11,0.08)",
                                }
                              : {
                                  borderColor: THEME.borderLight,
                                  backgroundColor: THEME.card,
                                };

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border flex items-center justify-between gap-3 transition"
                              style={cardBorder}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      st === "expired"
                                        ? "rgba(244,63,94,0.2)"
                                        : st === "critical"
                                        ? "rgba(251,146,60,0.2)"
                                        : st === "expiring"
                                        ? "rgba(245,158,11,0.2)"
                                        : THEME.surfaceSubtle,
                                  }}
                                >
                                  <FileText
                                    className="w-5 h-5"
                                    style={{
                                      color:
                                        st === "expired"
                                          ? "#f43f5e"
                                          : st === "critical"
                                          ? "#fb923c"
                                          : st === "expiring"
                                          ? "#f59e0b"
                                          : THEME.text,
                                    }}
                                  />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div
                                    className="font-bold text-sm truncate"
                                    style={{ color: THEME.text }}
                                    title={doc.name}
                                  >
                                    {doc.name.replace(/\.[^/.]+$/, "")}
                                  </div>
                                  {doc.expiry && days !== null && (
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums"
                                        style={{
                                          backgroundColor: THEME.surfaceSubtle,
                                          color: THEME.textMuted,
                                        }}
                                      >
                                        {String(doc.expiry).slice(0, 10)}
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${colorCls}`}
                                      >
                                        {days < 0
                                          ? isAr
                                            ? `منتهي منذ ${Math.abs(days)} يوم`
                                            : `Expired ${Math.abs(days)}d ago`
                                          : days === 0
                                          ? isAr
                                            ? "ينتهي اليوم"
                                            : "Expires today"
                                          : isAr
                                          ? `${days} يوم متبقٍ`
                                          : `${days}d remaining`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {doc.url ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setPreviewDoc(doc)}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition"
                                    style={{
                                      backgroundColor: THEME.surfaceSubtle,
                                      color: THEME.text,
                                    }}
                                    title={isAr ? "عرض" : "Preview"}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canDownloadDocs && (
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={doc.name}
                                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition"
                                      style={{
                                        backgroundColor: THEME.surfaceSubtle,
                                        color: THEME.text,
                                      }}
                                      title={isAr ? "تحميل" : "Download"}
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-rose-500 italic">
                                  {isAr ? "رابط غير متاح" : "Unavailable"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {!canSeeFiles && (
                  <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-500 text-xs flex items-center gap-2 font-semibold">
                    <ShieldAlert className="w-4 h-4" />{" "}
                    {isAr
                      ? "ليس لديك صلاحية عرض الملفات المرفقة"
                      : "You do not have permission to view attached files"}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════ FTL ═══════════ */}
            {activeView === "ftl" && canSeeFTL && (
              <div
                className="rounded-xl p-3 border"
                style={{
                  backgroundColor: THEME.card,
                  borderColor: THEME.borderLight,
                }}
              >
                <FTLModule crew={[myCrewData]} flights={myFlights} />
              </div>
            )}

            {/* ═══════════ MANUALS ═══════════ */}
            {activeView === "manuals" && canSeeManuals && (
              <div
                className="rounded-xl p-3 border"
                style={{
                  backgroundColor: THEME.card,
                  borderColor: THEME.borderLight,
                }}
              >
                <ManualsModule
                  settings={settings}
                  companyName={settings?.companyName}
                  lang={lang}
                />
              </div>
            )}

            {/* ═══════════ HOURS ═══════════ */}
            {activeView === "hours" && canSeeHours && (
              <div className="space-y-4">
                <div>
                  <h3
                    className="font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2"
                    style={{ color: THEME.textMuted }}
                  >
                    <Activity
                      className="w-4 h-4"
                      style={{ color: THEME.success }}
                    />
                    {isAr ? "الإجمالي الكلي" : "All Time Totals"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Timer className="w-3.5 h-3.5 text-sky-500" />{" "}
                        {isAr ? "إجمالي البلوك" : "Total Block"}
                      </div>
                      <div
                        className="text-3xl font-black font-mono tabular-nums"
                        style={{ color: THEME.text }}
                      >
                        {totalHours.all.blockHM}
                      </div>
                    </div>

                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Plane className="w-3.5 h-3.5 text-emerald-500" />{" "}
                        {isAr ? "إجمالي الطيران" : "Total Flight"}
                      </div>
                      <div className="text-3xl font-black font-mono tabular-nums text-emerald-500">
                        {totalHours.all.flightHM}
                      </div>
                    </div>

                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Activity className="w-3.5 h-3.5 text-amber-500" />{" "}
                        {isAr ? "إجمالي القطاعات" : "Total Sectors"}
                      </div>
                      <div
                        className="text-3xl font-black font-mono tabular-nums"
                        style={{ color: THEME.accent }}
                      >
                        {totalHours.all.sectors}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter */}
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    backgroundColor: THEME.card,
                    borderColor: THEME.borderLight,
                  }}
                >
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3
                      className="font-bold text-sm flex items-center gap-2 uppercase tracking-wider"
                      style={{ color: THEME.text }}
                    >
                      <Calendar
                        className="w-4 h-4"
                        style={{ color: THEME.accent }}
                      />
                      {isAr ? "تصفية حسب الفترة" : "Filter by Period"}
                    </h3>
                    <div
                      className="text-xs font-mono tabular-nums"
                      style={{ color: THEME.textMuted }}
                    >
                      {totalHours.filteredCount}{" "}
                      {isAr
                        ? "رحلة"
                        : totalHours.filteredCount === 1
                        ? "flight"
                        : "flights"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "من" : "From"}
                      </label>
                      <input
                        type="date"
                        value={hoursFromDate}
                        onChange={(e) => setHoursFromDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-mono tabular-nums focus:outline-none border"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-bold uppercase block mb-1"
                        style={{ color: THEME.textMuted }}
                      >
                        {isAr ? "إلى" : "To"}
                      </label>
                      <input
                        type="date"
                        value={hoursToDate}
                        onChange={(e) => setHoursToDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-mono tabular-nums focus:outline-none border"
                        style={{
                          backgroundColor: THEME.bg,
                          borderColor: THEME.borderLight,
                          color: THEME.text,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { r: "thisMonth", l: isAr ? "هذا الشهر" : "This Month" },
                      { r: "last30", l: isAr ? "آخر 30 يوم" : "Last 30 Days" },
                      { r: "thisYear", l: isAr ? "هذه السنة" : "This Year" },
                      { r: "all", l: isAr ? "الكل" : "All Time" },
                    ].map((btn) => (
                      <button
                        key={btn.r}
                        onClick={() => setRange(btn.r)}
                        className="px-2 py-1.5 rounded-lg text-xs font-bold transition border"
                        style={{
                          backgroundColor: THEME.surfaceSubtle,
                          color: THEME.text,
                          borderColor: THEME.borderLight,
                        }}
                      >
                        {btn.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtered Totals */}
                <div>
                  <h3
                    className="font-bold mb-2 text-sm uppercase tracking-wider flex items-center gap-2"
                    style={{ color: THEME.textMuted }}
                  >
                    <Calendar
                      className="w-4 h-4"
                      style={{ color: THEME.info }}
                    />
                    {isAr ? "إجمالي الفترة المحددة" : "Filtered Totals"}
                    {totalHours.isFiltered && (
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums normal-case"
                        style={{
                          backgroundColor: `${THEME.accent}20`,
                          color: THEME.accent,
                        }}
                      >
                        {hoursFromDate || "—"} → {hoursToDate || "—"}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Plane className="w-3.5 h-3.5 text-emerald-500" />{" "}
                        {isAr ? "طيران (الفترة)" : "Flight (Filtered)"}
                      </div>
                      <div className="text-3xl font-black font-mono tabular-nums text-emerald-500">
                        {totalHours.filtered.flightHM}
                      </div>
                    </div>

                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Timer className="w-3.5 h-3.5 text-sky-500" />{" "}
                        {isAr ? "بلوك (الفترة)" : "Block (Filtered)"}
                      </div>
                      <div
                        className="text-3xl font-black font-mono tabular-nums"
                        style={{ color: THEME.text }}
                      >
                        {totalHours.filtered.blockHM}
                      </div>
                    </div>

                    <div
                      className="p-5 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <div
                        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-2"
                        style={{ color: THEME.textMuted }}
                      >
                        <Activity className="w-3.5 h-3.5 text-amber-500" />{" "}
                        {isAr ? "قطاعات (الفترة)" : "Sectors (Filtered)"}
                      </div>
                      <div
                        className="text-3xl font-black font-mono tabular-nums"
                        style={{ color: THEME.accent }}
                      >
                        {totalHours.filtered.sectors}
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Time by Position */}
                {Object.keys(totalHours.all.byPosition).length > 0 && (
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: THEME.card,
                      borderColor: THEME.borderLight,
                    }}
                  >
                    <h3
                      className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider"
                      style={{ color: THEME.text }}
                    >
                      <Target
                        className="w-4 h-4"
                        style={{ color: THEME.info }}
                      />
                      {isAr ? "الإجمالي حسب الوظيفة" : "All Time — By Position"}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {Object.entries(totalHours.all.byPosition)
                        .sort(
                          ([a], [b]) =>
                            POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)
                        )
                        .map(([pos, data]) => (
                          <div
                            key={pos}
                            className="rounded-xl p-3 border"
                            style={{
                              backgroundColor: THEME.surfaceSubtle,
                              borderColor: THEME.borderLight,
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className="font-bold font-mono text-sm"
                                style={{ color: THEME.text }}
                              >
                                {pos}
                              </span>
                              <span
                                className="text-[10px] font-mono tabular-nums"
                                style={{ color: THEME.textMuted }}
                              >
                                {data.sectors} sec
                              </span>
                            </div>
                            <div
                              className="text-xl font-black font-mono tabular-nums"
                              style={{ color: THEME.text }}
                            >
                              {(() => {
                                const h = Math.floor(data.blockMin / 60);
                                const m = data.blockMin % 60;
                                return `${h}h ${String(m).padStart(2, "0")}m`;
                              })()}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Filtered by Position */}
                {totalHours.isFiltered &&
                  Object.keys(totalHours.filtered.byPosition).length > 0 && (
                    <div
                      className="p-4 rounded-xl border"
                      style={{
                        backgroundColor: THEME.card,
                        borderColor: THEME.borderLight,
                      }}
                    >
                      <h3
                        className="font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider"
                        style={{ color: THEME.text }}
                      >
                        <Calendar
                          className="w-4 h-4"
                          style={{ color: THEME.info }}
                        />
                        {isAr
                          ? "الفترة المحددة — حسب الوظيفة"
                          : "Filtered — By Position"}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Object.entries(totalHours.filtered.byPosition)
                          .sort(
                            ([a], [b]) =>
                              POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)
                          )
                          .map(([pos, data]) => (
                            <div
                              key={pos}
                              className="rounded-xl p-3 border"
                              style={{
                                backgroundColor: THEME.surfaceSubtle,
                                borderColor: THEME.borderLight,
                              }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className="font-bold font-mono text-sm"
                                  style={{ color: THEME.text }}
                                >
                                  {pos}
                                </span>
                                <span
                                  className="text-[10px] font-mono tabular-nums"
                                  style={{ color: THEME.textMuted }}
                                >
                                  {data.sectors} sec
                                </span>
                              </div>
                              <div
                                className="text-xl font-black font-mono tabular-nums"
                                style={{ color: THEME.text }}
                              >
                                {(() => {
                                  const h = Math.floor(data.blockMin / 60);
                                  const m = data.blockMin % 60;
                                  return `${h}h ${String(m).padStart(2, "0")}m`;
                                })()}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Flight Details Modal (My Schedule) ═══ */}
      {selectedFlight && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setSelectedFlight(null)}
        >
          <div
            className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.borderLight}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 flex items-center justify-between sticky top-0"
              style={{ background: THEME.gradient, color: "white" }}
            >
              <div className="flex items-center gap-2">
                <Plane className="w-5 h-5" />
                <span className="font-black font-mono text-lg">
                  {selectedFlight.flightNo}
                </span>
              </div>
              <button
                onClick={() => setSelectedFlight(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-center">
                <div className="flex-1">
                  <div
                    className="text-3xl font-black font-mono"
                    style={{ color: THEME.text }}
                  >
                    {selectedFlight.dep || "—"}
                  </div>
                  <div
                    className="text-[10px] uppercase font-bold mt-0.5"
                    style={{ color: THEME.textMuted }}
                  >
                    Departure
                  </div>
                  <div
                    className="text-lg font-bold font-mono tabular-nums mt-1"
                    style={{ color: THEME.accent }}
                  >
                    {fmtHM(selectedFlight.std)}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: THEME.textMuted }}
                  >
                    {fmtShortDate(selectedFlight.std)}
                  </div>
                </div>

                <div className="flex flex-col items-center px-3">
                  <Plane
                    className="w-5 h-5"
                    style={{ color: THEME.accent, transform: "rotate(90deg)" }}
                  />
                  <div
                    className="text-[10px] font-mono tabular-nums mt-1"
                    style={{ color: THEME.textMuted }}
                  >
                    {calcDuration(selectedFlight.std, selectedFlight.sta)}
                  </div>
                </div>

                <div className="flex-1">
                  <div
                    className="text-3xl font-black font-mono"
                    style={{ color: THEME.text }}
                  >
                    {selectedFlight.arr || "—"}
                  </div>
                  <div
                    className="text-[10px] uppercase font-bold mt-0.5"
                    style={{ color: THEME.textMuted }}
                  >
                    Arrival
                  </div>
                  <div
                    className="text-lg font-bold font-mono tabular-nums mt-1"
                    style={{ color: THEME.accent }}
                  >
                    {fmtHM(selectedFlight.sta)}
                  </div>
                  <div
                    className="text-[10px]"
                    style={{ color: THEME.textMuted }}
                  >
                    {fmtShortDate(selectedFlight.sta)}
                  </div>
                </div>
              </div>

              <div
                className="border-t border-dashed"
                style={{ borderColor: THEME.borderLight }}
              />

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className="p-2.5 rounded-lg"
                  style={{ backgroundColor: THEME.surfaceSubtle }}
                >
                  <div
                    className="text-[10px] uppercase"
                    style={{ color: THEME.textMuted }}
                  >
                    {isAr ? "الطائرة" : "Aircraft"}
                  </div>
                  <div
                    className="font-bold font-mono mt-0.5"
                    style={{ color: THEME.text }}
                  >
                    {selectedFlight.acft || "—"}
                  </div>
                </div>
                <div
                  className="p-2.5 rounded-lg"
                  style={{ backgroundColor: THEME.surfaceSubtle }}
                >
                  <div
                    className="text-[10px] uppercase"
                    style={{ color: THEME.textMuted }}
                  >
                    {isAr ? "وظيفتي" : "My Position"}
                  </div>
                  <div
                    className="font-bold font-mono mt-0.5"
                    style={{ color: THEME.accent }}
                  >
                    {getMyPosition(selectedFlight)}
                  </div>
                </div>
              </div>

              <div>
                <div
                  className="text-[10px] uppercase font-bold mb-1"
                  style={{ color: THEME.textMuted }}
                >
                  {isAr ? "الطاقم" : "Crew"} (
                  {(selectedFlight.crewSlots || []).length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedFlight.crewSlots || []).map((slot, i) => {
                    const m = crew.find((c) => c.id === slot.crewId);
                    if (!m) return null;
                    const isMe = m.id === myCrewData.id;
                    return (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md text-[10px] font-mono font-bold border"
                        style={{
                          backgroundColor: isMe
                            ? `${THEME.accent}25`
                            : THEME.surfaceSubtle,
                          color: isMe ? THEME.accent : THEME.text,
                          borderColor: isMe ? THEME.accent : THEME.borderLight,
                        }}
                        title={`${m.fullName} (${slot.position})`}
                      >
                        {m.empNo || m.fullName?.slice(0, 6)}
                        <span className="ms-1 opacity-75">
                          {POS_SHORT_MAP[slot.position] || slot.position}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ backgroundColor: THEME.surfaceSubtle }}
              >
                <span
                  className="text-[10px] uppercase font-bold"
                  style={{ color: THEME.textMuted }}
                >
                  {isAr ? "الحالة" : "Status"}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-md text-[10px] font-bold border"
                  style={{
                    backgroundColor: `${
                      getStatusColorHex(selectedFlight.status) || THEME.accent
                    }20`,
                    color:
                      getStatusColorHex(selectedFlight.status) || THEME.accent,
                    borderColor:
                      getStatusColorHex(selectedFlight.status) || THEME.accent,
                  }}
                >
                  {selectedFlight.status || "SCHEDULED"}
                </span>
              </div>

              {selectedFlight.notes && (
                <div
                  className="p-2.5 rounded-lg text-xs"
                  style={{
                    backgroundColor: THEME.surfaceSubtle,
                    color: THEME.textMuted,
                  }}
                >
                  {selectedFlight.notes}
                </div>
              )}

              {canEditCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedFlight;
                    setSelectedFlight(null);
                    setEditingCompletedFlight(target);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isAr
                      ? "إكمال / تعديل أوقات الرحلة (24H)"
                      : "Complete / Edit Flight Times (24H)"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Full-Screen 24H Complete Flight Modal ═══ */}
      {editingCompletedFlight && canEditCompleted && (
        <CompleteFlightModal
          flight={editingCompletedFlight}
          fleet={fleet}
          crew={crew}
          onClose={() => setEditingCompletedFlight(null)}
          onSave={saveCompletedFlightInPortal}
        />
      )}

      {/* ═══ File Preview Modal ═══ */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            style={{
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.borderLight}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-3 flex items-center justify-between"
              style={{ background: THEME.gradient, color: "white" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span className="font-bold text-sm truncate">
                  {previewDoc.name.replace(/\.[^/.]+$/, "")}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg hover:bg-white/20 transition flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative">
              {/\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.name || "") &&
              toDisplayImageUrl(previewDoc.url) ? (
                <img
                  src={toDisplayImageUrl(previewDoc.url)}
                  alt={previewDoc.name}
                  className="w-full h-full object-contain"
                />
              ) : previewDoc.url ? (
                <PdfCanvasViewer
                  pdfData={previewDoc.url}
                  title={previewDoc.name || "Document Preview"}
                  fileName={previewDoc.name || "document.pdf"}
                  maxHeight="100%"
                  className="w-full h-full border-0"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6 text-sm text-slate-500">
                  لا يتوفر رابط صالح لمعاينة هذا المستند
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══ Personal Password Change Modal (Current Member Only) ═══ */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => {
            if (!pwdSaving) setPasswordModalOpen(false);
          }}
        >
          <div
            className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              backgroundColor: THEME.card,
              border: `1px solid ${THEME.borderLight}`,
              color: THEME.text,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 flex items-start justify-between gap-3"
              style={{ borderBottom: `1px solid ${THEME.borderLight}` }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Lock
                    className="w-4 h-4 shrink-0"
                    style={{ color: THEME.accent }}
                  />
                  <h3
                    className="font-bold text-base leading-tight truncate"
                    style={{ color: THEME.text }}
                  >
                    {isAr ? "تغيير كلمة المرور" : "Change My Password"}
                  </h3>
                </div>
                <div
                  className="mt-1 flex items-center gap-1.5 text-xs truncate"
                  style={{ color: THEME.textMuted }}
                >
                  <span className="truncate font-medium">
                    {myOwnUserObj?.fullName ||
                      targetUser?.fullName ||
                      myOwnUserObj?.username ||
                      "User"}
                  </span>
                  {(myOwnUserObj?.username || targetUser?.username) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono truncate">
                        @{myOwnUserObj?.username || targetUser?.username}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pwdSaving) setPasswordModalOpen(false);
                }}
                className="p-1.5 rounded-lg transition shrink-0"
                style={{
                  backgroundColor: THEME.surfaceSubtle,
                  color: THEME.textMuted,
                }}
                aria-label={isAr ? "إغلاق" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePassword} className="p-5 space-y-4">
              {hasExistingPassword && (
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: THEME.text }}
                  >
                    {isAr ? "كلمة المرور الحالية" : "Current Password"}
                  </label>
                  <input
                    type={showPasswordText ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (pwdError) setPwdError("");
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full text-sm font-mono px-3.5 py-2.5 rounded-xl border focus:outline-none transition"
                    style={{
                      backgroundColor: THEME.surfaceSubtle,
                      borderColor: THEME.borderLight,
                      color: THEME.text,
                    }}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: THEME.text }}
                  >
                    {isAr ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordText((v) => !v)}
                    className="text-xs font-medium flex items-center gap-1 transition whitespace-nowrap"
                    style={{ color: THEME.textMuted }}
                  >
                    {showPasswordText ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{isAr ? "إخفاء" : "Hide"}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isAr ? "إظهار" : "Show"}</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type={showPasswordText ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (pwdError) setPwdError("");
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full text-sm font-mono px-3.5 py-2.5 rounded-xl border focus:outline-none transition"
                  style={{
                    backgroundColor: THEME.surfaceSubtle,
                    borderColor: THEME.borderLight,
                    color: THEME.text,
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: THEME.text }}
                >
                  {isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}
                </label>
                <input
                  type={showPasswordText ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (pwdError) setPwdError("");
                  }}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="w-full text-sm font-mono px-3.5 py-2.5 rounded-xl border focus:outline-none transition"
                  style={{
                    backgroundColor: THEME.surfaceSubtle,
                    borderColor: THEME.borderLight,
                    color: THEME.text,
                  }}
                />
              </div>

              {pwdError && (
                <div className="px-3 py-2.5 rounded-xl text-xs bg-rose-500/10 border border-rose-500/25 text-rose-500 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <div className="pt-1 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={pwdSaving}
                  onClick={() => setPasswordModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border font-semibold text-xs transition whitespace-nowrap disabled:opacity-50"
                  style={{
                    backgroundColor: THEME.surfaceSubtle,
                    borderColor: THEME.borderLight,
                    color: THEME.textMuted,
                  }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="flex-1 py-2.5 px-4 rounded-xl text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap disabled:opacity-50"
                  style={{ background: THEME.gradient }}
                >
                  {pwdSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {pwdSaving
                      ? isAr
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : isAr
                      ? "حفظ كلمة المرور"
                      : "Save Password"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ PortalCard ═══ */
function PortalCard({
  icon: Icon,
  threeDIcon,
  label,
  subLabel,
  onClick,
  badge,
  badgeColor = "emerald",
  THEME,
  darkMode = false,
}) {
  const badgeCls =
    badgeColor === "emerald"
      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/30"
      : badgeColor === "rose"
      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-500/30"
      : "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sky-500/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-[1/1] rounded-2xl flex flex-col items-center justify-between p-4 sm:p-5 transition-all duration-300 border group overflow-hidden text-center cursor-pointer select-none active:scale-[0.97]"
      style={{
        backgroundColor: THEME.card,
        borderColor: THEME.borderLight,
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = THEME.accent;
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 12px 28px -4px ${THEME.accent}25`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = THEME.borderLight;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 20px -2px rgba(0, 0, 0, 0.05)";
      }}
    >
      {/* Background ambient light */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${THEME.accent}15 0%, transparent 70%)`,
        }}
      />

      {/* Top right badge if present */}
      {badge != null && badge > 0 ? (
        <span
          className={`absolute top-3 end-3 ${badgeCls} text-[10px] font-bold font-mono tabular-nums rounded-full min-w-[22px] h-5 px-2 flex items-center justify-center shadow-md z-10`}
        >
          {badge}
        </span>
      ) : null}

      <div className="w-full flex-1 flex flex-col items-center justify-center pt-1 z-10">
        {/* Modern 3D Icon Box */}
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110 shadow-sm relative"
          style={{
            background: darkMode
              ? `linear-gradient(135deg, ${THEME.accent}25 0%, rgba(255, 255, 255, 0.03) 100%)`
              : `linear-gradient(135deg, ${THEME.accent}18 0%, ${THEME.accent}05 100%)`,
            border: `1px solid ${THEME.accent}35`,
            boxShadow: `0 8px 20px -6px ${THEME.accent}25`,
          }}
        >
          {threeDIcon ? (
            <ThreeDIcon
              name={threeDIcon}
              size={46}
              theme={THEME}
              darkMode={darkMode}
              interactive={false}
            />
          ) : Icon ? (
            <Icon
              className="w-7 h-7 sm:w-8 sm:h-8 transition-colors duration-300"
              style={{ color: THEME.accent }}
              strokeWidth={1.8}
            />
          ) : null}
        </div>

        {/* Label */}
        <span
          className="text-xs sm:text-sm font-bold text-center leading-tight tracking-tight max-w-full truncate px-1"
          style={{ color: THEME.text }}
        >
          {label}
        </span>
      </div>

      {/* Sublabel */}
      {subLabel && (
        <span
          className="text-[10px] sm:text-[11px] font-medium text-center line-clamp-1 w-full opacity-85 z-10 pt-1 border-t"
          style={{
            color: THEME.textMuted,
            borderColor: THEME.borderLight,
          }}
        >
          {subLabel}
        </span>
      )}
    </button>
  );
}

export default CrewPortal;
