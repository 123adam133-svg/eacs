/* ═══════════════════════════════════════════════════════════
 * EMBEDDED SECTION DASHBOARD — View-Only Section Display
 * Displays named dashboards customized & named in Settings for:
 *   - Quality Management (scope: "quality")
 *   - CAMO Airworthiness (scope: "camo")
 *   - Crew Training (scope: "training")
 * ═══════════════════════════════════════════════════════════ */
import React, { useMemo, useCallback } from "react";
import {
  Layers,
  Cloud,
  HardDrive,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { useT } from "../contexts/LangContext";
import { useAuth } from "../contexts/AuthContext";
import { can as checkPerm } from "../config/permissions";

import {
  WIDGETS_BY_ID,
  canUserSeeWidget,
} from "./widgetRegistry";
import {
  useNamedDashboards,
  sanitizeNamedWidgetList,
} from "./useNamedDashboards";
import { NamedDashboardBar } from "./NamedDashboardBar";
import { SortableWidgetCard } from "./SortableWidgetCard";

export function EmbeddedSectionDashboard({
  scope = "quality",
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
  manuals = [],
  permits = [],
  cateringOrders = [],
  qualityAudits = [],
  auditLogs = [],
  loginHistory = [],
  settings = {},
  syncStatus = "idle",
  onRefresh,
  setTab,
  onOpenAuditsView,
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

  const {
    scopedDashboards,
    visibleDashboards,
    selectedId,
    activeDashboard,
    syncState,
    canManage,
    selectDashboard,
  } = useNamedDashboards({
    scope,
    user,
    can,
    allowPersonalOption: false,
  });

  const canOpenSettingsDashboards =
    canManage || can("settings.dashboards_manage");

  const activeWidgets = useMemo(() => {
    if (!activeDashboard) return [];
    return sanitizeNamedWidgetList(activeDashboard.widgets, can);
  }, [activeDashboard, can]);

  const sharedWidgetProps = useMemo(
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
      qualityAudits,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      onOpenAuditsView,
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
      qualityAudits,
      auditLogs,
      loginHistory,
      settings,
      syncStatus,
      onRefresh,
      setTab,
      onOpenAuditsView,
      can,
      lang,
      t,
    ]
  );

  return (
    <div className="space-y-3.5">
      {/* ═══ View-Only Named Dashboards Bar ═══ */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <NamedDashboardBar
            dashboards={visibleDashboards}
            selectedId={selectedId}
            onSelect={selectDashboard}
            allowPersonalOption={false}
            viewOnly={true}
            onOpenSettings={
              canOpenSettingsDashboards && setTab
                ? () => setTab("settings.dashboards")
                : undefined
            }
            activeDashboard={activeDashboard}
            totalScopedCount={scopedDashboards.length}
            lang={lang}
          />
        </div>

        <span
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono tabular-nums whitespace-nowrap shrink-0 self-start xl:self-auto"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          {syncState === "syncing" ? (
            <span className="inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {isAr ? "مزامنة..." : "Syncing..."}
            </span>
          ) : syncState === "synced" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Cloud className="w-3 h-3" />
              {isAr ? "متزامن سحابياً" : "Synced"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {isAr ? "محفوظ محلياً" : "Local"}
            </span>
          )}
        </span>
      </div>

      {/* ═══ View-Only Widgets Grid ═══ */}
      {!activeDashboard || activeWidgets.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center space-y-3"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px dashed var(--border-default)",
          }}
        >
          <Layers
            className="w-9 h-9 mx-auto opacity-60"
            style={{ color: "var(--brand-primary)" }}
          />
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {!activeDashboard
              ? isAr
                ? "لا توجد لوحة متاحة لصلاحيات حسابك في هذا القسم"
                : "No dashboard assigned to your role in this section yet"
              : isAr
              ? "اللوحة فارغة حالياً"
              : "This dashboard has no widgets yet"}
          </h3>
          {canOpenSettingsDashboards && setTab && (
            <button
              type="button"
              onClick={() => setTab("settings.dashboards")}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isAr ? "تخصيص اللوحة من الإعدادات" : "Customize in Settings"}
            </button>
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
                widgetProps={sharedWidgetProps}
                lang={lang}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EmbeddedSectionDashboard;
