/* ═══════════════════════════════════════════════════════════
 * STANDBY MODULE — EASA Compliance
 * Crew standby management with ¼/½ calculation
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { useT } from "../contexts";
import { standbyAPI } from "../api";
import { fmtDuty, timeDiffMin, todayISO } from "../utils/helpers";
import { STANDBY_TYPES, calcEasaStandby } from "../config/constants";

export function StandbyModule({
  crew,
  standby = [],
  setStandby,
  setSyncStatus,
}) {
  const t = useT();
  const lang = document.documentElement.lang || "en";

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("upcoming");
  const [crewFilter, setCrewFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});

  /* ⭐ Filtering */
  const filtered = standby
    .filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.crewName?.toLowerCase().includes(q) &&
          !s.notes?.toLowerCase().includes(q)
        )
          return false;
      }
      if (typeFilter && s.type !== typeFilter) return false;
      if (crewFilter && s.crewId !== crewFilter) return false;

      const today = todayISO();
      if (dateFilter === "upcoming" && s.date < today) return false;
      if (dateFilter === "past" && s.date >= today) return false;
      if (dateFilter === "today" && s.date !== today) return false;

      return true;
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  /* ⭐ Stats */
  const stats = useMemo(() => {
    return {
      total: standby.length,
      active: standby.filter((x) => x.activated).length,
      pending: standby.filter((x) => !x.activated && x.date >= todayISO())
        .length,
      byType: {
        AIRPORT: standby.filter((x) => x.type === "AIRPORT").length,
        HOME: standby.filter((x) => x.type === "HOME").length,
        HOTEL: standby.filter((x) => x.type === "HOTEL").length,
      },
    };
  }, [standby]);

  /* ⭐ CRUD */
  const openNew = () => {
    setDraft({
      date: todayISO(),
      crewId: "",
      crewName: "",
      type: "AIRPORT",
      startTime: "08:00",
      endTime: "16:00",
      durationMin: 480,
      activated: false,
      activatedAt: "",
      flightId: "",
      notes: "",
    });
    setEditing("new");
  };

  const openEdit = (s) => {
    setDraft({ ...s });
    setEditing(s.id);
  };

  const save = async () => {
    if (!draft.crewId || !draft.date) {
      showToast("Crew and date are required");
      return;
    }

    const durationMin = timeDiffMin(draft.startTime, draft.endTime);
    const finalDraft = { ...draft, durationMin };

    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await standbyAPI.create(finalDraft);
        setStandby([...standby, { ...finalDraft, id: created.id }]);
      } else {
        await standbyAPI.update(editing, finalDraft);
        setStandby(
          standby.map((s) =>
            s.id === editing ? { ...finalDraft, id: editing } : s
          )
        );
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (!(await confirmAction(t.confirmDelete))) return;
    try {
      await standbyAPI.remove(id);
      setStandby(standby.filter((s) => s.id !== id));
    } catch (e) {
      showToast("Delete failed: " + e.message);
    }
  };

  const toggleActivated = async (s) => {
    const updated = {
      ...s,
      activated: !s.activated,
      activatedAt: !s.activated ? new Date().toISOString() : "",
    };
    setStandby(standby.map((x) => (x.id === s.id ? updated : x)));
    try {
      await standbyAPI.update(s.id, updated);
    } catch (e) {
      showToast("Update failed: " + e.message);
    }
  };

  /* ⭐ Totals */
  const totalStandbyMin = filtered.reduce(
    (sum, s) => sum + (s.durationMin || 0),
    0
  );
  const totalEasaMin = filtered.reduce((sum, s) => {
    const calc = calcEasaStandby(s.durationMin || 0);
    return sum + calc.countMin;
  }, 0);

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t.standbyTitle}</h2>
              <div className="text-xs text-amber-100">
                {t.standbyEASA} · {stats.total} entries · {stats.active} active
              </div>
            </div>
          </div>

          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> {t.addStandby}
          </button>
        </div>
      </div>

      {/* ═══ EASA Info ═══ */}
      <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-800 rounded-xl p-3">
        <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <b>{t.standbyRules}</b>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>{t.standbyRule1}</li>
              <li>{t.standbyRule2}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-sky-200 dark:border-sky-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.totalStandby}
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {fmtDuty(totalStandbyMin)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.easaCounted}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {fmtDuty(totalEasaMin)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.activated}
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {stats.active}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-amber-200 dark:border-amber-800 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase">
            {t.pending}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {stats.pending}
          </div>
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <select
          value={crewFilter}
          onChange={(e) => setCrewFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.allCrew}</option>
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all}</option>
          {Object.entries(STANDBY_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.icon} {lang === "ar" ? v.label_ar : v.label_en}
            </option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="today">{t.standbyToday}</option>
          <option value="upcoming">{t.standbyUpcoming}</option>
          <option value="past">{t.standbyPast}</option>
          <option value="all">{t.standbyAll}</option>
        </select>
      </div>

      {/* ═══ Table ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900 border-b-2 border-slate-300 dark:border-slate-700">
              <tr>
                {[
                  t.date,
                  t.crew,
                  t.type,
                  t.startTime,
                  t.endTime,
                  t.standbyDuration,
                  t.standbyEASACount,
                  t.status,
                  t.actions,
                ].map((h, idx) => (
                  <th
                    key={`${h}-${idx}`}
                    className="px-3 py-2 text-start font-bold text-slate-700 dark:text-slate-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const t2 = STANDBY_TYPES[s.type] || STANDBY_TYPES.AIRPORT;
                  const easa = calcEasaStandby(s.durationMin || 0);
                  const isPast = s.date < todayISO();

                  return (
                    <tr
                      key={s.id}
                      className={`border-b border-slate-200 dark:border-slate-700 hover:bg-amber-50/40 dark:hover:bg-slate-700/50 ${
                        isPast ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                        {s.date}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">
                        {s.crewName}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${t2.color}`}
                        >
                          <span>{t2.icon}</span>
                          {lang === "ar" ? t2.label_ar : t2.label_en}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                        {s.startTime}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-slate-300">
                        {s.endTime}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-800 dark:text-slate-100">
                        {fmtDuty(s.durationMin)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          {fmtDuty(easa.countMin)}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {easa.factor}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleActivated(s)}
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            s.activated
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                          }`}
                        >
                          {s.activated
                            ? `⚡ ${t.activated}`
                            : `🟢 ${t.onStandby}`}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(s.id)}
                            className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {editing === "new" ? t.addStandby : t.editStandby}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.date} *
                </label>
                <input
                  type="date"
                  value={draft.date || ""}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.crew} *
                </label>
                <select
                  value={draft.crewId || ""}
                  onChange={(e) => {
                    const c = crew.find((x) => x.id === e.target.value);
                    setDraft({
                      ...draft,
                      crewId: e.target.value,
                      crewName: c?.fullName || "",
                    });
                  }}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                >
                  <option value="">{t.selectCrew}</option>
                  {crew
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.empNo})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.type} *
                </label>
                <select
                  value={draft.type || "AIRPORT"}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                >
                  {Object.entries(STANDBY_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.icon} {lang === "ar" ? v.label_ar : v.label_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {t.startTime}
                  </label>
                  <input
                    type="time"
                    value={draft.startTime || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {t.endTime}
                  </label>
                  <input
                    type="time"
                    value={draft.endTime || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              {/* Preview */}
              {draft.startTime && draft.endTime && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t.standbyDuration}:
                    </span>
                    <span className="font-bold font-mono text-slate-800 dark:text-slate-100">
                      {fmtDuty(timeDiffMin(draft.startTime, draft.endTime))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t.standbyEASACount}:
                    </span>
                    <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      {fmtDuty(
                        calcEasaStandby(
                          timeDiffMin(draft.startTime, draft.endTime)
                        ).countMin
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1 text-end">
                    (
                    {
                      calcEasaStandby(
                        timeDiffMin(draft.startTime, draft.endTime)
                      ).factor
                    }
                    )
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t.notes}
                </label>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                  rows="2"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.activated || false}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        activated: e.target.checked,
                        activatedAt: e.target.checked
                          ? new Date().toISOString()
                          : "",
                      })
                    }
                    className="w-4 h-4 accent-rose-600"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    ⚡ {t.activateStandby}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              {editing !== "new" && (
                <button
                  onClick={() => {
                    remove(draft.id);
                    setEditing(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-sm"
                >
                  {t.delete}
                </button>
              )}
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
              >
                {t.cancel}
              </button>
              <button
                onClick={save}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1"
              >
                <Save className="w-4 h-4" /> {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StandbyModule;
