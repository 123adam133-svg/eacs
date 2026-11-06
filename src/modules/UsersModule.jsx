/* ═══════════════════════════════════════════════════════════
 * USERS MODULE
 * User management with role assignment + individual overrides
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  User,
  Key,
  UserPlus,
  Lock,
  Shield,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { PermissionsMatrix } from "../components/PermissionsMatrix";
import { usersAPI, toDisplayImageUrl } from "../api";
import { logSafe } from "../utils/audit";
import { safeArray, safeBool } from "../utils/helpers";
import {
  can as checkPerm,
  getRoleLabel,
  getRoleColor,
  getRolePermissions,
  countPermissions,
  upgradeLegacyPortalPerms,
  markPortalSchemaSaved,
  stripInternalPermMarkers,
} from "../config/permissions";

export function UsersModule({
  users,
  setUsers,
  roles = [],
  lang = "en",
  setSyncStatus,
}) {
  const t = useT();
  const { user: me } = useAuth();
  const safeMe = me || { id: null, role: null, username: null, fullName: null };

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [pwdUser, setPwdUser] = useState(null);
  const [pwd, setPwd] = useState({ p1: "", p2: "" });
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  /* ⭐ Filter */
  const filtered = users.filter((u) => {
    const q = String(search || "").toLowerCase();
    const matchesSearch =
      !q ||
      String(u.fullName || "").toLowerCase().includes(q) ||
      String(u.username ?? "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  /* ⭐ Helpers */
  const getRole = (roleName) => roles.find((r) => r.name === roleName);

  /* ⭐ CRUD */
  const openNew = () => {
    const defaultRole =
      roles.find((r) => r.active && r.name !== "superAdmin") || roles[0];
    setDraft({
      username: "",
      password: "",
      fullName: "",
      role: defaultRole?.name || "dispatcher",
      email: "",
      phone: "",
      jobTitle: "",
      avatar: null,
      attachments: [],
      active: true,
      crewId: "",
      perms: [],
    });
    setEditing("new");
  };

  const openEdit = (u) => {
    const rawUserPerms = safeArray(u.perms);
    setDraft({
      ...u,
      perms:
        rawUserPerms.length > 0
          ? stripInternalPermMarkers(upgradeLegacyPortalPerms(rawUserPerms, u.role))
          : [],
    });
    setEditing(u.id);
  };

  const save = async () => {
    if (!draft.fullName || !draft.username) {
      showToast("Full name and username are required");
      return;
    }

    const rawDraftPerms = safeArray(draft.perms);
    const payload = {
      ...draft,
      perms:
        rawDraftPerms.length > 0 ? markPortalSchemaSaved(rawDraftPerms) : [],
    };

    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await usersAPI.create(payload);
        setUsers([...users, { ...payload, id: created.id }]);
        logSafe(safeMe, "CREATE", "User", created.id, payload.fullName, {
          username: payload.username,
          role: payload.role,
        });
      } else {
        const before = users.find((u) => u.id === editing);
        await usersAPI.update(editing, payload);
        setUsers(
          users.map((u) => (u.id === editing ? { ...payload, id: editing } : u))
        );
        logSafe(safeMe, "UPDATE", "User", editing, payload.fullName, {
          before: { role: before?.role },
          after: { role: payload.role },
        });
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (id === safeMe.id) return showToast(t.cannotDeleteYourself);
    if (!(await confirmAction(t.confirmDelete))) return;
    const user = users.find((u) => u.id === id);
    try {
      await usersAPI.remove(id);
      setUsers(users.filter((u) => u.id !== id));
      logSafe(safeMe, "DELETE", "User", id, user?.fullName || "", {});
    } catch (e) {
      showToast("Delete failed: " + e.message);
    }
  };

  const savePassword = async () => {
    if (pwd.p1.length < 6) return setErr(t.minChars);
    if (pwd.p1 !== pwd.p2) return setErr(t.passwordsDoNotMatch);
    try {
      await usersAPI.update(pwdUser.id, { ...pwdUser, password: pwd.p1 });
      setUsers(
        users.map((u) => (u.id === pwdUser.id ? { ...u, password: pwd.p1 } : u))
      );
      logSafe(
        safeMe,
        "UPDATE",
        "User (Password)",
        pwdUser.id,
        pwdUser.fullName,
        {
          action: "Password changed",
        }
      );
      setPwdUser(null);
      setPwd({ p1: "", p2: "" });
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  };

  const toggleActive = async (u) => {
    if (u.id === safeMe.id) return showToast(t.cannotDisableYourself);
    const updated = { ...u, active: !u.active };
    setUsers(users.map((x) => (x.id === u.id ? updated : x)));
    try {
      await usersAPI.update(u.id, updated);
    } catch (e) {
      showToast("Toggle failed: " + e.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t.userMgmt}</h2>
              <div className="text-xs text-slate-300">
                {users.length} {t.totalUsers} · {roles.length} {t.totalRoles}
              </div>
            </div>
          </div>

          {checkPerm(safeMe, "users.create") && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold"
            >
              <UserPlus className="w-4 h-4" /> {t.addUser}
            </button>
          )}
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
            className="w-full ps-9 pe-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
        >
          <option value="">{t.all}</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>
              {lang === "ar" ? r.nameAr : r.name}
            </option>
          ))}
        </select>

        {(search || roleFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setRoleFilter("");
            }}
            className="px-3 py-2 rounded-lg bg-rose-100 dark:bg-rose-950 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-xs font-bold"
          >
            ✖ {t.clear}
          </button>
        )}
      </div>

      {/* ═══ Users Table ═══ */}
      <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 border-b-2 border-slate-400 dark:border-slate-700">
            <tr className="text-slate-700 dark:text-slate-200">
              <th className="px-3 py-3 text-start font-bold">#</th>
              <th className="px-3 py-3 text-start font-bold">{t.fullName}</th>
              <th className="px-3 py-3 text-start font-bold">{t.jobTitle}</th>
              <th className="px-3 py-3 text-start font-bold">{t.role}</th>
              <th className="px-3 py-3 text-center font-bold">
                {t.permissions}
              </th>
              <th className="px-3 py-3 text-center font-bold">{t.status}</th>
              <th className="px-3 py-3 text-center font-bold">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400">
                  {t.noData}
                </td>
              </tr>
            ) : (
              filtered.map((u, idx) => {
                const hasOverride = safeArray(u.perms).length > 0;
                const isSelf = safeMe.id && u.id === safeMe.id;
                const permCount = countPermissions(u);

                return (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-200 dark:border-slate-700 hover:bg-sky-50/40 dark:hover:bg-slate-700/50 ${
                      !u.active ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-3 py-3 text-slate-500">{idx + 1}</td>

                    {/* User info */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex-shrink-0">
                          {toDisplayImageUrl(u.avatar) ? (
                            <img
                              src={toDisplayImageUrl(u.avatar)}
                              alt={u.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-full h-full p-2 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            {u.fullName}
                            {isSelf && (
                              <span className="text-[9px] bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 rounded">
                                {t.you}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Job title */}
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400 text-xs">
                      {u.jobTitle || "—"}
                    </td>

                    {/* Role */}
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border ${getRoleColor(
                          u.role,
                          lang
                        )}`}
                      >
                        <Key className="w-3 h-3" />
                        {getRoleLabel(u.role, lang)}
                      </span>
                    </td>

                    {/* Permissions count */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            hasOverride
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300"
                          }`}
                        >
                          {permCount === "ALL" ? "⭐ ALL" : permCount}
                        </span>
                        {hasOverride ? (
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                            ⚡ {t.override}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">
                            {t.fromRole}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        disabled={isSelf}
                        className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                          u.active
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600"
                        } ${
                          !isSelf
                            ? "hover:opacity-80 cursor-pointer"
                            : "cursor-not-allowed"
                        }`}
                      >
                        {u.active ? `✓ ${t.active}` : `✗ ${t.inactive}`}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-center">
                        {checkPerm(safeMe, "users.edit") && (
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300"
                            title={t.edit}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {checkPerm(safeMe, "users.password") && (
                          <button
                            onClick={() => {
                              setPwdUser(u);
                              setPwd({ p1: "", p2: "" });
                              setErr("");
                            }}
                            className="p-1.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                            title={t.changePassword}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                        {checkPerm(safeMe, "users.delete") && !isSelf && (
                          <button
                            onClick={() => remove(u.id)}
                            className="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ EDIT MODAL ═══ */}
      <Modal
        open={!!editing}
        title={editing === "new" ? t.addUser : t.editUser}
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
            >
              {t.cancel}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
            >
              {t.save}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Basic Info */}
          <section>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> {t.basicInfo}
            </h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t.fullName}>
                <Input
                  value={draft.fullName || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label={t.jobTitle}>
                <Input
                  value={draft.jobTitle || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, jobTitle: e.target.value })
                  }
                />
              </Field>
              <Field label={t.email}>
                <Input
                  type="email"
                  value={draft.email || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                />
              </Field>
              <Field label={t.phone}>
                <Input
                  value={draft.phone || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </Field>
            </div>
          </section>

          {/* Account */}
          <section>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4" /> {t.account}
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t.username}>
                <Input
                  value={draft.username || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      username: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, ""),
                    })
                  }
                />
              </Field>
              <Field
                label={
                  editing === "new"
                    ? t.assignPassword
                    : `${t.assignPassword} (blank = keep)`
                }
              >
                <Input
                  value={draft.password || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, password: e.target.value })
                  }
                />
              </Field>
              <Field label={t.status}>
                <Select
                  value={String(draft.active)}
                  onChange={(e) =>
                    setDraft({ ...draft, active: e.target.value === "true" })
                  }
                >
                  <option value="true">✓ {t.active}</option>
                  <option value="false">✗ {t.inactive}</option>
                </Select>
              </Field>
            </div>
          </section>

          {/* Role Assignment */}
          <section className="bg-sky-50 dark:bg-sky-950 border-2 border-sky-200 dark:border-sky-800 rounded-lg p-4">
            <h4 className="text-sm font-bold text-sky-800 dark:text-sky-200 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4" /> {t.roleAssignment}
            </h4>

            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t.role}>
                <Select
                  value={draft.role || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, role: e.target.value, perms: [] })
                  }
                >
                  {roles
                    .filter((r) => r.active)
                    .map((r) => (
                      <option key={r.id} value={r.name}>
                        {lang === "ar" ? r.nameAr : r.name}
                        {safeArray(r.perms).includes("*")
                          ? " ⭐"
                          : ` (${getRolePermissions(r.name).length})`}
                      </option>
                    ))}
                </Select>
              </Field>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {t.rolePermissionsPreview}
                </label>
                <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 p-2 max-h-[80px] overflow-auto">
                  {(() => {
                    const rp = getRolePermissions(draft.role);
                    if (rp.includes("*"))
                      return (
                        <span className="text-xs font-bold text-rose-600">
                          ⭐ {t.allPermissions}
                        </span>
                      );
                    if (rp.length === 0)
                      return (
                        <span className="text-xs text-slate-400">
                          {t.noData}
                        </span>
                      );
                    return (
                      <div className="flex flex-wrap gap-1">
                        {rp.slice(0, 8).map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 text-[9px] font-mono"
                          >
                            {p}
                          </span>
                        ))}
                        {rp.length > 8 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[9px] text-slate-600 dark:text-slate-400">
                            +{rp.length - 8}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Override toggle */}
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={safeArray(draft.perms).length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDraft({
                        ...draft,
                        perms: [...getRolePermissions(draft.role)],
                      });
                    } else {
                      setDraft({ ...draft, perms: [] });
                    }
                  }}
                  className="w-4 h-4 accent-amber-600"
                />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  ⚡ {t.overrideRolePerms}
                </span>
              </label>

              {safeArray(draft.perms).length > 0 && (
                <div className="mt-3">
                  <PermissionsMatrix
                    value={draft.perms || []}
                    onChange={(v) => setDraft({ ...draft, perms: v })}
                    lang={lang}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </Modal>

      {/* ═══ PASSWORD MODAL ═══ */}
      <Modal
        open={!!pwdUser}
        title={`${t.changePassword} — ${pwdUser?.fullName || ""}`}
        onClose={() => setPwdUser(null)}
        footer={
          <>
            <button
              onClick={() => setPwdUser(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200"
            >
              {t.cancel}
            </button>
            <button
              onClick={savePassword}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
            >
              {t.save}
            </button>
          </>
        }
      >
        {err && (
          <div className="mb-3 p-2 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-sm">
            {err}
          </div>
        )}
        <div className="space-y-3">
          <Field label={t.newPassword}>
            <Input
              type="password"
              value={pwd.p1}
              onChange={(e) => setPwd({ ...pwd, p1: e.target.value })}
            />
          </Field>
          <Field label={t.confirmPassword}>
            <Input
              type="password"
              value={pwd.p2}
              onChange={(e) => setPwd({ ...pwd, p2: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

export default UsersModule;
