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
  Stamp,
  FileX,
  Lock,
  ShieldAlert,
  Table,
  CalendarDays,
  List,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  Filter,
  MoreHorizontal,
  MoreVertical,
  PlaneTakeoff,
  Edit,
  Loader2,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
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
import { CalendarView } from "./CalendarView";
import { TimelineView } from "./TimelineView";
import {
  flightsAPI,
  sendFlightEmail,
  checkExpiryAlerts,
  writeSheetCache,
} from "../api";
import { listOperationalFormsSync } from "../utils/operationalFormsService";
import { triggerFlightWhatsAppNotifications } from "../utils/whatsapp";
import { logSafe } from "../utils/audit";
import { can as checkPerm } from "../config/permissions";
import { alertSuccess, alertError } from "../utils/sounds";
import { notifyFlightChange, notifyCrewChange } from "../utils/notifications";
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

const STATUS_LIST = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "IN_FLIGHT",
  "ARRIVED",
  "DELAYED",
  "CANCELLED",
];

export const computeAutoStatus = (flight) => {
  const actual = flight.actual || {};
  const hasStd = actual.std && String(actual.std).trim().length > 0;
  const hasSta = actual.sta && String(actual.sta).trim().length > 0;
  const hasCancel =
    actual.cancelled === true ||
    (actual.reason && String(actual.reason).trim().length > 0);
  if (hasCancel) return "CANCELLED";
  if (hasSta) return "ARRIVED";
  if (hasStd) return "DEPARTED";
  return flight.status || "SCHEDULED";
};

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
  onGenDec,
  setSyncStatus,
}) {
  const t = useT();
  const { user } = useAuth();

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
  const canGenDecStamp = checkPerm(user, "schedule.gendec_stamp");
  const canGenDecNoStamp = checkPerm(user, "schedule.gendec_no_stamp");

  /* ═══ State ═══ */
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});
  const [viewMode, setViewMode] = useState("table");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayISO());
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
    const onTmChange = (e) => {
      const next = e?.detail || window.__AEROOPS_TIME_MODE || "UTC";
      setTimeMode(String(next).toUpperCase());
    };
    window.addEventListener("aeroops:timeModeChanged", onTmChange);
    return () => window.removeEventListener("aeroops:timeModeChanged", onTmChange);
  }, []);
  const [rangeDays, setRangeDays] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [acftFilter, setAcftFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [completeFlight, setCompleteFlight] = useState(null);
  const [notesModal, setNotesModal] = useState(null);
  const [activeOpFormModal, setActiveOpFormModal] = useState(null);

  // ⭐ v7.6 — Modals جديدة
  const [genDecMultiFlights, setGenDecMultiFlights] = useState(null);
  const [bulkEditLegsFlights, setBulkEditLegsFlights] = useState(null);

  /* ═══ Helpers ═══ */
  const now = new Date();
  const getFlightTime = (f) => {
    if (!f?.std) return null;
    const d = new Date(f.std);
    return isNaN(d.getTime()) ? null : d;
  };

  const isCompleted = (f) => {
    const a = f.actual || {};
    const hasStd = a.std && String(a.std).trim().length > 0;
    const hasSta = a.sta && String(a.sta).trim().length > 0;
    const isCancelled = a.cancelled === true;
    return hasStd && hasSta && !isCancelled;
  };

  const isUpcoming = (f) => {
    const ft = getFlightTime(f);
    return ft ? ft.getTime() > now.getTime() - 30 * 60 * 1000 : false;
  };

  const isPast = (f) => {
    if (isCompleted(f)) return false;
    const ft = getFlightTime(f);
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
      const haystack = `${f.flightNo || ""} ${f.dep || ""} ${f.arr || ""} ${
        f.acft || ""
      }`.toLowerCase();
      const matchesSearch = !q || haystack.includes(q.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      if (acftFilter && f.acft !== acftFilter) return false;
      if (typeFilter && f.flightType !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const ta = getFlightTime(a)?.getTime() || 0;
      const tb = getFlightTime(b)?.getTime() || 0;
      return ta - tb;
    });

  /* ═══ Counters ═══ */
  const counters = {
    all: flights.filter(isInRange).length,
    upcoming: flights.filter((f) => isInRange(f) && isUpcoming(f)).length,
    past: flights.filter((f) => isInRange(f) && isPast(f)).length,
    completed: flights.filter((f) => isInRange(f) && isCompleted(f)).length,
  };

  /* ⭐ الأعمدة النشطة */
  const positionsToShow = useMemo(() => {
    const active = ALL_COLUMN_POSITIONS.filter((pos) =>
      filtered.some((f) =>
        safeArray(f.crewSlots).some((s) => s.position === pos && s.crewId)
      )
    );
    return active.length > 0 ? active : ALL_COLUMN_POSITIONS;
  }, [filtered, ALL_COLUMN_POSITIONS]);

  /* ═══ Crew helpers ═══ */
  const crewByPosDetailed = (f, pos) => {
    const slots = safeArray(f.crewSlots).filter((s) => s.position === pos);
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
    const key = positionKey || member.role;
    return {
      code,
      color: colorMap[key] || "bg-white/10 text-white border-white/20",
    };
  };

  /* ═══ Selection ═══ */
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([]);
    else setSelectedIds(filtered.map((f) => f.id));
  };

  /* ═══ CRUD ═══ */
  const openNew = () => {
    if (!canCreate) return showToast("⚠️ ليس لديك صلاحية إنشاء رحلات", "warning");
    setDraft({
      flightNo: "",
      flightNature: "PAX",
      pax: "",
      dep: "",
      arr: "",
      altn: "",
      altn2: "",
      date: selectedDate || todayISO(),
      std: "12:00",
      sta: "13:30",
      acft: "",
      status: "SCHEDULED",
      flightType: "SCHEDULED",
      notes: "",
      permits: "",
      services: "",
      cargo: 0,
      crewSlots: [],
      legs: [],
    });
    setEditing("new");
  };

  const openEdit = (f, targetLegIdx = -1) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية تعديل الرحلات", "warning");
    const mainDate = extractIsoDate(f.std, selectedDate || todayISO());
    let legs = [];
    if (Array.isArray(f.legs)) {
      legs = f.legs.map((l) => normalizeLegForEdit(l, mainDate));
    } else if (typeof f.legs === "string" && f.legs.trim()) {
      try {
        const parsed = JSON.parse(f.legs);
        if (Array.isArray(parsed))
          legs = parsed.map((l) => normalizeLegForEdit(l, mainDate));
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
      crewSlots: safeArray(f.crewSlots)
        .filter((s) => s && s.crewId && s.position)
        .map((s) => ({ ...s, crewId: String(s.crewId) })),
      actual: safeObject(f.actual),
      legs,
    });
    setEditing(f.id);
  };

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

    const legsIso = safeArray(draft.legs).map((l) => {
      const legPair = buildSectorIsoPair(
        l.date || safeDate,
        l.std || "12:00",
        l.sta || "13:30"
      );
      const legNature = l.flightNature || draft.flightNature || "PAX";
      const legPax = legNature === "FERRY" ? 0 : (l.pax !== undefined && l.pax !== null && l.pax !== "" ? Number(l.pax) : 0);
      return {
        ...l,
        flightNo: String(l.flightNo || draft.flightNo || "").trim().toUpperCase(),
        flightNature: legNature,
        pax: legPax,
        date: legPair.safeDate,
        dep: String(l.dep || "").trim().toUpperCase(),
        arr: String(l.arr || "").trim().toUpperCase(),
        std: legPair.stdIso,
        sta: legPair.staIso,
        acft: l.acft || draft.acft || "",
      };
    });

    const validCrewSlots = safeArray(draft.crewSlots).filter(
      (slot) =>
        slot &&
        String(slot.crewId || "").trim() !== "" &&
        String(slot.position || "").trim() !== ""
    );

    if (draft.acft && validCrewSlots.length > 0) {
      const unqualified = validCrewSlots.filter((slot) => {
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
        return showToast(`⚠️ الأعضاء غير مؤهلين للطائرة ${draft.acft}:\n${names}`, "warning");
      }
    }

    const autoStatus = computeAutoStatus({
      ...draft,
      std: stdIso,
      sta: staIso,
    });
    const enrichedSlots = validCrewSlots.map((slot) => {
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
        logSafe(user, "CREATE", "Flight", savedItem.id, finalDraft.flightNo, {});
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
        const targetId = String(editing);
        await flightsAPI.update(targetId, finalDraft);
        const savedItem = { ...finalDraft, id: targetId };
        setFlights((prev) => {
          const next = prev.map((f) =>
            String(f.id) === targetId ? savedItem : f
          );
          writeSheetCache("Flights", next);
          return next;
        });
        logSafe(user, "UPDATE", "Flight", targetId, finalDraft.flightNo, {});
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
      setFlights((prev) => prev.filter((f) => f.id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
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
    try {
      await flightsAPI.update(flightId, {
        ...flight,
        notes: data.notes || "",
        permits: data.permits || "",
        services: servicesVal,
      });
      setFlights((prev) =>
        prev.map((f) =>
          f.id === flightId
            ? {
                ...f,
                notes: data.notes || "",
                permits: data.permits || "",
                services: servicesVal,
              }
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
    if (selectedIds.length === 0)
      return showToast("⚠️ لم يتم تحديد أي رحلة", "warning");
    if (!canEdit) return;
    const selectedFlights = flights.filter((f) => selectedIds.includes(f.id));
    if (selectedFlights.length === 0) return;
    setGenDecMultiFlights(selectedFlights);
  };

  const handleOpenBulkEditLegs = () => {
    if (selectedIds.length === 0)
      return showToast("⚠️ لم يتم تحديد أي رحلة", "warning");
    if (!canEdit) return;
    const selectedFlights = flights.filter((f) => selectedIds.includes(f.id));
    if (selectedFlights.length === 0) return;
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
      setSelectedIds([]);
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
    if (selectedIds.length === 0)
      return showToast("⚠️ الرجاء تحديد رحلة واحدة على الأقل", "warning");
    const selectedFlights = flights.filter((f) => selectedIds.includes(f.id));

    if (action === "delete") {
      if (!canDelete) return;
      const ok = await confirmAction(`${t.delete} ${selectedFlights.length}?`);
      if (!ok) return;
      try {
        for (const f of selectedFlights) await flightsAPI.remove(f.id);
        setFlights((prev) => prev.filter((f) => !selectedIds.includes(f.id)));
        setSelectedIds([]);
        alertSuccess();
      } catch (e) {
        alertError();
      }
      return;
    }

    if (action === "complete") {
      if (!canEdit) return;
      for (const f of selectedFlights) {
        try {
          const autoStatus = computeAutoStatus({
            ...f,
            actual: f.actual || {},
          });
          await flightsAPI.update(f.id, { ...f, status: autoStatus });
        } catch (e) {
          console.error(e);
        }
      }
      setFlights((prev) =>
        prev.map((f) =>
          selectedIds.includes(f.id)
            ? { ...f, status: computeAutoStatus(f) }
            : f
        )
      );
      setSelectedIds([]);
      alertSuccess();
      return;
    }
  };

  /* ⭐ v7.2 — إضافة قطاع جديد */
  const addLeg = () => {
    const currentLegs = draft.legs || [];
    const lastLeg =
      currentLegs.length > 0
        ? currentLegs[currentLegs.length - 1]
        : { arr: draft.arr, sta: draft.sta, date: draft.date };

    setDraft({
      ...draft,
      legs: [
        ...currentLegs,
        {
          date: lastLeg.date || draft.date,
          dep: lastLeg.arr || "",
          arr: "",
          std: lastLeg.sta || "12:00",
          sta: "13:30",
          acft: draft.acft || "",
        },
      ],
    });
  };

  const updateLeg = (idx, patch) => {
    const newLegs = [...draft.legs];
    newLegs[idx] = { ...newLegs[idx], ...patch };
    setDraft({ ...draft, legs: newLegs });
  };

  const removeLeg = (idx) => {
    setDraft({ ...draft, legs: draft.legs.filter((_, i) => i !== idx) });
  };

  /* ⭐ Crew Slots */
  const addSlot = () => {
    if (!canAssignCrew && !canEdit) return;
    const usedPositions = safeArray(draft.crewSlots)
      .map((s) => s.position)
      .filter(Boolean);
    const firstAvailable = POSITION_OPTIONS.find(
      (p) => !usedPositions.includes(p.key)
    );
    if (!firstAvailable)
      return showToast("⚠️ كل الوظائف معيّنة بالفعل", "warning");
    setDraft({
      ...draft,
      crewSlots: [
        ...safeArray(draft.crewSlots),
        { crewId: "", position: firstAvailable.key },
      ],
    });
  };

  const updateSlot = (i, patch) => {
    const list = [...safeArray(draft.crewSlots)];
    list[i] = { ...list[i], ...patch };
    if (patch.position && list[i].crewId) {
      const member = crew.find((c) => String(c.id) === String(list[i].crewId));
      const allowed = getAllowedRoles(patch.position);
      const memberRoles = getMemberAllRoles(member);
      const hasMatch = memberRoles.some((r) => allowed.includes(r));
      if (member && !hasMatch) list[i].crewId = "";
    }
    setDraft({ ...draft, crewSlots: list });
  };

  const removeSlot = (i) =>
    setDraft({
      ...draft,
      crewSlots: safeArray(draft.crewSlots).filter((_, idx) => idx !== i),
    });

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
  const handleContextMenu = (e, flight) => {
    e.preventDefault();
    const hasAnyPerm = canEdit || canDelete || canViewForms;
    if (!hasAnyPerm) return;
    if (selectedIds.includes(flight.id) && selectedIds.length > 0) {
      setContextMenu({
        bulk: true,
        ids: selectedIds,
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setContextMenu({ flight, x: e.clientX, y: e.clientY });
    }
  };

  const handleContextAction = (action, flightPayload) => {
    const flight = flightPayload || contextMenu?.flight;
    if (typeof action === "string" && action.startsWith("open_op_form:")) {
      const formId = action.slice("open_op_form:".length);
      const foundForm = listOperationalFormsSync().find((f) => f.id === formId);
      if (foundForm) {
        const isBulk =
          flightPayload?.bulk === true ||
          (contextMenu?.bulk && (contextMenu?.ids?.length || 0) > 1);
        const targetIds = isBulk
          ? flightPayload?.ids || contextMenu?.ids || selectedIds || []
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
    else if (action === "edit") openEdit(flight);
    else if (action === "delete") remove(flight?.id);
    else if (action === "complete_flight") setCompleteFlight(flight);
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

  const aircraftHasCrewAssigned =
    !draft.acft || crew.some((c) => isCrewQualifiedForAircraft(c, draft.acft));

  /* ⭐ v7.2 — تجهيز صفوف الجدول */
  const rowsToDisplay = useMemo(() => {
    const rows = [];
    filtered.forEach((f) => {
      const mainNature = f.flightNature || f.nature || (Number(f.pax) > 0 ? "PAX" : "FERRY");
      rows.push({
        key: f.id + "-main",
        flight: f,
        isMain: true,
        legIdx: -1,
        flightNo: f.flightNo,
        flightNature: mainNature,
        pax: f.pax,
        dep: f.dep,
        arr: f.arr,
        std: f.std,
        sta: f.sta,
        acft: f.acft,
      });
      let legs = [];
      if (Array.isArray(f.legs)) legs = f.legs;
      else if (typeof f.legs === "string" && f.legs.trim()) {
        try {
          const p = JSON.parse(f.legs);
          if (Array.isArray(p)) legs = p;
        } catch {}
      }
      legs.forEach((leg, idx) => {
        const legNature = leg.flightNature || mainNature;
        rows.push({
          key: f.id + "-leg-" + idx,
          flight: f,
          isMain: false,
          legIdx: idx,
          flightNo: leg.flightNo || f.flightNo,
          flightNature: legNature,
          pax: leg.pax !== undefined ? leg.pax : (legNature === "FERRY" ? 0 : f.pax),
          dep: leg.dep || "",
          arr: leg.arr || "",
          std: leg.std || "",
          sta: leg.sta || "",
          acft: leg.acft || f.acft || "",
        });
      });
    });
    return rows;
  }, [filtered]);

  return (
    <div className="space-y-3 fade-in">
      {/* ═══ TOOLBAR ═══ */}
      <div
        className="rounded-lg overflow-hidden mb-3 shadow-sm border theme-transition"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex flex-wrap items-center gap-3 p-2">
          <div
            className="flex rounded-md p-1 border shadow-inner"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition ${
                viewMode === "table" ? "shadow-sm" : ""
              }`}
              style={
                viewMode === "table"
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--brand-primary)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              <Table className="w-4 h-4" /> TABLE
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition ${
                viewMode === "calendar" ? "shadow-sm" : ""
              }`}
              style={
                viewMode === "calendar"
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--brand-primary)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              <CalendarDays className="w-4 h-4" /> CALENDAR
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition ${
                viewMode === "timeline" ? "shadow-sm" : ""
              }`}
              style={
                viewMode === "timeline"
                  ? {
                      backgroundColor: "var(--bg-card)",
                      color: "var(--brand-primary)",
                    }
                  : { color: "var(--text-muted)" }
              }
            >
              <List className="w-4 h-4" /> TIMELINE
            </button>
          </div>

          <div
            className="flex items-center rounded-md border shadow-sm"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <button
              onClick={() => shiftDate(-rangeDays)}
              className="px-2 py-1.5 border-r hover:opacity-80"
              style={{
                color: "var(--text-muted)",
                borderColor: "var(--border-default)",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-bold hover:opacity-80"
              style={{ color: "var(--text-primary)" }}
            >
              TODAY
            </button>
            <button
              onClick={() => shiftDate(rangeDays)}
              className="px-2 py-1.5 border-l hover:opacity-80"
              style={{
                color: "var(--text-muted)",
                borderColor: "var(--border-default)",
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div
            className="flex items-center rounded-md border px-2 py-1 shadow-sm"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <Calendar
              className="w-4 h-4 mr-2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>

          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-bold shadow-xs cursor-help"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            title="نظام التوقيت الموحد — يتم التحكم بالتوقيت (زولو / محلي) و 12/24 ساعة حصرياً من إعدادات المنظومة العامة"
          >
            <Globe
              className="w-3.5 h-3.5"
              style={{ color: "var(--brand-primary)" }}
            />
            <span>{timeMode === "LOCAL" ? "LOCAL Time" : "UTC (Zulu)"}</span>
          </div>

          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(+e.target.value)}
            className="px-2 py-1.5 rounded-md border shadow-sm text-xs font-bold outline-none"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>

          <select
            value={acftFilter}
            onChange={(e) => setAcftFilter(e.target.value)}
            className="px-2 py-1.5 rounded-md border shadow-sm text-xs font-bold outline-none max-w-[120px]"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <option value="">All Aircraft</option>
            {fleet.map((a) => (
              <option key={a.id} value={a.reg}>
                {a.reg}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            {/* ⭐ v7.6 — مؤشر بسيط فقط */}
            {selectedIds.length > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-bold border"
                style={{
                  backgroundColor: "var(--bg-app)",
                  color: "var(--brand-primary)",
                  borderColor: "var(--border-default)",
                }}
              >
                {selectedIds.length} ✓ {t.selected || "محدد"}
              </div>
            )}

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition border"
              style={{
                backgroundColor: "var(--bg-app)",
                color: "var(--brand-primary)",
                borderColor: "var(--border-default)",
              }}
            >
              <Filter className="w-3.5 h-3.5" /> FILTER
            </button>

            {canCreate && (
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-4 py-1.5 text-white rounded-md text-xs font-bold shadow-sm transition"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> ADD FLIGHT
              </button>
            )}
            <button
              className="p-1.5 rounded-md"
              style={{ color: "var(--text-muted)" }}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div
            className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2 border-t"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search flights..."
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded border outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded border outline-none"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All Statuses</option>
              {STATUS_LIST.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <div className="flex items-end md:col-span-2">
              <button
                onClick={() => {
                  setQ("");
                  setStatusFilter("");
                  setAcftFilter("");
                  setTypeFilter("");
                }}
                className="w-full px-3 py-1.5 rounded text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div
          className="px-3 py-1.5 flex flex-wrap items-center gap-3 text-[10px] border-t"
          style={{
            color: "var(--text-muted)",
            borderColor: "var(--border-default)",
          }}
        >
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Upcoming (
            {counters.upcoming})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-300 flex items-center justify-center">
              <span className="text-white text-[6px] font-bold">✓</span>
            </span>
            Completed ({counters.completed})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Past (
            {counters.past})
          </span>
          <span
            className="ml-auto font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Showing {rowsToDisplay.length} / {counters.all}
          </span>
        </div>
      </div>

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === "table" && (
        <div
          className="overflow-x-auto rounded-lg border shadow-sm"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <table
            className="w-full text-xs"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            <thead
              className="text-[11px] uppercase tracking-wider"
              style={{
                backgroundColor: "var(--bg-sidebar)",
                color: "var(--text-muted)",
              }}
            >
              <tr>
                <th
                  className="px-2 py-2 border-r w-8"
                  style={{ borderColor: "var(--border-default)" }}
                ></th>
                <th
                  className="px-2 py-2 border-r w-8 text-center"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 cursor-pointer"
                    checked={
                      filtered.length > 0 &&
                      selectedIds.length === filtered.length
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="px-2 py-2 border-r text-start font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  {t.flightNo}
                </th>
                <th
                  className="px-2 py-2 border-r text-center font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  TYPE
                </th>
                <th
                  className="px-2 py-2 border-r text-center font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  DAY
                </th>
                <th
                  className="px-2 py-2 border-r text-start font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  DATE
                </th>
                <th
                  className="px-2 py-2 border-r text-center font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  STD
                </th>
                <th
                  className="px-2 py-2 border-r text-start font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  ADEP
                </th>
                <th
                  className="px-2 py-2 border-r text-start font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  ADES
                </th>
                <th
                  className="px-2 py-2 border-r text-center font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  STA
                </th>
                <th
                  className="px-2 py-2 border-r text-center font-bold"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  ACFT
                </th>
                {positionsToShow.map((pos) => (
                  <th
                    key={pos}
                    className="px-2 py-2 border-r text-center font-bold"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    {POSITION_LABELS[pos]?.short || pos.toUpperCase()}
                  </th>
                ))}
                <th className="px-2 py-2 text-start font-bold">NOTES</th>
                <th
                  className="px-2 py-2 border-r text-center font-bold w-28"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  GD / ACT
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsToDisplay.length === 0 ? (
                <tr>
                  <td
                    colSpan={13 + positionsToShow.length}
                    className="p-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-3xl">📭</span>
                      <span>
                        {t.noFlights} — {dateLabel}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                rowsToDisplay.map((row) => {
                  const f = row.flight;
                  const past = isPast(f);
                  const completed = isCompleted(f);
                  const { day, date } = fmtDateParts(row.std, timeMode);
                  const isSelected = selectedIds.includes(f.id);
                  const ft = getFlightType(f.flightType);
                  const isLeg = !row.isMain;

                  return (
                    <tr
                      key={row.key}
                      onContextMenu={(e) => handleContextMenu(e, f)}
                      onDoubleClick={() => {
                        if (canEdit) openEdit(f);
                      }}
                      className={`cursor-context-menu transition-colors border-b ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : isLeg
                          ? "bg-slate-50/70 dark:bg-slate-900/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      <td
                        className="px-2 py-1.5 border-r"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <div className="flex items-center justify-center">
                          {isLeg ? (
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: "var(--brand-primary)" }}
                            >
                              ↳{row.legIdx + 1}
                            </span>
                          ) : completed ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300 flex items-center justify-center shadow-sm">
                              <span className="text-white text-[7px] font-bold">
                                ✓
                              </span>
                            </span>
                          ) : past ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(f.id)}
                          className="w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center font-bold"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.flightNo || f.flightNo}
                        {completed && (
                          <span className="ms-1 text-[9px] text-emerald-500">
                            ✓
                          </span>
                        )}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center whitespace-nowrap"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span
                            className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              backgroundColor: "var(--bg-app)",
                              color: "var(--brand-primary)",
                              borderColor: "var(--border-default)",
                            }}
                          >
                            <FlightTypeIcon ft={ft} size="w-3 h-3" />
                            <span className="hidden md:inline">{ft.key}</span>
                          </span>

                          {row.flightNature === "FERRY" ? (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              ✈️ FERRY
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                              👥 PAX {row.pax !== undefined && row.pax !== null && row.pax !== "" ? `(${row.pax})` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {day}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r whitespace-nowrap"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {date}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center font-mono font-bold"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {fmtTime(row.std, timeMode)}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r font-mono font-bold"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        {row.dep}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            row.arr === "HLWF"
                              ? "bg-rose-100 text-rose-700 border border-rose-300"
                              : ""
                          }`}
                          style={{
                            color:
                              row.arr === "HLWF"
                                ? undefined
                                : "var(--brand-primary)",
                          }}
                        >
                          {row.arr}
                        </span>
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center font-mono"
                        style={{
                          borderColor: "var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {fmtTime(row.sta, timeMode)}
                      </td>
                      <td
                        className="px-2 py-1.5 border-r text-center font-mono font-bold"
                        style={{
                          borderColor: "var(--border-default)",
                          backgroundColor: "rgba(245, 158, 11, 0.1)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.acft}
                      </td>
                      {positionsToShow.map((pos) => {
                        const members = crewByPosDetailed(f, pos);
                        return (
                          <td
                            key={pos}
                            className="px-2 py-1.5 border-r text-center"
                            style={{ borderColor: "var(--border-default)" }}
                          >
                            {members.length > 0 ? (
                              <div className="flex flex-col items-center gap-0.5">
                                {members.map((m, idx) => {
                                  const sc = getShortCodeWithColor(m, pos);
                                  return (
                                    <span
                                      key={idx}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${sc.color}`}
                                      title={`${m.fullName} (${m.role}${
                                        pos !== m.role ? ` @ ${pos}` : ""
                                      })`}
                                    >
                                      {sc.code}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                style={{
                                  color: "var(--text-muted)",
                                  opacity: 0.4,
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 min-w-[180px]">
                        <div className="flex items-center gap-1">
                          {f.notes ? (
                            <span
                              className="text-[10px] truncate max-w-[120px]"
                              style={{ color: "var(--text-muted)" }}
                              title={f.notes}
                            >
                              {f.notes}
                            </span>
                          ) : (
                            <span
                              className="text-[10px] italic"
                              style={{
                                color: "var(--text-muted)",
                                opacity: 0.5,
                              }}
                            >
                              —
                            </span>
                          )}
                          {f.permits && (
                            <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 border border-amber-300">
                              P
                            </span>
                          )}
                          {f.services && (
                            <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 border border-purple-300">
                              S
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-2 py-1.5 border-r"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={!canGenDecStamp}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canGenDecStamp) return;
                              printGenDec(f, crew, settings, {
                                showStamp: true,
                              });
                            }}
                            className={`p-1.5 rounded transition border flex items-center gap-0.5 ${
                              canGenDecStamp
                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200"
                                : "bg-slate-100 text-slate-400 border-slate-200 opacity-45 cursor-not-allowed"
                            }`}
                            title={
                              canGenDecStamp
                                ? "طباعة GenDec بالختم الرسمي / With Stamp"
                                : "مقفل: يتطلب صلاحية طباعة GenDec بالختم الرسمي"
                            }
                          >
                            <Stamp className="w-3.5 h-3.5" />
                            {!canGenDecStamp && <Lock className="w-2.5 h-2.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={!canGenDecNoStamp}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canGenDecNoStamp) return;
                              printGenDec(f, crew, settings, {
                                showStamp: false,
                              });
                            }}
                            className={`p-1.5 rounded transition border flex items-center gap-0.5 ${
                              canGenDecNoStamp
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300"
                                : "bg-slate-100 text-slate-400 border-slate-200 opacity-45 cursor-not-allowed"
                            }`}
                            title={
                              canGenDecNoStamp
                                ? "طباعة GenDec بدون ختم / Without Stamp"
                                : "مقفل: يتطلب صلاحية طباعة GenDec بدون ختم"
                            }
                          >
                            <FileX className="w-3.5 h-3.5" />
                            {!canGenDecNoStamp && <Lock className="w-2.5 h-2.5" />}
                          </button>
                          {canEdit && !isLeg && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(f);
                              }}
                              className="p-1.5 rounded transition border bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-200"
                              title={t.editFlight || "تعديل الرحلة / Edit Flight"}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(canEdit || canDelete || canViewForms) && !isLeg && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setContextMenu({
                                  flight: f,
                                  x: rect.left,
                                  y: rect.bottom + 4,
                                });
                              }}
                              className="p-1.5 rounded transition border bg-slate-50 text-slate-600 hover:bg-slate-200 border-slate-200"
                              title="خيارات الرحلة / Flight Options"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

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
              ? { bulk: true, ids: contextMenu.ids }
              : contextMenu.flight
          }
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
          flight={completeFlight}
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

      {/* ═══ Edit Modal ═══ */}
      <Modal
        open={!!editing}
        title={editing === "new" ? t.addFlight : t.editFlight}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold border disabled:opacity-50"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm disabled:opacity-60"
              style={{ background: "var(--brand-gradient)" }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : t.save}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Field label={t.flightNo}>
              <Input
                value={draft.flightNo || ""}
                onChange={(e) =>
                  setDraft({ ...draft, flightNo: e.target.value })
                }
                placeholder=""
                autoComplete="off"
              />
            </Field>
            <Field label={t.flightType}>
              <Select
                value={draft.flightType || "SCHEDULED"}
                onChange={(e) =>
                  setDraft({ ...draft, flightType: e.target.value })
                }
              >
                {FLIGHT_TYPES.map((ft) => (
                  <option key={ft.key} value={ft.key}>
                    {t[ft.key.toLowerCase()] || ft.ar || ft.key}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={draft.date || ""}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
          </div>

          <div
            className="p-3 rounded-xl border space-y-3"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4
                className="text-xs font-bold flex items-center gap-2"
                style={{ color: "var(--text-primary)" }}
              >
                <PlaneTakeoff className="w-4 h-4 text-sky-500" /> Sector 1 (Main / القطاع الأساسي)
              </h4>

              {/* Sector 1 PAX / FERRY Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">طبيعة الرحلة:</span>
                <div className="inline-flex p-0.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, flightNature: "PAX" })}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      (draft.flightNature || "PAX") === "PAX"
                        ? "bg-sky-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    👥 PAX (ركاب)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, flightNature: "FERRY", pax: 0 })
                    }
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                      draft.flightNature === "FERRY"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    ✈️ FERRY (فيري)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-5 gap-3">
              <Field label={t.dep}>
                <AirportInput
                  value={draft.dep || ""}
                  onChange={(v) => setDraft({ ...draft, dep: v })}
                />
              </Field>
              <Field label={t.arr}>
                <AirportInput
                  value={draft.arr || ""}
                  onChange={(v) => setDraft({ ...draft, arr: v })}
                />
              </Field>
              <Field label="STD (24h)">
                <Time24Input
                  value={draft.std || ""}
                  onChange={(val) => setDraft({ ...draft, std: val })}
                  showNowButton={false}
                />
              </Field>
              <Field label="STA (24h)">
                <Time24Input
                  value={draft.sta || ""}
                  onChange={(val) => setDraft({ ...draft, sta: val })}
                  showNowButton={false}
                />
              </Field>
              <Field label={draft.flightNature === "FERRY" ? "طبيعة القطاع" : "عدد الركاب (PAX)"}>
                {draft.flightNature === "FERRY" ? (
                  <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1 h-[38px]">
                    ✈️ FERRY (بدون ركاب)
                  </div>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    value={draft.pax !== undefined && draft.pax !== null ? draft.pax : ""}
                    onChange={(e) => setDraft({ ...draft, pax: e.target.value })}
                    placeholder="عدد الركاب"
                  />
                )}
              </Field>
            </div>
          </div>

          {(draft.legs || []).map((leg, idx) => {
            const legNature = leg.flightNature || draft.flightNature || "PAX";
            return (
              <div
                key={idx}
                className="p-3 rounded-xl border space-y-3 relative"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                }}
              >
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <h4
                    className="text-xs font-bold flex items-center gap-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <PlaneTakeoff className="w-4 h-4 text-purple-500" /> Sector {idx + 2} (قطاع إضافي)
                  </h4>

                  <div className="flex items-center gap-2">
                    {/* Leg Nature Selector */}
                    <div className="inline-flex p-0.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => updateLeg(idx, { flightNature: "PAX" })}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                          legNature === "PAX"
                            ? "bg-sky-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        PAX
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLeg(idx, { flightNature: "FERRY", pax: 0 })}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition ${
                          legNature === "FERRY"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        FERRY
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLeg(idx)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      title="حذف هذا القطاع"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-6 gap-2.5">
                  <Field label="رقم رحلة القطاع (اختياري)">
                    <Input
                      value={leg.flightNo || ""}
                      onChange={(e) => updateLeg(idx, { flightNo: e.target.value })}
                      placeholder={draft.flightNo || "نفس الرحلة"}
                      className="text-xs"
                    />
                  </Field>
                  <Field label={t.dep}>
                    <AirportInput
                      value={leg.dep || ""}
                      onChange={(v) => updateLeg(idx, { dep: v })}
                    />
                  </Field>
                  <Field label={t.arr}>
                    <AirportInput
                      value={leg.arr || ""}
                      onChange={(v) => updateLeg(idx, { arr: v })}
                    />
                  </Field>
                  <Field label="Date">
                    <Input
                      type="date"
                      value={leg.date || draft.date || ""}
                      onChange={(e) => updateLeg(idx, { date: e.target.value })}
                    />
                  </Field>
                  <Field label="STD / STA (24h)">
                    <div className="grid grid-cols-2 gap-1">
                      <Time24Input
                        value={leg.std || ""}
                        onChange={(val) => updateLeg(idx, { std: val })}
                        showNowButton={false}
                      />
                      <Time24Input
                        value={leg.sta || ""}
                        onChange={(val) => updateLeg(idx, { sta: val })}
                        showNowButton={false}
                      />
                    </div>
                  </Field>
                  <Field label={legNature === "FERRY" ? "الطبيعة" : "الركاب (PAX)"}>
                    {legNature === "FERRY" ? (
                      <div className="px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold text-center h-[38px] flex items-center justify-center">
                        FERRY
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min="0"
                        value={leg.pax !== undefined && leg.pax !== null ? leg.pax : ""}
                        onChange={(e) => updateLeg(idx, { pax: e.target.value })}
                        placeholder="PAX"
                      />
                    )}
                  </Field>
                </div>
              </div>
            );
          })}

          <button
            onClick={addLeg}
            className="w-full py-2 rounded-lg border-2 border-dashed text-xs font-bold flex items-center justify-center gap-2 transition hover:bg-blue-50"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--brand-primary)",
            }}
          >
            <Plus className="w-4 h-4" /> Add Another Sector (Leg)
          </button>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label={t.acft}>
              <Select
                value={draft.acft || ""}
                onChange={(e) => setDraft({ ...draft, acft: e.target.value })}
              >
                <option value="">—</option>
                {fleet.map((a) => (
                  <option key={a.id} value={a.reg}>
                    {a.reg} ({a.type})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.altn}>
              <AirportInput
                value={draft.altn || ""}
                onChange={(v) => setDraft({ ...draft, altn: v })}
              />
            </Field>
            <Field label={t.altn2}>
              <AirportInput
                value={draft.altn2 || ""}
                onChange={(v) => setDraft({ ...draft, altn2: v })}
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label={`${t.freeNotes || "Notes"}`}>
              <textarea
                value={draft.notes || ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows="2"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              />
            </Field>
            <Field label={`${t.permits || "Permits"}`}>
              <textarea
                value={draft.permits || ""}
                onChange={(e) =>
                  setDraft({ ...draft, permits: e.target.value })
                }
                rows="2"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              />
            </Field>
            <Field label={`${t.handling || "Services"}`}>
              <textarea
                value={draft.services || ""}
                onChange={(e) =>
                  setDraft({ ...draft, services: e.target.value })
                }
                rows="2"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-blue-400"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                  backgroundColor: "var(--bg-card)",
                }}
              />
            </Field>
          </div>

          {canAssignCrew || canEdit ? (
            <section>
              <div className="flex justify-between items-center mb-3">
                <h4
                  className="text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t.crewMembers}
                </h4>
                <button
                  onClick={addSlot}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addPosition}
                </button>
              </div>
              {draft.acft && !aircraftHasCrewAssigned && (
                <div className="p-3 rounded-lg mb-3 text-xs flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-700">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold mb-0.5">
                      {t.noCrewForAircraft ||
                        "لا يوجد طاقم معيَّن على هذه الطائرة"}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {t.noCrewForAircraftHint ||
                        `يرجى تعيين أعضاء الطاقم للطائرة ${draft.acft} من صفحة Crew → Edit → Aircraft`}
                    </div>
                  </div>
                </div>
              )}
              {safeArray(draft.crewSlots).map((slot, i) => {
                const usedPositions = safeArray(draft.crewSlots)
                  .filter((_, idx) => idx !== i)
                  .map((s) => s.position)
                  .filter(Boolean);
                const allowedRoles = getAllowedRoles(slot.position);
                const availableCrew = crew.filter((c) => {
                  if (String(c.status || "active").toLowerCase() !== "active")
                    return false;
                  if (draft.acft && !isCrewQualifiedForAircraft(c, draft.acft))
                    return false;
                  if (allowedRoles.length > 0) {
                    const memberRoles = getMemberAllRoles(c);
                    if (!memberRoles.some((r) => allowedRoles.includes(r)))
                      return false;
                  }
                  return true;
                });
                const availablePositions = POSITION_OPTIONS.filter(
                  (p) =>
                    !usedPositions.includes(p.key) || p.key === slot.position
                );
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg mb-2 border"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div className="col-span-4">
                      <Select
                        value={slot.position || ""}
                        onChange={(e) =>
                          updateSlot(i, { position: e.target.value })
                        }
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
                        onChange={(e) =>
                          updateSlot(i, { crewId: String(e.target.value) })
                        }
                      >
                        <option value="">
                          {availableCrew.length === 0
                            ? t.noAvailableCrew || "لا يوجد طاقم متاح"
                            : t.selectCrew}
                        </option>
                        {availableCrew.map((c) => {
                          const memberAircrafts = getCrewAssignedAircrafts(c);
                          const otherSlot = safeArray(draft.crewSlots).find(
                            (s, idx) =>
                              idx !== i && String(s.crewId) === String(c.id)
                          );
                          const alreadyAssigned = otherSlot
                            ? ` (⚠️ ${otherSlot.position})`
                            : "";
                          return (
                            <option key={c.id} value={String(c.id)}>
                              {c.fullName}
                              {memberAircrafts.length > 0
                                ? ` — ${memberAircrafts.join(", ")}`
                                : ""}
                              {alreadyAssigned}
                            </option>
                          );
                        })}
                      </Select>
                    </div>
                    <div className="col-span-1 text-end">
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

export default ScheduleBoard;
