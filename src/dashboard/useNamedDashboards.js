/* ═══════════════════════════════════════════════════════════
 * USE NAMED DASHBOARDS — Multi-Dashboard Storage, Naming & RBAC
 * Supports storing multiple named dashboards across Main & Quality
 * sections with per-dashboard Role & User View/Edit permissions,
 * synced to Google Sheets + instant localStorage cache.
 * ═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  namedDashboardsAPI,
  readSheetCache,
  writeSheetCache,
} from "../api";
import {
  setGlobalNamedDashboards,
  getNamedDashboardPermKeys,
} from "../config/permissions";
import {
  WIDGETS_BY_ID,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
} from "./widgetRegistry";

const ACTIVE_SELECTION_PREFIX = "aeroops.namedDash.active.v1.";
const SEEDED_FLAG_KEY = "aeroops.namedDash.seeded.v1";

const ADMIN_ROLES = new Set([
  "superadmin",
  "super_admin",
  "super-admin",
  "admin",
  "administrator",
  "owner",
  "root",
]);

function normalizeStr(val) {
  return String(val || "")
    .trim()
    .toLowerCase();
}

export function buildDefaultSeededDashboards() {
  const now = new Date().toISOString();
  return [
    {
      id: "qd_master_compliance",
      name: "Quality & Compliance Master",
      nameAr: "لوحة الجودة والامتثال الشاملة",
      description:
        "Comprehensive aviation quality assurance, statutory compliance, and CAPA overview",
      scope: "quality",
      widgets: [
        { id: "compliance-score", size: "medium" },
        { id: "quality-audits-capa", size: "medium" },
        { id: "expiring-docs-radar", size: "medium" },
        { id: "camo-mel-watch", size: "medium" },
        { id: "training-qualification", size: "small" },
        { id: "manuals-currency", size: "small" },
        { id: "otp-dispatch-quality", size: "small" },
        { id: "alerts-manager", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "camo", "captain"],
      editRoles: ["superAdmin", "dispatcher", "camo"],
      viewUsers: [],
      editUsers: [],
      isDefault: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "qd_camo_airworthiness",
      name: "Airworthiness & CAMO Quality",
      nameAr: "جودة صلاحية الأسطول والأعطال (CAMO)",
      description:
        "Focused airworthiness monitoring, MEL deferred defects, and aircraft certificate validity",
      scope: "quality",
      widgets: [
        { id: "camo-mel-watch", size: "medium" },
        { id: "fleet-readiness", size: "medium" },
        { id: "compliance-score", size: "medium" },
        { id: "expiring-docs-radar", size: "medium" },
        { id: "quality-audits-capa", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "camo", "dispatcher", "captain"],
      editRoles: ["superAdmin", "camo"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "qd_crew_training_qa",
      name: "Crew Licensing & Training QA",
      nameAr: "جودة تراخيص وتدريب الطاقم",
      description:
        "Monitors pilot/cabin crew licenses, medicals, recurrent simulator checks, and FTL limits",
      scope: "quality",
      widgets: [
        { id: "training-qualification", size: "medium" },
        { id: "crew-duty-ftl", size: "medium" },
        { id: "expiring-docs-radar", size: "medium" },
        { id: "manuals-currency", size: "medium" },
        { id: "compliance-score", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "md_occ_operations",
      name: "OCC Flight Operations Center",
      nameAr: "لوحة مركز العمليات الجوية (OCC)",
      description:
        "Shared live flight watch, fleet readiness, permits, catering, and standby duty monitor",
      scope: "main",
      widgets: [
        { id: "ops-kpi-overview", size: "large" },
        { id: "flight-watch", size: "medium" },
        { id: "permits-catering-ops", size: "medium" },
        { id: "fleet-readiness", size: "small" },
        { id: "crew-duty-ftl", size: "small" },
        { id: "standby-leave-pulse", size: "small" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cd_camo_master",
      name: "CAMO Airworthiness Master",
      nameAr: "لوحة إدارة الصلاحية الشاملة (CAMO)",
      description:
        "Aircraft airworthiness readiness, scheduled checks, MEL defects, and certificate expiry monitor",
      scope: "camo",
      widgets: [
        { id: "camo-checks-schedule", size: "medium" },
        { id: "camo-mel-watch", size: "medium" },
        { id: "camo-components-status", size: "medium" },
        { id: "expiring-docs-radar", size: "medium" },
        { id: "fleet-readiness", size: "small" },
        { id: "compliance-score", size: "small" },
        { id: "quality-audits-capa", size: "small" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "camo", "dispatcher", "captain"],
      editRoles: ["superAdmin", "camo", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "cd_checks_components",
      name: "Engines, Checks & MEL Control",
      nameAr: "لوحة الفحوصات والمحركات والأعطال (MEL)",
      description:
        "Focused engineering view for TAH/TAC checks, engine/APU/LLP hours, and open MEL items",
      scope: "camo",
      widgets: [
        { id: "camo-components-status", size: "large" },
        { id: "camo-checks-schedule", size: "medium" },
        { id: "camo-mel-watch", size: "medium" },
        { id: "alerts-manager", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "camo", "dispatcher"],
      editRoles: ["superAdmin", "camo"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "td_training_master",
      name: "Crew Training & Qualification Overview",
      nameAr: "لوحة التدريب وتأهيل الطاقم الشاملة",
      description:
        "Live simulator & recurrent check pass rates, course matrix, and upcoming certificate renewals",
      scope: "training",
      widgets: [
        { id: "training-type-breakdown", size: "medium" },
        { id: "training-upcoming-renewals", size: "medium" },
        { id: "training-qualification", size: "small" },
        { id: "crew-duty-ftl", size: "small" },
        { id: "manuals-currency", size: "small" },
        { id: "expiring-docs-radar", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain", "camo", "crewMember"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "td_sim_recurrent",
      name: "Simulator, LPC/OPC & Medical Watch",
      nameAr: "لوحة المحاكي والفحوصات الدورية والطبية",
      description:
        "Tracks simulator proficiency checks, LPC/OPC renewals, and crew medical/license validity",
      scope: "training",
      widgets: [
        { id: "training-upcoming-renewals", size: "large" },
        { id: "training-qualification", size: "medium" },
        { id: "training-type-breakdown", size: "medium" },
        { id: "compliance-score", size: "large" },
      ],
      visibility: "restricted",
      viewRoles: ["superAdmin", "dispatcher", "captain"],
      editRoles: ["superAdmin", "dispatcher"],
      viewUsers: [],
      editUsers: [],
      isDefault: false,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function mergeMissingScopeSeedDashboards(list = []) {
  const arr = Array.isArray(list) ? [...list] : [];
  if (arr.length === 0) return buildDefaultSeededDashboards();
  const defaults = buildDefaultSeededDashboards();
  const existingIds = new Set(arr.map((d) => d?.id).filter(Boolean));
  const requiredScopes = ["quality", "camo", "training"];
  let changed = false;
  requiredScopes.forEach((sc) => {
    const hasScope = arr.some((d) => d?.scope === sc || d?.scope === "both");
    if (!hasScope) {
      defaults
        .filter((d) => d.scope === sc)
        .forEach((seedItem) => {
          if (!existingIds.has(seedItem.id)) {
            arr.push(seedItem);
            existingIds.add(seedItem.id);
            changed = true;
          }
        });
    }
  });
  return changed ? arr : list;
}

export function isAdminUser(user) {
  if (!user) return false;
  const roleNorm = normalizeStr(user.role);
  if (ADMIN_ROLES.has(roleNorm)) return true;
  if (Array.isArray(user.perms) && user.perms.includes("*")) return true;
  return false;
}

function userMatchesList(user, list = []) {
  if (!user || !Array.isArray(list) || list.length === 0) return false;
  const uid = normalizeStr(user.id);
  const uname = normalizeStr(user.username);
  const uemail = normalizeStr(user.email);
  return list.some((entry) => {
    const norm = normalizeStr(entry);
    if (!norm) return false;
    return (
      (uid && norm === uid) ||
      (uname && norm === uname) ||
      (uemail && norm === uemail)
    );
  });
}

function roleMatchesList(user, list = []) {
  if (!user || !Array.isArray(list) || list.length === 0) return false;
  const uRole = normalizeStr(user.role);
  if (!uRole) return false;
  return list.some((r) => normalizeStr(r) === uRole);
}

export function canUserManageDashboardsInScope(scope, user, canFn) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (typeof canFn !== "function") return false;
  if (canFn("users.perms")) return true;
  if (scope === "quality") {
    return canFn("quality.manage_dashboards") || canFn("dashboard.manage_named");
  }
  if (scope === "camo") {
    return canFn("camo.manage_dashboards") || canFn("dashboard.manage_named");
  }
  if (scope === "training") {
    return canFn("training.manage_dashboards") || canFn("dashboard.manage_named");
  }
  return canFn("dashboard.manage_named") || canFn("quality.manage_dashboards");
}

export function canUserEditNamedDashboard(dash, user, canFn) {
  if (!dash || !user) return false;
  if (isAdminUser(user)) return true;

  const creatorNorm = normalizeStr(dash.createdBy);
  if (
    creatorNorm &&
    creatorNorm !== "system" &&
    (creatorNorm === normalizeStr(user.username) ||
      creatorNorm === normalizeStr(user.id))
  ) {
    return true;
  }

  if (roleMatchesList(user, dash.editRoles)) return true;
  if (userMatchesList(user, dash.editUsers)) return true;

  if (typeof canFn === "function") {
    const dynKeys = getNamedDashboardPermKeys(dash.id);
    if (canFn(dynKeys.edit)) return true;
    if (canFn("users.perms")) return true;
  }

  return false;
}

export function canUserViewNamedDashboard(dash, user, canFn) {
  if (!dash || !user) return false;
  if (isAdminUser(user)) return true;
  if (canUserEditNamedDashboard(dash, user, canFn)) return true;
  if (dash.visibility === "all") return true;

  if (roleMatchesList(user, dash.viewRoles)) return true;
  if (userMatchesList(user, dash.viewUsers)) return true;

  if (typeof canFn === "function") {
    const dynKeys = getNamedDashboardPermKeys(dash.id);
    if (canFn(dynKeys.view)) return true;
  }

  return false;
}

export function sanitizeNamedWidgetList(rawWidgets = [], canFn) {
  const validSizes = new Set(["small", "medium", "large"]);
  const seen = new Set();
  const out = [];
  (Array.isArray(rawWidgets) ? rawWidgets : []).forEach((item) => {
    const id = typeof item === "string" ? item : item?.id;
    if (!id || seen.has(id)) return;
    const def = WIDGETS_BY_ID[id];
    if (!def) return;
    if (canFn && !canUserSeeWidget(def, canFn)) return;
    seen.add(id);
    out.push({
      id,
      size: validSizes.has(item?.size) ? item.size : def.defaultSize || "medium",
    });
  });
  return out;
}

export function getPresetWidgetsByKey(templateKey) {
  if (templateKey === "camo" || templateKey === "camo_focus") {
    if (DASHBOARD_PRESETS.camo) {
      return DASHBOARD_PRESETS.camo.items.map((x) => ({ ...x }));
    }
    return [
      { id: "camo-checks-schedule", size: "medium" },
      { id: "camo-mel-watch", size: "medium" },
      { id: "camo-components-status", size: "medium" },
      { id: "expiring-docs-radar", size: "medium" },
      { id: "fleet-readiness", size: "small" },
    ];
  }
  if (templateKey === "training" || templateKey === "crew_focus") {
    if (DASHBOARD_PRESETS.training) {
      return DASHBOARD_PRESETS.training.items.map((x) => ({ ...x }));
    }
    return [
      { id: "training-type-breakdown", size: "medium" },
      { id: "training-upcoming-renewals", size: "medium" },
      { id: "training-qualification", size: "small" },
      { id: "crew-duty-ftl", size: "small" },
      { id: "expiring-docs-radar", size: "large" },
    ];
  }
  if (templateKey === "blank") {
    return [];
  }
  if (DASHBOARD_PRESETS[templateKey]) {
    return DASHBOARD_PRESETS[templateKey].items.map((x) => ({ ...x }));
  }
  return DASHBOARD_PRESETS.quality.items.map((x) => ({ ...x }));
}

export function useNamedDashboards({
  scope = "quality",
  user,
  can,
  allowPersonalOption = false,
}) {
  const userKey = normalizeStr(user?.username || user?.id || "guest");
  const selectionStorageKey = `${ACTIVE_SELECTION_PREFIX}${scope}.${userKey}`;

  const [allDashboards, setAllDashboards] = useState(() => {
    const cached = readSheetCache("NamedDashboards", []);
    if (Array.isArray(cached) && cached.length > 0) {
      const merged = mergeMissingScopeSeedDashboards(cached);
      setGlobalNamedDashboards(merged);
      return merged;
    }
    const seeded = buildDefaultSeededDashboards();
    setGlobalNamedDashboards(seeded);
    return seeded;
  });

  const [syncState, setSyncState] = useState("idle"); // idle | syncing | synced | local

  const [selectedId, setSelectedId] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(selectionStorageKey);
        if (saved) return saved;
      } catch {}
    }
    return allowPersonalOption ? "__personal__" : "";
  });

  // Listen to cache updates from other tabs/components
  useEffect(() => {
    const onCacheUpdate = (e) => {
      if (!e?.detail?.sheetName || e.detail.sheetName === "NamedDashboards") {
        const latest = readSheetCache("NamedDashboards", []);
        if (Array.isArray(latest) && latest.length > 0) {
          setAllDashboards(latest);
          setGlobalNamedDashboards(latest);
        }
      }
    };
    window.addEventListener("aeroops:sheetCacheUpdated", onCacheUpdate);
    return () =>
      window.removeEventListener("aeroops:sheetCacheUpdated", onCacheUpdate);
  }, []);

  // Sync with Google Sheets on mount
  useEffect(() => {
    let cancelled = false;
    setSyncState("syncing");
    namedDashboardsAPI
      .list()
      .then(async (remote) => {
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length > 0) {
          const merged = mergeMissingScopeSeedDashboards(remote);
          if (merged.length !== remote.length) {
            writeSheetCache("NamedDashboards", merged);
            namedDashboardsAPI.saveAll(merged).catch(() => {});
          }
          setAllDashboards(merged);
          setGlobalNamedDashboards(merged);
          setSyncState("synced");
        } else {
          // Seed initial defaults once so Google Sheets & local cache both hold them
          const alreadySeeded =
            typeof window !== "undefined" &&
            window.localStorage.getItem(SEEDED_FLAG_KEY) === "1";
          const defaults = buildDefaultSeededDashboards();
          writeSheetCache("NamedDashboards", defaults);
          setAllDashboards(defaults);
          setGlobalNamedDashboards(defaults);
          if (!alreadySeeded) {
            try {
              window.localStorage.setItem(SEEDED_FLAG_KEY, "1");
            } catch {}
            await namedDashboardsAPI.saveAll(defaults).catch(() => {});
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

  // Dashboards matching this scope ("main" | "quality" | "both")
  const scopedDashboards = useMemo(
    () =>
      allDashboards.filter(
        (d) => d.scope === scope || d.scope === "both"
      ),
    [allDashboards, scope]
  );

  // Dashboards visible to current user
  const visibleDashboards = useMemo(
    () =>
      scopedDashboards.filter((d) =>
        canUserViewNamedDashboard(d, user, can)
      ),
    [scopedDashboards, user, can]
  );

  // Ensure selectedId points to a valid permitted dashboard (or __personal__)
  useEffect(() => {
    if (allowPersonalOption && selectedId === "__personal__") return;
    const stillValid = visibleDashboards.some((d) => d.id === selectedId);
    if (!stillValid) {
      const defDash =
        visibleDashboards.find((d) => d.isDefault) || visibleDashboards[0];
      const fallbackId = defDash
        ? defDash.id
        : allowPersonalOption
        ? "__personal__"
        : "";
      if (fallbackId !== selectedId) {
        setSelectedId(fallbackId);
      }
    }
  }, [visibleDashboards, selectedId, allowPersonalOption]);

  const selectDashboard = useCallback(
    (nextId) => {
      setSelectedId(nextId);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(selectionStorageKey, nextId);
        } catch {}
      }
    },
    [selectionStorageKey]
  );

  const persistAll = useCallback(async (nextList) => {
    writeSheetCache("NamedDashboards", nextList);
    setAllDashboards(nextList);
    setGlobalNamedDashboards(nextList);
    setSyncState("syncing");
    try {
      await namedDashboardsAPI.saveAll(nextList);
      setSyncState("synced");
    } catch {
      setSyncState("local");
    }
    return nextList;
  }, []);

  const createDashboard = useCallback(
    async (payload) => {
      const now = new Date().toISOString();
      const rawName = String(payload.name || payload.nameAr || "").trim();
      const rawNameAr = String(payload.nameAr || payload.name || "").trim();
      const id =
        payload.id ||
        `nd_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;

      const rawWidgets = Array.isArray(payload.widgets)
        ? payload.widgets.map((w) => ({
            id: w.id,
            size: w.size || "medium",
          }))
        : getPresetWidgetsByKey(payload.templateKey || "quality");

      const newRecord = {
        id,
        name: rawName || "Custom Dashboard",
        nameAr: rawNameAr || rawName || "لوحة مخصصة",
        description: String(payload.description || "").trim(),
        scope: ["main", "quality", "camo", "training", "both"].includes(
          payload.scope
        )
          ? payload.scope
          : scope,
        widgets: rawWidgets,
        visibility: payload.visibility === "all" ? "all" : "restricted",
        viewRoles: Array.from(
          new Set([
            ...(Array.isArray(payload.viewRoles) ? payload.viewRoles : []),
            ...(Array.isArray(payload.editRoles) ? payload.editRoles : []),
          ])
        ),
        editRoles: Array.isArray(payload.editRoles) ? payload.editRoles : [],
        viewUsers: Array.from(
          new Set([
            ...(Array.isArray(payload.viewUsers) ? payload.viewUsers : []),
            ...(Array.isArray(payload.editUsers) ? payload.editUsers : []),
          ])
        ),
        editUsers: Array.isArray(payload.editUsers) ? payload.editUsers : [],
        isDefault: Boolean(payload.isDefault),
        createdBy: String(user?.username || user?.id || "admin"),
        createdAt: now,
        updatedAt: now,
      };

      let nextList = [...allDashboards];
      if (newRecord.isDefault) {
        nextList = nextList.map((d) =>
          d.scope === newRecord.scope ? { ...d, isDefault: false } : d
        );
      }
      nextList.push(newRecord);

      await persistAll(nextList);
      if (newRecord.scope === scope || newRecord.scope === "both") {
        selectDashboard(newRecord.id);
      }
      return newRecord;
    },
    [allDashboards, persistAll, scope, selectDashboard, user]
  );

  const updateDashboard = useCallback(
    async (id, patch) => {
      const now = new Date().toISOString();
      let nextList = allDashboards.map((d) => {
        if (d.id !== id) return d;
        const nextEditRoles = Array.isArray(patch.editRoles)
          ? patch.editRoles
          : d.editRoles;
        const nextViewRoles = Array.from(
          new Set([
            ...(Array.isArray(patch.viewRoles) ? patch.viewRoles : d.viewRoles),
            ...nextEditRoles,
          ])
        );
        const nextEditUsers = Array.isArray(patch.editUsers)
          ? patch.editUsers
          : d.editUsers;
        const nextViewUsers = Array.from(
          new Set([
            ...(Array.isArray(patch.viewUsers) ? patch.viewUsers : d.viewUsers),
            ...nextEditUsers,
          ])
        );
        const updatedName =
          patch.name !== undefined ? String(patch.name).trim() : d.name;
        const updatedNameAr =
          patch.nameAr !== undefined ? String(patch.nameAr).trim() : d.nameAr;

        return {
          ...d,
          ...patch,
          name: updatedName || updatedNameAr || d.name,
          nameAr: updatedNameAr || updatedName || d.nameAr,
          viewRoles: nextViewRoles,
          editRoles: nextEditRoles,
          viewUsers: nextViewUsers,
          editUsers: nextEditUsers,
          updatedAt: now,
        };
      });

      if (patch.isDefault) {
        const target = nextList.find((x) => x.id === id);
        if (target) {
          nextList = nextList.map((d) =>
            d.id !== id && d.scope === target.scope
              ? { ...d, isDefault: false }
              : d
          );
        }
      }

      await persistAll(nextList);
      return nextList.find((x) => x.id === id) || null;
    },
    [allDashboards, persistAll]
  );

  const saveDashboardWidgets = useCallback(
    async (id, widgets) => {
      const cleanWidgets = (Array.isArray(widgets) ? widgets : []).map((w) => ({
        id: w.id,
        size: w.size || "medium",
      }));
      return updateDashboard(id, { widgets: cleanWidgets });
    },
    [updateDashboard]
  );

  const duplicateDashboard = useCallback(
    async (sourceId) => {
      const src = allDashboards.find((d) => d.id === sourceId);
      if (!src) return null;
      return createDashboard({
        name: `${src.name} (Copy)`,
        nameAr: `${src.nameAr || src.name} (نسخة)`,
        description: src.description,
        scope: src.scope,
        widgets: src.widgets,
        visibility: src.visibility,
        viewRoles: src.viewRoles,
        editRoles: src.editRoles,
        viewUsers: src.viewUsers,
        editUsers: src.editUsers,
        isDefault: false,
      });
    },
    [allDashboards, createDashboard]
  );

  const deleteDashboard = useCallback(
    async (id) => {
      const nextList = allDashboards.filter((d) => d.id !== id);
      await persistAll(nextList);
      if (selectedId === id) {
        const remaining = nextList.filter(
          (d) =>
            (d.scope === scope || d.scope === "both") &&
            canUserViewNamedDashboard(d, user, can)
        );
        selectDashboard(
          remaining[0]?.id || (allowPersonalOption ? "__personal__" : "")
        );
      }
    },
    [
      allDashboards,
      allowPersonalOption,
      can,
      persistAll,
      scope,
      selectDashboard,
      selectedId,
      user,
    ]
  );

  const activeDashboard = useMemo(() => {
    if (allowPersonalOption && selectedId === "__personal__") return null;
    return visibleDashboards.find((d) => d.id === selectedId) || null;
  }, [allowPersonalOption, visibleDashboards, selectedId]);

  const canManage = useMemo(
    () => canUserManageDashboardsInScope(scope, user, can),
    [scope, user, can]
  );

  const canEditActive = useMemo(() => {
    if (!activeDashboard) return can ? can("dashboard.customize") : false;
    return (
      canManage || canUserEditNamedDashboard(activeDashboard, user, can)
    );
  }, [activeDashboard, canManage, user, can]);

  return {
    allDashboards,
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
  };
}
