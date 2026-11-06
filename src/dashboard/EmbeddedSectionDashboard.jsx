/* ═══════════════════════════════════════════════════════════
 * EMBEDDED SECTION DASHBOARD — Reusable Customizable Dashboard
 * Powers dedicated multi-named & drag-and-drop dashboards inside:
 *   - Quality Management (scope: "quality")
 *   - CAMO Airworthiness (scope: "camo")
 *   - Crew Training (scope: "training")
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Settings,
  Plus,
  Check,
  X,
  RotateCcw,
  Layers,
  Cloud,
  HardDrive,
  RefreshCw,
  GripVertical,
} from "lucide-react";

import { useT } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { can as checkPerm } from "../config/permissions";
import { showToast } from "../utils/dialog";

import {
  WIDGETS_BY_ID,
  WIDGETS_REGISTRY,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
} from "./widgetRegistry";
import {
  useNamedDashboards,
  sanitizeNamedWidgetList,
} from "./useNamedDashboards";
import { NamedDashboardBar } from "./NamedDashboardBar";
import { NamedDashboardModal } from "./NamedDashboardModal";
import {
  SortableWidgetCard,
  WidgetDragOverlayCard,
} from "./SortableWidgetCard";
import { WidgetLibraryModal } from "./WidgetLibraryModal";

export function EmbeddedSectionDashboard({
  scope = "quality",
  defaultPresetKey = "quality",
  flights = [],
  crew = [],
  fleet = [],
  camoList = [],
  melList = [],
  users = [],
  roles = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  manuals = [],
  permits = [],
  cateringOrders = [],
  qualityAudits = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  onOpenAuditsView,
  lang: langProp,
}) {
  const t = useT();
  const { user } = useAuth();
  const lang =
    langProp ||
    t?.code ||
    (typeof document !== "undefined" ? document.documentElement.lang : "en") ||
    "en";
  const isAr = lang === "ar";

  const can = useCallback(
    (perm) => {
      if (!user || !perm) return false;
      try {
        return checkPerm(user, perm);
      } catch {
        return false;
      }
    },
    [user]
  );

  const {
    scopedDashboards,
    visibleDashboards,
    selectedId,
    activeDashboard,
    syncState,
    canManage,
    canEditActive,
    selectDashboard,
    createDashboard,
    updateDashboard,
    saveDashboardWidgets,
    duplicateDashboard,
    deleteDashboard,
  } = useNamedDashboards({
    scope,
    user,
    can,
    allowPersonalOption: false,
  });

  const [editMode, setEditMode] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [managerModal, setManagerModal] = useState({
    open: false,
    mode: "directory",
    target: null,
  });

  const savedWidgets = useMemo(() => {
    if (!activeDashboard) return [];
    return sanitizeNamedWidgetList(activeDashboard.widgets, can);
  }, [activeDashboard, can]);

  useEffect(() => {
    setEditMode(false);
    setDraftWidgets(savedWidgets);
  }, [activeDashboard?.id]);

  useEffect(() => {
    if (!editMode) {
      setDraftWidgets(savedWidgets);
    }
  }, [savedWidgets, editMode]);

  const activeWidgets = editMode ? draftWidgets : savedWidgets;

  const mouseSensor = useSensor(
    MouseSensor,
    editMode
      ? { activationConstraint: { distance: 5 } }
      : { activationConstraint: { delay: 260, tolerance: 8 } }
  );
  const touchSensor = useSensor(
    TouchSensor,
    editMode
      ? { activationConstraint: { delay: 120, tolerance: 6 } }
      : { activationConstraint: { delay: 260, tolerance: 8 } }
  );
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  const enterEditMode = () => {
    if (!canEditActive || !activeDashboard) return;
    setDraftWidgets(savedWidgets);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setDraftWidgets(savedWidgets);
    setEditMode(false);
  };

  const handleSaveLayout = async () => {
    if (!activeDashboard) return;
    await saveDashboardWidgets(activeDashboard.id, draftWidgets);
    setEditMode(false);
    showToast(
      isAr
        ? `تم حفظ تخطيط "${activeDashboard.nameAr || activeDashboard.name}" ومزامنته`
        : `Saved layout for "${activeDashboard.name}"`,
      "success"
    );
  };

  const handleDragStart = (event) => {
    setDraggingId(event.active?.id || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!active || !over || active.id === over.id) return;

    if (editMode) {
      setDraftWidgets((prev) => {
        const oldIdx = prev.findIndex((w) => w.id === active.id);
        const newIdx = prev.findIndex((w) => w.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    } else if (canEditActive && activeDashboard) {
      const oldIdx = savedWidgets.findIndex((w) => w.id === active.id);
      const newIdx = savedWidgets.findIndex((w) => w.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const nextOrder = arrayMove(savedWidgets, oldIdx, newIdx);
        await saveDashboardWidgets(activeDashboard.id, nextOrder);
        showToast(
          isAr
            ? "تم حفظ ترتيب البطاقات تلقائياً"
            : "Dashboard card order saved",
          "success"
        );
      }
    }
  };

  const removeWidget = (widgetId) => {
    setDraftWidgets((prev) => prev.filter((w) => w.id !== widgetId));
  };

  const addWidget = (widgetId, sizeOverride) => {
    const def = WIDGETS_BY_ID[widgetId];
    if (!def) return;
    setDraftWidgets((prev) => {
      if (prev.some((w) => w.id === widgetId)) return prev;
      return [
        ...prev,
        { id: widgetId, size: sizeOverride || def.defaultSize || "medium" },
      ];
    });
  };

  const resizeWidget = (widgetId, nextSize) => {
    setDraftWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, size: nextSize } : w))
    );
  };

  const applyPresetToDraft = (presetKey) => {
    const key =
      presetKey && presetKey !== "default" ? presetKey : defaultPresetKey;
    const source =
      DASHBOARD_PRESETS[key]?.items ||
      DASHBOARD_PRESETS[defaultPresetKey]?.items ||
      DASHBOARD_PRESETS.quality.items;
    const cleaned = sanitizeNamedWidgetList(source, can);
    setDraftWidgets(cleaned);
  };

  const sharedWidgetProps = useMemo(
    () => ({
      flights,
      crew,
      fleet,
      camoList,
      melList,
      users,
      roles,
      leave,
      roster,
      standby,
      training,
      manuals,
      permits,
      cateringOrders,
      qualityAudits,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      onOpenAuditsView,
      can,
      lang,
      t,
    }),
    [
      flights,
      crew,
      fleet,
      camoList,
      melList,
      users,
      roles,
      leave,
      roster,
      standby,
      training,
      manuals,
      permits,
      cateringOrders,
      qualityAudits,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      onOpenAuditsView,
      can,
      lang,
      t,
    ]
  );

  const permittedTotalCount = useMemo(
    () => WIDGETS_REGISTRY.filter((w) => canUserSeeWidget(w, can)).length,
    [can]
  );
  const unaddedCount = Math.max(0, permittedTotalCount - activeWidgets.length);

  const draggingItem = useMemo(() => {
    if (!draggingId) return null;
    const item = activeWidgets.find((w) => w.id === draggingId);
    const def = WIDGETS_BY_ID[draggingId];
    return def ? { def, size: item?.size || def.defaultSize } : null;
  }, [draggingId, activeWidgets]);

  return (
    <div className="space-y-3.5">
      {/* ═══ Named Dashboards Bar + Customize Controls ═══ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <NamedDashboardBar
            dashboards={visibleDashboards}
            selectedId={selectedId}
            onSelect={selectDashboard}
            allowPersonalOption={false}
            canManage={canManage}
            canEditActive={canEditActive}
            activeDashboard={activeDashboard}
            totalScopedCount={scopedDashboards.length}
            onOpenCreate={() =>
              setManagerModal({ open: true, mode: "create", target: null })
            }
            onOpenEditActive={(dash) =>
              setManagerModal({ open: true, mode: "edit", target: dash })
            }
            onOpenDirectory={() =>
              setManagerModal({ open: true, mode: "directory", target: null })
            }
            lang={lang}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono tabular-nums whitespace-nowrap shrink-0"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            {syncState === "syncing" ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {isAr ? "مزامنة..." : "Syncing..."}
              </span>
            ) : syncState === "synced" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Cloud className="w-3 h-3" />
                {isAr ? "متزامن سحابياً" : "Synced"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {isAr ? "محفوظ محلياً" : "Local"}
              </span>
            )}
          </span>

          {canEditActive && activeDashboard && !editMode && (
            <button
              type="button"
              onClick={enterEditMode}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Settings className="w-3.5 h-3.5" />
              {isAr ? "تخصيص البطاقات" : "Customize Cards"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Sticky Edit Mode Toolbar ═══ */}
      {editMode && (
        <div
          className="sticky top-14 z-30 rounded-xl p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "2px solid var(--brand-primary)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <GripVertical className="w-4 h-4" />
            </span>
            <div>
              <div
                className="text-xs sm:text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr
                  ? `وضع تحرير البطاقات — ${
                      activeDashboard?.nameAr || activeDashboard?.name || ""
                    }`
                  : `Editing Dashboard — ${activeDashboard?.name || ""}`}
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                {isAr
                  ? "اسحب البطاقات بـ ⠿ لتغيير الترتيب · غيّر الحجم (S/M/L) · أضف أو احذف بطاقات ثم اضغط حفظ"
                  : "Drag cards with ⠿ · Resize (S/M/L) · Add or delete widgets, then Save"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Plus
                className="w-3.5 h-3.5"
                style={{ color: "var(--brand-primary)" }}
              />
              {isAr ? "+ إضافة بطاقة" : "+ Add Widget"}
              {unaddedCount > 0 && (
                <span className="font-mono tabular-nums text-[10px] opacity-80">
                  ({unaddedCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => applyPresetToDraft(defaultPresetKey)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition whitespace-nowrap shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
              title={
                isAr ? "استعادة البطاقات الافتراضية" : "Reset to default preset"
              }
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">
                {isAr ? "افتراضي" : "Reset"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSaveLayout}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              {isAr ? "حفظ الترتيب" : "Save"}
            </button>

            <button
              type="button"
              onClick={cancelEditMode}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center gap-1 transition whitespace-nowrap shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              {isAr ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Widgets Grid ═══ */}
      {!activeDashboard ? (
        <div
          className="rounded-xl p-10 text-center space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px dashed var(--border-default)",
          }}
        >
          <Layers
            className="w-9 h-9 mx-auto opacity-60"
            style={{ color: "var(--brand-primary)" }}
          />
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {isAr
              ? "لا توجد لوحة متاحة لصلاحيات حسابك في هذا القسم"
              : "No dashboard assigned to your role in this section yet"}
          </h3>
          {canManage && (
            <button
              type="button"
              onClick={() =>
                setManagerModal({
                  open: true,
                  mode: "create",
                  target: null,
                })
              }
              className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Plus className="w-4 h-4" />
              {isAr ? "إنشاء لوحة جديدة" : "Create Dashboard"}
            </button>
          )}
        </div>
      ) : activeWidgets.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px dashed var(--border-default)",
          }}
        >
          <Layers
            className="w-9 h-9 mx-auto opacity-60"
            style={{ color: "var(--brand-primary)" }}
          />
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {isAr ? "اللوحة فارغة حالياً" : "This dashboard has no widgets yet"}
          </h3>
          {canEditActive && (
            <button
              type="button"
              onClick={() => {
                if (!editMode) enterEditMode();
                setLibraryOpen(true);
              }}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <Plus className="w-4 h-4" />
              {isAr
                ? "إضافة بطاقات من المكتبة"
                : "Add Widgets from Library"}
            </button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <SortableContext
            items={activeWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
              {activeWidgets.map((item) => {
                const def = WIDGETS_BY_ID[item.id];
                if (!def || !canUserSeeWidget(def, can)) return null;
                return (
                  <SortableWidgetCard
                    key={item.id}
                    widgetDef={def}
                    size={item.size || def.defaultSize}
                    editMode={editMode}
                    canCustomize={canEditActive}
                    onRemove={removeWidget}
                    onResize={resizeWidget}
                    widgetProps={sharedWidgetProps}
                    lang={lang}
                  />
                );
              })}

              {editMode && (
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="col-span-1 md:col-span-1 lg:col-span-4 min-h-[180px] rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition hover:opacity-90"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "2px dashed var(--border-default)",
                    color: "var(--text-muted)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      color: "var(--brand-primary)",
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <div
                    className="text-sm font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isAr
                      ? "+ إضافة بطاقة جديدة"
                      : "+ Add Widget from Library"}
                  </div>
                </button>
              )}
            </div>
          </SortableContext>

          <DragOverlay adjustScale={false}>
            {draggingItem ? (
              <WidgetDragOverlayCard
                widgetDef={draggingItem.def}
                size={draggingItem.size}
                lang={lang}
                widgetProps={sharedWidgetProps}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ═══ Widgets Library Modal ═══ */}
      <WidgetLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        activeWidgets={activeWidgets}
        onAddWidget={addWidget}
        onRemoveWidget={removeWidget}
        onApplyPreset={applyPresetToDraft}
        can={can}
        lang={lang}
      />

      {/* ═══ Named Dashboards & RBAC Permissions Modal ═══ */}
      <NamedDashboardModal
        open={managerModal.open}
        mode={managerModal.mode}
        initialDashboard={managerModal.target}
        defaultScope={scope}
        currentScreenWidgets={activeWidgets}
        dashboards={scopedDashboards}
        roles={roles}
        users={users}
        selectedId={selectedId}
        onSelectDashboard={selectDashboard}
        onCreateDashboard={createDashboard}
        onUpdateDashboard={updateDashboard}
        onDuplicateDashboard={duplicateDashboard}
        onDeleteDashboard={deleteDashboard}
        onClose={() =>
          setManagerModal({ open: false, mode: "directory", target: null })
        }
        lang={lang}
      />
    </div>
  );
}

export default EmbeddedSectionDashboard;
