/* ═══════════════════════════════════════════════════════════
 * POSITIONS SETTINGS TAB — Theme-aware (CSS Variables)
 * v2.0 — إدارة الوظائف + يتبع الثيم
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  Edit,
  X,
  Lock,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import {
  DEFAULT_POSITION_OPTIONS,
  getPositionOptions,
} from "../config/constants";
import { settingsAPI } from "../api";
import { showToast, confirmAction } from "../utils/dialog";

const EMPTY_POSITION = {
  key: "",
  en: "",
  short: "",
  ar: "",
  defaultPlace: "",
  locked: false,
  custom: true,
};

export function PositionsSettingsTab({
  settings,
  setSettings,
  t,
  lang,
  setSyncStatus,
}) {
  const [positions, setPositions] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(EMPTY_POSITION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPositions(getPositionOptions(settings));
  }, [settings]);

  const startEdit = (idx) => {
    if (positions[idx].locked) return;
    setEditingIndex(idx);
    setDraft({ ...positions[idx] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraft(EMPTY_POSITION);
  };

  const saveEdit = () => {
    if (!draft.short || !draft.key) {
      showToast("⚠️ يجب إدخال المفتاح (key) والاختصار (short)", "warning");
      return;
    }
    const duplicate = positions.some(
      (p, i) =>
        i !== editingIndex && p.key.toLowerCase() === draft.key.toLowerCase()
    );
    if (duplicate) {
      showToast("⚠️ هذا المفتاح مستخدم بالفعل", "warning");
      return;
    }
    const updated = [...positions];
    updated[editingIndex] = {
      ...updated[editingIndex],
      ...draft,
      key: draft.key.toLowerCase().trim(),
      short: draft.short.toUpperCase().trim(),
      en: draft.en || draft.short,
      ar: draft.ar || draft.short,
    };
    setPositions(updated);
    cancelEdit();
  };

  const addNew = () => {
    setEditingIndex(-1);
    setDraft({ ...EMPTY_POSITION });
  };

  const saveNew = () => {
    if (!draft.key || !draft.short) {
      showToast("⚠️ يجب إدخال المفتاح (key) والاختصار (short)", "warning");
      return;
    }
    const duplicate = positions.some(
      (p) => p.key.toLowerCase() === draft.key.toLowerCase()
    );
    if (duplicate) {
      showToast("⚠️ هذا المفتاح مستخدم بالفعل", "warning");
      return;
    }
    const newPos = {
      ...draft,
      key: draft.key.toLowerCase().trim(),
      short: draft.short.toUpperCase().trim(),
      en: draft.en || `${draft.short} (${draft.short})`,
      ar: draft.ar || draft.short,
      custom: true,
      locked: false,
    };
    setPositions([...positions, newPos]);
    cancelEdit();
  };

  const remove = async (idx) => {
    if (positions[idx].locked) return;
    const ok = await confirmAction(`حذف وظيفة "${positions[idx].short}"?`);
    if (!ok) return;
    setPositions(positions.filter((_, i) => i !== idx));
  };

  const resetToDefault = async () => {
    const ok = await confirmAction(
      "استعادة الوظائف الافتراضية؟ سيتم فقدان أي وظائف مخصصة."
    );
    if (!ok) return;
    setPositions(DEFAULT_POSITION_OPTIONS);
  };

  const saveAll = async () => {
    if (!setSettings) {
      showToast("⚠️ لا يمكن الحفظ — setSettings غير متاح", "warning");
      return;
    }
    setSaving(true);
    try {
      setSyncStatus?.("syncing");
      const payload = { positions: positions };
      await settingsAPI.save(payload);
      const fresh = await settingsAPI.get();
      if (fresh) setSettings(fresh);
      else setSettings({ ...settings, ...payload });
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ الوظائف بنجاح", "success");
    } catch (e) {
      showToast("❌ فشل الحفظ: " + e.message, "error");
      setSyncStatus?.("error");
    } finally {
      setSaving(false);
    }
  };

  const lockedCount = positions.filter((p) => p.locked).length;
  const customCount = positions.filter((p) => p.custom).length;

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-default)",
    boxShadow: "var(--shadow-sm)",
  };

  return (
    <div className="space-y-4 max-w-4xl fade-in">
      {/* ═══ Header ═══ */}
      <div
        className="p-4 rounded-2xl text-white shadow-md-theme"
        style={{ background: "var(--brand-gradient)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <GripVertical className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {lang === "ar" ? "الوظائف" : "Positions"}
            </h3>
            <div className="text-xs opacity-80">
              {positions.length} {lang === "ar" ? "وظيفة" : "positions"} ·{" "}
              {customCount} {lang === "ar" ? "مخصصة" : "custom"} · {lockedCount}{" "}
              {lang === "ar" ? "مقفلة" : "locked"}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Actions ═══ */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={addNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:-translate-y-0.5"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Plus className="w-4 h-4" />
          {lang === "ar" ? "إضافة وظيفة" : "Add Position"}
        </button>
        <button
          onClick={resetToDefault}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition"
          style={{
            backgroundColor: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <RotateCcw className="w-4 h-4" />
          {lang === "ar" ? "استعادة الافتراضي" : "Reset Defaults"}
        </button>
      </div>

      {/* ═══ Table ═══ */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <table className="w-full text-sm">
          <thead
            style={{
              backgroundColor: "var(--bg-app)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <tr style={{ color: "var(--text-primary)" }}>
              <th className="px-3 py-2 text-start font-bold">Short</th>
              <th className="px-3 py-2 text-start font-bold">Key</th>
              <th className="px-3 py-2 text-start font-bold">
                {lang === "ar" ? "الاسم (EN)" : "Name (EN)"}
              </th>
              <th className="px-3 py-2 text-start font-bold">
                {lang === "ar" ? "الاسم (AR)" : "Name (AR)"}
              </th>
              <th className="px-3 py-2 text-center font-bold">GenDec</th>
              <th className="px-3 py-2 text-center font-bold">
                {lang === "ar" ? "إجراءات" : "Actions"}
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, idx) => {
              const isEditing = editingIndex === idx;
              if (isEditing) {
                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: "rgba(99, 102, 241, 0.12)",
                      borderBottom: "1px solid var(--border-default)",
                    }}
                  >
                    <td className="px-3 py-2">
                      <Input
                        value={draft.short || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, short: e.target.value })
                        }
                        placeholder="CPT"
                        maxLength={6}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.key || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, key: e.target.value })
                        }
                        placeholder="captain"
                        disabled={p.locked}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.en || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, en: e.target.value })
                        }
                        placeholder="Captain (CPT)"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.ar || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, ar: e.target.value })
                        }
                        placeholder="كابتن"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.defaultPlace || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            defaultPlace: e.target.value,
                          })
                        }
                        placeholder="PIC"
                        maxLength={6}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={saveEdit}
                          className="p-1.5 rounded bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition"
                          title="حفظ"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 rounded bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 transition"
                          title="إلغاء"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid var(--border-default)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-app)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <td
                    className="px-3 py-2 font-mono font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.short}
                    {p.locked && (
                      <Lock className="w-3 h-3 inline ms-1 text-amber-500" />
                    )}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.key}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.en}
                  </td>
                  <td
                    className="px-3 py-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.ar}
                  </td>
                  <td
                    className="px-3 py-2 text-center font-mono text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {p.defaultPlace || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(idx)}
                        disabled={p.locked}
                        className="p-1.5 rounded bg-sky-500/15 text-sky-500 hover:bg-sky-500/25 disabled:opacity-30 transition"
                        title="تعديل"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(idx)}
                        disabled={p.locked}
                        className="p-1.5 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 disabled:opacity-30 transition"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {editingIndex === -1 && (
              <tr
                style={{
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                  borderBottom: "1px solid var(--border-default)",
                }}
              >
                <td className="px-3 py-2">
                  <Input
                    value={draft.short || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, short: e.target.value })
                    }
                    placeholder="PUR"
                    maxLength={6}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={draft.key || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, key: e.target.value })
                    }
                    placeholder="purser"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={draft.en || ""}
                    onChange={(e) => setDraft({ ...draft, en: e.target.value })}
                    placeholder="Purser"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={draft.ar || ""}
                    onChange={(e) => setDraft({ ...draft, ar: e.target.value })}
                    placeholder="مدير مقصورة"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={draft.defaultPlace || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, defaultPlace: e.target.value })
                    }
                    placeholder="PUR"
                    maxLength={6}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={saveNew}
                      className="p-1.5 rounded bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 transition"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1.5 rounded bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ Save All ═══ */}
      <button
        onClick={saveAll}
        disabled={saving}
        className="w-full px-4 py-3 disabled:opacity-50 text-white rounded-xl text-sm flex items-center justify-center gap-2 font-bold transition hover:-translate-y-0.5"
        style={{
          background: "var(--brand-gradient)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <Save className="w-4 h-4" />
        {saving ? "…" : lang === "ar" ? "حفظ الوظائف" : "Save Positions"}
      </button>

      <div
        className="p-3 rounded-xl text-xs"
        style={{
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          color: "#f59e0b",
        }}
      >
        💡 <b>{lang === "ar" ? "ملاحظة:" : "Note:"}</b>{" "}
        {lang === "ar"
          ? "الوظائف المضافة ستظهر فوراً في قائمة Add Position عند تعديل رحلة، وستُضاف كعمود في Table View عند تعيين عضو."
          : "New positions will appear immediately in the Add Position dropdown when editing a flight, and as a new column in Table View when assigned."}
      </div>
    </div>
  );
}

/* ⭐ قيمة لون مساعدة (لاستخدام متسق) */
const THEME_ACCENT = "var(--brand-primary)";

export default PositionsSettingsTab;
