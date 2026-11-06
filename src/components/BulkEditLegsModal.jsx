/* ═══════════════════════════════════════════════════════════
 * BULK EDIT LEGS MODAL — v1.0
 * تعديل جماعي للقطاعات المضافة (legs) فقط
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import { X, Save, Calendar, Clock, Plane } from "lucide-react";

export function BulkEditLegsModal({ flights, fleet = [], onClose, onSave }) {
  const lang = document.documentElement.lang || "en";
  const isRTL = lang === "ar";

  const [scope, setScope] = useState("all"); // "all" | "legs" | "main"
  const [flightNature, setFlightNature] = useState(""); // "" | "PAX" | "FERRY"
  const [pax, setPax] = useState("");
  const [date, setDate] = useState("");
  const [std, setStd] = useState("");
  const [sta, setSta] = useState("");
  const [acft, setAcft] = useState("");
  const [saving, setSaving] = useState(false);

  const legsInfo = useMemo(() => {
    let totalLegs = 0;
    let flightsWithLegs = 0;
    flights.forEach((f) => {
      const legs = Array.isArray(f.legs) ? f.legs : [];
      if (legs.length > 0) {
        flightsWithLegs++;
        totalLegs += legs.length;
      }
    });
    return { totalLegs, flightsWithLegs };
  }, [flights]);

  if (!flights || flights.length === 0) return null;

  const hasAnyChange = date || std || sta || acft || flightNature || (pax !== "");

  const handleSave = async () => {
    if (!hasAnyChange) {
      showToast(isRTL ? "⚠️ لم تقم بتعديل أي حقل" : "⚠️ No fields modified");
      return;
    }
    if (scope === "legs" && legsInfo.totalLegs === 0) {
      showToast(
        isRTL
          ? "⚠️ الرحلات المحددة لا تحتوي على قطاعات إضافية"
          : "⚠️ Selected flights have no additional legs"
      );
      return;
    }

    const scopeLabel =
      scope === "all"
        ? isRTL ? "كافة القطاعات (الأساسية والإضافية)" : "All Sectors (Main & Legs)"
        : scope === "legs"
        ? isRTL ? "القطاعات الإضافية فقط (Legs Only)" : "Additional Legs Only"
        : isRTL ? "القطاع الأساسي فقط (Main Sector Only)" : "Main Sector Only";

    const confirmMsg = isRTL
      ? `✏️ تعديل جماعي على ${flights.length} رحلة:\n\n` +
        `🎯 النطاق: ${scopeLabel}\n` +
        `${flightNature ? `🏷️ طبيعة الرحلة: ${flightNature}\n` : ""}` +
        `${pax !== "" ? `👥 عدد الركاب: ${pax}\n` : ""}` +
        `${date ? `📅 التاريخ: ${date}\n` : ""}` +
        `${std ? `🕐 STD: ${std}\n` : ""}` +
        `${sta ? `🕐 STA: ${sta}\n` : ""}` +
        `${acft ? `✈️ الطائرة: ${acft}\n` : ""}` +
        `\nهل تريد المتابعة وتطبيق التعديل؟`
      : `✏️ Apply bulk changes to ${flights.length} flights (${scopeLabel})?`;

    if (!(await confirmAction(confirmMsg))) return;

    setSaving(true);
    try {
      const changes = { scope };
      if (flightNature) changes.flightNature = flightNature;
      if (pax !== "") changes.pax = pax;
      if (date) changes.date = date;
      if (std) changes.std = std;
      if (sta) changes.sta = sta;
      if (acft) changes.acft = acft;
      await onSave(changes);
      onClose();
    } catch (e) {
      console.error(e);
      showToast((isRTL ? "فشل: " : "Failed: ") + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>{isRTL ? "تعديل القطاعات والرحلات" : "Bulk Edit Flights & Legs"}</span>
            </h2>
            <p className="text-sm text-slate-500">
              {isRTL
                ? `${flights.length} رحلة محددة (${legsInfo.totalLegs} قطاع إضافي)`
                : `${flights.length} flight(s) (${legsInfo.totalLegs} legs)`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scope Selector: All Sectors vs Legs Only vs Main Only */}
        <div className="mb-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            {isRTL ? "نطاق التطبيق (Target Scope):" : "Target Scope:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                scope === "all"
                  ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isRTL ? "كافة القطاعات" : "All Sectors"}
            </button>
            <button
              type="button"
              onClick={() => setScope("legs")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                scope === "legs"
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isRTL ? "الإضافية (Legs)" : "Legs Only"}
            </button>
            <button
              type="button"
              onClick={() => setScope("main")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                scope === "main"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isRTL ? "الأساسي (Main)" : "Main Only"}
            </button>
          </div>
        </div>

        {/* Flight Nature (PAX vs FERRY) */}
        <div className="mb-4 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-2">
          <label className="text-xs font-bold text-cyan-800 dark:text-cyan-300 block">
            {isRTL ? "طبيعة الرحلة (Flight Nature):" : "Flight Nature:"}
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setFlightNature("")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border ${
                flightNature === ""
                  ? "bg-slate-600 text-white border-slate-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {isRTL ? "بدون تغيير" : "No Change"}
            </button>
            <button
              type="button"
              onClick={() => setFlightNature("PAX")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border flex items-center justify-center gap-1 ${
                flightNature === "PAX"
                  ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              👥 PAX (ركاب)
            </button>
            <button
              type="button"
              onClick={() => {
                setFlightNature("FERRY");
                setPax("0");
              }}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition border flex items-center justify-center gap-1 ${
                flightNature === "FERRY"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              ✈️ FERRY (فيري)
            </button>
          </div>

          {flightNature === "PAX" && (
            <div className="pt-1.5 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {isRTL ? "عدد الركاب (PAX):" : "PAX Count:"}
              </span>
              <input
                type="number"
                min="0"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder={isRTL ? "اتركه فارغاً للإبقاء" : "Empty = keep current"}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>
          )}
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              <Calendar className="w-4 h-4" />
              {isRTL ? "التاريخ" : "Date"}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {isRTL
                ? "اتركه فارغاً للإبقاء على التاريخ الحالي"
                : "Leave empty to keep current date"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                <Clock className="w-4 h-4" />
                STD
              </label>
              <input
                type="time"
                value={std}
                onChange={(e) => setStd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                <Clock className="w-4 h-4" />
                STA
              </label>
              <input
                type="time"
                value={sta}
                onChange={(e) => setSta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              <Plane className="w-4 h-4" />
              {isRTL ? "الطائرة" : "Aircraft"}
            </label>
            <select
              value={acft}
              onChange={(e) => setAcft(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">
                {isRTL ? "— بدون تغيير —" : "— No change —"}
              </option>
              {fleet.map((a) => (
                <option key={a.id} value={a.reg}>
                  {a.reg} ({a.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            {isRTL ? "إلغاء" : "Cancel"}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasAnyChange || saving || legsInfo.totalLegs === 0}
            className="px-6 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm flex items-center gap-2 font-bold transition"
          >
            <Save className="w-4 h-4" />
            {saving
              ? isRTL
                ? "جاري التطبيق..."
                : "Applying..."
              : isRTL
              ? "تطبيق جماعي"
              : "Apply to All"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkEditLegsModal;
