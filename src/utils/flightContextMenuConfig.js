/* ═══════════════════════════════════════════════════════════
 * FLIGHT CONTEXT MENU CONFIGURATION UTILITY
 * Controls which items appear (and in what order) in the
 * Schedule Board Flight Dropdown Menu (القائمة المنسدلة للرحلة).
 * ═══════════════════════════════════════════════════════════ */
import { appConfigAPI } from "../api";

export const DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS = [
  {
    id: "edit",
    label_ar: "تعديل الرحلة",
    label_en: "Edit Flight",
    desc_ar: "فتح نافذة تعديل بيانات الرحلة والقطاعات",
    enabled: true,
    order: 1,
  },
  {
    id: "complete_flight",
    label_ar: "الرحلة المكتملة · سجل الرحلة (JL)",
    label_en: "Completed Flight / Journey Log (JL)",
    desc_ar: "إدخال الأوقات الفعلية والوقود وسجل الرحلة",
    enabled: true,
    order: 2,
  },
  {
    id: "gendec",
    label_ar: "معاينة الإقرار العام (GenDec)",
    label_en: "Preview General Declaration (GD)",
    desc_ar: "فتح ومعاينة وثيقة الإقرار العام (GD)",
    enabled: true,
    order: 3,
  },
  {
    id: "print_gendec_stamped",
    label_ar: "طباعة GenDec بالختم الرسمي",
    label_en: "Print GenDec (With Stamp)",
    desc_ar: "طباعة الإقرار العام مع الختم والتوقيع الرسمي",
    enabled: true,
    order: 4,
  },
  {
    id: "print_gendec_nostamp",
    label_ar: "طباعة GenDec بدون ختم",
    label_en: "Print GenDec (No Stamp)",
    desc_ar: "طباعة الإقرار العام بدون ختم رسمي",
    enabled: true,
    order: 5,
  },
  {
    id: "open_notes_modal",
    label_ar: "ملاحظات الرحلة والتصاريح",
    label_en: "Flight Notes & Permits",
    desc_ar: "عرض وتعديل الملاحظات والتصاريح والمناولة",
    enabled: true,
    order: 6,
  },
  {
    id: "send_flight_email",
    label_ar: "إرسال تفاصيل الرحلة للطاقم",
    label_en: "Send Flight Email to Crew",
    desc_ar: "إرسال إشعار ببيانات الرحلة عبر البريد الإلكتروني",
    enabled: true,
    order: 7,
  },
  {
    id: "operational_forms",
    label_ar: "النماذج التشغيلية المخصصة",
    label_en: "Operational Forms",
    desc_ar: "إظهار قائمة النماذج التشغيلية المفعلة للرحلة",
    enabled: true,
    order: 8,
  },
  {
    id: "delete",
    label_ar: "حذف الرحلة",
    label_en: "Delete Flight",
    desc_ar: "حذف الرحلة نهائياً من الجدول",
    enabled: true,
    order: 9,
  },
];

const STORAGE_KEY = "aeroops.flightContextMenuConfig";
export const FLIGHT_CONTEXT_MENU_EVENT = "aeroops:flightContextMenuConfigChanged";

export function getFlightContextMenuConfig() {
  if (typeof window === "undefined") return DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS;
    }

    const map = new Map(
      parsed.map((item, idx) => [
        item.id,
        { ...item, order: item.order ?? idx + 1 },
      ])
    );

    const merged = DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS.map((defItem) => {
      const stored = map.get(defItem.id);
      return stored
        ? {
            ...defItem,
            enabled: stored.enabled !== false,
            order: stored.order ?? defItem.order,
          }
        : defItem;
    });

    return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.warn("Failed reading flight context menu config:", err);
    return DEFAULT_FLIGHT_CONTEXT_MENU_ITEMS;
  }
}

export function saveFlightContextMenuConfig(itemsList, { syncRemote = true } = {}) {
  if (typeof window === "undefined" || !Array.isArray(itemsList)) return false;
  try {
    const normalized = itemsList.map((item, idx) => ({
      id: item.id,
      enabled: item.enabled !== false,
      order: idx + 1,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(FLIGHT_CONTEXT_MENU_EVENT));
    if (syncRemote) {
      appConfigAPI.set("flightContextMenuConfig", normalized).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error("Failed saving flight context menu config:", err);
    return false;
  }
}

export function applyFlightContextMenuFromRemote(list) {
  if (typeof window === "undefined" || !Array.isArray(list) || list.length === 0) {
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(FLIGHT_CONTEXT_MENU_EVENT));
    return true;
  } catch {
    return false;
  }
}

export async function hydrateFlightContextMenuFromSheet() {
  if (typeof window === "undefined") return null;
  try {
    const cloud = await appConfigAPI.get("flightContextMenuConfig");
    if (Array.isArray(cloud) && cloud.length > 0) {
      applyFlightContextMenuFromRemote(cloud);
      return cloud;
    }
  } catch {}
  return null;
}
