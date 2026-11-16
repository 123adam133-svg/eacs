/* ═══════════════════════════════════════════════════════════
 * SCHEDULE BOARD PROFESSIONAL DESIGNS CONFIGURATION
 * Single source of truth shared between ScheduleBoard & SettingsModule
 * ═══════════════════════════════════════════════════════════ */

export const SCHEDULE_DESIGN_KEY = "aeroops.scheduleDesign";
export const SCHEDULE_DESIGN_EVENT = "aeroops:scheduleDesignChanged";
export const DEFAULT_SCHEDULE_DESIGN = "dispatch_grid";

export const SCHEDULE_DESIGNS = [
  {
    id: "dispatch_grid",
    nameEn: "Classic Dispatch Grid",
    nameAr: "الشبكة التشغيلية الكلاسيكية",
    subtitleAr: "جدول عمليات منظم بخطوط دقيقة وربط مرئي للقطاعات المتعددة",
    subtitleEn: "Structured OCC table with hairline borders & chained leg connectors",
    badge: "DEFAULT",
    accentColor: "#0284c7",
    previewPalette: {
      bg: "#f8fafc",
      surface: "#ffffff",
      header: "#0f172a",
      accent: "#0284c7",
      text: "#0f172a",
      muted: "#64748b",
      border: "#e2e8f0",
    },
  },
  {
    id: "executive_strips",
    nameEn: "Executive Flight Strips",
    nameAr: "بطاقات العمليات التنفيذية",
    subtitleAr: "شرائح ملاحية مجمّعة لكل رحلة تعرض مسار القطاعات والطاقم بوضوح",
    subtitleEn: "Rotation-grouped horizontal strips with route track & inline crew",
    badge: "MODERN",
    accentColor: "#6366f1",
    previewPalette: {
      bg: "#f1f5f9",
      surface: "#ffffff",
      header: "#1e1b4b",
      accent: "#6366f1",
      text: "#0f172a",
      muted: "#64748b",
      border: "#cbd5e1",
    },
  },
  {
    id: "avionics_cockpit",
    nameEn: "Avionics Tactical Ops",
    nameAr: "لوحة العمليات التكتيكية الداكنة",
    subtitleAr: "تصميم ليلي مستوحى من أجهزة قمرة القيادة بقراءة تباين عالية",
    subtitleEn: "Instrument-grade deep slate OCC desk with amber/cyan telemetry",
    badge: "NIGHT OPS",
    accentColor: "#06b6d4",
    previewPalette: {
      bg: "#070d18",
      surface: "#0f172a",
      header: "#020617",
      accent: "#22d3ee",
      text: "#f1f5f9",
      muted: "#94a3b8",
      border: "#1e293b",
    },
  },
  {
    id: "compact_matrix",
    nameEn: "Compact OCC Matrix",
    nameAr: "المصفوفة التشغيلية المكثفة",
    subtitleAr: "كثافة عالية لعرض أكبر عدد من الرحلات والقطاعات في شاشة واحدة",
    subtitleEn: "High-density 34px rows with unboxed dot-separated metadata",
    badge: "DENSE",
    accentColor: "#059669",
    previewPalette: {
      bg: "#ffffff",
      surface: "#f8fafc",
      header: "#064e3b",
      accent: "#10b981",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
    },
  },
  {
    id: "fids_board",
    nameEn: "Airport FIDS Executive",
    nameAr: "لوحة الرحلات الملاحية FIDS",
    subtitleAr: "عرض مطاري احترافي برموز المسار الكبيرة وحالة الرحلة الفورية",
    subtitleEn: "Terminal-style dispatch display with city names & live flight status",
    badge: "FIDS",
    accentColor: "#d97706",
    previewPalette: {
      bg: "#111827",
      surface: "#1f2937",
      header: "#030712",
      accent: "#f59e0b",
      text: "#f9fafb",
      muted: "#9ca3af",
      border: "#374151",
    },
  },
];

export function isValidScheduleDesign(id) {
  return SCHEDULE_DESIGNS.some((d) => d.id === id);
}

export function getScheduleDesign(fallback = DEFAULT_SCHEDULE_DESIGN) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(SCHEDULE_DESIGN_KEY);
    if (raw && isValidScheduleDesign(raw)) return raw;
    const cachedRaw = localStorage.getItem("aeroops.settingsCache");
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      const cachedDesign = parsed?.scheduleDesign || parsed?.tabPreferences?.__scheduleDesign;
      if (cachedDesign && isValidScheduleDesign(cachedDesign)) return cachedDesign;
    }
  } catch {}
  return isValidScheduleDesign(fallback) ? fallback : DEFAULT_SCHEDULE_DESIGN;
}

export function applyScheduleDesign(designId, { persist = true } = {}) {
  const valid = isValidScheduleDesign(designId)
    ? designId
    : DEFAULT_SCHEDULE_DESIGN;
  if (typeof window !== "undefined") {
    if (persist) {
      try {
        localStorage.setItem(SCHEDULE_DESIGN_KEY, valid);
      } catch {}
    }
    window.dispatchEvent(
      new CustomEvent(SCHEDULE_DESIGN_EVENT, { detail: { design: valid } })
    );
  }
  return valid;
}
