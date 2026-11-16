/* ═══════════════════════════════════════════════════════════
 * HEADER TOOLS CONFIGURATION UTILITY
 * Manages visibility, ordering, and placement modes (Direct on Top Bar vs Grouped Menu)
 * for top bar tools (Airports, Settings, Language, Notifications, Directory, Theme).
 * ═══════════════════════════════════════════════════════════ */
import { appConfigAPI } from "../api";

export const DEFAULT_HEADER_TOOLS = [
  {
    id: "airports",
    label_ar: "دليل المطارات (Airport Directory)",
    label_en: "Airport Directory",
    icon: "Compass",
    enabled: true,
    showDirect: true,
    order: 1,
  },
  {
    id: "settings",
    label_ar: "الإعدادات (Settings)",
    label_en: "Settings",
    icon: "Settings",
    enabled: true,
    showDirect: true,
    order: 2,
  },
  {
    id: "lang",
    label_ar: "تغيير اللغة (Language Switcher)",
    label_en: "Language Switcher",
    icon: "Globe",
    enabled: true,
    showDirect: false,
    order: 3,
  },
  {
    id: "notifications",
    label_ar: "التنبيهات والإشعارات (Notifications)",
    label_en: "Notifications & Alerts",
    icon: "Bell",
    enabled: true,
    showDirect: true,
    order: 4,
  },
  {
    id: "directory",
    label_ar: "دليل هواتف العمليات (Phone Directory)",
    label_en: "Operational Directory",
    icon: "PhoneCall",
    enabled: true,
    showDirect: false,
    order: 5,
  },
  {
    id: "theme",
    label_ar: "الوضع الليلي / النهاري (Theme Toggle)",
    label_en: "Theme Toggle",
    icon: "Sun",
    enabled: true,
    showDirect: false,
    order: 6,
  },
];

const STORAGE_KEY = "aeroops.headerToolsConfig";
const NOTIF_DIRECT_MIGRATION_KEY = "aeroops.headerToolsNotifDirectV1";

/**
 * Get current configured header tools list in order
 */
export function getHeaderToolsConfig() {
  if (typeof window === "undefined") return DEFAULT_HEADER_TOOLS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HEADER_TOOLS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_HEADER_TOOLS;

    const needsNotifMigration = !localStorage.getItem(NOTIF_DIRECT_MIGRATION_KEY);

    // Merge with defaults to ensure any missing item is present
    const map = new Map(parsed.map((item, idx) => [item.id, { ...item, order: item.order ?? idx + 1 }]));
    const merged = DEFAULT_HEADER_TOOLS.map((defItem) => {
      const stored = map.get(defItem.id);
      if (!stored) return defItem;
      if (needsNotifMigration && defItem.id === "notifications") {
        return {
          ...defItem,
          enabled: true,
          showDirect: true,
          order: stored.order ?? defItem.order,
        };
      }
      return {
        ...defItem,
        enabled: stored.enabled !== false,
        showDirect: stored.showDirect !== undefined ? stored.showDirect : defItem.showDirect,
        order: stored.order ?? defItem.order,
      };
    });

    if (needsNotifMigration) {
      try {
        localStorage.setItem(NOTIF_DIRECT_MIGRATION_KEY, "1");
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            merged.map((item, idx) => ({
              id: item.id,
              enabled: item.enabled !== false,
              showDirect: item.showDirect !== false,
              order: item.order ?? idx + 1,
            }))
          )
        );
      } catch {}
    }

    return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.warn("Failed reading header tools config:", err);
    return DEFAULT_HEADER_TOOLS;
  }
}

/**
 * Save updated header tools config
 */
export function saveHeaderToolsConfig(toolsList) {
  if (typeof window === "undefined" || !Array.isArray(toolsList)) return false;
  try {
    const normalized = toolsList.map((item, idx) => ({
      id: item.id,
      enabled: item.enabled !== false,
      showDirect: item.showDirect !== false,
      order: idx + 1,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event("aeroops:headerToolsConfigChanged"));
    appConfigAPI.set("headerToolsConfig", normalized).catch(() => {});
    return true;
  } catch (err) {
    console.error("Failed saving header tools config:", err);
    return false;
  }
}

export function applyHeaderToolsFromRemote(list) {
  if (typeof window === "undefined" || !Array.isArray(list) || list.length === 0) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("aeroops:headerToolsConfigChanged"));
    return true;
  } catch {
    return false;
  }
}

export async function hydrateHeaderToolsFromSheet() {
  if (typeof window === "undefined") return null;
  try {
    const cloud = await appConfigAPI.get("headerToolsConfig");
    if (Array.isArray(cloud) && cloud.length > 0) {
      applyHeaderToolsFromRemote(cloud);
      return cloud;
    }
  } catch {}
  return null;
}

/**
 * Move item up in order
 */
export function moveHeaderToolUp(list, index) {
  if (index <= 0 || index >= list.length) return list;
  const next = [...list];
  const temp = next[index - 1];
  next[index - 1] = next[index];
  next[index] = temp;
  return next.map((item, idx) => ({ ...item, order: idx + 1 }));
}

/**
 * Move item down in order
 */
export function moveHeaderToolDown(list, index) {
  if (index < 0 || index >= list.length - 1) return list;
  const next = [...list];
  const temp = next[index + 1];
  next[index + 1] = next[index];
  next[index] = temp;
  return next.map((item, idx) => ({ ...item, order: idx + 1 }));
}

/**
 * Toggle direct vs menu placement for a tool
 */
export function toggleHeaderToolDirect(list, id) {
  return list.map((item) =>
    item.id === id ? { ...item, showDirect: !item.showDirect } : item
  );
}
