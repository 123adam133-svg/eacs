/* ═══════════════════════════════════════════════════════════
 * ROLES MODULE — Full CRUD from Settings
 * v3.0 — Improved UX + auto-save to backend
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  Key,
  Shield,
  Smartphone,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { PermissionsMatrix } from "../components/PermissionsMatrix";
import { rolesAPI } from "../api";
import { logSafe } from "../utils/audit";
import { safeArray } from "../utils/helpers";
import {
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
  ALL_PERMS_FLAT,
  TOTAL_PERMS_COUNT,
  setGlobalRoles,
  upgradeLegacyPortalPerms,
  markPortalSchemaSaved,
  stripInternalPermMarkers,
  can as checkPerm,
} from "../config/permissions";

export function RolesModule({ roles, setRoles, setSyncStatus }) {
  const t = useT();
  const { user } = useAuth();
  const safeUser = user || { id: null, role: null };
  const lang = document.documentElement.lang || "en";

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const canEdit = checkPerm(safeUser, "users.perms");

  const hasCrewPortal = safeArray(draft.perms).includes("crew.portal");

  const toggleCrewPortal = () => {
    const current = safeArray(draft.perms);
    const portalDefaultIcons = (ALL_PERMISSIONS.portal?.perms || [])
      .map((p) => p.key)
      .filter((k) => !k.endsWith("_edit") && k !== "portal.print_with_stamp");
    if (current.includes("crew.portal")) {
      setDraft({
        ...draft,
        perms: current.filter((p) => p !== "crew.portal"),
      });
    } else {
      const hasAnyPortalIcon = current.some((p) => p.startsWith("portal."));
      setDraft({
        ...draft,
        perms: hasAnyPortalIcon
          ? [...current, "crew.portal"]
          : Array.from(new Set([...current, "crew.portal", ...portalDefaultIcons])),
      });
    }
  };

  const togglePortalSubPerm = (permKey) => {
    const current = safeArray(draft.perms);
    if (current.includes("*")) return;
    if (current.includes(permKey)) {
      setDraft({
        ...draft,
        perms: current.filter((p) => p !== permKey),
      });
    } else {
      setDraft({
        ...draft,
        perms: [...current, permKey],
      });
    }
  };

  const openNew = () => {
    setDraft({
      name: "",
      nameAr: "",
      description: "",
      perms: [],
      active: true,
    });
    setEditing("new");
  };

  const openEdit = (r) => {
    const upgraded = upgradeLegacyPortalPerms(safeArray(r.perms), r.name);
    setDraft({ ...r, perms: stripInternalPermMarkers(upgraded) });
    setEditing(r.id);
  };

  const applyTemplate = async (templateKey) => {
    const tpl = ROLE_TEMPLATES[templateKey];
    if (!tpl) return;
    if (
      !(await confirmAction(
        (lang === "ar"
          ? "سيتم استبدال الصلاحيات الحالية بقالب "
          : "This will replace current permissions with template ") +
          (lang === "ar" ? tpl.label_ar : tpl.label_en) +
          " — " +
          (lang === "ar" ? "متابعة؟" : "Continue?")
      ))
    )
      return;
    setDraft({
      ...draft,
      name: templateKey,
      nameAr: tpl.label_ar,
      description: tpl.description_ar || tpl.description_en,
      perms: [...tpl.perms],
    });
  };

  const toggleAllPerms = () => {
    const current = safeArray(draft.perms);
    if (current.includes("*")) {
      setDraft({ ...draft, perms: [] });
    } else {
      setDraft({ ...draft, perms: ["*"] });
    }
  };

  const save = async () => {
    if (!draft.name || !draft.nameAr) {
      return showToast(lang === "ar" ? "الاسم مطلوب" : "Name is required");
    }

    const dup = roles.find(
      (r) =>
        (r.name === draft.name || r.nameAr === draft.nameAr) && r.id !== editing
    );
    if (dup) {
      return showToast(
        lang === "ar" ? "الاسم مستخدم بالفعل" : "Name already exists"
      );
    }

    setSaving(true);
    setSyncStatus?.("syncing");

    const finalPayload = {
      ...draft,
      perms: markPortalSchemaSaved(safeArray(draft.perms)),
    };

    try {
      if (editing === "new") {
        const created = await rolesAPI.create(finalPayload);
        const nextRoles = [...roles, { ...finalPayload, id: created.id }];
        setRoles(nextRoles);
        setGlobalRoles(nextRoles);
        logSafe(safeUser, "CREATE", "Role", created.id, finalPayload.name, {
          name: finalPayload.name,
        });
      } else {
        await rolesAPI.update(editing, finalPayload);
        const nextRoles = roles.map((r) =>
          r.id === editing ? { ...finalPayload, id: editing } : r
        );
        setRoles(nextRoles);
        setGlobalRoles(nextRoles);
        logSafe(safeUser, "UPDATE", "Role", editing, finalPayload.name, {
          name: finalPayload.name,
        });
      }
      setEditing(null);
      setDraft({});
      setSyncStatus?.("synced");
      showToast(lang === "ar" ? "✅ تم الحفظ" : "✅ Saved");
    } catch (e) {
      showToast(
        (lang === "ar" ? "❌ فشل الحفظ: " : "❌ Save failed: ") + e.message
      );
      setSyncStatus?.("error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const role = roles.find((r) => r.id === id);
    if (role?.name === "superAdmin") {
      return showToast(
        lang === "ar" ? "لا يمكن حذف Super Admin" : "Cannot delete Super Admin"
      );
    }
    if (!(await confirmAction(t.confirmDelete || "Confirm delete?"))) return;

    try {
      await rolesAPI.remove(id);
      setRoles(roles.filter((r) => r.id !== id));
      logSafe(safeUser, "DELETE", "Role", id, role?.name || "", {});
    } catch (e) {
      showToast(
        (lang === "ar" ? "❌ فشل الحذف: " : "❌ Delete failed: ") + e.message
      );
    }
  };

  const toggleActive = (id) => {
    const role = roles.find((r) => r.id === id);
    if (role?.name === "superAdmin") {
      return showToast(
        lang === "ar"
          ? "لا يمكن تعطيل Super Admin"
          : "Cannot disable Super Admin"
      );
    }
    const updated = { ...role, active: !role.active };
    setRoles(roles.map((r) => (r.id === id ? updated : r)));
    rolesAPI.update(id, updated).catch(console.error);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Key className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {t.roles || "Roles"}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {roles.length} {t.totalRoles || "roles"} · {TOTAL_PERMS_COUNT}{" "}
              {lang === "ar" ? "صلاحية متاحة" : "permissions available"}
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-bold"
            style={{
              background: "var(--brand-gradient)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Plus className="w-4 h-4" /> {t.newRole || "New Role"}
          </button>
        )}
      </div>

      {/* Roles Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {roles.map((role) => {
          const isSuper = role.name === "superAdmin";
          const perms = stripInternalPermMarkers(
            upgradeLegacyPortalPerms(safeArray(role.perms), role.name)
          );
          const hasPortal = perms.includes("crew.portal");

          return (
            <div
              key={role.id}
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSuper
                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                        : "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div
                      className="font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {lang === "ar" ? role.nameAr : role.name}
                    </div>
                    <div
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {role.name}
                    </div>
                  </div>
                </div>

                <Badge kind={role.active ? "active" : "inactive"}>
                  {role.active ? t.active : t.inactive}
                </Badge>
              </div>

              {hasPortal && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    {lang === "ar" ? "واجهة الطاقم مفعّلة" : "Crew Portal ON"}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {perms.includes("*") ? (
                  <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                    ⭐ {lang === "ar" ? "كل الصلاحيات" : "All permissions"}
                  </span>
                ) : (
                  perms
                    .filter((p) => p !== "crew.portal")
                    .slice(0, 4)
                    .map((p) => (
                      <span
                        key={p}
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                        style={{
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {p}
                      </span>
                    ))
                )}
                {perms.filter((p) => p !== "crew.portal").length > 4 && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px]"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-muted)",
                    }}
                  >
                    +{perms.filter((p) => p !== "crew.portal").length - 4}
                  </span>
                )}
              </div>

              {canEdit && (
                <div
                  className="flex gap-2 pt-2"
                  style={{ borderTop: "1px solid var(--border-default)" }}
                >
                  <button
                    onClick={() => openEdit(role)}
                    className="flex-1 py-1.5 rounded bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold"
                  >
                    <Edit className="w-3.5 h-3.5 inline" /> {t.edit || "تعديل"}
                  </button>
                  {!isSuper && (
                    <>
                      <button
                        onClick={() => toggleActive(role.id)}
                        className="flex-1 py-1.5 rounded text-xs font-bold"
                        style={{
                          backgroundColor: "var(--bg-app)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {role.active ? t.disabled : t.enabled}
                      </button>
                      <button
                        onClick={() => remove(role.id)}
                        className="p-1.5 rounded bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editing}
        title={editing === "new" ? t.newRole : t.editRole}
        onClose={() => {
          setEditing(null);
          setDraft({});
        }}
        wide
        footer={
          <>
            <button
              onClick={() => {
                setEditing(null);
                setDraft({});
              }}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {t.cancel || "إلغاء"}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
              style={{
                background: "var(--brand-gradient)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Save className="w-4 h-4" />
              {saving ? "…" : t.save || "حفظ"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Templates */}
          {editing === "new" && (
            <div
              className="p-3 rounded-lg"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div
                className="text-xs font-bold mb-2 flex items-center gap-2"
                style={{ color: "var(--text-muted)" }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {lang === "ar"
                  ? "ابدأ من قالب جاهز:"
                  : "Start from a template:"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(ROLE_TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyTemplate(key)}
                    className="px-2.5 py-1 rounded text-xs font-bold transition"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-default)",
                    }}
                  >
                    {tpl.icon} {lang === "ar" ? tpl.label_ar : tpl.label_en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid md:grid-cols-2 gap-3">
            <Field label={t.roleNameEn || "Role Name (EN)"}>
              <Input
                value={draft.name || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                  })
                }
                disabled={draft.name === "superAdmin"}
              />
            </Field>
            <Field label={t.roleNameAr || "Role Name (AR)"}>
              <Input
                value={draft.nameAr || ""}
                onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
              />
            </Field>
            <Field label={t.description || "Description"} span>
              <Input
                value={draft.description || ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field label={t.status || "Status"}>
              <Select
                value={String(draft.active)}
                onChange={(e) =>
                  setDraft({ ...draft, active: e.target.value === "true" })
                }
              >
                <option value="true">{t.active || "Active"}</option>
                <option value="false">{t.inactive || "Inactive"}</option>
              </Select>
            </Field>
          </div>

          {/* Crew Portal Toggle */}
          <div
            className="rounded-2xl border-2 p-4 transition-all"
            style={{
              backgroundColor: hasCrewPortal
                ? "rgba(16, 185, 129, 0.08)"
                : "var(--bg-app)",
              borderColor: hasCrewPortal ? "#10b981" : "var(--border-default)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: hasCrewPortal
                      ? "#10b981"
                      : "var(--bg-card)",
                    color: hasCrewPortal ? "white" : "var(--text-muted)",
                  }}
                >
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {lang === "ar"
                      ? "واجهة الطاقم للهاتف"
                      : "Crew Portal (Mobile)"}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {lang === "ar"
                      ? "عند تفعيلها، يرى المستخدمون بهذا الدور واجهة الطاقم"
                      : "When enabled, users with this role see the mobile Crew Portal"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleCrewPortal}
                className="relative w-16 h-9 rounded-full transition-all flex-shrink-0"
                style={{
                  backgroundColor: hasCrewPortal
                    ? "#10b981"
                    : "var(--border-default)",
                }}
              >
                <span
                  className="absolute top-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform"
                  style={{
                    transform: hasCrewPortal
                      ? "translateX(32px)"
                      : "translateX(4px)",
                  }}
                />
              </button>
            </div>

            {(hasCrewPortal || safeArray(draft.perms).includes("*")) && (
              <div
                className="mt-4 pt-3 border-t"
                style={{ borderColor: "var(--border-default)" }}
              >
                <div
                  className="text-xs font-bold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {lang === "ar"
                    ? "صلاحيات أيقونات بوابة الطاقم (Crew Portal Icons):"
                    : "Crew Portal Icon Permissions:"}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(ALL_PERMISSIONS.portal?.perms || []).map((p) => {
                    const isAll = safeArray(draft.perms).includes("*");
                    const checked =
                      isAll || safeArray(draft.perms).includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition"
                        style={{
                          backgroundColor: checked
                            ? "var(--bg-card)"
                            : "transparent",
                          borderColor: checked
                            ? "#10b981"
                            : "var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isAll}
                          onChange={() => togglePortalSubPerm(p.key)}
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <span className="flex-1 font-medium">
                          {lang === "ar" ? p.ar : p.en}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Permissions Matrix */}
          <section>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <h4
                className="text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {t.permissions || "الصلاحيات"}
              </h4>
              <button
                type="button"
                onClick={toggleAllPerms}
                className="px-3 py-1 rounded text-xs font-bold transition"
                style={{
                  backgroundColor: safeArray(draft.perms).includes("*")
                    ? "#dc2626"
                    : "var(--bg-app)",
                  color: safeArray(draft.perms).includes("*")
                    ? "white"
                    : "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {safeArray(draft.perms).includes("*")
                  ? `⭐ ${lang === "ar" ? "كل الصلاحيات" : "All permissions"}`
                  : lang === "ar"
                  ? "منح الكل"
                  : "Grant all"}
              </button>
            </div>

            {safeArray(draft.perms).includes("*") ? (
              <div
                className="p-4 rounded-lg text-center"
                style={{
                  backgroundColor: "rgba(220, 38, 38, 0.1)",
                  border: "2px solid #dc2626",
                }}
              >
                <Shield className="w-8 h-8 mx-auto mb-2 text-rose-600" />
                <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                  {lang === "ar"
                    ? "⭐ كل الصلاحيات ممنوحة"
                    : "⭐ All permissions granted"}
                </div>
              </div>
            ) : (
              <PermissionsMatrix
                value={draft.perms || []}
                onChange={(v) => setDraft({ ...draft, perms: v })}
                lang={lang}
              />
            )}
          </section>
        </div>
      </Modal>
    </div>
  );
}

export default RolesModule;
