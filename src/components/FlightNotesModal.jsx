/* ═══════════════════════════════════════════════════════════
 * FLIGHT NOTES MODAL
 * 3 text areas: Notes + Permits + Handling
 * v1.2 — Renamed "Services Company" → "Handling"
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { useT } from "../contexts";
import { showToast, confirmAction } from "../utils/dialog";

export function FlightNotesModal({ flight, onClose, onSave }) {
  const t = useT();

  const [notes, setNotes] = useState("");
  const [permits, setPermits] = useState("");
  const [handling, setHandling] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (flight) {
      setNotes(flight.notes || "");
      setPermits(flight.permits || "");
      setHandling(flight.services || flight.handling || "");
    }
  }, [flight]);

  if (!flight) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(flight.id, {
        notes,
        permits,
        handling,
        services: handling,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 900);
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const ok = await confirmAction(t.clearAllConfirm || "مسح كل الحقول؟");
    if (!ok) return;
    setNotes("");
    setPermits("");
    setHandling("");
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══ Header ═══ */}
        <div className="bg-slate-700 dark:bg-slate-900 text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="min-w-0">
            <h3 className="font-bold text-lg">
              {t.flightNotes || "Flight Notes"} — {flight.flightNo}
            </h3>
            <p className="text-xs text-slate-300">
              {flight.dep} → {flight.arr} · {flight.acft}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ═══ Body ═══ */}
        <div className="p-5 space-y-5">
          {/* 1. Notes */}
          <section>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              📝 {t.freeNotes || "Free Notes"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="4"
              placeholder={t.writeNote || "Write your notes here…"}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-end">
              {notes.length} {t.characters || "chars"}
            </div>
          </section>

          {/* 2. Permits */}
          <section>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              🛡️ {t.permits || "Permits"}
            </label>
            <textarea
              value={permits}
              onChange={(e) => setPermits(e.target.value)}
              rows="3"
              placeholder={t.writePermit || "Write permit details here…"}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-end">
              {permits.length} {t.characters || "chars"}
            </div>
          </section>

          {/* 3. Handling */}
          <section>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              🛠️ {t.handling || "Handling"}
            </label>
            <textarea
              value={handling}
              onChange={(e) => setHandling(e.target.value)}
              rows="3"
              placeholder={t.writeHandling || "Write handling details here…"}
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-end">
              {handling.length} {t.characters || "chars"}
            </div>
          </section>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex flex-wrap justify-between gap-2 sticky bottom-0">
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t.clearAll || "Clear All"}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
            >
              {t.cancel || "Cancel"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 ${
                saved
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-700 hover:bg-slate-800 text-white"
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? "..." : saved ? t.saved || "Saved" : t.save || "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlightNotesModal;
