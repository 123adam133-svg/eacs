/* ═══════════════════════════════════════════════════════════
 * FLIGHT SETTINGS TAB — Aircraft & Sector Statuses Management
 * Customize and add new aircraft statuses displayed in ScheduleBoard
 * and FlightOpsDrawer with live badge preview and color palettes.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect } from "react";
import {
  Plane,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  Shield,
  Palette,
  Tag,
  Info,
  X,
} from "lucide-react";
import {
  getAircraftStatuses,
  saveAircraftStatus,
  deleteAircraftStatus,
  resetAircraftStatuses,
  DEFAULT_AIRCRAFT_STATUSES,
} from "../utils/flightSettings";
import { showToast, confirmAction } from "../utils/dialog";

const COLOR_OPTIONS = [
  { id: "emerald", label: "أخضر زمردي (Emerald)", bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-700 dark:text-emerald-300" },
  { id: "blue", label: "أزرق قياسي (Blue)", bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-700 dark:text-blue-300" },
  { id: "sky", label: "سماوي جوي (Sky)", bg: "bg-sky-500/20", border: "border-sky-500/40", text: "text-sky-700 dark:text-sky-300" },
  { id: "indigo", label: "نيلي (Indigo)", bg: "bg-indigo-500/20", border: "border-indigo-500/40", text: "text-indigo-700 dark:text-indigo-300" },
  { id: "amber", label: "كهرماني / تنبيه (Amber)", bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-700 dark:text-amber-300" },
  { id: "orange", label: "برتقالي صيانة (Orange)", bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-700 dark:text-orange-300" },
  { id: "rose", label: "أحمر تحذيري (Rose / AOG)", bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-700 dark:text-rose-300" },
  { id: "purple", label: "بنفسجي خاص (Purple)", bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-700 dark:text-purple-300" },
  { id: "teal", label: "تركوازي مكتمل (Teal)", bg: "bg-teal-500/20", border: "border-teal-500/40", text: "text-teal-700 dark:text-teal-300" },
  { id: "slate", label: "رمادي احتياط (Slate)", bg: "bg-slate-500/20", border: "border-slate-500/40", text: "text-slate-700 dark:text-slate-300" },
];

export function FlightSettingsTab({ lang = "ar" }) {
  const isAr = lang === "ar";
  const [statuses, setStatuses] = useState(() => getAircraftStatuses());
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    id: "",
    code: "",
    labelAr: "",
    labelEn: "",
    color: "emerald",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const reload = () => {
    setStatuses(getAircraftStatuses());
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener("aeroops:aircraftStatusesChanged", handler);
    return () => window.removeEventListener("aeroops:aircraftStatusesChanged", handler);
  }, []);

  const openNew = () => {
    setDraft({
      id: "",
      code: "",
      labelAr: "",
      labelEn: "",
      color: "emerald",
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (st) => {
    setDraft({
      id: st.id,
      code: st.code || st.id.slice(0, 3),
      labelAr: st.labelAr || "",
      labelEn: st.labelEn || "",
      color: st.color || "emerald",
    });
    setEditingId(st.id);
    setIsModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!draft.id.trim() || !draft.labelAr.trim()) {
      showToast("⚠️ يرجى ملء معرف الحالة والاسم بالعربية", "warning");
      return;
    }

    const col = COLOR_OPTIONS.find((c) => c.id === draft.color) || COLOR_OPTIONS[0];

    const toSave = {
      id: draft.id.toUpperCase().trim().replace(/\s+/g, "_"),
      code: (draft.code || draft.id.slice(0, 3)).toUpperCase().trim(),
      labelAr: draft.labelAr.trim(),
      labelEn: draft.labelEn.trim() || draft.labelAr.trim(),
      color: draft.color,
      badgeBg: col.bg,
      badgeBorder: col.border,
      badgeText: col.text,
    };

    saveAircraftStatus(toSave);
    setIsModalOpen(false);
    reload();
    showToast(`✅ تم حفظ وضع الطائرة: ${toSave.labelAr}`, "success");
  };

  const handleDelete = async (st) => {
    const confirmed = await confirmAction(
      `هل أنت متأكد من حذف وضع الطائرة (${st.labelAr || st.id})؟`
    );
    if (!confirmed) return;
    deleteAircraftStatus(st.id);
    reload();
    showToast("✅ تم حذف الوضع بنجاح", "success");
  };

  const handleReset = async () => {
    const confirmed = await confirmAction(
      "هل تريد استعادة قائمة أوضاع وحالات الطائرات الافتراضية؟"
    );
    if (!confirmed) return;
    resetAircraftStatuses();
    reload();
    showToast("✅ تمت استعادة الأوضاع الافتراضية", "success");
  };

  const activeColorObj = COLOR_OPTIONS.find((c) => c.id === draft.color) || COLOR_OPTIONS[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Header Info */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
            style={{ background: "var(--brand-gradient)", color: "white" }}
          >
            <Plane className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>{isAr ? "أوضاع وحالات الطائرات (Aircraft Statuses)" : "Aircraft & Flight Statuses"}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-sky-500/15 text-sky-600 font-bold border border-sky-500/30">
                {statuses.length} حالة مسجلة
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr
                ? "تخصيص الحالات المعروضة في جدول الرحلات (Schedule) ودرج التحكم (Ops Drawer) مع ألوان وشارات مميزة"
                : "Manage statuses displayed in Schedule Board and Ops Drawer with custom color badges"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            title="استعادة الأوضاع الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>{isAr ? "استعادة الافتراضي" : "Reset Default"}</span>
          </button>

          <button
            type="button"
            onClick={openNew}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs hover:opacity-90 transition flex items-center gap-1.5"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? "إضافة وضع طائرة جديد" : "Add Status"}</span>
          </button>
        </div>
      </div>

      {/* Statuses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
        {statuses.map((st) => {
          return (
            <div
              key={st.id}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold font-mono border ${st.badgeBg || "bg-slate-500/20"} ${st.badgeText || "text-slate-700 dark:text-slate-300"} ${st.badgeBorder || "border-slate-500/40"}`}
                  >
                    {st.code} · {st.labelAr}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(st)}
                      className="p-1 text-slate-400 hover:text-sky-600 transition rounded"
                      title="تعديل"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!st.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleDelete(st)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">
                  {st.labelEn}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  ID: <span className="text-slate-600 dark:text-slate-400">{st.id}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>اللون: <b className="capitalize text-slate-600 dark:text-slate-300">{st.color}</b></span>
                {st.isDefault ? (
                  <span className="text-emerald-500 font-semibold">نظامي أساسي</span>
                ) : (
                  <span className="text-purple-500 font-semibold">مخصص</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Plane className="w-4 h-4 text-sky-500" />
                <span>{editingId ? "تعديل وضع الطائرة" : "إضافة وضع طائرة جديد"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  معرف الحالة (ID) - بالإنجليزية بدون مسافات:
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingId}
                  value={draft.id}
                  onChange={(e) => setDraft({ ...draft, id: e.target.value.toUpperCase() })}
                  placeholder="e.g. VIP_STANDBY"
                  className="w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    الرمز المختصر (3 أحرف):
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. VST"
                    className="w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    لون الشارة:
                  </label>
                  <select
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border font-bold bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 outline-none"
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الاسم بالعربية:
                </label>
                <input
                  type="text"
                  required
                  value={draft.labelAr}
                  onChange={(e) => setDraft({ ...draft, labelAr: e.target.value })}
                  placeholder="مثال: جاهزة لكبار الشخصيات"
                  className="w-full px-2.5 py-1.5 rounded-lg border font-bold bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  الاسم بالإنجليزية:
                </label>
                <input
                  type="text"
                  value={draft.labelEn}
                  onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })}
                  placeholder="e.g. VIP Standby Ready"
                  className="w-full px-2.5 py-1.5 rounded-lg border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 outline-none"
                />
              </div>

              {/* Live Preview */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">معاينة الشارة في الجدول:</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold font-mono border ${activeColorObj.bg} ${activeColorObj.text} ${activeColorObj.border}`}
                >
                  {(draft.code || draft.id.slice(0, 3) || "COD").toUpperCase()} · {draft.labelAr || "معاينة الوضع"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  حفظ الوضع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
