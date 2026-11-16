/* ═══════════════════════════════════════════════════════════
 * COMPLETE FLIGHT WORKSPACE — Clean & Simple Journey Log
 * - Compact layout: COPY DATA FROM FW + BLOFF/T/O/LDG/BLON + Fuel + OPTIONAL JL FIELDS
 * - Auto Night Time computed from Sunset while Airborne (T/O → LDG) with quick-pick menu
 * - Live searchable IATA Delay Code dropdown & minutes input
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Save,
  Trash2,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { useT } from "../contexts";
import { Time24Input } from "./ui/Time24Input";
import { DelayCodeInput } from "./DelayCodeInput";
import { NightTimeInput } from "./NightTimeInput";
import { showToast, confirmAction } from "../utils/dialog";
import {
  calcDuration24,
  calcAirborneNightMinutes,
  minutesToHHMM,
  hhmmToMinutes,
} from "../utils/flightTiming";

export function CompleteFlightModal({
  flight,
  onClose,
  onSave,
  onDelete,
  fleet = [],
  crew = [],
  initialLegIdx = -1,
}) {
  const t = useT();
  const isAr = true;
  const [saving, setSaving] = useState(false);
  const [activeLegIdx, setActiveLegIdx] = useState(initialLegIdx);

  useEffect(() => {
    setActiveLegIdx(typeof initialLegIdx === "number" ? initialLegIdx : -1);
  }, [flight?.id, initialLegIdx]);

  const legs = Array.isArray(flight?.legs) ? flight.legs : [];
  const activeLeg =
    activeLegIdx >= 0 && legs[activeLegIdx] ? legs[activeLegIdx] : null;
  const isMainSector = !activeLeg;

  const sectorFlightNo = isMainSector
    ? flight?.flightNo
    : activeLeg.flightNo || flight?.flightNo;
  const sectorDep = isMainSector ? flight?.dep : activeLeg.dep;
  const sectorArr = isMainSector ? flight?.arr : activeLeg.arr;
  const sectorAcft = isMainSector
    ? flight?.acft
    : activeLeg.acft || flight?.acft;
  const sectorBaseDate = isMainSector
    ? flight?.std
      ? String(flight.std).slice(0, 10)
      : flight?.date || new Date().toISOString().slice(0, 10)
    : activeLeg.date ||
      (activeLeg.std ? String(activeLeg.std).slice(0, 10) : "") ||
      (flight?.std ? String(flight.std).slice(0, 10) : "") ||
      new Date().toISOString().slice(0, 10);

  const normalizeIsoDt = (val, baseDateStr) => {
    if (!val) return "";
    const s = String(val).trim();
    if (s.includes("T")) return s;
    if (/^\d{2}:\d{2}$/.test(s)) return `${baseDateStr}T${s}:00Z`;
    return s;
  };

  const sectorStdIso = normalizeIsoDt(
    isMainSector ? flight?.std : activeLeg.std,
    sectorBaseDate
  );
  const sectorStaIso = normalizeIsoDt(
    isMainSector ? flight?.sta : activeLeg.sta,
    sectorBaseDate
  );
  const sectorActual = isMainSector ? flight?.actual || {} : activeLeg.actual || {};
  const sectorStatus = isMainSector
    ? flight?.status || "ARRIVED"
    : activeLeg.status || "ARRIVED";
  const sectorCrewSlots = isMainSector
    ? Array.isArray(flight?.crewSlots)
      ? flight.crewSlots
      : []
    : Array.isArray(activeLeg.crewSlots)
    ? activeLeg.crewSlots
    : Array.isArray(flight?.crewSlots)
    ? flight.crewSlots
    : [];

  const defaultDepDate = sectorStdIso
    ? String(sectorStdIso).slice(0, 10)
    : sectorBaseDate;
  const defaultArrDate = sectorStaIso
    ? String(sectorStaIso).slice(0, 10)
    : defaultDepDate;

  const [depDate, setDepDate] = useState(defaultDepDate);
  const [arrDate, setArrDate] = useState(defaultArrDate);

  const [draft, setDraft] = useState({
    actual: sectorActual,
    status: sectorStatus,
  });

  const resolvedCrewDefaults = useMemo(() => {
    const slots = sectorCrewSlots;
    const findName = (positions) => {
      const slot = slots.find((s) => positions.includes(s.position));
      if (!slot) return "";
      const member = (crew || []).find(
        (c) => String(c.id) === String(slot.crewId)
      );
      return member?.fullName || "";
    };
    return {
      pic: findName(["captain", "CPT", "tri"]),
      sic: findName(["firstOfficer", "FO"]),
    };
  }, [sectorCrewSlots, crew]);

  useEffect(() => {
    if (flight) {
      const dDate = sectorActual?.std
        ? String(sectorActual.std).slice(0, 10)
        : defaultDepDate;
      const aDate = sectorActual?.sta
        ? String(sectorActual.sta).slice(0, 10)
        : defaultArrDate;

      setDepDate(dDate);
      setArrDate(aDate);

      const existing = sectorActual || {};
      const initMode =
        existing.nightMode ||
        (Number(existing.night) > 0 ? "manual" : "auto");
      setDraft({
        actual: {
          std: existing.std || sectorStdIso || "",
          sta: existing.sta || sectorStaIso || "",
          takeoff: existing.takeoff || "",
          landing: existing.landing || "",
          pic: existing.pic || resolvedCrewDefaults.pic || "",
          sic: existing.sic || resolvedCrewDefaults.sic || "",
          picFlying: existing.picFlying ?? false,
          pilotMonitoring: existing.pilotMonitoring ?? "",
          blockFuel: existing.blockFuel ?? "",
          fuelUsed: existing.fuelUsed ?? "",
          fuelRemaining: existing.fuelRemaining ?? "",
          fuelUnit: existing.fuelUnit || "lbs",
          uplift: existing.uplift ?? "",
          upliftUnit: existing.upliftUnit || "lbs",
          night: existing.night ?? 0,
          nightTime: existing.nightTime || minutesToHHMM(existing.night ?? 0),
          nightMode: initMode,
          instrument: existing.instrument ?? 0,
          delayCode: existing.delayCode || "",
          delayMinutes: existing.delayMinutes ?? "",
          restFacility: existing.restFacility || "Suitable",
          paxCount:
            existing.paxCount ??
            (isMainSector ? flight?.pax : activeLeg?.pax) ??
            "",
          childrenCount: existing.childrenCount ?? "",
          infantsCount: existing.infantsCount ?? "",
          bagsCount: existing.bagsCount ?? "",
          cargoWeight:
            existing.cargoWeight ??
            (isMainSector ? flight?.cargo : activeLeg?.cargo) ??
            "",
          flightLogRef: existing.flightLogRef || "",
          discretionExtension: Boolean(existing.discretionExtension),
          notes: existing.notes || "",
        },
        status:
          sectorStatus &&
          sectorStatus !== "SCHEDULED" &&
          sectorStatus !== "DEPARTED"
            ? sectorStatus
            : "ARRIVED",
      });
    }
  }, [flight, activeLegIdx, resolvedCrewDefaults]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!flight) return null;

  const upd = (field, value) => {
    setDraft((d) => ({
      ...d,
      actual: { ...(d.actual || {}), [field]: value },
    }));
  };

  const updTimeField = (field, dateStr, hhmm) => {
    if (!hhmm) {
      upd(field, "");
      return;
    }
    const cleanDate = dateStr || defaultDepDate;
    upd(field, `${cleanDate}T${hhmm}:00Z`);
  };

  const handleFuelChange = (field, rawVal) => {
    const numVal = rawVal === "" ? "" : Number(rawVal);
    setDraft((d) => {
      const nextActual = { ...(d.actual || {}), [field]: numVal };
      if (field === "blockFuel" || field === "fuelUsed") {
        const bf = Number(nextActual.blockFuel);
        const fu = Number(nextActual.fuelUsed);
        if (
          nextActual.blockFuel !== "" &&
          nextActual.fuelUsed !== "" &&
          !Number.isNaN(bf) &&
          !Number.isNaN(fu)
        ) {
          nextActual.fuelRemaining = Math.max(0, bf - fu);
        }
      }
      return { ...d, actual: nextActual };
    });
  };

  const copyFromFW = () => {
    const dDate = sectorStdIso ? String(sectorStdIso).slice(0, 10) : depDate;
    const aDate = sectorStaIso ? String(sectorStaIso).slice(0, 10) : arrDate;
    setDepDate(dDate);
    setArrDate(aDate);

    const stdHH = sectorStdIso ? String(sectorStdIso).slice(11, 16) : "12:00";
    const staHH = sectorStaIso ? String(sectorStaIso).slice(11, 16) : "13:30";
    const [sh, sm] = stdHH.split(":").map(Number);
    const [eh, em] = staHH.split(":").map(Number);
    let toMin = (sh || 0) * 60 + (sm || 0) + 10;
    let ldgMin = (eh || 0) * 60 + (em || 0) - 6;
    if (ldgMin < toMin) ldgMin = toMin + 30;
    const toHH = minutesToHHMM(toMin % 1440);
    const ldgHH = minutesToHHMM(ldgMin % 1440);

    setDraft((d) => ({
      ...d,
      actual: {
        ...(d.actual || {}),
        std: sectorStdIso || `${dDate}T${stdHH}:00Z`,
        sta: sectorStaIso || `${aDate}T${staHH}:00Z`,
        takeoff: d.actual?.takeoff || `${dDate}T${toHH}:00Z`,
        landing: d.actual?.landing || `${aDate}T${ldgHH}:00Z`,
        pic: d.actual?.pic || resolvedCrewDefaults.pic || "",
        sic: d.actual?.sic || resolvedCrewDefaults.sic || "",
      },
    }));
    showToast("تم نسخ بيانات الرحلة المجدولة (UTC)", "success");
  };

  const bloffHHMM = draft.actual?.std ? String(draft.actual.std).slice(11, 16) : "";
  const toHHMM = draft.actual?.takeoff ? String(draft.actual.takeoff).slice(11, 16) : "";
  const ldgHHMM = draft.actual?.landing ? String(draft.actual.landing).slice(11, 16) : "";
  const blonHHMM = draft.actual?.sta ? String(draft.actual.sta).slice(11, 16) : "";

  const blockDur = calcDuration24(bloffHHMM, blonHHMM);
  const flightDur = calcDuration24(toHHMM, ldgHHMM);
  const acftObj = (fleet || []).find((a) => a.reg === sectorAcft);

  const autoNightCalc = useMemo(
    () =>
      calcAirborneNightMinutes({
        depCode: sectorDep,
        arrCode: sectorArr,
        dateStr: depDate || sectorBaseDate,
        toHHMM,
        ldgHHMM,
        bloffHHMM,
        blonHHMM,
      }),
    [sectorDep, sectorArr, depDate, sectorBaseDate, toHHMM, ldgHHMM, bloffHHMM, blonHHMM]
  );

  const nightMode = draft.actual?.nightMode || "auto";
  const effectiveNightMin =
    nightMode === "auto"
      ? autoNightCalc.minutes
      : nightMode === "flight_time"
      ? flightDur.minutes
      : nightMode === "full_block"
      ? blockDur.minutes
      : Number(draft.actual?.night ?? 0);
  const effectiveNightHHMM = minutesToHHMM(effectiveNightMin);

  useEffect(() => {
    if (nightMode === "auto") {
      setDraft((d) => {
        if (
          d.actual?.night === autoNightCalc.minutes &&
          d.actual?.nightTime === autoNightCalc.hhmm
        ) {
          return d;
        }
        return {
          ...d,
          actual: {
            ...(d.actual || {}),
            night: autoNightCalc.minutes,
            nightTime: autoNightCalc.hhmm,
          },
        };
      });
    } else if (nightMode === "flight_time") {
      setDraft((d) => {
        if (
          d.actual?.night === flightDur.minutes &&
          d.actual?.nightTime === flightDur.hhmm
        ) {
          return d;
        }
        return {
          ...d,
          actual: {
            ...(d.actual || {}),
            night: flightDur.minutes,
            nightTime: flightDur.hhmm,
          },
        };
      });
    } else if (nightMode === "full_block") {
      setDraft((d) => {
        if (
          d.actual?.night === blockDur.minutes &&
          d.actual?.nightTime === blockDur.hhmm
        ) {
          return d;
        }
        return {
          ...d,
          actual: {
            ...(d.actual || {}),
            night: blockDur.minutes,
            nightTime: blockDur.hhmm,
          },
        };
      });
    }
  }, [
    nightMode,
    autoNightCalc.minutes,
    autoNightCalc.hhmm,
    flightDur.minutes,
    flightDur.hhmm,
    blockDur.minutes,
    blockDur.hhmm,
  ]);

  const sunsetHint =
    autoNightCalc?.source === "solar" && autoNightCalc?.depSun?.sunsetUtc
      ? `Sunset ${sectorDep || ""}: ${autoNightCalc.depSun.sunsetUtc}z`
      : "";

  const handleSave = async () => {
    let stdValue = draft.actual?.std || sectorStdIso || "";
    let staValue = draft.actual?.sta || sectorStaIso || "";
    if (!String(stdValue).trim()) {
      stdValue = new Date().toISOString().slice(0, 16) + ":00Z";
    }
    if (!String(staValue).trim()) {
      staValue = new Date().toISOString().slice(0, 16) + ":00Z";
    }

    const savedActual = {
      ...draft.actual,
      std: stdValue,
      sta: staValue,
    };
    const savedStatus = draft.status || "ARRIVED";

    setSaving(true);
    try {
      if (isMainSector) {
        await onSave({
          ...flight,
          actual: savedActual,
          status: savedStatus,
        });
      } else {
        const nextLegs = [...legs];
        nextLegs[activeLegIdx] = {
          ...nextLegs[activeLegIdx],
          actual: savedActual,
          status: savedStatus,
        };
        await onSave({
          ...flight,
          legs: nextLegs,
        });
      }
      onClose();
    } catch (e) {
      console.error("Save JL error:", e);
      showToast("فشل الحفظ: " + (e?.message || e), "error");
    } finally {
      setSaving(false);
    }
  };

  const fuelUnit = draft.actual?.fuelUnit || "lbs";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs"
      style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ COMPACT HEADER ═══ */}
        <header
          className="px-3.5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-bold truncate">
                  الرحلة المكتملة · Journey Log
                </h2>
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                  {sectorFlightNo} · {sectorDep} → {sectorArr}
                </span>
              </div>
              <div
                className="text-[10px] font-mono tabular-nums flex items-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <span>{sectorAcft || "—"} {acftObj?.type ? `(${acftObj.type})` : ""}</span>
                <span>·</span>
                <span>{sectorBaseDate}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md border hover:opacity-80 transition shrink-0"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
            title="إغلاق (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Sector Switcher when multi-sector */}
        {legs.length > 0 && (
          <div
            className="px-3.5 py-1.5 border-b flex items-center gap-1.5 overflow-x-auto shrink-0"
            style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
          >
            <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--text-muted)" }}>
              السكتر:
            </span>
            <button
              type="button"
              onClick={() => setActiveLegIdx(-1)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border shrink-0 transition ${
                isMainSector
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              S1 · {flight.dep || "—"}→{flight.arr || "—"}
            </button>
            {legs.map((lg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveLegIdx(idx)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono border shrink-0 transition ${
                  activeLegIdx === idx
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                S{idx + 2} · {lg.dep || "—"}→{lg.arr || "—"}
              </button>
            ))}
          </div>
        )}

        {/* ═══ SIMPLE FORM BODY (MATCHING SCREENSHOTS) ═══ */}
        <main className="flex-1 overflow-y-auto text-xs" dir="ltr">
          {/* 1. COPY DATA FROM FW + BLOFF* / T/O* / LDG* / BLON* */}
          <div className="p-3 border-b space-y-2" style={{ borderColor: "var(--border-default)" }}>
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={copyFromFW}
                className="px-2.5 py-1.5 rounded text-[11px] font-bold text-white uppercase tracking-tight leading-tight shrink-0 transition hover:opacity-90 active:scale-95 shadow-2xs"
                style={{ backgroundColor: "#0ea5e9" }}
              >
                COPY DATA
                <br />
                FROM FW
              </button>

              <div className="grid grid-cols-4 gap-1.5 flex-1 min-w-[240px]">
                <div>
                  <label className="block text-[10.5px] font-bold mb-0.5">BLOFF*:</label>
                  <Time24Input
                    value={bloffHHMM}
                    onChange={(hhmm) => updTimeField("std", depDate, hhmm)}
                    compact={true}
                    showNowButton={false}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold mb-0.5">T/O*:</label>
                  <Time24Input
                    value={toHHMM}
                    onChange={(hhmm) => updTimeField("takeoff", depDate, hhmm)}
                    compact={true}
                    showNowButton={false}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold mb-0.5">LDG*:</label>
                  <Time24Input
                    value={ldgHHMM}
                    onChange={(hhmm) => updTimeField("landing", arrDate, hhmm)}
                    compact={true}
                    showNowButton={false}
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold mb-0.5">BLON*:</label>
                  <Time24Input
                    value={blonHHMM}
                    onChange={(hhmm) => updTimeField("sta", arrDate, hhmm)}
                    compact={true}
                    showNowButton={false}
                  />
                </div>
              </div>
            </div>

            <div
              className="flex items-center justify-between text-[11px] font-mono tabular-nums pt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              <span>All times in UTC</span>
              <div className="flex items-center gap-6 font-bold" style={{ color: "var(--text-primary)" }}>
                <span>Σ {toHHMM && ldgHHMM ? flightDur.hhmm : "00:00"}</span>
                <span>Σ {bloffHHMM && blonHHMM ? blockDur.hhmm : "00:00"}</span>
              </div>
            </div>

            {/* Fuel Block (Simple 2-column label/input rows) */}
            <div className="space-y-1.5 pt-1.5">
              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <label className="text-[11px] font-medium">Block fuel*:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={draft.actual?.blockFuel ?? ""}
                    onChange={(e) => handleFuelChange("blockFuel", e.target.value)}
                    placeholder="7500"
                    className="w-28 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fuelUnit}</span>
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <label className="text-[11px] font-medium">Fuel used*:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={draft.actual?.fuelUsed ?? ""}
                    onChange={(e) => handleFuelChange("fuelUsed", e.target.value)}
                    placeholder="3850"
                    className="w-28 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
                  />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fuelUnit}</span>
                </div>
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <label className="text-[11px] font-medium">Fuel remaining*:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={draft.actual?.fuelRemaining ?? ""}
                    onChange={(e) => handleFuelChange("fuelRemaining", e.target.value)}
                    placeholder="3650"
                    className="w-28 h-7 px-2 text-xs font-mono tabular-nums font-bold rounded border bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 outline-none"
                  />
                  <select
                    value={fuelUnit}
                    onChange={(e) => upd("fuelUnit", e.target.value)}
                    className="h-7 px-1.5 text-[11px] rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 2. OPTIONAL JL FIELDS SECTION HEADER */}
          <div className="px-3 py-1.5 bg-slate-200/75 dark:bg-slate-800/80 border-b text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200" style={{ borderColor: "var(--border-default)" }}>
            OPTIONAL JL FIELDS
          </div>

          {/* 3. OPTIONAL JL FIELDS ROWS */}
          <div className="p-3 space-y-2">
            {/* In-flight Rest Facility */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">In-flight Rest Facility:</label>
              <select
                value={draft.actual?.restFacility || "Suitable"}
                onChange={(e) => upd("restFacility", e.target.value)}
                className="w-44 h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              >
                <option value="Suitable">Suitable</option>
                <option value="Not Suitable">Not Suitable</option>
                <option value="Class 1">Class 1</option>
                <option value="Class 2">Class 2</option>
                <option value="Class 3">Class 3</option>
              </select>
            </div>

            {/* Uplift */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Uplift:</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={draft.actual?.uplift ?? ""}
                  onChange={(e) =>
                    upd("uplift", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0"
                  className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
                />
                <select
                  value={draft.actual?.upliftUnit || "lbs"}
                  onChange={(e) => upd("upliftUnit", e.target.value)}
                  className="h-7 px-1.5 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            {/* Pilot monitoring */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Pilot monitoring:</label>
              <input
                type="text"
                value={draft.actual?.pilotMonitoring || ""}
                onChange={(e) => upd("pilotMonitoring", e.target.value)}
                placeholder="---"
                className="w-36 h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-sky-500"
              />
            </div>

            {/* Delay code (Live searchable dropdown matching screenshot) */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-2">
              <label className="text-[11px] font-medium pt-1">Delay code:</label>
              <DelayCodeInput
                code={draft.actual?.delayCode || ""}
                minutes={draft.actual?.delayMinutes ?? ""}
                onChangeCode={(c) => upd("delayCode", c)}
                onChangeMinutes={(m) => upd("delayMinutes", m)}
                isAr={isAr}
                className="w-52 max-w-full"
              />
            </div>

            {/* Night time (Quick-pick dropdown + airborne sunset default) */}
            <div className="grid grid-cols-[140px_1fr] items-start gap-2">
              <label className="text-[11px] font-medium pt-1">Night time:</label>
              <NightTimeInput
                valueHHMM={effectiveNightHHMM}
                nightMode={nightMode}
                sunsetInAirHHMM={autoNightCalc.hhmm}
                flightTimeHHMM={flightDur.hhmm}
                blockTimeHHMM={blockDur.hhmm}
                sunsetInfoText={
                  nightMode === "auto"
                    ? `${sunsetHint ? `${sunsetHint} · ` : ""}يُحتسب تلقائياً من الغروب في الجو`
                    : ""
                }
                onSelectPreset={(modeId, hhmm, mins) => {
                  setDraft((d) => ({
                    ...d,
                    actual: {
                      ...(d.actual || {}),
                      nightMode: modeId,
                      nightTime: hhmm,
                      night: mins,
                    },
                  }));
                }}
                onManualChange={(hhmm, mins) => {
                  setDraft((d) => ({
                    ...d,
                    actual: {
                      ...(d.actual || {}),
                      nightMode: "manual",
                      nightTime: hhmm,
                      night: mins,
                    },
                  }));
                }}
                isAr={isAr}
                className="w-32"
              />
            </div>

            {/* PAX / Children / Infants / Bags / Cargo / Flight log */}
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">PAX:</label>
              <input
                type="number"
                min={0}
                value={draft.actual?.paxCount ?? ""}
                onChange={(e) => upd("paxCount", e.target.value)}
                placeholder="0"
                className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Children:</label>
              <input
                type="number"
                min={0}
                value={draft.actual?.childrenCount ?? ""}
                onChange={(e) => upd("childrenCount", e.target.value)}
                placeholder="0"
                className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Infants:</label>
              <input
                type="number"
                min={0}
                value={draft.actual?.infantsCount ?? ""}
                onChange={(e) => upd("infantsCount", e.target.value)}
                placeholder="0"
                className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Bags:</label>
              <input
                type="number"
                min={0}
                value={draft.actual?.bagsCount ?? ""}
                onChange={(e) => upd("bagsCount", e.target.value)}
                placeholder="0"
                className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Cargo:</label>
              <input
                type="number"
                min={0}
                value={draft.actual?.cargoWeight ?? ""}
                onChange={(e) => upd("cargoWeight", e.target.value)}
                placeholder="0"
                className="w-24 h-7 px-2 text-xs font-mono tabular-nums rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Flight log:</label>
              <input
                type="text"
                value={draft.actual?.flightLogRef || ""}
                onChange={(e) => upd("flightLogRef", e.target.value)}
                placeholder="---"
                className="w-32 h-7 px-2 text-xs font-mono rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Discretion for extension:</label>
              <input
                type="checkbox"
                checked={Boolean(draft.actual?.discretionExtension)}
                onChange={(e) => upd("discretionExtension", e.target.checked)}
                className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2 pt-1 border-t" style={{ borderColor: "var(--border-default)" }}>
              <label className="text-[11px] font-medium">Status:</label>
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                className="w-44 h-7 px-2 text-xs font-bold rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              >
                <option value="ARRIVED">ARRIVED — وصلت</option>
                <option value="DEPARTED">DEPARTED — غادرت</option>
                <option value="IN_FLIGHT">IN_FLIGHT — بالجو</option>
                <option value="DELAYED">DELAYED — متأخرة</option>
                <option value="CANCELLED">CANCELLED — ملغاة</option>
              </select>
            </div>

            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <label className="text-[11px] font-medium">Remarks:</label>
              <input
                type="text"
                value={draft.actual?.notes || ""}
                onChange={(e) => upd("notes", e.target.value)}
                placeholder="Notes..."
                className="w-full max-w-xs h-7 px-2 text-xs rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none"
              />
            </div>
          </div>
        </main>

        {/* ═══ COMPACT FOOTER (SAVE / DELETE / CANCEL) ═══ */}
        <footer
          className="px-3.5 py-2.5 border-t flex items-center justify-between gap-2 shrink-0"
          style={{ borderColor: "var(--border-default)", backgroundColor: "var(--bg-app)" }}
          dir="ltr"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-1.5 rounded text-xs font-bold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition flex items-center gap-1.5 shadow-2xs"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? "SAVING..." : "SAVE"}</span>
            </button>

            {typeof onDelete === "function" && flight?.id && (
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const ok = await confirmAction(
                    `هل أنت متأكد من حذف هذه الرحلة (${sectorFlightNo}) نهائياً؟`
                  );
                  if (ok) {
                    await onDelete(flight.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 rounded text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>DELETE FLIGHT</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-3.5 py-1.5 rounded border text-xs font-bold hover:opacity-80 transition"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              CANCEL
            </button>
          </div>

          <span className="text-[10.5px] font-mono tabular-nums hidden sm:inline" style={{ color: "var(--text-muted)" }}>
            Block {blockDur.hhmm} · Night {effectiveNightHHMM}
          </span>
        </footer>
      </div>
    </div>
  );
}

export default CompleteFlightModal;
