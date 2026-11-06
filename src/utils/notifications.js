/* ═══════════════════════════════════════════════════════════
 * AERO-OPS NOTIFICATION & AUDIO SYSTEM
 * System-wide notification dispatcher for Flights & Crew updates
 * Handles:
 * - In-app toasts with sounds
 * - Web Audio API sound synthesis with volume control
 * - Browser Notification API (push / desktop)
 * - Notification history ledger
 * - Settings synchronization
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "./dialog";
import { appConfigAPI } from "../api";
import {
  playNotification,
  playSuccess,
  playWarning,
  playError,
  setSoundsEnabled,
  setAlertSoundsEnabled,
  setSoundsVolume,
  unlockAudio,
} from "./sounds";

const STORAGE_KEY_CONFIG = "aeroops.notifications_config";
const STORAGE_KEY_HISTORY = "aeroops.notification_history";

export const DEFAULT_NOTIFICATION_CONFIG = {
  flightUpdates: true,
  crewUpdates: true,
  systemSounds: true,
  alertSounds: true,
  browserPush: false,
  volume: 0.7,
};

export function getNotificationSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) return { ...DEFAULT_NOTIFICATION_CONFIG, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_NOTIFICATION_CONFIG };
}

export async function hydrateNotificationSettingsFromSheet() {
  try {
    const remote = await appConfigAPI.get("notificationSettings");
    if (remote && typeof remote === "object") {
      const merged = { ...DEFAULT_NOTIFICATION_CONFIG, ...remote };
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));
      setSoundsEnabled(merged.systemSounds);
      setAlertSoundsEnabled(merged.alertSounds);
      setSoundsVolume(merged.volume);
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent("aeroops:notifications-settings-changed", {
            detail: merged,
          })
        );
      });
      return merged;
    }
  } catch {}
  return getNotificationSettings();
}

export function saveNotificationSettings(settings) {
  try {
    const merged = { ...getNotificationSettings(), ...settings };
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));

    // Sync underlying sounds.js state
    setSoundsEnabled(merged.systemSounds);
    setAlertSoundsEnabled(merged.alertSounds);
    setSoundsVolume(merged.volume);

    // Persist to Google Sheets AppConfig in background
    appConfigAPI.set("notificationSettings", merged).catch(() => {});

    // Broadcast change
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("aeroops:notifications-settings-changed", { detail: merged })
      );
    });
    return merged;
  } catch (e) {
    return DEFAULT_NOTIFICATION_CONFIG;
  }
}

// Helper to trigger mobile OS / Lock Screen Notifications via Service Worker
export async function triggerLockscreenNotification({
  title,
  body,
  category = "general",
  url = "/",
}) {
  if (typeof window === "undefined") {
    return { success: false, reason: "no_window" };
  }
  if (!("Notification" in window)) {
    return { success: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    return { success: false, reason: "permission_not_granted", permission: Notification.permission };
  }

  const notifTitle = title || "AeroOps Crew Portal";
  const notifOptions = {
    body: body || "تحديث جديد من بوابتك التشغيلية",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true, // Keeps notification visible on lock screen
    renotify: true,
    tag: `aeroops-${category}-${Date.now()}`,
    data: { url },
  };

  // 1. Mobile OS & PWA Lock Screen path via active Service Worker
  if ("serviceWorker" in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(notifTitle, notifOptions);
        return { success: true, method: "service_worker", regScope: reg.scope };
      }
    } catch (swErr) {
      console.warn("SW showNotification attempt failed, falling back to window Notification:", swErr);
    }
  }

  // 2. Direct Window Notification fallback
  try {
    const notif = new Notification(notifTitle, notifOptions);
    return { success: true, method: "notification_constructor" };
  } catch (e) {
    console.warn("Window Notification fallback failed:", e);
    return { success: false, reason: "constructor_failed", error: e?.message || String(e) };
  }
}

// Request Desktop/Browser/Mobile Notification permission
export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    let perm;
    // Handle both Promise and Legacy Callback API for Safari/iOS/Android compatibility
    const result = Notification.requestPermission((permission) => {
      perm = permission;
    });
    if (result && typeof result.then === "function") {
      perm = await result;
    }
    if (!perm && typeof Notification !== "undefined") {
      perm = Notification.permission;
    }

    if (perm === "granted") {
      saveNotificationSettings({ browserPush: true });
      // Send a test confirmation lock screen alert directly to device
      triggerLockscreenNotification({
        title: "📲 إشعارات الشاشة المقفلة مفعلة",
        body: "تم تفعيل الإشعارات بنجاح. ستصلك تحديثات الرحلات مباشرة على الهاتف حتى أثناء قفل الشاشة.",
        category: "system",
      });
    }
    return perm;
  } catch (e) {
    return "denied";
  }
}

export function getNotificationHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function clearNotificationHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent("aeroops:notifications-updated"));
    });
  } catch (e) {}
}

function recordNotification(notif) {
  try {
    const history = getNotificationHistory();
    const entry = {
      id: "nt-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      time: new Date().toISOString(),
      ...notif,
    };
    const updated = [entry, ...history].slice(0, 50);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent("aeroops:notifications-updated"));
    });
  } catch (e) {}
}

/* ═══ Main Dispatcher ═══ */
export function emitSystemNotification({
  title,
  body,
  category = "flight", // "flight" | "crew" | "general"
  type = "info", // "info" | "success" | "warning" | "error"
  sound = "notification", // "notification" | "success" | "warning" | "error"
  meta = {},
}) {
  const cfg = getNotificationSettings();

  // Category filter
  if (category === "flight" && !cfg.flightUpdates) return;
  if (category === "crew" && !cfg.crewUpdates) return;

  // Sound playback
  if (cfg.systemSounds) {
    try {
      unlockAudio();
      if (sound === "success") playSuccess();
      else if (sound === "warning") playWarning();
      else if (sound === "error") playError();
      else playNotification();
    } catch (e) {}
  }

  // In-app Toast
  const toastMsg = body ? `${title}: ${body}` : title;
  showToast(toastMsg, type === "info" ? "info" : type);

  // Mobile OS / Lock Screen Notification
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    triggerLockscreenNotification({
      title,
      body,
      category,
      url: meta?.url || "/",
    });
  }

  // Record in History
  recordNotification({ title, body, category, type, meta });

  // Broadcast window event
  if (typeof window !== "undefined") {
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent("aeroops:system-notification", {
          detail: { title, body, category, type, meta },
        })
      );
    });
  }
}

/* ═══ Convenience Helpers ═══ */
export function notifyFlightChange(flightNo, action, details = "") {
  let title = `تحديث الرحلة ${flightNo || ""}`;
  let body = details || "تم إجراء تعديل على بيانات الرحلة";

  if (action === "create") {
    title = `إضافة رحلة جديدة ${flightNo || ""}`;
    body = details || "تم جدولة رحلة جديدة في المنظومة";
  } else if (action === "delete") {
    title = `إلغاء / حذف الرحلة ${flightNo || ""}`;
  } else if (action === "status") {
    title = `تغيير حالة الرحلة ${flightNo || ""}`;
  }

  emitSystemNotification({
    title,
    body,
    category: "flight",
    type: action === "delete" ? "warning" : "info",
    sound: action === "delete" ? "warning" : "notification",
    meta: { flightNo, action },
  });
}

export function notifyCrewChange(crewName, action, details = "") {
  let title = `تحديث جدول الطاقم: ${crewName || ""}`;
  let body = details || "تم تعديل تعيينات أو جدول الطاقم";

  if (action === "assign") {
    title = `تعيين طاقم جديد للرحلة`;
    body = `${crewName || "عضو طاقم"} تم تعيينه للرحلة`;
  } else if (action === "duty") {
    title = `تنبيه ساعات خدمة الطاقم (FTL)`;
  }

  emitSystemNotification({
    title,
    body,
    category: "crew",
    type: "info",
    sound: "notification",
    meta: { crewName, action },
  });
}

export function testNotificationSystem() {
  emitSystemNotification({
    title: "🔔 تجربة نظام الإشعارات والأصوات",
    body: "نظام التنبيهات والأصوات يعمل بكفاءة تامة لكامل المنظومة (Notification Verified)",
    category: "general",
    type: "success",
    sound: "notification",
  });
}

// Initialize sound volume from settings on module load
if (typeof window !== "undefined") {
  const cfg = getNotificationSettings();
  setSoundsEnabled(cfg.systemSounds);
  setAlertSoundsEnabled(cfg.alertSounds);
  setSoundsVolume(cfg.volume);
}
