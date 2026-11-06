/* ═══════════════════════════════════════════════════════════
 * ALERTS SUMMARY — Dashboard widget
 * v3.2 — Fixed: window.alert + renamed param to alertItem
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useMemo, useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { computeAlerts } from "../utils/alerts";
import { fmtDate } from "../utils/helpers";
import { can as checkPerm } from "../config/permissions";
import { alertsAPI } from "../api";

export function AlertsSummary({ crew, users, fleet }) {
  const t = useT();
  const { user } = useAuth();
  const [dismissedKeys, setDismissedKeys] = useState([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ⭐ الصلاحيات */
  const canSeeCrewDocs = checkPerm(user, "crew.docs");
  const canSeeFleetDocs = checkPerm(user, "fleet.docs");
  const canViewAlerts =
    checkPerm(user, "alerts.view") || canSeeCrewDocs || canSeeFleetDocs;
  const canDismiss = checkPerm(user, "alerts.dismiss");

  /* ⭐ تحميل المتجاهَل */
  useEffect(() => {
    async function load() {
      try {
        const list = await alertsAPI.listDismissed();
        setDismissedKeys(list.map((d) => d.alertKey));
      } catch (e) {
        console.warn("Failed to load dismissed alerts:", e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  /* ⭐ تجاهل / إعادة — ⚠️ window.alert لتفادي تعارض المعامل */
  const handleDismiss = async (alertItem) => {
    if (!canDismiss) {
      showToast("⚠️ ليس لديك صلاحية تجاهل التنبيهات");
      return;
    }
    if (!alertItem.key) {
      showToast("⚠️ لا يمكن تجاهل هذا التنبيه (مفتاح مفقود)");
      return;
    }
    if (
      !(await confirmAction(
        `تجاهل التنبيه: ${alertItem.subject} — ${alertItem.label}؟`
      ))
    )
      return;
    try {
      await alertsAPI.dismiss(alertItem.key, user?.id, user?.fullName, "");
      setDismissedKeys((prev) => [...prev, alertItem.key]);
    } catch (e) {
      showToast("❌ فشل تجاهل التنبيه: " + e.message);
    }
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

  /* ⭐ لا صلاحية */
  if (!canViewAlerts) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
        <EyeOff className="w-8 h-8 text-slate-400 flex-shrink-0" />
        <div>
          <div className="font-bold text-slate-600 dark:text-slate-400 text-sm">
            {t.alerts || "التنبيهات"}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-500">
            ليس لديك صلاحية عرض التنبيهات
          </div>
        </div>
      </div>
    );
  }

  /* ⭐ لا تنبيهات */
  if (activeAlerts.length === 0 && dismissedAlerts.length === 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div>
          <div className="font-bold text-emerald-800 dark:text-emerald-200">
            {t.noAlerts || "لا توجد تنبيهات. كل شيء سليم!"}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400">
            {t.allDocumentsValid || "كل المستندات صالحة"}
          </div>
        </div>
      </div>
    );
  }

  const colorFor = (sev) =>
    ({
      expired:
        "bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300",
      critical:
        "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
      expiring:
        "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    }[sev] || "bg-slate-50 border-slate-200 text-slate-700");

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-rose-600" />
          {t.alerts || "التنبيهات"}
          {activeAlerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {activeAlerts.length}
            </span>
          )}
          {dismissedAlerts.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs">
              {dismissedAlerts.length} متجاهَل
            </span>
          )}
        </h3>

        {dismissedAlerts.length > 0 && (
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            {showDismissed ? (
              <>
                <Eye className="w-3.5 h-3.5" /> إخفاء المتجاهَل
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> إظهار المتجاهَل
              </>
            )}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3 grid md:grid-cols-2 gap-2 max-h-72 overflow-auto">
        {activeAlerts.slice(0, 12).map((a, i) => (
          <div
            key={a.key || i}
            className={`p-3 rounded-lg border text-xs ${colorFor(a.sev)}`}
          >
            <div className="flex justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{a.subject}</div>
                <div className="opacity-80">
                  {a.label} · {a.source}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {canDismiss && a.key && (
                  <button
                    onClick={() => handleDismiss(a)}
                    className="p-1 rounded hover:bg-white/50 transition"
                    title="تجاهل"
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

        {showDismissed &&
          dismissedAlerts.slice(0, 12).map((a, i) => (
            <div
              key={`dismissed_${a.key || i}`}
              className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs opacity-60"
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
                      className="p-1 rounded hover:bg-white/50 transition"
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

      {/* Footer */}
      {activeAlerts.length > 12 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
          {t.showing || "عرض"} 12 / {activeAlerts.length}
        </div>
      )}
    </div>
  );
}

export default AlertsSummary;
