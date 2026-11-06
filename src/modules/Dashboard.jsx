/* ═══════════════════════════════════════════════════════════
 * CUSTOMIZABLE DASHBOARD — لوحة تحكم قابلة للتخصيص ومتعددة التسميات
 * Features:
 * 1. Modular Widget System (Operations, Quality Dashboard, Admin)
 * 2. Multi-Named Dashboards + Personal View with Granular RBAC Permissions
 * 3. Dual Layout Persistence (localStorage + Google Sheets sync)
 * 4. @dnd-kit/core Drag & Drop (long-press in Normal Mode + ⠿ handle in Edit Mode)
 * 5. Full Edit Mode (⚙️ Customize, ⠿ Drag, S/M/L Resize, 🗑️ Delete, + Add Library, ✓ Save, ✕ Cancel)
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
  ShieldCheck,
  Layers,
  Cloud,
  HardDrive,
  RefreshCw,
  GripVertical,
  Gauge,
} from "lucide-react";

import { useT } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { LiveClock } from "../components/ui";
import { can as checkPerm, getRoleLabel } from "../config/permissions";
import { manualsAPI, flightPermitsAPI, cateringOrdersAPI } from "../api";
import { showToast } from "../utils/dialog";

import {
  WIDGETS_BY_ID,
  WIDGETS_REGISTRY,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
} from "../dashboard/widgetRegistry";
import { useDashboardLayout } from "../dashboard/useDashboardLayout";
import {
  useNamedDashboards,
  sanitizeNamedWidgetList,
} from "../dashboard/useNamedDashboards";
import { NamedDashboardBar } from "../dashboard/NamedDashboardBar";
import { NamedDashboardModal } from "../dashboard/NamedDashboardModal";
import {
  SortableWidgetCard,
  WidgetDragOverlayCard,
} from "../dashboard/SortableWidgetCard";
import { WidgetLibraryModal } from "../dashboard/WidgetLibraryModal";

export function Dashboard({
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
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  loading = false,
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

  /* ── Permission Evaluator ── */
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

  /* ── Supplemental Live Data (Manuals, Permits, Catering) ── */
  const [manuals, setManuals] = useState([]);
  const [permits, setPermits] = useState([]);
  const [cateringOrders, setCateringOrders] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadExtras = async () => {
      const tasks = [
        can("manuals.view") || can("schedule.view")
          ? manualsAPI.list().catch(() => [])
          : Promise.resolve([]),
        can("permits.view")
          ? flightPermitsAPI.list().catch(() => [])
          : Promise.resolve([]),
        can("catering.view")
          ? cateringOrdersAPI.list().catch(() => [])
          : Promise.resolve([]),
      ];
      const [mList, pList, cList] = await Promise.all(tasks);
      if (!cancelled) {
        setManuals(mList || []);
        setPermits(pList || []);
        setCateringOrders(cList || []);
      }
    };
    loadExtras();
    return () => {
      cancelled = true;
    };
  }, [can]);

  /* ── 1) Per-User Personal Layout Hook ── */
  const personalLayout = useDashboardLayout(user, can);

  /* ── 2) Multi-Named Shared Dashboards Hook (with Role/User Permissions) ── */
  const {
    scopedDashboards,
    visibleDashboards,
    selectedId,
    activeDashboard,
    syncState: namedSyncState,
    canManage: canManageNamed,
    canEditActive: canEditNamedActive,
    selectDashboard,
    createDashboard,
    updateDashboard,
    saveDashboardWidgets,
    duplicateDashboard,
    deleteDashboard,
  } = useNamedDashboards({
    scope: "main",
    user,
    can,
    allowPersonalOption: true,
  });

  const isPersonalMode = !activeDashboard || selectedId === "__personal__";

  /* ── Named Dashboard Edit State (when viewing a Named Dashboard) ── */
  const [namedEditMode, setNamedEditMode] = useState(false);
  const [namedDraftWidgets, setNamedDraftWidgets] = useState([]);

  const savedNamedWidgets = useMemo(() => {
    if (!activeDashboard) return [];
    return sanitizeNamedWidgetList(activeDashboard.widgets, can);
  }, [activeDashboard, can]);

  useEffect(() => {
    setNamedEditMode(false);
    setNamedDraftWidgets(savedNamedWidgets);
  }, [activeDashboard?.id, isPersonalMode]);

  useEffect(() => {
    if (!namedEditMode) {
      setNamedDraftWidgets(savedNamedWidgets);
    }
  }, [savedNamedWidgets, namedEditMode]);

  /* ── Unified Active State (Personal vs Named Dashboard) ── */
  const editMode = isPersonalMode ? personalLayout.editMode : namedEditMode;
  const activeWidgets = isPersonalMode
    ? personalLayout.activeWidgets
    : namedEditMode
    ? namedDraftWidgets
    : savedNamedWidgets;
  const canCustomize = isPersonalMode
    ? can("dashboard.customize")
    : canEditNamedActive;
  const cloudSyncState = isPersonalMode
    ? personalLayout.cloudSyncState
    : namedSyncState;

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [managerModal, setManagerModal] = useState({
    open: false,
    mode: "directory",
    target: null,
  });

  /* ── @dnd-kit Sensors ── */
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

  const handleEnterEditMode = () => {
    if (!canCustomize) return;
    if (isPersonalMode) {
      personalLayout.enterEditMode();
    } else {
      setNamedDraftWidgets(savedNamedWidgets);
      setNamedEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    if (isPersonalMode) {
      personalLayout.cancelEditMode();
    } else {
      setNamedDraftWidgets(savedNamedWidgets);
      setNamedEditMode(false);
    }
  };

  const handleSaveEdit = async () => {
    if (isPersonalMode) {
      await personalLayout.saveEditMode();
      showToast(
        isAr
          ? "تم حفظ تخطيط لوحتك الخاصة ومزامنته"
          : "Personal dashboard layout saved and synced",
        "success"
      );
    } else if (activeDashboard) {
      await saveDashboardWidgets(activeDashboard.id, namedDraftWidgets);
      setNamedEditMode(false);
      showToast(
        isAr
          ? `تم حفظ تخطيط "${activeDashboard.nameAr || activeDashboard.name}" ومزامنته`
          : `Saved layout for "${activeDashboard.name}"`,
        "success"
      );
    }
  };

  const handleDragStart = (event) => {
    setDraggingId(event.active?.id || null);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!active || !over || active.id === over.id) return;

    if (isPersonalMode) {
      personalLayout.reorderWidgets(active.id, over.id);
      if (!editMode) {
        showToast(
          isAr
            ? "تم حفظ ترتيب البطاقات تلقائياً"
            : "Dashboard card order saved automatically",
          "success"
        );
      }
    } else if (namedEditMode) {
      setNamedDraftWidgets((prev) => {
        const oldIdx = prev.findIndex((w) => w.id === active.id);
        const newIdx = prev.findIndex((w) => w.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return prev;
        return arrayMove(prev, oldIdx, newIdx);
      });
    } else if (canCustomize && activeDashboard) {
      const oldIdx = savedNamedWidgets.findIndex((w) => w.id === active.id);
      const newIdx = savedNamedWidgets.findIndex((w) => w.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const nextOrder = arrayMove(savedNamedWidgets, oldIdx, newIdx);
        await saveDashboardWidgets(activeDashboard.id, nextOrder);
        showToast(
          isAr
            ? "تم حفظ ترتيب البطاقات تلقائياً"
            : "Dashboard card order saved automatically",
          "success"
        );
      }
    }
  };

  const handleRemoveWidget = (widgetId) => {
    if (isPersonalMode) {
      personalLayout.removeWidget(widgetId);
    } else {
      setNamedDraftWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    }
  };

  const handleAddWidget = (widgetId, sizeOverride) => {
    if (isPersonalMode) {
      personalLayout.addWidget(widgetId, sizeOverride);
    } else {
      const def = WIDGETS_BY_ID[widgetId];
      if (!def) return;
      setNamedDraftWidgets((prev) => {
        if (prev.some((w) => w.id === widgetId)) return prev;
        return [
          ...prev,
          { id: widgetId, size: sizeOverride || def.defaultSize || "medium" },
        ];
      });
    }
  };

  const handleResizeWidget = (widgetId, nextSize) => {
    if (isPersonalMode) {
      personalLayout.resizeWidget(widgetId, nextSize);
    } else {
      setNamedDraftWidgets((prev) =>
        prev.map((w) => (w.id === widgetId ? { ...w, size: nextSize } : w))
      );
    }
  };

  const handleApplyPreset = (presetKey, immediateSave = false) => {
    if (isPersonalMode) {
      personalLayout.applyPreset(presetKey, immediateSave);
    } else {
      const items =
        presetKey === "default"
          ? DASHBOARD_PRESETS.operations.items
          : DASHBOARD_PRESETS[presetKey]?.items ||
            DASHBOARD_PRESETS.operations.items;
      setNamedDraftWidgets(sanitizeNamedWidgetList(items, can));
    }
  };

  /* ── Shared Props Passed to Every Widget ── */
  const widgetSharedProps = useMemo(
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
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
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
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div
          className="h-24 rounded-xl animate-pulse"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {[12, 6, 6, 4, 4, 4].map((span, idx) => (
            <div
              key={idx}
              className={`h-48 rounded-xl animate-pulse col-span-1 md:col-span-1 ${
                span === 12
                  ? "md:col-span-2 lg:col-span-12"
                  : span === 6
                  ? "lg:col-span-6"
                  : "lg:col-span-4"
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Top Header Bar ═══ */}
      <div
        className="rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              className="text-lg sm:text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {activeDashboard
                ? isAr
                  ? activeDashboard.nameAr || activeDashboard.name
                  : activeDashboard.name || activeDashboard.nameAr
                : t?.dashboard || (isAr ? "لوحة التحكم" : "Dashboard")}
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono tabular-nums"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {cloudSyncState === "syncing" ? (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {isAr ? "مزامنة التخطيط..." : "Syncing layout..."}
                </span>
              ) : cloudSyncState === "synced" ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  {isAr ? "متزامن سحابياً" : "Synced"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {isAr ? "محفوظ محلياً" : "Saved locally"}
                </span>
              )}
            </span>
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t?.loggedInAs || (isAr ? "المستخدم الحالي" : "Logged in as")}:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {user?.fullName || user?.username || "User"}
            </strong>{" "}
            · {getRoleLabel(user?.role, lang)}
            {canCustomize && !editMode && (
              <span className="hidden sm:inline ms-2 opacity-75">
                ·{" "}
                {isAr
                  ? "اضغط مطولاً على أي بطاقة لسحبها أو اختر تخصيص"
                  : "Press & hold any card to reorder, or click Customize"}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden xl:block me-1">
            <LiveClock />
          </div>

          {/* Direct Shortcut to Quality Management Module */}
          {!editMode && can("quality.view") && (
            <button
              type="button"
              onClick={() => setTab?.("quality_management")}
              className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-85 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <ShieldCheck
                className="w-3.5 h-3.5"
                style={{ color: "var(--brand-primary)" }}
              />
              {isAr ? "إدارة الجودة" : "Quality Management"}
            </button>
          )}

          {/* Quick View Switcher (Operations / Quality Preset) in Personal Mode */}
          {!editMode && isPersonalMode && can("dashboard.quality_view") && (
            <div
              className="flex items-center rounded-lg p-0.5 text-xs"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <button
                type="button"
                onClick={() => handleApplyPreset("default", true)}
                className="px-2.5 py-1.5 rounded-md font-semibold transition whitespace-nowrap"
                style={
                  personalLayout.activePreset === "default" ||
                  personalLayout.activePreset === "operations"
                    ? {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--brand-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                {isAr ? "العمليات" : "Operations"}
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("quality", true)}
                className="px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1 transition whitespace-nowrap"
                style={
                  personalLayout.activePreset === "quality"
                    ? {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--brand-primary)",
                        boxShadow: "var(--shadow-sm)",
                      }
                    : { color: "var(--text-muted)" }
                }
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isAr ? "عرض الجودة" : "Quality"}
              </button>
            </div>
          )}

          {/* ⚙️ Customize Button */}
          {canCustomize && !editMode && (
            <button
              type="button"
              onClick={handleEnterEditMode}
              className="px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white transition hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Settings className="w-4 h-4" />
              {isAr ? "تخصيص" : "Customize"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Multi-Named Dashboards Switcher & Permissions Bar ═══ */}
      <NamedDashboardBar
        dashboards={visibleDashboards}
        selectedId={selectedId}
        onSelect={selectDashboard}
        allowPersonalOption={true}
        personalLabelEn="My Personal View"
        personalLabelAr="لوحتي الخاصة"
        canManage={canManageNamed}
        canEditActive={canEditNamedActive}
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

      {/* ═══ Sticky Edit Mode Toolbar (وضع التحرير) ═══ */}
      {editMode && (
        <div
          className="sticky top-16 z-30 rounded-xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 shadow-lg"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "2px solid var(--brand-primary)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <GripVertical className="w-4 h-4" />
            </div>
            <div>
              <div
                className="text-xs sm:text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {activeDashboard
                  ? isAr
                    ? `تحرير اللوحة المسماة: ${
                        activeDashboard.nameAr || activeDashboard.name
                      }`
                    : `Editing Named Board: ${
                        activeDashboard.name || activeDashboard.nameAr
                      }`
                  : isAr
                  ? "وضع التحرير نشط — خصّص لوحة التحكم الخاصة بك"
                  : "Edit Mode Active — Customize Your Dashboard"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "اسحب البطاقات من (⠿)، غيّر الحجم (S/M/L)، احذف (🗑️) أو أضف من المكتبة"
                  : "Drag cards via (⠿), resize (S/M/L), remove (🗑️), or add from library"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* [+ إضافة] Add Widget from Library */}
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition hover:opacity-90"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--brand-primary)",
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? "إضافة بطاقة" : "Add Widget"}
              {unaddedCount > 0 && (
                <span
                  className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {unaddedCount}
                </span>
              )}
            </button>

            {/* Reset to Default */}
            <button
              type="button"
              onClick={() => handleApplyPreset("default", false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition hover:opacity-85"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
              title={isAr ? "استعادة الترتيب الافتراضي" : "Reset to default"}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isAr ? "افتراضي" : "Reset"}
              </span>
            </button>

            {/* [✓ حفظ] Save Layout */}
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white transition"
            >
              <Check className="w-4 h-4" />
              {isAr ? "حفظ" : "Save"}
            </button>

            {/* [✕] Exit without saving */}
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition"
              title={isAr ? "إلغاء والخروج بدون حفظ" : "Exit without saving"}
              aria-label="Cancel edit mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Draggable Responsive Widgets Grid ═══ */}
      {activeWidgets.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px dashed var(--border-default)",
          }}
        >
          <Layers
            className="w-10 h-10 mx-auto opacity-50"
            style={{ color: "var(--brand-primary)" }}
          />
          <div
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {isAr
              ? "لوحة التحكم فارغة حالياً"
              : "Your dashboard has no active widgets"}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? "أضف بطاقات من مكتبة البطاقات أو استعد التخطيط الافتراضي لدورك الوظيفي."
              : "Add widgets from the library or restore your role's default layout."}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {canCustomize && (
              <button
                type="button"
                onClick={() => {
                  if (!editMode) handleEnterEditMode();
                  setLibraryOpen(true);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" />
                {isAr ? "فتح مكتبة البطاقات" : "Open Widgets Library"}
              </button>
            )}
            {canCustomize && (
              <button
                type="button"
                onClick={() => handleApplyPreset("default", !editMode)}
                className="px-4 py-2 rounded-lg text-xs font-semibold"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                {isAr ? "استعادة الافتراضي" : "Restore Default"}
              </button>
            )}
          </div>
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
                    canCustomize={canCustomize}
                    onRemove={handleRemoveWidget}
                    onResize={handleResizeWidget}
                    lang={lang}
                    widgetProps={widgetSharedProps}
                  />
                );
              })}

              {/* [+ Add Widget] Tile inside grid during Edit Mode */}
              {editMode && (
                <button
                  type="button"
                  onClick={() => setLibraryOpen(true)}
                  className="col-span-1 md:col-span-1 lg:col-span-4 min-h-[160px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 p-6 transition hover:opacity-85"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                    color: "var(--brand-primary)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold">
                    {isAr
                      ? "+ إضافة بطاقة من المكتبة"
                      : "+ Add Widget from Library"}
                  </span>
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
                widgetProps={widgetSharedProps}
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
        onAddWidget={handleAddWidget}
        onRemoveWidget={handleRemoveWidget}
        onApplyPreset={(presetKey) => handleApplyPreset(presetKey, false)}
        can={can}
        lang={lang}
      />

      {/* ═══ Named Dashboards & Permissions Modal ═══ */}
      <NamedDashboardModal
        open={managerModal.open}
        mode={managerModal.mode}
        initialDashboard={managerModal.target}
        defaultScope="main"
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

export default Dashboard;
