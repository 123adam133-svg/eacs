/* ═══════════════════════════════════════════════════════════
 * WIDGET LIBRARY MODAL — مكتبة البطاقات المتاحة
 * Allows browsing permitted widgets by category
 * (Operations, Quality, Admin), searching, adding/removing,
 * and applying dashboard presets (including Quality Dashboard).
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  X,
  Plus,
  Check,
  Search,
  Layers,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  WIDGETS_REGISTRY,
  WIDGET_CATEGORIES,
  SIZE_LABELS,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
  getWidgetTitle,
  getWidgetDescription,
} from "./widgetRegistry";

export function WidgetLibraryModal({
  open,
  onClose,
  activeWidgets = [],
  onAddWidget,
  onRemoveWidget,
  onApplyPreset,
  can,
  lang = "en",
}) {
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const isAr = lang === "ar";

  const permittedWidgets = useMemo(
    () => WIDGETS_REGISTRY.filter((w) => canUserSeeWidget(w, can)),
    [can]
  );

  const activeIds = useMemo(
    () => new Set(activeWidgets.map((w) => w.id)),
    [activeWidgets]
  );

  const filteredWidgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return permittedWidgets.filter((w) => {
      if (selectedCategory !== "ALL" && w.category !== selectedCategory)
        return false;
      if (!q) return true;
      return (
        w.id.toLowerCase().includes(q) ||
        String(w.title_en || "")
          .toLowerCase()
          .includes(q) ||
        String(w.title_ar || "")
          .toLowerCase()
          .includes(q) ||
        String(w.description_en || "")
          .toLowerCase()
          .includes(q) ||
        String(w.description_ar || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [permittedWidgets, selectedCategory, search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--brand-primary)",
              }}
            >
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isAr ? "مكتبة البطاقات (Widgets Library)" : "Widgets Library"}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? `${activeIds.size} بطاقات نشطة من أصل ${permittedWidgets.length} متاحة لصلاحياتك`
                  : `${activeIds.size} active of ${permittedWidgets.length} widgets permitted for your role`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition hover:opacity-80"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets + Search + Category Filter */}
        <div
          className="px-5 py-3 space-y-3 shrink-0"
          style={{
            backgroundColor: "var(--bg-app)",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          {/* Quick Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              {isAr ? "قوالب جاهزة:" : "Quick Presets:"}
            </span>
            <button
              type="button"
              onClick={() => onApplyPreset?.("default")}
              className="px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition hover:opacity-85"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <RotateCcw className="w-3 h-3" />
              {isAr ? "الافتراضي للدور" : "Role Default"}
            </button>
            {Object.values(DASHBOARD_PRESETS).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset?.(preset.id)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold transition hover:opacity-85"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  color: "var(--brand-primary)",
                }}
              >
                {isAr ? preset.label_ar : preset.label_en}
              </button>
            ))}
          </div>

          {/* Search + Categories */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isAr
                    ? "ابحث عن بطاقة (مثل: flight-watch، الجودة، الأسطول)..."
                    : "Search widgets (e.g. flight-watch, compliance, fleet)..."
                }
                className="w-full ps-9 pe-3 py-1.5 rounded-lg text-xs outline-none"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap font-mono tabular-nums transition"
                style={
                  selectedCategory === "ALL"
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {isAr ? "الكل" : "All"} ({permittedWidgets.length})
              </button>
              {WIDGET_CATEGORIES.map((cat) => {
                const count = permittedWidgets.filter(
                  (w) => w.category === cat.id
                ).length;
                if (count === 0) return null;
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap font-mono tabular-nums transition"
                    style={
                      active
                        ? {
                            backgroundColor: "var(--brand-primary)",
                            color: "#ffffff",
                          }
                        : {
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-muted)",
                          }
                    }
                  >
                    {isAr ? cat.label_ar : cat.id} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Widgets Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {filteredWidgets.length === 0 ? (
            <div
              className="py-12 text-center text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {isAr
                ? "لا توجد بطاقات مطابقة لمعايير البحث"
                : "No widgets match your search filter"}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWidgets.map((w) => {
                const Icon = w.icon;
                const isAdded = activeIds.has(w.id);
                const catMeta =
                  WIDGET_CATEGORIES.find((c) => c.id === w.category) ||
                  WIDGET_CATEGORIES[0];
                const sizeMeta =
                  SIZE_LABELS[w.defaultSize] || SIZE_LABELS.medium;

                return (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-xl flex flex-col justify-between gap-3 transition"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: isAdded
                        ? "1px solid var(--brand-primary)"
                        : "1px solid var(--border-default)",
                    }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-default)",
                              color: "var(--brand-primary)",
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-xs font-bold truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {getWidgetTitle(w, lang)}
                            </div>
                            <div
                              className="text-[10px] font-mono"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {w.id}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${catMeta.badgeClass}`}
                        >
                          {isAr ? catMeta.label_ar : catMeta.id}
                        </span>
                      </div>

                      <p
                        className="text-xs leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {getWidgetDescription(w, lang)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
                      <span
                        className="text-[11px] font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {isAr ? "الحجم الافتراضي:" : "Default:"}{" "}
                        <b>{isAr ? sizeMeta.ar : sizeMeta.en}</b>
                      </span>

                      {isAdded ? (
                        <button
                          type="button"
                          onClick={() => onRemoveWidget?.(w.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isAr ? "مضافة (إزالة)" : "Added (Remove)"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddWidget?.(w.id, w.defaultSize)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white transition hover:opacity-90"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isAr ? "+ إضافة" : "+ Add"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-end shrink-0"
          style={{ borderTop: "1px solid var(--border-default)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            {isAr ? "تم" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
