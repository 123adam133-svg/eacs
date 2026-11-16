/* ═══════════════════════════════════════════════════════════
 * SCHEDULE BOARD — Multi-Sector + 24H Time Input
 * v7.7 — Fixed ft.icon Component in TYPE column + Select
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Search,
  Save,
  Lock,
  ShieldAlert,
  Table,
  CalendarDays,
  List,
  MoreVertical,
  PlaneTakeoff,
  Plane,
  Edit,
  Loader2,
  RotateCw,
  Send,
  Users,
  AlertOctagon,
  Copy,
  FileText,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Time24Input } from "../components/ui/Time24Input";
import { AirportInput } from "../components/AirportInput";
import { FlightContextMenu } from "../components/FlightContextMenu";
import { FlightNotesModal } from "../components/FlightNotesModal";
import { CompleteFlightModal } from "../components/CompleteFlightModal";
import { OperationalFormFillModal } from "../components/OperationalFormFillModal";
import { GenDecMultiModal } from "../components/GenDecMultiModal";
import { BulkEditLegsModal } from "../components/BulkEditLegsModal";
import { CrewContactCard, getCrewDailyFtlStats } from "../components/CrewContactCard";
import { AirportHoverCard } from "../components/AirportHoverCard";
import { FlightOpsDrawer } from "../components/FlightOpsDrawer";
import { CalendarView } from "./CalendarView";
import { TimelineView } from "./TimelineView";
import {
  flightsAPI,
  settingsAPI,
  sendFlightEmail,
  checkExpiryAlerts,
  writeSheetCache,
} from "../api";
import { listOperationalFormsSync } from "../utils/operationalFormsService";
import { triggerFlightWhatsAppNotifications } from "../utils/whatsapp";
import { logSafe, buildFlightHistorySnapshot } from "../utils/audit";
import { can as checkPerm } from "../config/permissions";
import { alertSuccess, alertError } from "../utils/sounds";
import { notifyFlightChange, notifyCrewChange } from "../utils/notifications";
import { findAirportDetails } from "../utils/airportDatabase";
import {
  DEFAULT_SCHEDULE_DESIGN,
  SCHEDULE_DESIGN_EVENT,
  getScheduleDesign,
} from "../utils/scheduleDesigns";
import { normalizeDelayCode } from "../config/delayCodes";
import {
  fmtTime,
  fmtDateParts,
  todayISO,
  safeArray,
  safeObject,
} from "../utils/helpers";
import {
  getAllowedRoles,
  getPositionOptions,
  FLIGHT_TYPES,
  getFlightType,
  FLIGHT_STATUSES,
  getFlightStatus,
} from "../config/constants";
import { printGenDec } from "../utils/gendecHTML";
import { showToast, confirmAction } from "../utils/dialog";

/* ═══════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════ */
function getCrewAssignedAircrafts(member) {
  if (!member) return [];
  const raw = member.assignedAircraft;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function getMemberAllRoles(member) {
  if (!member) return [];
  const roles = new Set();
  if (member.role) roles.add(member.role);
  let sec = member.secondaryRoles;
  if (Array.isArray(sec)) {
    sec.forEach((r) => r && roles.add(r));
  } else if (typeof sec === "string" && sec.trim()) {
    try {
      const parsed = JSON.parse(sec);
      if (Array.isArray(parsed)) parsed.forEach((r) => r && roles.add(r));
    } catch {
      sec.split(",").forEach((r) => r && roles.add(r.trim()));
    }
  }
  return Array.from(roles);
}

function isCrewQualifiedForAircraft(member, aircraftReg) {
  if (!member) return false;
  if (!aircraftReg || !String(aircraftReg).trim()) return true;
  const primaryRole = String(member.role || "")
    .toLowerCase()
    .trim();
  if (primaryRole === "flightdispatcher" || primaryRole === "dispatcher")
    return true;
  const assigned = getCrewAssignedAircrafts(member).map((a) =>
    String(a).trim().toUpperCase()
  );
  if (assigned.length === 0) return false;
  return assigned.includes(String(aircraftReg).trim().toUpperCase());
}

export const computeAutoStatus = (flight) => {
  const actual = flight?.actual || {};
  const hasStd = actual.std && String(actual.std).trim().length > 0;
  const hasSta = actual.sta && String(actual.sta).trim().length > 0;
  const hasCancel =
    actual.cancelled === true ||
    (actual.reason && String(actual.reason).trim().length > 0);
  if (hasCancel) return "CANCELLED";
  if (flight?.statusManual && flight?.status) return flight.status;
  if (flight?.status && flight.status !== "SCHEDULED") return flight.status;
  if (hasSta) return "ARRIVED";
  if (hasStd) return "DEPARTED";
  return flight?.status || "SCHEDULED";
};

function resolveLegCrewSlots(flight, leg) {
  if (!leg) return safeArray(flight?.crewSlots);
  if (Array.isArray(leg.crewSlots)) return leg.crewSlots;
  return safeArray(flight?.crewSlots);
}

function addMinutesHHMM(hhmm, deltaMinutes) {
  const [h, m] = normalizeHHMM(hhmm, "12:00").split(":").map(Number);
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function getFlightStatusBadgeClasses(statusKey, isDarkSurface = false) {
  switch (String(statusKey || "SCHEDULED").toUpperCase()) {
    case "CONFIRMED":
      return isDarkSurface
        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
        : "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/35";
    case "BOARDING":
      return isDarkSurface
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
    case "DEPARTED":
      return isDarkSurface
        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
        : "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/35";
    case "IN_FLIGHT":
      return isDarkSurface
        ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
        : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40";
    case "ARRIVED":
      return isDarkSurface
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
        : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/35";
    case "DELAYED":
      return isDarkSurface
        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
        : "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40";
    case "CANCELLED":
      return isDarkSurface
        ? "bg-rose-500/25 text-rose-300 border-rose-500/50"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40";
    default:
      return isDarkSurface
        ? "bg-slate-700/60 text-slate-200 border-slate-600"
        : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30";
  }
}

function normalizeHHMM(val, fallback = "12:00") {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return s.slice(11, 16);
  }
  const colonMatch = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (colonMatch) {
    const hh = Math.min(23, Math.max(0, parseInt(colonMatch[1], 10) || 0));
    const mm = Math.min(59, Math.max(0, parseInt(colonMatch[2], 10) || 0));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length >= 3) {
    const hh =
      digits.length === 3
        ? Math.min(23, parseInt(digits.slice(0, 1), 10) || 0)
        : Math.min(23, parseInt(digits.slice(0, 2), 10) || 0);
    const mm =
      digits.length === 3
        ? Math.min(59, parseInt(digits.slice(1, 3), 10) || 0)
        : Math.min(59, parseInt(digits.slice(2, 4), 10) || 0);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}`;
  }
  return fallback;
}

function extractIsoDate(val, fallbackDate) {
  if (!val) return fallbackDate;
  const s = String(val).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return fallbackDate;
}

function buildSectorIsoPair(dateStr, rawStd, rawSta) {
  const safeDate = extractIsoDate(dateStr, todayISO());
  const stdHHMM = normalizeHHMM(rawStd, "12:00");
  const staHHMM = normalizeHHMM(rawSta, "13:30");
  const stdIso = `${safeDate}T${stdHHMM}:00.000Z`;

  let staDate = safeDate;
  if (staHHMM < stdHHMM) {
    const nextDay = new Date(`${safeDate}T00:00:00.000Z`);
    if (!isNaN(nextDay.getTime())) {
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      staDate = nextDay.toISOString().slice(0, 10);
    }
  }
  const staIso = `${staDate}T${staHHMM}:00.000Z`;
  return { stdIso, staIso, stdHHMM, staHHMM, safeDate };
}

function normalizeLegForEdit(leg, fallbackDate) {
  const date = leg.date
    ? extractIsoDate(leg.date, fallbackDate)
    : extractIsoDate(leg.std, fallbackDate);
  const std = normalizeHHMM(leg.std, "12:00");
  const sta = normalizeHHMM(leg.sta, "13:30");
  const flightNature = leg.flightNature || (Number(leg.pax) > 0 ? "PAX" : "FERRY");
  return {
    ...leg,
    flightNo: leg.flightNo || "",
    flightNature,
    pax: leg.pax !== undefined && leg.pax !== null ? leg.pax : (flightNature === "FERRY" ? 0 : ""),
    date,
    std,
    sta,
  };
}

function calcDuration24(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return { hhmm: "00:00", minutes: 0 };
  const [sh, sm] = String(startHHMM).split(":").map(Number);
  const [eh, em] = String(endHHMM).split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) {
    return { hhmm: "00:00", minutes: 0 };
  }
  let min = eh * 60 + em - (sh * 60 + sm);
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return {
    hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    minutes: min,
  };
}

/* ⭐ v7.7 — عرض أيقونة نوع الرحلة (Component أو Emoji) */
function FlightTypeIcon({ ft, size = "w-3.5 h-3.5" }) {
  if (!ft) return null;
  if (typeof ft.icon === "function") {
    const Icon = ft.icon;
    return <Icon className={size} />;
  }
  if (typeof ft.icon === "string") {
    return <span className="text-[11px] leading-none">{ft.icon}</span>;
  }
  return null;
}

export function ScheduleBoard({
  flights,
  setFlights,
  reloadFlights,
  crew,
  fleet,
  camoList = [],
  settings,
  setSettings,
  onGenDec,
  setSyncStatus,
}) {
  const t = useT();
  const { user } = useAuth();
  const isAr = (t?.locale || "ar") === "ar";

  const POSITION_OPTIONS = useMemo(
    () => getPositionOptions(settings),
    [settings]
  );
  const ALL_COLUMN_POSITIONS = useMemo(
    () => POSITION_OPTIONS.map((p) => p.key),
    [POSITION_OPTIONS]
  );
  const POSITION_LABELS = useMemo(() => {
    const map = {};
    POSITION_OPTIONS.forEach((p) => {
      map[p.key] = {
        short: p.short || p.key.toUpperCase(),
        full: p.en || p.key,
      };
    });
    return map;
  }, [POSITION_OPTIONS]);

  const canCreate = checkPerm(user, "schedule.create");
  const canEdit = checkPerm(user, "schedule.edit");
  const canDelete = checkPerm(user, "schedule.delete");
  const canAssignCrew = checkPerm(user, "schedule.assign_crew");
  const canViewForms = checkPerm(user, "forms.view");
  const canViewTripHistory = checkPerm(user, "schedule.trip_history");
  const canEditJl = checkPerm(user, "schedule.jl_edit");

  /* ═══ State ═══ */
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});
  const [modalCrewSectorIdx, setModalCrewSectorIdx] = useState(-1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitialTab, setDrawerInitialTab] = useState("flight");
  const [drawerInitialCrewId, setDrawerInitialCrewId] = useState(null);
  const [drawerLegIdx, setDrawerLegIdx] = useState(-1);
  const [viewMode, setViewMode] = useState("table");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [airportsTick, setAirportsTick] = useState(0);
  const [scheduleDesign, setScheduleDesign] = useState(() =>
    getScheduleDesign(
      settings?.scheduleDesign ||
        settings?.tabPreferences?.__scheduleDesign ||
        DEFAULT_SCHEDULE_DESIGN
    )
  );
  const [timeMode, setTimeMode] = useState(() => {
    return (
      (settings && settings.timeMode ? String(settings.timeMode).toUpperCase() : null) ||
      (typeof window !== "undefined" && window.__AEROOPS_TIME_MODE) ||
      (typeof window !== "undefined" && window.localStorage?.getItem("aeroops.timeMode")?.toUpperCase()) ||
      "UTC"
    );
  });

  useEffect(() => {
    if (settings?.timeMode) {
      setTimeMode(String(settings.timeMode).toUpperCase());
    }
  }, [settings?.timeMode]);

  useEffect(() => {
    const incoming = settings?.scheduleDesign || settings?.tabPreferences?.__scheduleDesign;
    if (incoming) {
      setScheduleDesign(getScheduleDesign(incoming));
    }
  }, [settings?.scheduleDesign, settings?.tabPreferences?.__scheduleDesign]);

  useEffect(() => {
    const onTmChange = (e) => {
      const next = e?.detail || window.__AEROOPS_TIME_MODE || "UTC";
      setTimeMode(String(next).toUpperCase());
    };
    const onDesignChange = (e) => {
      const next = e?.detail?.design;
      if (next) setScheduleDesign(getScheduleDesign(next));
    };
    const onAirportsChange = () => setAirportsTick((v) => v + 1);
    window.addEventListener("aeroops:timeModeChanged", onTmChange);
    window.addEventListener(SCHEDULE_DESIGN_EVENT, onDesignChange);
    window.addEventListener("aeroops:airportsChanged", onAirportsChange);
    return () => {
      window.removeEventListener("aeroops:timeModeChanged", onTmChange);
      window.removeEventListener(SCHEDULE_DESIGN_EVENT, onDesignChange);
      window.removeEventListener("aeroops:airportsChanged", onAirportsChange);
    };
  }, []);

  const [rangeDays, setRangeDays] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [acftFilter, setAcftFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [completeFlight, setCompleteFlight] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [activeOpFormModal, setActiveOpFormModal] = useState(null);

  // Modals
  const [genDecMultiFlights, setGenDecMultiFlights] = useState(null);
  const [bulkEditLegsFlights, setBulkEditLegsFlights] = useState(null);

  /* ═══ Helpers ═══ */
  const now = new Date();
  const getFlightTime = (f) => {
    if (!f?.std) return null;
    const d = new Date(f.std);
    return isNaN(d.getTime()) ? null : d;
  };

  const isCompleted = (target) => {
    const a = target?.actual || {};
    const hasStd = a.std && String(a.std).trim().length > 0;
    const hasSta = a.sta && String(a.sta).trim().length > 0;
    const isCancelled = a.cancelled === true;
    return hasStd && hasSta && !isCancelled;
  };

  const isUpcoming = (target) => {
    const ft = getFlightTime(target);
    return ft ? ft.getTime() > now.getTime() - 30 * 60 * 1000 : false;
  };

  const isPast = (target) => {
    if (isCompleted(target)) return false;
    const ft = getFlightTime(target);
    return ft ? ft.getTime() <= now.getTime() - 30 * 60 * 1000 : false;
  };

  const getDateRange = () => {
    const start = new Date(selectedDate + "T00:00:00Z");
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + rangeDays);
    return { start, end };
  };

  const isInRange = (f) => {
    const ft = getFlightTime(f);
    if (!ft) return false;
    const { start, end } = getDateRange();
    return ft >= start && ft < end;
  };

  const shiftDate = (days) => {
    const d = new Date(selectedDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };
  const goToday = () => setSelectedDate(todayISO());

  /* ═══ Filtering ═══ */
  const filtered = flights
    .filter((f) => {
      if (!isInRange(f)) return false;
      const legText = safeArray(f.legs)
        .map((l) => `${l.flightNo || ""} ${l.dep || ""} ${l.arr || ""}`)
        .join(" ");
      const haystack = `${f.flightNo || ""} ${f.dep || ""} ${f.arr || ""} ${
        f.acft || ""
      } ${legText}`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter) {
        const mainMatch = computeAutoStatus(f) === statusFilter;
        const legMatch = safeArray(f.legs).some((l) => computeAutoStatus(l) === statusFilter);
        if (!mainMatch && !legMatch) return false;
      }
      if (acftFilter && f.acft !== acftFilter) return false;
      if (typeFilter && f.flightType !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = getFlightTime(a)?.getTime() || 0;
      const tb = getFlightTime(b)?.getTime() || 0;
      return ta - tb;
    });

  /* ═══ Build Independent Sector Rows ═══ */
  const rowsToDisplay = useMemo(() => {
    const rows = [];
    filtered.forEach((f) => {
      const mainNature = f.flightNature || f.nature || (Number(f.pax) > 0 ? "PAX" : "FERRY");
      const mainDate = extractIsoDate(f.std, selectedDate || todayISO());
      let legs = [];
      if (Array.isArray(f.legs)) legs = f.legs;
      else if (typeof f.legs === "string" && f.legs.trim()) {
        try {
          const p = JSON.parse(f.legs);
          if (Array.isArray(p)) legs = p;
        } catch {}
      }

      rows.push({
        key: f.id + "-main",
        flight: f,
        isMain: true,
        legIdx: -1,
        sectorNumber: 1,
        legCount: 1 + legs.length,
        date: mainDate,
        flightNo: f.flightNo,
        flightType: f.flightType || "SCHEDULED",
        flightNature: mainNature,
        pax: f.pax,
        dep: f.dep,
        arr: f.arr,
        altn: f.altn || "",
        cargo: f.cargo ?? 0,
        std: f.std,
        sta: f.sta,
        acft: f.acft,
        status: computeAutoStatus(f),
        notes: f.notes || "",
        permits: f.permits || "",
        services: f.services || "",
        actual: safeObject(f.actual),
        crewSlots: safeArray(f.crewSlots),
      });

      legs.forEach((leg, idx) => {
        const legNature = leg.flightNature || mainNature;
        const legDate = extractIsoDate(leg.std || leg.date, mainDate);
        rows.push({
          key: f.id + "-leg-" + idx,
          flight: f,
          isMain: false,
          legIdx: idx,
          sectorNumber: idx + 2,
          legCount: 1 + legs.length,
          date: legDate,
          flightNo: leg.flightNo || f.flightNo,
          flightType: leg.flightType || f.flightType || "SCHEDULED",
          flightNature: legNature,
          pax: leg.pax !== undefined ? leg.pax : (legNature === "FERRY" ? 0 : f.pax),
          dep: leg.dep || "",
          arr: leg.arr || "",
          altn: leg.altn || "",
          cargo: leg.cargo ?? 0,
          std: leg.std || "",
          sta: leg.sta || "",
          acft: leg.acft || f.acft || "",
          status: computeAutoStatus(leg),
          notes: leg.notes || "",
          permits: leg.permits || "",
          services: leg.services || "",
          actual: safeObject(leg.actual),
          crewSlots: resolveLegCrewSlots(f, leg),
        });
      });
    });
    return rows;
  }, [filtered, selectedDate]);

  /* ═══ Airport NOTAM lookup cache tied to airportsTick ═══ */
  const airportDetailsMap = useMemo(() => {
    const map = {};
    rowsToDisplay.forEach((r) => {
      [r.dep, r.arr].forEach((code) => {
        const up = String(code || "").trim().toUpperCase();
        if (up && !map[up]) {
          map[up] = findAirportDetails(up);
        }
      });
    });
    return map;
  }, [rowsToDisplay, airportsTick]);

  const POS_ALIAS_MAP = useMemo(() => ({
    CPT: "captain",
    CAPTAIN: "captain",
    PIC: "captain",
    FO: "firstOfficer",
    FIRSTOFFICER: "firstOfficer",
    COPILOT: "firstOfficer",
    OBS: "observer",
    OBSERVER: "observer",
    TRI: "tri",
    INS: "tri",
    INSTRUCTOR: "tri",
    SP: "firstOfficer",
    SAFETYPILOT: "firstOfficer",
    UTR: "firstOfficer",
    UNDERTRAINING: "firstOfficer",
    FA1: "fa1",
    FA2: "fa2",
    FA3: "flightAttendant",
    IFA: "flightAttendant",
    FA4: "flightAttendant",
    FLIGHTATTENDANT: "flightAttendant",
    ENG1: "engineer",
    ENG2: "engineer",
    ENGINEER: "engineer",
    ENGINEER2: "engineer",
    SEC: "security",
    SECURITY: "security",
    LMC: "loadmaster",
    LTC: "loadmaster",
    LOADMASTER: "loadmaster",
    FD: "flightDispatcher",
    FLIGHTDISPATCHER: "flightDispatcher",
  }), []);

  const normalizeSchedulePosKey = (pos) => {
    const raw = String(pos || "").trim();
    if (!raw) return "";
    const clean = raw.replace(/[\s_-]+/g, "").toUpperCase();
    return POS_ALIAS_MAP[clean] || raw;
  };

  /* ⭐ الأعمدة النشطة عبر جميع السكترات (مع دعم الوظائف الإضافية المضافة) */
  const positionsToShow = useMemo(() => {
    const activeSet = new Set();
    rowsToDisplay.forEach((row) => {
      safeArray(row.crewSlots).forEach((s) => {
        if (!s?.crewId || !s?.position) return;
        activeSet.add(normalizeSchedulePosKey(s.position));
      });
    });
    const ordered = ALL_COLUMN_POSITIONS.filter((pos) => activeSet.has(pos));
    const customExtras = Array.from(activeSet).filter((pos) => !ALL_COLUMN_POSITIONS.includes(pos));
    const combined = [...ordered, ...customExtras];
    return combined.length > 0 ? combined : ALL_COLUMN_POSITIONS;
  }, [rowsToDisplay, ALL_COLUMN_POSITIONS, POS_ALIAS_MAP]);

  /* ═══ Crew helpers (Per-Sector) ═══ */
  const crewByPosDetailed = (rowOrFlight, pos) => {
    const normTarget = normalizeSchedulePosKey(pos);
    const slots = safeArray(rowOrFlight?.crewSlots).filter(
      (s) => s?.crewId && normalizeSchedulePosKey(s.position) === normTarget
    );
    const seen = new Set();
    return slots
      .map((s) => crew.find((x) => String(x.id) === String(s.crewId)))
      .filter((m) => {
        if (!m || seen.has(String(m.id))) return false;
        seen.add(String(m.id));
        return true;
      });
  };

  const getShortCode = (member) => {
    if (!member) return "—";
    if (member.empNo) return String(member.empNo).slice(-5);
    const fullStr = String(member.fullName || "").trim();
    if (!fullStr) return "—";
    const nameParts = fullStr.split(/\s+/);
    if (nameParts.length === 1) return nameParts[0].slice(0, 3).toUpperCase();
    const first = nameParts[0][0] || "";
    const last = nameParts[nameParts.length - 1].slice(0, 3) || "";
    return `${first}.${last}`.toUpperCase();
  };

  const getShortCodeWithColor = (member, positionKey) => {
    if (!member) return null;
    const code = getShortCode(member);
    const colorMap = {
      captain: "bg-sky-500/20 text-sky-400 border-sky-500/50",
      firstOfficer: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50",
      observer: "bg-indigo-500/20 text-indigo-400 border-indigo-500/50",
      tri: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
      flightAttendant: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      fa1: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      fa2: "bg-amber-500/20 text-amber-400 border-amber-500/50",
      engineer: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      security: "bg-rose-500/20 text-rose-400 border-rose-500/50",
      loadmaster: "bg-teal-500/20 text-teal-400 border-teal-500/50",
      flightDispatcher: "bg-violet-500/20 text-violet-400 border-violet-500/50",
    };
    const normKey = normalizeSchedulePosKey(positionKey || member.role);
    return {
      code,
      color: colorMap[normKey] || colorMap[member.role] || "bg-slate-500/20 text-slate-300 border-slate-500/40",
    };
  };

  /* ═══ Per-Sector Selection ═══ */
  const toggleSelect = (rowKey) => {
    setSelectedRowKeys((prev) =>
      prev.includes(rowKey) ? prev.filter((x) => x !== rowKey) : [...prev, rowKey]
    );
  };

  const toggleSelectAll = () => {
    const allKeys = rowsToDisplay.map((r) => r.key);
    if (allKeys.length > 0 && selectedRowKeys.length === allKeys.length) {
      setSelectedRowKeys([]);
    } else {
      setSelectedRowKeys(allKeys);
    }
  };

  const getSelectedSelection = () => {
    const selectedRows = rowsToDisplay.filter((r) =>
      selectedRowKeys.includes(r.key)
    );
    const flightMap = new Map();
    selectedRows.forEach((r) => {
      if (r.flight && !flightMap.has(r.flight.id)) {
        flightMap.set(r.flight.id, r.flight);
      }
    });
    return {
      selectedRows,
      selectedFlights: Array.from(flightMap.values()),
      selectedIds: Array.from(flightMap.keys()),
    };
  };

  /* ═══ CRUD ═══ */
  const openNew = (nature = "PAX", flightType = "SCHEDULED") => {
    if (!canCreate) return showToast("⚠️ ليس لديك صلاحية إنشاء رحلات", "warning");
    const newDraft = {
      flightNo: "",
      flightNature: nature,
      pax: nature === "FERRY" ? 0 : "",
      dep: "",
      arr: "",
      altn: "",
      altn2: "",
      date: selectedDate || todayISO(),
      std: "12:00",
      sta: "13:30",
      acft: fleet[0]?.reg || "",
      status: "SCHEDULED",
      flightType: flightType || (nature === "FERRY" ? "FERRY" : "SCHEDULED"),
      notes: "",
      permits: "",
      services: "",
      cargo: 0,
      baggage: 0,
      crewSlots: [],
      legs: [],
      actual: {},
      fuel: {},
      wb: {},
    };
    setDraft(newDraft);
    setModalCrewSectorIdx(-1);
    setEditing("new");
    setModalOpen(true);
    setDrawerLegIdx(-1);
    setDrawerInitialTab("flight");
    setDrawerOpen(false);
  };

  const openFlightDrawer = (f, targetLegIdx = -1, tab = "flight", crewMemberId = null) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تعديل الرحلات", "warning");
    setDrawerInitialCrewId(crewMemberId ? String(crewMemberId) : null);
    const mainDate = extractIsoDate(f.std, selectedDate || todayISO());
    const mainSlots = safeArray(f.crewSlots)
      .filter((s) => s && s.crewId && s.position)
      .map((s) => ({ ...s, crewId: String(s.crewId) }));
    let legs = [];
    if (Array.isArray(f.legs)) {
      legs = f.legs.map((l) => {
        const norm = normalizeLegForEdit(l, mainDate);
        return {
          ...norm,
          crewSlots: Array.isArray(l.crewSlots)
            ? l.crewSlots.filter((s) => s && s.crewId && s.position).map((s) => ({ ...s, crewId: String(s.crewId) }))
            : mainSlots.map((s) => ({ ...s })),
        };
      });
    } else if (typeof f.legs === "string" && f.legs.trim()) {
      try {
        const parsed = JSON.parse(f.legs);
        if (Array.isArray(parsed))
          legs = parsed.map((l) => {
            const norm = normalizeLegForEdit(l, mainDate);
            return {
              ...norm,
              crewSlots: Array.isArray(l.crewSlots)
                ? l.crewSlots.filter((s) => s && s.crewId && s.position).map((s) => ({ ...s, crewId: String(s.crewId) }))
                : mainSlots.map((s) => ({ ...s })),
            };
          });
      } catch {
        legs = [];
      }
    }
    const nature = f.flightNature || f.nature || (Number(f.pax) > 0 ? "PAX" : "FERRY");
    setDraft({
      ...f,
      flightNature: nature,
      pax: f.pax !== undefined && f.pax !== null ? f.pax : (nature === "FERRY" ? 0 : ""),
      targetLegIdx,
      date: mainDate,
      std: normalizeHHMM(f.std, "12:00"),
      sta: normalizeHHMM(f.sta, "13:30"),
      flightType: f.flightType || "SCHEDULED",
      notes: f.notes || "",
      permits: f.permits || "",
      services: f.services || "",
      cargo: f.cargo || 0,
      baggage: f.baggage || 0,
      crewSlots: mainSlots,
      actual: safeObject(f.actual),
      fuel: safeObject(f.fuel),
      wb: safeObject(f.wb),
      legs,
    });
    setEditing(f.id);
    setDrawerLegIdx(targetLegIdx);
    setDrawerInitialTab(tab);
    setDrawerOpen(true);
    setModalOpen(false);
  };

  const openEdit = (f, targetLegIdx = -1) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تعديل الرحلات", "warning");
    const mainDate = extractIsoDate(f.std, selectedDate || todayISO());
    const mainSlots = safeArray(f.crewSlots)
      .filter((s) => s && s.crewId && s.position)
      .map((s) => ({ ...s, crewId: String(s.crewId) }));
    let legs = [];
    if (Array.isArray(f.legs)) {
      legs = f.legs.map((l) => {
        const norm = normalizeLegForEdit(l, mainDate);
        return {
          ...norm,
          crewSlots: Array.isArray(l.crewSlots)
            ? l.crewSlots.filter((s) => s && s.crewId && s.position).map((s) => ({ ...s, crewId: String(s.crewId) }))
            : mainSlots.map((s) => ({ ...s })),
        };
      });
    } else if (typeof f.legs === "string" && f.legs.trim()) {
      try {
        const parsed = JSON.parse(f.legs);
        if (Array.isArray(parsed))
          legs = parsed.map((l) => {
            const norm = normalizeLegForEdit(l, mainDate);
            return {
              ...norm,
              crewSlots: Array.isArray(l.crewSlots)
                ? l.crewSlots.filter((s) => s && s.crewId && s.position).map((s) => ({ ...s, crewId: String(s.crewId) }))
                : mainSlots.map((s) => ({ ...s })),
            };
          });
      } catch {
        legs = [];
      }
    }
    const nature = f.flightNature || f.nature || (Number(f.pax) > 0 ? "PAX" : "FERRY");
    setDraft({
      ...f,
      flightNature: nature,
      pax: f.pax !== undefined && f.pax !== null ? f.pax : (nature === "FERRY" ? 0 : ""),
      targetLegIdx,
      date: mainDate,
      std: normalizeHHMM(f.std, "12:00"),
      sta: normalizeHHMM(f.sta, "13:30"),
      flightType: f.flightType || "SCHEDULED",
      notes: f.notes || "",
      permits: f.permits || "",
      services: f.services || "",
      cargo: f.cargo || 0,
      baggage: f.baggage || 0,
      crewSlots: mainSlots,
      actual: safeObject(f.actual),
      fuel: safeObject(f.fuel),
      wb: safeObject(f.wb),
      legs,
    });
    setModalCrewSectorIdx(targetLegIdx >= 0 ? targetLegIdx : -1);
    setEditing(f.id);
    setModalOpen(true);
    setDrawerLegIdx(targetLegIdx);
    setDrawerInitialTab("flight");
    setDrawerOpen(false);
  };

  const enrichCrewSlots = (rawSlots) =>
    safeArray(rawSlots)
      .filter(
        (slot) =>
          slot &&
          String(slot.crewId || "").trim() !== "" &&
          String(slot.position || "").trim() !== ""
      )
      .map((slot) => {
        const member = crew.find((c) => String(c.id) === String(slot.crewId));
        const cleanSlot = {
          ...slot,
          crewId: String(slot.crewId),
          position: String(slot.position),
        };
        return member?.email
          ? { ...cleanSlot, email: String(member.email).trim().toLowerCase() }
          : cleanSlot;
      });

  const save = async () => {
    if (saving) return;
    if (editing === "new" && !canCreate) return;
    if (editing !== "new" && !canEdit) return;

    const cleanFlightNo = String(draft.flightNo || "").trim().toUpperCase();
    const cleanDate = extractIsoDate(draft.date, "");
    if (!cleanFlightNo || !cleanDate) {
      return showToast("⚠️ رقم الرحلة والتاريخ مطلوبان", "warning");
    }

    const { stdIso, staIso, safeDate } = buildSectorIsoPair(
      cleanDate,
      draft.std,
      draft.sta
    );

    const enrichedSlots = enrichCrewSlots(draft.crewSlots);
    if (draft.acft && enrichedSlots.length > 0) {
      const unqualified = enrichedSlots.filter((slot) => {
        const member = crew.find((c) => String(c.id) === String(slot.crewId));
        return member && !isCrewQualifiedForAircraft(member, draft.acft);
      });
      if (unqualified.length > 0) {
        const names = unqualified
          .map(
            (slot) =>
              crew.find((c) => String(c.id) === String(slot.crewId))
                ?.fullName || slot.crewId
          )
          .join(", ");
        return showToast(`⚠️ السكتر 1: الأعضاء غير مؤهلين للطائرة ${draft.acft}:\n${names}`, "warning");
      }
    }

    const legsIso = [];
    for (let li = 0; li < safeArray(draft.legs).length; li++) {
      const l = safeArray(draft.legs)[li];
      const legPair = buildSectorIsoPair(
        l.date || safeDate,
        l.std || "12:00",
        l.sta || "13:30"
      );
      const legNature = l.flightNature || draft.flightNature || "PAX";
      const legPax =
        legNature === "FERRY"
          ? 0
          : l.pax !== undefined && l.pax !== null && l.pax !== ""
          ? Number(l.pax)
          : 0;
      const legAcft = l.acft || draft.acft || "";
      const legCrew = enrichCrewSlots(l.crewSlots);

      if (legAcft && legCrew.length > 0) {
        const unqualifiedLeg = legCrew.filter((slot) => {
          const member = crew.find((c) => String(c.id) === String(slot.crewId));
          return member && !isCrewQualifiedForAircraft(member, legAcft);
        });
        if (unqualifiedLeg.length > 0) {
          const names = unqualifiedLeg
            .map(
              (slot) =>
                crew.find((c) => String(c.id) === String(slot.crewId))
                  ?.fullName || slot.crewId
            )
            .join(", ");
          return showToast(
            `⚠️ السكتر ${li + 2}: الأعضاء غير مؤهلين للطائرة ${legAcft}:\n${names}`,
            "warning"
          );
        }
      }

      legsIso.push({
        ...l,
        flightNo: String(l.flightNo || draft.flightNo || "").trim().toUpperCase(),
        flightType: l.flightType || draft.flightType || "SCHEDULED",
        flightNature: legNature,
        pax: legPax,
        date: legPair.safeDate,
        dep: String(l.dep || "").trim().toUpperCase(),
        arr: String(l.arr || "").trim().toUpperCase(),
        altn: String(l.altn || "").trim().toUpperCase(),
        altn2: String(l.altn2 || "").trim().toUpperCase(),
        cargo: Number(l.cargo) || 0,
        notes: l.notes || "",
        permits: l.permits || "",
        services: l.services || "",
        std: legPair.stdIso,
        sta: legPair.staIso,
        acft: legAcft,
        status: computeAutoStatus(l),
        crewSlots: legCrew,
      });
    }

    const autoStatus = computeAutoStatus({
      ...draft,
      std: stdIso,
      sta: staIso,
    });

    const cleanDep = String(draft.dep || "").trim().toUpperCase();
    const cleanArr = String(draft.arr || "").trim().toUpperCase();

    const mainNature = draft.flightNature || (Number(draft.pax) > 0 ? "PAX" : "FERRY");
    const mainPax = mainNature === "FERRY" ? 0 : (draft.pax !== undefined && draft.pax !== null && draft.pax !== "" ? Number(draft.pax) : 0);

    const finalDraft = {
      ...draft,
      flightNo: cleanFlightNo,
      flightNature: mainNature,
      pax: mainPax,
      dep: cleanDep,
      arr: cleanArr,
      altn: String(draft.altn || "").trim().toUpperCase(),
      altn2: String(draft.altn2 || "").trim().toUpperCase(),
      cargo: Number(draft.cargo) || 0,
      route: cleanDep && cleanArr ? `${cleanDep}-${cleanArr}` : draft.route || "",
      crewSlots: enrichedSlots,
      std: stdIso,
      sta: staIso,
      legs: legsIso,
      status: autoStatus,
    };

    setSaving(true);
    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await flightsAPI.create(finalDraft);
        const savedItem = { ...finalDraft, id: String(created.id) };
        setFlights((prev) => {
          const next = [
            ...prev.filter((f) => String(f.id) !== String(savedItem.id)),
            savedItem,
          ];
          writeSheetCache("Flights", next);
          return next;
        });
        logSafe(
          user,
          "CREATE",
          "Flight",
          savedItem.id,
          finalDraft.flightNo,
          buildFlightHistorySnapshot(savedItem, crew)
        );
        notifyFlightChange(
          finalDraft.flightNo,
          "create",
          `جدولة رحلة جديدة (${cleanDep || "—"} → ${cleanArr || "—"}) بتاريخ ${safeDate}`
        );
        if (enrichedSlots.length > 0) {
          notifyCrewChange(
            finalDraft.flightNo,
            "assign",
            `تم تعيين طاقم الرحلة (${enrichedSlots.length} أفراد) وإشعارهم في بوابة الطاقم`
          );
        }
        triggerFlightWhatsAppNotifications(savedItem, crew, "ASSIGNED").catch(
          () => {}
        );
      } else {
        const targetId = String(draft.id || editing);
        await flightsAPI.update(targetId, finalDraft);
        const savedItem = { ...finalDraft, id: targetId };
        setFlights((prev) => {
          const next = prev.map((f) =>
            String(f.id) === targetId ? savedItem : f
          );
          writeSheetCache("Flights", next);
          return next;
        });
        logSafe(
          user,
          "UPDATE",
          "Flight",
          targetId,
          finalDraft.flightNo,
          buildFlightHistorySnapshot(savedItem, crew)
        );
        notifyFlightChange(
          finalDraft.flightNo,
          "update",
          `تحديث بيانات الرحلة (${cleanDep || "—"} → ${cleanArr || "—"})`
        );
        if (enrichedSlots.length > 0) {
          notifyCrewChange(
            finalDraft.flightNo,
            "assign",
            `تحديث طاقم الرحلة (${enrichedSlots.length} أفراد) وإرسال إشعار لبوابة الطاقم`
          );
        }
        triggerFlightWhatsAppNotifications(savedItem, crew, "UPDATED").catch(
          () => {}
        );
      }

      // Ensure the saved flight's date is visible on the board immediately
      const savedTime = new Date(stdIso);
      const { start, end } = getDateRange();
      if (!isNaN(savedTime.getTime()) && (savedTime < start || savedTime >= end)) {
        setSelectedDate(safeDate);
      }

      setEditing(null);
      setModalOpen(false);
      setDrawerOpen(false);
      setSyncStatus?.("synced");
      alertSuccess();
    } catch (e) {
      showToast("❌ فشل الحفظ / Save failed: " + (e?.message || e), "error");
      setSyncStatus?.("error");
      alertError();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!canDelete) return;
    const ok = await confirmAction(t.confirmDelete);
    if (!ok) return;
    try {
      const fl = flights.find((f) => f.id === id);
      await flightsAPI.remove(id);
      if (fl) {
        logSafe(user, "DELETE", "Flight", id, fl.flightNo || id, buildFlightHistorySnapshot(fl, crew));
      }
      setFlights((prev) => prev.filter((f) => f.id !== id));
      setSelectedRowKeys((prev) => prev.filter((k) => !k.startsWith(id + "-")));
      notifyFlightChange(fl?.flightNo || id, "delete", `تم إلغاء / حذف الرحلة من الجدول`);
      alertSuccess();
    } catch (e) {
      showToast("Delete failed: " + e.message, "error");
      alertError();
    }
  };

  const saveNotesAndPermits = async (flightId, data) => {
    if (!canEdit) throw new Error("No permission");
    const flight = flights.find((f) => f.id === flightId);
    if (!flight) return;
    const servicesVal = data.services ?? data.handling ?? "";
    const updatedObj = {
      ...flight,
      notes: data.notes || "",
      permits: data.permits || "",
      services: servicesVal,
    };
    try {
      await flightsAPI.update(flightId, updatedObj);
      logSafe(user, "UPDATE", "Flight", flightId, flight.flightNo, buildFlightHistorySnapshot(updatedObj, crew));
      setFlights((prev) =>
        prev.map((f) =>
          f.id === flightId
            ? updatedObj
            : f
        )
      );
      alertSuccess();
    } catch (e) {
      alertError();
      throw e;
    }
  };

  const handleOpenGenDecMulti = () => {
    const { selectedFlights } = getSelectedSelection();
    if (selectedFlights.length === 0)
      return showToast("⚠️ لم يتم تحديد أي رحلة", "warning");
    if (!canEdit) return;
    setGenDecMultiFlights(selectedFlights);
  };

  const handleOpenBulkEditLegs = () => {
    const { selectedFlights } = getSelectedSelection();
    if (selectedFlights.length === 0)
      return showToast("⚠️ لم يتم تحديد أي رحلة", "warning");
    if (!canEdit) return;
    setBulkEditLegsFlights(selectedFlights);
  };

  /* ⭐ v7.6 — حفظ التعديل الجماعي للرحلات والقطاعات */
  const saveBulkEditLegs = async (changes) => {
    if (!canEdit) throw new Error("No permission");
    if (!bulkEditLegsFlights) return;

    const scope = changes.scope || "all";

    setSyncStatus?.("syncing");
    try {
      for (const f of bulkEditLegsFlights) {
        let updatedMain = { ...f };
        if (scope === "all" || scope === "main") {
          if (changes.flightNature) {
            updatedMain.flightNature = changes.flightNature;
            if (changes.flightNature === "FERRY") updatedMain.pax = 0;
          }
          if (changes.pax !== undefined && changes.pax !== "") {
            updatedMain.pax = Number(changes.pax) || 0;
          }
          if (changes.date) {
            const datePart = changes.date;
            if (updatedMain.std) {
              updatedMain.std = `${datePart}T${String(updatedMain.std).slice(11, 16)}:00.000Z`;
            }
            if (updatedMain.sta) {
              updatedMain.sta = `${datePart}T${String(updatedMain.sta).slice(11, 16)}:00.000Z`;
            }
          }
          if (changes.std) {
            const flightDate = updatedMain.date || (f.std ? String(f.std).slice(0, 10) : "");
            updatedMain.std = `${flightDate}T${changes.std}:00.000Z`;
          }
          if (changes.sta) {
            const flightDate = updatedMain.date || (f.std ? String(f.std).slice(0, 10) : "");
            updatedMain.sta = `${flightDate}T${changes.sta}:00.000Z`;
          }
          if (changes.acft) updatedMain.acft = changes.acft;
        }

        const legs = Array.isArray(f.legs) ? f.legs : [];
        let updatedLegs = legs;
        if (scope === "all" || scope === "legs") {
          updatedLegs = legs.map((leg) => {
            const newLeg = { ...leg };
            if (changes.flightNature) {
              newLeg.flightNature = changes.flightNature;
              if (changes.flightNature === "FERRY") newLeg.pax = 0;
            }
            if (changes.pax !== undefined && changes.pax !== "") {
              newLeg.pax = Number(changes.pax) || 0;
            }
            if (changes.date) {
              newLeg.date = changes.date;
              if (newLeg.std)
                newLeg.std =
                  changes.date +
                  "T" +
                  String(newLeg.std).slice(11, 16) +
                  ":00.000Z";
              if (newLeg.sta)
                newLeg.sta =
                  changes.date +
                  "T" +
                  String(newLeg.sta).slice(11, 16) +
                  ":00.000Z";
            }
            if (changes.std) {
              const legDate =
                newLeg.date || (f.std ? String(f.std).slice(0, 10) : "");
              newLeg.std = legDate + "T" + changes.std + ":00.000Z";
              newLeg.date = legDate;
            }
            if (changes.sta) {
              const legDate =
                newLeg.date || (f.std ? String(f.std).slice(0, 10) : "");
              newLeg.sta = legDate + "T" + changes.sta + ":00.000Z";
            }
            if (changes.acft) newLeg.acft = changes.acft;
            return newLeg;
          });
        }

        await flightsAPI.update(f.id, { ...updatedMain, legs: updatedLegs });
      }

      setFlights((prev) =>
        prev.map((f) => {
          if (!bulkEditLegsFlights.some((bf) => bf.id === f.id)) return f;
          let updatedMain = { ...f };
          if (scope === "all" || scope === "main") {
            if (changes.flightNature) {
              updatedMain.flightNature = changes.flightNature;
              if (changes.flightNature === "FERRY") updatedMain.pax = 0;
            }
            if (changes.pax !== undefined && changes.pax !== "") {
              updatedMain.pax = Number(changes.pax) || 0;
            }
            if (changes.date) {
              const datePart = changes.date;
              if (updatedMain.std) {
                updatedMain.std = `${datePart}T${String(updatedMain.std).slice(11, 16)}:00.000Z`;
              }
              if (updatedMain.sta) {
                updatedMain.sta = `${datePart}T${String(updatedMain.sta).slice(11, 16)}:00.000Z`;
              }
            }
            if (changes.std) {
              const flightDate = updatedMain.date || (f.std ? String(f.std).slice(0, 10) : "");
              updatedMain.std = `${flightDate}T${changes.std}:00.000Z`;
            }
            if (changes.sta) {
              const flightDate = updatedMain.date || (f.std ? String(f.std).slice(0, 10) : "");
              updatedMain.sta = `${flightDate}T${changes.sta}:00.000Z`;
            }
            if (changes.acft) updatedMain.acft = changes.acft;
          }

          const legs = Array.isArray(f.legs) ? f.legs : [];
          let updatedLegs = legs;
          if (scope === "all" || scope === "legs") {
            updatedLegs = legs.map((leg) => {
              const newLeg = { ...leg };
              if (changes.flightNature) {
                newLeg.flightNature = changes.flightNature;
                if (changes.flightNature === "FERRY") newLeg.pax = 0;
              }
              if (changes.pax !== undefined && changes.pax !== "") {
                newLeg.pax = Number(changes.pax) || 0;
              }
              if (changes.date) {
                newLeg.date = changes.date;
                if (newLeg.std)
                  newLeg.std =
                    changes.date +
                    "T" +
                    String(newLeg.std).slice(11, 16) +
                    ":00.000Z";
                if (newLeg.sta)
                  newLeg.sta =
                    changes.date +
                    "T" +
                    String(newLeg.sta).slice(11, 16) +
                    ":00.000Z";
              }
              if (changes.std) {
                const legDate =
                  newLeg.date || (f.std ? String(f.std).slice(0, 10) : "");
                newLeg.std = legDate + "T" + changes.std + ":00.000Z";
                newLeg.date = legDate;
              }
              if (changes.sta) {
                const legDate =
                  newLeg.date || (f.std ? String(f.std).slice(0, 10) : "");
                newLeg.sta = legDate + "T" + changes.sta + ":00.000Z";
              }
              if (changes.acft) newLeg.acft = changes.acft;
              return newLeg;
            });
          }
          return { ...updatedMain, legs: updatedLegs };
        })
      );

      setBulkEditLegsFlights(null);
      setSelectedRowKeys([]);
      setSyncStatus?.("synced");
      alertSuccess();
    } catch (e) {
      showToast("Bulk edit failed: " + e.message, "error");
      setSyncStatus?.("error");
      alertError();
      throw e;
    }
  };

  const bulkAction = async (action) => {
    const { selectedRows } = getSelectedSelection();
    if (selectedRows.length === 0)
      return showToast("⚠️ الرجاء تحديد سكتر واحد على الأقل", "warning");

    // Group selected sector rows by flight ID
    const byFlight = new Map();
    selectedRows.forEach((r) => {
      if (!r?.flight?.id) return;
      if (!byFlight.has(r.flight.id)) {
        byFlight.set(r.flight.id, { flight: r.flight, main: false, legIdxs: [] });
      }
      const entry = byFlight.get(r.flight.id);
      if (r.isMain) entry.main = true;
      else if (r.legIdx >= 0) entry.legIdxs.push(r.legIdx);
    });

    if (action === "delete") {
      if (!canDelete) return;
      const ok = await confirmAction(
        `${t.delete || "حذف"} ${selectedRows.length}؟`
      );
      if (!ok) return;
      try {
        const deletedFlightIds = new Set();
        const updatedFlightsMap = new Map();

        for (const [fid, entry] of byFlight.entries()) {
          const f = entry.flight;
          const totalLegs = safeArray(f.legs).length;
          if (entry.main || (totalLegs > 0 && entry.legIdxs.length >= totalLegs && !entry.main && totalLegs === 0)) {
            await flightsAPI.remove(fid);
            deletedFlightIds.add(fid);
          } else if (entry.legIdxs.length > 0) {
            const nextLegs = safeArray(f.legs).filter(
              (_, idx) => !entry.legIdxs.includes(idx)
            );
            const nextFlight = { ...f, legs: nextLegs };
            await flightsAPI.update(fid, nextFlight);
            updatedFlightsMap.set(fid, nextFlight);
          }
        }

        setFlights((prev) =>
          prev
            .filter((f) => !deletedFlightIds.has(f.id))
            .map((f) => updatedFlightsMap.get(f.id) || f)
        );
        setSelectedRowKeys([]);
        alertSuccess();
      } catch (e) {
        alertError();
      }
      return;
    }

    if (action === "complete") {
      if (!canEdit) return;
      const updatedMap = new Map();
      for (const [fid, entry] of byFlight.entries()) {
        try {
          const f = entry.flight;
          let nextFlight = { ...f };
          if (entry.main) {
            const nextStatus = computeAutoStatus({ ...f, actual: f.actual || {} });
            nextFlight.status = nextStatus === "SCHEDULED" ? "ARRIVED" : nextStatus;
          }
          if (entry.legIdxs.length > 0) {
            nextFlight.legs = safeArray(f.legs).map((leg, idx) => {
              if (!entry.legIdxs.includes(idx)) return leg;
              const legStatus = computeAutoStatus({ ...leg, actual: leg.actual || {} });
              return {
                ...leg,
                status: legStatus === "SCHEDULED" ? "ARRIVED" : legStatus,
              };
            });
          }
          await flightsAPI.update(fid, nextFlight);
          updatedMap.set(fid, nextFlight);
        } catch (e) {
          console.error(e);
        }
      }
      setFlights((prev) => prev.map((f) => updatedMap.get(f.id) || f));
      setSelectedRowKeys([]);
      alertSuccess();
      return;
    }
  };

  /* ═══ Add / Update / Remove Chained Independent Sectors ═══ */
  const addLeg = () => {
    const currentLegs = draft.legs || [];
    const lastLeg =
      currentLegs.length > 0
        ? currentLegs[currentLegs.length - 1]
        : { arr: draft.arr, sta: draft.sta, date: draft.date };
    const nextStd = addMinutesHHMM(lastLeg.sta || "12:00", 45);
    const nextSta = addMinutesHHMM(nextStd, 90);

    setDraft({
      ...draft,
      legs: [
        ...currentLegs,
        {
          flightNo: draft.flightNo || "",
          date: lastLeg.date || draft.date,
          dep: lastLeg.arr || "",
          arr: "",
          std: nextStd,
          sta: nextSta,
          acft: draft.acft || "",
          flightType: draft.flightType || "SCHEDULED",
          flightNature: draft.flightNature || "PAX",
          pax: draft.flightNature === "FERRY" ? 0 : "",
          status: "SCHEDULED",
          altn: "",
          cargo: 0,
          notes: "",
          permits: "",
          services: "",
          crewSlots: [],
        },
      ],
    });
    setModalCrewSectorIdx(currentLegs.length);
  };

  const updateLeg = (idx, patch) => {
    const newLegs = [...(draft.legs || [])];
    const prevArr = newLegs[idx]?.arr;
    newLegs[idx] = { ...newLegs[idx], ...patch };
    if (
      patch.arr !== undefined &&
      newLegs[idx + 1] &&
      (!newLegs[idx + 1].dep || newLegs[idx + 1].dep === prevArr)
    ) {
      newLegs[idx + 1] = { ...newLegs[idx + 1], dep: patch.arr };
    }
    setDraft({ ...draft, legs: newLegs });
  };

  const removeLeg = (idx) => {
    setDraft({ ...draft, legs: (draft.legs || []).filter((_, i) => i !== idx) });
    setModalCrewSectorIdx((cur) => (cur === idx ? -1 : cur > idx ? cur - 1 : cur));
  };

  /* ═══ Independent Per-Sector Crew Slots inside Edit Modal ═══ */
  const activeModalCrewSlots =
    modalCrewSectorIdx === -1
      ? safeArray(draft.crewSlots)
      : safeArray(draft.legs?.[modalCrewSectorIdx]?.crewSlots);

  const setActiveModalCrewSlots = (nextSlots) => {
    if (modalCrewSectorIdx === -1) {
      setDraft((prev) => ({ ...prev, crewSlots: nextSlots }));
    } else {
      setDraft((prev) => {
        const nextLegs = [...(prev.legs || [])];
        if (nextLegs[modalCrewSectorIdx]) {
          nextLegs[modalCrewSectorIdx] = {
            ...nextLegs[modalCrewSectorIdx],
            crewSlots: nextSlots,
          };
        }
        return { ...prev, legs: nextLegs };
      });
    }
  };

  const addSlot = () => {
    if (!canAssignCrew && !canEdit) return;
    const usedPositions = activeModalCrewSlots
      .map((s) => s.position)
      .filter(Boolean);
    const firstAvailable = POSITION_OPTIONS.find(
      (p) => !usedPositions.includes(p.key)
    );
    if (!firstAvailable)
      return showToast("⚠️ كل الوظائف معيّنة بالفعل لهذا السكتر", "warning");
    setActiveModalCrewSlots([
      ...activeModalCrewSlots,
      { crewId: "", position: firstAvailable.key },
    ]);
  };

  const updateSlot = (i, patch) => {
    const list = [...activeModalCrewSlots];
    if (patch.crewId) {
      const alreadyAssigned = list.some(
        (s, idx) => idx !== i && String(s.crewId) === String(patch.crewId)
      );
      if (alreadyAssigned) {
        showToast("⚠️ لا يمكن تعيين نفس العضو لأكثر من وظيفة في نفس السكتر", "warning");
        return;
      }
    }
    list[i] = { ...list[i], ...patch };
    if (patch.position && list[i].crewId) {
      const member = crew.find((c) => String(c.id) === String(list[i].crewId));
      const allowed = getAllowedRoles(patch.position);
      const memberRoles = getMemberAllRoles(member);
      const hasMatch = memberRoles.some((r) => allowed.includes(r));
      if (member && !hasMatch) list[i].crewId = "";
    }
    setActiveModalCrewSlots(list);
  };

  const removeSlot = (i) =>
    setActiveModalCrewSlots(activeModalCrewSlots.filter((_, idx) => idx !== i));

  const copySector1CrewToActiveModalLeg = () => {
    if (modalCrewSectorIdx < 0) return;
    const copied = safeArray(draft.crewSlots).map((s) => ({ ...s }));
    setActiveModalCrewSlots(copied);
    showToast(`✅ تم نسخ طاقم السكتر 1 إلى السكتر ${modalCrewSectorIdx + 2}`, "success");
  };

  /* ⭐ Complete Flight */
  const saveCompleteFlight = async (updatedFlight) => {
    if (!canEdit) throw new Error("No permission");
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
      logSafe(
        user,
        "UPDATE",
        "Flight",
        savedFlight.id,
        savedFlight.flightNo,
        buildFlightHistorySnapshot(savedFlight, crew)
      );
      setFlights((prev) =>
        prev.map((f) => (f.id === savedFlight.id ? savedFlight : f))
      );
      setSyncStatus?.("synced");
      alertSuccess();
      if (typeof reloadFlights === "function") {
        setTimeout(() => {
          reloadFlights().catch((e) =>
            console.warn("reloadFlights failed:", e)
          );
        }, 400);
      }
    } catch (e) {
      setSyncStatus?.("error");
      alertError();
      throw e;
    }
  };

  const handleSendFlightEmail = async (flight) => {
    if (!flight) return;
    const ok = await confirmAction(
      `إرسال تفاصيل الرحلة ${flight.flightNo} إلى الطاقم؟`
    );
    if (!ok) return;
    try {
      setSyncStatus?.("syncing");
      const result = await sendFlightEmail(flight, crew);
      if (result && result.ok !== false)
        showToast(
          `✅ تم إرسال ${result.sent ?? "?"} من ${result.total ?? "?"}`,
          "success"
        );
      else throw new Error(result?.error || "فشل");
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("❌ فشل: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  const handleSendExpiryAlerts = async () => {
    const ok = await confirmAction("إرسال تنبيهات الوثائق لكل الطاقم؟");
    if (!ok) return;
    try {
      setSyncStatus?.("syncing");
      const result = await checkExpiryAlerts();
      if (result && result.ok !== false)
        showToast(`✅ تم إرسال ${result.sent ?? "?"} تنبيه`, "success");
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("❌ فشل: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  /* ⭐ Context Menu */
  const handleContextMenu = (e, flight, legIdx = -1, rowKey = null) => {
    e.preventDefault();
    const hasAnyPerm = canEdit || canDelete || canViewForms;
    if (!hasAnyPerm) return;
    const isBulkTarget =
      rowKey && selectedRowKeys.includes(rowKey) && selectedRowKeys.length > 0;
    if (isBulkTarget) {
      const { selectedIds } = getSelectedSelection();
      setContextMenu({
        bulk: true,
        rowKeys: selectedRowKeys,
        ids: selectedIds,
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setContextMenu({ flight, legIdx, x: e.clientX, y: e.clientY });
    }
  };

  const handleContextAction = (action, flightPayload, actionLegIdx) => {
    const flight = flightPayload || contextMenu?.flight;
    const targetLegIdx =
      typeof actionLegIdx === "number" ? actionLegIdx : contextMenu?.legIdx ?? -1;
    if (typeof action === "string" && action.startsWith("open_op_form:")) {
      const formId = action.slice("open_op_form:".length);
      const foundForm = listOperationalFormsSync().find((f) => f.id === formId);
      if (foundForm) {
        const isBulk =
          flightPayload?.bulk === true ||
          (contextMenu?.bulk && (contextMenu?.ids?.length || 0) > 1);
        const { selectedIds: activeSelIds } = getSelectedSelection();
        const targetIds = isBulk
          ? flightPayload?.ids || contextMenu?.ids || activeSelIds || []
          : [];
        const targetFlights =
          targetIds.length > 0
            ? targetIds
                .map((id) => (flights || []).find((f) => f.id === id))
                .filter(Boolean)
            : flight && !flight.bulk
            ? [flight]
            : [];

        setActiveOpFormModal({
          form: foundForm,
          flight: targetFlights[0] || (flightPayload?.bulk ? null : flight),
          selectedFlights: targetFlights,
        });
      }
      return;
    }
    if (action === "open_notes_modal") setNotesModal(flight);
    else if (action === "edit") openEdit(flight, targetLegIdx);
    else if (action === "delete") remove(flight?.id);
    else if (action === "complete_flight")
      setCompleteFlight({ flight, legIdx: targetLegIdx });
    else if (action === "gendec") onGenDec(flight);
    else if (action === "print_gendec_stamped")
      printGenDec(flight, crew, settings, { showStamp: true });
    else if (action === "print_gendec_nostamp")
      printGenDec(flight, crew, settings, { showStamp: false });
    else if (action === "send_flight_email") handleSendFlightEmail(flight);
    else if (action === "send_expiry_alerts") handleSendExpiryAlerts();
    else if (action === "bulk_complete") bulkAction("complete");
    else if (action === "bulk_gendec") handleOpenGenDecMulti();
    else if (action === "bulk_delete") bulkAction("delete");
    else if (action === "bulk_edit_legs") handleOpenBulkEditLegs();
  };

  /* ⭐ Date Label */
  const selectedDateObj = new Date(selectedDate + "T00:00:00Z");
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
  const dateLabel = `${selectedDateObj.getUTCDate()} ${
    months[selectedDateObj.getUTCMonth()]
  } ${selectedDateObj.getUTCFullYear()}`;

  const modalActiveAcft =
    modalCrewSectorIdx === -1
      ? draft.acft
      : draft.legs?.[modalCrewSectorIdx]?.acft || draft.acft;
  const aircraftHasCrewAssigned =
    !modalActiveAcft || crew.some((c) => isCrewQualifiedForAircraft(c, modalActiveAcft));

  return (
    <div
      className="flex-1 min-h-0 flex flex-col h-full overflow-hidden p-1 space-y-1.5 fade-in"
      style={{
        fontSize: "12px",
      }}
    >
      {/* ═══ SINGLE-ROW ORGANIZED TOOLBAR & FILTERS ═══ */}
      <div className="rounded-lg shadow-xs border theme-transition px-2 py-1 mb-1 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-[11px]">
        <div className="flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700 p-0.5 shadow-2xs font-bold text-[10.5px] shrink-0">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition whitespace-nowrap ${
                viewMode === "table"
                  ? "bg-slate-200 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Table className="w-3 h-3" />
              <span>TABLE</span>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition whitespace-nowrap ${
                viewMode === "calendar"
                  ? "bg-slate-200 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              <span>CAL</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition whitespace-nowrap ${
                viewMode === "timeline"
                  ? "bg-slate-200 dark:bg-slate-700 text-sky-700 dark:text-sky-300 font-extrabold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <List className="w-3 h-3" />
              <span>LINE</span>
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => reloadFlights?.()}
            className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition shrink-0"
            title="تحديث البيانات"
          >
            <RotateCw className="w-3 h-3" />
          </button>

          {/* Date Input */}
          <div className="h-6 flex items-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 shadow-2xs font-mono shrink-0">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-[10.5px] font-bold outline-none cursor-pointer text-slate-800 dark:text-slate-200"
            />
          </div>

          {/* Date Shifter */}
          <div className="h-6 flex items-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs font-bold text-[10.5px] shrink-0">
            <button
              onClick={() => shiftDate(-rangeDays)}
              className="px-1.5 h-full border-e border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="السابق"
            >
              ←
            </button>
            <button
              onClick={goToday}
              className="px-1.5 h-full text-sky-600 dark:text-sky-400 font-extrabold hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
            >
              TODAY
            </button>
            <button
              onClick={() => shiftDate(rangeDays)}
              className="px-1.5 h-full border-s border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              title="التالي"
            >
              →
            </button>
          </div>

          {/* Timezone + Range */}
          <select
            value={timeMode}
            onChange={(e) => setTimeMode(e.target.value)}
            className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-mono font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer shrink-0"
          >
            <option value="UTC">UTC</option>
            <option value="LOCAL">LT</option>
          </select>

          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(+e.target.value)}
            className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer shrink-0"
          >
            <option value={1}>1d</option>
            <option value={3}>3d</option>
            <option value={7}>7d</option>
            <option value={14}>14d</option>
            <option value={30}>30d</option>
          </select>

          {/* Aircraft Filter */}
          <div className="h-6 flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 font-bold text-[10.5px] text-slate-700 dark:text-slate-300 shrink-0">
            <Plane className="w-3 h-3 text-sky-600 shrink-0" />
            <select
              value={acftFilter}
              onChange={(e) => setAcftFilter(e.target.value)}
              className="bg-transparent text-[10.5px] font-bold outline-none cursor-pointer max-w-[92px]"
            >
              <option value="">{isAr ? "الطائرة" : "ACFT"}</option>
              {fleet.map((a) => (
                <option key={a.id} value={a.reg}>
                  {a.reg}
                </option>
              ))}
            </select>
          </div>

          {/* Flight Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer shrink-0 max-w-[100px]"
          >
            <option value="">{isAr ? "الحالة" : "STATUS"}</option>
            {FLIGHT_STATUSES.map((st) => (
              <option key={st.key} value={st.key}>
                {isAr ? st.ar : st.en}
              </option>
            ))}
          </select>

          {/* Flight Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-6 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer shrink-0 max-w-[96px]"
          >
            <option value="">{isAr ? "النوع" : "TYPE"}</option>
            {FLIGHT_TYPES.map((ft) => (
              <option key={ft.key} value={ft.key}>
                {isAr ? ft.ar : ft.key}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="h-6 flex items-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 text-[10.5px] shrink-0">
            <Search className="w-3 h-3 text-slate-400 me-1 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? "بحث..." : "Search..."}
              className="bg-transparent outline-none w-20 sm:w-24 font-medium text-slate-800 dark:text-slate-200"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600 ms-1 font-bold">
                ×
              </button>
            )}
          </div>

          {/* Clear Active Filters */}
          {(q || statusFilter || acftFilter || typeFilter) && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setStatusFilter("");
                setAcftFilter("");
                setTypeFilter("");
              }}
              className="h-6 px-1.5 rounded text-[10px] font-bold bg-rose-500/12 text-rose-600 hover:bg-rose-500/20 border border-rose-500/25 transition shrink-0 whitespace-nowrap"
              title={isAr ? "مسح الفلاتر" : "Clear Filters"}
            >
              {isAr ? "مسح" : "Clear"}
            </button>
          )}

          {/* Sector Count + Selection Count */}
          <div className="ms-auto flex items-center gap-1 shrink-0">
            {selectedRowKeys.length > 0 && (
              <span className="h-6 inline-flex items-center px-1.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 font-mono tabular-nums font-bold text-[10px] whitespace-nowrap">
                {selectedRowKeys.length} ✓
              </span>
            )}
            <div className="h-6 flex items-center gap-1 px-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10.5px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
              <Send className="w-3 h-3 text-sky-500" />
              <span className="font-mono tabular-nums font-bold text-sky-600 dark:text-sky-400">
                {rowsToDisplay.length}
              </span>
            </div>

            {canCreate && (
              <button
                onClick={() => openNew()}
                className="h-6 flex items-center gap-1 px-2 text-white rounded text-[10.5px] font-bold shadow-2xs hover:opacity-90 transition shrink-0 whitespace-nowrap"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-3 h-3" />
                <span>NEW FLIGHT</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ SCHEDULE MAIN VIEW — 5 SWITCHABLE EXECUTIVE DESIGNS ═══ */}
      {viewMode === "table" && (() => {
        const renderAirportCell = (code, row, darkSurface = false) => {
          const clean = String(code || "").trim().toUpperCase();
          const info = clean ? airportDetailsMap[clean] : null;
          const closed = Boolean(info?.notamClosed);
          if (!clean) {
            return <span className="opacity-40">—</span>;
          }
          return (
            <AirportHoverCard code={clean} flightDate={row.date}>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-bold cursor-pointer hover:underline ${
                  closed
                    ? darkSurface
                      ? "bg-rose-950/90 text-rose-200 border border-rose-500/70"
                      : "bg-rose-600/12 text-rose-700 dark:text-rose-300 border border-rose-500/50"
                    : ""
                }`}
                style={
                  closed
                    ? undefined
                    : { color: darkSurface ? "#38bdf8" : "var(--brand-primary)" }
                }
                title={
                  closed
                    ? `NOTAM CLOSED: ${info?.notamNote || "المطار مغلق بنوتام"}`
                    : `${info?.nameAr || info?.name || clean}`
                }
              >
                {closed && <AlertOctagon className="w-3 h-3 text-rose-500 shrink-0" />}
                <span>{clean}</span>
                {closed && (
                  <span className="text-[8.5px] font-black tracking-tight uppercase text-rose-600 dark:text-rose-300">
                    NOTAM
                  </span>
                )}
              </span>
            </AirportHoverCard>
          );
        };

        const renderFlightStatusControl = (row, darkSurface = false) => {
          const stObj = getFlightStatus(row.status || "SCHEDULED");
          const toneCls = getFlightStatusBadgeClasses(stObj.key, darkSurface);
          const dCode = normalizeDelayCode(row.actual?.delayCode);
          const dMin = Number(row.actual?.delayMinutes) || 0;
          return (
            <div className="inline-flex flex-col items-center gap-0.5">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9.5px] font-bold whitespace-nowrap ${toneCls}`}
                title={isAr ? "عرض فقط — التعديل من نافذة تفاصيل الرحلة" : "Display only — edit inside flight details"}
              >
                {isAr ? stObj.ar : stObj.en}
              </span>
              {dCode && (
                <span className="font-mono tabular-nums text-[8.5px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  DLY {dCode}{dMin > 0 ? ` · ${dMin}m` : ""}
                </span>
              )}
            </div>
          );
        };

        const renderSectorDot = (row, darkSurface = false) => {
          const f = row.flight;
          const isLeg = !row.isMain;
          const completed = isCompleted(row);
          const past = isPast(row);
          const cancelled = String(row.status || "").toUpperCase() === "CANCELLED";
          const dotColor = cancelled
            ? "bg-rose-500 ring-rose-500/30"
            : completed
            ? "bg-emerald-500 ring-emerald-500/30"
            : past
            ? "bg-amber-500 ring-amber-500/30"
            : "bg-sky-500 ring-sky-500/30";
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openFlightDrawer(f, isLeg ? row.legIdx : -1, "jl");
              }}
              className="inline-flex items-center gap-1 group cursor-pointer"
              title={
                isAr
                  ? "اضغط لفتح الرحلة المكتملة وسجل الرحلة (Journey Log)"
                  : "Click to open Completed Flight & Journey Log (JL)"
              }
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ring-2 transition-transform group-hover:scale-125 shrink-0 ${dotColor}`}
              />
              <span
                className={`text-[9.5px] font-mono font-bold ${
                  darkSurface
                    ? "text-slate-300"
                    : isLeg
                    ? "text-purple-600 dark:text-purple-400"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {isLeg ? `↳${row.sectorNumber}` : "S1"}
              </span>
            </button>
          );
        };

        const renderNotesCellContent = (row, darkSurface = false) => {
          const f = row.flight;
          const isLeg = !row.isMain;
          const hasAnyPerm = canEdit || canDelete || canViewForms;
          const hasPrivate = Boolean(f?.privateNotes && String(f.privateNotes).trim());
          return (
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  openFlightDrawer(f, isLeg ? row.legIdx : -1, "trip");
                }}
                className="flex items-center gap-1 min-w-0 flex-1 cursor-pointer group"
                title={
                  row.notes || hasPrivate
                    ? `${row.notes || ""}${hasPrivate ? `\n🔒 ملاحظات خاصة: ${f.privateNotes}` : ""}`
                    : isAr
                    ? "إضافة أو عرض ملاحظات الرحلة"
                    : "View or edit flight notes"
                }
              >
                {hasPrivate && (
                  <Lock
                    className="w-3 h-3 text-amber-500 shrink-0"
                    title={isAr ? "توجد ملاحظات خاصة للرحلة" : "Private notes available"}
                  />
                )}
                {row.notes ? (
                  <span
                    className="text-[10px] truncate max-w-[140px] group-hover:underline"
                    style={{ color: darkSurface ? "#cbd5e1" : "var(--text-muted)" }}
                  >
                    {row.notes}
                  </span>
                ) : hasPrivate ? (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                    {isAr ? "ملاحظة خاصة" : "Private note"}
                  </span>
                ) : (
                  <span className="text-[10px] italic opacity-35">—</span>
                )}
                {row.permits && (
                  <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
                    P
                  </span>
                )}
                {row.services && (
                  <span className="text-[9px] px-1 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                    S
                  </span>
                )}
              </div>

              {hasAnyPerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({
                      flight: f,
                      legIdx: isLeg ? row.legIdx : -1,
                      x: rect.left,
                      y: rect.bottom + 4,
                    });
                  }}
                  className={`p-1 rounded transition border shrink-0 cursor-pointer ${
                    darkSurface
                      ? "bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                  }`}
                  title={isAr ? "القائمة المنسدلة للرحلة" : "Flight Options Menu"}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        };

        /* ── DESIGN 2: EXECUTIVE FLIGHT STRIPS (Rotation-Grouped Cards) ── */
        if (scheduleDesign === "executive_strips") {
          return (
            <div className="flex-1 min-h-0 overflow-auto p-1 space-y-2.5">
              {filtered.length === 0 ? (
                <div
                  className="p-12 rounded-xl border text-center text-sm"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  {t.noFlights} — {dateLabel}
                </div>
              ) : (
                filtered.map((f) => {
                  const sectorRows = rowsToDisplay.filter((r) => r.flight.id === f.id);
                  const ft = getFlightType(f.flightType);
                  const anySectorSelected = sectorRows.some((r) =>
                    selectedRowKeys.includes(r.key)
                  );
                  return (
                    <div
                      key={f.id}
                      className={`rounded-xl border transition overflow-hidden ${
                        anySectorSelected ? "ring-1 ring-sky-500" : ""
                      }`}
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-default)",
                      }}
                    >
                      {/* Rotation Strip Header */}
                      <div
                        className="px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs"
                        style={{
                          backgroundColor: "var(--bg-app)",
                          borderColor: "var(--border-default)",
                        }}
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openFlightDrawer(f, -1, "flight")}
                            className="font-mono font-black text-sm hover:underline cursor-pointer"
                            style={{ color: "var(--brand-primary)" }}
                          >
                            {f.flightNo}
                          </button>
                          <span className="text-[11px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                            {f.acft || "—"}
                          </span>
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            · {ft.key} · {sectorRows.length} {isAr ? (sectorRows.length > 1 ? "سكترات مستقلة" : "سكتر") : (sectorRows.length > 1 ? "sectors" : "sector")}
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {isAr ? "تحديد ومعالجة كل سكتر بشكل مستقل" : "Independent per-sector control"}
                        </span>
                      </div>

                      {/* Chained Independent Sector Rows */}
                      <div className="divide-y" style={{ borderColor: "var(--border-default)" }}>
                        {sectorRows.map((row) => {
                          const { day, date } = fmtDateParts(row.std, timeMode);
                          const isLeg = !row.isMain;
                          const isRowSel = selectedRowKeys.includes(row.key);
                          const crewMembersList = [];
                          ALL_COLUMN_POSITIONS.forEach((pos) => {
                            crewByPosDetailed(row, pos).forEach((m) => {
                              crewMembersList.push({ pos, m });
                            });
                          });
                          return (
                            <div
                              key={row.key}
                              onContextMenu={(e) =>
                                handleContextMenu(e, f, isLeg ? row.legIdx : -1, row.key)
                              }
                              className={`px-3 py-2.5 flex flex-wrap items-center justify-between gap-3 transition ${
                                isRowSel
                                  ? "bg-blue-50/70 dark:bg-blue-900/20"
                                  : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                              }`}
                            >
                              {/* Per-Sector Dot (JL) + Checkbox + Time/Route */}
                              <div className="flex items-center gap-2.5 min-w-[270px]">
                                <input
                                  type="checkbox"
                                  checked={isRowSel}
                                  onChange={() => toggleSelect(row.key)}
                                  className="w-3.5 h-3.5 cursor-pointer"
                                />
                                {renderSectorDot(row)}

                                <div>
                                  <div className="flex items-center gap-2 font-mono text-xs font-bold">
                                    <span>{fmtTime(row.std, timeMode)}</span>
                                    {renderAirportCell(row.dep, row)}
                                    <span style={{ color: "var(--text-muted)" }}>→</span>
                                    {renderAirportCell(row.arr, row)}
                                    <span>{fmtTime(row.sta, timeMode)}</span>
                                  </div>
                                  <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                                    {row.flightNo} · {day} {date} · {row.flightNature === "FERRY" ? "FERRY" : `PAX (${row.pax ?? 0})`}
                                    {row.altn ? ` · ALTN ${row.altn}` : ""}
                                  </div>
                                </div>
                              </div>

                              {/* Per-Sector Crew */}
                              <div className="flex flex-wrap items-center gap-1 flex-1 min-w-[180px]">
                                {crewMembersList.length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => openFlightDrawer(f, isLeg ? row.legIdx : -1, "crew")}
                                    className="text-[11px] italic hover:underline cursor-pointer"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    {isAr ? "+ تعيين طاقم لهذا السكتر" : "+ Assign sector crew"}
                                  </button>
                                ) : (
                                  crewMembersList.map(({ pos, m }, ci) => {
                                    const sc = getShortCodeWithColor(m, pos);
                                    const dailyFtl = getCrewDailyFtlStats(m.id, row.std, flights);
                                    return (
                                      <CrewContactCard key={ci} member={m} dateStr={row.std} flights={flights}>
                                        <span
                                          onClick={() => openFlightDrawer(f, isLeg ? row.legIdx : -1, "crew", m.id)}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                                            dailyFtl?.isExceeded ? "bg-rose-600 text-white border-rose-700" : sc.color
                                          }`}
                                        >
                                          {POSITION_LABELS[pos]?.short || pos}: {m.empNo || sc.code}
                                        </span>
                                      </CrewContactCard>
                                    );
                                  })
                                )}
                              </div>

                              {/* Flight Status + Notes + Dropdown Trigger */}
                              <div className="flex items-center gap-2.5 shrink-0 min-w-[200px] justify-end">
                                {renderFlightStatusControl(row)}
                                <div className="min-w-[130px]">
                                  {renderNotesCellContent(row)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        }

        /* ── DESIGN 5: AIRPORT FIDS EXECUTIVE BOARD ── */
        if (scheduleDesign === "fids_board") {
          return (
            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-sm overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs border-collapse font-mono tabular-nums">
                  <thead className="sticky top-0 z-20 bg-black text-amber-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-2 py-2.5 text-center w-14">JL</th>
                      <th className="px-2 py-2.5 text-center w-8">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 cursor-pointer"
                          checked={
                            rowsToDisplay.length > 0 &&
                            selectedRowKeys.length === rowsToDisplay.length
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-start">FLIGHT</th>
                      <th className="px-3 py-2.5 text-center">STD</th>
                      <th className="px-3 py-2.5 text-start">ORIGIN (ADEP)</th>
                      <th className="px-3 py-2.5 text-start">DESTINATION (ADES)</th>
                      <th className="px-3 py-2.5 text-center">STA</th>
                      <th className="px-3 py-2.5 text-center">ACFT</th>
                      <th className="px-3 py-2.5 text-start">CREW</th>
                      <th className="px-3 py-2.5 text-center">PAX</th>
                      <th className="px-2 py-2.5 text-center">STATUS</th>
                      <th className="px-3 py-2.5 text-start">NOTES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {rowsToDisplay.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="p-12 text-center text-slate-400">
                          {t.noFlights} — {dateLabel}
                        </td>
                      </tr>
                    ) : (
                      rowsToDisplay.map((row) => {
                        const f = row.flight;
                        const isLeg = !row.isMain;
                        const isRowSel = selectedRowKeys.includes(row.key);
                        const depInfo = airportDetailsMap[String(row.dep || "").toUpperCase()];
                        const arrInfo = airportDetailsMap[String(row.arr || "").toUpperCase()];
                        const crewShortList = [];
                        ALL_COLUMN_POSITIONS.forEach((pos) => {
                          crewByPosDetailed(row, pos).forEach((m) => {
                            crewShortList.push({ pos, m });
                          });
                        });
                        return (
                          <tr
                            key={row.key}
                            onContextMenu={(e) =>
                              handleContextMenu(e, f, isLeg ? row.legIdx : -1, row.key)
                            }
                            onDoubleClick={() => canEdit && openEdit(f, isLeg ? row.legIdx : -1)}
                            className={`transition ${
                              isRowSel ? "bg-sky-950/60" : "hover:bg-slate-900/90"
                            }`}
                          >
                            <td className="px-2 py-2.5 text-center">
                              {renderSectorDot(row, true)}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={isRowSel}
                                onChange={() => toggleSelect(row.key)}
                                className="w-3.5 h-3.5 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-black text-sm text-amber-300">
                              <button
                                type="button"
                                onClick={() => openFlightDrawer(f, isLeg ? row.legIdx : -1, "flight")}
                                className="hover:underline cursor-pointer"
                              >
                                {row.flightNo}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-sm text-white">
                              {fmtTime(row.std, timeMode)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {renderAirportCell(row.dep, row, true)}
                                {depInfo?.city && (
                                  <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                                    {depInfo.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                {renderAirportCell(row.arr, row, true)}
                                {arrInfo?.city && (
                                  <span className="text-[11px] text-slate-400 truncate max-w-[110px]">
                                    {arrInfo.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-300">
                              {fmtTime(row.sta, timeMode)}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-sky-300">
                              {row.acft || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1 max-w-[200px]">
                                {crewShortList.length === 0 ? (
                                  <span className="text-slate-600">—</span>
                                ) : (
                                  crewShortList.slice(0, 4).map(({ pos, m }, ci) => (
                                    <CrewContactCard key={ci} member={m} dateStr={row.std} flights={flights}>
                                      <span
                                        onClick={() => openFlightDrawer(f, isLeg ? row.legIdx : -1, "crew", m.id)}
                                        className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-200 cursor-pointer hover:border-amber-400"
                                      >
                                        {POSITION_LABELS[pos]?.short || pos}:{m.empNo || getShortCode(m)}
                                      </span>
                                    </CrewContactCard>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-300">
                              {row.flightNature === "FERRY" ? "FERRY" : `${row.pax ?? 0}`}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              {renderFlightStatusControl(row, true)}
                            </td>
                            <td className="px-3 py-2.5 min-w-[150px]">
                              {renderNotesCellContent(row, true)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        /* ── DESIGNS 1, 3, 4: STRUCTURED TABLE VARIATIONS (dispatch_grid | avionics_cockpit | compact_matrix) ── */
        const isAvionics = scheduleDesign === "avionics_cockpit";
        const isCompact = scheduleDesign === "compact_matrix";

        return (
          <div
            className={`flex-1 min-h-0 flex flex-col rounded-xl border shadow-xs overflow-hidden ${
              isAvionics ? "bg-[#070d18] text-slate-100 border-slate-800" : ""
            }`}
            style={
              isAvionics
                ? undefined
                : {
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                  }
            }
          >
            <div className="flex-1 overflow-auto">
              <table
                className={`w-full border-collapse font-mono tabular-nums ${
                  isCompact ? "text-[11px]" : "text-xs"
                }`}
              >
                <thead
                  className={`text-[11px] uppercase tracking-wider sticky top-0 z-20 shadow-xs ${
                    isAvionics
                      ? "bg-[#020617] text-cyan-400 border-b border-slate-800"
                      : "backdrop-blur-md"
                  }`}
                  style={
                    isAvionics
                      ? undefined
                      : {
                          backgroundColor: "var(--bg-card)",
                          color: "var(--text-muted)",
                        }
                  }
                >
                  <tr>
                    <th
                      className="px-2 py-2 border-r w-8"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    ></th>
                    <th
                      className="px-2 py-2 border-r w-8 text-center"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 cursor-pointer"
                        checked={
                          rowsToDisplay.length > 0 &&
                          selectedRowKeys.length === rowsToDisplay.length
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th
                      className="px-2 py-2 border-r text-start font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      {t.flightNo}
                    </th>
                    <th
                      className="px-2 py-2 border-r text-center font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      TYPE
                    </th>
                    <th
                      className="px-2 py-2 border-r text-center font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      DAY
                    </th>
                    <th
                      className="px-2 py-2 border-r text-start font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      DATE
                    </th>
                    <th
                      className="px-2 py-2 border-r text-center font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      STD
                    </th>
                    <th
                      className="px-2 py-2 border-r text-start font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      ADEP
                    </th>
                    <th
                      className="px-2 py-2 border-r text-start font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      ADES
                    </th>
                    <th
                      className="px-2 py-2 border-r text-center font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      STA
                    </th>
                    <th
                      className="px-2 py-2 border-r text-center font-bold"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      ACFT
                    </th>
                    {positionsToShow.map((pos) => (
                      <th
                        key={pos}
                        className="px-2 py-2 border-r text-center font-bold"
                        style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                      >
                        {POSITION_LABELS[pos]?.short || pos.toUpperCase()}
                      </th>
                    ))}
                    <th
                      className="px-2 py-2 border-r text-center font-bold whitespace-nowrap text-[10px]"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      PAX / FERRY
                    </th>
                    <th
                      className="px-1.5 py-2 border-r text-center font-bold whitespace-nowrap text-[10px]"
                      style={{ borderColor: isAvionics ? "#1e293b" : "var(--border-default)" }}
                    >
                      STATUS
                    </th>
                    <th className="px-2 py-2 text-start font-bold">NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsToDisplay.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14 + positionsToShow.length}
                        className="p-10 text-center text-sm"
                        style={{ color: isAvionics ? "#94a3b8" : "var(--text-muted)" }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span>
                            {t.noFlights} — {dateLabel}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rowsToDisplay.map((row) => {
                      const f = row.flight;
                      const completed = isCompleted(row);
                      const { day, date } = fmtDateParts(row.std, timeMode);
                      const isSelected = selectedRowKeys.includes(row.key);
                      const ft = getFlightType(row.flightType);
                      const isLeg = !row.isMain;
                      const cellPy = isCompact ? "py-1" : "py-1.5";
                      const bdrColor = isAvionics ? "#1e293b" : "var(--border-default)";

                      return (
                        <tr
                          key={row.key}
                          onContextMenu={(e) =>
                            handleContextMenu(e, f, isLeg ? row.legIdx : -1, row.key)
                          }
                          onDoubleClick={() => {
                            if (canEdit) openEdit(f, isLeg ? row.legIdx : -1);
                          }}
                          className={`cursor-context-menu transition-colors border-b ${
                            isAvionics
                              ? isSelected
                                ? "bg-cyan-950/50"
                                : isLeg
                                ? "bg-[#0a1324] hover:bg-[#101c33]"
                                : "hover:bg-[#0f1a2e]"
                              : isSelected
                              ? "bg-blue-50 dark:bg-blue-900/20"
                              : isLeg
                              ? "bg-slate-50/70 dark:bg-slate-900/25 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                          style={{ borderColor: bdrColor }}
                        >
                          <td
                            className={`px-2 ${cellPy} border-r cursor-pointer select-none text-center`}
                            style={{ borderColor: bdrColor }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openFlightDrawer(f, isLeg ? row.legIdx : -1, "jl");
                            }}
                            title={
                              isAr
                                ? "اضغط لفتح الرحلة المكتملة وسجل الرحلة (Journey Log)"
                                : "Click to open Completed Flight & Journey Log (JL)"
                            }
                          >
                            <div className="flex items-center justify-center">
                              {renderSectorDot(row, isAvionics)}
                            </div>
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center`}
                            style={{ borderColor: bdrColor }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(row.key)}
                              className="w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center font-bold font-mono cursor-pointer hover:underline ${
                              isAvionics ? "text-cyan-300" : "hover:text-sky-600 dark:hover:text-sky-400"
                            }`}
                            style={{
                              borderColor: bdrColor,
                              color: isAvionics ? undefined : "var(--text-primary)",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openFlightDrawer(f, isLeg ? row.legIdx : -1, "flight");
                            }}
                            title="اضغط لفتح القائمة الجانبية (Flight Ops Drawer)"
                          >
                            {row.flightNo || f.flightNo}
                            {completed && (
                              <span className="ms-1 text-[9px] text-emerald-500">✓</span>
                            )}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center whitespace-nowrap`}
                            style={{ borderColor: bdrColor }}
                          >
                            {isCompact ? (
                              <span className="text-[10px] font-semibold opacity-80">{ft.key}</span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center gap-1 text-[10px] font-bold"
                                style={{ color: isAvionics ? "#94a3b8" : "var(--brand-primary)" }}
                              >
                                <FlightTypeIcon ft={ft} size="w-3 h-3" />
                                <span className="hidden md:inline">{ft.key}</span>
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center`}
                            style={{ borderColor: bdrColor, color: isAvionics ? "#94a3b8" : "var(--text-muted)" }}
                          >
                            {day}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r whitespace-nowrap`}
                            style={{ borderColor: bdrColor, color: isAvionics ? "#94a3b8" : "var(--text-muted)" }}
                          >
                            {date}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center font-mono font-bold`}
                            style={{ borderColor: bdrColor, color: isAvionics ? "#f8fafc" : "var(--text-primary)" }}
                          >
                            {fmtTime(row.std, timeMode)}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r font-mono font-bold`}
                            style={{ borderColor: bdrColor }}
                          >
                            {renderAirportCell(row.dep, row, isAvionics)}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center font-mono font-bold`}
                            style={{ borderColor: bdrColor }}
                          >
                            {renderAirportCell(row.arr, row, isAvionics)}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center font-mono`}
                            style={{ borderColor: bdrColor, color: isAvionics ? "#cbd5e1" : "var(--text-muted)" }}
                          >
                            {fmtTime(row.sta, timeMode)}
                          </td>
                          <td
                            className={`px-2 ${cellPy} border-r text-center font-mono font-bold`}
                            style={{
                              borderColor: bdrColor,
                              backgroundColor: isAvionics ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.1)",
                              color: isAvionics ? "#fde68a" : "var(--text-primary)",
                            }}
                          >
                            {row.acft}
                          </td>
                          {positionsToShow.map((pos) => {
                            const members = crewByPosDetailed(row, pos);
                            return (
                              <td
                                key={pos}
                                className={`px-2 ${cellPy} border-r text-center`}
                                style={{ borderColor: bdrColor }}
                              >
                                {members.length > 0 ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {members.map((m, idx) => {
                                      const sc = getShortCodeWithColor(m, pos);
                                      const dailyFtl = getCrewDailyFtlStats(m.id, row.std, flights);
                                      const isExceeded = dailyFtl?.isExceeded;
                                      return (
                                        <CrewContactCard
                                          key={idx}
                                          member={m}
                                          dateStr={row.std}
                                          flights={flights}
                                        >
                                          <span
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openFlightDrawer(f, isLeg ? row.legIdx : -1, "crew", m.id);
                                            }}
                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 transition cursor-pointer hover:scale-105 ${
                                              isExceeded
                                                ? "bg-rose-600 text-white border-rose-700 font-black"
                                                : sc.color
                                            }`}
                                            title={`${m.fullName} (${m.role}${
                                              pos !== m.role ? ` @ ${pos}` : ""
                                            })${
                                              isExceeded
                                                ? ` - ⚠️ تجاوز الحد اليومي FTL (${dailyFtl.actualStr} / ${dailyFtl.maxStr})`
                                                : ""
                                            }`}
                                          >
                                            {m.empNo || sc.code}
                                          </span>
                                        </CrewContactCard>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="opacity-35">—</span>
                                )}
                              </td>
                            );
                          })}
                          {/* PAX / FERRY Column */}
                          <td
                            className={`px-2 ${cellPy} border-r text-center whitespace-nowrap`}
                            style={{ borderColor: bdrColor }}
                          >
                            {row.flightNature === "FERRY" ? (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                FERRY
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                                PAX{row.pax !== undefined && row.pax !== null && row.pax !== "" ? ` · ${row.pax}` : ""}
                              </span>
                            )}
                          </td>

                          {/* FLIGHT STATUS Column (Per-Sector) */}
                          <td
                            className={`px-1.5 ${cellPy} border-r text-center whitespace-nowrap`}
                            style={{ borderColor: bdrColor }}
                          >
                            {renderFlightStatusControl(row, isAvionics)}
                          </td>

                          <td className={`px-2 ${cellPy} min-w-[175px]`}>
                            {renderNotesCellContent(row, isAvionics)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ CALENDAR VIEW ═══ */}
      {viewMode === "calendar" && (
        <CalendarView
          flights={flights}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          timeMode={timeMode}
          isPast={isPast}
          crew={crew}
          onSelectFlight={(flight) => setNotesModal(flight)}
        />
      )}

      {/* ═══ TIMELINE VIEW ═══ */}
      {viewMode === "timeline" && (
        <TimelineView flights={filtered} timeMode={timeMode} isPast={isPast} />
      )}

      {/* ═══ Context Menu ═══ */}
      {contextMenu && (
        <FlightContextMenu
          flight={
            contextMenu.bulk
              ? {
                  bulk: true,
                  ids: contextMenu.ids,
                  rowKeys: contextMenu.rowKeys,
                }
              : contextMenu.flight
          }
          legIdx={contextMenu.legIdx ?? -1}
          x={contextMenu.x}
          y={contextMenu.y}
          user={user}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Modals */}
      {notesModal && (
        <FlightNotesModal
          flight={notesModal}
          onClose={() => setNotesModal(null)}
          onSave={saveNotesAndPermits}
        />
      )}

      {completeFlight && (
        <CompleteFlightModal
          flight={completeFlight.flight || completeFlight}
          initialLegIdx={completeFlight.legIdx ?? -1}
          fleet={fleet}
          crew={crew}
          onClose={() => setCompleteFlight(null)}
          onSave={saveCompleteFlight}
        />
      )}

      {activeOpFormModal && (
        <OperationalFormFillModal
          form={activeOpFormModal.form}
          flight={activeOpFormModal.flight}
          selectedFlights={activeOpFormModal.selectedFlights || []}
          flights={flights}
          fleet={fleet}
          camoList={camoList}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setActiveOpFormModal(null)}
        />
      )}

      {/* ⭐ v7.6 — GenDec Multi Modal (Pagination) */}
      {genDecMultiFlights && (
        <GenDecMultiModal
          flights={genDecMultiFlights}
          crew={crew}
          settings={settings}
          user={user}
          onClose={() => setGenDecMultiFlights(null)}
        />
      )}

      {/* ⭐ v7.6 — Bulk Edit Legs Modal */}
      {bulkEditLegsFlights && (
        <BulkEditLegsModal
          flights={bulkEditLegsFlights}
          fleet={fleet}
          onClose={() => setBulkEditLegsFlights(null)}
          onSave={saveBulkEditLegs}
        />
      )}

      {/* ═══ Flight Ops Side Drawer (كما في الصور 2 و 3 و 4) ═══ */}
      {drawerOpen && draft && (
        <FlightOpsDrawer
          isOpen={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);
            setEditing(null);
            setModalOpen(false);
          }}
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          onDelete={remove}
          saving={saving}
          fleet={fleet}
          crew={crew}
          flights={flights}
          canEdit={canEdit}
          canDelete={canDelete}
          canAssignCrew={canAssignCrew}
          canViewTripHistory={canViewTripHistory}
          canEditJl={canEditJl}
          initialTab={drawerInitialTab}
          initialCrewId={drawerInitialCrewId}
          targetLegIdx={drawerLegIdx}
          onChangeTargetLegIdx={(idx) => setDrawerLegIdx(idx)}
          lang={t.locale || "ar"}
        />
      )}

      {/* ═══ Edit Modal (Flight Add / Edit) ═══ */}
      <Modal
        open={modalOpen && !drawerOpen}
        title={editing === "new" ? "NEW FLIGHT" : "EDIT FLIGHT"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        wide
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={addLeg}
              className="px-2.5 py-1 rounded-md border border-dashed text-xs font-bold flex items-center gap-1.5 transition text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40"
              style={{ borderColor: "var(--brand-primary)" }}
            >
              <Plus className="w-3.5 h-3.5" /> + ADD SECTOR
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setModalOpen(false);
                  setEditing(null);
                }}
                className="px-3 py-1.5 rounded-md text-xs font-bold border disabled:opacity-50"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {t.cancel || "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="px-4 py-1.5 rounded-md text-xs font-bold text-white flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                style={{ background: "var(--brand-gradient)" }}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving..." : (t.save || "SAVE")}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-2.5 text-xs">
          {/* Main Flight Info: FLT NO | TYPE | DATE | ACFT */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50/80 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">FLT NO</label>
              <Input
                value={draft.flightNo || ""}
                onChange={(e) => setDraft({ ...draft, flightNo: e.target.value.toUpperCase() })}
                placeholder="GAK881"
                autoComplete="off"
                className="text-xs h-8 uppercase font-mono font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">TYPE</label>
              <Select
                value={draft.flightType || "SCHEDULED"}
                onChange={(e) => setDraft({ ...draft, flightType: e.target.value })}
                className="text-xs h-8 font-semibold"
              >
                {FLIGHT_TYPES.map((ft) => (
                  <option key={ft.key} value={ft.key}>
                    {ft.key}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">DATE</label>
              <Input
                type="date"
                value={draft.date || ""}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="text-xs h-8 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ACFT</label>
              <Select
                value={draft.acft || ""}
                onChange={(e) => setDraft({ ...draft, acft: e.target.value })}
                className="text-xs h-8 font-mono font-bold"
              >
                <option value="">— ACFT —</option>
                {fleet.map((a) => (
                  <option key={a.id || a.reg} value={a.reg}>
                    {a.reg} ({a.type})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Sector 1 (Main Sector) */}
          <div
            className="p-2 rounded-lg border space-y-1.5"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <PlaneTakeoff className="w-3.5 h-3.5 text-sky-500" />
                <span>SECTOR 1 (MAIN)</span>
              </span>

              {/* PAX / FERRY */}
              <div className="inline-flex p-0.5 rounded-md border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, flightNature: "PAX" })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                    (draft.flightNature || "PAX") === "PAX"
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  PAX
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, flightNature: "FERRY", pax: 0 })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                    draft.flightNature === "FERRY"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  FERRY
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">DEP</label>
                <AirportInput
                  value={draft.dep || ""}
                  onChange={(v) => setDraft({ ...draft, dep: v })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ARR</label>
                <AirportInput
                  value={draft.arr || ""}
                  onChange={(v) => setDraft({ ...draft, arr: v })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">STD (4D)</label>
                <Time24Input
                  value={draft.std || ""}
                  onChange={(val) => setDraft({ ...draft, std: val })}
                  compact={true}
                  placeholder="1200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">STA (4D)</label>
                <Time24Input
                  value={draft.sta || ""}
                  onChange={(val) => setDraft({ ...draft, sta: val })}
                  compact={true}
                  placeholder="1330"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                  {draft.flightNature === "FERRY" ? "TYPE" : "PAX"}
                </label>
                {draft.flightNature === "FERRY" ? (
                  <div className="h-8 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
                    FERRY (0)
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    value={draft.pax !== undefined && draft.pax !== null ? draft.pax : ""}
                    onChange={(e) => setDraft({ ...draft, pax: e.target.value })}
                    placeholder="0"
                    className="h-8 text-xs font-mono"
                  />
                )}
              </div>
            </div>

            {/* Sector 1 Independent Status / ALTN / Cargo / Notes */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">S1 STATUS</label>
                <Select
                  value={draft.status || "SCHEDULED"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value,
                      statusManual: true,
                    })
                  }
                  className="h-7 text-[11px] font-semibold"
                >
                  {FLIGHT_STATUSES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {isAr ? st.ar : st.en}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ALTN 1</label>
                <AirportInput
                  value={draft.altn || ""}
                  onChange={(v) => setDraft({ ...draft, altn: v })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">CARGO (KG)</label>
                <Input
                  type="number"
                  min="0"
                  value={draft.cargo ?? ""}
                  onChange={(e) => setDraft({ ...draft, cargo: e.target.value })}
                  placeholder="0"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">S1 NOTES</label>
                <Input
                  value={draft.notes || ""}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Sector 1 notes..."
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Additional Sectors (Legs — Independent Per Sector Yet Chained) */}
          {(draft.legs || []).map((leg, idx) => {
            const legNature = leg.flightNature || draft.flightNature || "PAX";
            return (
              <div
                key={idx}
                className="p-2 rounded-lg border space-y-1.5 relative"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                }}
              >
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      <PlaneTakeoff className="w-3.5 h-3.5 text-purple-500" />
                      <span>SECTOR {idx + 2}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setModalCrewSectorIdx(idx)}
                      className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      · {safeArray(leg.crewSlots).filter((s) => s.crewId).length} طاقم
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="inline-flex p-0.5 rounded-md border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => updateLeg(idx, { flightNature: "PAX" })}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          legNature === "PAX"
                            ? "bg-sky-600 text-white shadow-2xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        PAX
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLeg(idx, { flightNature: "FERRY", pax: 0 })}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                          legNature === "FERRY"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        FERRY
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLeg(idx)}
                      className="p-1 text-rose-500 hover:bg-rose-500/10 rounded transition"
                      title="حذف هذا القطاع"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">LEG FLT</label>
                    <Input
                      value={leg.flightNo || ""}
                      onChange={(e) => updateLeg(idx, { flightNo: e.target.value.toUpperCase() })}
                      placeholder={draft.flightNo || "FLT"}
                      className="h-8 text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">DEP</label>
                    <AirportInput
                      value={leg.dep || ""}
                      onChange={(v) => updateLeg(idx, { dep: v })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ARR</label>
                    <AirportInput
                      value={leg.arr || ""}
                      onChange={(v) => updateLeg(idx, { arr: v })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">DATE</label>
                    <Input
                      type="date"
                      value={leg.date || draft.date || ""}
                      onChange={(e) => updateLeg(idx, { date: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">STD / STA (4D)</label>
                    <div className="grid grid-cols-2 gap-1">
                      <Time24Input
                        value={leg.std || ""}
                        onChange={(val) => updateLeg(idx, { std: val })}
                        compact={true}
                        placeholder="1200"
                      />
                      <Time24Input
                        value={leg.sta || ""}
                        onChange={(val) => updateLeg(idx, { sta: val })}
                        compact={true}
                        placeholder="1330"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">PAX</label>
                    {legNature === "FERRY" ? (
                      <div className="h-8 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center font-mono">
                        FERRY
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        value={leg.pax !== undefined && leg.pax !== null ? leg.pax : ""}
                        onChange={(e) => updateLeg(idx, { pax: e.target.value })}
                        placeholder="0"
                        className="h-8 text-xs font-mono"
                      />
                    )}
                  </div>
                </div>

                {/* Sector N Independent Status / ALTN / Cargo / Notes */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">STATUS</label>
                    <Select
                      value={leg.status || "SCHEDULED"}
                      onChange={(e) =>
                        updateLeg(idx, { status: e.target.value, statusManual: true })
                      }
                      className="h-7 text-[11px] font-semibold"
                    >
                      {FLIGHT_STATUSES.map((st) => (
                        <option key={st.key} value={st.key}>
                          {isAr ? st.ar : st.en}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ALTN</label>
                    <AirportInput
                      value={leg.altn || ""}
                      onChange={(v) => updateLeg(idx, { altn: v })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">CARGO (KG)</label>
                    <Input
                      type="number"
                      min="0"
                      value={leg.cargo ?? ""}
                      onChange={(e) => updateLeg(idx, { cargo: e.target.value })}
                      placeholder="0"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">S{idx + 2} NOTES</label>
                    <Input
                      value={leg.notes || ""}
                      onChange={(e) => updateLeg(idx, { notes: e.target.value })}
                      placeholder={`Sector ${idx + 2} notes...`}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* PERMITS & SERVICES & PRIVATE NOTES (Flight Dispatch) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">ALTN 2 (MAIN)</label>
              <AirportInput
                value={draft.altn2 || ""}
                onChange={(v) => setDraft({ ...draft, altn2: v })}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">PERMITS</label>
              <textarea
                value={draft.permits || ""}
                onChange={(e) => setDraft({ ...draft, permits: e.target.value })}
                rows="1"
                placeholder="Permits..."
                className="w-full px-2.5 py-1 rounded-md text-xs border outline-none resize-none focus:ring-1 focus:ring-sky-500"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">SERVICES</label>
              <textarea
                value={draft.services || ""}
                onChange={(e) => setDraft({ ...draft, services: e.target.value })}
                rows="1"
                placeholder="Services..."
                className="w-full px-2.5 py-1 rounded-md text-xs border outline-none resize-none focus:ring-1 focus:ring-sky-500"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1 mb-0.5">
                <Lock className="w-3 h-3" />
                <span>{isAr ? "ملاحظات خاصة للرحلة" : "PRIVATE NOTES"}</span>
              </label>
              <textarea
                value={draft.privateNotes || ""}
                onChange={(e) => setDraft({ ...draft, privateNotes: e.target.value })}
                rows="1"
                placeholder={isAr ? "ملاحظات خاصة (تظهر في البيانات)..." : "Private notes..."}
                className="w-full px-2.5 py-1 rounded-md text-xs border border-amber-500/40 bg-amber-500/5 outline-none resize-none focus:ring-1 focus:ring-amber-500"
                style={{
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* INDEPENDENT PER-SECTOR CREW ASSIGNMENT */}
          {(canAssignCrew || canEdit) && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {isAr
                    ? `تعيين طاقم السكتر ${modalCrewSectorIdx === -1 ? 1 : modalCrewSectorIdx + 2} (${activeModalCrewSlots.length})`
                    : `CREW ASSIGNMENT — S${modalCrewSectorIdx === -1 ? 1 : modalCrewSectorIdx + 2} (${activeModalCrewSlots.length})`}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {modalCrewSectorIdx >= 0 && (
                    <button
                      type="button"
                      onClick={copySector1CrewToActiveModalLeg}
                      className="px-2 py-1 rounded-md text-[11px] font-bold border hover:border-sky-500 transition flex items-center gap-1"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        borderColor: "var(--border-default)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      <span>{isAr ? "نسخ طاقم S1" : "Copy S1 Crew"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addSlot}
                    className="px-2.5 py-1 rounded-md text-xs font-bold text-white shadow-2xs flex items-center gap-1 transition"
                    style={{ background: "var(--brand-gradient)" }}
                  >
                    <Plus className="w-3 h-3" /> + ADD POSITION
                  </button>
                </div>
              </div>

              {(draft.legs || []).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setModalCrewSectorIdx(-1)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition ${
                      modalCrewSectorIdx === -1 ? "text-white border-transparent" : ""
                    }`}
                    style={
                      modalCrewSectorIdx === -1
                        ? { background: "var(--brand-gradient)" }
                        : {
                            backgroundColor: "var(--bg-app)",
                            borderColor: "var(--border-default)",
                            color: "var(--text-primary)",
                          }
                    }
                  >
                    S1: {draft.dep || "---"}→{draft.arr || "---"} ({safeArray(draft.crewSlots).filter((s) => s.crewId).length})
                  </button>
                  {(draft.legs || []).map((leg, li) => (
                    <button
                      key={li}
                      type="button"
                      onClick={() => setModalCrewSectorIdx(li)}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold border transition ${
                        modalCrewSectorIdx === li ? "text-white border-transparent" : ""
                      }`}
                      style={
                        modalCrewSectorIdx === li
                          ? { background: "var(--brand-gradient)" }
                          : {
                              backgroundColor: "var(--bg-app)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-primary)",
                            }
                      }
                    >
                      S{li + 2}: {leg.dep || "---"}→{leg.arr || "---"} ({safeArray(leg.crewSlots).filter((s) => s.crewId).length})
                    </button>
                  ))}
                </div>
              )}

              {modalActiveAcft && !aircraftHasCrewAssigned && (
                <div className="p-2 rounded-md text-[11px] flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>لا يوجد طاقم معين على الطائرة {modalActiveAcft}</span>
                </div>
              )}

              <div className="space-y-1.5">
                {activeModalCrewSlots.length === 0 ? (
                  <div
                    className="p-3 rounded-md border border-dashed text-center text-[11px]"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                  >
                    {isAr
                      ? "لم يتم تعيين طاقم لهذا السكتر بعد — اضغط (+ ADD POSITION) أو (نسخ طاقم S1)"
                      : "No crew assigned to this sector yet"}
                  </div>
                ) : (
                  activeModalCrewSlots.map((slot, i) => {
                    const usedPositions = activeModalCrewSlots
                      .filter((_, idx) => idx !== i)
                      .map((s) => s.position)
                      .filter(Boolean);
                    const allowedRoles = getAllowedRoles(slot.position);
                    const availableCrew = crew.filter((c) => {
                      if (String(c.status || "active").toLowerCase() !== "active") return false;
                      if (modalActiveAcft && !isCrewQualifiedForAircraft(c, modalActiveAcft)) return false;
                      if (allowedRoles.length > 0) {
                        const memberRoles = getMemberAllRoles(c);
                        if (!memberRoles.some((r) => allowedRoles.includes(r))) return false;
                      }
                      const assignedInOtherSlot = activeModalCrewSlots.some(
                        (s, idx) => idx !== i && String(s.crewId) === String(c.id)
                      );
                      if (assignedInOtherSlot) return false;
                      return true;
                    });

                    const availablePositions = POSITION_OPTIONS.filter(
                      (p) => !usedPositions.includes(p.key) || p.key === slot.position
                    );

                    return (
                      <div
                        key={i}
                        className="grid grid-cols-12 gap-2 items-center p-1.5 rounded-md border"
                        style={{
                          backgroundColor: "var(--bg-app)",
                          borderColor: "var(--border-default)",
                        }}
                      >
                        <div className="col-span-4">
                          <Select
                            value={slot.position || ""}
                            onChange={(e) => updateSlot(i, { position: e.target.value })}
                            className="h-8 text-xs font-bold"
                          >
                            {availablePositions.map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.short || p.key}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="col-span-7">
                          <Select
                            value={String(slot.crewId || "")}
                            onChange={(e) => updateSlot(i, { crewId: String(e.target.value) })}
                            className="h-8 text-xs font-mono"
                          >
                            <option value="">— SELECT CREW —</option>
                            {availableCrew.map((c) => {
                              const emp = c.empNo ? `[${c.empNo}] ` : "";
                              return (
                                <option key={c.id} value={String(c.id)}>
                                  {emp}{c.fullName}
                                </option>
                              );
                            })}
                          </Select>
                        </div>

                        <div className="col-span-1 text-end">
                          <button
                            type="button"
                            onClick={() => removeSlot(i)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
                            title="حذف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ScheduleBoard;
