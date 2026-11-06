/* ═══════════════════════════════════════════════════════════
 * UNIFIED ROSTER, STANDBY & LEAVE HUB
 * قسم موحد يدمج:
 * 1. الروستر والجداول (Roster & Planning) مع دعم تعدد المجموعات
 *    (طاقم جوي، ضيافة جوية، ترحيل جوي، صيانة، ومجموعات مخصصة)
 *    مع إمكانية إضافة مجموعة جديدة وتخصيص صلاحيات المشاهدة والتعديل.
 * 2. الاحتياطي والمناوبات (Standby / On-Call) EASA
 * 3. الإجازات والراحات (Leave Requests & Approvals)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Printer,
  Zap,
  Plane,
  Users,
  Settings,
  Shield,
  Layers,
  Lock,
  Globe,
  CheckCircle2,
  Filter,
  FolderKanban,
  UserCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { useT } from "../contexts";
import { useAuth } from "../contexts/AuthContext";
import { rosterAPI } from "../api";
import { fmtDate } from "../utils/helpers";
import {
  ROSTER_TYPES,
  DAYS_EN,
  DAYS_AR,
  MONTHS_EN,
  MONTHS_AR,
} from "../config/constants";
import { can as checkPerm, getRoleLabel } from "../config/permissions";
import { showToast, confirmAction } from "../utils/dialog";

import { StandbyModule } from "./StandbyModule";
import { LeaveModule } from "./LeaveModule";
import {
  RosterGroupsModal,
  useRosterGroups,
  crewBelongsToRosterGroup,
  GROUP_COLOR_THEMES,
  canUserEditRosterGroup,
} from "./RosterGroupsModal";

export function RosterModule({
  crew = [],
  roster = [],
  setRoster,
  standby = [],
  setStandby,
  leave = [],
  setLeave,
  currentUser,
  user: propUser,
  users = [],
  roles = [],
  settings = {},
  setSyncStatus,
  initialSubTab = "roster",
  onSubTabChange,
  lang: propLang,
}) {
  const t = useT();
  const { user: authUser } = useAuth();
  const activeUser = currentUser || propUser || authUser;

  const lang =
    propLang ||
    (typeof document !== "undefined" ? document.documentElement.lang : "en") ||
    "en";
  const isAr = lang === "ar";

  /* ═══ 1. Unified Sub-Tab Navigation (Roster | Standby | Leave) ═══ */
  const [subTab, setSubTab] = useState(() => {
    const valid = ["roster", "standby", "leave"];
    return valid.includes(initialSubTab) ? initialSubTab : "roster";
  });

  useEffect(() => {
    if (initialSubTab && ["roster", "standby", "leave"].includes(initialSubTab)) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabChange = (key) => {
    setSubTab(key);
    onSubTabChange?.(key);
  };

  /* ═══ 2. Permissions & Roster Groups Hook ═══ */
  const can = useCallback(
    (perm) => {
      if (!activeUser || !perm) return false;
      try {
        return checkPerm(activeUser, perm);
      } catch {
        return false;
      }
    },
    [activeUser]
  );

  const {
    allGroups,
    visibleGroups,
    canManageGroups,
    syncState: groupsSyncState,
    createGroup,
    updateGroup,
    deleteGroup,
  } = useRosterGroups({ user: activeUser, can, crew });

  const canViewAll = can("roster.view_all_groups") || canManageGroups;

  // Selected Group ID
  const [activeGroupId, setActiveGroupId] = useState(() => {
    return "grp_flight_crew";
  });

  // Ensure activeGroupId is valid among visible groups
  useEffect(() => {
    if (visibleGroups.length === 0) return;
    if (activeGroupId === "all") {
      if (!canViewAll) {
        setActiveGroupId(visibleGroups[0].id);
      }
      return;
    }
    const exists = visibleGroups.some((g) => g.id === activeGroupId);
    if (!exists) {
      setActiveGroupId(canViewAll ? "all" : visibleGroups[0].id);
    }
  }, [visibleGroups, canViewAll, activeGroupId]);

  const activeGroup = useMemo(() => {
    if (activeGroupId === "all") return null;
    return allGroups.find((g) => g.id === activeGroupId) || null;
  }, [allGroups, activeGroupId]);

  const canEditCurrentGroup = useMemo(() => {
    if (!activeGroup) return canManageGroups;
    return canUserEditRosterGroup(activeGroup, activeUser, can);
  }, [activeGroup, activeUser, can, canManageGroups]);

  /* ═══ 3. Roster Groups Modal State ═══ */
  const [groupsModalOpen, setGroupsModalOpen] = useState(false);
  const [groupsModalMode, setGroupsModalMode] = useState("directory"); // "directory" | "create" | "edit"
  const [editingTargetGroup, setEditingTargetGroup] = useState(null);

  const openCreateGroup = () => {
    setEditingTargetGroup(null);
    setGroupsModalMode("create");
    setGroupsModalOpen(true);
  };

  const openManageGroups = () => {
    setEditingTargetGroup(null);
    setGroupsModalMode("directory");
    setGroupsModalOpen(true);
  };

  const openEditGroup = (grp) => {
    setEditingTargetGroup(grp);
    setGroupsModalMode("edit");
    setGroupsModalOpen(true);
  };

  /* ═══ 4. Roster Dates & View Modes ═══ */
  const [viewMode, setViewMode] = useState("week");
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [filterCrew, setFilterCrew] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});

  const getWeekDates = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00Z");
    const day = d.getUTCDay();
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - day);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(start);
      x.setUTCDate(x.getUTCDate() + i);
      dates.push(x.toISOString().slice(0, 10));
    }
    return dates;
  };

  const getMonthDates = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00Z");
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const dates = [];
    for (let i = 0; i < firstDay; i++) dates.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(
        `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(
          2,
          "0"
        )}`
      );
    }
    return dates;
  };

  const dates =
    viewMode === "week"
      ? getWeekDates(currentDate)
      : getMonthDates(currentDate);

  const shift = (delta) => {
    const d = new Date(currentDate + "T00:00:00Z");
    if (viewMode === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
    else d.setUTCMonth(d.getUTCMonth() + delta);
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  const goToday = () => setCurrentDate(new Date().toISOString().slice(0, 10));

  const getEntry = (crewId, date) => {
    return roster.find((r) => r.crewId === crewId && r.date === date);
  };

  /* ═══ 5. Filter Crew by Active Group + Search ═══ */
  const groupFilteredCrew = useMemo(() => {
    const activeMembers = (Array.isArray(crew) ? crew : []).filter(
      (c) => c.status !== "inactive"
    );

    if (activeGroupId === "all") {
      return activeMembers;
    }

    if (!activeGroup) {
      return activeMembers;
    }

    return activeMembers.filter((c) =>
      crewBelongsToRosterGroup(c, activeGroup)
    );
  }, [crew, activeGroupId, activeGroup]);

  const displayedCrew = useMemo(() => {
    return groupFilteredCrew.filter((c) => {
      if (filterCrew && c.id !== filterCrew) return false;
      if (search) {
        const q = search.toLowerCase();
        const nameMatch = (c.fullName || "").toLowerCase().includes(q);
        const empMatch = (c.empNo || "").toLowerCase().includes(q);
        const roleMatch = (c.role || "").toLowerCase().includes(q);
        if (!nameMatch && !empMatch && !roleMatch) return false;
      }
      return true;
    });
  }, [groupFilteredCrew, filterCrew, search]);

  /* ═══ 6. Roster CRUD Operations ═══ */
  const openNew = (crewId, date) => {
    const member = crew.find((c) => c.id === crewId);
    setDraft({
      date,
      crewId,
      crewName: member?.fullName || "",
      type: "FLIGHT",
      flightIds: [],
      startTime: "08:00",
      endTime: "16:00",
      notes: "",
      status: "published",
      publishedAt: new Date().toISOString(),
    });
    setEditing("new");
  };

  const openEdit = (entry) => {
    setDraft({ ...entry, flightIds: entry.flightIds || [] });
    setEditing(entry.id);
  };

  const save = async () => {
    if (!draft.crewId || !draft.date) return;
    setSyncStatus?.("syncing");
    try {
      if (editing === "new") {
        const created = await rosterAPI.create(draft);
        const next = [...roster, { ...draft, id: created.id }];
        setRoster(next);
        showToast(
          isAr ? "✅ تمت إضافة الجدول ومزامنته" : "✅ Roster entry added",
          "success"
        );
      } else {
        await rosterAPI.update(editing, draft);
        const next = roster.map((r) =>
          r.id === editing ? { ...draft, id: editing } : r
        );
        setRoster(next);
        showToast(
          isAr ? "✅ تم تحديث الجدول ومزامنته" : "✅ Roster entry updated",
          "success"
        );
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (
      !(await confirmAction(
        isAr ? "هل أنت متأكد من حذف هذا الإدخال؟" : t.confirmDelete
      ))
    )
      return;
    setSyncStatus?.("syncing");
    try {
      await rosterAPI.remove(id);
      setRoster(roster.filter((r) => r.id !== id));
      setEditing(null);
      setSyncStatus?.("synced");
      showToast(isAr ? "تم الحذف" : "Deleted", "success");
    } catch (e) {
      showToast("Delete failed: " + e.message, "error");
      setSyncStatus?.("error");
    }
  };

  /* ═══ 7. Statistics ═══ */
  const stats = useMemo(() => {
    const s = {
      FLIGHT: 0,
      STANDBY: 0,
      LEAVE: 0,
      OFF: 0,
      TRAINING: 0,
      SICK: 0,
    };
    dates.forEach((d) => {
      if (!d) return;
      displayedCrew.forEach((c) => {
        const e = getEntry(c.id, d);
        if (e && s[e.type] !== undefined) s[e.type] = s[e.type] + 1;
      });
    });
    return s;
  }, [dates, displayedCrew, roster]);

  const fmtDateShort = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00Z");
    const days = isAr ? DAYS_AR : DAYS_EN;
    return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
  };

  const monthTitle = () => {
    const d = new Date(currentDate + "T00:00:00Z");
    const months = isAr ? MONTHS_AR : MONTHS_EN;
    return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  return (
    <div className="space-y-4 fade-in">
      {/* ═══════════════════════════════════════════════════════════
       * UNIFIED TOP HEADER — SECTION SWITCHER (ROSTER | STANDBY | LEAVE)
       * ═══════════════════════════════════════════════════════════ */}
      <div
        className="rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            {subTab === "roster" ? (
              <CalendarDays className="w-6 h-6" />
            ) : subTab === "standby" ? (
              <Zap className="w-6 h-6" />
            ) : (
              <Plane className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2
              className="text-lg sm:text-xl font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <span>
                {isAr
                  ? "إدارة الجداول والمناوبات والراحات (Roster & Planning)"
                  : "Crew Roster, Standby & Leave Hub"}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500">
                {isAr ? "قسم موحد" : "Unified Hub"}
              </span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {isAr
                ? "إدارة جداول الأطقم متعدّدة المجموعات (طاقم جوي، ضيافة، ترحيل، صيانة) والمناوبات الاحتياطية وإجازات الطواقم"
                : "Multi-group crew roster scheduling, EASA standby management and leave approvals"}
            </p>
          </div>
        </div>

        {/* Unified 3-way segmented switch */}
        <div
          className="flex items-center rounded-xl p-1 text-xs flex-wrap gap-1"
          style={{
            backgroundColor: "var(--bg-app)",
            border: "1px solid var(--border-default)",
          }}
        >
          <button
            type="button"
            onClick={() => handleSubTabChange("roster")}
            className="px-3.5 py-2 rounded-lg font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
            style={
              subTab === "roster"
                ? {
                    backgroundColor: "var(--bg-card)",
                    color: "var(--brand-primary)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-default)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            <CalendarDays className="w-4 h-4" />
            <span>{isAr ? "الروستر والجداول" : "Crew Roster"}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-500/15">
              {roster.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("standby")}
            className="px-3.5 py-2 rounded-lg font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
            style={
              subTab === "standby"
                ? {
                    backgroundColor: "var(--bg-card)",
                    color: "var(--brand-primary)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-default)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            <Zap className="w-4 h-4" />
            <span>{isAr ? "الاحتياطي (Standby)" : "Standby & On-Call"}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-500/15">
              {standby.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSubTabChange("leave")}
            className="px-3.5 py-2 rounded-lg font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0"
            style={
              subTab === "leave"
                ? {
                    backgroundColor: "var(--bg-card)",
                    color: "var(--brand-primary)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid var(--border-default)",
                  }
                : { color: "var(--text-muted)" }
            }
          >
            <Plane className="w-4 h-4" />
            <span>{isAr ? "الإجازات والراحات" : "Crew Leave"}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-500/15">
              {leave.length}
            </span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
       * SUBTAB 1: ROSTER (MULTI-GROUP SCHEDULES)
       * ═══════════════════════════════════════════════════════════ */}
      {subTab === "roster" && (
        <div className="space-y-3">
          {/* ═══ Multi-Group Selector Bar ═══ */}
          <div
            className="rounded-xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap">
              <span
                className="text-xs font-bold flex items-center gap-1.5 shrink-0 me-1"
                style={{ color: "var(--text-muted)" }}
              >
                <Layers className="w-3.5 h-3.5" />
                {isAr ? "مجموعات الروستر:" : "Roster Groups:"}
              </span>

              {canViewAll && (
                <button
                  type="button"
                  onClick={() => setActiveGroupId("all")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                  style={
                    activeGroupId === "all"
                      ? {
                          backgroundColor: "var(--brand-primary)",
                          color: "#ffffff",
                          boxShadow: "var(--shadow-sm)",
                        }
                      : {
                          backgroundColor: "var(--bg-app)",
                          border: "1px solid var(--border-default)",
                          color: "var(--text-primary)",
                        }
                  }
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{isAr ? "كافة الأطقم" : "All Crew"}</span>
                  <span className="text-[10px] px-1 rounded-full opacity-80">
                    ({crew.filter((c) => c.status !== "inactive").length})
                  </span>
                </button>
              )}

              {visibleGroups.map((grp) => {
                const isSelected = activeGroupId === grp.id;
                const count = crew.filter(
                  (c) =>
                    c.status !== "inactive" && crewBelongsToRosterGroup(c, grp)
                ).length;
                const theme =
                  GROUP_COLOR_THEMES[grp.color] || GROUP_COLOR_THEMES.sky;

                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setActiveGroupId(grp.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                    style={
                      isSelected
                        ? {
                            backgroundColor: theme.dot,
                            color: "#ffffff",
                            boxShadow: "var(--shadow-sm)",
                          }
                        : {
                            backgroundColor: "var(--bg-app)",
                            border: `1px solid var(--border-default)`,
                            color: "var(--text-primary)",
                          }
                    }
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected ? "#ffffff" : theme.dot,
                      }}
                    />
                    <span>
                      {isAr ? grp.nameAr || grp.name : grp.name || grp.nameAr}
                    </span>
                    <span
                      className="text-[10px] font-mono px-1 rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255,255,255,0.25)"
                          : "rgba(0,0,0,0.06)",
                      }}
                    >
                      {count}
                    </span>
                    {grp.visibility === "restricted" && (
                      <Lock className="w-2.5 h-2.5 opacity-70" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons: Add group & manage permissions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openCreateGroup}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap shadow-sm"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                {isAr ? "+ إضافة مجموعة" : "+ Add Group"}
              </button>

              <button
                type="button"
                onClick={openManageGroups}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                }}
                title={
                  isAr
                    ? "إدارة مجموعات الروستر وتخصيص صلاحيات الوصول"
                    : "Manage Roster Groups & Permissions"
                }
              >
                <Settings className="w-3.5 h-3.5" />
                {isAr ? "المجموعات والصلاحيات" : "Groups & Access"}
              </button>
            </div>
          </div>

          {/* ═══ Active Group Summary Banner ═══ */}
          {activeGroup && (
            <div
              className="rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      GROUP_COLOR_THEMES[activeGroup.color]?.dot || "#0284c7",
                  }}
                />
                <span className="font-bold text-sm">
                  {isAr
                    ? activeGroup.nameAr || activeGroup.name
                    : activeGroup.name || activeGroup.nameAr}
                </span>
                {activeGroup.description && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    — {activeGroup.description}
                  </span>
                )}
                <span
                  className="font-mono tabular-nums px-2 py-0.5 rounded text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    color: "var(--brand-primary)",
                  }}
                >
                  {isAr
                    ? `${groupFilteredCrew.length} عضو طاقم في هذه المجموعة`
                    : `${groupFilteredCrew.length} crew in this group`}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[11px] flex items-center gap-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Shield className="w-3 h-3 text-emerald-500" />
                  {activeGroup.visibility === "all"
                    ? isAr
                      ? "متاحة للجميع"
                      : "Public access"
                    : isAr
                    ? `صلاحية: ${(activeGroup.viewRoles || []).join(", ") || "مخصصة"}`
                    : `Access: ${(activeGroup.viewRoles || []).join(", ")}`}
                </span>

                {canEditCurrentGroup && (
                  <button
                    type="button"
                    onClick={() => openEditGroup(activeGroup)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Edit className="w-3 h-3" />
                    {isAr ? "تعديل الصلاحيات" : "Edit Access"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══ Toolbar ═══ */}
          <div
            className="rounded-xl border p-3 flex flex-wrap gap-2 items-center"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <button
              onClick={() => shift(-1)}
              className="p-2 rounded hover:opacity-80 transition"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={goToday}
              className="px-3 py-2 rounded-lg text-xs font-bold transition hover:opacity-90"
              style={{
                backgroundColor: "rgba(2, 132, 199, 0.12)",
                color: "#0284c7",
              }}
            >
              {t.today}
            </button>

            <button
              onClick={() => shift(1)}
              className="p-2 rounded hover:opacity-80 transition"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div
              className="text-sm font-bold mx-2"
              style={{ color: "var(--text-primary)" }}
            >
              {viewMode === "week"
                ? `${fmtDateShort(dates[0])} – ${fmtDateShort(dates[6])}`
                : monthTitle()}
            </div>

            <div className="flex-1" />

            <div className="relative">
              <Search
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isAr ? "بحث في الطاقم..." : t.search || "Search crew..."
                }
                className="ps-9 pe-3 py-2 border rounded-lg text-xs outline-none w-48"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <select
              value={filterCrew}
              onChange={(e) => setFilterCrew(e.target.value)}
              className="px-2 py-2 border rounded-lg text-xs outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">
                {isAr ? "كافة أفراد هذه المجموعة" : t.allCrew}
              </option>
              {groupFilteredCrew.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.empNo || c.role || ""})
                </option>
              ))}
            </select>

            <div
              className="flex rounded-lg overflow-hidden border"
              style={{ borderColor: "var(--border-default)" }}
            >
              <button
                onClick={() => setViewMode("week")}
                className="px-3 py-1.5 text-xs font-bold transition"
                style={
                  viewMode === "week"
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {t.weekView}
              </button>
              <button
                onClick={() => setViewMode("month")}
                className="px-3 py-1.5 text-xs font-bold transition"
                style={
                  viewMode === "month"
                    ? {
                        backgroundColor: "var(--brand-primary)",
                        color: "#ffffff",
                      }
                    : {
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {t.monthView}
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold transition hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-app)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Printer className="w-3.5 h-3.5" /> {t.print}
            </button>
          </div>

          {/* ═══ Stats Bar ═══ */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(ROSTER_TYPES).map(([k, v]) => (
              <div
                key={k}
                className={`rounded-xl border p-2.5 transition ${v.color}`}
              >
                <div className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-1">
                  <span>{v.icon}</span>
                  <span className="truncate">
                    {lang === "ar" ? v.label_ar : v.label_en}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums mt-0.5">
                  {stats[k] || 0}
                </div>
              </div>
            ))}
          </div>

          {/* ═══ Roster Grid Table ═══ */}
          <div
            className="rounded-xl border overflow-hidden shadow-sm"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead
                  className="border-b-2"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <tr>
                    <th
                      className="px-3 py-2.5 text-start font-bold sticky start-0 z-10 min-w-[170px]"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-sky-500" />
                        <span>{isAr ? "عضو الطاقم" : t.crew}</span>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {displayedCrew.length}
                        </span>
                      </div>
                    </th>

                    {dates.map((d, i) => {
                      if (!d)
                        return (
                          <th
                            key={i}
                            className="p-2 border-s"
                            style={{ borderColor: "var(--border-default)" }}
                          ></th>
                        );
                      const isToday =
                        d === new Date().toISOString().slice(0, 10);
                      return (
                        <th
                          key={i}
                          className="p-2 border-s text-center font-bold min-w-[95px]"
                          style={{
                            borderColor: "var(--border-default)",
                            backgroundColor: isToday
                              ? "rgba(2, 132, 199, 0.12)"
                              : "transparent",
                            color: isToday
                              ? "#0284c7"
                              : "var(--text-primary)",
                          }}
                        >
                          <div>{fmtDateShort(d)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {displayedCrew.length === 0 ? (
                    <tr>
                      <td
                        colSpan={dates.length + 1}
                        className="p-12 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Users className="w-8 h-8 opacity-40" />
                          <p className="font-semibold">
                            {isAr
                              ? "لا يوجد أفراد طاقم في هذه المجموعة أو مطابقة للبحث"
                              : t.noCrewMembers}
                          </p>
                          {canManageGroups && activeGroup && (
                            <button
                              type="button"
                              onClick={() => openEditGroup(activeGroup)}
                              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: "var(--brand-primary)",
                              }}
                            >
                              {isAr
                                ? "تعديل وظائف وأعضاء هذه المجموعة"
                                : "Edit Group Membership"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedCrew.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b transition hover:bg-slate-500/5"
                        style={{ borderColor: "var(--border-default)" }}
                      >
                        <td
                          className="px-3 py-2 font-bold sticky start-0 z-10 border-e"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-default)",
                          }}
                        >
                          <div
                            className="truncate text-sm"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {c.fullName}
                          </div>
                          <div
                            className="text-[10px] flex items-center gap-1.5 flex-wrap font-mono mt-0.5"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <span>{c.empNo || "—"}</span>
                            <span>·</span>
                            <span className="capitalize">
                              {c.role || c.position || "Crew"}
                            </span>
                          </div>
                        </td>

                        {dates.map((d, i) => {
                          if (!d)
                            return (
                              <td
                                key={i}
                                className="p-1 border-s"
                                style={{
                                  backgroundColor: "var(--bg-app)",
                                  borderColor: "var(--border-default)",
                                }}
                              ></td>
                            );

                          const entry = getEntry(c.id, d);
                          const t2 = entry ? ROSTER_TYPES[entry.type] : null;

                          return (
                            <td
                              key={i}
                              className="p-1 border-s text-center"
                              style={{ borderColor: "var(--border-default)" }}
                            >
                              {entry ? (
                                <button
                                  onClick={() => openEdit(entry)}
                                  className={`w-full px-1.5 py-1.5 rounded-lg border text-[10px] font-bold ${
                                    t2?.color || ""
                                  } hover:opacity-80 transition shadow-xs`}
                                  title={`${t2?.label_en || entry.type}${
                                    entry.notes ? " — " + entry.notes : ""
                                  }${
                                    entry.startTime && entry.endTime
                                      ? ` (${entry.startTime} - ${entry.endTime})`
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full shrink-0"
                                      style={{
                                        background: t2?.dot || "#0284c7",
                                      }}
                                    />
                                    <span className="truncate">
                                      {entry.type.slice(0, 3)}
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <button
                                  onClick={() => openNew(c.id, d)}
                                  className="w-full py-1 text-slate-400 hover:text-sky-600 rounded text-base transition hover:bg-slate-500/10 font-mono"
                                  title={
                                    isAr
                                      ? "إضافة واجب للروستر"
                                      : "Add roster duty"
                                  }
                                >
                                  +
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
       * SUBTAB 2: STANDBY (EASA COMPLIANCE)
       * ═══════════════════════════════════════════════════════════ */}
      {subTab === "standby" && (
        <StandbyModule
          crew={crew}
          standby={standby}
          setStandby={setStandby}
          setSyncStatus={setSyncStatus}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
       * SUBTAB 3: LEAVE (REQUESTS, APPROVALS & BALANCES)
       * ═══════════════════════════════════════════════════════════ */}
      {subTab === "leave" && (
        <LeaveModule
          crew={crew}
          leave={leave}
          setLeave={setLeave}
          setSyncStatus={setSyncStatus}
          currentUser={activeUser}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
       * ROSTER ENTRY MODAL (NEW / EDIT DUTY)
       * ═══════════════════════════════════════════════════════════ */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="rounded-2xl max-w-lg w-full p-5 shadow-2xl border"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-sky-500" />
                <span>
                  {editing === "new"
                    ? isAr
                      ? "إضافة واجب جديد للروستر"
                      : t.addRoster
                    : isAr
                    ? "تعديل واجب الروستر"
                    : t.editRoster}
                </span>
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:opacity-80 transition"
                style={{
                  backgroundColor: "var(--bg-app)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  className="text-xs font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isAr ? "عضو الطاقم" : t.crew}
                </label>
                <input
                  value={draft.crewName || ""}
                  disabled
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-xs opacity-80"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="text-xs font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isAr ? "التاريخ" : t.date}
                </label>
                <input
                  type="date"
                  value={draft.date || ""}
                  disabled
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-xs opacity-80"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="text-xs font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isAr ? "نوع الواجب (Duty Type)" : t.type}
                </label>
                <select
                  value={draft.type || "FLIGHT"}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  {Object.entries(ROSTER_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.icon} {lang === "ar" ? v.label_ar : v.label_en}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className="text-xs font-bold block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {isAr ? "وقت البدء (UTC)" : t.startTime}
                  </label>
                  <input
                    type="time"
                    value={draft.startTime || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, startTime: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="text-xs font-bold block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {isAr ? "وقت الانتهاء (UTC)" : t.endTime}
                  </label>
                  <input
                    type="time"
                    value={draft.endTime || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, endTime: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-xs outline-none"
                    style={{
                      backgroundColor: "var(--bg-app)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="text-xs font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  {isAr ? "ملاحظات وتفاصيل الواجب" : t.notes}
                </label>
                <textarea
                  value={draft.notes || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                  rows="2"
                  placeholder={
                    isAr
                      ? "رقم الرحلة، قطاع الرحلة، أو تعليمات خاصة..."
                      : "Flight numbers, route, or special remarks..."
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-xs outline-none"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div
              className="flex justify-end gap-2 mt-5 pt-4 border-t"
              style={{ borderColor: "var(--border-default)" }}
            >
              {editing !== "new" && (
                <button
                  type="button"
                  onClick={() => remove(draft.id)}
                  className="px-4 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/25 transition me-auto"
                >
                  {isAr ? "حذف الواجب" : t.delete}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold transition"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={save}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Save className="w-3.5 h-3.5" />
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
       * ROSTER GROUPS MODAL (ADD GROUP & UPDATE PERMISSIONS)
       * ═══════════════════════════════════════════════════════════ */}
      <RosterGroupsModal
        open={groupsModalOpen}
        mode={groupsModalMode}
        initialGroup={editingTargetGroup}
        groups={allGroups}
        crew={crew}
        roles={roles}
        users={users}
        settings={settings}
        activeGroupId={activeGroupId}
        onSelectGroup={(gid) => setActiveGroupId(gid)}
        onCreateGroup={createGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={deleteGroup}
        onClose={() => setGroupsModalOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default RosterModule;
