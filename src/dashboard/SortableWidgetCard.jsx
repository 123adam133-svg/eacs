/* ═══════════════════════════════════════════════════════════
 * SORTABLE WIDGET CARD — @dnd-kit/sortable Wrapper
 * Renders a dashboard widget in Normal Mode or Edit Mode:
 * - Normal Mode: Clean card + long-press drag-and-drop auto-save
 * - Edit Mode: Drag handle (⠿), S/M/L size toggle, Delete (🗑️)
 * ═══════════════════════════════════════════════════════════ */
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import {
  WIDGET_CATEGORIES,
  SIZE_LABELS,
  getWidgetTitle,
} from "./widgetRegistry";

export function getGridSpanClass(size) {
  if (size === "large") return "col-span-1 md:col-span-2 lg:col-span-12";
  if (size === "small") return "col-span-1 md:col-span-1 lg:col-span-4";
  return "col-span-1 md:col-span-1 lg:col-span-6"; // medium
}

function getCategoryMeta(catId) {
  return (
    WIDGET_CATEGORIES.find((c) => c.id === catId) || WIDGET_CATEGORIES[0]
  );
}

export function SortableWidgetCard({
  widgetDef,
  size = "medium",
  editMode = false,
  canCustomize = true,
  onRemove,
  onResize,
  lang = "en",
  widgetProps = {},
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widgetDef.id,
    disabled: !canCustomize,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: "var(--bg-card)",
    borderColor: editMode ? "var(--brand-primary)" : "var(--border-default)",
    opacity: isDragging ? 0.35 : 1,
  };

  const Icon = widgetDef.icon;
  const catMeta = getCategoryMeta(widgetDef.category);
  const isAr = lang === "ar";
  const WidgetComponent = widgetDef.component;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!editMode && canCustomize ? { ...attributes, ...listeners } : {})}
      className={`${getGridSpanClass(size)} rounded-xl border ${
        editMode ? "border-dashed ring-1 ring-[var(--brand-primary)]/20" : ""
      } flex flex-col overflow-hidden transition-shadow select-none`}
    >
      {/* Card Header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-default)",
          backgroundColor: editMode ? "var(--bg-app)" : "transparent",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {editMode && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="p-1 rounded-md cursor-grab active:cursor-grabbing touch-none flex items-center justify-center transition hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                color: "var(--brand-primary)",
              }}
              title={isAr ? "اسحب لإعادة الترتيب (⠿)" : "Drag to reorder (⠿)"}
              aria-label="Drag handle"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}

          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              color: "var(--brand-primary)",
            }}
          >
            <Icon className="w-4 h-4" />
          </div>

          <h3
            className="text-sm font-bold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {getWidgetTitle(widgetDef, lang)}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!editMode ? (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${catMeta.badgeClass}`}
            >
              {isAr ? catMeta.label_ar : catMeta.id}
            </span>
          ) : (
            <>
              {/* Size Switcher S / M / L */}
              <div
                className="flex items-center rounded-md p-0.5 font-mono text-[10px]"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {["small", "medium", "large"].map((sz) => {
                  const active = size === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onResize?.(widgetDef.id, sz);
                      }}
                      className="px-1.5 py-0.5 rounded font-bold transition"
                      style={
                        active
                          ? {
                              backgroundColor: "var(--brand-primary)",
                              color: "#ffffff",
                            }
                          : { color: "var(--text-muted)" }
                      }
                      title={
                        isAr ? SIZE_LABELS[sz].ar : SIZE_LABELS[sz].en
                      }
                    >
                      {SIZE_LABELS[sz].short}
                    </button>
                  );
                })}
              </div>

              {/* Delete Widget Button (🗑️) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(widgetDef.id);
                }}
                className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition"
                title={isAr ? "حذف البطاقة" : "Remove widget"}
                aria-label="Remove widget"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div
        className={`p-4 flex-1 ${
          editMode ? "pointer-events-none opacity-85" : ""
        }`}
      >
        <WidgetComponent {...widgetProps} widgetSize={size} lang={lang} />
      </div>
    </div>
  );
}

/* Visual Floating Overlay Card while Dragging */
export function WidgetDragOverlayCard({
  widgetDef,
  size = "medium",
  lang = "en",
  widgetProps = {},
}) {
  if (!widgetDef) return null;
  const Icon = widgetDef.icon;
  const WidgetComponent = widgetDef.component;
  const catMeta = getCategoryMeta(widgetDef.category);
  const isAr = lang === "ar";

  return (
    <div
      className="rounded-xl border-2 shadow-2xl flex flex-col overflow-hidden scale-[1.02] cursor-grabbing"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--brand-primary)",
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{
          borderBottom: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-app)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--brand-primary)" }}
          />
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              color: "var(--brand-primary)",
            }}
          >
            <Icon className="w-4 h-4" />
          </div>
          <h3
            className="text-sm font-bold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {getWidgetTitle(widgetDef, lang)}
          </h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${catMeta.badgeClass}`}
        >
          {isAr ? catMeta.label_ar : catMeta.id}
        </span>
      </div>
      <div className="p-4 opacity-90 pointer-events-none">
        <WidgetComponent {...widgetProps} widgetSize={size} lang={lang} />
      </div>
    </div>
  );
}
