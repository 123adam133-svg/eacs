/* ═══════════════════════════════════════════════════════════
 * OPERATIONS QUICK HUB — العمليات السريعة وإدارة السكترات والطاقم
 * - Fast creation & editing of single or multi-sector flights
 * - Automatic turnaround chaining (next DEP = previous ARR, +45m turn)
 * - Streamlined crew assignment with qualification & conflict hints
 * - Direct hand-off to Flight Forms & GenDec Hub
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect } from "react";
import {
  PlaneTakeoff,
  Plus,
  Trash2,
  Save,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  RotateCcw,
  Plane,
  Search,
  ChevronRight,
  Copy,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Time24Input } from "../components/ui/Time24Input";
import { AirportInput } from "../components/AirportInput";
import { flightsAPI, writeSheetCache } from "../api";
import { can as checkPerm } from "../config/permissions";
import { logSafe } from "../utils/audit";
import { notifyFlightChange, notifyCrewChange } from "../utils/notifications";
import { triggerFlightWhatsAppNotifications } from "../utils/whatsapp";
import { alertSuccess, alertError } from "../utils/sounds";
import { showToast } from "../utils/dialog";
import { todayISO, safeArray, safeObject } from "../utils/helpers";
import {
  FLIGHT_TYPES,
  FLIGHT_STATUSES,
  getAllowedRoles,
  getPositionOptions,
} from "../config/constants";

function normalizeHHMM(val, fallback = "12:00") {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(11, 16);
  const m = s.match(/^(\d{1,2}):(\d{1,2})/);
  if (m) {
    const hh = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
    const mm = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return fallback;
}

function addMinutesHHMM(hhmm, deltaMinutes) {
  const [h, m] = normalizeHHMM(hhmm, "12:00").split(":").map(Number);
  const total = ((h * 60 + m + deltaMinutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}`;
}

function calcDuration24(startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return "00:00";
  const [sh, sm] = normalizeHHMM(startHHMM).split(":").map(Number);
  const [eh, em] = normalizeHHMM(endHHMM).split(":").map(Number);
  let min = eh * 60 + em - (sh * 60 + sm);
  if (min < 0) min += 24 * 60;
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}

function buildSectorIsoPair(dateStr, rawStd, rawSta) {
  const safeDate =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).slice(0, 10))
      ? String(dateStr).slice(0, 10)
      : todayISO();
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
  const primaryRole = String(member.role || "").toLowerCase().trim();
  if (primaryRole === "flightdispatcher" || primaryRole === "dispatcher") {
    return true;
  }
  const assigned = getCrewAssignedAircrafts(member).map((a) =>
    String(a).trim().toUpperCase()
  );
  if (assigned.length === 0) return false;
  return assigned.includes(String(aircraftReg).trim().toUpperCase());
}

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};

const innerStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

export function OperationsQuickHub({
  flights = [],
  setFlights,
  reloadFlights,
  crew = [],
  fleet = [],
  settings = {},
  user = null,
  lang = "ar",
  previewMode = false,
  setSyncStatus,
  onOpenFlightForms,
  onOpenSchedule,
}) {
  const isAr = lang === "ar";
  const POSITION_OPTIONS = useMemo(
    () => getPositionOptions(settings),
    [settings]
  );

  const canCreate =
    previewMode ||
    checkPerm(user, "portal.operations_manage") ||
    checkPerm(user, "schedule.create");
  const canEdit =
    previewMode ||
    checkPerm(user, "portal.operations_manage") ||
    checkPerm(user, "schedule.edit");
  const canAssignCrew =
    previewMode ||
    checkPerm(user, "portal.operations_manage") ||
    checkPerm(user, "schedule.assign_crew") ||
    canEdit ||
    canCreate;
  const canOpenFlightForms =
    previewMode ||
    checkPerm(user, "portal.flight_forms") ||
    checkPerm(user, "portal.flight_forms_download") ||
    checkPerm(user, "forms.view") ||
    checkPerm(user, "schedule.gendec_view");

  const defaultCrewSlots = () => [
    { position: POSITION_OPTIONS[0]?.key || "captain", crewId: "" },
    { position: POSITION_OPTIONS[1]?.key || "firstOfficer", crewId: "" },
  ];

  const createInitialState = () => ({
    editingId: null,
    flightNo: "",
    acft: fleet?.[0]?.reg || "",
    date: todayISO(),
    flightType: "SCHEDULED",
    flightNature: "PAX",
    status: "SCHEDULED",
    altn: "",
    cargo: 0,
    notes: "",
    sectors: [
      {
        flightNo: "",
        date: todayISO(),
        dep: "",
        arr: "",
        std: "08:00",
        sta: "09:30",
        flightType: "SCHEDULED",
        flightNature: "PAX",
        pax: "",
        status: "SCHEDULED",
        altn: "",
        cargo: 0,
        notes: "",
        crewSlots: defaultCrewSlots(),
      },
    ],
  });

  const [form, setForm] = useState(createInitialState);
  const [activeCrewSectorIdx, setActiveCrewSectorIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showAllCrew, setShowAllCrew] = useState(false);
  const [crewSearch, setCrewSearch] = useState("");
  const [lastSavedFlight, setLastSavedFlight] = useState(null);
  const [existingFlightSearch, setExistingFlightSearch] = useState("");
  const [showLoadPicker, setShowLoadPicker] = useState(false);

  // Ensure default aircraft once fleet loads
  useEffect(() => {
    if (!form.editingId && !form.acft && fleet?.length > 0) {
      setForm((prev) => ({ ...prev, acft: fleet[0].reg || "" }));
    }
  }, [fleet, form.editingId, form.acft]);

  const safeCrewSectorIdx = Math.min(
    activeCrewSectorIdx,
    Math.max(0, (form.sectors?.length || 1) - 1)
  );
  const activeSector = form.sectors?.[safeCrewSectorIdx] || form.sectors?.[0] || {};
  const activeSectorCrewSlots = Array.isArray(activeSector.crewSlots)
    ? activeSector.crewSlots
    : [];

  const loadExistingFlight = (f) => {
    if (!f) return;
    const mainDate = f.std ? String(f.std).slice(0, 10) : todayISO();
    const loadedMainSlots = safeArray(f.crewSlots)
      .filter((s) => s && s.position)
      .map((s) => ({
        position: String(s.position),
        crewId: s.crewId ? String(s.crewId) : "",
      }));

    const mainSector = {
      flightNo: f.flightNo || "",
      date: mainDate,
      dep: f.dep || "",
      arr: f.arr || "",
      std: normalizeHHMM(f.std, "08:00"),
      sta: normalizeHHMM(f.sta, "09:30"),
      flightType: f.flightType || "SCHEDULED",
      flightNature: f.flightNature || (Number(f.pax) > 0 ? "PAX" : "FERRY"),
      pax: f.pax ?? "",
      status: f.status || "SCHEDULED",
      altn: f.altn || "",
      cargo: f.cargo ?? 0,
      notes: f.notes || "",
      crewSlots: loadedMainSlots.length > 0 ? loadedMainSlots : defaultCrewSlots(),
    };

    let rawLegs = [];
    if (Array.isArray(f.legs)) rawLegs = f.legs;
    else if (typeof f.legs === "string" && f.legs.trim()) {
      try {
        const parsed = JSON.parse(f.legs);
        if (Array.isArray(parsed)) rawLegs = parsed;
      } catch {}
    }

    const extraSectors = rawLegs.map((l) => {
      const legSlots = Array.isArray(l.crewSlots)
        ? l.crewSlots
            .filter((s) => s && s.position)
            .map((s) => ({
              position: String(s.position),
              crewId: s.crewId ? String(s.crewId) : "",
            }))
        : loadedMainSlots.map((s) => ({ ...s }));
      return {
        flightNo: l.flightNo || f.flightNo || "",
        date: l.date || (l.std ? String(l.std).slice(0, 10) : mainDate),
        dep: l.dep || "",
        arr: l.arr || "",
        std: normalizeHHMM(l.std, "12:00"),
        sta: normalizeHHMM(l.sta, "13:30"),
        flightType: l.flightType || f.flightType || "SCHEDULED",
        flightNature: l.flightNature || mainSector.flightNature,
        pax: l.pax ?? "",
        status: l.status || f.status || "SCHEDULED",
        altn: l.altn || "",
        cargo: l.cargo ?? 0,
        notes: l.notes || "",
        crewSlots: legSlots,
      };
    });

    setForm({
      editingId: f.id,
      flightNo: f.flightNo || "",
      acft: f.acft || fleet?.[0]?.reg || "",
      date: mainDate,
      flightType: f.flightType || "SCHEDULED",
      flightNature: mainSector.flightNature,
      status: f.status || "SCHEDULED",
      altn: f.altn || "",
      cargo: f.cargo || 0,
      notes: f.notes || "",
      sectors: [mainSector, ...extraSectors],
    });
    setActiveCrewSectorIdx(0);
    setShowLoadPicker(false);
    setLastSavedFlight(null);
  };

  const resetForm = () => {
    setForm(createInitialState());
    setActiveCrewSectorIdx(0);
    setLastSavedFlight(null);
  };

  /* ═══ Sector Helpers ═══ */
  const addSector = () => {
    setForm((prev) => {
      const last = prev.sectors[prev.sectors.length - 1] || {};
      const nextStd = addMinutesHHMM(last.sta || "10:00", 45);
      const nextSta = addMinutesHHMM(nextStd, 90);
      return {
        ...prev,
        sectors: [
          ...prev.sectors,
          {
            flightNo: prev.flightNo || "",
            date: last.date || prev.date || todayISO(),
            dep: last.arr || "",
            arr: "",
            std: nextStd,
            sta: nextSta,
            flightType: prev.flightType || "SCHEDULED",
            flightNature: prev.flightNature || "PAX",
            pax: prev.flightNature === "FERRY" ? 0 : "",
            status: "SCHEDULED",
            altn: "",
            cargo: 0,
            notes: "",
            crewSlots: [],
          },
        ],
      };
    });
    setActiveCrewSectorIdx(form.sectors.length);
  };

  const duplicateSector = (idx) => {
    setForm((prev) => {
      const src = prev.sectors[idx];
      if (!src) return prev;
      const nextStd = addMinutesHHMM(src.sta || "12:00", 45);
      const nextSta = addMinutesHHMM(nextStd, 90);
      const next = [...prev.sectors];
      next.splice(idx + 1, 0, {
        ...src,
        dep: src.arr || "",
        arr: "",
        std: nextStd,
        sta: nextSta,
        status: "SCHEDULED",
        crewSlots: [],
      });
      return { ...prev, sectors: next };
    });
    setActiveCrewSectorIdx(idx + 1);
  };

  const updateSector = (idx, patch) => {
    setForm((prev) => {
      const next = [...prev.sectors];
      next[idx] = { ...next[idx], ...patch };
      // If updating arr on sector idx and next sector dep is empty/chained, auto-chain dep cleanly
      if (
        patch.arr !== undefined &&
        next[idx + 1] &&
        (!next[idx + 1].dep || next[idx + 1].dep === prev.sectors[idx]?.arr)
      ) {
        next[idx + 1] = { ...next[idx + 1], dep: patch.arr };
      }
      // Keep Sector 1 mirrored into master header conveniences when edited directly
      const extraMaster =
        idx === 0
          ? {
              ...(patch.status !== undefined ? { status: patch.status } : {}),
              ...(patch.altn !== undefined ? { altn: patch.altn } : {}),
              ...(patch.cargo !== undefined ? { cargo: patch.cargo } : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
              ...(patch.flightType !== undefined ? { flightType: patch.flightType } : {}),
            }
          : {};
      return { ...prev, ...extraMaster, sectors: next };
    });
  };

  const removeSector = (idx) => {
    if (form.sectors.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      sectors: prev.sectors.filter((_, i) => i !== idx),
    }));
    setActiveCrewSectorIdx((cur) => (cur >= idx && cur > 0 ? cur - 1 : cur));
  };

  /* ═══ Per-Sector Crew Assignment Helpers ═══ */
  const addCrewSlot = () => {
    const used = activeSectorCrewSlots.map((s) => s.position).filter(Boolean);
    const nextPos = POSITION_OPTIONS.find((p) => !used.includes(p.key));
    if (!nextPos) {
      return showToast(
        isAr ? "جميع الوظائف مضافة بالفعل لهذا السكتر" : "All positions are already added for this sector",
        "warning"
      );
    }
    updateSector(safeCrewSectorIdx, {
      crewSlots: [...activeSectorCrewSlots, { position: nextPos.key, crewId: "" }],
    });
  };

  const updateCrewSlot = (idx, patch) => {
    setForm((prev) => {
      const targetIdx = Math.min(safeCrewSectorIdx, prev.sectors.length - 1);
      const sec = prev.sectors[targetIdx] || {};
      const list = [...safeArray(sec.crewSlots)];
      if (patch.crewId) {
        const dup = list.some(
          (s, i) => i !== idx && String(s.crewId) === String(patch.crewId)
        );
        if (dup) {
          showToast(
            isAr
              ? "هذا الفرد معيّن بالفعل في وظيفة أخرى لهذا السكتر"
              : "This crew member is already assigned to another position in this sector",
            "warning"
          );
          return prev;
        }
      }
      list[idx] = { ...list[idx], ...patch };
      if (patch.position && list[idx].crewId && !showAllCrew) {
        const m = crew.find((c) => String(c.id) === String(list[idx].crewId));
        const allowed = getAllowedRoles(patch.position);
        const memberRoles = getMemberAllRoles(m);
        if (m && allowed.length > 0 && !memberRoles.some((r) => allowed.includes(r))) {
          list[idx].crewId = "";
        }
      }
      const nextSectors = [...prev.sectors];
      nextSectors[targetIdx] = { ...sec, crewSlots: list };
      return { ...prev, sectors: nextSectors };
    });
  };

  const removeCrewSlot = (idx) => {
    updateSector(safeCrewSectorIdx, {
      crewSlots: activeSectorCrewSlots.filter((_, i) => i !== idx),
    });
  };

  const copySector1CrewToActive = () => {
    const s1Crew = safeArray(form.sectors?.[0]?.crewSlots).map((s) => ({ ...s }));
    updateSector(safeCrewSectorIdx, { crewSlots: s1Crew });
    showToast(
      isAr
        ? `تم نسخ طاقم السكتر 1 إلى السكتر ${safeCrewSectorIdx + 1}`
        : `Copied S1 crew to Sector ${safeCrewSectorIdx + 1}`,
      "success"
    );
  };

  const applyActiveCrewToAllSectors = () => {
    const src = activeSectorCrewSlots.map((s) => ({ ...s }));
    setForm((prev) => ({
      ...prev,
      sectors: prev.sectors.map((sec) => ({
        ...sec,
        crewSlots: src.map((s) => ({ ...s })),
      })),
    }));
    showToast(
      isAr ? "تم تعميم الطاقم على جميع السكترات" : "Applied crew to all sectors",
      "success"
    );
  };

  // Detect crew already scheduled on the same date on other flights (including legs)
  const busyCrewMap = useMemo(() => {
    const map = {};
    const targetDate = activeSector?.date || form.date || todayISO();
    (flights || []).forEach((f) => {
      if (form.editingId && String(f.id) === String(form.editingId)) return;
      const fDate = f.std ? String(f.std).slice(0, 10) : "";
      if (fDate === targetDate) {
        safeArray(f.crewSlots).forEach((s) => {
          if (s?.crewId) map[String(s.crewId)] = f.flightNo || "FLT";
        });
      }
      safeArray(f.legs).forEach((leg) => {
        const lDate = leg.date || (leg.std ? String(leg.std).slice(0, 10) : fDate);
        if (lDate === targetDate) {
          safeArray(leg.crewSlots).forEach((s) => {
            if (s?.crewId) map[String(s.crewId)] = leg.flightNo || f.flightNo || "FLT";
          });
        }
      });
    });
    return map;
  }, [flights, activeSector?.date, form.date, form.editingId]);

  const activeCrew = useMemo(
    () =>
      (crew || []).filter(
        (c) => String(c.status || "active").toLowerCase() === "active"
      ),
    [crew]
  );

  const recentFlights = useMemo(() => {
    const q = existingFlightSearch.trim().toLowerCase();
    return [...(flights || [])]
      .sort((a, b) => String(b.std || "").localeCompare(String(a.std || "")))
      .filter((f) => {
        if (!q) return true;
        return `${f.flightNo || ""} ${f.dep || ""} ${f.arr || ""} ${f.acft || ""}`
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 18);
  }, [flights, existingFlightSearch]);

  const enrichSlots = (slots) =>
    safeArray(slots)
      .filter((s) => String(s.crewId || "").trim() && String(s.position || "").trim())
      .map((s) => {
        const m = crew.find((c) => String(c.id) === String(s.crewId));
        const base = {
          position: String(s.position),
          crewId: String(s.crewId),
        };
        return m?.email
          ? { ...base, email: String(m.email).trim().toLowerCase() }
          : base;
      });

  /* ═══ Save Flight + Independent Sectors + Per-Sector Crew ═══ */
  const handleSave = async () => {
    if (saving) return;
    if (form.editingId && !canEdit) {
      return showToast(
        isAr ? "ليس لديك صلاحية تعديل الرحلات" : "No edit permission",
        "warning"
      );
    }
    if (!form.editingId && !canCreate) {
      return showToast(
        isAr ? "ليس لديك صلاحية إنشاء رحلات" : "No create permission",
        "warning"
      );
    }

    const cleanFlightNo = String(form.flightNo || "").trim().toUpperCase();
    if (!cleanFlightNo) {
      return showToast(
        isAr ? "يرجى إدخال رقم الرحلة" : "Please enter Flight Number",
        "warning"
      );
    }

    const validSectors = form.sectors.filter(
      (s) => String(s.dep || "").trim() || String(s.arr || "").trim()
    );
    if (validSectors.length === 0) {
      return showToast(
        isAr
          ? "يرجى إدخال مطار الإقلاع والوصول للسكتر الأول على الأقل"
          : "Please enter departure and arrival airports for Sector 1",
        "warning"
      );
    }

    const first = validSectors[0];
    const firstDep = String(first.dep || "").trim().toUpperCase();
    const firstArr = String(first.arr || "").trim().toUpperCase();
    if (!firstDep || !firstArr) {
      return showToast(
        isAr
          ? "مطار الإقلاع والوصول مطلوبان للسكتر الأول"
          : "DEP and ARR are required for Sector 1",
        "warning"
      );
    }

    const existingObj = form.editingId
      ? (flights || []).find((f) => String(f.id) === String(form.editingId))
      : null;

    const mainPair = buildSectorIsoPair(
      first.date || form.date,
      first.std,
      first.sta
    );

    const legsPayload = validSectors.slice(1).map((s, legIdx) => {
      const pair = buildSectorIsoPair(s.date || form.date, s.std, s.sta);
      const nat = s.flightNature || form.flightNature || "PAX";
      const prevLeg = existingObj?.legs?.[legIdx] || {};
      return {
        ...prevLeg,
        flightNo:
          String(s.flightNo || cleanFlightNo).trim().toUpperCase() || cleanFlightNo,
        date: pair.safeDate,
        dep: String(s.dep || "").trim().toUpperCase(),
        arr: String(s.arr || "").trim().toUpperCase(),
        std: pair.stdIso,
        sta: pair.staIso,
        acft: form.acft || "",
        flightType: s.flightType || form.flightType || "SCHEDULED",
        flightNature: nat,
        pax: nat === "FERRY" ? 0 : Number(s.pax) || 0,
        status: s.status || "SCHEDULED",
        altn: String(s.altn || "").trim().toUpperCase(),
        cargo: Number(s.cargo) || 0,
        notes: s.notes || "",
        crewSlots: enrichSlots(s.crewSlots),
      };
    });

    const mainCrewSlots = enrichSlots(first.crewSlots);
    const mainNature = first.flightNature || form.flightNature || "PAX";
    const mainPax = mainNature === "FERRY" ? 0 : Number(first.pax) || 0;

    const allAssignedIds = new Set();
    mainCrewSlots.forEach((s) => allAssignedIds.add(s.crewId));
    legsPayload.forEach((l) => safeArray(l.crewSlots).forEach((s) => allAssignedIds.add(s.crewId)));

    const payload = {
      ...(existingObj || {}),
      flightNo: String(first.flightNo || cleanFlightNo).trim().toUpperCase() || cleanFlightNo,
      acft: form.acft || "",
      date: mainPair.safeDate,
      dep: firstDep,
      arr: firstArr,
      route: `${firstDep}-${firstArr}`,
      std: mainPair.stdIso,
      sta: mainPair.staIso,
      altn: String(first.altn ?? form.altn ?? "").trim().toUpperCase(),
      flightType: first.flightType || form.flightType || "SCHEDULED",
      flightNature: mainNature,
      pax: mainPax,
      cargo: Number(first.cargo ?? form.cargo) || 0,
      status: first.status || form.status || "SCHEDULED",
      notes: first.notes ?? form.notes ?? "",
      crewSlots: mainCrewSlots,
      legs: legsPayload,
      actual: existingObj?.actual || {},
      fuel: existingObj?.fuel || {},
      wb: existingObj?.wb || {},
    };

    setSaving(true);
    setSyncStatus?.("syncing");
    try {
      let savedItem = null;
      if (form.editingId) {
        await flightsAPI.update(String(form.editingId), payload);
        savedItem = { ...payload, id: String(form.editingId) };
        setFlights?.((prev) => {
          const next = prev.map((f) =>
            String(f.id) === String(savedItem.id) ? savedItem : f
          );
          writeSheetCache("Flights", next);
          return next;
        });
        logSafe(user, "UPDATE", "Flight", savedItem.id, cleanFlightNo, {});
        notifyFlightChange(
          cleanFlightNo,
          "update",
          `تحديث رحلة (${validSectors.length} سكترات مستقلة) من العمليات السريعة`
        );
      } else {
        const created = await flightsAPI.create(payload);
        savedItem = { ...payload, id: String(created.id) };
        setFlights?.((prev) => {
          const next = [
            ...prev.filter((f) => String(f.id) !== String(savedItem.id)),
            savedItem,
          ];
          writeSheetCache("Flights", next);
          return next;
        });
        logSafe(user, "CREATE", "Flight", savedItem.id, cleanFlightNo, {});
        notifyFlightChange(
          cleanFlightNo,
          "create",
          `إنشاء رحلة (${validSectors.length} سكترات مستقلة) من العمليات السريعة`
        );
        triggerFlightWhatsAppNotifications(savedItem, crew, "ASSIGNED").catch(
          () => {}
        );
      }

      if (allAssignedIds.size > 0) {
        notifyCrewChange(
          cleanFlightNo,
          "assign",
          `تم تعيين ${allAssignedIds.size} من أفراد الطاقم عبر سكترات الرحلة ${cleanFlightNo}`
        );
      }

      if (typeof reloadFlights === "function") {
        reloadFlights().catch(() => {});
      }

      setSyncStatus?.("synced");
      alertSuccess();
      setLastSavedFlight(savedItem);
      setForm((prev) => ({ ...prev, editingId: savedItem.id }));
      showToast(
        isAr
          ? `تم حفظ الرحلة ${cleanFlightNo} (${validSectors.length} سكترات · ${allAssignedIds.size} طاقم)`
          : `Saved ${cleanFlightNo} (${validSectors.length} sectors · ${allAssignedIds.size} crew)`,
        "success"
      );
    } catch (e) {
      setSyncStatus?.("error");
      alertError();
      showToast(
        (isAr ? "فشل الحفظ: " : "Save failed: ") + (e?.message || e),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = activeSectorCrewSlots.filter((s) => s.crewId).length;

  return (
    <div className="w-full p-2 md:p-4 space-y-3" style={{ color: "var(--text-primary)" }}>
      {/* ═══ TOP COMPACT BAR ═══ */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
        style={cardStyle}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: "var(--brand-gradient)" }}
          >
            <PlaneTakeoff className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-bold truncate">
              {isAr ? "مركز العمليات السريع" : "Operations Quick Builder"}
            </h1>
            <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "إضافة رحلة بسكتر واحد أو عدة سكترات متسلسلة وتعيين الطاقم بسرعة"
                : "Create single or multi-sector flights with chained sectors & crew assignment"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowLoadPicker((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          >
            <Search className="w-3.5 h-3.5 text-sky-500" />
            <span>
              {form.editingId
                ? isAr
                  ? `تعديل: ${form.flightNo}`
                  : `Editing: ${form.flightNo}`
                : isAr
                ? "فتح رحلة حالية للتعديل"
                : "Load Existing Flight"}
            </span>
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? "رحلة جديدة" : "New Flight"}</span>
          </button>

          {onOpenSchedule && (
            <button
              type="button"
              onClick={onOpenSchedule}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition hover:opacity-90"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Plane className="w-3.5 h-3.5 text-indigo-500" />
              <span>{isAr ? "عرض الجدول" : "View Schedule"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition hover:opacity-95 disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {saving
                ? isAr
                  ? "جاري الحفظ..."
                  : "Saving..."
                : form.editingId
                ? isAr
                  ? "تحديث الرحلة"
                  : "Update Flight"
                : isAr
                ? "حفظ الرحلة والسكترات"
                : "Save Flight & Sectors"}
            </span>
          </button>
        </div>
      </div>

      {/* ═══ QUICK PICK EXISTING FLIGHT DROPDOWN PANEL ═══ */}
      {showLoadPicker && (
        <div className="rounded-xl p-3 space-y-2.5" style={cardStyle}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold">
              {isAr ? "اختر رحلة لتعديل سكتراتها أو طاقمها:" : "Select a flight to edit:"}
            </span>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
              <Input
                value={existingFlightSearch}
                onChange={(e) => setExistingFlightSearch(e.target.value)}
                placeholder={isAr ? "بحث برقم الرحلة أو المطار..." : "Search flight or airport..."}
                className="ps-8 h-8 text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
            {recentFlights.map((f) => {
              const legsCount = Array.isArray(f.legs) ? f.legs.length : 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => loadExistingFlight(f)}
                  className="p-2 rounded-lg border text-start flex items-center justify-between gap-2 hover:border-sky-500 transition"
                  style={innerStyle}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold font-mono truncate">
                      {f.flightNo} · {f.dep} → {f.arr}
                    </div>
                    <div className="text-[11px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                      {f.std ? String(f.std).slice(0, 10) : "—"} · {f.acft || "—"} ·{" "}
                      {1 + legsCount} {isAr ? "سكتر" : "sec"} ·{" "}
                      {safeArray(f.crewSlots).length} {isAr ? "طاقم" : "crew"}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ POST-SAVE QUICK ACTION BANNER ═══ */}
      {lastSavedFlight && (
        <div
          className="rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border border-emerald-500/30 bg-emerald-500/10"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? `تم حفظ الرحلة ${lastSavedFlight.flightNo} بنجاح (${
                    1 + (lastSavedFlight.legs?.length || 0)
                  } سكترات)`
                : `Flight ${lastSavedFlight.flightNo} saved (${
                    1 + (lastSavedFlight.legs?.length || 0)
                  } sectors)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFlightForms && canOpenFlightForms && (
              <button
                type="button"
                onClick={() => onOpenFlightForms(lastSavedFlight)}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isAr ? "فتح النماذج والـ GD لهذه الرحلة" : "Open Forms & GD"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 transition"
            >
              {isAr ? "إضافة رحلة أخرى" : "Create Another"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ MASTER FLIGHT HEADER ROW ═══ */}
      <div className="rounded-xl p-3 space-y-2.5" style={cardStyle}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "رقم الرحلة *" : "Flight No *"}
            </label>
            <Input
              value={form.flightNo}
              onChange={(e) =>
                setForm((p) => ({ ...p, flightNo: e.target.value.toUpperCase() }))
              }
              placeholder="LN101"
              className="h-8 text-xs font-mono font-bold uppercase"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "الطائرة" : "Aircraft"}
            </label>
            <Select
              value={form.acft}
              onChange={(e) => setForm((p) => ({ ...p, acft: e.target.value }))}
              className="h-8 text-xs font-mono"
            >
              <option value="">{isAr ? "— اختر طائرة —" : "— Select ACFT —"}</option>
              {(fleet || []).map((a) => (
                <option key={a.id || a.reg} value={a.reg}>
                  {a.reg} {a.type ? `(${a.type})` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "التاريخ" : "Date"}
            </label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => {
                const nextDate = e.target.value;
                setForm((p) => ({
                  ...p,
                  date: nextDate,
                  sectors: p.sectors.map((s) => ({
                    ...s,
                    date: s.date === p.date || !s.date ? nextDate : s.date,
                  })),
                }));
              }}
              className="h-8 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "نوع الرحلة" : "Flight Type"}
            </label>
            <Select
              value={form.flightType}
              onChange={(e) =>
                setForm((p) => ({ ...p, flightType: e.target.value }))
              }
              className="h-8 text-xs"
            >
              {FLIGHT_TYPES.map((ft) => (
                <option key={ft.key} value={ft.key}>
                  {isAr ? ft.ar : ft.en} ({ft.key})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "الحالة" : "Status"}
            </label>
            <Select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="h-8 text-xs"
            >
              {FLIGHT_STATUSES.map((st) => (
                <option key={st.key} value={st.key}>
                  {isAr ? st.ar : st.en}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
              {isAr ? "المطار البديل / ALTN" : "Alternate (ALTN)"}
            </label>
            <AirportInput
              value={form.altn}
              onChange={(v) => setForm((p) => ({ ...p, altn: v }))}
              placeholder="ICAO"
            />
          </div>
        </div>
      </div>

      {/* ═══ TWO-COLUMN MAIN WORKSPACE: SECTORS (7) + CREW ASSIGNMENT (5) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* LEFT: DYNAMIC MULTI-SECTOR BUILDER */}
        <div className="lg:col-span-7 rounded-xl p-3 space-y-2.5" style={cardStyle}>
          <div
            className="flex items-center justify-between gap-2 pb-2 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--bg-app)" }}
              >
                <Clock className="w-4 h-4 text-sky-500" />
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-bold">
                  {isAr
                    ? `السكترات وخط السير (${form.sectors.length})`
                    : `Flight Sectors (${form.sectors.length})`}
                </h2>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "يتم ربط مطار المغادرة للسكتر الجديد تلقائياً بمطار وصول السكتر السابق"
                    : "New sectors auto-chain from the previous arrival airport"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addSector}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white flex items-center gap-1.5 shrink-0 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? "إضافة سكتر" : "Add Sector"}</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {form.sectors.map((sec, idx) => {
              const dur = calcDuration24(sec.std, sec.sta);
              const nature = sec.flightNature || "PAX";
              const secCrewCount = safeArray(sec.crewSlots).filter((s) => s.crewId).length;
              const isCrewActiveSec = safeCrewSectorIdx === idx;
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border space-y-2 transition ${
                    isCrewActiveSec ? "ring-1 ring-sky-500/40 border-sky-500/50" : ""
                  }`}
                  style={innerStyle}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/15 text-sky-600 dark:text-sky-300">
                        S{idx + 1}
                      </span>
                      <span className="text-xs font-mono font-bold">
                        {sec.dep || "----"} → {sec.arr || "----"}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        · {dur}Z
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveCrewSectorIdx(idx)}
                        className={`text-[11px] font-semibold underline-offset-2 hover:underline transition ${
                          isCrewActiveSec
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : ""
                        }`}
                        style={!isCrewActiveSec ? { color: "var(--text-muted)" } : undefined}
                        title={isAr ? "إدارة طاقم هذا السكتر" : "Manage crew for this sector"}
                      >
                        · {secCrewCount} {isAr ? "طاقم" : "crew"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="inline-flex p-0.5 rounded-md border" style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-card)" }}>
                        <button
                          type="button"
                          onClick={() => updateSector(idx, { flightNature: "PAX" })}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                            nature === "PAX"
                              ? "bg-sky-600 text-white"
                              : "text-slate-500 dark:text-slate-300"
                          }`}
                        >
                          PAX
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSector(idx, { flightNature: "FERRY", pax: 0 })
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                            nature === "FERRY"
                              ? "bg-amber-600 text-white"
                              : "text-slate-500 dark:text-slate-300"
                          }`}
                        >
                          FERRY
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => duplicateSector(idx)}
                        className="p-1.5 rounded-md border hover:border-sky-500 transition"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          borderColor: "var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                        title={isAr ? "إضافة سكتر متابعة بعد هذا" : "Chain next sector"}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {form.sectors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSector(idx)}
                          className="p-1.5 rounded-md text-rose-500 hover:bg-rose-500/10 transition"
                          title={isAr ? "حذف السكتر" : "Remove sector"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "رقم السكتر" : "Leg Flt"}
                      </label>
                      <Input
                        value={sec.flightNo || ""}
                        onChange={(e) =>
                          updateSector(idx, { flightNo: e.target.value.toUpperCase() })
                        }
                        placeholder={form.flightNo || "FLT"}
                        className="h-8 text-xs font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "من (DEP) *" : "DEP *"}
                      </label>
                      <AirportInput
                        value={sec.dep}
                        onChange={(v) => updateSector(idx, { dep: v })}
                        placeholder="ICAO"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "إلى (ARR) *" : "ARR *"}
                      </label>
                      <AirportInput
                        value={sec.arr}
                        onChange={(v) => updateSector(idx, { arr: v })}
                        placeholder="ICAO"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "الإقلاع UTC" : "STD (UTC)"}
                      </label>
                      <Time24Input
                        value={sec.std}
                        onChange={(val) => updateSector(idx, { std: val })}
                        compact={true}
                        placeholder="0800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "الوصول UTC" : "STA (UTC)"}
                      </label>
                      <Time24Input
                        value={sec.sta}
                        onChange={(val) => updateSector(idx, { sta: val })}
                        compact={true}
                        placeholder="0930"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {nature === "FERRY" ? "TYPE" : isAr ? "الركاب" : "PAX"}
                      </label>
                      {nature === "FERRY" ? (
                        <div className="h-8 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center font-mono">
                          FERRY
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          value={sec.pax}
                          onChange={(e) => updateSector(idx, { pax: e.target.value })}
                          placeholder="0"
                          className="h-8 text-xs font-mono"
                        />
                      )}
                    </div>
                  </div>

                  {/* Per-Sector Independent Details Row: Status, ALTN, Cargo, Notes */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end pt-1 border-t border-dashed" style={{ borderColor: "var(--border-default)" }}>
                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "حالة السكتر" : "Status"}
                      </label>
                      <Select
                        value={sec.status || "SCHEDULED"}
                        onChange={(e) => updateSector(idx, { status: e.target.value })}
                        className="h-7 text-[11px]"
                      >
                        {FLIGHT_STATUSES.map((st) => (
                          <option key={st.key} value={st.key}>
                            {isAr ? st.ar : st.en}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "البديل ALTN" : "ALTN"}
                      </label>
                      <AirportInput
                        value={sec.altn || ""}
                        onChange={(v) => updateSector(idx, { altn: v })}
                        placeholder="ICAO"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "الشحن (KG)" : "Cargo"}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={sec.cargo ?? ""}
                        onChange={(e) => updateSector(idx, { cargo: e.target.value })}
                        placeholder="0"
                        className="h-7 text-[11px] font-mono"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className="text-[10px] font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>
                        {isAr ? `ملاحظات S${idx + 1}` : `S${idx + 1} Notes`}
                      </label>
                      <Input
                        value={sec.notes || ""}
                        onChange={(e) => updateSector(idx, { notes: e.target.value })}
                        placeholder={isAr ? "ملاحظات خاصة بهذا السكتر..." : "Sector-specific notes..."}
                        className="h-7 text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: INDEPENDENT PER-SECTOR CREW ASSIGNMENT PANEL */}
        <div className="lg:col-span-5 rounded-xl p-3 space-y-2.5" style={cardStyle}>
          <div
            className="flex items-center justify-between gap-2 pb-2 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--bg-app)" }}
              >
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-bold">
                  {isAr
                    ? `طاقم السكتر ${safeCrewSectorIdx + 1} (${assignedCount})`
                    : `Sector ${safeCrewSectorIdx + 1} Crew (${assignedCount})`}
                </h2>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "لكل سكتر طاقمه الخاص بشكل مستقل تماماً"
                    : "Independent crew roster per sector"}
                </p>
              </div>
            </div>

            {canAssignCrew && (
              <button
                type="button"
                onClick={addCrewSlot}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1 shrink-0 transition"
                style={{ background: "var(--brand-gradient)" }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAr ? "إضافة وظيفة" : "Add Role"}</span>
              </button>
            )}
          </div>

          {/* Sector Switcher for Independent Crew */}
          {form.sectors.length > 1 && (
            <div className="space-y-1.5 pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-1 flex-wrap">
                {form.sectors.map((sec, idx) => {
                  const isSel = safeCrewSectorIdx === idx;
                  const cCount = safeArray(sec.crewSlots).filter((s) => s.crewId).length;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveCrewSectorIdx(idx)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold font-mono whitespace-nowrap transition border ${
                        isSel ? "text-white border-transparent shadow-2xs" : ""
                      }`}
                      style={
                        isSel
                          ? { background: "var(--brand-gradient)" }
                          : {
                              backgroundColor: "var(--bg-app)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-primary)",
                            }
                      }
                    >
                      S{idx + 1}: {sec.dep || "---"}→{sec.arr || "---"} ({cCount})
                    </button>
                  );
                })}
              </div>
              {canAssignCrew && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {safeCrewSectorIdx > 0 && (
                    <button
                      type="button"
                      onClick={copySector1CrewToActive}
                      className="px-2 py-1 rounded text-[11px] font-semibold border hover:border-sky-500 transition flex items-center gap-1"
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
                    onClick={applyActiveCrewToAllSectors}
                    className="px-2 py-1 rounded text-[11px] font-semibold border hover:border-emerald-500 transition flex items-center gap-1"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Users className="w-3 h-3" />
                    <span>{isAr ? "تطبيق على جميع السكترات" : "Apply to All"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search & Show-all Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 text-slate-400" />
              <Input
                value={crewSearch}
                onChange={(e) => setCrewSearch(e.target.value)}
                placeholder={isAr ? "تصفية أسماء الطاقم..." : "Filter crew names..."}
                className="ps-8 h-8 text-xs"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllCrew}
                onChange={(e) => setShowAllCrew(e.target.checked)}
                className="w-3.5 h-3.5 rounded"
              />
              <span style={{ color: "var(--text-muted)" }}>
                {isAr ? "إظهار جميع الكوادر" : "Show all active crew"}
              </span>
            </label>
          </div>

          {/* Crew Slots List */}
          <div className="space-y-2">
            {activeSectorCrewSlots.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed text-center text-xs" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
                {isAr
                  ? `لا يوجد طاقم معيّن بعد للسكتر ${safeCrewSectorIdx + 1} — أضف وظيفة أو انسخ من السكتر الأول`
                  : `No crew assigned for Sector ${safeCrewSectorIdx + 1} yet — Add Role or Copy S1 Crew`}
              </div>
            ) : (
              activeSectorCrewSlots.map((slot, i) => {
                const usedPositions = activeSectorCrewSlots
                  .filter((_, idx) => idx !== i)
                  .map((s) => s.position)
                  .filter(Boolean);
                const allowedRoles = getAllowedRoles(slot.position);
                const qLower = crewSearch.trim().toLowerCase();

                const availableCrew = activeCrew.filter((c) => {
                  if (!showAllCrew) {
                    if (form.acft && !isCrewQualifiedForAircraft(c, form.acft)) {
                      return false;
                    }
                    if (allowedRoles.length > 0) {
                      const memberRoles = getMemberAllRoles(c);
                      if (!memberRoles.some((r) => allowedRoles.includes(r))) {
                        return false;
                      }
                    }
                  }
                  const assignedElsewhere = activeSectorCrewSlots.some(
                    (s, idx) => idx !== i && String(s.crewId) === String(c.id)
                  );
                  if (assignedElsewhere) return false;
                  if (qLower) {
                    return `${c.fullName || ""} ${c.empNo || ""}`
                      .toLowerCase()
                      .includes(qLower);
                  }
                  return true;
                });

                const selectedMember = slot.crewId
                  ? crew.find((c) => String(c.id) === String(slot.crewId))
                  : null;
                const isSelectedUnqualified =
                  selectedMember &&
                  form.acft &&
                  !isCrewQualifiedForAircraft(selectedMember, form.acft);
                const conflictFlight = slot.crewId
                  ? busyCrewMap[String(slot.crewId)]
                  : null;

                const availablePositions = POSITION_OPTIONS.filter(
                  (p) => !usedPositions.includes(p.key) || p.key === slot.position
                );

                return (
                  <div
                    key={i}
                    className="p-2 rounded-lg border space-y-1.5"
                    style={innerStyle}
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <Select
                          value={slot.position || ""}
                          disabled={!canAssignCrew}
                          onChange={(e) =>
                            updateCrewSlot(i, { position: e.target.value })
                          }
                          className="h-8 text-xs font-bold"
                        >
                          {availablePositions.map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.short || p.key} — {isAr ? p.ar : p.en}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="col-span-7">
                        <Select
                          value={String(slot.crewId || "")}
                          disabled={!canAssignCrew}
                          onChange={(e) =>
                            updateCrewSlot(i, { crewId: String(e.target.value) })
                          }
                          className="h-8 text-xs font-mono"
                        >
                          <option value="">
                            {isAr ? "— اختر فرد الطاقم —" : "— Select Crew —"}
                          </option>
                          {selectedMember &&
                            !availableCrew.some(
                              (c) => String(c.id) === String(selectedMember.id)
                            ) && (
                              <option value={String(selectedMember.id)}>
                                {selectedMember.empNo ? `[${selectedMember.empNo}] ` : ""}
                                {selectedMember.fullName}
                              </option>
                            )}
                          {availableCrew.map((c) => {
                            const busy = busyCrewMap[String(c.id)];
                            return (
                              <option key={c.id} value={String(c.id)}>
                                {c.empNo ? `[${c.empNo}] ` : ""}
                                {c.fullName}
                                {busy ? ` (${isAr ? "رحلة" : "on"} ${busy})` : ""}
                              </option>
                            );
                          })}
                        </Select>
                      </div>

                      <div className="col-span-1 text-end">
                        {canAssignCrew && (
                          <button
                            type="button"
                            onClick={() => removeCrewSlot(i)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
                            title={isAr ? "إزالة" : "Remove"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {(conflictFlight || isSelectedUnqualified) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] px-1">
                        {conflictFlight && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              {isAr
                                ? `مجدول مسبقاً في نفس اليوم على ${conflictFlight}`
                                : `Also scheduled today on ${conflictFlight}`}
                            </span>
                          </span>
                        )}
                        {isSelectedUnqualified && (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            <span>
                              {isAr
                                ? `غير مؤهل على ${form.acft}`
                                : `Not qualified on ${form.acft}`}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperationsQuickHub;
