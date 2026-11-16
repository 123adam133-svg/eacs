/* ═══════════════════════════════════════════════════════════
 * EXECUTIVE DASHBOARD — View-Only Operational Display
 * Displays named dashboards configured & named exclusively inside
 * System Settings -> Dashboards & Layout.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck,
  Layers,
  Cloud,
  HardDrive,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { useT } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { LiveClock } from "../components/ui";
import { can as checkPerm, getRoleLabel } from "../config/permissions";
import { manualsAPI, flightPermitsAPI, cateringOrdersAPI } from "../api";

import {
  WIDGETS_BY_ID,
  canUserSeeWidget,
} from "../dashboard/widgetRegistry";
import {
  useNamedDashboards,
  sanitizeNamedWidgetList,
} from "../dashboard/useNamedDashboards";
import { NamedDashboardBar } from "../dashboard/NamedDashboardBar";
import { SortableWidgetCard } from "../dashboard/SortableWidgetCard";

export function Dashboard({
  flights = [],
  crew = [],
  fleet = [],
  camoList = [],
  melList = [],
  users = [],
  roles = [],
  leave = [],
  roster = [],
  standby = [],
  training = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  loading = false,
  lang: langProp,
}) {
  const t = useT();
  const { user } = useAuth();
  const lang =
    langProp ||
    t?.code ||
    (typeof document !== "undefined" ? document.documentElement.lang : "en") ||
    "en";
  const isAr = lang === "ar";

  /* ── Permission Evaluator ── */
  const can = useCallback(
    (perm) => {
      if (!user || !perm) return false;
      try {
        return checkPerm(user, perm);
      } catch {
        return false;
      }
    },
    [user]
  );

  /* ── Supplemental Live Data (Manuals, Permits, Catering) ── */
  const [manuals, setManuals] = useState([]);
  const [permits, setPermits] = useState([]);
  const [cateringOrders, setCateringOrders] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const loadExtras = async () => {
      const tasks = [
        can("manuals.view") || can("schedule.view")
          ? manualsAPI.list().catch(() => [])
          : Promise.resolve([]),
        can("permits.view")
          ? flightPermitsAPI.list().catch(() => [])
          : Promise.resolve([]),
        can("catering.view")
          ? cateringOrdersAPI.list().catch(() => [])
          : Promise.resolve([]),
      ];
      const [mList, pList, cList] = await Promise.all(tasks);
      if (!cancelled) {
        setManuals(mList || []);
        setPermits(pList || []);
        setCateringOrders(cList || []);
      }
    };
    loadExtras();
    return () => {
      cancelled = true;
    };
  }, [can]);

  /* ── Permitted Named Dashboards Configured in Settings ── */
  const {
    scopedDashboards,
    visibleDashboards,
    selectedId,
    activeDashboard,
    syncState: namedSyncState,
    canManage: canManageNamed,
    selectDashboard,
  } = useNamedDashboards({
    scope: "main",
    user,
    can,
    allowPersonalOption: false,
  });

  const canOpenSettingsDashboards =
    canManageNamed ||
    can("settings.dashboards_manage") ||
    (can("settings.view") && can("dashboard.manage_named"));

  const activeWidgets = useMemo(() => {
    if (!activeDashboard) return [];
    return sanitizeNamedWidgetList(activeDashboard.widgets, can);
  }, [activeDashboard, can]);

  /* ── Shared Props Passed to Every Widget ── */
  const widgetSharedProps = useMemo(
    () => ({
      flights,
      crew,
      fleet,
      camoList,
      melList,
      users,
      roles,
      leave,
      roster,
      standby,
      training,
      manuals,
      permits,
      cateringOrders,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      can,
      lang,
      t,
    }),
    [
      flights,
      crew,
      fleet,
      camoList,
      melList,
      users,
      roles,
      leave,
      roster,
      standby,
      training,
      manuals,
      permits,
      cateringOrders,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      can,
      lang,
      t,
    ]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div
          className="h-24 rounded-xl animate-pulse"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
          {[12, 6, 6, 4, 4, 4].map((span, idx) => (
            <div
              key={idx}
              className={`h-48 rounded-xl animate-pulse col-span-1 md:col-span-1 ${
                span === 12
                  ? "md:col-span-2 lg:col-span-12"
                  : span === 6
                  ? "lg:col-span-6"
                  : "lg:col-span-4"
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Top Header Bar ═══ */}
      <div
        className="rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2
              className="text-lg sm:text-xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {activeDashboard
                ? isAr
                  ? activeDashboard.nameAr || activeDashboard.name
                  : activeDashboard.name || activeDashboard.nameAr
                : t?.dashboard || (isAr ? "لوحة التحكم" : "Dashboard")}
            </h2>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold font-mono tabular-nums"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {namedSyncState === "syncing" ? (
                <span className="inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {isAr ? "مزامنة..." : "Syncing..."}
                </span>
              ) : namedSyncState === "synced" ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Cloud className="w-3 h-3" />
                  {isAr ? "متزامن سحابياً" : "Synced"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {isAr ? "محفوظ محلياً" : "Saved locally"}
                </span>
              )}
            </span>
          </div>

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t?.loggedInAs || (isAr ? "المستخدم الحالي" : "Logged in as")}:{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {user?.fullName || user?.username || "User"}
            </strong>{" "}
            · {getRoleLabel(user?.role, lang)}
            {activeDashboard?.description ? ` · ${activeDashboard.description}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden xl:block me-1">
            <LiveClock />
          </div>

          {/* Direct Shortcut to Quality Management Module */}
          {can("quality.view") && (
            <button
              type="button"
              onClick={() => setTab?.("quality")}
              className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-85 whitespace-nowrap shrink-0"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <ShieldCheck
                className="w-3.5 h-3.5"
                style={{ color: "var(--brand-primary)" }}
              />
              {isAr ? "إدارة الجودة" : "Quality Management"}
            </button>
          )}

          {canOpenSettingsDashboards && setTab && (
            <button
              type="button"
              onClick={() => setTab("settings.dashboards")}
              className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 text-white transition hover:opacity-90 whitespace-nowrap shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isAr ? "تخصيص من الإعدادات" : "Customize in Settings"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Read-Only Named Dashboards Switcher ═══ */}
      <NamedDashboardBar
        dashboards={visibleDashboards}
        selectedId={selectedId}
        onSelect={selectDashboard}
        allowPersonalOption={false}
        viewOnly={true}
        activeDashboard={activeDashboard}
        totalScopedCount={scopedDashboards.length}
        lang={lang}
      />

      {/* ═══ Clean View-Only Widgets Grid ═══ */}
      {!activeDashboard || activeWidgets.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px dashed var(--border-default)",
          }}
        >
          <Layers
            className="w-10 h-10 mx-auto opacity-50"
            style={{ color: "var(--brand-primary)" }}
          />
          <div
            className="text-sm font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {!activeDashboard
              ? isAr
                ? "لا توجد لوحة تحكم مخصصة لصلاحياتك حالياً"
                : "No dashboard assigned to your role yet"
              : isAr
              ? "هذه اللوحة لا تحتوي على بطاقات بعد"
              : "This dashboard has no active widgets yet"}
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? "يمكن تخصيص وتسمية اللوحات وتوزيع البطاقات من قسم الإعدادات ← تخصيص وتسمية اللوحات."
              : "Dashboards can be created, named, and customized from Settings -> Dashboards & Layout."}
          </p>
          {canOpenSettingsDashboards && setTab && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setTab("settings.dashboards")}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {isAr ? "الانتقال إلى إعدادات اللوحات" : "Open Dashboard Settings"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
          {activeWidgets.map((item) => {
            const def = WIDGETS_BY_ID[item.id];
            if (!def || !canUserSeeWidget(def, can)) return null;
            return (
              <SortableWidgetCard
                key={item.id}
                widgetDef={def}
                size={item.size || def.defaultSize}
                editMode={false}
                canCustomize={false}
                lang={lang}
                widgetProps={widgetSharedProps}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
