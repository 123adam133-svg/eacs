/* ═══════════════════════════════════════════════════════════
 * ALERTS PANEL — Top-bar bell with expiring documents alerts
 * v2.2 — FIXED: window.alert instead of showToast(scope conflict)
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useState, useMemo, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Plane,
  Trash2,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import {
  computeAlerts,
  readLocallyDismissedAlerts,
  writeLocallyDismissedAlerts,
  dismissAlertsLocally,
  undismissAlertLocally,
  ALERTS_DISMISSED_EVENT,
} from "../utils/alerts";
import { fmtDate } from "../utils/helpers";
import { can as checkPerm } from "../config/permissions";
import { alertsAPI, notificationsAPI, readSheetCache } from "../api";
import {
  getNotificationHistory,
  clearNotificationHistory,
} from "../utils/notifications";

/**
 * @param {Object} [props]
 * @param {any[]} [props.crew]
 * @param {any[]} [props.users]
 * @param {any[]} [props.fleet]
 * @param {"default" | "topbar"} [props.variant]
 * @param {string} [props.lang]
 * @param {string} [props.notifPerm]
 * @param {() => any} [props.onTogglePush]
 * @param {boolean} [props.externalOpen]
 * @param {() => any} [props.onExternalClose]
 * @param {boolean} [props.hiddenTrigger]
 */
export function AlertsPanel({
  crew = [],
  users = [],
  fleet = [],
  variant = "default",
  lang = "",
  notifPerm = "",
  onTogglePush,
  externalOpen,
  onExternalClose,
  hiddenTrigger = false,
}) {
  const t = useT();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (val) => {
    const next = typeof val === "function" ? val(open) : val;
    if (externalOpen !== undefined) {
      if (!next) onExternalClose?.();
    } else {
      setInternalOpen(next);
    }
  };
  const isAr = (lang || t?.locale || document.documentElement?.lang || "ar") === "ar";
  const [dismissedKeys, setDismissedKeys] = useState(() => readLocallyDismissedAlerts());
  const [showDismissed, setShowDismissed] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState(() => getNotificationHistory());
  const [sheetNotifs, setSheetNotifs] = useState(() =>
    readSheetCache("Notifications", [])
  );

  /* ⭐ الصلاحيات */
  const canSeeCrewDocs = checkPerm(user, "crew.docs");
  const canSeeFleetDocs = checkPerm(user, "fleet.docs");
  const canSeeOps =
    checkPerm(user, "schedule.view") || checkPerm(user, "crew.view");
  const canViewAlerts =
    checkPerm(user, "alerts.view") ||
    canSeeCrewDocs ||
    canSeeFleetDocs ||
    canSeeOps ||
    true;
  const canDismiss = checkPerm(user, "alerts.dismiss");

  useEffect(() => {
    const syncNotifs = () => {
      queueMicrotask(() => {
        setRecentNotifs(getNotificationHistory());
        setSheetNotifs(readSheetCache("Notifications", []));
      });
    };
    const syncDismissed = () => {
      setDismissedKeys(readLocallyDismissedAlerts());
    };
    window.addEventListener("aeroops:notifications-updated", syncNotifs);
    window.addEventListener("aeroops:notifications", syncNotifs);
    window.addEventListener("aeroops:sheetCacheUpdated", syncNotifs);
    window.addEventListener(ALERTS_DISMISSED_EVENT, syncDismissed);
    return () => {
      window.removeEventListener("aeroops:notifications-updated", syncNotifs);
      window.removeEventListener("aeroops:notifications", syncNotifs);
      window.removeEventListener("aeroops:sheetCacheUpdated", syncNotifs);
      window.removeEventListener(ALERTS_DISMISSED_EVENT, syncDismissed);
    };
  }, []);

  /* ⭐ تحميل المتجاهَل والإشعارات عند الفتح مع دمج التخزين المحلي */
  useEffect(() => {
    if (!open) return;
    async function load() {
      try {
        const [list, freshNotifs] = await Promise.all([
          alertsAPI.listDismissed().catch(() => []),
          notificationsAPI.list().catch(() => null),
        ]);
        const serverKeys = (list || []).map((d) => d?.alertKey).filter(Boolean).map(String);
        const merged = writeLocallyDismissedAlerts([
          ...readLocallyDismissedAlerts(),
          ...serverKeys,
        ]);
        setDismissedKeys(merged);
        if (Array.isArray(freshNotifs)) {
          setSheetNotifs(freshNotifs);
        }
      } catch (e) {
        console.warn("Failed to load alerts:", e.message);
      }
    }
    load();
  }, [open]);

  const [dismissedOpsIds, setDismissedOpsIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("aeroops.dismissedOpsNotifs") || "[]");
    } catch {
      return [];
    }
  });

  /* ⭐ دمج إشعارات الرحلات والطاقم الأخيرة (مع الاستثناء) */
  const combinedOpsNotifs = useMemo(() => {
    const map = new Map();
    (recentNotifs || []).forEach((n) => {
      const id = n.id || `${n.title || ""}|${n.body || ""}|${String(n.timestamp || "").slice(0, 16)}`;
      map.set(id, {
        id,
        title: n.title || "إشعار عمليات",
        body: n.body || "",
        timestamp: n.timestamp || "",
      });
    });
    (sheetNotifs || []).slice(0, 25).forEach((n) => {
      const id = n.id || `${n.flightNo || ""}|${n.message || ""}|${String(n.createdAtIso || "").slice(0, 16)}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          title: n.flightNo
            ? `✈️ ${n.flightNo}${n.crewName ? ` — ${n.crewName}` : ""}`
            : `🔔 ${n.crewName || "Crew Notification"}`,
          body: n.message || "",
          timestamp: n.createdAtIso || "",
        });
      }
    });
    return Array.from(map.values())
      .filter((n) => !dismissedOpsIds.includes(n.id))
      .sort(
        (a, b) =>
          (new Date(b.timestamp || 0).getTime() || 0) -
          (new Date(a.timestamp || 0).getTime() || 0)
      )
      .slice(0, 15);
  }, [recentNotifs, sheetNotifs, dismissedOpsIds]);

  const dismissOpsNotif = (id) => {
    setDismissedOpsIds((prev) => {
      const next = [...prev, id];
      try {
        localStorage.setItem("aeroops.dismissedOpsNotifs", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearAllOps = () => {
    const allIds = combinedOpsNotifs.map((n) => n.id);
    setDismissedOpsIds((prev) => {
      const next = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem("aeroops.dismissedOpsNotifs", JSON.stringify(next));
      } catch {}
      return next;
    });
    clearNotificationHistory();
    setRecentNotifs([]);
  };

  /* ⭐ حساب التنبيهات */
  const allAlerts = useMemo(
    () => computeAlerts(crew, users, fleet),
    [crew, users, fleet]
  );

  /* ⭐ فلترة حسب الصلاحيات */
  const permittedAlerts = useMemo(() => {
    return allAlerts.filter((a) => {
      if ((a.source === "crew" || a.source === "user") && !canSeeCrewDocs)
        return false;
      if (a.source === "aircraft" && !canSeeFleetDocs) return false;
      return true;
    });
  }, [allAlerts, canSeeCrewDocs, canSeeFleetDocs]);

  /* ⭐ النشطة والمتجاهلة */
  const activeAlerts = permittedAlerts.filter(
    (a) => !dismissedKeys.includes(a.key)
  );
  const dismissedAlerts = permittedAlerts.filter((a) =>
    dismissedKeys.includes(a.key)
  );

  /* ⭐ تجاهل / مسح / إعادة (محلي + سحابي متزامن) */
  const handleDismiss = async (alertItem) => {
    if (!alertItem?.key) {
      showToast("⚠️ لا يمكن تجاهل هذا التنبيه (مفتاح مفقود)");
      return;
    }
    const next = dismissAlertsLocally(alertItem.key);
    setDismissedKeys(next);
    if (canDismiss) {
      alertsAPI.dismiss(alertItem.key, user?.id, user?.fullName, "").catch(() => {});
    }
  };

  const handleClearAllAlerts = () => {
    const activeKeys = activeAlerts.map((a) => a.key).filter(Boolean);
    if (activeKeys.length === 0) return;
    const next = dismissAlertsLocally(activeKeys);
    setDismissedKeys(next);
    if (canDismiss) {
      activeKeys.forEach((key) => {
        alertsAPI.dismiss(key, user?.id, user?.fullName, "").catch(() => {});
      });
    }
  };

  const handleUndismiss = async (alertItem) => {
    if (!alertItem?.key) return;
    const next = undismissAlertLocally(alertItem.key);
    setDismissedKeys(next);
    if (canDismiss) {
      alertsAPI.undismiss(alertItem.key).catch(() => {});
    }
  };

  const colorFor = (sev) =>
    ({
      expired:
        "bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
      critical:
        "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
      expiring:
        "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    }[sev] || "bg-slate-50 dark:bg-slate-900");

  const totalBadge = activeAlerts.length + combinedOpsNotifs.length;
  const isTopBar = variant === "topbar";

  if (!canViewAlerts) {
    return null;
  }

  return (
    <div className="relative">
      {/* Bell Trigger */}
      {!hiddenTrigger && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={
            isTopBar
              ? `relative p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center ${
                  open ? "bg-white/15 text-white" : "text-slate-200 hover:text-white"
                }`
              : "relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          }
          title={t.alerts || (isAr ? "التنبيهات والإشعارات" : "Alerts & Notifications")}
          aria-label={isAr ? "التنبيهات والإشعارات" : "Alerts & Notifications"}
        >
          <Bell
            className={
              isTopBar
                ? `w-4 h-4 ${
                    totalBadge > 0
                      ? "text-amber-300"
                      : notifPerm === "granted"
                      ? "text-emerald-300"
                      : "text-slate-200"
                  }`
                : "w-5 h-5 text-slate-600 dark:text-slate-300"
            }
          />
          {totalBadge > 0 && (
            <span
              className={`absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9.5px] font-mono tabular-nums font-bold flex items-center justify-center shadow-xs ${
                activeAlerts.length > 0 ? "bg-rose-600" : "bg-sky-500"
              }`}
            >
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={() => setOpen(false)} />

          <div
            className="absolute end-0 mt-2 w-80 sm:w-96 max-h-[75vh] overflow-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-[120] text-slate-800 dark:text-slate-100 font-sans"
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 font-bold text-sm sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-800 dark:text-slate-100 truncate">
                  {t.alerts || (isAr ? "الإشعارات والتنبيهات" : "Notifications")} (
                  <span className="font-mono tabular-nums">{totalBadge}</span>)
                </span>
                {dismissedAlerts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDismissed((v) => !v)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1 shrink-0"
                    title={isAr ? "إظهار/إخفاء المتجاهَل" : "Show/Hide dismissed"}
                  >
                    {showDismissed ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                    {dismissedAlerts.length}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onTogglePush && (
                  <button
                    type="button"
                    onClick={onTogglePush}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      notifPerm === "granted"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25"
                        : "bg-sky-500/15 text-sky-600 dark:text-sky-300 hover:bg-sky-500/25"
                    }`}
                    title={
                      notifPerm === "granted"
                        ? isAr
                          ? "إرسال إشعار تجريبي"
                          : "Send test push"
                        : isAr
                        ? "تفعيل إشعارات المتصفح"
                        : "Enable push alerts"
                    }
                  >
                    {notifPerm === "granted"
                      ? isAr
                        ? "اختبار الدفع"
                        : "Test Push"
                      : isAr
                      ? "تفعيل الدفع"
                      : "Enable Push"}
                  </button>
                )}
                {(activeAlerts.length > 0 || combinedOpsNotifs.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearAllOps();
                      handleClearAllAlerts();
                    }}
                    className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-bold flex items-center gap-1 transition cursor-pointer"
                    title={isAr ? "مسح جميع التنبيهات والإشعارات" : "Clear all"}
                  >
                    <Trash2 className="w-3 h-3" />
                    {isAr ? "مسح الكل" : "Clear"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Recent Flight & Crew Notifications */}
            {combinedOpsNotifs.length > 0 && (
              <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-sky-50/40 dark:bg-slate-900/50">
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-sky-700 dark:text-sky-400">
                  <span className="flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5" />
                    إشعارات الرحلات والطاقم ({combinedOpsNotifs.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleClearAllOps}
                    className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-rose-500 transition"
                    title="مسح قائمة إشعارات العمليات"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح القائمة
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto mt-1">
                  {combinedOpsNotifs.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded-lg border border-sky-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs flex items-start justify-between gap-2 transition hover:border-sky-300"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {n.title}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                          {n.body}
                        </div>
                        {n.timestamp && (
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            {new Date(n.timestamp).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissOpsNotif(n.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0 transition"
                        title="حذف هذا الإشعار"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            {activeAlerts.length === 0 &&
            dismissedAlerts.length === 0 &&
            combinedOpsNotifs.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                {t.noAlerts || "لا توجد تنبيهات. كل شيء سليم!"}
              </div>
            ) : activeAlerts.length === 0 && dismissedAlerts.length === 0 ? null : (
              <div className="p-2">
                {/* Document Alerts Header with Clear Doc Alerts */}
                {activeAlerts.length > 0 && (
                  <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {isAr ? `تنبيهات الوثائق (${activeAlerts.length})` : `Document Alerts (${activeAlerts.length})`}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllAlerts}
                      className="text-[10px] flex items-center gap-1 text-slate-500 hover:text-rose-500 transition cursor-pointer"
                      title={isAr ? "مسح إشعارات الوثائق" : "Clear document alerts"}
                    >
                      <Trash2 className="w-3 h-3" />
                      {isAr ? "مسح الوثائق" : "Clear Docs"}
                    </button>
                  </div>
                )}

                {/* Active */}
                {activeAlerts.map((a, i) => (
                  <div
                    key={a.key || i}
                    className={`m-1 p-3 rounded-lg border text-xs ${colorFor(
                      a.sev
                    )}`}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate">{a.subject}</div>
                        <div className="opacity-80">
                          {a.label} · {a.source}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {a.key && (
                          <button
                            type="button"
                            onClick={() => handleDismiss(a)}
                            className="p-1 rounded hover:bg-white/50 dark:hover:bg-slate-700 transition text-rose-600 dark:text-rose-400 cursor-pointer"
                            title="تجاهل / مسح"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-1 font-mono text-[10px]">
                      {fmtDate(a.expiry)} ·{" "}
                      {a.days < 0
                        ? `${Math.abs(a.days)} ${t.daysAgo || "منذ أيام"}`
                        : `${a.days} ${t.daysLeft || "يوم متبقٍ"}`}
                    </div>
                  </div>
                ))}

                {/* Dismissed */}
                {showDismissed &&
                  dismissedAlerts.map((a, i) => (
                    <div
                      key={`dismissed_${a.key || i}`}
                      className="m-1 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs opacity-70"
                    >
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold truncate line-through">
                            {a.subject}
                          </div>
                          <div className="opacity-80">
                            {a.label} · {a.source}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUndismiss(a)}
                            className="p-1 rounded hover:bg-white/50 dark:hover:bg-slate-700 transition cursor-pointer"
                            title="إعادة"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 font-mono text-[10px]">
                        {fmtDate(a.expiry)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AlertsPanel;
