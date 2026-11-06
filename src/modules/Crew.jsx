/* ═══════════════════════════════════════════════════════════
 * CREW MODULE — Theme-aware (CSS Variables) + Modern Design
 * v5.0 — Multi-Aircraft + Dynamic Positions + Secondary Roles
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  User,
  Phone,
  Mail,
  IdCard,
  FileDown,
  UserPlus,
  Paperclip,
  Eye,
  Plane,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  SlidersHorizontal,
  ShieldAlert,
  Calendar,
  Award,
  Target,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { AvatarUpload } from "../components/AvatarUpload";
import { AttachmentsEditor } from "../components/AttachmentsEditor";
import { notifyCrewChange } from "../utils/notifications";
import {
  CrewTableIcon,
  CrewIDCardIcon,
  CrewEditorIcon,
  CrewMedicalIcon,
  CrewLicenseIcon,
  CrewBlockHoursIcon,
  CrewQualifiedIcon,
  CrewWarningIcon,
} from "../crewIcons";
import { crewAPI, usersAPI, toDisplayImageUrl } from "../api";
import { logSafe } from "../utils/audit";
import {
  docStatus,
  daysUntil,
  formatFileSize,
  getStatusColor,
  fmtDate,
  initials,
} from "../utils/helpers";
import { can as checkPerm } from "../config/permissions";
import { generateCrewCardPDF, downloadPDF } from "../utils/pdf";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { ROLE_OPTIONS, getPositionOptions } from "../config/constants";

/* ⭐ Helper — استخراج قائمة الطائرات المخصصة */
export function getAssignedAircrafts(c) {
  if (!c) return [];
  if (Array.isArray(c.assignedAircraft)) {
    return c.assignedAircraft.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof c.assignedAircraft === "string" && c.assignedAircraft.trim()) {
    try {
      const parsed = JSON.parse(c.assignedAircraft);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {}
    return c.assignedAircraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (c.acft) return [String(c.acft).trim()];
  return [];
}

/* ⭐ Helper — استخراج الأدوار الثانوية */
export function getSecondaryRoles(c) {
  if (!c) return [];
  let sr = c.secondaryRoles;
  if (Array.isArray(sr)) return sr.filter(Boolean);
  if (typeof sr === "string" && sr.trim()) {
    try {
      const parsed = JSON.parse(sr);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
  }
  return [];
}

/* ⭐ Helper — استخراج المستندات */
function getDocs(c) {
  let att = c.attachments || [];
  if (typeof att === "string") {
    try {
      att = JSON.parse(att);
    } catch {
      att = [];
    }
  }
  return Array.isArray(att) ? att : [];
}

/* ⭐ أولويات الأدوار */
const ROLE_PRIORITY = {
  captain: 1,
  tri: 2,
  firstOfficer: 3,
  observer: 4,
  flightAttendant: 5,
  fa1: 6,
  fa2: 7,
  engineer: 8,
  security: 9,
  loadmaster: 10,
  flightDispatcher: 11,
};

/* ⭐ ربط دور الطاقم بدور المستخدم */
const mapCrewRoleToUserRole = (crewRole) => {
  const map = {
    captain: "captain",
    tri: "captain",
    firstOfficer: "captain",
    observer: "captain",
    flightAttendant: "crewMember",
    fa1: "crewMember",
    fa2: "crewMember",
    engineer: "camo",
    security: "crewMember",
    loadmaster: "crewMember",
    flightDispatcher: "dispatcher",
  };
  return map[crewRole] || "crewMember";
};

const suggestUsername = (member) => {
  if (member.email) {
    return member.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "");
  }
  return String(member.fullName || "")
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
};

export function Crew({
  crew,
  setCrew,
  fleet = [],
  users = [],
  setUsers,
  companyName,
  setSyncStatus,
  settings = {},
}) {
  const t = useT();
  const { user } = useAuth();

  /* ⭐ الوظائف الديناميكية */
  const dynamicPositions = useMemo(
    () => getPositionOptions(settings),
    [settings]
  );

  const roleChoices = useMemo(() => {
    const fromPositions = dynamicPositions.map((p) => p.key);
    const fromLegacy = ROLE_OPTIONS.filter(
      (r) => !fromPositions.includes(r) && r !== "flightAttendant"
    );
    return ["flightAttendant", ...fromPositions, ...fromLegacy];
  }, [dynamicPositions]);

  const getPositionLabel = (key) => {
    const pos = dynamicPositions.find((p) => p.key === key);
    if (pos) return pos.short || pos.en || key;
    return t[key] || key;
  };

  const isAlreadyUser = (c) => {
    if (!c) return false;
    const sUsername = suggestUsername(c);
    return (users || []).some(
      (u) =>
        (u.crewId &&
          (String(u.crewId) === String(c.id) ||
            String(u.crewId) === String(c._id))) ||
        (u.username &&
          sUsername &&
          String(u.username).trim().toLowerCase() ===
            String(sUsername).trim().toLowerCase()) ||
        (u.email &&
          c.email &&
          String(u.email).trim().toLowerCase() ===
            String(c.email).trim().toLowerCase()) ||
        (u.fullName &&
          c.fullName &&
          String(u.fullName).trim().toLowerCase() ===
            String(c.fullName).trim().toLowerCase())
    );
  };

  /* ⭐ الصلاحيات */
  const canCreate = checkPerm(user, "crew.create");
  const canEdit = checkPerm(user, "crew.edit");
  const canDelete = checkPerm(user, "crew.delete");
  const canCard = checkPerm(user, "crew.card");
  const canDocsView = checkPerm(user, "crew.docs");
  const canDocsEdit = checkPerm(user, "crew.docs_edit");
  const canDocsDownload = checkPerm(user, "crew.docs_download");
  const canCreateUser = canEdit && checkPerm(user, "users.create");

  /* ⭐ State */
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [docsCrew, setDocsCrew] = useState(null);
  const [docsDraft, setDocsDraft] = useState([]);
  const [docsSaving, setDocsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [acftFilter, setAcftFilter] = useState("");
  const [statusQuickFilter, setStatusQuickFilter] = useState("all");
  const [sortBy, setSortBy] = useLocalStorage("aeroops.crewSortBy", "role");
  const [sortDir, setSortDir] = useLocalStorage("aeroops.crewSortDir", "asc");
  const [viewMode, setViewMode] = useLocalStorage("aeroops.crewView", "cards");
  const [busyPdf, setBusyPdf] = useState(null);
  const [customAcftInput, setCustomAcftInput] = useState("");

  const [createUserCrew, setCreateUserCrew] = useState(null);
  const [userDraft, setUserDraft] = useState({});
  const [userSaving, setUserSaving] = useState(false);

  /* ⭐ Metrics */
  const metrics = useMemo(() => {
    const total = crew.length;
    const active = crew.filter((c) => c.status === "active").length;
    const assigned = crew.filter(
      (c) => getAssignedAircrafts(c).length > 0
    ).length;
    const expiring = crew.filter((c) => {
      const medSt = docStatus(c.medicalExpiry);
      const licSt = docStatus(c.licenseExpiry);
      return (
        medSt === "critical" ||
        medSt === "expired" ||
        licSt === "critical" ||
        licSt === "expired"
      );
    }).length;
    const inactive = crew.filter((c) => c.status !== "active").length;
    return { total, active, assigned, expiring, inactive };
  }, [crew]);

  /* ⭐ Filtering */
  const filtered = useMemo(() => {
    return crew.filter((c) => {
      const assigned = getAssignedAircrafts(c);
      const sec = getSecondaryRoles(c);
      const s = (
        (c.fullName || "") +
        " " +
        (c.empNo || "") +
        " " +
        (c.email || "") +
        " " +
        assigned.join(" ") +
        " " +
        sec.join(" ")
      ).toLowerCase();

      const matchSearch = !search || s.includes(search.toLowerCase());
      const matchRole =
        !roleFilter || c.role === roleFilter || sec.includes(roleFilter);
      const matchAcft = !acftFilter || assigned.includes(acftFilter);

      let matchQuick = true;
      if (statusQuickFilter === "active") {
        matchQuick = c.status === "active";
      } else if (statusQuickFilter === "assigned") {
        matchQuick = assigned.length > 0;
      } else if (statusQuickFilter === "expiring") {
        const medSt = docStatus(c.medicalExpiry);
        const licSt = docStatus(c.licenseExpiry);
        matchQuick =
          medSt === "critical" ||
          medSt === "expired" ||
          licSt === "critical" ||
          licSt === "expired";
      } else if (statusQuickFilter === "inactive") {
        matchQuick = c.status !== "active";
      }

      return matchSearch && matchRole && matchAcft && matchQuick;
    });
  }, [crew, search, roleFilter, acftFilter, statusQuickFilter]);

  /* ⭐ Sorting */
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "role") {
        const prioA = ROLE_PRIORITY[a.role] || 99;
        const prioB = ROLE_PRIORITY[b.role] || 99;
        cmp = prioA - prioB;
        if (cmp === 0)
          cmp = String(a.fullName || "").localeCompare(
            String(b.fullName || "")
          );
      } else if (sortBy === "name") {
        cmp = String(a.fullName || "").localeCompare(
          String(b.fullName || ""),
          undefined,
          { sensitivity: "base" }
        );
      } else if (sortBy === "empNo") {
        cmp = String(a.empNo || "").localeCompare(
          String(b.empNo || ""),
          undefined,
          { numeric: true }
        );
      } else if (sortBy === "aircraft") {
        const acftsA = getAssignedAircrafts(a);
        const acftsB = getAssignedAircrafts(b);
        cmp =
          acftsB.length - acftsA.length ||
          acftsA.join(",").localeCompare(acftsB.join(","));
      } else if (sortBy === "ftl28") {
        cmp = (a.ftl28 || 0) - (b.ftl28 || 0);
      } else if (sortBy === "medical") {
        const dateA = a.medicalExpiry
          ? String(a.medicalExpiry).slice(0, 10)
          : "9999-99-99";
        const dateB = b.medicalExpiry
          ? String(b.medicalExpiry).slice(0, 10)
          : "9999-99-99";
        cmp = dateA.localeCompare(dateB);
      } else if (sortBy === "license") {
        const dateA = a.licenseExpiry
          ? String(a.licenseExpiry).slice(0, 10)
          : "9999-99-99";
        const dateB = b.licenseExpiry
          ? String(b.licenseExpiry).slice(0, 10)
          : "9999-99-99";
        cmp = dateA.localeCompare(dateB);
      } else if (sortBy === "status") {
        const stA = a.status === "active" ? 0 : 1;
        const stB = b.status === "active" ? 0 : 1;
        cmp = stA - stB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(
        column === "ftl28"
          ? "desc"
          : column === "medical" || column === "license"
          ? "asc"
          : "asc"
      );
    }
  };

  /* ⭐ CRUD */
  const openNew = () => {
    if (!canCreate) return;
    setDraft({
      fullName: "",
      role: "captain",
      secondaryRoles: [],
      empNo: "",
      eNumber: "",
      email: "",
      phone: "",
      nationality: "",
      dob: "",
      gender: "male",
      base: "",
      assignedAircraft: [],
      licenseNo: "",
      licenseExpiry: "",
      medicalExpiry: "",
      passportNo: "",
      passportExpiry: "",
      ftl28: 0,
      avatar: null,
      status: "active",
      attachments: [],
    });
    setCustomAcftInput("");
    setEditing("new");
  };

  const openEdit = (c) => {
    if (!canEdit) {
      showToast("⚠️ ليس لديك صلاحية تعديل");
      return;
    }
    setDraft({
      ...c,
      assignedAircraft: getAssignedAircrafts(c),
      secondaryRoles: getSecondaryRoles(c),
      dob: c.dob ? String(c.dob).slice(0, 10) : "",
      licenseExpiry: c.licenseExpiry
        ? String(c.licenseExpiry).slice(0, 10)
        : "",
      medicalExpiry: c.medicalExpiry
        ? String(c.medicalExpiry).slice(0, 10)
        : "",
      passportExpiry: c.passportExpiry
        ? String(c.passportExpiry).slice(0, 10)
        : "",
    });
    setCustomAcftInput("");
    setEditing(c.id);
  };

  const handleToggleAircraft = (reg) => {
    const current = Array.isArray(draft.assignedAircraft)
      ? draft.assignedAircraft
      : [];
    if (current.includes(reg)) {
      setDraft({
        ...draft,
        assignedAircraft: current.filter((r) => r !== reg),
      });
    } else {
      setDraft({ ...draft, assignedAircraft: [...current, reg] });
    }
  };

  const handleSelectAllFleet = () => {
    const allRegs = fleet.map((a) => a.reg).filter(Boolean);
    const current = Array.isArray(draft.assignedAircraft)
      ? draft.assignedAircraft
      : [];
    const merged = Array.from(new Set([...current, ...allRegs]));
    setDraft({ ...draft, assignedAircraft: merged });
  };

  const handleClearAircraft = () => {
    setDraft({ ...draft, assignedAircraft: [] });
  };

  const handleAddCustomAircraft = () => {
    const clean = customAcftInput.trim().toUpperCase();
    if (!clean) return;
    const current = Array.isArray(draft.assignedAircraft)
      ? draft.assignedAircraft
      : [];
    if (!current.includes(clean)) {
      setDraft({ ...draft, assignedAircraft: [...current, clean] });
    }
    setCustomAcftInput("");
  };

  const handleToggleSecondaryRole = (r) => {
    const current = Array.isArray(draft.secondaryRoles)
      ? draft.secondaryRoles
      : [];
    if (current.includes(r)) {
      setDraft({
        ...draft,
        secondaryRoles: current.filter((x) => x !== r),
      });
    } else {
      setDraft({
        ...draft,
        secondaryRoles: [...current, r],
      });
    }
  };

  const save = async () => {
    if (editing === "new" && !canCreate) return;
    if (editing !== "new" && !canEdit) return;
    if (!draft.fullName) return;

    setSyncStatus?.("syncing");
    try {
      const payload = {
        ...draft,
        assignedAircraft: Array.isArray(draft.assignedAircraft)
          ? draft.assignedAircraft
          : [],
        secondaryRoles: Array.isArray(draft.secondaryRoles)
          ? draft.secondaryRoles
          : [],
      };

      if (editing === "new") {
        const created = await crewAPI.create({ ...payload, attachments: [] });
        setCrew([
          ...crew,
          {
            ...payload,
            id: created.id,
            attachments: [],
            assignedAircraft: payload.assignedAircraft,
            secondaryRoles: payload.secondaryRoles,
          },
        ]);
        logSafe(user, "CREATE", "Crew", created.id, draft.fullName, {});
        notifyCrewChange(
          draft.fullName,
          "create",
          `إضافة عضو طاقم جديد (${draft.role || ""})`
        );
      } else {
        const before = crew.find((c) => c.id === editing);
        const updated = {
          ...payload,
          attachments: before?.attachments || [],
        };
        await crewAPI.update(editing, updated);
        setCrew(
          crew.map((c) => (c.id === editing ? { ...updated, id: editing } : c))
        );
        logSafe(user, "UPDATE", "Crew", editing, draft.fullName, {});
        notifyCrewChange(
          draft.fullName,
          "update",
          `تحديث بيانات عضو الطاقم (${draft.role || ""})`
        );

        // ⭐ التحديث التلقائي الفوري لبيانات المستخدم المرتبطة بهذا الطاقم (Auto-sync linked users)
        if (Array.isArray(users) && users.length > 0) {
          const linkedUsers = users.filter((u) => {
            if (u.crewId && String(u.crewId) === String(editing)) return true;
            const uEmail = String(u.email || "").trim().toLowerCase();
            const bEmail = String(before?.email || "").trim().toLowerCase();
            const dEmail = String(draft?.email || "").trim().toLowerCase();
            if (uEmail && (uEmail === bEmail || uEmail === dEmail)) return true;
            const uName = String(u.username || "").trim().toLowerCase();
            const bEmp = String(before?.empNo || "").trim().toLowerCase();
            const dEmp = String(draft?.empNo || "").trim().toLowerCase();
            if (uName && (uName === bEmp || uName === dEmp)) return true;
            return false;
          });

          for (const lu of linkedUsers) {
            const updatedUser = {
              ...lu,
              crewId: editing,
              fullName: draft.fullName || lu.fullName,
              email: draft.email !== undefined ? draft.email : lu.email,
              phone: draft.phone !== undefined ? draft.phone : lu.phone,
              avatar: draft.avatar !== undefined ? draft.avatar : lu.avatar,
              jobTitle: draft.role || lu.jobTitle,
              active:
                draft.status === "active"
                  ? true
                  : draft.status
                  ? false
                  : lu.active,
            };
            try {
              await usersAPI.update(lu.id, updatedUser);
              if (typeof setUsers === "function") {
                setUsers((prev) =>
                  (prev || []).map((u) =>
                    u.id === lu.id ? { ...u, ...updatedUser } : u
                  )
                );
              }
              logSafe(
                user,
                "UPDATE",
                "Users",
                lu.id,
                `Auto-synced from Crew: ${draft.fullName}`,
                {}
              );
            } catch (errSync) {
              console.warn("Failed to auto-sync linked user:", errSync);
            }
          }
        }
      }
      setEditing(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("Save failed: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const remove = async (id) => {
    if (!canDelete) return;
    if (!(await confirmAction(t.confirmDelete))) return;
    const member = crew.find((c) => c.id === id);
    try {
      await crewAPI.remove(id);
      setCrew(crew.filter((c) => c.id !== id));
      logSafe(user, "DELETE", "Crew", id, member?.fullName || "", {});
      notifyCrewChange(
        member?.fullName || "عضو طاقم",
        "delete",
        "تم حذف عضو الطاقم من المنظومة"
      );
    } catch (e) {
      showToast("Delete failed: " + e.message);
    }
  };

  const downloadCard = async (c) => {
    if (!canCard) return;
    setBusyPdf(c.id);
    try {
      const bytes = await generateCrewCardPDF(c, companyName);
      downloadPDF(bytes, `crew-card-${c.empNo || c.id}.pdf`);
    } catch (e) {
      showToast("PDF failed: " + e.message);
    } finally {
      setBusyPdf(null);
    }
  };

  const openDocs = (c) => {
    if (!canDocsView) return;
    setDocsCrew(c);
    setDocsDraft(getDocs(c));
  };

  const saveDocs = async () => {
    if (!canDocsEdit) return;
    if (!docsCrew) return;
    setDocsSaving(true);
    try {
      const updated = {
        ...docsCrew,
        attachments: docsDraft,
        assignedAircraft: getAssignedAircrafts(docsCrew),
        secondaryRoles: getSecondaryRoles(docsCrew),
      };
      await crewAPI.update(docsCrew.id, updated);
      setCrew(crew.map((c) => (c.id === docsCrew.id ? { ...updated } : c)));
      setDocsCrew(null);
      setDocsDraft([]);
      showToast("✅ " + (t.saved || "تم الحفظ"));
    } catch (e) {
      showToast("Save failed: " + e.message);
    } finally {
      setDocsSaving(false);
    }
  };

  const openCreateUser = (c) => {
    if (!canCreateUser) return;
    if (isAlreadyUser(c)) return;
    setUserDraft({
      username: suggestUsername(c),
      password: "FlightOps@2026",
      fullName: c.fullName,
      email: c.email || "",
      phone: c.phone || "",
      jobTitle: c.role,
      role: mapCrewRoleToUserRole(c.role),
      active: true,
      crewId: c.id,
      avatar: c.avatar || null,
      perms: [],
    });
    setCreateUserCrew(c);
  };

  const saveNewUser = async () => {
    if (!canCreateUser) return;
    if (!userDraft.username || !userDraft.password) return;

    setUserSaving(true);
    try {
      const created = await usersAPI.create(userDraft);
      const newUserObj = {
        ...userDraft,
        id: created?.id || "usr_" + Math.random().toString(36).substr(2, 9),
      };
      if (typeof setUsers === "function") {
        setUsers((prev) => [...(prev || []), newUserObj]);
      }
      showToast(
        `✅ تم إنشاء المستخدم\n\n👤 ${userDraft.fullName}\n🔑 ${userDraft.username}\n🔒 ${userDraft.password}`
      );
      setCreateUserCrew(null);
      setUserDraft({});
    } catch (e) {
      showToast("❌ " + e.message);
    } finally {
      setUserSaving(false);
    }
  };

  const hasAnyAction =
    canEdit || canDocsView || canCard || canDelete || canCreateUser;

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "var(--brand-gradient)" }}
          >
            <CrewTableIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2
              className="text-lg font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <span>{t.crew || "CREW STATUS"}</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono"
                style={{
                  backgroundColor: "var(--bg-app)",
                  color: "var(--brand-primary)",
                }}
              >
                {sorted.length} / {crew.length}
              </span>
            </h2>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {metrics.active} {t.active || "Active"} · {metrics.assigned}{" "}
              {t.assignedToAcft || "Assigned"} · {metrics.total}{" "}
              {t.all || "Total"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid var(--border-default)" }}
          >
            {[
              { id: "cards", l: "⊞", title: "Cards" },
              { id: "table", l: "☰", title: "Table" },
              { id: "list", l: "≡", title: "List" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                title={v.title}
                className="px-3 py-1.5 text-sm font-bold transition"
                style={
                  viewMode === v.id
                    ? {
                        background: "var(--brand-gradient)",
                        color: "white",
                      }
                    : {
                        backgroundColor: "var(--bg-card)",
                        color: "var(--text-muted)",
                      }
                }
              >
                {v.l}
              </button>
            ))}
          </div>

          {canCreate && (
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{
                background: "var(--brand-gradient)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Plus className="w-4 h-4" /> {t.addCrew || "Add Crew"}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Metric Cards ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {[
          {
            id: "all",
            label: t.all || "إجمالي الطاقم",
            count: metrics.total,
            icon: User,
            color: "var(--brand-primary)",
          },
          {
            id: "active",
            label: t.active || "النشطون",
            count: metrics.active,
            icon: Check,
            color: "#22c55e",
          },
          {
            id: "assigned",
            label: t.assignedToAcft || "مرتبط بطائرات",
            count: metrics.assigned,
            icon: Plane,
            color: "#f59e0b",
          },
          {
            id: "expiring",
            label: t.expiringSoonDocs || "تنبيه وثائق",
            count: metrics.expiring,
            icon: ShieldAlert,
            color: metrics.expiring > 0 ? "#f43f5e" : "#94a3b8",
          },
          {
            id: "inactive",
            label: t.inactive || "غير نشط",
            count: metrics.inactive,
            icon: Calendar,
            color: "#94a3b8",
          },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = statusQuickFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setStatusQuickFilter(item.id)}
              className="p-2.5 rounded-xl text-start transition relative overflow-hidden"
              style={{
                backgroundColor: isSelected
                  ? "var(--bg-app)"
                  : "var(--bg-card)",
                border: isSelected
                  ? `2px solid var(--brand-primary)`
                  : `1px solid var(--border-default)`,
                boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-semibold truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.label}
                </span>
                <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
              </div>
              <div
                className="text-xl font-bold mt-1 font-mono"
                style={{ color: "var(--text-primary)" }}
              >
                {item.count}
              </div>
            </button>
          );
        })}
      </div>

      {/* ═══ Toolbar ═══ */}
      <div
        className="p-3 rounded-xl flex flex-wrap gap-2.5 items-center justify-between"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[280px]">
          <div className="relative min-w-[200px] flex-1">
            <Search
              className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
              style={{ color: "var(--text-muted)" }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search || "بحث..."}
              className="ps-9 h-9 text-xs"
            />
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-auto h-9 text-xs"
          >
            <option value="">👤 {t.allStatuses || "All Roles"}</option>
            {roleChoices.map((r) => (
              <option key={r} value={r}>
                {t[r] || r}
              </option>
            ))}
          </Select>

          <Select
            value={acftFilter}
            onChange={(e) => setAcftFilter(e.target.value)}
            className="w-auto h-9 text-xs"
          >
            <option value="">✈️ {t.allAircraft || "All Aircraft"}</option>
            {fleet.map((a) => (
              <option key={a.id || a.reg} value={a.reg}>
                {a.reg} ({a.type})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <ArrowUpDown
              className="w-3.5 h-3.5"
              style={{ color: "var(--text-muted)" }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="role">👑 {t.sortRole || "Role"}</option>
              <option value="name">🔤 {t.sortName || "Name"}</option>
              <option value="empNo">🔢 {t.sortEmpNo || "Emp No"}</option>
              <option value="aircraft">
                ✈️ {t.sortAircraft || "Aircraft"}
              </option>
              <option value="ftl28">⏱️ FTL28</option>
              <option value="medical">🩺 Medical</option>
              <option value="license">📜 License</option>
              <option value="status">🟢 Status</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="p-1 rounded transition"
              style={{ color: "var(--brand-primary)" }}
            >
              {sortDir === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CARDS VIEW ═══ */}
      {viewMode === "cards" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((c) => {
            const medSt = docStatus(c.medicalExpiry);
            const licSt = docStatus(c.licenseExpiry);
            const hasCritical =
              medSt === "critical" ||
              medSt === "expired" ||
              licSt === "critical" ||
              licSt === "expired";
            const docs = getDocs(c);
            const docsN = docs.length;
            const assignedAcfts = getAssignedAircrafts(c);
            const secondary = getSecondaryRoles(c);

            return (
              <div
                key={c.id}
                className="rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-sm)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0"
                      style={{
                        backgroundColor: "var(--bg-app)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {toDisplayImageUrl(c.avatar) ? (
                        <img
                          src={toDisplayImageUrl(c.avatar)}
                          alt={c.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-bold text-lg"
                          style={{
                            background: "var(--brand-gradient)",
                            color: "white",
                          }}
                        >
                          {initials(c.fullName)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-bold truncate flex items-center gap-1.5"
                        style={{ color: "var(--text-primary)" }}
                      >
                        <span className="truncate">{c.fullName}</span>
                        {c.role === "captain" && (
                          <CrewQualifiedIcon
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--brand-primary)" }}
                          />
                        )}
                        {hasCritical && (
                          <CrewWarningIcon className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                        )}
                      </div>
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t[c.role] || c.role} · {c.empNo}
                      </div>

                      {secondary.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {secondary.map((r) => {
                            const pos = dynamicPositions.find(
                              (p) => p.key === r
                            );
                            return (
                              <span
                                key={r}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/40"
                                title={`Secondary: ${pos?.en || r}`}
                              >
                                🎯 {pos?.short || r}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-1.5">
                        {assignedAcfts.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedAcfts.map((acft) => (
                              <span
                                key={acft}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-mono font-bold text-[10px] border border-amber-500/40"
                              >
                                <Plane className="w-2.5 h-2.5" />
                                <span>{acft}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] italic"
                            style={{ color: "var(--text-muted)" }}
                          >
                            ✈️ {t.allAircraft || "كل الأسطول"}
                          </span>
                        )}
                      </div>

                      <div
                        className="text-xs flex items-center gap-1 mt-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{c.email || "—"}</span>
                      </div>
                    </div>
                    <Badge kind={c.status}>{t[c.status] || c.status}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                    <div
                      className="p-2 rounded text-center"
                      style={{ backgroundColor: "var(--bg-app)" }}
                    >
                      <CrewBlockHoursIcon
                        className="w-4 h-4 mx-auto mb-1"
                        style={{ color: "var(--brand-primary)" }}
                      />
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        FTL28
                      </div>
                      <div
                        className={`font-bold font-mono ${
                          c.ftl28 > 85 ? "text-rose-500" : ""
                        }`}
                        style={
                          c.ftl28 > 85 ? {} : { color: "var(--text-primary)" }
                        }
                      >
                        {c.ftl28}h
                      </div>
                    </div>
                    <div
                      className="p-2 rounded text-center"
                      style={{ backgroundColor: "var(--bg-app)" }}
                    >
                      <CrewMedicalIcon className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Medical
                      </div>
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fmtDate(c.medicalExpiry).slice(5)}
                      </div>
                    </div>
                    <div
                      className="p-2 rounded text-center"
                      style={{ backgroundColor: "var(--bg-app)" }}
                    >
                      <CrewLicenseIcon className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <div
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        License
                      </div>
                      <div
                        className="font-mono text-[10px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {fmtDate(c.licenseExpiry).slice(5)}
                      </div>
                    </div>
                  </div>
                </div>

                {hasAnyAction && (
                  <div
                    className="space-y-1.5 pt-2 mt-2"
                    style={{ borderTop: "1px solid var(--border-default)" }}
                  >
                    <div className="grid grid-cols-3 gap-1.5">
                      {canEdit && (
                        <button
                          onClick={() => openEdit(c)}
                          className="py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs flex items-center justify-center gap-1 font-bold transition hover:bg-amber-500/25"
                        >
                          <CrewEditorIcon className="w-3.5 h-3.5" />{" "}
                          {t.edit || "تعديل"}
                        </button>
                      )}
                      {canDocsView && (
                        <button
                          onClick={() => openDocs(c)}
                          className="relative py-2 rounded-lg bg-purple-500/15 text-purple-400 text-xs flex items-center justify-center gap-1 font-bold transition hover:bg-purple-500/25"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {docsN > 0 && (
                            <span className="absolute -top-1.5 -end-1.5 bg-purple-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                              {docsN}
                            </span>
                          )}
                        </button>
                      )}
                      {canCard && (
                        <button
                          onClick={() => downloadCard(c)}
                          disabled={busyPdf === c.id}
                          className="py-2 rounded-lg text-xs flex items-center justify-center gap-1 font-bold disabled:opacity-50 transition"
                          style={{
                            backgroundColor: "rgba(99, 102, 241, 0.15)",
                            color: "var(--brand-primary)",
                          }}
                        >
                          <CrewIDCardIcon className="w-3.5 h-3.5" /> ID
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {canCreateUser && !isAlreadyUser(c) && (
                        <button
                          onClick={() => openCreateUser(c)}
                          className="flex-1 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-[10px] flex items-center justify-center gap-1 font-semibold transition hover:bg-indigo-500/25"
                        >
                          <UserPlus className="w-3 h-3" /> User
                        </button>
                      )}
                      {canCreateUser && isAlreadyUser(c) && (
                        <div className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] flex items-center justify-center gap-1 font-bold">
                          ✓ Account
                        </div>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => remove(c.id)}
                          className="py-1.5 px-2 rounded-lg bg-rose-500/15 text-rose-400 text-xs transition hover:bg-rose-500/25"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === "table" && (
        <div
          className="overflow-x-auto rounded-xl"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <table className="w-full text-sm">
            <thead
              className="select-none"
              style={{
                backgroundColor: "var(--bg-app)",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              <tr>
                <th
                  className="px-3 py-3 text-start font-semibold w-12"
                  style={{ color: "var(--text-primary)" }}
                >
                  #
                </th>
                {[
                  { id: "name", label: t.fullName || "Full Name" },
                  { id: "role", label: t.role || "Role" },
                  { id: "aircraft", label: `✈️ ${t.aircraft || "Aircraft"}` },
                  { id: "empNo", label: t.empNo || "Emp No" },
                  { id: "email", label: t.email || "Email" },
                  { id: "ftl28", label: "FTL28" },
                  { id: "medical", label: "Medical" },
                  { id: "license", label: "License" },
                  { id: "status", label: t.status || "Status" },
                ].map((col) => (
                  <th
                    key={col.id}
                    onClick={() =>
                      ["email"].includes(col.id) ? null : toggleSort(col.id)
                    }
                    className="px-3 py-3 text-start font-semibold"
                    style={{
                      color: "var(--text-primary)",
                      cursor: ["email"].includes(col.id)
                        ? "default"
                        : "pointer",
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {sortBy === col.id && (
                        <span style={{ color: "var(--brand-primary)" }}>
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th
                  className="px-3 py-3 text-start font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  🎯 Secondary
                </th>
                <th
                  className="px-3 py-3 text-start font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Docs
                </th>
                {hasAnyAction && (
                  <th
                    className="px-3 py-3 text-end font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t.actions || "Actions"}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, idx) => {
                const docs = getDocs(c);
                const assignedAcfts = getAssignedAircrafts(c);
                const secondary = getSecondaryRoles(c);
                return (
                  <tr
                    key={c.id}
                    className="transition"
                    style={{
                      borderTop: "1px solid var(--border-default)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-app)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {idx + 1}
                    </td>
                    <td
                      className="px-3 py-2 font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <div className="flex items-center gap-2">
                        {toDisplayImageUrl(c.avatar) ? (
                          <img
                            src={toDisplayImageUrl(c.avatar)}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                            style={{
                              border: "1px solid var(--border-default)",
                            }}
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full font-bold text-[10px] flex items-center justify-center"
                            style={{
                              background: "var(--brand-gradient)",
                              color: "white",
                            }}
                          >
                            {initials(c.fullName)}
                          </div>
                        )}
                        <span>{c.fullName}</span>
                      </div>
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t[c.role] || c.role}
                    </td>
                    <td className="px-3 py-2">
                      {assignedAcfts.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {assignedAcfts.map((acft) => (
                            <span
                              key={acft}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono font-bold text-xs border border-amber-500/40"
                            >
                              <Plane className="w-2.5 h-2.5" />
                              <span>{acft}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2 font-mono text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {c.empNo}
                    </td>
                    <td
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {c.email || "—"}
                    </td>
                    <td
                      className={`px-3 py-2 font-bold font-mono text-xs ${
                        c.ftl28 > 85 ? "text-rose-500" : ""
                      }`}
                      style={
                        c.ftl28 > 85 ? {} : { color: "var(--text-primary)" }
                      }
                    >
                      {c.ftl28}h
                    </td>
                    <td className="px-3 py-2">
                      <Badge kind={docStatus(c.medicalExpiry)}>
                        {fmtDate(c.medicalExpiry)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge kind={docStatus(c.licenseExpiry)}>
                        {fmtDate(c.licenseExpiry)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge kind={c.status}>{t[c.status] || c.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {secondary.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {secondary.map((r) => {
                            const pos = dynamicPositions.find(
                              (p) => p.key === r
                            );
                            return (
                              <span
                                key={r}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/40"
                              >
                                {pos?.short || r}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {canDocsView ? (
                        <button
                          onClick={() => openDocs(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-purple-500/15 text-purple-400 text-xs font-bold transition hover:bg-purple-500/25"
                        >
                          <Paperclip className="w-3 h-3" /> {docs.length}
                        </button>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {docs.length}
                        </span>
                      )}
                    </td>
                    {hasAnyAction && (
                      <td className="px-3 py-2 text-end">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(c)}
                              className="p-1.5 rounded transition bg-amber-500/10 hover:bg-amber-500/25"
                              style={{ color: "#f59e0b" }}
                              title={t.edit || "Edit"}
                            >
                              <CrewEditorIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canCard && (
                            <button
                              onClick={() => downloadCard(c)}
                              disabled={busyPdf === c.id}
                              className="p-1.5 rounded transition hover:bg-opacity-25"
                              style={{
                                backgroundColor: "rgba(99, 102, 241, 0.1)",
                                color: "var(--brand-primary)",
                              }}
                              title="ID Card"
                            >
                              <CrewIDCardIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canCreateUser && !isAlreadyUser(c) && (
                            <button
                              onClick={() => openCreateUser(c)}
                              className="p-1.5 rounded transition bg-indigo-500/10 hover:bg-indigo-500/25"
                              style={{ color: "#818cf8" }}
                              title="Create User"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}
                          {canCreateUser && isAlreadyUser(c) && (
                            <span
                              className="p-1.5 rounded"
                              style={{ color: "#10b981" }}
                              title="Account exists"
                            >
                              <User className="w-4 h-4" />
                            </span>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => remove(c.id)}
                              className="p-1.5 rounded transition bg-rose-500/10 hover:bg-rose-500/25"
                              style={{ color: "#f43f5e" }}
                              title={t.delete || "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ LIST VIEW ═══ */}
      {viewMode === "list" && (
        <div
          className="rounded-xl divide-y"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-sm)",
            borderColor: "var(--border-default)",
          }}
        >
          {sorted.map((c) => {
            const docs = getDocs(c);
            const assignedAcfts = getAssignedAircrafts(c);
            const secondary = getSecondaryRoles(c);
            return (
              <div
                key={c.id}
                className="p-4 flex items-center gap-4 transition"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-app)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    backgroundColor: "var(--bg-app)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {toDisplayImageUrl(c.avatar) ? (
                    <img
                      src={toDisplayImageUrl(c.avatar)}
                      alt={c.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User
                      className="w-full h-full p-2"
                      style={{ color: "var(--text-muted)" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {c.fullName}
                  </div>
                  <div
                    className="text-xs flex items-center gap-2 flex-wrap mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>
                      {t[c.role] || c.role} · {c.empNo} · {c.base || "Base"}
                    </span>
                    {secondary.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {secondary.map((r) => {
                          const pos = dynamicPositions.find((p) => p.key === r);
                          return (
                            <span
                              key={r}
                              className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/40"
                            >
                              🎯 {pos?.short || r}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {assignedAcfts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {assignedAcfts.map((acft) => (
                          <span
                            key={acft}
                            className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/40"
                          >
                            <Plane className="w-2.5 h-2.5" />
                            <span>{acft}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="hidden md:block">
                  <Badge kind={docStatus(c.medicalExpiry)}>Medical</Badge>
                </div>
                <div className="hidden md:block">
                  <Badge kind={docStatus(c.licenseExpiry)}>License</Badge>
                </div>
                {canDocsView && (
                  <button
                    onClick={() => openDocs(c)}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-bold flex items-center gap-1 transition hover:bg-purple-500/25"
                  >
                    <Paperclip className="w-3 h-3" /> {docs.length}
                  </button>
                )}
                {hasAnyAction && (
                  <div className="flex gap-1">
                    {canEdit && (
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 rounded transition bg-amber-500/10 hover:bg-amber-500/25"
                        style={{ color: "#f59e0b" }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {canCard && (
                      <button
                        onClick={() => downloadCard(c)}
                        className="p-1.5 rounded transition"
                        style={{
                          backgroundColor: "rgba(99, 102, 241, 0.1)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                    )}
                    {canCreateUser && !isAlreadyUser(c) && (
                      <button
                        onClick={() => openCreateUser(c)}
                        className="p-1.5 rounded transition bg-indigo-500/10 hover:bg-indigo-500/25"
                        style={{ color: "#818cf8" }}
                        title="Create User"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                    {canCreateUser && isAlreadyUser(c) && (
                      <span
                        className="p-1.5 rounded"
                        style={{ color: "#10b981" }}
                        title="Account exists"
                      >
                        <User className="w-4 h-4" />
                      </span>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1.5 rounded transition bg-rose-500/10 hover:bg-rose-500/25"
                        style={{ color: "#f43f5e" }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ADD / EDIT MODAL ═══ */}
      <Modal
        open={editing !== null}
        title={
          editing === "new"
            ? t.addCrew || "Add Crew"
            : t.editCrew || "Edit Crew"
        }
        onClose={() => setEditing(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {t.cancel || "إلغاء"}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{
                background: "var(--brand-gradient)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Save className="w-4 h-4" /> {t.save || "حفظ"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <AvatarUpload
            value={draft.avatar}
            onChange={(b64) => setDraft({ ...draft, avatar: b64 })}
            name={draft.fullName}
          />

          {/* Basic Info */}
          <section>
            <h4
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <User className="w-4 h-4" /> {t.basicInfo || "Basic Info"}
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t.fullName + " *"}>
                <Input
                  value={draft.fullName || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, fullName: e.target.value })
                  }
                />
              </Field>
              <Field label={t.empNo}>
                <Input
                  value={draft.empNo || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, empNo: e.target.value })
                  }
                />
              </Field>
              <Field label={t.eNumber || "E-NUMBER"}>
                <Input
                  value={draft.eNumber || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, eNumber: e.target.value })
                  }
                  placeholder="2119035"
                />
              </Field>

              <Field label={t.role || "Primary Role"}>
                <Select
                  value={draft.role || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      role: e.target.value,
                      secondaryRoles: (draft.secondaryRoles || []).filter(
                        (r) => r !== e.target.value
                      ),
                    })
                  }
                >
                  {roleChoices.map((r) => {
                    const pos = dynamicPositions.find((p) => p.key === r);
                    return (
                      <option key={r} value={r}>
                        {pos
                          ? `${pos.short || ""} — ${pos.en || r}`
                          : t[r] || r}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label={t.status}>
                <Select
                  value={draft.status || "active"}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option value="active">{t.active || "Active"}</option>
                  <option value="inactive">{t.inactive || "Inactive"}</option>
                </Select>
              </Field>
              <Field label={t.dob}>
                <Input
                  type="date"
                  value={draft.dob || ""}
                  onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                />
              </Field>
              <Field label={t.gender}>
                <Select
                  value={draft.gender || "male"}
                  onChange={(e) =>
                    setDraft({ ...draft, gender: e.target.value })
                  }
                >
                  <option value="male">{t.male || "Male"}</option>
                  <option value="female">{t.female || "Female"}</option>
                </Select>
              </Field>
              <Field label={t.nationality}>
                <Input
                  value={draft.nationality || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, nationality: e.target.value })
                  }
                />
              </Field>
              <Field label={t.base}>
                <Input
                  value={draft.base || ""}
                  onChange={(e) => setDraft({ ...draft, base: e.target.value })}
                />
              </Field>
            </div>

            {/* Secondary Roles */}
            <div
              className="mt-4 p-4 rounded-xl"
              style={{
                backgroundColor: "rgba(99, 102, 241, 0.08)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <h5
                    className="text-sm font-bold flex items-center gap-2"
                    style={{ color: "var(--brand-primary)" }}
                  >
                    <Target className="w-4 h-4" />
                    {t.secondaryRoles || "الأدوار الإضافية"}
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
                      {(draft.secondaryRoles || []).length}
                    </span>
                  </h5>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t.secondaryRolesHelp ||
                      "اختر وظائف إضافية يمكن تعيين العضو فيها"}
                  </p>
                </div>
                {(draft.secondaryRoles || []).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, secondaryRoles: [] })}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/25 transition"
                  >
                    ✕ مسح
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {roleChoices
                  .filter((r) => r !== draft.role)
                  .map((r) => {
                    const pos = dynamicPositions.find((p) => p.key === r);
                    const isSelected = (draft.secondaryRoles || []).includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleToggleSecondaryRole(r)}
                        className="flex items-center justify-between p-2 rounded-lg border text-start transition"
                        style={{
                          backgroundColor: isSelected
                            ? "rgba(99, 102, 241, 0.15)"
                            : "var(--bg-card)",
                          borderColor: isSelected
                            ? "var(--brand-primary)"
                            : "var(--border-default)",
                          color: isSelected
                            ? "var(--brand-primary)"
                            : "var(--text-primary)",
                          boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                        }}
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-xs truncate">
                            {pos?.short || r}
                          </div>
                          <div
                            className="text-[10px] truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {pos?.en || t[r] || r}
                          </div>
                        </div>
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold ms-1 flex-shrink-0 transition"
                          style={{
                            backgroundColor: isSelected
                              ? "var(--brand-primary)"
                              : "transparent",
                            border: isSelected
                              ? "none"
                              : "1px solid var(--border-default)",
                            color: isSelected ? "white" : "transparent",
                          }}
                        >
                          ✓
                        </div>
                      </button>
                    );
                  })}
              </div>

              {(draft.secondaryRoles || []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(draft.secondaryRoles || []).map((r) => {
                    const pos = dynamicPositions.find((p) => p.key === r);
                    return (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-mono text-xs font-bold"
                      >
                        🎯 {pos?.short || r}
                        <button
                          type="button"
                          onClick={() => handleToggleSecondaryRole(r)}
                          className="hover:text-rose-400"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Multi-Aircraft Assignment */}
          <section
            className="p-4 rounded-xl space-y-3"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4
                  className="text-sm font-bold flex items-center gap-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  <Plane className="w-4 h-4" style={{ color: "#f59e0b" }} />
                  <span>{t.assignedAircraftMulti || "الطائرات المخصصة"}</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-400 font-mono">
                    {(draft.assignedAircraft || []).length}
                  </span>
                </h4>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t.assignedAircraftHelp ||
                    "اختر طائرة أو أكثر لربط الطاقم بها"}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllFleet}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/40 transition hover:bg-amber-500/30"
                >
                  ✓ {t.selectAllFleet || "الكل"}
                </button>
                <button
                  type="button"
                  onClick={handleClearAircraft}
                  className="px-2.5 py-1 rounded-lg text-slate-400 border transition"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  ✕ {t.clearSelection || "مسح"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
              {fleet.map((a) => {
                const isSelected = (draft.assignedAircraft || []).includes(
                  a.reg
                );
                return (
                  <button
                    key={a.id || a.reg}
                    type="button"
                    onClick={() => handleToggleAircraft(a.reg)}
                    className="flex items-center justify-between p-2 rounded-lg border text-start transition"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(245, 158, 11, 0.15)"
                        : "var(--bg-card)",
                      borderColor: isSelected
                        ? "#f59e0b"
                        : "var(--border-default)",
                      boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    <div className="min-w-0">
                      <div
                        className="font-mono font-bold text-xs truncate"
                        style={{
                          color: isSelected ? "#f59e0b" : "var(--text-primary)",
                        }}
                      >
                        ✈️ {a.reg}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {a.type || "Aircraft"}
                      </div>
                    </div>
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold ms-1 flex-shrink-0 transition"
                      style={{
                        backgroundColor: isSelected ? "#f59e0b" : "transparent",
                        border: isSelected
                          ? "none"
                          : "1px solid var(--border-default)",
                        color: isSelected ? "white" : "transparent",
                      }}
                    >
                      ✓
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 items-center pt-2">
              <div className="relative flex-1">
                <Plane
                  className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <Input
                  value={customAcftInput}
                  onChange={(e) =>
                    setCustomAcftInput(e.target.value.toUpperCase())
                  }
                  placeholder={
                    t.customAircraftPlaceholder ||
                    "تسجيل طائرة أخرى (مثل: 5A-XXX)..."
                  }
                  className="ps-9 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomAircraft();
                    }
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomAircraft}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white transition"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                + {t.add || "إضافة"}
              </button>
            </div>

            {(draft.assignedAircraft || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(draft.assignedAircraft || []).map((reg) => (
                  <span
                    key={reg}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 font-mono text-xs font-bold"
                  >
                    <span>✈️ {reg}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAircraft(reg)}
                      className="hover:text-rose-400 transition"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Contact */}
          <section>
            <h4
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <Phone className="w-4 h-4" /> {t.contact || "Contact"}
            </h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t.email}>
                <Input
                  type="email"
                  value={draft.email || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                />
              </Field>
              <Field label={t.phone}>
                <Input
                  value={draft.phone || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </Field>
            </div>
          </section>

          {/* Licensing */}
          <section>
            <h4
              className="text-sm font-bold mb-3 flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <IdCard className="w-4 h-4" /> {t.licensing || "Licensing & FTL"}
            </h4>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t.licenseNo}>
                <Input
                  value={draft.licenseNo || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, licenseNo: e.target.value })
                  }
                />
              </Field>
              <Field label={t.licenseExpiry}>
                <Input
                  type="date"
                  value={draft.licenseExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, licenseExpiry: e.target.value })
                  }
                />
              </Field>
              <Field label={t.medicalExpiry}>
                <Input
                  type="date"
                  value={draft.medicalExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, medicalExpiry: e.target.value })
                  }
                />
              </Field>
              <Field label={t.passportNo}>
                <Input
                  value={draft.passportNo || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, passportNo: e.target.value })
                  }
                />
              </Field>
              <Field label={t.passportExpiry}>
                <Input
                  type="date"
                  value={draft.passportExpiry || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, passportExpiry: e.target.value })
                  }
                />
              </Field>
              <Field label={t.ftl28 || "FTL 28 Hours"}>
                <Input
                  type="number"
                  value={draft.ftl28 || 0}
                  onChange={(e) =>
                    setDraft({ ...draft, ftl28: +e.target.value })
                  }
                />
              </Field>
            </div>
          </section>
        </div>
      </Modal>

      {/* ═══ DOCS MODAL ═══ */}
      {docsCrew && (
        <Modal
          open={!!docsCrew}
          title={`📎 ${t.attachments || "المستندات"} — ${docsCrew.fullName}`}
          onClose={() => {
            setDocsCrew(null);
            setDocsDraft([]);
          }}
          wide
          footer={
            <>
              <button
                onClick={() => {
                  setDocsCrew(null);
                  setDocsDraft([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {t.cancel || "إغلاق"}
              </button>
              {canDocsEdit && (
                <button
                  onClick={saveDocs}
                  disabled={docsSaving}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
                  style={{
                    background: "var(--brand-gradient)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  <Save className="w-4 h-4" />
                  {docsSaving ? "…" : t.save || "حفظ"}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.1)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
              }}
            >
              <div
                className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {toDisplayImageUrl(docsCrew.avatar) ? (
                  <img
                    src={toDisplayImageUrl(docsCrew.avatar)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User
                    className="w-full h-full p-2"
                    style={{ color: "var(--text-muted)" }}
                  />
                )}
              </div>
              <div className="flex-1">
                <div
                  className="font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {docsCrew.fullName}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {t[docsCrew.role] || docsCrew.role} · {docsCrew.empNo}
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
                {docsDraft.length} {t.attachments || "مستندات"}
              </span>
            </div>
            {!canDocsEdit && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                <Eye className="w-4 h-4" />
                {t.docs_readonly || "وضع العرض فقط"}
              </div>
            )}
            {canDocsEdit ? (
              <AttachmentsEditor
                value={docsDraft}
                onChange={(v) => setDocsDraft(v)}
              />
            ) : (
              <ReadOnlyDocsList
                docs={docsDraft}
                canDownload={canDocsDownload}
              />
            )}
          </div>
        </Modal>
      )}

      {/* ═══ CREATE USER MODAL ═══ */}
      <Modal
        open={!!createUserCrew}
        title={`Create User — ${createUserCrew?.fullName || ""}`}
        onClose={() => setCreateUserCrew(null)}
        wide
        footer={
          <>
            <button
              onClick={() => setCreateUserCrew(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                border: "1px solid var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              {t.cancel}
            </button>
            <button
              onClick={saveNewUser}
              disabled={userSaving}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{
                background: "var(--brand-gradient)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {userSaving ? "…" : "Create User"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div
            className="p-3 rounded-lg flex items-center gap-3"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div
              className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-default)",
              }}
            >
              {toDisplayImageUrl(createUserCrew?.avatar) ? (
                <img
                  src={toDisplayImageUrl(createUserCrew.avatar)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User
                  className="w-full h-full p-2"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </div>
            <div className="flex-1">
              <div
                className="font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {createUserCrew?.fullName}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t[createUserCrew?.role]} · {createUserCrew?.empNo}
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label={t.username + " *"}>
              <Input
                value={userDraft.username || ""}
                onChange={(e) =>
                  setUserDraft({
                    ...userDraft,
                    username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                  })
                }
              />
            </Field>
            <Field label={t.assignPassword + " *"}>
              <Input
                value={userDraft.password || ""}
                onChange={(e) =>
                  setUserDraft({ ...userDraft, password: e.target.value })
                }
              />
            </Field>
            <Field label={t.role}>
              <Select
                value={userDraft.role || "crewMember"}
                onChange={(e) =>
                  setUserDraft({ ...userDraft, role: e.target.value })
                }
              >
                <option value="superAdmin">👑 Super Admin</option>
                <option value="dispatcher">📋 Dispatcher</option>
                <option value="captain">✈️ Captain</option>
                <option value="camo">🔧 CAMO</option>
                <option value="crewMember">👤 Crew Member</option>
              </Select>
            </Field>
          </div>
          <div
            className="p-3 rounded-lg"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
            }}
          >
            <div className="text-[10px] font-bold text-amber-400 uppercase mb-1">
              ⚠️ بيانات الدخول
            </div>
            <div className="text-sm font-mono text-amber-300 space-y-1">
              <div>
                <b>Username:</b> {userDraft.username || "—"}
              </div>
              <div>
                <b>Password:</b> {userDraft.password || "—"}
              </div>
              <div>
                <b>Role:</b> {userDraft.role || "—"}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * READ-ONLY DOCS LIST
 * ═══════════════════════════════════════════════════════════ */
function ReadOnlyDocsList({ docs = [], canDownload = false }) {
  const t = useT();
  if (docs.length === 0) {
    return (
      <div
        className="p-8 text-center text-sm rounded-lg border-2 border-dashed"
        style={{
          color: "var(--text-muted)",
          borderColor: "var(--border-default)",
        }}
      >
        <Paperclip className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <div>{t.noData || "لا توجد مستندات"}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {docs.map((doc, idx) => {
        const name = doc.name || doc.fileName || `Document ${idx + 1}`;
        const url = doc.url || doc.fileUrl || doc.data || "";
        const size = doc.size ? formatFileSize(doc.size) : "";
        const type = doc.type || doc.mimeType || doc.mime || "";
        const st = docStatus(doc.expiry);
        const days = daysUntil(doc.expiry);
        const colorCls = getStatusColor(st);
        const cardBg =
          st === "expired"
            ? "rgba(244, 63, 94, 0.1)"
            : st === "critical"
            ? "rgba(249, 115, 22, 0.1)"
            : st === "expiring"
            ? "rgba(245, 158, 11, 0.1)"
            : "var(--bg-app)";
        const cardBorder =
          st === "expired"
            ? "rgba(244, 63, 94, 0.4)"
            : st === "critical"
            ? "rgba(249, 115, 22, 0.4)"
            : st === "expiring"
            ? "rgba(245, 158, 11, 0.4)"
            : "var(--border-default)";

        return (
          <div
            key={idx}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg border"
            style={{ backgroundColor: cardBg, borderColor: cardBorder }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.15)",
              }}
            >
              <Paperclip className="w-5 h-5" style={{ color: "#a855f7" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-bold text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {name}
              </div>
              <div
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {type && <span className="font-mono">{type}</span>}
                {size && <span> · {size}</span>}
              </div>
              {doc.expiry && days !== null && (
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      color: "var(--text-muted)",
                    }}
                  >
                    📅 {String(doc.expiry).slice(0, 10)}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${colorCls}`}
                  >
                    {days < 0
                      ? `منتهي منذ ${Math.abs(days)} يوم`
                      : days === 0
                      ? "ينتهي اليوم"
                      : `${days} يوم متبقٍ`}
                  </span>
                </div>
              )}
            </div>
            {canDownload && url ? (
              <a
                href={url}
                download={name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                style={{
                  backgroundColor: "rgba(99, 102, 241, 0.15)",
                  color: "var(--brand-primary)",
                }}
              >
                <FileDown className="w-3.5 h-3.5" /> {t.download || "تحميل"}
              </a>
            ) : (
              <span
                className="text-[10px] italic"
                style={{ color: "var(--text-muted)" }}
              >
                {t.noDownloadPerm || "بدون تحميل"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Crew;
