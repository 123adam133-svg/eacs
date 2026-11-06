/* ═══════════════════════════════════════════════════════════
 * USE DASHBOARD LAYOUT — Per-User Layout Persistence Hook
 * Dual Persistence:
 *   1. localStorage (instant per-browser render)
 *   2. Google Sheets via dashboardLayoutsAPI (cross-device sync)
 * Supports Normal Mode auto-save on drag & Edit Mode draft/save/cancel.
 * ═══════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback, useRef } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { dashboardLayoutsAPI } from "../api";
import {
  WIDGETS_BY_ID,
  DASHBOARD_PRESETS,
  canUserSeeWidget,
  getDefaultLayoutForUser,
} from "./widgetRegistry";

const STORAGE_PREFIX = "aeroops.dashboard.layout.v1.";

function getUserStorageKey(user) {
  const idPart = String(user?.id || user?.username || "guest")
    .trim()
    .toLowerCase();
  return `${STORAGE_PREFIX}${idPart}`;
}

function getUserCloudKey(user) {
  return String(user?.username || user?.id || "guest")
    .trim()
    .toLowerCase();
}

function sanitizeLayoutItems(rawItems, canFn) {
  if (!Array.isArray(rawItems)) return [];
  const seen = new Set();
  const validSizes = new Set(["small", "medium", "large"]);
  const result = [];

  for (const entry of rawItems) {
    const id = typeof entry === "string" ? entry : entry?.id;
    if (!id || seen.has(id)) continue;
    const def = WIDGETS_BY_ID[id];
    if (!def) continue;
    if (canFn && !canUserSeeWidget(def, canFn)) continue;
    seen.add(id);
    const chosenSize = validSizes.has(entry?.size)
      ? entry.size
      : def.defaultSize || "medium";
    result.push({ id, size: chosenSize });
  }
  return result;
}

function readLocalLayout(storageKey) {
  if (typeof window === "undefined" || !storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.widgets)) {
      return parsed;
    }
  } catch {}
  return null;
}

function writeLocalLayout(storageKey, payload) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {}
}

export function useDashboardLayout(user, canFn) {
  const storageKey = getUserStorageKey(user);
  const cloudKey = getUserCloudKey(user);

  const [savedWidgets, setSavedWidgets] = useState(() => {
    const local = readLocalLayout(storageKey);
    if (local && local.widgets.length > 0) {
      const cleaned = sanitizeLayoutItems(local.widgets, canFn);
      if (cleaned.length > 0) return cleaned;
    }
    return getDefaultLayoutForUser(user, canFn);
  });

  const [editMode, setEditMode] = useState(false);
  const [draftWidgets, setDraftWidgets] = useState(savedWidgets);
  const [cloudSyncState, setCloudSyncState] = useState("idle"); // idle | syncing | synced | local
  const [activePreset, setActivePreset] = useState("default");
  const lastUpdatedAtRef = useRef("");

  // Re-initialize when user identity changes
  useEffect(() => {
    const local = readLocalLayout(storageKey);
    let initial = [];
    if (local && Array.isArray(local.widgets) && local.widgets.length > 0) {
      lastUpdatedAtRef.current = local.updatedAt || "";
      setActivePreset(local.presetId || "custom");
      initial = sanitizeLayoutItems(local.widgets, canFn);
    }
    if (initial.length === 0) {
      initial = getDefaultLayoutForUser(user, canFn);
      setActivePreset("default");
    }
    setSavedWidgets(initial);
    setDraftWidgets(initial);
    setEditMode(false);
  }, [storageKey]);

  // Background cross-device sync from Google Sheets
  useEffect(() => {
    if (!user || !cloudKey || cloudKey === "guest") return;
    let cancelled = false;
    setCloudSyncState("syncing");

    dashboardLayoutsAPI
      .getForUser(cloudKey)
      .then((remote) => {
        if (cancelled) return;
        if (remote && Array.isArray(remote.widgets) && remote.widgets.length > 0) {
          const remoteTs = remote.updatedAt || "";
          const local = readLocalLayout(storageKey);
          const localTs = local?.updatedAt || "";

          // Adopt remote if newer or if no local layout exists
          if (!local || !localTs || remoteTs >= localTs) {
            const cleaned = sanitizeLayoutItems(remote.widgets, canFn);
            if (cleaned.length > 0) {
              lastUpdatedAtRef.current = remoteTs;
              writeLocalLayout(storageKey, {
                widgets: cleaned,
                presetId: remote.presetId || "custom",
                updatedAt: remoteTs,
              });
              setSavedWidgets(cleaned);
              setDraftWidgets((prev) => (editMode ? prev : cleaned));
              setActivePreset(remote.presetId || "custom");
            }
          }
        }
        setCloudSyncState("synced");
      })
      .catch(() => {
        if (!cancelled) setCloudSyncState("local");
      });

    return () => {
      cancelled = true;
    };
  }, [cloudKey, storageKey]);

  const persistLayout = useCallback(
    async (widgetsToSave, presetId = "custom") => {
      const cleaned = sanitizeLayoutItems(widgetsToSave, canFn);
      const updatedAt = new Date().toISOString();
      lastUpdatedAtRef.current = updatedAt;

      const payload = {
        widgets: cleaned,
        presetId,
        updatedAt,
      };

      // 1. Instant localStorage save
      writeLocalLayout(storageKey, payload);
      setSavedWidgets(cleaned);
      setDraftWidgets(cleaned);
      setActivePreset(presetId);

      // 2. Google Sheets cross-device sync
      if (user && cloudKey && cloudKey !== "guest") {
        setCloudSyncState("syncing");
        try {
          await dashboardLayoutsAPI.saveForUser(cloudKey, user, payload);
          setCloudSyncState("synced");
        } catch {
          setCloudSyncState("local");
        }
      }
      return cleaned;
    },
    [storageKey, cloudKey, user, canFn]
  );

  /* ── Edit Mode Controls ── */
  const enterEditMode = useCallback(() => {
    setDraftWidgets(savedWidgets);
    setEditMode(true);
  }, [savedWidgets]);

  const cancelEditMode = useCallback(() => {
    setDraftWidgets(savedWidgets);
    setEditMode(false);
  }, [savedWidgets]);

  const saveEditMode = useCallback(async () => {
    await persistLayout(draftWidgets, activePreset || "custom");
    setEditMode(false);
  }, [draftWidgets, activePreset, persistLayout]);

  /* ── Widget Operations ── */
  const reorderWidgets = useCallback(
    (activeId, overId) => {
      if (!activeId || !overId || activeId === overId) return;

      if (editMode) {
        setDraftWidgets((prev) => {
          const oldIdx = prev.findIndex((w) => w.id === activeId);
          const newIdx = prev.findIndex((w) => w.id === overId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          setActivePreset("custom");
          return arrayMove(prev, oldIdx, newIdx);
        });
      } else {
        // Normal Mode long-press drag & drop -> auto-save immediately!
        setSavedWidgets((prev) => {
          const oldIdx = prev.findIndex((w) => w.id === activeId);
          const newIdx = prev.findIndex((w) => w.id === overId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          const next = arrayMove(prev, oldIdx, newIdx);
          persistLayout(next, "custom");
          return next;
        });
      }
    },
    [editMode, persistLayout]
  );

  const removeWidget = useCallback((widgetId) => {
    setDraftWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setActivePreset("custom");
  }, []);

  const addWidget = useCallback((widgetId, sizeOverride) => {
    const def = WIDGETS_BY_ID[widgetId];
    if (!def) return;
    setDraftWidgets((prev) => {
      if (prev.some((w) => w.id === widgetId)) return prev;
      return [
        ...prev,
        { id: widgetId, size: sizeOverride || def.defaultSize || "medium" },
      ];
    });
    setActivePreset("custom");
  }, []);

  const resizeWidget = useCallback((widgetId, nextSize) => {
    setDraftWidgets((prev) =>
      prev.map((w) => (w.id === widgetId ? { ...w, size: nextSize } : w))
    );
    setActivePreset("custom");
  }, []);

  const applyPreset = useCallback(
    async (presetKey, immediateSave = false) => {
      let nextItems = [];
      if (presetKey === "default") {
        nextItems = getDefaultLayoutForUser(user, canFn);
      } else if (DASHBOARD_PRESETS[presetKey]) {
        nextItems = sanitizeLayoutItems(
          DASHBOARD_PRESETS[presetKey].items,
          canFn
        );
      }
      if (nextItems.length === 0) {
        nextItems = getDefaultLayoutForUser(user, canFn);
      }

      if (immediateSave && !editMode) {
        await persistLayout(nextItems, presetKey);
      } else {
        setDraftWidgets(nextItems);
        setActivePreset(presetKey);
      }
    },
    [user, canFn, editMode, persistLayout]
  );

  const activeWidgets = editMode ? draftWidgets : savedWidgets;

  return {
    activeWidgets,
    editMode,
    cloudSyncState,
    activePreset,
    enterEditMode,
    cancelEditMode,
    saveEditMode,
    reorderWidgets,
    removeWidget,
    addWidget,
    resizeWidget,
    applyPreset,
  };
}
