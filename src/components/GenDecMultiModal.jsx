/* ═══════════════════════════════════════════════════════════
 * GEN DEC MULTI MODAL — v2.0
 * نافذة واحدة + صفحات (Pagination) لكل رحلة
 * كل رحلة = صفحة GenDec كاملة (بكل قطاعاتها)
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Eye,
  Stamp,
  FileX,
  Lock,
  ChevronLeft,
  ChevronRight,
  Plane,
  Users,
  FileText,
} from "lucide-react";
import { previewGenDec, downloadMultiGenDec } from "../utils/gendecHTML";
import { useAuth } from "../contexts/AuthContext";
import { can as checkPerm } from "../config/permissions";

export function GenDecMultiModal({
  flights,
  crew,
  settings,
  user: propUser = null,
  onClose,
}) {
  const { user: authUser } = useAuth() || {};
  const currentUser = propUser || authUser;

  const canPrintStamp = checkPerm(currentUser, "schedule.gendec_stamp");
  const canPrintNoStamp = checkPerm(currentUser, "schedule.gendec_no_stamp");
  const canAnyPrint = canPrintStamp || canPrintNoStamp;

  const [loading, setLoading] = useState(false);
  const [showStamp, setShowStamp] = useState(() =>
    canPrintStamp ? true : false
  );
  const [page, setPage] = useState(0); // 0-based

  useEffect(() => {
    if (showStamp && !canPrintStamp && canPrintNoStamp) {
      setShowStamp(false);
    } else if (!showStamp && !canPrintNoStamp && canPrintStamp) {
      setShowStamp(true);
    }
  }, [canPrintStamp, canPrintNoStamp, showStamp]);

  const lang = document.documentElement.lang || "en";
  const isRTL = lang === "ar";

  if (!flights || flights.length === 0) return null;

  const totalPages = flights.length;
  const flight = flights[page];

  /* Roster للرحلة النشطة */
  const roster = (flight.crewSlots || [])
    .map((s) => ({
      slot: s,
      member: crew.find((c) => c.id === s.crewId),
    }))
    .filter((x) => x.member);

  /* ⭐ عدد القطاعات لكل رحلة */
  const getSectorsCount = (f) =>
    1 + (Array.isArray(f.legs) ? f.legs.length : 0);

  /* ⭐ قائمة القطاعات للرحلة النشطة */
  const getSectors = (f) => {
    const list = [
      {
        idx: 1,
        dep: f.dep,
        arr: f.arr,
        std: f.std,
        sta: f.sta,
        date: f.std ? String(f.std).slice(0, 10) : "",
        isMain: true,
      },
    ];
    if (Array.isArray(f.legs)) {
      f.legs.forEach((l, i) => {
        list.push({
          idx: i + 2,
          dep: l.dep,
          arr: l.arr,
          std: l.std,
          sta: l.sta,
          date: l.date || (l.std ? String(l.std).slice(0, 10) : ""),
          isMain: false,
        });
      });
    }
    return list;
  };

  /* ⭐ معاينة الرحلة الحالية */
  const handlePreview = () => {
    if (showStamp && !canPrintStamp) return;
    if (!showStamp && !canPrintNoStamp) return;
    setLoading(true);
    try {
      previewGenDec(flight, crew, settings, {
        showStamp: Boolean(showStamp && canPrintStamp),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  /* ⭐ طباعة الكل (PDF واحد بكل الرحلات) */
  const handlePrintAll = async () => {
    if (showStamp && !canPrintStamp) return;
    if (!showStamp && !canPrintNoStamp) return;
    setLoading(true);
    try {
      await downloadMultiGenDec(flights, crew, settings, {
        showStamp: Boolean(showStamp && canPrintStamp),
      });
    } catch (e) {
      console.error(e);
      showToast("فشل: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ⭐ طباعة الصفحة الحالية فقط */
  const handlePrintCurrent = async () => {
    if (showStamp && !canPrintStamp) return;
    if (!showStamp && !canPrintNoStamp) return;
    setLoading(true);
    try {
      await downloadMultiGenDec([flight], crew, settings, {
        showStamp: Boolean(showStamp && canPrintStamp),
      });
    } catch (e) {
      console.error(e);
      showToast("فشل: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const sectors = getSectors(flight);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div className="flex justify-between items-start p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-600" />
              {isRTL ? "التصريح العام" : "General Declaration"}
            </h2>
            <p className="text-xs text-slate-500">
              {isRTL
                ? `${totalPages} صفحات — كل رحلة في صفحة منفصلة`
                : `${totalPages} pages — one flight per page`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ Page Navigation ═══ */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {isRTL ? "السابق" : "Prev"}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
              {isRTL ? "صفحة" : "Page"} {page + 1} / {totalPages}
            </span>
            <div className="flex gap-1">
              {flights.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setPage(idx)}
                  className={`w-2 h-2 rounded-full transition ${
                    idx === page
                      ? "bg-sky-600 scale-125"
                      : "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400"
                  }`}
                  title={`${isRTL ? "صفحة" : "Page"} ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isRTL ? "التالي" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ Scrollable content — Page view ═══ */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg p-5 bg-slate-50 dark:bg-slate-900">
            {/* Page Header */}
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-300 dark:border-slate-600">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">
                  {isRTL ? "صفحة" : "PAGE"} {page + 1}
                </div>
                <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {flight.flightNo || "—"}
                </div>
              </div>
              <div className="text-xs text-slate-500 text-end">
                ICAO Annex 9
                <br />
                {flight.std
                  ? new Date(flight.std).toISOString().slice(0, 10)
                  : "—"}
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div>
                <b>{isRTL ? "الطائرة:" : "Aircraft:"}</b> {flight.acft || "—"}
              </div>
              <div>
                <b>{isRTL ? "الركاب:" : "PAX:"}</b> {flight.pax || 0}
              </div>
              <div>
                <b>{isRTL ? "الطاقم:" : "Crew:"}</b> {roster.length}
              </div>
            </div>

            {/* Sectors */}
            <div className="mb-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Plane className="w-3.5 h-3.5 text-sky-600" />
                {isRTL ? "القطاعات" : "Sectors"} ({sectors.length})
              </div>
              <table className="w-full text-[11px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="p-1.5 text-start">#</th>
                    <th className="p-1.5 text-start">
                      {isRTL ? "من" : "From"}
                    </th>
                    <th className="p-1.5 text-start">{isRTL ? "إلى" : "To"}</th>
                    <th className="p-1.5 text-start">STD</th>
                    <th className="p-1.5 text-start">STA</th>
                    <th className="p-1.5 text-start">
                      {isRTL ? "التاريخ" : "Date"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sectors.map((s) => (
                    <tr
                      key={s.idx}
                      className={`border-t border-slate-200 dark:border-slate-600 ${
                        s.isMain ? "font-bold" : ""
                      }`}
                    >
                      <td className="p-1.5">{s.idx}</td>
                      <td className="p-1.5 font-mono">{s.dep}</td>
                      <td className="p-1.5 font-mono">{s.arr}</td>
                      <td className="p-1.5 font-mono">
                        {s.std ? String(s.std).slice(11, 16) : "—"}
                      </td>
                      <td className="p-1.5 font-mono">
                        {s.sta ? String(s.sta).slice(11, 16) : "—"}
                      </td>
                      <td className="p-1.5 text-slate-500">{s.date || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Crew */}
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-sky-600" />
                {isRTL ? "الطاقم" : "Crew"} ({roster.length})
              </div>
              {roster.length === 0 ? (
                <div className="text-xs text-slate-400 text-center p-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  {isRTL ? "لا يوجد طاقم معيّن" : "No crew assigned"}
                </div>
              ) : (
                <table className="w-full text-[11px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <th className="p-1.5 text-start">#</th>
                      <th className="p-1.5 text-start">
                        {isRTL ? "الوظيفة" : "Position"}
                      </th>
                      <th className="p-1.5 text-start">
                        {isRTL ? "الاسم" : "Name"}
                      </th>
                      <th className="p-1.5 text-start">
                        {isRTL ? "الجواز" : "Passport"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((x, i) => (
                      <tr
                        key={i}
                        className="border-t border-slate-200 dark:border-slate-600"
                      >
                        <td className="p-1.5">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="p-1.5 font-bold">{x.slot.position}</td>
                        <td className="p-1.5">{x.member.fullName}</td>
                        <td className="p-1.5 text-slate-500 font-mono text-[10px]">
                          {x.member.passportNo || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Page footer */}
            <div className="mt-3 pt-2 border-t border-slate-300 dark:border-slate-600 text-[10px] text-slate-500 flex justify-between">
              <span>
                {isRTL ? "صفحة" : "Page"} {page + 1} / {totalPages}
              </span>
              <span>
                {showStamp
                  ? isRTL
                    ? "✅ بختم"
                    : "✅ Stamped"
                  : isRTL
                  ? "❌ بدون ختم"
                  : "❌ No Stamp"}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Footer — Actions ═══ */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-b-2xl">
          {/* Stamp Mode Selector (Granular Permissions) */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Stamp className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isRTL ? "صلاحيات الختم والطباعة:" : "Stamp & Print Mode:"}
              </span>
            </div>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800">
              <button
                type="button"
                disabled={!canPrintStamp}
                onClick={() => canPrintStamp && setShowStamp(true)}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition ${
                  showStamp && canPrintStamp
                    ? "bg-emerald-600 text-white"
                    : canPrintStamp
                    ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-45 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintStamp ? "يتطلب صلاحية طباعة GenDec بالختم الرسمي" : ""}
              >
                <Stamp className="w-3.5 h-3.5" />
                <span>{isRTL ? "بالختم الرسمي" : "With Stamp"}</span>
                {!canPrintStamp && <Lock className="w-3 h-3" />}
              </button>
              <button
                type="button"
                disabled={!canPrintNoStamp}
                onClick={() => canPrintNoStamp && setShowStamp(false)}
                className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border-s border-slate-300 dark:border-slate-600 transition ${
                  !showStamp && canPrintNoStamp
                    ? "bg-slate-700 text-white"
                    : canPrintNoStamp
                    ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    : "opacity-45 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900"
                }`}
                title={!canPrintNoStamp ? "يتطلب صلاحية طباعة GenDec بدون ختم" : ""}
              >
                <FileX className="w-3.5 h-3.5" />
                <span>{isRTL ? "بدون ختم" : "Without Stamp"}</span>
                {!canPrintNoStamp && <Lock className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              {isRTL ? "إغلاق" : "Close"}
            </button>

            <button
              onClick={handlePreview}
              disabled={loading || !canAnyPrint}
              className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs flex items-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5" />
              {isRTL ? "معاينة الحالية" : "Preview Current"}
              {!canAnyPrint && <Lock className="w-3 h-3" />}
            </button>

            <button
              onClick={handlePrintCurrent}
              disabled={loading || !canAnyPrint}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs flex items-center gap-1.5 transition"
              title={isRTL ? "طباعة الصفحة الحالية" : "Print current page only"}
            >
              <Printer className="w-3.5 h-3.5" />
              {isRTL ? "طباعة الحالية" : "Print Current"}
              {!canAnyPrint && <Lock className="w-3 h-3" />}
            </button>

            <button
              onClick={handlePrintAll}
              disabled={loading || !canAnyPrint}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs flex items-center gap-1.5 font-bold transition"
              title={
                isRTL
                  ? `طباعة كل ${totalPages} صفحات في PDF واحد`
                  : `Print all ${totalPages} pages in one PDF`
              }
            >
              <Printer className="w-3.5 h-3.5" />
              {loading
                ? isRTL
                  ? "جاري..."
                  : "..."
                : isRTL
                ? `طباعة الكل (${totalPages} صفحات)`
                : `Print All (${totalPages} pages)`}
              {!canAnyPrint && <Lock className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenDecMultiModal;
