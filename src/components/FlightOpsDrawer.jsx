/* ═══════════════════════════════════════════════════════════
 * FLIGHT OPS DRAWER — Lateral Control Panel & Journey Log
 * Features:
 * - Vertical Navigation Tabs (FLIGHT, TRIP, CREW, PAX, W&B, FUEL, JL)
 * - Multi-Sector / Leg Navigator
 * - Live 24H UTC Time & Duration Calculation
 * - One-Click "COPY DATA FROM FW" for Journey Log (JL)
 * - Direct Actuals & Fuel Calculations (Block Fuel - Used = Remaining)
 * - Full Crew Assignment with #empNo codes and FTL checks
 * - AeroOps Executive Aviation Dark & Light Theme
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plane,
  Clock,
  Users,
  CheckCircle2,
  Trash2,
  Save,
  Plus,
  RefreshCw,
  Copy,
  Building2,
  PlaneTakeoff,
  PlaneLanding,
  Briefcase,
  UserCheck,
  Edit2,
  History,
} from "lucide-react";
import { useAuth } from "../contexts";
import { TripHistoryModal } from "./TripHistoryModal";
import { Time24Input } from "./ui/Time24Input";
import { AirportInput } from "./AirportInput";
import { DelayCodeInput } from "./DelayCodeInput";
import { NightTimeInput } from "./NightTimeInput";
import { showToast, confirmAction } from "../utils/dialog";
import {
  FLIGHT_TYPES,
  isCrewQualifiedForAircraft,
  getAllowedRoles,
  getCrewAssignedAircrafts,
  getMemberAllRoles,
  POSITION_OPTIONS,
  getPositionOptions,
} from "../config/constants";
import { readSheetCache } from "../api";
import {
  calcDuration24,
  calcAirborneNightMinutes,
  minutesToHHMM,
  hhmmToMinutes,
} from "../utils/flightTiming";
import { searchAirports, findAirport } from "../airports";
import { getCrewDailyFtlStats } from "./CrewContactCard";
import { getCrewDailyFtlDetailed } from "../utils/multiSectorFtl";
import { AirportHoverCard } from "./AirportHoverCard";

const POSITION_CANONICAL_MAP = {
  CPT: "CPT",
  CAPTAIN: "CPT",
  PIC: "CPT",
  INS: "INS",
  INSTRUCTOR: "INS",
  TRI: "TRI",
  FO: "FO",
  FIRSTOFFICER: "FO",
  COPILOT: "FO",
  SP: "SP",
  SAFETYPILOT: "SP",
  UTR: "UTR",
  UNDERTRAINING: "UTR",
  FA1: "FA1",
  FA2: "FA2",
  FA3: "FA3",
  FLIGHTATTENDANT: "FA3",
  IFA: "IFA",
  ENG1: "ENG1",
  ENGINEER: "ENG1",
  ENG2: "ENG2",
  ENGINEER2: "ENG2",
  SEC: "SEC",
  SECURITY: "SEC",
  LMC: "LMC",
  LOADMASTER: "LMC",
  FD: "FD",
  FLIGHTDISPATCHER: "FD",
  FA4: "FA4",
  OBS: "OBS",
  OBSERVER: "OBS",
};

function normalizeDrawerPosCode(pos) {
  const clean = String(pos || "").replace(/[\s_-]+/g, "").toUpperCase();
  return POSITION_CANONICAL_MAP[clean] || String(pos || "").trim().toUpperCase();
}

function dedupeSectorCrewSlots(rawSlots) {
  if (!Array.isArray(rawSlots)) return [];
  const seenPos = new Set();
  const seenCrew = new Set();
  const result = [];
  for (const s of rawSlots) {
    if (!s) continue;
    const normPos = normalizeDrawerPosCode(s.position);
    if (!normPos) continue;
    if (seenPos.has(normPos)) continue;
    if (s.crewId) {
      const cKey = String(s.crewId);
      if (seenCrew.has(cKey)) continue;
      seenCrew.add(cKey);
    }
    seenPos.add(normPos);
    result.push({ ...s, position: normPos });
  }
  return result;
}

export function FlightOpsDrawer({
  isOpen,
  onClose,
  draft,
  setDraft,
  onSave,
  onDelete,
  saving = false,
  fleet = [],
  crew = [],
  flights = [],
  canEdit = true,
  canDelete = false,
  canAssignCrew = true,
  canViewTripHistory = true,
  canEditJl = true,
  initialTab = "flight",
  initialCrewId = null,
  targetLegIdx = -1,
  onChangeTargetLegIdx,
  lang = "ar",
}) {
  const isAr = lang === "ar";
  const { user } = useAuth();
  const canModifyCrew = canEdit || canAssignCrew;
  const canModifyJl = canEdit || canEditJl;
  const normalizeTab = (t) => (t === "pax" || t === "wb" || t === "fuel" ? "trip" : t || "flight");
  const [activeTab, setActiveTab] = useState(() => normalizeTab(initialTab));
  const [crewSearch, setCrewSearch] = useState("");
  const [ftlCalculationsOpen, setFtlCalculationsOpen] = useState(true);
  const [selectedFtlCrewId, setSelectedFtlCrewId] = useState(initialCrewId ? String(initialCrewId) : null);
  const [editingPosKey, setEditingPosKey] = useState(null);
  const [copyCrewPickerOpen, setCopyCrewPickerOpen] = useState(false);
  const [addPosPickerOpen, setAddPosPickerOpen] = useState(false);
  const [manualExtraPositions, setManualExtraPositions] = useState({});
  const [customPosInput, setCustomPosInput] = useState("");
  const [tripHistoryOpen, setTripHistoryOpen] = useState(false);

  useEffect(() => {
    setManualExtraPositions({});
    setCustomPosInput("");
    setEditingPosKey(null);
    setAddPosPickerOpen(false);
  }, [draft?.id]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(normalizeTab(initialTab));
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialCrewId) {
      setSelectedFtlCrewId(String(initialCrewId));
      setActiveTab("crew");
      setFtlCalculationsOpen(true);
    }
  }, [initialCrewId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredCrewList = useMemo(() => {
    if (!crewSearch.trim()) return crew || [];
    const q = crewSearch.toLowerCase().trim();
    return (crew || []).filter((c) => {
      const name = (c.fullName || "").toLowerCase();
      const code = (c.empNo || c.id || "").toLowerCase();
      const role = (c.role || "").toLowerCase();
      return name.includes(q) || code.includes(q) || role.includes(q);
    });
  }, [crew, crewSearch]);

  if (!isOpen || !draft) return null;

  /* ═══ Active Sector Resolver (Each Sector Independent) ═══ */
  const legs = Array.isArray(draft.legs) ? draft.legs : [];
  const isEditingMain = targetLegIdx === -1;
  const currentLeg = !isEditingMain && legs[targetLegIdx] ? legs[targetLegIdx] : null;

  // Sector Data
  const sectorFlightNo = isEditingMain
    ? draft.flightNo || ""
    : currentLeg?.flightNo || draft.flightNo || "";
  const sectorDate = isEditingMain
    ? draft.date || ""
    : currentLeg?.date || draft.date || "";
  const sectorDep = isEditingMain ? draft.dep || "" : currentLeg?.dep || "";
  const sectorArr = isEditingMain ? draft.arr || "" : currentLeg?.arr || "";
  const sectorStd = isEditingMain ? draft.std || "12:00" : currentLeg?.std || "12:00";
  const sectorSta = isEditingMain ? draft.sta || "13:30" : currentLeg?.sta || "13:30";
  const sectorAcft = isEditingMain ? draft.acft || "" : currentLeg?.acft || draft.acft || "";
  const sectorNature = isEditingMain
    ? draft.flightNature || "PAX"
    : currentLeg?.flightNature || "PAX";
  const sectorPax = isEditingMain
    ? draft.pax !== undefined && draft.pax !== null ? draft.pax : ""
    : currentLeg?.pax !== undefined && currentLeg?.pax !== null ? currentLeg.pax : "";
  const sectorStatus = isEditingMain
    ? draft.status || "SCHEDULED"
    : currentLeg?.status || draft.status || "SCHEDULED";
  const sectorFlightType = isEditingMain
    ? draft.flightType || "SCHEDULED"
    : currentLeg?.flightType || draft.flightType || "SCHEDULED";
  const sectorAltn = isEditingMain ? draft.altn || "" : currentLeg?.altn ?? "";
  const sectorAltn2 = isEditingMain ? draft.altn2 || "" : currentLeg?.altn2 ?? "";
  const sectorDistance = isEditingMain ? draft.distance || "" : currentLeg?.distance ?? draft.distance ?? "";
  const sectorCargo = isEditingMain ? draft.cargo || "" : currentLeg?.cargo ?? "";
  const sectorBaggage = isEditingMain ? draft.baggage || "" : currentLeg?.baggage ?? "";
  const sectorPaxManifest = isEditingMain ? draft.paxManifest || "" : currentLeg?.paxManifest ?? "";
  const sectorPermits = isEditingMain ? draft.permits || "" : currentLeg?.permits ?? "";
  const sectorServices = isEditingMain ? draft.services || "" : currentLeg?.services ?? "";
  const sectorNotes = isEditingMain ? draft.notes || "" : currentLeg?.notes ?? "";
  const sectorFuel = isEditingMain
    ? draft.fuel || {}
    : currentLeg?.fuel || {};
  const sectorBlockFuel = isEditingMain
    ? sectorFuel.blockFuel ?? draft.blockFuel ?? ""
    : sectorFuel.blockFuel ?? currentLeg?.blockFuel ?? "";
  const sectorZfw = isEditingMain ? draft.zfw || "" : currentLeg?.zfw ?? "";
  const sectorTow = isEditingMain ? draft.tow || "" : currentLeg?.tow ?? "";
  const sectorPic = isEditingMain ? draft.pic || "" : currentLeg?.pic ?? "";

  // Duration
  const sectorBlockDur = calcDuration24(sectorStd, sectorSta);

  // Actuals for Journey Log (per sector)
  const actual = isEditingMain ? draft.actual || {} : currentLeg?.actual || {};
  const bloffHHMM = actual.std ? String(actual.std).slice(11, 16) : (actual.bloff || "");
  const toHHMM = actual.takeoff ? String(actual.takeoff).slice(11, 16) : (actual.to || "");
  const ldgHHMM = actual.landing ? String(actual.landing).slice(11, 16) : (actual.ldg || "");
  const blonHHMM = actual.sta ? String(actual.sta).slice(11, 16) : (actual.blon || "");

  const actualAirDur = calcDuration24(toHHMM, ldgHHMM);
  const actualBlockDur = calcDuration24(bloffHHMM, blonHHMM);
  const autoNightCalc = calcAirborneNightMinutes({
    depCode: sectorDep,
    arrCode: sectorArr,
    dateStr: sectorDate,
    toHHMM,
    ldgHHMM,
    bloffHHMM,
    blonHHMM,
  });
  const nightMode = actual.nightMode || "auto";
  const effectiveNightMin =
    nightMode === "auto"
      ? autoNightCalc.minutes
      : nightMode === "flight_time"
      ? actualAirDur.minutes
      : nightMode === "full_block"
      ? actualBlockDur.minutes
      : Number(actual.night ?? hhmmToMinutes(actual.nightTime));
  const effectiveNightHHMM = minutesToHHMM(effectiveNightMin);

  /* ═══ Field Update Helpers ═══ */
  const updateDraft = (updates) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const updateCurrentSector = (updates) => {
    if (isEditingMain) {
      updateDraft(updates);
    } else if (targetLegIdx >= 0) {
      setDraft((prev) => {
        const nextLegs = [...(prev.legs || [])];
        nextLegs[targetLegIdx] = { ...(nextLegs[targetLegIdx] || {}), ...updates };
        return { ...prev, legs: nextLegs };
      });
    }
  };

  const syncNightIfAuto = (nextActual, nextTo, nextLdg, nextBloff, nextBlon) => {
    const mode = nextActual.nightMode || "auto";
    if (mode === "auto") {
      const calc = calcAirborneNightMinutes({
        depCode: sectorDep,
        arrCode: sectorArr,
        dateStr: sectorDate,
        toHHMM: nextTo,
        ldgHHMM: nextLdg,
        bloffHHMM: nextBloff,
        blonHHMM: nextBlon,
      });
      nextActual.night = calc.minutes;
      nextActual.nightTime = calc.hhmm;
    } else if (mode === "flight_time") {
      const air = calcDuration24(nextTo, nextLdg);
      nextActual.night = air.minutes;
      nextActual.nightTime = air.hhmm;
    } else if (mode === "full_block") {
      const blk = calcDuration24(nextBloff, nextBlon);
      nextActual.night = blk.minutes;
      nextActual.nightTime = blk.hhmm;
    }
    return nextActual;
  };

  const updateActual = (field, val) => {
    const nextActual = { ...(actual || {}), [field]: val };
    if (field === "blockFuel" || field === "fuelUsed") {
      const bf = Number(nextActual.blockFuel) || 0;
      const fu = Number(nextActual.fuelUsed) || 0;
      nextActual.fuelRemaining = Math.max(0, bf - fu);
    }
    updateCurrentSector({ actual: nextActual });
  };

  const updateActualTime = (field, hhmm) => {
    const baseDate = sectorDate || new Date().toISOString().slice(0, 10);
    const nextIso = hhmm ? `${baseDate}T${hhmm}:00Z` : "";
    const nextActual = { ...(actual || {}), [field]: nextIso };
    if (field === "std" || field === "sta" || field === "takeoff" || field === "landing") {
      const nextBloff = field === "std" ? hhmm : bloffHHMM;
      const nextBlon = field === "sta" ? hhmm : blonHHMM;
      const nextTo = field === "takeoff" ? hhmm : toHHMM;
      const nextLdg = field === "landing" ? hhmm : ldgHHMM;
      syncNightIfAuto(nextActual, nextTo, nextLdg, nextBloff, nextBlon);
    }
    updateCurrentSector({ actual: nextActual });
  };

  /* ═══ Action: COPY DATA FROM FW ═══ */
  const handleCopyFromFW = () => {
    const baseDate = sectorDate || new Date().toISOString().slice(0, 10);
    const stdVal = sectorStd || "12:00";
    const staVal = sectorSta || "13:30";

    const [sh, sm] = stdVal.split(":").map(Number);
    const [eh, em] = staVal.split(":").map(Number);

    let toMin = sh * 60 + sm + 10;
    let ldgMin = eh * 60 + em - 6;
    if (ldgMin < toMin) ldgMin = toMin + 30;

    const toHH = String(Math.floor((toMin % (24 * 60)) / 60)).padStart(2, "0");
    const toMM = String(toMin % 60).padStart(2, "0");
    const ldgHH = String(Math.floor((ldgMin % (24 * 60)) / 60)).padStart(2, "0");
    const ldgMM = String(ldgMin % 60).padStart(2, "0");

    const toVal = `${toHH}:${toMM}`;
    const ldgVal = `${ldgHH}:${ldgMM}`;
    const blockFuelVal = Number(sectorBlockFuel) || 8000;
    const durMins = calcDuration24(stdVal, staVal).minutes || 60;
    const estBurn = Math.round((durMins / 60) * 3200);
    const remainFuel = Math.max(0, blockFuelVal - estBurn);

    const nextActual = syncNightIfAuto(
      {
        ...(actual || {}),
        std: `${baseDate}T${stdVal}:00Z`,
        sta: `${baseDate}T${staVal}:00Z`,
        takeoff: `${baseDate}T${toVal}:00Z`,
        landing: `${baseDate}T${ldgVal}:00Z`,
        blockFuel: blockFuelVal,
        fuelUsed: estBurn,
        fuelRemaining: remainFuel,
        uplift: Number(sectorFuel?.uplift || 0),
        nightMode: actual?.nightMode || "auto",
      },
      toVal,
      ldgVal,
      stdVal,
      staVal
    );

    updateCurrentSector({
      actual: nextActual,
      status: "ARRIVED",
    });

    showToast("✅ تم نسخ التوقيت والوقود المخطط إلى سجل هذا السكتر الفعلي", "success");
  };

  /* ═══ Assigned Crew Resolver (Per-Sector Independent, Deduplicated) ═══ */
  const rawSectorCrewSlots = isEditingMain
    ? Array.isArray(draft.crewSlots)
      ? draft.crewSlots
      : []
    : Array.isArray(currentLeg?.crewSlots)
    ? currentLeg.crewSlots
    : Array.isArray(draft.crewSlots)
    ? draft.crewSlots
    : [];
  const crewSlots = dedupeSectorCrewSlots(rawSectorCrewSlots);

  const addCrewSlot = (pos = "firstOfficer") => {
    updateCurrentSector({
      crewSlots: [...crewSlots, { position: pos, crewId: "" }],
    });
  };

  const removeCrewSlot = (index) => {
    updateCurrentSector({
      crewSlots: crewSlots.filter((_, idx) => idx !== index),
    });
  };

  const updateCrewSlot = (index, updates) => {
    const nextSlots = [...crewSlots];
    nextSlots[index] = { ...nextSlots[index], ...updates };
    updateCurrentSector({ crewSlots: nextSlots });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className="relative w-full max-w-[700px] h-full shadow-2xl flex flex-col z-10 transition-transform duration-300 ease-out border-l dark:border-slate-800"
        style={{
          backgroundColor: "var(--bg-card)",
          color: "var(--text-primary)",
        }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* ═══ TOP DRAWER BANNER & CONTROLS ═══ */}
        <div
          className="px-3 py-2 border-b flex items-center justify-between gap-2.5 shrink-0"
          style={{
            borderColor: "var(--border-default)",
            background: "linear-gradient(135deg, rgba(30, 58, 138, 0.08), rgba(14, 165, 233, 0.04))",
          }}
        >
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs" style={{ background: "var(--brand-gradient)", color: "white" }}>
              <Plane className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-extrabold text-xs tracking-tight" style={{ color: "var(--brand-primary)" }}>
                  {sectorFlightNo || "FLIGHT"}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 font-mono">
                  {sectorDate || "No Date"}
                </span>
                {sectorAcft && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 font-mono">
                    {sectorAcft}
                  </span>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    sectorStatus === "ARRIVED"
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                      : sectorStatus === "CANCELLED"
                      ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                      : sectorStatus === "DELAYED"
                      ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                      : sectorStatus === "DEPARTED" || sectorStatus === "IN_FLIGHT"
                      ? "bg-sky-500/15 text-sky-600 border border-sky-500/30"
                      : "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30"
                  }`}
                >
                  {sectorStatus}
                </span>
              </div>
              <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                <span>{sectorStd}z</span>
                <span>{sectorDep || "—"}</span>
                <span>➔</span>
                <span>{sectorArr || "—"}</span>
                <span>{sectorSta}z</span>
                <span className="text-slate-400">·</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold">{sectorBlockDur.hhmm} Block</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canViewTripHistory && (
              <button
                type="button"
                onClick={() => setTripHistoryOpen(true)}
                className="p-1.5 rounded-full border hover:bg-sky-500/10 hover:text-sky-600 hover:border-sky-500/40 transition"
                style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                title={isAr ? "سجل تعديلات الرحلة / Trip History" : "Trip History"}
              >
                <History className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md border hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
              title={isAr ? "إغلاق" : "Close"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═══ MULTI-SECTOR BAR (IF FLIGHT HAS LEGS) ═══ */}
        {legs.length > 0 && (
          <div
            className="px-3 py-1 border-b flex items-center gap-1.5 overflow-x-auto text-xs shrink-0"
            style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
          >
            <span className="text-[10px] font-bold text-slate-500 shrink-0 uppercase">
              {isAr ? "القطاعات:" : "Sectors:"}
            </span>
            <button
              type="button"
              onClick={() => onChangeTargetLegIdx?.(-1)}
              className={`px-2 py-0.5 rounded font-bold transition shrink-0 flex items-center gap-1 text-[11px] border ${
                isEditingMain
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
            >
              <span>Sector 1</span>
              <span className="font-mono text-[10px]">({draft.dep || "—"}➔{draft.arr || "—"})</span>
            </button>

            {legs.map((leg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChangeTargetLegIdx?.(idx)}
                className={`px-2 py-0.5 rounded font-bold transition shrink-0 flex items-center gap-1 text-[11px] border ${
                  targetLegIdx === idx
                    ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                }`}
              >
                <span>Sector {idx + 2}</span>
                <span className="font-mono text-[10px]">({leg.dep || "—"}➔{leg.arr || "—"})</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const prev = legs.length > 0 ? legs[legs.length - 1] : draft;
                const lastDep = prev?.arr || "";
                const prevSta = prev?.sta || "12:00";
                const [h, m] = String(prevSta).split(":").map(Number);
                const startM = Number.isNaN(h) ? 720 : h * 60 + (m || 0) + 45;
                const nextStd = `${String(Math.floor(startM / 60) % 24).padStart(2, "0")}:${String(startM % 60).padStart(2, "0")}`;
                const nextStaM = startM + 90;
                const nextSta = `${String(Math.floor(nextStaM / 60) % 24).padStart(2, "0")}:${String(nextStaM % 60).padStart(2, "0")}`;
                const newLeg = {
                  flightNo: draft.flightNo || "",
                  dep: lastDep,
                  arr: "",
                  date: prev?.date || draft.date || "",
                  std: nextStd,
                  sta: nextSta,
                  acft: draft.acft || "",
                  flightNature: prev?.flightNature || draft.flightNature || "PAX",
                  flightType: draft.flightType || "SCHEDULED",
                  status: "SCHEDULED",
                  pax: 0,
                  crewSlots: [],
                  notes: "",
                };
                updateDraft({ legs: [...legs, newLeg] });
                onChangeTargetLegIdx?.(legs.length);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 transition flex items-center gap-0.5 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>{isAr ? "+ قطاع" : "+ Leg"}</span>
            </button>
          </div>
        )}

        {/* ═══ MAIN DRAWER BODY WITH LATERAL VERTICAL TABS ═══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ═══ VERTICAL LATERAL TABS (COMPACT) ═══ */}
          <div
            className="w-16 md:w-20 border-r dark:border-slate-800 flex flex-col justify-start py-1 shrink-0 overflow-y-auto select-none"
            style={{
              backgroundColor: "var(--bg-app)",
              borderColor: "var(--border-default)",
            }}
          >
            {[
              { id: "flight", label: isAr ? "الرحلة" : "FLIGHT", icon: Plane, color: "text-sky-500" },
              { id: "trip", label: isAr ? "البيانات" : "TRIP", icon: Briefcase, color: "text-indigo-500" },
              { id: "crew", label: isAr ? "الطاقم" : "CREW", icon: Users, color: "text-emerald-500", badge: crewSlots.length },
              { id: "jl", label: isAr ? "المكتملة (JL)" : "Completed", icon: CheckCircle2, color: "text-emerald-500", highlight: true },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-2 px-1 flex flex-col items-center justify-center gap-1 transition text-center border-l-2 ${
                    isActive
                      ? "border-sky-500 bg-white dark:bg-slate-800 shadow-2xs font-extrabold"
                      : "border-transparent hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                  }`}
                  style={{
                    color: isActive ? "var(--brand-primary)" : "var(--text-muted)",
                  }}
                >
                  <IconComp className={`w-4 h-4 ${isActive ? tab.color : "opacity-70"}`} />
                  <span className="text-[10px] font-bold tracking-tight leading-tight">
                    {tab.label}
                  </span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="text-[8px] font-mono px-1 rounded-full bg-emerald-500 text-white font-bold leading-none py-0.5">
                      {tab.badge}
                    </span>
                  )}
                  {tab.highlight && actual?.sta && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══ TAB CONTENT AREA (TIGHTENED & ORGANIZED) ═══ */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
            {/* ─────────────────────────────────────────────────────────────
             * TAB 1: FLIGHT (بيانات الرحلة والقطاع النشط)
             * ───────────────────────────────────────────────────────────── */}
            {activeTab === "flight" && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
                  <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    <Plane className="w-3.5 h-3.5 text-sky-500" />
                    <span>
                      {isEditingMain
                        ? isAr
                          ? "معلومات القطاع الأول (Sector 1)"
                          : "Sector 1 Details"
                        : isAr
                        ? `بيانات القطاع المستقل (Sector ${targetLegIdx + 2})`
                        : `Independent Sector ${targetLegIdx + 2} Details`}
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Flight Status (Per Sector) */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-semibold">{isAr ? "حالة الرحلة:" : "Flight Status:"}</span>
                      <select
                        value={sectorStatus}
                        onChange={(e) => updateCurrentSector({ status: e.target.value })}
                        className="px-2 py-0.5 rounded text-[11px] font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                      >
                        <option value="SCHEDULED">SCHEDULED — مجدولة</option>
                        <option value="CONFIRMED">CONFIRMED — مؤكدة</option>
                        <option value="BOARDING">BOARDING — صعود الركاب</option>
                        <option value="DEPARTED">DEPARTED — أقلعت</option>
                        <option value="IN_FLIGHT">IN_FLIGHT — بالجو</option>
                        <option value="ARRIVED">ARRIVED — وصلت</option>
                        <option value="DELAYED">DELAYED — متأخرة</option>
                        <option value="CANCELLED">CANCELLED — ملغاة</option>
                      </select>
                    </div>

                    {/* Nature: PAX / FERRY */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-semibold">{isAr ? "طبيعة الرحلة:" : "Nature:"}</span>
                      <div className="inline-flex p-0.5 rounded-md border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => updateCurrentSector({ flightNature: "PAX" })}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                            sectorNature === "PAX"
                              ? "bg-sky-600 text-white shadow-2xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          PAX
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCurrentSector({ flightNature: "FERRY", pax: 0 })}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                            sectorNature === "FERRY"
                              ? "bg-amber-600 text-white shadow-2xs"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          FERRY
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      {isAr ? "التاريخ (Date)" : "Date"}
                    </label>
                    <input
                      type="date"
                      value={sectorDate}
                      onChange={(e) => updateCurrentSector({ date: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      {isAr ? "رقم الرحلة (Flight No)" : "Flight No"}
                    </label>
                    <input
                      type="text"
                      value={sectorFlightNo}
                      onChange={(e) => updateCurrentSector({ flightNo: e.target.value.toUpperCase() })}
                      placeholder="GAK880"
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-mono font-bold uppercase bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                {/* Departure & Arrival Sector */}
                <div className="p-2 rounded-lg border bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <PlaneTakeoff className="w-3 h-3 text-sky-500" />
                        <span>{isAr ? "مطار الإقلاع (ADEP)" : "Departure (ADEP)"}</span>
                      </label>
                      <AirportInput
                        value={sectorDep}
                        onChange={(val) => updateCurrentSector({ dep: val })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-sky-500" />
                        <span>{isAr ? "وقت الإقلاع STD (4D)" : "STD (4D UTC)"}</span>
                      </label>
                      <Time24Input
                        value={sectorStd}
                        onChange={(val) => updateCurrentSector({ std: val })}
                        compact={true}
                        showNowButton={false}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <PlaneLanding className="w-3 h-3 text-indigo-500" />
                        <span>{isAr ? "مطار الوصول (ADES)" : "Destination (ADES)"}</span>
                      </label>
                      <AirportInput
                        value={sectorArr}
                        onChange={(val) => updateCurrentSector({ arr: val })}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        <span>{isAr ? "وقت الوصول STA (4D)" : "STA (4D UTC)"}</span>
                      </label>
                      <Time24Input
                        value={sectorSta}
                        onChange={(val) => updateCurrentSector({ sta: val })}
                        compact={true}
                        showNowButton={false}
                      />
                    </div>
                  </div>

                  {/* Calculated Durations Banner */}
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-500" />
                      <span>{isAr ? "مدة الرحلة المخططة (Block Time):" : "Planned Block Time:"}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-xs">
                      {sectorBlockDur.hhmm} ({sectorBlockDur.minutes} min)
                    </span>
                  </div>
                </div>

                {/* Alternates & Flight Navigation details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      ALTN 1
                    </label>
                    <AirportInput
                      value={sectorAltn}
                      onChange={(v) => updateCurrentSector({ altn: v })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      ALTN 2
                    </label>
                    <AirportInput
                      value={sectorAltn2}
                      onChange={(v) => updateCurrentSector({ altn2: v })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Distance (NM)
                    </label>
                    <input
                      type="number"
                      value={sectorDistance}
                      onChange={(e) => updateCurrentSector({ distance: e.target.value })}
                      placeholder="384"
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Rule (قواعد الطيران)
                    </label>
                    <select
                      value={draft.flightRule || "I"}
                      onChange={(e) => updateDraft({ flightRule: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold"
                    >
                      <option value="I">I - IFR (آلي)</option>
                      <option value="V">V - VFR (بصري)</option>
                      <option value="Y">Y - IFR/VFR</option>
                      <option value="Z">Z - VFR/IFR</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Rotation (التجهيز)
                    </label>
                    <input
                      type="text"
                      value={draft.rotation || "00:20"}
                      onChange={(e) => updateDraft({ rotation: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      ICAO Type
                    </label>
                    <select
                      value={draft.icaoType || "S"}
                      onChange={(e) => updateDraft({ icaoType: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold"
                    >
                      <option value="S">S - Scheduled</option>
                      <option value="N">N - Non-Scheduled</option>
                      <option value="G">G - General Aviation</option>
                      <option value="M">M - Military</option>
                      <option value="X">X - Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Base (القاعدة)
                    </label>
                    <input
                      type="text"
                      value={draft.base || "Default"}
                      onChange={(e) => updateDraft({ base: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
             * TAB 2: TRIP (بيانات العميل، النوع، الملاحظات) — كما في الصورة 2
             * ───────────────────────────────────────────────────────────── */}
            {activeTab === "trip" && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
                  <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{isAr ? "بيانات الرحلة، العميل والتصاريح (Trip Info)" : "Trip & Client Details"}</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Trip No (الطلب)
                    </label>
                    <input
                      type="text"
                      value={draft.tripNo || ""}
                      onChange={(e) => updateDraft({ tripNo: e.target.value })}
                      placeholder="TR-2026-001"
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-mono bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Status (حالة السكتر)
                    </label>
                    <select
                      value={sectorStatus}
                      onChange={(e) => updateCurrentSector({ status: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    >
                      <option value="SCHEDULED">SCHEDULED (مجدولة)</option>
                      <option value="CONFIRMED">CONFIRMED (مؤكدة)</option>
                      <option value="BOARDING">BOARDING (صعود الركاب)</option>
                      <option value="DEPARTED">DEPARTED (أقلعت)</option>
                      <option value="IN_FLIGHT">IN_FLIGHT (بالجو)</option>
                      <option value="ARRIVED">ARRIVED (وصلت / مكتملة)</option>
                      <option value="DELAYED">DELAYED (متأخرة)</option>
                      <option value="CANCELLED">CANCELLED (ملغاة)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      Flight Type (نوع التشغيل)
                    </label>
                    <select
                      value={sectorFlightType}
                      onChange={(e) => updateCurrentSector({ flightType: e.target.value })}
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold"
                    >
                      {FLIGHT_TYPES.map((ft) => (
                        <option key={ft.key} value={ft.key}>
                          {ft.ar || ft.key}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-500" />
                      <span>{isAr ? "العميل / الجهة المستأجرة (Client)" : "Client"}</span>
                    </label>
                    <input
                      type="text"
                      value={draft.client || ""}
                      onChange={(e) => updateDraft({ client: e.target.value })}
                      placeholder="Waha Oil / Mellitah / NOC"
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-slate-500" />
                      <span>{isAr ? "المسؤول التشغيلي (Assignee)" : "Assignee / Dispatcher"}</span>
                    </label>
                    <input
                      type="text"
                      value={draft.assignee || ""}
                      onChange={(e) => updateDraft({ assignee: e.target.value })}
                      placeholder="Dispatch Desk"
                      className="w-full px-2 py-1 h-8 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      {isAr ? "تصاريح الطيران والعبور (Permits)" : "Permits"}
                    </label>
                    <textarea
                      rows={1.5}
                      value={sectorPermits}
                      onChange={(e) => updateCurrentSector({ permits: e.target.value })}
                      placeholder="أرقام وتفاصيل التصاريح..."
                      className="w-full px-2 py-1 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      {isAr ? "المناولة الأرضية والخدمات (Handling)" : "Handling & Services"}
                    </label>
                    <textarea
                      rows={1.5}
                      value={sectorServices}
                      onChange={(e) => updateCurrentSector({ services: e.target.value })}
                      placeholder="المناولة والخدمات..."
                      className="w-full px-2 py-1 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t" style={{ borderColor: "var(--border-default)" }}>
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-amber-700 dark:text-amber-400">
                      {isAr ? "الملاحظات الخاصة للرحلة (Private Flight Notes)" : "Private / Special Flight Notes"}
                    </label>
                    <textarea
                      rows={2}
                      value={draft.privateNotes || ""}
                      onChange={(e) => updateDraft({ privateNotes: e.target.value })}
                      placeholder={
                        isAr
                          ? "اكتب الملاحظات الخاصة بالرحلة (VIP، تعليمات داخلية، تنبيهات خاصة)..."
                          : "Special or private operational notes for this flight..."
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-amber-50/40 dark:bg-amber-950/20 border-amber-300/70 dark:border-amber-700/60 resize-none focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-0.5 text-slate-500 dark:text-slate-400">
                      {isAr ? "ملاحظات السكتر (Sector Notes)" : "Sector Notes"}
                    </label>
                    <textarea
                      rows={2}
                      value={sectorNotes}
                      onChange={(e) => updateCurrentSector({ notes: e.target.value })}
                      placeholder={
                        isAr
                          ? "ملاحظات أو تعليمات خاصة بهذا السكتر..."
                          : "Notes for this sector..."
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
             * TAB 3: CREW (طاقم الرحلة والتعيينات مطابق للصورة رقم 5)
             * ───────────────────────────────────────────────────────────── */}
            {activeTab === "crew" && (() => {
              const STANDARD_POSITIONS = [
                { code: "CPT", label: "Captain", role: "captain", key: "captain" },
                { code: "INS", label: "Instructor", role: "tri", key: "instructor" },
                { code: "TRI", label: "Training Instructor", role: "tri", key: "tri" },
                { code: "FO", label: "First Officer", role: "firstOfficer", key: "firstOfficer" },
                { code: "SP", label: "Safety Pilot", role: "firstOfficer", key: "safetyPilot" },
                { code: "UTR", label: "Under Training", role: "firstOfficer", key: "underTraining" },
                { code: "FA1", label: "Flight Attendant 1", role: "fa1", key: "fa1" },
                { code: "FA2", label: "Flight Attendant 2", role: "fa2", key: "fa2" },
                { code: "FA3", label: "Flight Attendant 3", role: "flightAttendant", key: "fa3" },
                { code: "IFA", label: "In-Flight Attendant", role: "flightAttendant", key: "ifa" },
                { code: "ENG1", label: "Flight Engineer 1", role: "engineer", key: "engineer" },
                { code: "ENG2", label: "Flight Engineer 2", role: "engineer", key: "engineer2" },
              ];

              const sectorKey = isEditingMain ? "main" : `leg_${targetLegIdx}`;
              const manualCodesForSector = manualExtraPositions[sectorKey] || [];

              const DEFAULT_EXTRA_POSITIONS = [
                { code: "SEC", label: "Security", role: "security", key: "security" },
                { code: "LMC", label: "Loadmaster", role: "loadmaster", key: "loadmaster" },
                { code: "FD", label: "Flight Dispatcher", role: "flightDispatcher", key: "flightDispatcher" },
                { code: "FA4", label: "Flight Attendant 4", role: "flightAttendant", key: "fa4" },
                { code: "OBS", label: "Observer", role: "observer", key: "observer" },
              ];

              const settingsPosList = getPositionOptions(readSheetCache("Settings", {}));
              const EXTRA_POSITIONS = [...DEFAULT_EXTRA_POSITIONS];
              (settingsPosList || []).forEach((sp) => {
                const cCode = normalizeDrawerPosCode(sp.short || sp.key);
                if (!cCode) return;
                if (STANDARD_POSITIONS.some((p) => p.code === cCode)) return;
                if (EXTRA_POSITIONS.some((ep) => ep.code === cCode)) return;
                EXTRA_POSITIONS.push({
                  code: cCode,
                  label: sp.en || sp.ar || cCode,
                  role: sp.key || cCode.toLowerCase(),
                  key: sp.key || cCode.toLowerCase(),
                });
              });

              const addManualPositionCode = (rawCode, openSelect = true) => {
                const cCode = normalizeDrawerPosCode(rawCode);
                if (!cCode) return;
                setManualExtraPositions((prev) => {
                  const cur = prev[sectorKey] || [];
                  if (cur.includes(cCode)) return prev;
                  return { ...prev, [sectorKey]: [...cur, cCode] };
                });
                setAddPosPickerOpen(false);
                if (openSelect) {
                  setTimeout(() => setEditingPosKey(cCode), 15);
                }
              };

              const removeManualPositionCode = (posCode) => {
                const cCode = normalizeDrawerPosCode(posCode);
                setManualExtraPositions((prev) => ({
                  ...prev,
                  [sectorKey]: (prev[sectorKey] || []).filter((c) => c !== cCode),
                }));
                const filtered = dedupeSectorCrewSlots(crewSlots).filter(
                  (s) => normalizeDrawerPosCode(s.position) !== cCode
                );
                updateCurrentSector({ crewSlots: filtered });
                if (editingPosKey === cCode) setEditingPosKey(null);
              };

              // Gather custom/extra positions from crewSlots OR manually added via + ADD POSITION
              const existingCustomPositions = [];
              const seenExtraCodes = new Set();
              const pushExtraCode = (rawPos) => {
                const sCode = normalizeDrawerPosCode(rawPos);
                if (!sCode) return;
                if (STANDARD_POSITIONS.some((p) => p.code === sCode)) return;
                if (seenExtraCodes.has(sCode)) return;
                seenExtraCodes.add(sCode);
                const matchedExtra = EXTRA_POSITIONS.find((ep) => ep.code === sCode);
                existingCustomPositions.push(
                  matchedExtra
                    ? { ...matchedExtra, isExtra: true }
                    : {
                        code: sCode,
                        label: sCode,
                        role: sCode.toLowerCase(),
                        key: sCode.toLowerCase(),
                        isCustom: true,
                        isExtra: true,
                      }
                );
              };

              (crewSlots || []).forEach((s) => {
                if (s && s.position) pushExtraCode(s.position);
              });
              manualCodesForSector.forEach((c) => pushExtraCode(c));

              // Combine all positions in order
              const allDisplayPositions = [...STANDARD_POSITIONS, ...existingCustomPositions];

              // Strictly match slot by canonical position code to avoid cross-position duplicates
              const getSlotForPos = (pos) => {
                if (!Array.isArray(crewSlots)) return null;
                return crewSlots.find(
                  (s) => s && normalizeDrawerPosCode(s.position) === pos.code
                );
              };

              // Assign member to position (per-sector independent, strict 1-position-per-member)
              const handleAssign = (pos, memberId) => {
                const baseSlots = dedupeSectorCrewSlots(crewSlots);
                const pCode = pos.code;
                const existingIdx = baseSlots.findIndex(
                  (s) => normalizeDrawerPosCode(s.position) === pCode
                );

                if (memberId) {
                  const alreadyAssignedInAnotherPos = baseSlots.some((s, idx) => {
                    if (!s || !s.crewId) return false;
                    if (idx === existingIdx) return false;
                    return String(s.crewId) === String(memberId);
                  });
                  if (alreadyAssignedInAnotherPos) {
                    showToast("⚠️ لا يمكن تعيين نفس العضو لأكثر من وظيفة في نفس السكتر", "warning");
                    return;
                  }
                }

                const nextSlots = [...baseSlots];
                if (existingIdx >= 0) {
                  if (!memberId) {
                    nextSlots.splice(existingIdx, 1);
                  } else {
                    nextSlots[existingIdx] = {
                      ...nextSlots[existingIdx],
                      position: pCode,
                      crewId: String(memberId),
                    };
                  }
                } else if (memberId) {
                  nextSlots.push({
                    position: pCode,
                    crewId: String(memberId),
                  });
                }

                const updates = { crewSlots: dedupeSectorCrewSlots(nextSlots) };

                // Auto-set PIC if CPT assigned
                if (pos.code === "CPT" && memberId && !sectorPic) {
                  const mem = crew.find((c) => String(c.id) === String(memberId));
                  if (mem) {
                    updates.pic = mem.empNo ? String(mem.empNo).replace(/^#/, "") : mem.id;
                  }
                }

                updateCurrentSector(updates);
                setEditingPosKey(null);
              };

              // Clear slot
              const handleClear = (pos) => {
                const filtered = dedupeSectorCrewSlots(crewSlots).filter(
                  (s) => normalizeDrawerPosCode(s.position) !== pos.code
                );
                updateCurrentSector({ crewSlots: filtered });
                setEditingPosKey(null);
              };

              // Active assigned crew (deduplicated by member id)
              const assignedPilotsMap = new Map();
              (crewSlots || []).forEach((s) => {
                if (!s?.crewId) return;
                const mem = crew.find((c) => String(c.id) === String(s.crewId));
                if (mem && !assignedPilotsMap.has(String(mem.id))) {
                  assignedPilotsMap.set(String(mem.id), mem);
                }
              });
              const assignedPilots = Array.from(assignedPilotsMap.values());

              // Flights available to copy crew from
              const candidateFlightsToCopy = (flights || []).filter(
                (f) => String(f.id) !== String(draft.id) && Array.isArray(f.crewSlots) && f.crewSlots.length > 0
              );

              return (
                <div className="space-y-2.5 animate-in fade-in duration-200">
                  {/* ═══ Header Bar ═══ */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isEditingMain && (
                        <button
                          type="button"
                          onClick={() => {
                            const src = Array.isArray(draft.crewSlots) ? draft.crewSlots.map((s) => ({ ...s })) : [];
                            updateCurrentSector({ crewSlots: src, pic: draft.pic || sectorPic });
                            showToast(`✅ تم نسخ طاقم Sector 1 إلى Sector ${targetLegIdx + 2}`, "success");
                          }}
                          className="px-2.5 py-1 rounded text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition flex items-center gap-1 shadow-2xs"
                          title="نسخ طاقم القطاع الأول لهذا القطاع"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{isAr ? "نسخ طاقم S1" : "Copy S1 Crew"}</span>
                        </button>
                      )}

                      {/* [COPY CREW] Button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setCopyCrewPickerOpen(!copyCrewPickerOpen)}
                          className="px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                          style={{ background: "#84cc16", color: "#0f172a" }}
                          title="نسخ طاقم من رحلة سابقة"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY CREW</span>
                        </button>

                        {/* Copy Crew Dropdown */}
                        {copyCrewPickerOpen && (
                          <div className="absolute top-full start-0 mt-1 w-72 rounded-xl shadow-2xl p-2 z-30 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b text-[11px] font-bold text-slate-500">
                              <span>نسخ الطاقم من رحلة سابقة:</span>
                              <button
                                type="button"
                                onClick={() => setCopyCrewPickerOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                ✕
                              </button>
                            </div>
                            {candidateFlightsToCopy.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400">
                                لا توجد رحلات سابقة تحتوي على طاقم لنسخها
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {candidateFlightsToCopy.slice(0, 8).map((cf) => (
                                  <button
                                    key={cf.id}
                                    type="button"
                                    onClick={() => {
                                      updateCurrentSector({
                                        crewSlots: (cf.crewSlots || []).map((s) => ({ ...s })),
                                        pic: cf.pic || sectorPic,
                                      });
                                      setCopyCrewPickerOpen(false);
                                      showToast(`✅ تم نسخ طاقم الرحلة ${cf.flightNo || ""}`, "success");
                                    }}
                                    className="w-full text-start p-1.5 rounded-lg text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between"
                                  >
                                    <span className="font-mono font-bold text-sky-600">
                                      {cf.flightNo} ({cf.acft || "No ACFT"})
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {cf.crewSlots?.length || 0} أفراد
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* [+ ADD POSITION] Button */}
                      {canModifyCrew && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setAddPosPickerOpen(!addPosPickerOpen)}
                            className="px-2.5 py-1 rounded border text-xs font-bold transition flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            style={{
                              borderColor: "var(--border-default)",
                              color: "var(--text-primary)",
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>ADD POSITION</span>
                          </button>

                          {/* Add Position Dropdown */}
                          {addPosPickerOpen && (
                            <div className="absolute top-full start-0 mt-1 w-64 rounded-xl shadow-2xl p-2 z-30 border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between pb-1 mb-1 border-b text-[11px] font-bold text-slate-500">
                                <span>{isAr ? "اختر وظيفة إضافية:" : "Select extra position:"}</span>
                                <button
                                  type="button"
                                  onClick={() => setAddPosPickerOpen(false)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="space-y-0.5 max-h-52 overflow-y-auto">
                                {EXTRA_POSITIONS.map((ep) => {
                                  const alreadyAdded = allDisplayPositions.some((p) => p.code === ep.code);
                                  return (
                                    <button
                                      key={ep.code}
                                      type="button"
                                      onClick={() => addManualPositionCode(ep.code, true)}
                                      className="w-full text-start px-2 py-1.5 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold font-mono">{ep.code}</span>
                                        {alreadyAdded && (
                                          <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-slate-500 truncate ms-2">{ep.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1">
                                <input
                                  type="text"
                                  value={customPosInput}
                                  onChange={(e) => setCustomPosInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 8))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && customPosInput.trim()) {
                                      e.preventDefault();
                                      addManualPositionCode(customPosInput.trim(), true);
                                      setCustomPosInput("");
                                    }
                                  }}
                                  placeholder={isAr ? "رمز مخصص (مثل MED)" : "Custom code (e.g. MED)"}
                                  className="flex-1 h-7 px-2 text-xs font-mono uppercase rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:border-sky-500"
                                />
                                <button
                                  type="button"
                                  disabled={!customPosInput.trim()}
                                  onClick={() => {
                                    if (!customPosInput.trim()) return;
                                    addManualPositionCode(customPosInput.trim(), true);
                                    setCustomPosInput("");
                                  }}
                                  className="h-7 px-2 rounded bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* PIC Dropdown Selector */}
                    <div className="flex items-center gap-1.5 ms-auto">
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        PIC:
                      </span>
                      <select
                        value={sectorPic}
                        onChange={(e) => updateCurrentSector({ pic: e.target.value })}
                        className="px-2 py-0.5 rounded border text-xs font-mono font-bold bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                      >
                        <option value="">— اختر PIC —</option>
                        {assignedPilots.map((p) => {
                          const code = p.empNo ? String(p.empNo).replace(/^#/, "") : p.id;
                          return (
                            <option key={p.id} value={code}>
                              {code} - {p.fullName || p.name}
                            </option>
                          );
                        })}
                        {assignedPilots.length === 0 && (
                          <option value="HAK">HAK (Default PIC)</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Aircraft qualification alert if sector has aircraft */}
                  {sectorAcft && (
                    <div className="px-2.5 py-1 rounded-md text-[11px] flex items-center justify-between bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      <span>
                        الطائرة ({isEditingMain ? "Sector 1" : `Sector ${targetLegIdx + 2}`}):{" "}
                        <b className="font-mono">{sectorAcft}</b>
                      </span>
                      <span className="text-[10px] opacity-80">طاقم مستقل لكل سكتر · تصفية حسب التأهيل</span>
                    </div>
                  )}

                  {/* ═══ Positions Table ═══ */}
                  <div className="rounded-lg border overflow-hidden border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-slate-100/80 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 font-bold">
                          <th className="py-1 px-2 text-start w-16">Func</th>
                          <th className="py-1 px-2 text-start w-16">Code</th>
                          <th className="py-1 px-2 text-start">Name</th>
                          <th className="py-1 px-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allDisplayPositions.map((pos) => {
                          const slot = getSlotForPos(pos);
                          const assignedMember = slot?.crewId
                            ? crew.find((c) => String(c.id) === String(slot.crewId))
                            : null;
                          const isAssigned = !!assignedMember;
                          const memberCode = assignedMember
                            ? assignedMember.empNo
                              ? String(assignedMember.empNo).replace(/^#/, "")
                              : assignedMember.id
                            : "";
                          const memberName = assignedMember
                            ? assignedMember.fullName || assignedMember.name || ""
                            : "—";

                          // FTL & Aircraft Qualification Check
                          const isAcftQualified = assignedMember
                            ? isCrewQualifiedForAircraft(assignedMember, sectorAcft)
                            : true;
                          const dailyFtl = assignedMember
                            ? getCrewDailyFtlStats(assignedMember.id, sectorDate, flights)
                            : null;

                          let dotClass = "bg-slate-300 dark:bg-slate-700";
                          let dotTitle = "غير معين";

                          if (isAssigned) {
                            if (!isAcftQualified) {
                              dotClass = "bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-950";
                              dotTitle = `غير مؤهل للطائرة (${sectorAcft})`;
                            } else if (dailyFtl?.isExceeded) {
                              dotClass = "bg-rose-500 ring-2 ring-rose-200 dark:ring-rose-950";
                              dotTitle = `مخالف: تجاوز الحد الأقصى لساعات الخدمة FTL (${dailyFtl.actualStr} / ${dailyFtl.maxStr})`;
                            } else if (dailyFtl && dailyFtl.pct >= 80) {
                              dotClass = "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-950";
                              dotTitle = `تنبيه: اقتراب من الحد الأقصى FTL (${dailyFtl.actualStr} / ${dailyFtl.maxStr})`;
                            } else {
                              dotClass = "bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950";
                              dotTitle = "مؤهل للطائرة وداخل الحدود القانونية";
                            }
                          }

                          // Filter crew options strictly by aircraft and role + prevent duplicate assignment in same sector
                          const allowedRoles = getAllowedRoles(pos.role || pos.key);
                          const eligibleCrewForPos = crew.filter((c) => {
                            if (String(c.status || "active").toLowerCase() !== "active") return false;
                            if (sectorAcft && !isCrewQualifiedForAircraft(c, sectorAcft)) return false;
                            if (allowedRoles.length > 0) {
                              const memberRoles = getMemberAllRoles(c);
                              if (!memberRoles.some((r) => allowedRoles.includes(r))) return false;
                            }
                            const assignedToOtherPos = (crewSlots || []).some((s) => {
                              if (!s || !s.crewId) return false;
                              return normalizeDrawerPosCode(s.position) !== pos.code && String(s.crewId) === String(c.id);
                            });
                            if (assignedToOtherPos) return false;

                            return true;
                          });

                          const isEditingThisPos = editingPosKey === pos.code;
                          const isHighlighted =
                            selectedFtlCrewId &&
                            (String(assignedMember?.id) === String(selectedFtlCrewId) ||
                              String(slot?.crewId) === String(selectedFtlCrewId));

                          return (
                            <tr
                              key={pos.code}
                              onClick={() => {
                                if (assignedMember?.id) {
                                  setSelectedFtlCrewId(String(assignedMember.id));
                                }
                              }}
                              className={`border-b border-slate-100 dark:border-slate-800 transition cursor-pointer ${
                                isHighlighted
                                  ? "bg-sky-100 dark:bg-sky-950/60 ring-2 ring-sky-500 font-bold"
                                  : isAssigned
                                  ? "bg-[#edf7ed] dark:bg-emerald-950/20"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                              }`}
                            >
                              {/* Func Column */}
                              <td className="py-1 px-2 font-bold font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                {pos.code}
                              </td>

                              {/* Code Column */}
                              <td className="py-1 px-2 font-mono font-bold text-[11px] text-slate-600 dark:text-slate-400">
                                {memberCode || ""}
                              </td>

                              {/* Name Column */}
                              <td className="py-1 px-2">
                                {isEditingThisPos ? (
                                  <div className="flex items-center gap-1.5 animate-in fade-in duration-100">
                                    <select
                                      autoFocus
                                      value={assignedMember?.id || ""}
                                      onChange={(e) => handleAssign(pos, e.target.value)}
                                      onBlur={() => setEditingPosKey(null)}
                                      className="w-full px-2 py-0.5 rounded border text-xs font-mono font-medium bg-white dark:bg-slate-900 border-sky-400 shadow-xs outline-none"
                                    >
                                      <option value="">— اختر عضو الطاقم ({eligibleCrewForPos.length} مؤهل) —</option>
                                      {eligibleCrewForPos.map((c) => {
                                        const cCode = c.empNo ? String(c.empNo).replace(/^#/, "") : c.id;
                                        return (
                                          <option key={c.id} value={c.id}>
                                            {cCode} - {c.fullName || c.name} {c.role ? `(${c.role})` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPosKey(null)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-600"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      onClick={() => setEditingPosKey(pos.code)}
                                      className="flex-1 max-w-sm px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between cursor-pointer hover:border-slate-400 shadow-2xs group"
                                      title="اضغط للاختيار أو التعديل"
                                    >
                                      <span className="font-mono text-[11px] font-bold uppercase truncate text-slate-800 dark:text-slate-200">
                                        {memberName}
                                      </span>
                                      {isAssigned && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleClear(pos);
                                          }}
                                          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 transition"
                                          title="إلغاء التعيين"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Edit pencil icon */}
                                    {canModifyCrew && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingPosKey(pos.code);
                                        }}
                                        className="p-1 text-slate-400 hover:text-sky-600 transition cursor-pointer"
                                        title="تعديل التعيين"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canModifyCrew && pos.isExtra && !isAssigned && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeManualPositionCode(pos.code);
                                        }}
                                        className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                        title={isAr ? "إزالة هذه الوظيفة المضافة" : "Remove added position"}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Status Dot Column */}
                              <td className="py-1 px-2 text-center">
                                <div className="flex items-center justify-center">
                                  <span
                                    className={`w-3 h-3 rounded-full inline-block transition-transform duration-150 ${dotClass}`}
                                    title={dotTitle}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* ═══ FTL CALCULATIONS Accordion (مطابق لنظام Leon Aviation في الصور 1-8) ═══ */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setFtlCalculationsOpen(!ftlCalculationsOpen)}
                      className="w-full px-3 py-2 text-start flex items-center justify-between gap-2 bg-[#dbeafe]/60 dark:bg-sky-950/40 hover:bg-[#bfdbfe]/60 transition font-mono font-bold text-xs text-slate-800 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{ftlCalculationsOpen ? "▼" : "▶"}</span>
                        <span className="font-bold tracking-wide">FTL CALCULATIONS</span>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                    </button>

                    {ftlCalculationsOpen && (
                      <div className="border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-150 text-xs">
                        {assignedPilots.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            لم يتم تعيين أي أفراد من الطاقم بعد لحساب ساعات الطيران والخدمة (FTL).
                          </div>
                        ) : (() => {
                          const activeMember = assignedPilots.find((p) => String(p.id) === String(selectedFtlCrewId)) || assignedPilots[0];
                          const detailedFtl = getCrewDailyFtlDetailed(activeMember.id, sectorDate, flights);

                          return (
                            <div>
                              {/* Member Selector Bar if multiple pilots/crew assigned */}
                              {assignedPilots.length > 1 && (
                                <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto">
                                  <span className="text-[10px] text-slate-500 font-semibold shrink-0">عضو الطاقم:</span>
                                  {assignedPilots.map((p) => {
                                    const isSel = String(p.id) === String(activeMember.id);
                                    const code = p.empNo ? String(p.empNo).replace(/^#/, "") : p.id;
                                    return (
                                      <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setSelectedFtlCrewId(p.id)}
                                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition shrink-0 ${
                                          isSel
                                            ? "bg-sky-600 text-white shadow-2xs"
                                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                        }`}
                                      >
                                        [{code}] {p.fullName || p.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {!detailedFtl ? (
                                <div className="p-4 text-center text-slate-400 text-xs">
                                  لا توجد بيانات قطاعات مسجلة لهذا العضو في تاريخ {sectorDate}.
                                </div>
                              ) : (
                                <div className="space-y-3 p-2.5">
                                  {/* ─── 1. Duty & FDP Sectors Table (صورة 7 و 8) ─── */}
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                                    <div className="px-2.5 py-1.5 bg-[#e2e8f0]/60 dark:bg-slate-800/80 font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                                      <span>Duty & FDP Sectors</span>
                                      <span className="font-mono text-[10px] text-sky-600 font-bold">
                                        {detailedFtl.sectorsCount} Sector{detailedFtl.sectorsCount > 1 ? "s" : ""}
                                      </span>
                                    </div>

                                    <table className="w-full text-[11px] border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px]">
                                          <th className="py-1 px-2 text-start font-bold w-20">Report On</th>
                                          <th className="py-1 px-2 text-start font-bold">Schedule</th>
                                          <th className="py-1 px-2 text-end font-bold w-20">Report Off</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {/* Rest before duty row */}
                                        <tr className="border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                                          <td colSpan={3} className="py-1 px-2 text-center text-[10px] text-slate-500 font-mono">
                                            <span className="inline-flex items-center gap-1 font-bold">
                                              <span>Rest {detailedFtl.restBeforeStr}</span>
                                              <Clock className="w-3 h-3 text-slate-400" />
                                            </span>
                                          </td>
                                        </tr>

                                        {/* Sectors list */}
                                        {detailedFtl.sectors.map((sec, sIdx) => (
                                          <React.Fragment key={sec.id || sIdx}>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                              {/* Report On */}
                                              <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400 align-top">
                                                {sec.reportOnHhmm}
                                              </td>

                                              {/* Schedule & Route */}
                                              <td className="py-1.5 px-2 align-top">
                                                <div className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 flex-wrap">
                                                  <span className="text-slate-500">✈</span>
                                                  <span>{sec.std}</span>
                                                  <span className="text-sky-600">{sec.dep}</span>
                                                  <span className="text-sky-600">{sec.arr}</span>
                                                  <span>{sec.sta}</span>
                                                </div>
                                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                                  cockpit count: {sec.cockpitCount} cabin count: {sec.cabinCount}
                                                </div>
                                              </td>

                                              {/* Report Off */}
                                              <td className="py-1.5 px-2 font-mono font-bold text-slate-600 dark:text-slate-400 text-end align-top">
                                                {sec.reportOffHhmm}
                                              </td>
                                            </tr>

                                            {/* Turnaround / Possible Break Notice */}
                                            {sec.hasBreak && (
                                              <tr className="bg-amber-500/10 border-b border-amber-500/20">
                                                <td colSpan={3} className="py-1 px-2 text-center">
                                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900 shadow-2xs">
                                                    Possible break ({sec.turnaroundMin}m)
                                                  </span>
                                                </td>
                                              </tr>
                                            )}
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* ─── 2. FTL Calculation Summary (الصور 1 إلى 6) ─── */}
                                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                                    <div className="px-2.5 py-1.5 bg-[#e2e8f0]/60 dark:bg-slate-800/80 font-bold text-[11px] text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                                      <span>FTL Calculation Summary</span>
                                      <button
                                        type="button"
                                        onClick={() => showToast(`📋 FTL Sheet: ${activeMember.fullName} (${sectorDate})`)}
                                        className="text-[10px] text-sky-600 hover:underline font-bold"
                                      >
                                        View FTL Sheet
                                      </button>
                                    </div>

                                    <table className="w-full text-[11px] border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px]">
                                          <th className="py-1 px-2 text-start font-bold">Limit</th>
                                          <th className="py-1 px-2 text-end font-bold">Actual</th>
                                          <th className="py-1 px-2 text-center w-6 font-bold"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                                        {/* Rest before duty */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Rest before duty <span className="text-[10px] text-slate-400">min 12h</span>
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                                            {detailedFtl.restBeforeStr}
                                          </td>
                                          <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                                        </tr>

                                        {/* Total block time */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Total block time
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                                            {detailedFtl.totalBlockStr}
                                          </td>
                                          <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                                        </tr>

                                        {/* Flight Duty Period */}
                                        <tr className={detailedFtl.isExceeded ? "bg-rose-500/10" : ""}>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Flight Duty Period <span className="text-[10px] text-slate-400">max {detailedFtl.maxFdpStr}</span>
                                          </td>
                                          <td className={`py-1 px-2 text-end font-bold ${detailedFtl.isExceeded ? "text-rose-600 font-black" : "text-slate-800 dark:text-slate-200"}`}>
                                            {detailedFtl.fdpStr}
                                          </td>
                                          <td className="py-1 px-1 text-center font-bold">
                                            {detailedFtl.isExceeded ? (
                                              <span className="text-rose-600">⚠️</span>
                                            ) : (
                                              <span className="text-emerald-500">✓</span>
                                            )}
                                          </td>
                                        </tr>

                                        {/* Duty */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Duty
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                                            {detailedFtl.dutyStr}
                                          </td>
                                          <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                                        </tr>

                                        {/* Rest after duty */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Rest after duty <span className="text-[10px] text-slate-400">min 12h</span>
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                                            {detailedFtl.restAfterStr}
                                          </td>
                                          <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                                        </tr>

                                        {/* Next EOBT */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Next EOBT
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-sky-600 dark:text-sky-400 text-[10px]">
                                            {detailedFtl.nextEobtStr}
                                          </td>
                                          <td className="py-1 px-1 text-center"></td>
                                        </tr>

                                        {/* Next EOBT with compensation */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Next EOBT (with compensation)
                                          </td>
                                          <td className="py-1 px-2 text-end text-slate-400">—</td>
                                          <td className="py-1 px-1 text-center"></td>
                                        </tr>

                                        {/* Acclimatisation */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Acclimatisation
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-700 dark:text-slate-300">
                                            {detailedFtl.acclimatisation}
                                          </td>
                                          <td className="py-1 px-1 text-center"></td>
                                        </tr>

                                        {/* Cumulative Duty Header */}
                                        <tr className="bg-slate-50/70 dark:bg-slate-850 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                                          <td colSpan={3} className="py-1 px-2">Cumulative Duty</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">7 days <span className="text-[9px]">max 60h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d7.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">14 days <span className="text-[9px]">max 110h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d14.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">28 days <span className="text-[9px]">max 190h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDuty.d28.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>

                                        {/* Cumulative Block Time Header */}
                                        <tr className="bg-slate-50/70 dark:bg-slate-850 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                                          <td colSpan={3} className="py-1 px-2">Cumulative Block Time</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">28 days <span className="text-[9px]">max 100h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.d28.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">calendar year <span className="text-[9px]">max 900h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.year.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">12 calendar months <span className="text-[9px]">max 1000h</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeBlock.m12.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>

                                        {/* Cumulative Days Off */}
                                        <tr className="bg-slate-50/70 dark:bg-slate-850 font-bold text-[10px] text-slate-700 dark:text-slate-300">
                                          <td colSpan={3} className="py-1 px-2">Cumulative Days Off</td>
                                        </tr>
                                        <tr>
                                          <td className="py-0.5 px-3 text-slate-500 text-[10px]">days in 7 days <span className="text-[9px]">min 1</span></td>
                                          <td className="py-0.5 px-2 text-end text-[10px] font-bold">{detailedFtl.cumulativeDaysOff.d7.actual}</td>
                                          <td className="py-0.5 px-1 text-center text-emerald-500 text-[10px] font-bold">✓</td>
                                        </tr>

                                        {/* Recovery Rest */}
                                        <tr>
                                          <td className="py-1 px-2 text-slate-600 dark:text-slate-400">
                                            Recovery Rest <span className="text-[10px] text-slate-400">max 168h</span>
                                          </td>
                                          <td className="py-1 px-2 text-end font-bold text-slate-800 dark:text-slate-200">
                                            {detailedFtl.recoveryRest.actual}
                                          </td>
                                          <td className="py-1 px-1 text-center text-emerald-500 font-bold">✓</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ─────────────────────────────────────────────────────────────
             * TAB 4: UNIFIED COMPLETED FLIGHT & JOURNEY LOG (المكتملة / JL)
             * ───────────────────────────────────────────────────────────── */}
            {activeTab === "jl" && (
              <div className="space-y-2.5 animate-in fade-in duration-150" dir="ltr">
                {/* Header row */}
                <div className="flex items-center justify-between border-b pb-1.5 flex-wrap gap-2" style={{ borderColor: "var(--border-default)" }}>
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{isAr ? "الرحلة المكتملة · Journey Log" : "Completed Flight · Journey Log"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <select
                      value={sectorStatus}
                      onChange={(e) => updateCurrentSector({ status: e.target.value })}
                      className="px-2 py-0.5 rounded text-[11px] font-bold border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    >
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="CONFIRMED">CONFIRMED</option>
                      <option value="BOARDING">BOARDING</option>
                      <option value="DEPARTED">DEPARTED</option>
                      <option value="IN_FLIGHT">IN_FLIGHT</option>
                      <option value="ARRIVED">ARRIVED</option>
                      <option value="DELAYED">DELAYED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                    <span className="font-mono text-slate-500">{sectorDep || "ADEP"} → {sectorArr || "ADES"} · {sectorDate}</span>
                  </div>
                </div>

                {/* 1. COPY DATA FROM FW + BLOFF* / T/O* / LDG* / BLON* */}
                <div className="space-y-1.5 pb-2 border-b" style={{ borderColor: "var(--border-default)" }}>
                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      onClick={handleCopyFromFW}
                      className="px-2.5 py-1.5 rounded text-[11px] font-bold text-white uppercase tracking-tight leading-tight shrink-0 transition hover:opacity-90 active:scale-95 shadow-2xs"
                      style={{ backgroundColor: "#0ea5e9" }}
                    >
                      COPY DATA
                      <br />
                      FROM FW
                    </button>

                    <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-[230px]">
                      <div>
                        <label className="block text-[10.5px] font-bold mb-0.5">BLOFF*:</label>
                        <Time24Input
                          value={bloffHHMM}
                          onChange={(val) => updateActualTime("std", val)}
                          compact={true}
                          showNowButton={false}
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold mb-0.5">T/O*:</label>
                        <Time24Input
                          value={toHHMM}
                          onChange={(val) => updateActualTime("takeoff", val)}
                          compact={true}
                          showNowButton={false}
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold mb-0.5">LDG*:</label>
                        <Time24Input
                          value={ldgHHMM}
                          onChange={(val) => updateActualTime("landing", val)}
                          compact={true}
                          showNowButton={false}
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold mb-0.5">BLON*:</label>
                        <Time24Input
                          value={blonHHMM}
                          onChange={(val) => updateActualTime("sta", val)}
                          compact={true}
                          showNowButton={false}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums pt-0.5" style={{ color: "var(--text-muted)" }}>
                    <span>All times in UTC</span>
                    <div className="flex items-center gap-6 font-bold" style={{ color: "var(--text-primary)" }}>
                      <span>Σ {actualAirDur.hhmm}</span>
                      <span>Σ {actualBlockDur.hhmm}</span>
                    </div>
                  </div>

                  {/* Fuel rows */}
                  <div className="space-y-1.5 pt-1.5">
                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <label className="text-[11px] font-medium">Block fuel*:</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={actual.blockFuel ?? ""}
                          onChange={(e) => updateActual("blockFuel", +e.target.value)}
                          placeholder="7500"
                          className="w-28 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
                        />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{actual.fuelUnit || "lbs"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <label className="text-[11px] font-medium">Fuel used*:</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={actual.fuelUsed ?? ""}
                          onChange={(e) => updateActual("fuelUsed", +e.target.value)}
                          placeholder="3850"
                          className="w-28 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
                        />
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{actual.fuelUnit || "lbs"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                      <label className="text-[11px] font-medium">Fuel remaining*:</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={actual.fuelRemaining ?? ""}
                          readOnly
                          placeholder="3650"
                          className="w-28 h-7 px-2 text-xs font-mono tabular-nums font-bold rounded border bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 outline-none"
                        />
                        <select
                          value={actual.fuelUnit || "lbs"}
                          onChange={(e) => updateActual("fuelUnit", e.target.value)}
                          className="h-7 px-1.5 text-[11px] rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                        >
                          <option value="lbs">lbs</option>
                          <option value="kg">kg</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. OPTIONAL JL FIELDS BAR */}
                <div className="px-2.5 py-1.5 rounded bg-slate-200/75 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  OPTIONAL JL FIELDS
                </div>

                {/* 3. SIMPLE 2-COLUMN OPTIONAL JL FIELDS */}
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">In-flight Rest Facility:</label>
                    <select
                      value={actual.restFacility || "Suitable"}
                      onChange={(e) => updateActual("restFacility", e.target.value)}
                      className="w-44 h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    >
                      <option value="Suitable">Suitable</option>
                      <option value="Not Suitable">Not Suitable</option>
                      <option value="Class 1">Class 1</option>
                      <option value="Class 2">Class 2</option>
                      <option value="Class 3">Class 3</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Uplift:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={actual.uplift ?? ""}
                        onChange={(e) => updateActual("uplift", +e.target.value)}
                        placeholder="0"
                        className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                      />
                      <select
                        value={actual.upliftUnit || "lbs"}
                        onChange={(e) => updateActual("upliftUnit", e.target.value)}
                        className="h-7 px-1.5 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                      >
                        <option value="lbs">lbs</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Pilot monitoring:</label>
                    <input
                      type="text"
                      value={actual.pilotMonitoring || ""}
                      onChange={(e) => updateActual("pilotMonitoring", e.target.value)}
                      placeholder="---"
                      className="w-36 h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-start gap-2">
                    <label className="text-[11px] font-medium pt-1">Delay code:</label>
                    <DelayCodeInput
                      code={actual.delayCode || ""}
                      minutes={actual.delayMinutes ?? ""}
                      onChangeCode={(c) => updateActual("delayCode", c)}
                      onChangeMinutes={(m) => updateActual("delayMinutes", m)}
                      isAr={isAr}
                      className="w-52 max-w-full"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-start gap-2">
                    <label className="text-[11px] font-medium pt-1">Night time:</label>
                    <NightTimeInput
                      valueHHMM={effectiveNightHHMM}
                      nightMode={nightMode}
                      sunsetInAirHHMM={autoNightCalc.hhmm}
                      flightTimeHHMM={actualAirDur.hhmm}
                      blockTimeHHMM={actualBlockDur.hhmm}
                      sunsetInfoText={
                        nightMode === "auto"
                          ? `${autoNightCalc?.source === "solar" && autoNightCalc?.depSun?.sunsetUtc ? `Sunset ${sectorDep || ""}: ${autoNightCalc.depSun.sunsetUtc}z · ` : ""}${isAr ? "يُحتسب من الغروب في الجو" : "From sunset in air"}`
                          : ""
                      }
                      onSelectPreset={(modeId, hhmm, mins) => {
                        updateCurrentSector({
                          actual: {
                            ...(actual || {}),
                            nightMode: modeId,
                            nightTime: hhmm,
                            night: mins,
                          },
                        });
                      }}
                      onManualChange={(hhmm, mins) => {
                        updateCurrentSector({
                          actual: {
                            ...(actual || {}),
                            nightMode: "manual",
                            nightTime: hhmm,
                            night: mins,
                          },
                        });
                      }}
                      isAr={isAr}
                      className="w-32"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">PAX:</label>
                    <input
                      type="number"
                      min={0}
                      value={actual.paxCount ?? ""}
                      onChange={(e) => updateActual("paxCount", e.target.value)}
                      placeholder="0"
                      className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Children:</label>
                    <input
                      type="number"
                      min={0}
                      value={actual.childrenCount ?? ""}
                      onChange={(e) => updateActual("childrenCount", e.target.value)}
                      placeholder="0"
                      className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Infants:</label>
                    <input
                      type="number"
                      min={0}
                      value={actual.infantsCount ?? ""}
                      onChange={(e) => updateActual("infantsCount", e.target.value)}
                      placeholder="0"
                      className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Bags:</label>
                    <input
                      type="number"
                      min={0}
                      value={actual.bagsCount ?? ""}
                      onChange={(e) => updateActual("bagsCount", e.target.value)}
                      placeholder="0"
                      className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Cargo:</label>
                    <input
                      type="number"
                      min={0}
                      value={actual.cargoWeight ?? ""}
                      onChange={(e) => updateActual("cargoWeight", e.target.value)}
                      placeholder="0"
                      className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Flight log:</label>
                    <input
                      type="text"
                      value={actual.flightLogRef || ""}
                      onChange={(e) => updateActual("flightLogRef", e.target.value)}
                      placeholder="---"
                      className="w-32 h-7 px-2 text-xs font-mono rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">Discretion for extension:</label>
                    <input
                      type="checkbox"
                      checked={Boolean(actual.discretionExtension)}
                      onChange={(e) => updateActual("discretionExtension", e.target.checked)}
                      className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                    <label className="text-[11px] font-medium">JL Notes:</label>
                    <input
                      type="text"
                      value={actual.notes || ""}
                      onChange={(e) => updateActual("notes", e.target.value)}
                      placeholder="Notes..."
                      className="w-full max-w-xs h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ FOOTER ACTIONS (SAVE, DELETE FLIGHT, CANCEL) ═══ */}
        <div
          className="p-2.5 px-3 border-t flex items-center justify-between gap-2 shrink-0"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-app)",
          }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-50"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {isAr ? "إلغاء / CANCEL" : "CANCEL"}
            </button>

            {canDelete && draft.id && (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const ok = await confirmAction(
                    isAr
                      ? `هل أنت متأكد من حذف هذه الرحلة (${sectorFlightNo}) نهائياً؟`
                      : `Are you sure you want to delete flight ${sectorFlightNo}?`
                  );
                  if (ok && onDelete) {
                    await onDelete(draft.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isAr ? "حذف (DELETE)" : "DELETE"}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            disabled={saving || !(canEdit || (activeTab === "jl" && canModifyJl) || (activeTab === "crew" && canModifyCrew))}
            onClick={onSave}
            className="px-5 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition flex items-center gap-1.5 hover:opacity-95 disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>
              {saving
                ? isAr
                  ? "جاري الحفظ..."
                  : "Saving..."
                : isAr
                ? "حفظ الرحلة / SAVE"
                : "SAVE"}
            </span>
          </button>
        </div>
      </div>

      <TripHistoryModal
        isOpen={tripHistoryOpen}
        onClose={() => setTripHistoryOpen(false)}
        flight={draft}
        crew={crew}
        currentUser={user}
        isAr={isAr}
      />
    </div>
  );
}
