/* ═══════════════════════════════════════════════════════════
 * NAMED DASHBOARD BAR — Switcher & Quick Access Controls
 * Displays permitted named dashboards as tabs with quick buttons
 * to create a new named dashboard or manage names & permissions.
 * ═══════════════════════════════════════════════════════════ */
import React from "react";
import {
  Plus,
  Shield,
  Lock,
  Globe,
  SlidersHorizontal,
  User,
  FolderKanban,
} from "lucide-react";

export function NamedDashboardBar({
  dashboards = [],
  selectedId = "",
  onSelect,
  allowPersonalOption = false,
  personalLabelEn = "My Personal View",
  personalLabelAr = "لوحتي الخاصة",
  canManage = false,
  canEditActive = false,
  activeDashboard = null,
  onOpenCreate,
  onOpenEditActive,
  onOpenDirectory,
  totalScopedCount = 0,
  lang = "en",
}) {
  const isAr = lang === "ar";

  return (
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Left: Scrollable Dashboard Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 min-w-0">
        {allowPersonalOption && (
          <button
            type="button"
            onClick={() => onSelect?.("__personal__")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
            style={
              selectedId === "__personal__"
                ? {
                    background: "var(--brand-gradient)",
                    color: "#ffffff",
                  }
                : {
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-muted)",
                  }
            }
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span>{isAr ? personalLabelAr : personalLabelEn}</span>
          </button>
        )}

        {dashboards.map((dash) => {
          const isActive = selectedId === dash.id;
          const title = isAr
            ? dash.nameAr || dash.name
            : dash.name || dash.nameAr;
          const isPublic = dash.visibility === "all";
          const widgetCount = Array.isArray(dash.widgets)
            ? dash.widgets.length
            : 0;

          return (
            <button
              key={dash.id}
              type="button"
              onClick={() => onSelect?.(dash.id)}
              title={dash.description || title}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
              style={
                isActive
                  ? {
                      background: "var(--brand-gradient)",
                      color: "#ffffff",
                    }
                  : {
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }
              }
            >
              {isPublic ? (
                <Globe className="w-3.5 h-3.5 shrink-0 opacity-80" />
              ) : (
                <Lock className="w-3.5 h-3.5 shrink-0 opacity-80" />
              )}
              <span>{title}</span>
              <span
                className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums"
                style={{
                  backgroundColor: isActive
                    ? "rgba(255,255,255,0.22)"
                    : "var(--bg-card)",
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                }}
              >
                {widgetCount}
              </span>
            </button>
          );
        })}

        {dashboards.length === 0 && !allowPersonalOption && (
          <span className="text-xs px-2" style={{ color: "var(--text-muted)" }}>
            {isAr
              ? "لا توجد لوحات مخصصة متاحة لصلاحياتك حالياً"
              : "No named dashboards assigned to your role yet"}
          </span>
        )}
      </div>

      {/* Right: Create & Permissions Management Controls */}
      {(canManage || (activeDashboard && canEditActive)) && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {activeDashboard && (canManage || canEditActive) && (
            <button
              type="button"
              onClick={() => onOpenEditActive?.(activeDashboard)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition hover:opacity-85"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
              title={
                isAr
                  ? "تعديل اسم اللوحة الحالية وصلاحياتها"
                  : "Rename active dashboard & edit permissions"
              }
            >
              <Shield
                className="w-3.5 h-3.5"
                style={{ color: "var(--brand-primary)" }}
              />
              <span>{isAr ? "الاسم والصلاحيات" : "Name & Access"}</span>
            </button>
          )}

          {canManage && (
            <>
              <button
                type="button"
                onClick={onOpenDirectory}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition hover:opacity-85"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
                title={
                  isAr
                    ? "إدارة جميع اللوحات المسماة وصلاحياتها"
                    : "Manage all named dashboards & permissions"
                }
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {isAr ? "كل اللوحات" : "All Boards"}
                </span>
                <span className="font-mono tabular-nums text-[11px]">
                  ({totalScopedCount || dashboards.length})
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenCreate}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-white whitespace-nowrap transition hover:opacity-90"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? "لوحة جديدة" : "New Dashboard"}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default NamedDashboardBar;
