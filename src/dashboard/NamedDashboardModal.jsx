/* ═══════════════════════════════════════════════════════════
 * NAMED DASHBOARD MODAL — Create, Rename & Granular RBAC
 * Allows creating/storing multiple named dashboards, naming them
 * in AR/EN, and assigning View & Edit permissions per Role & User.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Save,
  Shield,
  Lock,
  Globe,
  Copy,
  Trash2,
  Edit3,
  Eye,
  Search,
  Check,
  FolderKanban,
  ArrowLeft,
  Star,
} from "lucide-react";
import { ROLE_TEMPLATES, getRoleLabel } from "../config/permissions";
import { confirmAction, showToast } from "../utils/dialog";

export function NamedDashboardModal({
  open,
  mode = "directory", // "directory" | "create" | "edit"
  initialDashboard = null,
  defaultScope = "quality",
  currentScreenWidgets = [],
  dashboards = [],
  roles = [],
  users = [],
  selectedId = "",
  onSelectDashboard,
  onCreateDashboard,
  onUpdateDashboard,
  onDuplicateDashboard,
  onDeleteDashboard,
  onClose,
  lang = "en",
}) {
  const isAr = lang === "ar";
  const [viewMode, setViewMode] = useState(mode);
  const [editingTarget, setEditingTarget] = useState(initialDashboard);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    description: "",
    scope: defaultScope,
    templateKey: "current",
    visibility: "restricted",
    viewRoles: ["superAdmin", "dispatcher", "camo", "captain"],
    editRoles: ["superAdmin", "dispatcher"],
    viewUsers: [],
    editUsers: [],
    isDefault: false,
  });

  useEffect(() => {
    if (!open) return;
    setViewMode(mode);
    setEditingTarget(initialDashboard || null);
    setUserSearch("");

    if (mode === "edit" && initialDashboard) {
      setForm({
        name: initialDashboard.name || "",
        nameAr: initialDashboard.nameAr || "",
        description: initialDashboard.description || "",
        scope: initialDashboard.scope || defaultScope,
        templateKey: "current",
        visibility: initialDashboard.visibility || "restricted",
        viewRoles: Array.isArray(initialDashboard.viewRoles)
          ? [...initialDashboard.viewRoles]
          : [],
        editRoles: Array.isArray(initialDashboard.editRoles)
          ? [...initialDashboard.editRoles]
          : [],
        viewUsers: Array.isArray(initialDashboard.viewUsers)
          ? [...initialDashboard.viewUsers]
          : [],
        editUsers: Array.isArray(initialDashboard.editUsers)
          ? [...initialDashboard.editUsers]
          : [],
        isDefault: Boolean(initialDashboard.isDefault),
      });
    } else if (mode === "create") {
      setForm({
        name: "",
        nameAr: "",
        description: "",
        scope: defaultScope,
        templateKey:
          currentScreenWidgets.length > 0
            ? "current"
            : defaultScope === "camo"
            ? "camo"
            : defaultScope === "training"
            ? "training"
            : "quality",
        visibility: "restricted",
        viewRoles:
          defaultScope === "quality" || defaultScope === "camo"
            ? ["superAdmin", "dispatcher", "camo", "captain"]
            : ["superAdmin", "dispatcher", "captain"],
        editRoles:
          defaultScope === "camo"
            ? ["superAdmin", "camo", "dispatcher"]
            : defaultScope === "quality"
            ? ["superAdmin", "dispatcher", "camo"]
            : ["superAdmin", "dispatcher"],
        viewUsers: [],
        editUsers: [],
        isDefault: false,
      });
    }
  }, [open, mode, initialDashboard, defaultScope, currentScreenWidgets.length]);

  // Unified list of all Roles (system templates + custom DB roles)
  const unifiedRoleOptions = useMemo(() => {
    const map = new Map();
    Object.entries(ROLE_TEMPLATES).forEach(([key, tpl]) => {
      map.set(key.toLowerCase(), {
        key,
        labelEn: tpl.label_en || key,
        labelAr: tpl.label_ar || key,
        icon: tpl.icon || "🔐",
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
          icon: "🔑",
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
        String(u.fullName || "")
          .toLowerCase()
          .includes(q) ||
        String(u.username || "")
          .toLowerCase()
          .includes(q) ||
        String(u.role || "")
          .toLowerCase()
          .includes(q)
    );
  }, [users, userSearch]);

  if (!open) return null;

  const hasRoleIn = (arr, roleKey) =>
    (arr || []).some(
      (r) => String(r).toLowerCase() === String(roleKey).toLowerCase()
    );

  const toggleRoleView = (roleKey) => {
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
      return {
        ...prev,
        viewRoles: [...prev.viewRoles, roleKey],
      };
    });
  };

  const toggleRoleEdit = (roleKey) => {
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
      return {
        ...prev,
        viewRoles: nextView,
        editRoles: [...prev.editRoles, roleKey],
      };
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
    const tok = getUserToken(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.viewUsers, u);
      if (exists) {
        return {
          ...prev,
          viewUsers: prev.viewUsers.filter(
            (x) => String(x).toLowerCase() !== tok
          ),
          editUsers: prev.editUsers.filter(
            (x) => String(x).toLowerCase() !== tok
          ),
        };
      }
      return {
        ...prev,
        viewUsers: [...prev.viewUsers, tok],
      };
    });
  };

  const toggleUserEdit = (u) => {
    const tok = getUserToken(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.editUsers, u);
      if (exists) {
        return {
          ...prev,
          editUsers: prev.editUsers.filter(
            (x) => String(x).toLowerCase() !== tok
          ),
        };
      }
      const nextView = hasUserIn(prev.viewUsers, u)
        ? prev.viewUsers
        : [...prev.viewUsers, tok];
      return {
        ...prev,
        viewUsers: nextView,
        editUsers: [...prev.editUsers, tok],
      };
    });
  };

  const startCreate = () => {
    setEditingTarget(null);
    setForm({
      name: "",
      nameAr: "",
      description: "",
      scope: defaultScope,
      templateKey:
        currentScreenWidgets.length > 0
          ? "current"
          : defaultScope === "camo"
          ? "camo"
          : defaultScope === "training"
          ? "training"
          : "quality",
      visibility: "restricted",
      viewRoles:
        defaultScope === "quality" || defaultScope === "camo"
          ? ["superAdmin", "dispatcher", "camo", "captain"]
          : ["superAdmin", "dispatcher", "captain"],
      editRoles:
        defaultScope === "camo"
          ? ["superAdmin", "camo", "dispatcher"]
          : defaultScope === "quality"
          ? ["superAdmin", "dispatcher", "camo"]
          : ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
    });
    setViewMode("create");
  };

  const startEdit = (dash) => {
    setEditingTarget(dash);
    setForm({
      name: dash.name || "",
      nameAr: dash.nameAr || "",
      description: dash.description || "",
      scope: dash.scope || defaultScope,
      templateKey: "current",
      visibility: dash.visibility || "restricted",
      viewRoles: Array.isArray(dash.viewRoles) ? [...dash.viewRoles] : [],
      editRoles: Array.isArray(dash.editRoles) ? [...dash.editRoles] : [],
      viewUsers: Array.isArray(dash.viewUsers) ? [...dash.viewUsers] : [],
      editUsers: Array.isArray(dash.editUsers) ? [...dash.editUsers] : [],
      isDefault: Boolean(dash.isDefault),
    });
    setViewMode("edit");
  };

  const handleSaveForm = async (e) => {
    e?.preventDefault();
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
      if (viewMode === "create") {
        const widgetsPayload =
          form.templateKey === "current" && currentScreenWidgets.length > 0
            ? currentScreenWidgets
            : undefined;
        await onCreateDashboard?.({
          name: cleanName,
          nameAr: cleanNameAr,
          description: form.description,
          scope: form.scope,
          templateKey: form.templateKey,
          widgets: widgetsPayload,
          visibility: form.visibility,
          viewRoles: form.viewRoles,
          editRoles: form.editRoles,
          viewUsers: form.viewUsers,
          editUsers: form.editUsers,
          isDefault: form.isDefault,
        });
        showToast(
          isAr
            ? "✅ تم إنشاء اللوحة وحفظ صلاحياتها ومزامنتها سحابياً"
            : "✅ Named dashboard created and permissions synced",
          "success"
        );
      } else if (viewMode === "edit" && editingTarget) {
        await onUpdateDashboard?.(editingTarget.id, {
          name: cleanName,
          nameAr: cleanNameAr,
          description: form.description,
          scope: form.scope,
          visibility: form.visibility,
          viewRoles: form.viewRoles,
          editRoles: form.editRoles,
          viewUsers: form.viewUsers,
          editUsers: form.editUsers,
          isDefault: form.isDefault,
        });
        showToast(
          isAr
            ? "✅ تم تحديث اسم اللوحة وصلاحيات الوصول بنجاح"
            : "✅ Dashboard name & permissions updated",
          "success"
        );
      }
      onClose?.();
    } catch (err) {
      showToast(
        (isAr ? "❌ تعذر الحفظ: " : "❌ Save failed: ") +
          (err?.message || "Error"),
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dash) => {
    const title = isAr ? dash.nameAr || dash.name : dash.name || dash.nameAr;
    const ok = await confirmAction(
      isAr
        ? `هل أنت متأكد من حذف اللوحة "${title}"؟`
        : `Delete named dashboard "${title}"?`
    );
    if (!ok) return;
    await onDeleteDashboard?.(dash.id);
    showToast(
      isAr ? "تم حذف اللوحة بنجاح" : "Dashboard deleted",
      "success"
    );
  };

  const handleDuplicate = async (dash) => {
    await onDuplicateDashboard?.(dash.id);
    showToast(
      isAr ? "✅ تم نسخ اللوحة بنجاح" : "✅ Dashboard duplicated",
      "success"
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-default)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {viewMode !== "directory" && dashboards.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode("directory")}
                className="p-1.5 rounded-lg transition hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
                title={isAr ? "العودة لقائمة اللوحات" : "Back to all dashboards"}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--brand-primary)",
              }}
            >
              {viewMode === "directory" ? (
                <FolderKanban className="w-5 h-5" />
              ) : (
                <Shield className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">
                {viewMode === "directory"
                  ? isAr
                    ? "إدارة اللوحات المحفوظة وصلاحياتها"
                    : "Manage Named Dashboards & Permissions"
                  : viewMode === "create"
                  ? isAr
                    ? "إنشاء لوحة تحكم جديدة وتخصيص صلاحياتها"
                    : "Create Named Dashboard & Assign Permissions"
                  : isAr
                  ? "تعديل اسم اللوحة وصلاحيات الوصول"
                  : "Edit Dashboard Name & Permissions"}
              </h3>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {viewMode === "directory"
                  ? isAr
                    ? "تخزين أكثر من داشبورد وتسميتها ومنح صلاحيات عرض أو تعديل لكل تسمية"
                    : "Store multiple named dashboards and control View/Edit access per dashboard"
                  : isAr
                  ? "حدد الاسم، القسم، والأدوار أو المستخدمين المسموح لهم بالعرض أو التعديل"
                  : "Set custom name, target section, and Role/User View & Edit permissions"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition hover:opacity-80 shrink-0"
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

        {/* Body */}
        {viewMode === "directory" ? (
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? `إجمالي اللوحات المحفوظة: ${dashboards.length}`
                  : `Total saved dashboards: ${dashboards.length}`}
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:opacity-90"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" />
                {isAr ? "+ إضافة لوحة جديدة بتسمية وصلاحيات" : "+ New Named Dashboard"}
              </button>
            </div>

            {dashboards.length === 0 ? (
              <div
                className="py-12 px-4 rounded-xl text-center space-y-3"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px dashed var(--border-default)",
                }}
              >
                <FolderKanban
                  className="w-9 h-9 mx-auto opacity-50"
                  style={{ color: "var(--brand-primary)" }}
                />
                <div className="text-sm font-bold">
                  {isAr ? "لا توجد لوحات مسماة بعد" : "No named dashboards saved yet"}
                </div>
                <button
                  type="button"
                  onClick={startCreate}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {isAr ? "إنشاء أول لوحة" : "Create First Dashboard"}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {dashboards.map((dash) => {
                  const isCurrent = selectedId === dash.id;
                  const scopeLabel =
                    dash.scope === "main"
                      ? isAr
                        ? "الرئيسية"
                        : "Main"
                      : dash.scope === "camo"
                      ? isAr
                        ? "إدارة الصلاحية (CAMO)"
                        : "CAMO"
                      : dash.scope === "training"
                      ? isAr
                        ? "التدريب"
                        : "Training"
                      : dash.scope === "both"
                      ? isAr
                        ? "الرئيسية + الجودة"
                        : "Main & Quality"
                      : isAr
                      ? "إدارة الجودة"
                      : "Quality Management";
                  const roleCount = Array.isArray(dash.viewRoles)
                    ? dash.viewRoles.length
                    : 0;
                  const userCount = Array.isArray(dash.viewUsers)
                    ? dash.viewUsers.length
                    : 0;

                  return (
                    <div
                      key={dash.id}
                      className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        border: isCurrent
                          ? "1px solid var(--brand-primary)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">
                            {isAr
                              ? dash.nameAr || dash.name
                              : dash.name || dash.nameAr}
                          </span>
                          {dash.nameAr &&
                            dash.name &&
                            dash.nameAr !== dash.name && (
                              <span
                                className="text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                ({isAr ? dash.name : dash.nameAr})
                              </span>
                            )}
                          {dash.isDefault && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5" />
                              {isAr ? "افتراضية" : "Default"}
                            </span>
                          )}
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-default)",
                              color: "var(--brand-primary)",
                            }}
                          >
                            {scopeLabel}
                          </span>
                        </div>

                        <div
                          className="text-[11px] font-mono tabular-nums flex items-center gap-2 flex-wrap"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span>
                            {isAr
                              ? `${(dash.widgets || []).length} بطاقات`
                              : `${(dash.widgets || []).length} widgets`}
                          </span>
                          <span>·</span>
                          {dash.visibility === "all" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              {isAr ? "متاحة للجميع" : "All users"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              {isAr
                                ? `${roleCount} أدوار · ${userCount} مستخدمين مخصصين`
                                : `${roleCount} roles · ${userCount} custom users`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDashboard?.(dash.id);
                            onClose?.();
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white"
                          style={{ backgroundColor: "var(--brand-primary)" }}
                        >
                          {isAr ? "فتح" : "Open"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(dash)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isAr ? "تسمية وصلاحيات" : "Edit & Access"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(dash)}
                          className="p-1.5 rounded-lg transition hover:opacity-80"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-default)",
                            color: "var(--text-muted)",
                          }}
                          title={isAr ? "نسخ اللوحة" : "Duplicate"}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dash)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition"
                          title={isAr ? "حذف اللوحة" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto flex-1 space-y-5">
            {/* 1. Naming & Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold">
                  {isAr
                    ? "اسم اللوحة (بالعربية أو الاسم الرئيسي) *"
                    : "Dashboard Name (Arabic / Primary) *"}
                </label>
                <input
                  type="text"
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nameAr: e.target.value }))
                  }
                  placeholder={
                    isAr
                      ? "مثال: لوحة تدقيق الجودة والسلامة"
                      : "e.g. لوحة تدقيق الجودة والسلامة"
                  }
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold">
                  {isAr
                    ? "الاسم بالإنجليزية (اختياري)"
                    : "Dashboard Name (English) *"}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Safety & Quality Audit Board"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold">
                  {isAr ? "مكان ظهور اللوحة (القسم)" : "Target Section"}
                </label>
                <select
                  value={form.scope}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, scope: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="quality">
                    {isAr
                      ? "قسم إدارة الجودة (Quality Management)"
                      : "Quality Management"}
                  </option>
                  <option value="camo">
                    {isAr
                      ? "قسم إدارة الصلاحية (CAMO Dashboard)"
                      : "CAMO Airworthiness Section"}
                  </option>
                  <option value="training">
                    {isAr
                      ? "قسم التدريب والتأهيل (Training Dashboard)"
                      : "Training & Qualifications Section"}
                  </option>
                  <option value="main">
                    {isAr
                      ? "لوحة التحكم الرئيسية (Main Dashboard)"
                      : "Main Dashboard"}
                  </option>
                  <option value="both">
                    {isAr
                      ? "الرئيسية + إدارة الجودة معاً"
                      : "Both (Main & Quality Management)"}
                  </option>
                </select>
              </div>

              {viewMode === "create" ? (
                <div className="space-y-1">
                  <label className="block text-xs font-bold">
                    {isAr ? "البطاقات المبدئية للوحة" : "Starting Widgets Template"}
                  </label>
                  <select
                    value={form.templateKey}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        templateKey: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {currentScreenWidgets.length > 0 && (
                      <option value="current">
                        {isAr
                          ? `نسخ البطاقات المعروضة حالياً (${currentScreenWidgets.length})`
                          : `Copy Current Active Widgets (${currentScreenWidgets.length})`}
                      </option>
                    )}
                    <option value="quality">
                      {isAr
                        ? "قالب إدارة الجودة والامتثال الشامل"
                        : "Quality Management Full Preset"}
                    </option>
                    <option value="camo">
                      {isAr
                        ? "قالب إدارة الصلاحية والفحوصات والمحركات (CAMO)"
                        : "CAMO Airworthiness, Checks & Engines"}
                    </option>
                    <option value="training">
                      {isAr
                        ? "قالب التدريب والمحاكي وتأهيل الطاقم"
                        : "Crew Training, Simulator & Renewals"}
                    </option>
                    <option value="operations">
                      {isAr ? "قالب العمليات التشغيلية" : "Flight Operations Preset"}
                    </option>
                    <option value="admin">
                      {isAr ? "القالب التنفيذي والإداري" : "Admin & Executive Preset"}
                    </option>
                    <option value="blank">
                      {isAr ? "لوحة فارغة (تخصيص يدوي)" : "Blank Dashboard"}
                    </option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-xs font-bold">
                    {isAr ? "وصف مختصر (اختياري)" : "Description (Optional)"}
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder={
                      isAr
                        ? "وصف الغرض من هذه اللوحة..."
                        : "Purpose of this dashboard..."
                    }
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isDefault: e.target.checked }))
                }
                className="w-4 h-4 accent-sky-600"
              />
              <span>
                {isAr
                  ? "تعيين كلوحة افتراضية عند فتح هذا القسم"
                  : "Set as default dashboard when opening this section"}
              </span>
            </label>

            {/* 2. Permissions Section */}
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Shield
                      className="w-4 h-4"
                      style={{ color: "var(--brand-primary)" }}
                    />
                    {isAr
                      ? "صلاحيات الوصول لهذه التسمية (Per-Dashboard Permissions)"
                      : "Access Permissions for This Named Dashboard"}
                  </div>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {isAr
                      ? "حدد من يحق له رؤية هذه اللوحة ومن يحق له تعديل بطاقاتها"
                      : "Control which Roles and Users can View or Edit/Customize this dashboard"}
                  </p>
                </div>

                <div
                  className="flex items-center rounded-lg p-0.5 text-xs shrink-0"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, visibility: "restricted" }))
                    }
                    className="px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition"
                    style={
                      form.visibility === "restricted"
                        ? {
                            backgroundColor: "var(--brand-primary)",
                            color: "#ffffff",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    <Lock className="w-3 h-3" />
                    {isAr ? "محددة بصلاحيات" : "Restricted"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, visibility: "all" }))
                    }
                    className="px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition"
                    style={
                      form.visibility === "all"
                        ? {
                            backgroundColor: "var(--brand-primary)",
                            color: "#ffffff",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    <Globe className="w-3 h-3" />
                    {isAr ? "عرض للجميع" : "All Users View"}
                  </button>
                </div>
              </div>

              {/* Role-level Matrix */}
              <div className="space-y-2">
                <div
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isAr
                    ? "1) صلاحيات الأدوار الوظيفية (Roles):"
                    : "1) Role Permissions:"}
                </div>
                <div
                  className="rounded-lg overflow-hidden divide-y"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-default)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  {unifiedRoleOptions.map((r) => {
                    const canView =
                      r.isSuper ||
                      form.visibility === "all" ||
                      hasRoleIn(form.viewRoles, r.key);
                    const canEdit =
                      r.isSuper || hasRoleIn(form.editRoles, r.key);

                    return (
                      <div
                        key={r.key}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{r.icon}</span>
                          <span className="font-semibold truncate">
                            {isAr ? r.labelAr : r.labelEn}
                          </span>
                          <code
                            className="text-[10px] font-mono px-1.5 py-0.2 rounded"
                            style={{
                              backgroundColor: "var(--bg-app)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {r.key}
                          </code>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={canView}
                              disabled={r.isSuper || form.visibility === "all"}
                              onChange={() => toggleRoleView(r.key)}
                              className="w-3.5 h-3.5 accent-emerald-600"
                            />
                            <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{isAr ? "عرض" : "View"}</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={canEdit}
                              disabled={r.isSuper}
                              onChange={() => toggleRoleEdit(r.key)}
                              className="w-3.5 h-3.5 accent-sky-600"
                            />
                            <Edit3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>{isAr ? "تعديل" : "Edit"}</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Specific Users Matrix */}
              {Array.isArray(users) && users.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {isAr
                        ? "2) استثناءات / صلاحيات لمستخدمين محددين (Users):"
                        : "2) Specific User Grants:"}
                    </span>
                    <div className="relative w-48">
                      <Search
                        className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none"
                        style={{ color: "var(--text-muted)" }}
                      />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder={isAr ? "بحث عن مستخدم..." : "Search user..."}
                        className="w-full ps-8 pe-2 py-1 rounded-md text-[11px] outline-none"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    className="rounded-lg max-h-40 overflow-y-auto divide-y"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    {filteredUsers.map((u) => {
                      const isSuperU =
                        String(u.role || "").toLowerCase() === "superadmin";
                      const uView = isSuperU || hasUserIn(form.viewUsers, u);
                      const uEdit = isSuperU || hasUserIn(form.editUsers, u);
                      return (
                        <div
                          key={u.id || u.username}
                          className="px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold">
                              {u.fullName || u.username}
                            </span>
                            <span
                              className="ms-1.5 text-[10px] font-mono"
                              style={{ color: "var(--text-muted)" }}
                            >
                              @{u.username} · {getRoleLabel(u.role, lang)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uView}
                                disabled={isSuperU}
                                onChange={() => toggleUserView(u)}
                                className="w-3.5 h-3.5 accent-emerald-600"
                              />
                              <span className="text-[11px]">
                                {isAr ? "عرض" : "View"}
                              </span>
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={uEdit}
                                disabled={isSuperU}
                                onChange={() => toggleUserEdit(u)}
                                className="w-3.5 h-3.5 accent-sky-600"
                              />
                              <span className="text-[11px]">
                                {isAr ? "تعديل" : "Edit"}
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div
              className="pt-3 flex items-center justify-end gap-2"
              style={{ borderTop: "1px solid var(--border-default)" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-bold"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Save className="w-4 h-4" />
                {saving
                  ? "…"
                  : viewMode === "create"
                  ? isAr
                    ? "إنشاء وحفظ الصلاحيات"
                    : "Create & Save Permissions"
                  : isAr
                  ? "حفظ التعديلات والصلاحيات"
                  : "Save Name & Permissions"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default NamedDashboardModal;
