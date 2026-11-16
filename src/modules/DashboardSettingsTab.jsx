/* ═══════════════════════════════════════════════════════════
 * DASHBOARD SETTINGS TAB — Settings-Only Dashboard Builder & RBAC
 * Create, name (AR/EN), configure access roles/users, and arrange
 * widgets exclusively from System Settings.
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
  LayoutDashboard,
  Plus,
  Save,
  Copy,
  Trash2,
  Shield,
  Lock,
  Globe,
  Search,
  Check,
  Eye,
  Edit3,
  Layers,
  Star,
  Cloud,
  HardDrive,
  RefreshCw,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import {
  can as checkPerm,
  ROLE_TEMPLATES,
} from "../config/permissions";
import { confirmAction, showToast } from "../utils/dialog";
import {
  WIDGETS_BY_ID,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
} from "../dashboard/widgetRegistry";
import {
  useNamedDashboards,
  getPresetWidgetsByKey,
  sanitizeNamedWidgetList,
} from "../dashboard/useNamedDashboards";
import {
  SortableWidgetCard,
  WidgetDragOverlayCard,
} from "../dashboard/SortableWidgetCard";
import { WidgetLibraryModal } from "../dashboard/WidgetLibraryModal";

const SCOPE_OPTIONS = [
  { id: "main", label_en: "Main Dashboard", label_ar: "لوحة التحكم الرئيسية" },
  { id: "quality", label_en: "Quality Management", label_ar: "إدارة الجودة" },
  { id: "camo", label_en: "CAMO Airworthiness", label_ar: "إدارة الصلاحية (CAMO)" },
  { id: "training", label_en: "Crew Training", label_ar: "التدريب والتأهيل" },
  { id: "both", label_en: "Main & Quality", label_ar: "الرئيسية والجودة معاً" },
];

const SCOPE_FILTER_TABS = [
  { id: "all", label_en: "All Boards", label_ar: "الكل" },
  { id: "main", label_en: "Main", label_ar: "الرئيسية" },
  { id: "quality", label_en: "Quality", label_ar: "الجودة" },
  { id: "camo", label_en: "CAMO", label_ar: "CAMO" },
  { id: "training", label_en: "Training", label_ar: "التدريب" },
];

function getScopeLabel(scopeId, isAr) {
  const item = SCOPE_OPTIONS.find((s) => s.id === scopeId) || SCOPE_OPTIONS[0];
  return isAr ? item.label_ar : item.label_en;
}

function getTabForScope(scopeId) {
  if (scopeId === "quality") return "quality";
  if (scopeId === "camo") return "camo";
  if (scopeId === "training") return "training";
  return "dashboard";
}

export function DashboardSettingsTab({
  roles = [],
  users = [],
  flights = [],
  crew = [],
  fleet = [],
  camoList = [],
  melList = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  setTab,
  lang: langProp,
}) {
  const { user } = useAuth();
  const lang =
    langProp ||
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

  const canManageDashboards =
    can("settings.dashboards_manage") ||
    can("dashboard.manage_named") ||
    can("quality.manage_dashboards") ||
    can("camo.manage_dashboards") ||
    can("training.manage_dashboards") ||
    can("users.perms");

  const {
    allDashboards,
    syncState,
    createDashboard,
    updateDashboard,
    duplicateDashboard,
    deleteDashboard,
  } = useNamedDashboards({
    scope: "main",
    user,
    can,
    allowPersonalOption: false,
  });

  const [scopeFilter, setScopeFilter] = useState("all");
  const [boardSearch, setBoardSearch] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    description: "",
    scope: "main",
    visibility: "restricted",
    viewRoles: ["superAdmin", "dispatcher", "captain"],
    editRoles: ["superAdmin", "dispatcher"],
    viewUsers: [],
    editUsers: [],
    isDefault: false,
    widgets: [],
  });

  const filteredBoards = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    return allDashboards.filter((d) => {
      if (scopeFilter !== "all" && d.scope !== scopeFilter && d.scope !== "both") {
        return false;
      }
      if (!q) return true;
      return (
        String(d.name || "").toLowerCase().includes(q) ||
        String(d.nameAr || "").toLowerCase().includes(q) ||
        String(d.description || "").toLowerCase().includes(q)
      );
    });
  }, [allDashboards, scopeFilter, boardSearch]);

  const selectedBoard = useMemo(
    () => allDashboards.find((d) => d.id === selectedBoardId) || null,
    [allDashboards, selectedBoardId]
  );

  const loadBoardIntoForm = useCallback(
    (dash) => {
      if (!dash) return;
      setIsCreating(false);
      setSelectedBoardId(dash.id);
      setForm({
        name: dash.name || "",
        nameAr: dash.nameAr || "",
        description: dash.description || "",
        scope: dash.scope || "main",
        visibility: dash.visibility === "all" ? "all" : "restricted",
        viewRoles: Array.isArray(dash.viewRoles) ? [...dash.viewRoles] : [],
        editRoles: Array.isArray(dash.editRoles) ? [...dash.editRoles] : [],
        viewUsers: Array.isArray(dash.viewUsers) ? [...dash.viewUsers] : [],
        editUsers: Array.isArray(dash.editUsers) ? [...dash.editUsers] : [],
        isDefault: Boolean(dash.isDefault),
        widgets: sanitizeNamedWidgetList(dash.widgets, can),
      });
    },
    [can]
  );

  useEffect(() => {
    if (isCreating) return;
    if (!selectedBoardId || !allDashboards.some((d) => d.id === selectedBoardId)) {
      const first = filteredBoards[0] || allDashboards[0];
      if (first) {
        loadBoardIntoForm(first);
      }
    }
  }, [allDashboards, filteredBoards, selectedBoardId, isCreating, loadBoardIntoForm]);

  const handleStartNew = () => {
    const targetScope = scopeFilter !== "all" ? scopeFilter : "main";
    const defaultPreset =
      targetScope === "quality"
        ? "quality"
        : targetScope === "camo"
        ? "camo"
        : targetScope === "training"
        ? "training"
        : "operations";

    setIsCreating(true);
    setSelectedBoardId("");
    setForm({
      name: "",
      nameAr: "",
      description: "",
      scope: targetScope,
      visibility: "restricted",
      viewRoles:
        targetScope === "quality" || targetScope === "camo"
          ? ["superAdmin", "dispatcher", "camo", "captain"]
          : ["superAdmin", "dispatcher", "captain"],
      editRoles:
        targetScope === "camo"
          ? ["superAdmin", "camo", "dispatcher"]
          : ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      widgets: sanitizeNamedWidgetList(getPresetWidgetsByKey(defaultPreset), can),
    });
  };

  /* ── Unified Role Options ── */
  const unifiedRoleOptions = useMemo(() => {
    const map = new Map();
    Object.entries(ROLE_TEMPLATES).forEach(([key, tpl]) => {
      map.set(key.toLowerCase(), {
        key,
        labelEn: tpl.label_en || key,
        labelAr: tpl.label_ar || key,
        isSuper: key === "superAdmin",
      });
    });
    (Array.isArray(roles) ? roles : []).forEach((r) => {
      if (!r?.name) return;
      const norm = String(r.name).trim().toLowerCase();
      if (!map.has(norm)) {
        map.set(norm, {
          key: r.name,
          labelEn: r.name,
          labelAr: r.nameAr || r.name,
          isSuper: norm === "superadmin",
        });
      }
    });
    return Array.from(map.values());
  }, [roles]);

  const filteredUsers = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        String(u.fullName || "").toLowerCase().includes(q) ||
        String(u.username || "").toLowerCase().includes(q) ||
        String(u.role || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const hasRoleIn = (arr, roleKey) =>
    (arr || []).some((r) => String(r).toLowerCase() === String(roleKey).toLowerCase());

  const toggleRoleView = (roleKey) => {
    if (!canManageDashboards) return;
    setForm((prev) => {
      const exists = hasRoleIn(prev.viewRoles, roleKey);
      if (exists) {
        return {
          ...prev,
          viewRoles: prev.viewRoles.filter(
            (r) => String(r).toLowerCase() !== String(roleKey).toLowerCase()
          ),
          editRoles: prev.editRoles.filter(
            (r) => String(r).toLowerCase() !== String(roleKey).toLowerCase()
          ),
        };
      }
      return { ...prev, viewRoles: [...prev.viewRoles, roleKey] };
    });
  };

  const toggleRoleEdit = (roleKey) => {
    if (!canManageDashboards) return;
    setForm((prev) => {
      const exists = hasRoleIn(prev.editRoles, roleKey);
      if (exists) {
        return {
          ...prev,
          editRoles: prev.editRoles.filter(
            (r) => String(r).toLowerCase() !== String(roleKey).toLowerCase()
          ),
        };
      }
      const nextView = hasRoleIn(prev.viewRoles, roleKey)
        ? prev.viewRoles
        : [...prev.viewRoles, roleKey];
      return { ...prev, viewRoles: nextView, editRoles: [...prev.editRoles, roleKey] };
    });
  };

  const getUserToken = (u) =>
    String(u?.username || u?.id || "").trim().toLowerCase();

  const hasUserIn = (arr, u) => {
    const tok = getUserToken(u);
    const uid = String(u?.id || "").trim().toLowerCase();
    return (arr || []).some((entry) => {
      const n = String(entry || "").trim().toLowerCase();
      return (tok && n === tok) || (uid && n === uid);
    });
  };

  const toggleUserView = (u) => {
    if (!canManageDashboards) return;
    const tok = getUserToken(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.viewUsers, u);
      if (exists) {
        return {
          ...prev,
          viewUsers: prev.viewUsers.filter((x) => String(x).toLowerCase() !== tok),
          editUsers: prev.editUsers.filter((x) => String(x).toLowerCase() !== tok),
        };
      }
      return { ...prev, viewUsers: [...prev.viewUsers, tok] };
    });
  };

  const toggleUserEdit = (u) => {
    if (!canManageDashboards) return;
    const tok = getUserToken(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.editUsers, u);
      if (exists) {
        return {
          ...prev,
          editUsers: prev.editUsers.filter((x) => String(x).toLowerCase() !== tok),
        };
      }
      const nextView = hasUserIn(prev.viewUsers, u)
        ? prev.viewUsers
        : [...prev.viewUsers, tok];
      return { ...prev, viewUsers: nextView, editUsers: [...prev.editUsers, tok] };
    });
  };

  /* ── Widget Builder Handlers ── */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setDraggingId(event.active?.id || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!active || !over || active.id === over.id) return;
    setForm((prev) => {
      const oldIdx = prev.widgets.findIndex((w) => w.id === active.id);
      const newIdx = prev.widgets.findIndex((w) => w.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return { ...prev, widgets: arrayMove(prev.widgets, oldIdx, newIdx) };
    });
  };

  const handleAddWidget = (widgetId, sizeOverride) => {
    const def = WIDGETS_BY_ID[widgetId];
    if (!def) return;
    setForm((prev) => {
      if (prev.widgets.some((w) => w.id === widgetId)) return prev;
      return {
        ...prev,
        widgets: [
          ...prev.widgets,
          { id: widgetId, size: sizeOverride || def.defaultSize || "medium" },
        ],
      };
    });
  };

  const handleRemoveWidget = (widgetId) => {
    setForm((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== widgetId),
    }));
  };

  const handleResizeWidget = (widgetId, nextSize) => {
    setForm((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, size: nextSize } : w
      ),
    }));
  };

  const handleApplyPreset = (presetKey) => {
    const key =
      presetKey && presetKey !== "default"
        ? presetKey
        : form.scope === "quality"
        ? "quality"
        : form.scope === "camo"
        ? "camo"
        : form.scope === "training"
        ? "training"
        : "operations";
    const items = getPresetWidgetsByKey(key);
    setForm((prev) => ({
      ...prev,
      widgets: sanitizeNamedWidgetList(items, can),
    }));
  };

  /* ── Save / Duplicate / Delete ── */
  const handleSave = async () => {
    if (!canManageDashboards) return;
    const cleanName = String(form.name || form.nameAr || "").trim();
    const cleanNameAr = String(form.nameAr || form.name || "").trim();
    if (!cleanName && !cleanNameAr) {
      showToast(
        isAr ? "يرجى إدخال اسم اللوحة أولاً" : "Please enter a dashboard name",
        "warning"
      );
      return;
    }
    setSaving(true);
    try {
      const cleanWidgets = form.widgets.map((w) => ({
        id: w.id,
        size: w.size || "medium",
      }));
      if (isCreating || !selectedBoard) {
        const created = await createDashboard({
          name: cleanName,
          nameAr: cleanNameAr,
          description: form.description,
          scope: form.scope,
          widgets: cleanWidgets,
          visibility: form.visibility,
          viewRoles: form.viewRoles,
          editRoles: form.editRoles,
          viewUsers: form.viewUsers,
          editUsers: form.editUsers,
          isDefault: form.isDefault,
        });
        if (created) {
          setIsCreating(false);
          setSelectedBoardId(created.id);
        }
        showToast(
          isAr
            ? "✅ تم إنشاء اللوحة وتسميتها وحفظ البطاقات والصلاحيات"
            : "✅ Dashboard created and synced",
          "success"
        );
      } else {
        await updateDashboard(selectedBoard.id, {
          name: cleanName,
          nameAr: cleanNameAr,
          description: form.description,
          scope: form.scope,
          widgets: cleanWidgets,
          visibility: form.visibility,
          viewRoles: form.viewRoles,
          editRoles: form.editRoles,
          viewUsers: form.viewUsers,
          editUsers: form.editUsers,
          isDefault: form.isDefault,
        });
        showToast(
          isAr
            ? "✅ تم حفظ تعديلات اللوحة وعرضها في الداشبورد"
            : "✅ Dashboard customization saved",
          "success"
        );
      }
    } catch (err) {
      showToast(
        (isAr ? "❌ تعذر الحفظ: " : "❌ Save failed: ") + (err?.message || ""),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (dash) => {
    if (!canManageDashboards || !dash) return;
    const dup = await duplicateDashboard(dash.id);
    if (dup) {
      loadBoardIntoForm(dup);
      showToast(isAr ? "✅ تم نسخ اللوحة" : "✅ Dashboard duplicated", "success");
    }
  };

  const handleDelete = async (dash) => {
    if (!canManageDashboards || !dash) return;
    const label = isAr ? dash.nameAr || dash.name : dash.name || dash.nameAr;
    const ok = await confirmAction(
      isAr
        ? `هل تريد حذف اللوحة "${label}" نهائياً؟`
        : `Permanently delete dashboard "${label}"?`,
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      "danger"
    );
    if (!ok) return;
    await deleteDashboard(dash.id);
    if (selectedBoardId === dash.id) {
      setSelectedBoardId("");
    }
    showToast(isAr ? "🗑️ تم حذف اللوحة" : "🗑️ Dashboard deleted", "info");
  };

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
      auditLogs,
      loginHistory,
      settings,
      setTab,
      can,
      lang,
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
      auditLogs,
      loginHistory,
      settings,
      setTab,
      can,
      lang,
    ]
  );

  const draggingItem = useMemo(() => {
    if (!draggingId) return null;
    const item = form.widgets.find((w) => w.id === draggingId);
    const def = WIDGETS_BY_ID[draggingId];
    return def ? { def, size: item?.size || def.defaultSize } : null;
  }, [draggingId, form.widgets]);

  return (
    <div className="space-y-4">
      {/* Header Strip */}
      <div
        className="rounded-xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ background: "var(--brand-gradient)" }}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3
              className="text-sm sm:text-base font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {isAr
                ? "إدارة وتخصيص وتسمية لوحات التحكم"
                : "Dashboard Builder, Naming & Access Control"}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "يتم إنشاء كل لوحة وتسميتها وتحديد صلاحياتها وترتيب بطاقاتها هنا في الإعدادات فقط، ثم تُعرض مباشرة في الداشبورد العادي."
                : "Create, name, assign permissions, and arrange cards here in Settings; configured boards render read-only in the live dashboards."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className="text-[11px] font-mono tabular-nums inline-flex items-center gap-1 px-2.5 py-1 rounded-lg"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            {syncState === "syncing" ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                {isAr ? "مزامنة..." : "Syncing..."}
              </>
            ) : syncState === "synced" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Cloud className="w-3 h-3" />
                {isAr ? "متزامن سحابياً" : "Synced"}
              </span>
            ) : (
              <>
                <HardDrive className="w-3 h-3" />
                {isAr ? "محفوظ محلياً" : "Local"}
              </>
            )}
          </span>

          {canManageDashboards && (
            <button
              type="button"
              onClick={handleStartNew}
              className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? "إنشاء لوحة جديدة" : "New Dashboard"}
            </button>
          )}
        </div>
      </div>

      {/* Master-Detail Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left Sidebar: All Dashboards List */}
        <div
          className="xl:col-span-4 rounded-xl p-3 space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}
        >
          {/* Scope Segmented Tabs */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg overflow-x-auto"
            style={{ backgroundColor: "var(--bg-app)" }}
          >
            {SCOPE_FILTER_TABS.map((sc) => {
              const active = scopeFilter === sc.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setScopeFilter(sc.id)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition"
                  style={
                    active
                      ? {
                          backgroundColor: "var(--bg-card)",
                          color: "var(--brand-primary)",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {isAr ? sc.label_ar : sc.label_en}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              placeholder={isAr ? "بحث عن لوحة..." : "Search dashboards..."}
              className="w-full ps-8 pe-3 py-1.5 rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-[540px] overflow-y-auto">
            {filteredBoards.map((dash) => {
              const isSelected = !isCreating && selectedBoardId === dash.id;
              const title = isAr
                ? dash.nameAr || dash.name
                : dash.name || dash.nameAr;
              const widgetCount = Array.isArray(dash.widgets)
                ? dash.widgets.length
                : 0;
              return (
                <div
                  key={dash.id}
                  className="rounded-lg p-2.5 transition flex items-start justify-between gap-2 cursor-pointer"
                  style={{
                    backgroundColor: isSelected
                      ? "rgba(37, 99, 235, 0.08)"
                      : "var(--bg-app)",
                    border: isSelected
                      ? "1px solid var(--brand-primary)"
                      : "1px solid var(--border-default)",
                  }}
                  onClick={() => loadBoardIntoForm(dash)}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      {dash.visibility === "all" ? (
                        <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span
                        className="text-xs font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {title}
                      </span>
                      {dash.isDefault && (
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <div
                      className="text-[11px] flex items-center gap-1.5 flex-wrap font-mono tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{getScopeLabel(dash.scope, isAr)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {widgetCount} {isAr ? "بطاقات" : "widgets"}
                      </span>
                    </div>
                  </div>

                  {canManageDashboards && (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleDuplicate(dash)}
                        className="p-1.5 rounded-md hover:opacity-80 transition"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-muted)",
                        }}
                        title={isAr ? "نسخ اللوحة" : "Duplicate"}
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(dash)}
                        className="p-1.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition"
                        title={isAr ? "حذف اللوحة" : "Delete"}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredBoards.length === 0 && (
              <div
                className="py-8 text-center text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                {isAr ? "لا توجد لوحات مطابقة" : "No dashboards match filter"}
              </div>
            )}
          </div>
        </div>

        {/* Right Detail: Naming, Permissions & Widget Builder */}
        <div
          className="xl:col-span-8 rounded-xl p-4 sm:p-5 space-y-5"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}
        >
          {/* Editor Top Actions */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 pb-3"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <LayoutDashboard
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--brand-primary)" }}
              />
              <h4
                className="text-sm font-bold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {isCreating
                  ? isAr
                    ? "إنشاء لوحة جديدة"
                    : "Create New Dashboard"
                  : isAr
                  ? `تعديل وتسمية: ${selectedBoard?.nameAr || selectedBoard?.name || ""}`
                  : `Editing: ${selectedBoard?.name || ""}`}
              </h4>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {setTab && (
                <button
                  type="button"
                  onClick={() => setTab(getTabForScope(form.scope))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition hover:opacity-85"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isAr ? "معاينة في الداشبورد" : "Open Dashboard"}</span>
                </button>
              )}

              {canManageDashboards && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition disabled:opacity-50"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? isAr
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : isAr
                      ? "حفظ التخصيص والصلاحيات"
                      : "Save Customization"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ── 1. Naming & Scope ── */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-bold mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr ? "اسم اللوحة (بالعربية) *" : "Dashboard Name (Arabic) *"}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  disabled={!canManageDashboards}
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder={isAr ? "مثال: لوحة متابعة العمليات" : "e.g. لوحة متابعة العمليات"}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-bold mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr ? "اسم اللوحة (بالإنجليزية) *" : "Dashboard Name (English) *"}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  disabled={!canManageDashboards}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dispatch Shift Operations"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
              <div>
                <label
                  className="block text-xs font-bold mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr ? "القسم المعروضة فيه اللوحة" : "Target Dashboard Section"}
                </label>
                <select
                  disabled={!canManageDashboards}
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {SCOPE_OPTIONS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {isAr ? sc.label_ar : sc.label_en}
                    </option>
                  ))}
                </select>
              </div>

              <label
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-semibold"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  disabled={!canManageDashboards}
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 accent-sky-600"
                />
                <span>
                  {isAr
                    ? "تعيين كلوحة افتراضية لهذا القسم عند الفتح"
                    : "Set as default dashboard for this section"}
                </span>
              </label>
            </div>

            <div>
              <label
                className="block text-xs font-bold mb-1"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr ? "وصف مختصر (اختياري)" : "Description (Optional)"}
              </label>
              <input
                type="text"
                disabled={!canManageDashboards}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder={
                  isAr
                    ? "نبذة مختصرة عن هدف اللوحة ومؤشراتها..."
                    : "Short description of dashboard metrics and audience..."
                }
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* ── 2. Visibility & Permissions Matrix ── */}
          <div
            className="pt-4 space-y-3"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield
                  className="w-4 h-4"
                  style={{ color: "var(--brand-primary)" }}
                />
                <h5
                  className="text-xs font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr
                    ? "صلاحيات العرض والتعديل على اللوحة"
                    : "Dashboard Access Permissions"}
                </h5>
              </div>

              <div
                className="flex items-center gap-1 p-1 rounded-lg"
                style={{ backgroundColor: "var(--bg-app)" }}
              >
                <button
                  type="button"
                  disabled={!canManageDashboards}
                  onClick={() => setForm({ ...form, visibility: "restricted" })}
                  className="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition"
                  style={
                    form.visibility !== "all"
                      ? {
                          backgroundColor: "var(--bg-card)",
                          color: "var(--brand-primary)",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  <Lock className="w-3 h-3" />
                  {isAr ? "مقيدة بصلاحيات" : "Restricted"}
                </button>
                <button
                  type="button"
                  disabled={!canManageDashboards}
                  onClick={() => setForm({ ...form, visibility: "all" })}
                  className="px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition"
                  style={
                    form.visibility === "all"
                      ? {
                          backgroundColor: "var(--bg-card)",
                          color: "#16A34A",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  <Globe className="w-3 h-3" />
                  {isAr ? "متاحة للجميع" : "All Users"}
                </button>
              </div>
            </div>

            {form.visibility !== "all" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Roles */}
                <div
                  className="rounded-lg p-3 space-y-2"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div
                    className="text-xs font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isAr ? "حسب الدور الوظيفي" : "By Role"}
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {unifiedRoleOptions.map((r) => {
                      const canView = r.isSuper || hasRoleIn(form.viewRoles, r.key);
                      const canEdit = r.isSuper || hasRoleIn(form.editRoles, r.key);
                      return (
                        <div
                          key={r.key}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs"
                          style={{ backgroundColor: "var(--bg-card)" }}
                        >
                          <span
                            className="font-semibold truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {isAr ? r.labelAr : r.labelEn}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={!canManageDashboards || r.isSuper}
                              onClick={() => toggleRoleView(r.key)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition ${
                                canView
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                  : "border-transparent text-[var(--text-muted)]"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              {isAr ? "عرض" : "View"}
                            </button>
                            <button
                              type="button"
                              disabled={!canManageDashboards || r.isSuper}
                              onClick={() => toggleRoleEdit(r.key)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition ${
                                canEdit
                                  ? "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300"
                                  : "border-transparent text-[var(--text-muted)]"
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              {isAr ? "تعديل" : "Edit"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Users */}
                <div
                  className="rounded-lg p-3 space-y-2"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-xs font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isAr ? "مستخدمون محددون" : "Specific Users"}
                    </span>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={isAr ? "بحث..." : "Search..."}
                      className="px-2 py-1 rounded text-[11px] w-32 outline-none"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredUsers.slice(0, 40).map((u) => {
                      const canView = hasUserIn(form.viewUsers, u);
                      const canEdit = hasUserIn(form.editUsers, u);
                      return (
                        <div
                          key={u.id || u.username}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs"
                          style={{ backgroundColor: "var(--bg-card)" }}
                        >
                          <span
                            className="truncate font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {u.fullName || u.username}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={!canManageDashboards}
                              onClick={() => toggleUserView(u)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition ${
                                canView
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                                  : "border-transparent text-[var(--text-muted)]"
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              {isAr ? "عرض" : "View"}
                            </button>
                            <button
                              type="button"
                              disabled={!canManageDashboards}
                              onClick={() => toggleUserEdit(u)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 border transition ${
                                canEdit
                                  ? "bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300"
                                  : "border-transparent text-[var(--text-muted)]"
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              {isAr ? "تعديل" : "Edit"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <div
                        className="text-center py-6 text-[11px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {isAr ? "لا يوجد مستخدمون" : "No users found"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Widgets Layout & Customization Builder ── */}
          <div
            className="pt-4 space-y-3"
            style={{ borderTop: "1px solid var(--border-default)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5
                  className="text-xs font-bold flex items-center gap-1.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Layers
                    className="w-4 h-4"
                    style={{ color: "var(--brand-primary)" }}
                  />
                  <span>
                    {isAr
                      ? `بطاقات وتخطيط اللوحة (${form.widgets.length})`
                      : `Dashboard Widgets & Layout (${form.widgets.length})`}
                  </span>
                </h5>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "أضف بطاقات من المكتبة، اسحبها لإعادة الترتيب، وغيّر حجم كل بطاقة (S/M/L) ثم احفظ."
                    : "Add widgets, drag to reorder, and resize cards (S/M/L), then click Save."}
                </p>
              </div>

              {canManageDashboards && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.values(DASHBOARD_PRESETS).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.id)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition hover:opacity-85"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {isAr ? preset.label_ar : preset.label_en}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setLibraryOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? "إضافة بطاقة" : "Add Widget"}</span>
                  </button>
                </div>
              )}
            </div>

            {form.widgets.length === 0 ? (
              <div
                className="rounded-xl p-8 text-center space-y-2"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {isAr
                    ? "لا توجد بطاقات مضافة لهذه اللوحة بعد."
                    : "No widgets assigned to this dashboard yet."}
                </p>
                {canManageDashboards && (
                  <button
                    type="button"
                    onClick={() => setLibraryOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAr ? "فتح مكتبة البطاقات" : "Open Widgets Library"}
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
                  items={form.widgets.map((w) => w.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-stretch">
                    {form.widgets.map((item) => {
                      const def = WIDGETS_BY_ID[item.id];
                      if (!def || !canUserSeeWidget(def, can)) return null;
                      return (
                        <SortableWidgetCard
                          key={item.id}
                          widgetDef={def}
                          size={item.size || def.defaultSize}
                          editMode={canManageDashboards}
                          canCustomize={canManageDashboards}
                          onRemove={handleRemoveWidget}
                          onResize={handleResizeWidget}
                          lang={lang}
                          widgetProps={widgetSharedProps}
                        />
                      );
                    })}
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
          </div>
        </div>
      </div>

      {/* Widgets Library Modal */}
      <WidgetLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        activeWidgets={form.widgets}
        onAddWidget={handleAddWidget}
        onRemoveWidget={handleRemoveWidget}
        onApplyPreset={handleApplyPreset}
        can={can}
        lang={lang}
      />
    </div>
  );
}

export default DashboardSettingsTab;
