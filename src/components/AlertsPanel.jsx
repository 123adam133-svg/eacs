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
import { computeAlerts } from "../utils/alerts";
import { fmtDate } from "../utils/helpers";
import { can as checkPerm } from "../config/permissions";
import { alertsAPI, notificationsAPI, readSheetCache } from "../api";
import {
  getNotificationHistory,
  clearNotificationHistory,
} from "../utils/notifications";

export function AlertsPanel({ crew, users, fleet }) {
  const t = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState([]);
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
    canSeeOps;
  const canDismiss = checkPerm(user, "alerts.dismiss");

  useEffect(() => {
    const syncNotifs = () => {
      queueMicrotask(() => {
        setRecentNotifs(getNotificationHistory());
        setSheetNotifs(readSheetCache("Notifications", []));
      });
    };
    window.addEventListener("aeroops:notifications-updated", syncNotifs);
    window.addEventListener("aeroops:notifications", syncNotifs);
    window.addEventListener("aeroops:sheetCacheUpdated", syncNotifs);
    return () => {
      window.removeEventListener("aeroops:notifications-updated", syncNotifs);
      window.removeEventListener("aeroops:notifications", syncNotifs);
      window.removeEventListener("aeroops:sheetCacheUpdated", syncNotifs);
    };
  }, []);

  /* ⭐ تحميل المتجاهَل والإشعارات عند الفتح */
  useEffect(() => {
    if (!open) return;
    async function load() {
      try {
        const [list, freshNotifs] = await Promise.all([
          alertsAPI.listDismissed().catch(() => []),
          notificationsAPI.list().catch(() => null),
        ]);
        setDismissedKeys((list || []).map((d) => d.alertKey));
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

  /* ⭐ تجاهل / إعادة */
  const handleDismiss = async (alertItem) => {
    if (!alertItem.key) {
      showToast("⚠️ لا يمكن تجاهل هذا التنبيه (مفتاح مفقود)");
      return;
    }
    setDismissedKeys((prev) => {
      const next = [...prev, alertItem.key];
      try {
        localStorage.setItem("aeroops.locallyDismissedAlerts", JSON.stringify(next));
      } catch {}
      return next;
    });
    if (canDismiss) {
      try {
        await alertsAPI.dismiss(alertItem.key, user?.id, user?.fullName, "");
      } catch (e) {
        console.warn("Server dismiss failed, dismissed locally:", e.message);
      }
    }
  };

  const handleClearAllAlerts = () => {
    const activeKeys = activeAlerts.map((a) => a.key).filter(Boolean);
    setDismissedKeys((prev) => {
      const next = Array.from(new Set([...prev, ...activeKeys]));
      try {
        localStorage.setItem("aeroops.locallyDismissedAlerts", JSON.stringify(next));
      } catch {}
      return next;
    });
    activeKeys.forEach((key) => {
      if (canDismiss) {
        alertsAPI.dismiss(key, user?.id, user?.fullName, "").catch(() => {});
      }
    });
  };

  const handleUndismiss = async (alertItem) => {
    if (!canDismiss) return;
    try {
      await alertsAPI.undismiss(alertItem.key);
      setDismissedKeys((prev) => prev.filter((k) => k !== alertItem.key));
    } catch (e) {
      showToast("❌ فشل إعادة التنبيه: " + e.message);
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

  /* ⭐ لا صلاحية */
  if (!canViewAlerts) {
    return (
      <button
        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 opacity-50 cursor-not-allowed"
        title="ليس لديك صلاحية عرض التنبيهات"
        disabled
      >
        <Bell className="w-5 h-5 text-slate-400" />
      </button>
    );
  }

  const totalBadge = activeAlerts.length + combinedOpsNotifs.length;

  return (
    <div className="relative">
      {/* Bell */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        title={t.alerts || "التنبيهات والإشعارات"}
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {totalBadge > 0 && (
          <span
            className={`absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
              activeAlerts.length > 0 ? "bg-rose-600" : "bg-sky-600"
            }`}
          >
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute end-0 mt-2 w-96 max-h-[75vh] overflow-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold text-sm sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div className="flex items-center gap-2">
                <span className="text-slate-800 dark:text-slate-100">
                  {t.alerts || "التنبيهات"} ({activeAlerts.length})
                </span>
                {dismissedAlerts.length > 0 && (
                  <button
                    onClick={() => setShowDismissed((v) => !v)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1"
                    title="إظهار/إخفاء المتجاهَل"
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
              <div className="flex items-center gap-1">
                {(activeAlerts.length > 0 || combinedOpsNotifs.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClearAllOps();
                      handleClearAllAlerts();
                    }}
                    className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 font-bold flex items-center gap-1 transition"
                    title="مسح جميع التنبيهات والإشعارات"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح الكل
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
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
                            onClick={() => handleDismiss(a)}
                            className="p-1 rounded hover:bg-white/50 dark:hover:bg-slate-700 transition text-rose-600 dark:text-rose-400"
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
                          {canDismiss && (
                            <button
                              onClick={() => handleUndismiss(a)}
                              className="p-1 rounded hover:bg-white/50 dark:hover:bg-slate-700 transition"
                              title="إعادة"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
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
