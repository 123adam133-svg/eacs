/* ═══════════════════════════════════════════════════════════
 * GEN DEC MODAL — v3.1
 * Preview + Print مع خيارات (بالختم / بدون ختم)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { X, Printer, Eye, Stamp, FileX, ChevronDown, Lock } from "lucide-react";
import { printGenDec, previewGenDec } from "../utils/gendecHTML";
import { useAuth } from "../contexts/AuthContext";
import { can as checkPerm } from "../config/permissions";

export function GenDecModal({ flight, crew, settings, user: propUser = null, onClose }) {
  const [loading, setLoading] = useState(false);
  const { user: authUser } = useAuth() || {};
  const currentUser = propUser || authUser;

  const canPrintStamp = checkPerm(currentUser, "schedule.gendec_stamp");
  const canPrintNoStamp = checkPerm(currentUser, "schedule.gendec_no_stamp");
  const canAnyPrint = canPrintStamp || canPrintNoStamp;

  const lang = document.documentElement.lang || "en";
  const isRTL = lang === "ar";

  if (!flight) return null;

  const roster = (flight.crewSlots || [])
    .map((s) => ({
      slot: s,
      member: crew.find((c) => c.id === s.crewId),
    }))
    .filter((x) => x.member);

  /* ⭐ دوال المعاينة والطباعة (مع تمرير options) */
  const handlePreview = (showStamp) => {
    if (showStamp && !canPrintStamp) return;
    if (!showStamp && !canPrintNoStamp) return;
    setLoading(true);
    try {
      previewGenDec(flight, crew, settings, { showStamp: Boolean(showStamp && canPrintStamp) });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handlePrint = (showStamp) => {
    if (showStamp && !canPrintStamp) return;
    if (!showStamp && !canPrintNoStamp) return;
    setLoading(true);
    try {
      printGenDec(flight, crew, settings, { showStamp: Boolean(showStamp && canPrintStamp) });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {isRTL ? "التصريح العام" : "General Declaration"}
            </h2>
            <p className="text-sm text-slate-500">
              ICAO Annex 9 — {flight.flightNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 text-sm border-y border-slate-200 dark:border-slate-700 py-3 mb-4">
          <div>
            <b>{isRTL ? "الرحلة:" : "Flight:"}</b> {flight.flightNo || "—"}
          </div>
          <div>
            <b>{isRTL ? "الطائرة:" : "Aircraft:"}</b> {flight.acft || "—"}
          </div>
          <div>
            <b>{isRTL ? "المسار:" : "Route:"}</b> {flight.dep} → {flight.arr}
          </div>
          <div>
            <b>{isRTL ? "الركاب:" : "PAX:"}</b> {flight.pax || 0}
          </div>
          <div>
            <b>{isRTL ? "الطاقم:" : "Crew:"}</b> {roster.length}
          </div>
          <div>
            <b>{isRTL ? "التاريخ:" : "Date:"}</b>{" "}
            {flight.std ? new Date(flight.std).toISOString().slice(0, 10) : "—"}
          </div>
        </div>

        {/* Crew List */}
        <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-100">
          {isRTL ? "قائمة الطاقم" : "Crew List"} ({roster.length})
        </h3>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="p-2 text-start">#</th>
                <th className="p-2 text-start">
                  {isRTL ? "الوظيفة" : "Position"}
                </th>
                <th className="p-2 text-start">{isRTL ? "الاسم" : "Name"}</th>
                <th className="p-2 text-start">
                  {isRTL ? "الجواز" : "Passport"}
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.length === 0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="p-4 text-center text-slate-400 text-xs"
                  >
                    {isRTL ? "لا يوجد طاقم معيّن" : "No crew assigned"}
                  </td>
                </tr>
              ) : (
                roster.map((x, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="p-2">{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-2 font-bold">{x.slot.position}</td>
                    <td className="p-2">{x.member.fullName}</td>
                    <td className="p-2 text-slate-500 font-mono text-[10px]">
                      {x.member.passportNo || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════
         * Actions — أزرار مع قوائم منسدلة للختم
         * ═══════════════════════════════════════════════════ */}
        <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          {/* Close */}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>

          {/* ⭐ Preview مع قائمة منسدلة */}
          <div className="relative group">
            <button
              disabled={loading || !canAnyPrint}
              className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm flex items-center gap-2 transition"
              title={!canAnyPrint ? "لا توجد صلاحية معاينة/طباعة GenDec" : ""}
            >
              <Eye className="w-4 h-4" />
              {isRTL ? "معاينة" : "Preview"}
              {!canAnyPrint ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* القائمة المنسدلة للمعاينة */}
            <div className="absolute bottom-full mb-1 left-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl hidden group-hover:block z-50">
              <button
                onClick={() => handlePreview(true)}
                disabled={!canPrintStamp}
                className={`w-full text-start px-4 py-2 text-sm flex items-center justify-between rounded-t-lg transition ${
                  canPrintStamp
                    ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintStamp ? "يتطلب صلاحية الطباعة بالختم الرسمي" : ""}
              >
                <div className="flex items-center gap-2">
                  <Stamp className="w-4 h-4 text-emerald-600" />
                  <span>{isRTL ? "معاينة بالختم" : "Preview with Stamp"}</span>
                </div>
                {!canPrintStamp && <Lock className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              <button
                onClick={() => handlePreview(false)}
                disabled={!canPrintNoStamp}
                className={`w-full text-start px-4 py-2 text-sm flex items-center justify-between rounded-b-lg transition ${
                  canPrintNoStamp
                    ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintNoStamp ? "يتطلب صلاحية الطباعة بدون ختم" : ""}
              >
                <div className="flex items-center gap-2">
                  <FileX className="w-4 h-4 text-slate-500" />
                  <span>{isRTL ? "معاينة بدون ختم" : "Preview without Stamp"}</span>
                </div>
                {!canPrintNoStamp && <Lock className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* ⭐ Print مع قائمة منسدلة */}
          <div className="relative group">
            <button
              disabled={loading || !canAnyPrint}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm flex items-center gap-2 font-bold transition"
              title={!canAnyPrint ? "لا توجد صلاحية طباعة GenDec" : ""}
            >
              <Printer className="w-4 h-4" />
              {isRTL ? "طباعة" : "Print"}
              {!canAnyPrint ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {/* القائمة المنسدلة للطباعة */}
            <div className="absolute bottom-full mb-1 left-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl hidden group-hover:block z-50">
              <button
                onClick={() => handlePrint(true)}
                disabled={!canPrintStamp}
                className={`w-full text-start px-4 py-2 text-sm flex items-center justify-between rounded-t-lg transition ${
                  canPrintStamp
                    ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintStamp ? "يتطلب صلاحية الطباعة بالختم الرسمي" : ""}
              >
                <div className="flex items-center gap-2">
                  <Stamp className="w-4 h-4 text-emerald-600" />
                  <span>{isRTL ? "طباعة بالختم" : "Print with Stamp"}</span>
                </div>
                {!canPrintStamp && <Lock className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              <button
                onClick={() => handlePrint(false)}
                disabled={!canPrintNoStamp}
                className={`w-full text-start px-4 py-2 text-sm flex items-center justify-between rounded-b-lg transition ${
                  canPrintNoStamp
                    ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintNoStamp ? "يتطلب صلاحية الطباعة بدون ختم" : ""}
              >
                <div className="flex items-center gap-2">
                  <FileX className="w-4 h-4 text-slate-500" />
                  <span>{isRTL ? "طباعة بدون ختم" : "Print without Stamp"}</span>
                </div>
                {!canPrintNoStamp && <Lock className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenDecModal;
