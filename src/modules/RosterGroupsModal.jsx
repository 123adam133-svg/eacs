/* ═══════════════════════════════════════════════════════════
 * ROSTER GROUPS — Multi-Group Crew Roster Management & RBAC
 * Supports default & custom aviation groups (Flight Crew, Cabin Crew,
 * Flight Dispatch, Engineering, + custom groups) with Position &
 * explicit Crew membership + per-group Role/User permissions synced
 * to Google Sheets + instant localStorage cache.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  X,
  Plus,
  Save,
  Users,
  Shield,
  Lock,
  Globe,
  Trash2,
  Edit3,
  Search,
  ArrowLeft,
  FolderKanban,
} from "lucide-react";
import {
  rosterGroupsAPI,
  readSheetCache,
  writeSheetCache,
} from "../api";
import {
  ROLE_TEMPLATES,
  getRoleLabel,
  setGlobalRosterGroups,
  getRosterGroupPermKeys,
} from "../config/permissions";
import { getPositionOptions } from "../config/constants";
import { confirmAction, showToast } from "../utils/dialog";

const SEEDED_ROSTER_GROUPS_KEY = "aeroops.rosterGroups.seeded.v1";

const ADMIN_ROLES = new Set([
  "superadmin",
  "super_admin",
  "super-admin",
  "admin",
  "administrator",
  "owner",
  "root",
]);

function norm(val) {
  return String(val || "")
    .trim()
    .toLowerCase();
}

export const GROUP_COLOR_THEMES = {
  sky: {
    labelAr: "أزرق سماوي",
    labelEn: "Sky Blue",
    dot: "#0284c7",
    activeBg: "rgba(2, 132, 199, 0.14)",
    activeBorder: "#0284c7",
    text: "text-sky-600 dark:text-sky-400",
  },
  amber: {
    labelAr: "ذهبي / كهرماني",
    labelEn: "Amber",
    dot: "#d97706",
    activeBg: "rgba(217, 119, 6, 0.14)",
    activeBorder: "#d97706",
    text: "text-amber-600 dark:text-amber-400",
  },
  indigo: {
    labelAr: "نيلي",
    labelEn: "Indigo",
    dot: "#4f46e5",
    activeBg: "rgba(79, 70, 229, 0.14)",
    activeBorder: "#4f46e5",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  emerald: {
    labelAr: "أخضر زمردي",
    labelEn: "Emerald",
    dot: "#059669",
    activeBg: "rgba(5, 150, 105, 0.14)",
    activeBorder: "#059669",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  purple: {
    labelAr: "بنفسجي",
    labelEn: "Purple",
    dot: "#9333ea",
    activeBg: "rgba(147, 51, 234, 0.14)",
    activeBorder: "#9333ea",
    text: "text-purple-600 dark:text-purple-400",
  },
  rose: {
    labelAr: "ياقوتي",
    labelEn: "Crimson",
    dot: "#e11d48",
    activeBg: "rgba(225, 29, 72, 0.14)",
    activeBorder: "#e11d48",
    text: "text-rose-600 dark:text-rose-400",
  },
};

export function buildDefaultRosterGroups() {
  const now = new Date().toISOString();
  return [
    {
      id: "grp_flight_crew",
      name: "Flight Deck Crew",
      nameAr: "مجموعة الطاقم الجوي",
      description: "Captains, First Officers, Training Instructors & Observers",
      color: "sky",
      positions: ["captain", "firstOfficer", "tri", "observer"],
      crewIds: [],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain", "camo"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isSystem: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "grp_cabin_crew",
      name: "Cabin Crew & Hospitality",
      nameAr: "مجموعة الضيافة الجوية",
      description: "Senior Cabin Crew (FA1), Cabin Attendants (FA2 / FA)",
      color: "amber",
      positions: ["fa1", "fa2", "flightAttendant"],
      crewIds: [],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isSystem: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "grp_dispatch",
      name: "Flight Dispatch & Ops",
      nameAr: "مجموعة الترحيل الجوي",
      description: "Flight Dispatchers, Loadmasters & Aviation Security",
      color: "indigo",
      positions: ["flightDispatcher", "loadmaster", "security"],
      crewIds: [],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isSystem: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "grp_engineering",
      name: "Engineering & Line Maintenance",
      nameAr: "مجموعة المهندسين والصيانة",
      description: "Flight Engineers & CAMO Technical Crew",
      color: "emerald",
      positions: ["engineer"],
      crewIds: [],
      visibility: "restricted",
      viewRoles: ["superAdmin", "camo", "dispatcher", "captain"],
      editRoles: ["superAdmin", "camo", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isSystem: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function extractCrewRoles(member) {
  if (!member) return [];
  const roles = new Set();
  if (member.role) roles.add(norm(member.role));
  if (member.position) roles.add(norm(member.position));

  let sec = member.secondaryRoles;
  if (typeof sec === "string" && sec.trim()) {
    try {
      sec = JSON.parse(sec);
    } catch {
      sec = sec.split(",").map((s) => s.trim());
    }
  }
  if (Array.isArray(sec)) {
    sec.forEach((r) => {
      if (r) roles.add(norm(r));
    });
  }

  // Expand aviation position aliases so FA1/FA2 <-> flightAttendant and FD <-> dispatcher match seamlessly
  if (roles.has("flightattendant") || roles.has("fa1") || roles.has("fa2")) {
    roles.add("flightattendant");
    roles.add("fa1");
    roles.add("fa2");
  }
  if (roles.has("flightdispatcher") || roles.has("dispatcher")) {
    roles.add("flightdispatcher");
    roles.add("dispatcher");
  }
  return Array.from(roles);
}

export function crewBelongsToRosterGroup(member, group) {
  if (!member || !group) return false;
  const cid = String(member.id || "").trim();
  const emp = norm(member.empNo);

  if (Array.isArray(group.crewIds) && group.crewIds.length > 0) {
    const matchedExplicit = group.crewIds.some((idVal) => {
      const clean = String(idVal || "").trim();
      return (cid && clean === cid) || (emp && norm(clean) === emp);
    });
    if (matchedExplicit) return true;
  }

  if (Array.isArray(group.positions) && group.positions.length > 0) {
    const memberRoles = extractCrewRoles(member);
    const groupPosSet = new Set(group.positions.map((p) => norm(p)));
    if (
      groupPosSet.has("fa1") ||
      groupPosSet.has("fa2") ||
      groupPosSet.has("flightattendant")
    ) {
      groupPosSet.add("flightattendant");
    }
    return memberRoles.some((r) => groupPosSet.has(r));
  }

  return false;
}

function isAdminUser(user) {
  if (!user) return false;
  if (ADMIN_ROLES.has(norm(user.role))) return true;
  if (Array.isArray(user.perms) && user.perms.includes("*")) return true;
  return false;
}

function roleMatches(user, list = []) {
  if (!user || !Array.isArray(list) || list.length === 0) return false;
  const r = norm(user.role);
  return Boolean(r) && list.some((item) => norm(item) === r);
}

function userMatches(user, list = []) {
  if (!user || !Array.isArray(list) || list.length === 0) return false;
  const uid = norm(user.id);
  const uname = norm(user.username);
  const uemail = norm(user.email);
  return list.some((entry) => {
    const n = norm(entry);
    return (
      Boolean(n) &&
      ((uid && n === uid) || (uname && n === uname) || (uemail && n === uemail))
    );
  });
}

export function canUserManageRosterGroups(user, canFn) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (typeof canFn !== "function") return false;
  return canFn("roster.manage_groups") || canFn("users.perms");
}

export function canUserEditRosterGroup(group, user, canFn) {
  if (!group || !user) return false;
  if (isAdminUser(user)) return true;
  if (canUserManageRosterGroups(user, canFn)) return true;
  if (roleMatches(user, group.editRoles)) return true;
  if (userMatches(user, group.editUsers)) return true;
  if (typeof canFn === "function") {
    const keys = getRosterGroupPermKeys(group.id);
    if (canFn(keys.edit)) return true;
  }
  return false;
}

export function canUserViewRosterGroup(group, user, canFn, crew = []) {
  if (!group || !user) return false;
  if (isAdminUser(user)) return true;
  if (canUserEditRosterGroup(group, user, canFn)) return true;
  if (typeof canFn === "function" && canFn("roster.view_all_groups")) return true;
  if (group.visibility === "all") return true;
  if (roleMatches(user, group.viewRoles)) return true;
  if (userMatches(user, group.viewUsers)) return true;
  if (typeof canFn === "function") {
    const keys = getRosterGroupPermKeys(group.id);
    if (canFn(keys.view)) return true;
  }

  // Also allow a crew member to view the group they personally belong to
  if (Array.isArray(crew) && crew.length > 0) {
    const linkedMember = crew.find((c) => {
      if (user.crewId && String(c.id) === String(user.crewId)) return true;
      const uEmail = norm(user.email);
      const uName = norm(user.username);
      if (uEmail && norm(c.email) === uEmail) return true;
      if (uName && norm(c.empNo) === uName) return true;
      return false;
    });
    if (linkedMember && crewBelongsToRosterGroup(linkedMember, group)) {
      return true;
    }
  }

  return false;
}

export function useRosterGroups({ user, can, crew = [] }) {
  const [groups, setGroups] = useState(() => {
    const cached = readSheetCache("RosterGroups", []);
    if (Array.isArray(cached) && cached.length > 0) {
      setGlobalRosterGroups(cached);
      return cached;
    }
    const seeded = buildDefaultRosterGroups();
    setGlobalRosterGroups(seeded);
    return seeded;
  });

  const [syncState, setSyncState] = useState("idle");

  useEffect(() => {
    const onCache = (e) => {
      if (!e?.detail?.sheetName || e.detail.sheetName === "RosterGroups") {
        const latest = readSheetCache("RosterGroups", []);
        if (Array.isArray(latest) && latest.length > 0) {
          setGroups(latest);
          setGlobalRosterGroups(latest);
        }
      }
    };
    window.addEventListener("aeroops:sheetCacheUpdated", onCache);
    return () =>
      window.removeEventListener("aeroops:sheetCacheUpdated", onCache);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSyncState("syncing");
    rosterGroupsAPI
      .list()
      .then(async (remote) => {
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length > 0) {
          setGroups(remote);
          setGlobalRosterGroups(remote);
          setSyncState("synced");
        } else {
          const alreadySeeded =
            typeof window !== "undefined" &&
            window.localStorage.getItem(SEEDED_ROSTER_GROUPS_KEY) === "1";
          const defaults = buildDefaultRosterGroups();
          writeSheetCache("RosterGroups", defaults);
          setGroups(defaults);
          setGlobalRosterGroups(defaults);
          if (!alreadySeeded) {
            try {
              window.localStorage.setItem(SEEDED_ROSTER_GROUPS_KEY, "1");
            } catch {}
            await rosterGroupsAPI.saveAll(defaults).catch(() => {});
          }
          setSyncState("synced");
        }
      })
      .catch(() => {
        if (!cancelled) setSyncState("local");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const persistGroups = useCallback(async (nextList) => {
    writeSheetCache("RosterGroups", nextList);
    setGroups(nextList);
    setGlobalRosterGroups(nextList);
    setSyncState("syncing");
    try {
      await rosterGroupsAPI.saveAll(nextList);
      setSyncState("synced");
    } catch {
      setSyncState("local");
    }
    return nextList;
  }, []);

  const createGroup = useCallback(
    async (payload) => {
      const now = new Date().toISOString();
      const id =
        payload.id ||
        `grp_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;
      const editRoles = Array.isArray(payload.editRoles)
        ? payload.editRoles
        : [];
      const viewRoles = Array.from(
        new Set([
          ...(Array.isArray(payload.viewRoles) ? payload.viewRoles : []),
          ...editRoles,
        ])
      );
      const editUsers = Array.isArray(payload.editUsers)
        ? payload.editUsers
        : [];
      const viewUsers = Array.from(
        new Set([
          ...(Array.isArray(payload.viewUsers) ? payload.viewUsers : []),
          ...editUsers,
        ])
      );
      const newGroup = {
        id,
        name: String(payload.name || payload.nameAr || "Crew Group").trim(),
        nameAr: String(payload.nameAr || payload.name || "مجموعة روستر").trim(),
        description: String(payload.description || "").trim(),
        color: payload.color || "sky",
        positions: Array.isArray(payload.positions) ? payload.positions : [],
        crewIds: Array.isArray(payload.crewIds) ? payload.crewIds : [],
        visibility: payload.visibility === "all" ? "all" : "restricted",
        viewRoles,
        editRoles,
        viewUsers,
        editUsers,
        isSystem: false,
        createdBy: String(user?.username || user?.id || "admin"),
        createdAt: now,
        updatedAt: now,
      };
      const next = [...groups, newGroup];
      await persistGroups(next);
      return newGroup;
    },
    [groups, persistGroups, user]
  );

  const updateGroup = useCallback(
    async (id, patch) => {
      const now = new Date().toISOString();
      const next = groups.map((g) => {
        if (g.id !== id) return g;
        const editRoles = Array.isArray(patch.editRoles)
          ? patch.editRoles
          : g.editRoles;
        const viewRoles = Array.from(
          new Set([
            ...(Array.isArray(patch.viewRoles) ? patch.viewRoles : g.viewRoles),
            ...editRoles,
          ])
        );
        const editUsers = Array.isArray(patch.editUsers)
          ? patch.editUsers
          : g.editUsers;
        const viewUsers = Array.from(
          new Set([
            ...(Array.isArray(patch.viewUsers) ? patch.viewUsers : g.viewUsers),
            ...editUsers,
          ])
        );
        return {
          ...g,
          ...patch,
          name:
            patch.name !== undefined
              ? String(patch.name || patch.nameAr || g.name).trim()
              : g.name,
          nameAr:
            patch.nameAr !== undefined
              ? String(patch.nameAr || patch.name || g.nameAr).trim()
              : g.nameAr,
          viewRoles,
          editRoles,
          viewUsers,
          editUsers,
          updatedAt: now,
        };
      });
      await persistGroups(next);
      return next.find((x) => x.id === id) || null;
    },
    [groups, persistGroups]
  );

  const deleteGroup = useCallback(
    async (id) => {
      const next = groups.filter((g) => g.id !== id);
      await persistGroups(next);
    },
    [groups, persistGroups]
  );

  const visibleGroups = useMemo(
    () => groups.filter((g) => canUserViewRosterGroup(g, user, can, crew)),
    [groups, user, can, crew]
  );

  const canManageGroups = useMemo(
    () => canUserManageRosterGroups(user, can),
    [user, can]
  );

  return {
    allGroups: groups,
    visibleGroups,
    canManageGroups,
    syncState,
    createGroup,
    updateGroup,
    deleteGroup,
  };
}

export function RosterGroupsModal({
  open,
  mode = "directory", // "directory" | "create" | "edit"
  initialGroup = null,
  groups = [],
  crew = [],
  roles = [],
  users = [],
  settings = {},
  activeGroupId = "",
  onSelectGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onClose,
  lang = "en",
}) {
  const isAr = lang === "ar";
  const [viewMode, setViewMode] = useState(mode);
  const [editingTarget, setEditingTarget] = useState(initialGroup);
  const [saving, setSaving] = useState(false);
  const [crewSearch, setCrewSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    description: "",
    color: "sky",
    positions: [],
    crewIds: [],
    visibility: "restricted",
    viewRoles: ["superAdmin", "dispatcher", "captain"],
    editRoles: ["superAdmin", "dispatcher"],
    viewUsers: [],
    editUsers: [],
  });

  const positionOptions = useMemo(() => {
    const base = getPositionOptions(settings);
    const hasGenericFa = base.some((p) => p.key === "flightAttendant");
    return hasGenericFa
      ? base
      : [
          ...base,
          {
            key: "flightAttendant",
            en: "Cabin Attendant (FA)",
            ar: "مضيف جوي عام",
            short: "FA",
          },
        ];
  }, [settings]);

  const roleOptions = useMemo(() => {
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
      const k = norm(r.name);
      if (!map.has(k)) {
        map.set(k, {
          key: r.name,
          labelEn: r.name,
          labelAr: r.nameAr || r.name,
          isSuper: k === "superadmin",
        });
      }
    });
    return Array.from(map.values());
  }, [roles]);

  useEffect(() => {
    if (!open) return;
    setViewMode(mode);
    setEditingTarget(initialGroup || null);
    setCrewSearch("");
    setUserSearch("");

    if (mode === "edit" && initialGroup) {
      setForm({
        name: initialGroup.name || "",
        nameAr: initialGroup.nameAr || "",
        description: initialGroup.description || "",
        color: initialGroup.color || "sky",
        positions: Array.isArray(initialGroup.positions)
          ? [...initialGroup.positions]
          : [],
        crewIds: Array.isArray(initialGroup.crewIds)
          ? [...initialGroup.crewIds]
          : [],
        visibility: initialGroup.visibility || "restricted",
        viewRoles: Array.isArray(initialGroup.viewRoles)
          ? [...initialGroup.viewRoles]
          : [],
        editRoles: Array.isArray(initialGroup.editRoles)
          ? [...initialGroup.editRoles]
          : [],
        viewUsers: Array.isArray(initialGroup.viewUsers)
          ? [...initialGroup.viewUsers]
          : [],
        editUsers: Array.isArray(initialGroup.editUsers)
          ? [...initialGroup.editUsers]
          : [],
      });
    } else if (mode === "create") {
      setForm({
        name: "",
        nameAr: "",
        description: "",
        color: "sky",
        positions: [],
        crewIds: [],
        visibility: "restricted",
        viewRoles: ["superAdmin", "dispatcher", "captain"],
        editRoles: ["superAdmin", "dispatcher"],
        viewUsers: [],
        editUsers: [],
      });
    }
  }, [open, mode, initialGroup]);

  const filteredCrew = useMemo(() => {
    const q = norm(crewSearch);
    const active = (Array.isArray(crew) ? crew : []).filter(
      (c) => c.status !== "inactive"
    );
    if (!q) return active;
    return active.filter(
      (c) =>
        norm(c.fullName).includes(q) ||
        norm(c.empNo).includes(q) ||
        norm(c.role).includes(q)
    );
  }, [crew, crewSearch]);

  const filteredUsers = useMemo(() => {
    const q = norm(userSearch);
    const list = Array.isArray(users) ? users : [];
    if (!q) return list;
    return list.filter(
      (u) =>
        norm(u.fullName).includes(q) ||
        norm(u.username).includes(q) ||
        norm(u.role).includes(q)
    );
  }, [users, userSearch]);

  if (!open) return null;

  const startCreate = () => {
    setEditingTarget(null);
    setForm({
      name: "",
      nameAr: "",
      description: "",
      color: "sky",
      positions: [],
      crewIds: [],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
    });
    setViewMode("create");
  };

  const startEdit = (grp) => {
    setEditingTarget(grp);
    setForm({
      name: grp.name || "",
      nameAr: grp.nameAr || "",
      description: grp.description || "",
      color: grp.color || "sky",
      positions: Array.isArray(grp.positions) ? [...grp.positions] : [],
      crewIds: Array.isArray(grp.crewIds) ? [...grp.crewIds] : [],
      visibility: grp.visibility || "restricted",
      viewRoles: Array.isArray(grp.viewRoles) ? [...grp.viewRoles] : [],
      editRoles: Array.isArray(grp.editRoles) ? [...grp.editRoles] : [],
      viewUsers: Array.isArray(grp.viewUsers) ? [...grp.viewUsers] : [],
      editUsers: Array.isArray(grp.editUsers) ? [...grp.editUsers] : [],
    });
    setViewMode("edit");
  };

  const togglePosition = (posKey) => {
    setForm((prev) => ({
      ...prev,
      positions: prev.positions.includes(posKey)
        ? prev.positions.filter((x) => x !== posKey)
        : [...prev.positions, posKey],
    }));
  };

  const toggleCrewId = (cid) => {
    const clean = String(cid);
    setForm((prev) => ({
      ...prev,
      crewIds: prev.crewIds.includes(clean)
        ? prev.crewIds.filter((x) => x !== clean)
        : [...prev.crewIds, clean],
    }));
  };

  const hasRoleIn = (arr, roleKey) =>
    (arr || []).some((r) => norm(r) === norm(roleKey));

  const toggleRoleView = (roleKey) => {
    setForm((prev) => {
      const exists = hasRoleIn(prev.viewRoles, roleKey);
      if (exists) {
        return {
          ...prev,
          viewRoles: prev.viewRoles.filter((r) => norm(r) !== norm(roleKey)),
          editRoles: prev.editRoles.filter((r) => norm(r) !== norm(roleKey)),
        };
      }
      return { ...prev, viewRoles: [...prev.viewRoles, roleKey] };
    });
  };

  const toggleRoleEdit = (roleKey) => {
    setForm((prev) => {
      const exists = hasRoleIn(prev.editRoles, roleKey);
      if (exists) {
        return {
          ...prev,
          editRoles: prev.editRoles.filter((r) => norm(r) !== norm(roleKey)),
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

  const getUserTok = (u) => norm(u?.username || u?.id);
  const hasUserIn = (arr, u) => {
    const tok = getUserTok(u);
    return Boolean(tok) && (arr || []).some((x) => norm(x) === tok);
  };

  const toggleUserView = (u) => {
    const tok = getUserTok(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.viewUsers, u);
      if (exists) {
        return {
          ...prev,
          viewUsers: prev.viewUsers.filter((x) => norm(x) !== tok),
          editUsers: prev.editUsers.filter((x) => norm(x) !== tok),
        };
      }
      return { ...prev, viewUsers: [...prev.viewUsers, tok] };
    });
  };

  const toggleUserEdit = (u) => {
    const tok = getUserTok(u);
    if (!tok) return;
    setForm((prev) => {
      const exists = hasUserIn(prev.editUsers, u);
      if (exists) {
        return {
          ...prev,
          editUsers: prev.editUsers.filter((x) => norm(x) !== tok),
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

  const handleSave = async (e) => {
    e?.preventDefault();
    const cleanAr = String(form.nameAr || form.name || "").trim();
    const cleanEn = String(form.name || form.nameAr || "").trim();
    if (!cleanAr && !cleanEn) {
      showToast(
        isAr ? "يرجى إدخال اسم المجموعة" : "Please enter group name",
        "warning"
      );
      return;
    }

    setSaving(true);
    try {
      if (viewMode === "create") {
        const created = await onCreateGroup?.({
          ...form,
          name: cleanEn,
          nameAr: cleanAr,
        });
        if (created?.id) onSelectGroup?.(created.id);
        showToast(
          isAr
            ? "✅ تمت إضافة مجموعة الروستر وحفظ صلاحياتها ومزامنتها"
            : "✅ Roster group created and permissions synced",
          "success"
        );
      } else if (viewMode === "edit" && editingTarget) {
        await onUpdateGroup?.(editingTarget.id, {
          ...form,
          name: cleanEn,
          nameAr: cleanAr,
        });
        showToast(
          isAr
            ? "✅ تم تحديث مجموعة الروستر وصلاحياتها"
            : "✅ Roster group updated",
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

  const handleDelete = async (grp) => {
    const title = isAr ? grp.nameAr || grp.name : grp.name || grp.nameAr;
    const ok = await confirmAction(
      isAr
        ? `هل أنت متأكد من حذف المجموعة "${title}"؟`
        : `Delete roster group "${title}"?`
    );
    if (!ok) return;
    await onDeleteGroup?.(grp.id);
    showToast(isAr ? "تم حذف المجموعة" : "Group deleted", "success");
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
            {viewMode !== "directory" && groups.length > 0 && (
              <button
                type="button"
                onClick={() => setViewMode("directory")}
                className="p-1.5 rounded-lg transition hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
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
                <Users className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">
                {viewMode === "directory"
                  ? isAr
                    ? "إدارة مجموعات الروستر وصلاحياتها"
                    : "Manage Crew Roster Groups & Access"
                  : viewMode === "create"
                  ? isAr
                    ? "إضافة مجموعة روستر جديدة وتخصيص صلاحياتها"
                    : "Create New Roster Group & Permissions"
                  : isAr
                  ? "تعديل مجموعة الروستر وصلاحيات الوصول"
                  : "Edit Roster Group & Permissions"}
              </h3>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "أنشئ مجموعات (الطاقم الجوي، الضيافة، الترحيل، الصيانة، أو أي مجموعة مخصصة) وحدد الوظائف والصلاحيات"
                  : "Define crew groups by position or individual members and assign View/Edit permissions"}
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {viewMode === "directory" ? (
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className="text-xs font-semibold font-mono tabular-nums"
                style={{ color: "var(--text-muted)" }}
              >
                {isAr
                  ? `إجمالي المجموعات: ${groups.length}`
                  : `Total Roster Groups: ${groups.length}`}
              </span>
              <button
                type="button"
                onClick={startCreate}
                className="px-3.5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap shrink-0"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" />
                {isAr ? "+ إضافة مجموعة جديدة" : "+ Add Roster Group"}
              </button>
            </div>

            <div className="space-y-2.5">
              {groups.map((grp) => {
                const count = (Array.isArray(crew) ? crew : []).filter(
                  (c) =>
                    c.status !== "inactive" && crewBelongsToRosterGroup(c, grp)
                ).length;
                const isSelected = activeGroupId === grp.id;
                const theme =
                  GROUP_COLOR_THEMES[grp.color] || GROUP_COLOR_THEMES.sky;

                return (
                  <div
                    key={grp.id}
                    className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: isSelected
                        ? `1px solid ${theme.activeBorder}`
                        : "1px solid var(--border-default)",
                    }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">
                          {isAr
                            ? grp.nameAr || grp.name
                            : grp.name || grp.nameAr}
                        </span>
                        {grp.nameAr &&
                          grp.name &&
                          grp.nameAr !== grp.name && (
                            <span
                              className="text-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              ({isAr ? grp.name : grp.nameAr})
                            </span>
                          )}
                      </div>
                      <div
                        className="text-[11px] font-mono tabular-nums flex items-center gap-2 flex-wrap"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span>
                          {isAr ? `${count} عضو طاقم` : `${count} crew members`}
                        </span>
                        <span>·</span>
                        <span>
                          {isAr
                            ? `${(grp.positions || []).length} وظائف مرتبطة`
                            : `${(grp.positions || []).length} positions`}
                        </span>
                        <span>·</span>
                        {grp.visibility === "all" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {isAr ? "متاحة للجميع" : "All users"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {isAr
                              ? `${(grp.viewRoles || []).length} أدوار`
                              : `${(grp.viewRoles || []).length} roles`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectGroup?.(grp.id);
                          onClose?.();
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap shrink-0"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        {isAr ? "فتح الروستر" : "Open"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(grp)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isAr ? "تعديل وصلاحيات" : "Edit & Access"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(grp)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25 transition"
                        title={isAr ? "حذف المجموعة" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="p-5 overflow-y-auto flex-1 space-y-5"
          >
            {/* 1. Group Naming & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold">
                  {isAr ? "اسم المجموعة (بالعربية) *" : "Group Name (Arabic) *"}
                </label>
                <input
                  type="text"
                  value={form.nameAr}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, nameAr: e.target.value }))
                  }
                  placeholder={
                    isAr
                      ? "مثال: مجموعة الطاقم الجوي VIP"
                      : "e.g. مجموعة الطاقم الجوي"
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
                  {isAr ? "الاسم بالإنجليزية" : "Group Name (English) *"}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Flight Deck Crew / Cabin Crew"
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
                  {isAr ? "اللون المميز" : "Accent Color"}
                </label>
                <select
                  value={form.color}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, color: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {Object.entries(GROUP_COLOR_THEMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {isAr ? v.labelAr : v.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Automatic Position Membership */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div>
                <div className="text-xs font-bold">
                  {isAr
                    ? "1️⃣ ربط تلقائي حسب الوظيفة (Positions)"
                    : "1. Automatic Membership by Crew Position"}
                </div>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isAr
                    ? "كل عضو طاقم يحمل إحدى الوظائف المحددة يندرج تلقائياً في روستر وإجازات واحتياطي هذه المجموعة"
                    : "Any crew member holding a checked position automatically appears in this group"}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {positionOptions.map((pos) => {
                  const checked = form.positions.includes(pos.key);
                  return (
                    <label
                      key={pos.key}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs"
                      style={{
                        backgroundColor: checked
                          ? "rgba(2, 132, 199, 0.1)"
                          : "var(--bg-card)",
                        border: checked
                          ? "1px solid var(--brand-primary)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePosition(pos.key)}
                        className="w-4 h-4 accent-sky-600"
                      />
                      <span className="truncate font-semibold">
                        {isAr ? pos.ar || pos.en : pos.en || pos.ar}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Explicit Crew Members */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold">
                    {isAr
                      ? "2️⃣ أعضاء طاقم مضافون بالاسم (اختياري)"
                      : "2. Specific Crew Members (Optional)"}
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {isAr
                      ? `محدد يدوياً: ${form.crewIds.length} عضو`
                      : `Explicitly selected: ${form.crewIds.length} crew`}
                  </p>
                </div>
                <div className="relative w-full sm:w-56">
                  <Search
                    className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="text"
                    value={crewSearch}
                    onChange={(e) => setCrewSearch(e.target.value)}
                    placeholder={isAr ? "بحث باسم الطاقم..." : "Search crew..."}
                    className="w-full ps-8 pe-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                {filteredCrew.map((c) => {
                  const cid = String(c.id);
                  const checked = form.crewIds.includes(cid);
                  return (
                    <label
                      key={cid}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCrewId(cid)}
                          className="w-3.5 h-3.5 accent-sky-600 shrink-0"
                        />
                        <span className="truncate font-semibold">
                          {c.fullName}
                        </span>
                      </span>
                      <span
                        className="text-[10px] font-mono tabular-nums shrink-0"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.empNo || c.role || ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 4. Group Permissions */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Shield
                    className="w-4 h-4"
                    style={{ color: "var(--brand-primary)" }}
                  />
                  {isAr
                    ? "3️⃣ صلاحيات العرض والتعديل لهذه المجموعة"
                    : "3. Group View & Edit Permissions"}
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
                    className="px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shrink-0"
                    style={
                      form.visibility === "restricted"
                        ? {
                            backgroundColor: "var(--brand-primary)",
                            color: "#fff",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {isAr ? "مقيدة بصلاحيات" : "Restricted"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, visibility: "all" }))
                    }
                    className="px-2.5 py-1 rounded-md font-semibold whitespace-nowrap shrink-0"
                    style={
                      form.visibility === "all"
                        ? {
                            backgroundColor: "var(--brand-primary)",
                            color: "#fff",
                          }
                        : { color: "var(--text-muted)" }
                    }
                  >
                    {isAr ? "عرض للجميع" : "All Users"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {roleOptions.map((r) => {
                  const canV =
                    r.isSuper ||
                    form.visibility === "all" ||
                    hasRoleIn(form.viewRoles, r.key);
                  const canE = r.isSuper || hasRoleIn(form.editRoles, r.key);
                  return (
                    <div
                      key={r.key}
                      className="px-3 py-2 rounded-lg flex items-center justify-between gap-2 text-xs"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      <span className="font-semibold truncate">
                        {isAr ? r.labelAr : r.labelEn}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canV}
                            disabled={r.isSuper || form.visibility === "all"}
                            onChange={() => toggleRoleView(r.key)}
                            className="w-3.5 h-3.5 accent-sky-600"
                          />
                          <span className="text-[11px]">
                            {isAr ? "عرض" : "View"}
                          </span>
                        </label>
                        <label className="inline-flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={canE}
                            disabled={r.isSuper}
                            onChange={() => toggleRoleEdit(r.key)}
                            className="w-3.5 h-3.5 accent-emerald-600"
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

              {users.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[11px] font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {isAr
                        ? "استثناءات مستخدمين محددين:"
                        : "Specific User Grants:"}
                    </span>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={isAr ? "بحث عن مستخدم..." : "Filter users..."}
                      className="px-2.5 py-1 rounded text-xs outline-none w-44"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const canV =
                        form.visibility === "all" ||
                        hasUserIn(form.viewUsers, u);
                      const canE = hasUserIn(form.editUsers, u);
                      return (
                        <div
                          key={u.id || u.username}
                          className="px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-default)",
                          }}
                        >
                          <span className="truncate">
                            <strong>{u.fullName || u.username}</strong>{" "}
                            <span style={{ color: "var(--text-muted)" }}>
                              ({getRoleLabel(u.role, lang)})
                            </span>
                          </span>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={canV}
                                disabled={form.visibility === "all"}
                                onChange={() => toggleUserView(u)}
                                className="w-3.5 h-3.5 accent-sky-600"
                              />
                              <span className="text-[10px]">
                                {isAr ? "عرض" : "V"}
                              </span>
                            </label>
                            <label className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={canE}
                                onChange={() => toggleUserEdit(u)}
                                className="w-3.5 h-3.5 accent-emerald-600"
                              />
                              <span className="text-[10px]">
                                {isAr ? "تعديل" : "E"}
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

            <div
              className="flex justify-end gap-2 pt-3"
              style={{ borderTop: "1px solid var(--border-default)" }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Save className="w-3.5 h-3.5" />
                {saving
                  ? isAr
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : isAr
                  ? "حفظ المجموعة والصلاحيات"
                  : "Save Group & Permissions"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default RosterGroupsModal;
