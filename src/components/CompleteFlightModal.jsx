/* ═══════════════════════════════════════════════════════════
 * COMPLETE FLIGHT WORKSPACE — Full-Page 24-Hour Journey Log
 * - Full-screen (100vw × 100vh) operational layout
 * - Strict 24-hour (00:00 – 23:59) UTC inputs via Time24Input
 * - Live Block Time, Airborne Flight Time (T/O -> LDG), Night Time,
 *   Fuel Auto-Calculation, and Crew Auto-Resolution
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Save,
  Clock,
  Plane,
  Fuel,
  Users,
  Sliders,
  ArrowDownToLine,
  CheckCircle2,
} from "lucide-react";
import { useT } from "../contexts";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Time24Input } from "./ui/Time24Input";

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

export function CompleteFlightModal({
  flight,
  onClose,
  onSave,
  fleet = [],
  crew = [],
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);

  const defaultDepDate = flight?.std ? String(flight.std).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const defaultArrDate = flight?.sta ? String(flight.sta).slice(0, 10) : defaultDepDate;

  const [depDate, setDepDate] = useState(defaultDepDate);
  const [arrDate, setArrDate] = useState(defaultArrDate);

  const [draft, setDraft] = useState({
    actual: flight?.actual || {},
    status: flight?.status || "ARRIVED",
  });

  // Resolve assigned Captain & First Officer names from flight.crewSlots if available
  const resolvedCrewDefaults = useMemo(() => {
    const slots = Array.isArray(flight?.crewSlots) ? flight.crewSlots : [];
    const findName = (positions) => {
      const slot = slots.find((s) => positions.includes(s.position));
      if (!slot) return "";
      const member = (crew || []).find((c) => String(c.id) === String(slot.crewId));
      return member?.fullName || "";
    };
    return {
      pic: findName(["captain", "CPT", "tri"]),
      sic: findName(["firstOfficer", "FO"]),
    };
  }, [flight, crew]);

  useEffect(() => {
    if (flight) {
      const dDate = flight.actual?.std
        ? String(flight.actual.std).slice(0, 10)
        : flight.std
        ? String(flight.std).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const aDate = flight.actual?.sta
        ? String(flight.actual.sta).slice(0, 10)
        : flight.sta
        ? String(flight.sta).slice(0, 10)
        : dDate;

      setDepDate(dDate);
      setArrDate(aDate);

      const existing = flight.actual || {};
      setDraft({
        actual: {
          std: existing.std || flight.std || "",
          sta: existing.sta || flight.sta || "",
          takeoff: existing.takeoff || "",
          landing: existing.landing || "",
          pic: existing.pic || resolvedCrewDefaults.pic || "",
          sic: existing.sic || resolvedCrewDefaults.sic || "",
          picFlying: existing.picFlying ?? false,
          pilotMonitoring:
            existing.pilotMonitoring || resolvedCrewDefaults.sic || "",
          blockFuel: existing.blockFuel ?? 0,
          fuelUsed: existing.fuelUsed ?? 0,
          fuelRemaining: existing.fuelRemaining ?? 0,
          uplift: existing.uplift ?? 0,
          night: existing.night ?? 0,
          instrument: existing.instrument ?? 0,
          delayCode: existing.delayCode || "",
          restFacility: existing.restFacility || "Suitable",
          notes: existing.notes || "",
        },
        status:
          flight.status && flight.status !== "SCHEDULED" && flight.status !== "DEPARTED"
            ? flight.status
            : "ARRIVED",
      });
    }
  }, [flight, resolvedCrewDefaults]);

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

  const handleFuelChange = (field, numVal) => {
    setDraft((d) => {
      const nextActual = { ...(d.actual || {}), [field]: numVal };
      if (field === "blockFuel" || field === "fuelUsed") {
        const bf = Number(nextActual.blockFuel) || 0;
        const fu = Number(nextActual.fuelUsed) || 0;
        if (bf >= fu) {
          nextActual.fuelRemaining = bf - fu;
        }
      }
      return { ...d, actual: nextActual };
    });
  };

  const copyFromFW = () => {
    const dDate = flight.std ? String(flight.std).slice(0, 10) : depDate;
    const aDate = flight.sta ? String(flight.sta).slice(0, 10) : arrDate;
    setDepDate(dDate);
    setArrDate(aDate);
    setDraft((d) => ({
      ...d,
      actual: {
        ...(d.actual || {}),
        std: flight.std || "",
        sta: flight.sta || "",
        pic: d.actual?.pic || resolvedCrewDefaults.pic || "",
        sic: d.actual?.sic || resolvedCrewDefaults.sic || "",
      },
    }));
    showToast("✅ تم نسخ التوقيت المجدول (24h UTC) وطاقم الرحلة", "success");
  };

  const bloffHHMM = draft.actual?.std ? String(draft.actual.std).slice(11, 16) : "";
  const toHHMM = draft.actual?.takeoff ? String(draft.actual.takeoff).slice(11, 16) : "";
  const ldgHHMM = draft.actual?.landing ? String(draft.actual.landing).slice(11, 16) : "";
  const blonHHMM = draft.actual?.sta ? String(draft.actual.sta).slice(11, 16) : "";

  const blockDur = calcDuration24(bloffHHMM, blonHHMM);
  const flightDur = calcDuration24(toHHMM, ldgHHMM);
  const estNightMin = draft.actual?.night || Math.round(blockDur.minutes * 0.2);
  const estNightHHMM = `${String(Math.floor(estNightMin / 60)).padStart(
    2,
    "0"
  )}:${String(estNightMin % 60).padStart(2, "0")}`;

  const acftObj = (fleet || []).find((a) => a.reg === flight.acft);

  const handleSave = async () => {
    let stdValue = draft.actual?.std;
    let staValue = draft.actual?.sta;

    if (!stdValue || String(stdValue).trim() === "") {
      stdValue = flight.std || "";
    }
    if (!staValue || String(staValue).trim() === "") {
      staValue = flight.sta || "";
    }
    if (!stdValue || String(stdValue).trim() === "") {
      const now = new Date();
      stdValue = now.toISOString().slice(0, 16) + ":00Z";
    }
    if (!staValue || String(staValue).trim() === "") {
      const now = new Date();
      staValue = now.toISOString().slice(0, 16) + ":00Z";
    }

    const actualToSave = {
      ...draft.actual,
      std: stdValue,
      sta: staValue,
    };

    setSaving(true);
    try {
      await onSave({
        ...flight,
        actual: actualToSave,
        status: draft.status || "ARRIVED",
      });
      onClose();
    } catch (e) {
      console.error("Save JL error:", e);
      showToast("❌ فشل الحفظ: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] w-screen h-screen flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ═══ FULL-PAGE STICKY TOP BAR ═══ */}
      <header className="px-6 py-3.5 bg-slate-900 dark:bg-slate-900 border-b border-slate-800 text-white flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight">
                إكمال الرحلة وسجل الرحلة الفعلي (Complete Flight — Journey Log)
              </h2>
              <span className="font-mono text-sm font-bold text-sky-400">
                {flight.flightNo}
              </span>
            </div>
            <div className="text-xs text-slate-300 font-mono tabular-nums flex items-center gap-2 mt-0.5">
              <span>{flight.dep} → {flight.arr}</span>
              <span>·</span>
              <span>{flight.acft || "—"} {acftObj?.type ? `(${acftObj.type})` : ""}</span>
              <span>·</span>
              <span>Scheduled: {flight.std?.slice(11, 16) || "—"}Z → {flight.sta?.slice(11, 16) || "—"}Z (24H UTC)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={copyFromFW}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition whitespace-nowrap shrink-0"
          >
            <ArrowDownToLine className="w-4 h-4" />
            نسخ التوقيت المجدول (Copy Scheduled 24H)
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ..." : "حفظ سجل الرحلة (SAVE JL)"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
            title="إغلاق (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ═══ FULL-PAGE SCROLLABLE WORKSPACE ═══ */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* KPI Live Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                المسار والقطاع / Sector
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {flight.dep} → {flight.arr}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                زمن البلوك / Block Time (24H)
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {blockDur.hhmm}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                زمن الطيران / Airborne (T/O–LDG)
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400 mt-0.5">
                {toHHMM && ldgHHMM ? flightDur.hhmm : "—"}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                الطيران الليلي / Night Time
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                {estNightHHMM}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 col-span-2 md:col-span-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                حالة الرحلة النهائية / Status
              </div>
              <div className="mt-1">
                <Select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                >
                  <option value="ARRIVED">ARRIVED — وصلت / مكتملة ✓</option>
                  <option value="DEPARTED">DEPARTED — غادرت</option>
                  <option value="IN_FLIGHT">IN_FLIGHT — بالجو</option>
                  <option value="BOARDING">BOARDING — صعود</option>
                  <option value="SCHEDULED">SCHEDULED — مجدولة</option>
                  <option value="DELAYED">DELAYED — متأخرة</option>
                  <option value="CANCELLED">CANCELLED — ملغاة</option>
                </Select>
              </div>
            </div>
          </div>

          {/* ═══ SECTION 1: 24-HOUR UTC ACTUAL TIMES ═══ */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  التوقيت الفعلي بنظام 24 ساعة (Actual Times — 24H UTC)
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                صيغة الإدخال: 00:00 إلى 23:59 بتوقيت UTC (يمكنك كتابة 4 أرقام مباشرة مثل 1435 فتتحول إلى 14:35)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="تاريخ المغادرة / Departure Date">
                <Input
                  type="date"
                  value={depDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDepDate(nextDate);
                    if (bloffHHMM) updTimeField("std", nextDate, bloffHHMM);
                    if (toHHMM) updTimeField("takeoff", nextDate, toHHMM);
                  }}
                />
              </Field>
              <Field label="مطار الإقلاع / ADEP">
                <Input value={flight.dep || ""} disabled className="font-mono font-bold" />
              </Field>
              <Field label="تاريخ الوصول / Arrival Date">
                <Input
                  type="date"
                  value={arrDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setArrDate(nextDate);
                    if (ldgHHMM) updTimeField("landing", nextDate, ldgHHMM);
                    if (blonHHMM) updTimeField("sta", nextDate, blonHHMM);
                  }}
                />
              </Field>
              <Field label="مطار الهبوط / ADES">
                <Input value={flight.arr || ""} disabled className="font-mono font-bold" />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <Field label="1. تحرك البلوك / BLOFF (Off-Block 24H UTC) *">
                <Time24Input
                  value={bloffHHMM}
                  onChange={(hhmm) => updTimeField("std", depDate, hhmm)}
                  placeholder="08:00"
                />
              </Field>

              <Field label="2. الإقلاع الفعلي / T/O (Takeoff 24H UTC)">
                <Time24Input
                  value={toHHMM}
                  onChange={(hhmm) => updTimeField("takeoff", depDate, hhmm)}
                  placeholder="08:15"
                />
              </Field>

              <Field label="3. الهبوط الفعلي / LDG (Landing 24H UTC)">
                <Time24Input
                  value={ldgHHMM}
                  onChange={(hhmm) => updTimeField("landing", arrDate, hhmm)}
                  placeholder="10:45"
                />
              </Field>

              <Field label="4. توقف البلوك / BLON (On-Block 24H UTC) *">
                <Time24Input
                  value={blonHHMM}
                  onChange={(hhmm) => updTimeField("sta", arrDate, hhmm)}
                  placeholder="11:00"
                />
              </Field>
            </div>
          </section>

          {/* ═══ TWO-COLUMN GRID FOR FUEL & CREW + OPTIONAL JL ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* FUEL SECTION */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Fuel className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  بيانات الوقود / Fuel Log
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="وقود البلوك / Block Fuel *">
                  <Input
                    type="number"
                    value={draft.actual?.blockFuel ?? 0}
                    onChange={(e) => handleFuelChange("blockFuel", +e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field label="الوقود المستهلك / Fuel Used *">
                  <Input
                    type="number"
                    value={draft.actual?.fuelUsed ?? 0}
                    onChange={(e) => handleFuelChange("fuelUsed", +e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field label="الوقود المتبقي / Fuel Remaining *">
                  <Input
                    type="number"
                    value={draft.actual?.fuelRemaining ?? 0}
                    onChange={(e) => upd("fuelRemaining", +e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field label="الوقود المضاف / Uplift">
                  <Input
                    type="number"
                    value={draft.actual?.uplift ?? 0}
                    onChange={(e) => upd("uplift", +e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </Field>
              </div>
            </section>

            {/* CREW SECTION */}
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <Users className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  طاقم القيادة / Operating Crew
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="قائد الطائرة / PIC (Pilot in Command)">
                  <Input
                    value={draft.actual?.pic || ""}
                    onChange={(e) => upd("pic", e.target.value)}
                    placeholder="Captain Full Name"
                  />
                </Field>
                <Field label="المساعد الأول / SIC (Second in Command)">
                  <Input
                    value={draft.actual?.sic || ""}
                    onChange={(e) => upd("sic", e.target.value)}
                    placeholder="First Officer Name"
                  />
                </Field>
                <Field label="الطيار الممارس / Pilot Flying (PF)">
                  <Select
                    value={String(draft.actual?.picFlying ?? false)}
                    onChange={(e) => upd("picFlying", e.target.value === "true")}
                  >
                    <option value="false">PIC (Captain)</option>
                    <option value="true">SIC (First Officer)</option>
                  </Select>
                </Field>
                <Field label="الطيار المراقب / Pilot Monitoring (PM)">
                  <Input
                    value={draft.actual?.pilotMonitoring || ""}
                    onChange={(e) => upd("pilotMonitoring", e.target.value)}
                    placeholder="PM Name"
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* ═══ OPTIONAL JL & REMARKS ═══ */}
          <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <Sliders className="w-5 h-5 text-indigo-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                بيانات تشغيلية إضافية / Additional Journey Log Details
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="مرافق الراحة بالرحلة / In-flight Rest Facility">
                <Select
                  value={draft.actual?.restFacility || "Suitable"}
                  onChange={(e) => upd("restFacility", e.target.value)}
                >
                  <option value="Suitable">Suitable</option>
                  <option value="Not Suitable">Not Suitable</option>
                  <option value="Class 1">Class 1</option>
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                </Select>
              </Field>

              <Field label="كود التأخير / IATA Delay Code">
                <Input
                  value={draft.actual?.delayCode || ""}
                  onChange={(e) => upd("delayCode", e.target.value)}
                  placeholder="مثال: 81 / 93"
                  className="font-mono"
                />
              </Field>

              <Field label="دقائق الطيران الليلي / Night Time [min]">
                <Input
                  type="number"
                  value={draft.actual?.night ?? 0}
                  onChange={(e) => upd("night", +e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>

              <Field label="دقائق الطيران الآلي / Instrument [min]">
                <Input
                  type="number"
                  value={draft.actual?.instrument ?? 0}
                  onChange={(e) => upd("instrument", +e.target.value)}
                  className="font-mono tabular-nums"
                />
              </Field>
            </div>

            <Field label="ملاحظات سجل الرحلة / Journey Log Remarks">
              <textarea
                value={draft.actual?.notes || ""}
                onChange={(e) => upd("notes", e.target.value)}
                rows={2}
                placeholder="أي ملاحظات فنية أو تشغيلية خاصة بالرحلة المنفذة..."
                className="w-full px-3 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none"
              />
            </Field>
          </section>
        </div>
      </main>

      {/* ═══ FULL-PAGE STICKY FOOTER ═══ */}
      <footer className="px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
          24H UTC Mode · BLOFF: <b>{bloffHHMM || "—"}</b> · BLON: <b>{blonHHMM || "—"}</b> · Block: <b>{blockDur.hhmm}</b>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {t.cancel || "إلغاء"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            {saving ? "جاري الحفظ…" : "حفظ إكمال الرحلة (SAVE JL)"}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default CompleteFlightModal;
