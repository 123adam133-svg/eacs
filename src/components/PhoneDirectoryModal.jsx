/* ═══════════════════════════════════════════════════════════
 * PHONE DIRECTORY MODAL
 * Operational contact directory for crew & departments
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  PhoneCall,
  Search,
  Users,
  X,
  Phone,
  MessageCircle,
  Mail,
  Plane,
  Wrench,
  Shield,
  Building,
  Headphones,
  UserCheck,
  BadgeCheck,
} from "lucide-react";
import { Modal } from "./ui/Modal";
import { toDisplayImageUrl } from "../api";

/** Helper function for Arabic & English normalized search */
function normalizeSearchText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "");
}

/**
 * @param {{ isOpen: boolean; onClose: () => void; crew?: any[]; users?: any[]; lang?: string }} props
 */
export function PhoneDirectoryModal({
  isOpen,
  onClose,
  crew = [],
  users = [],
  lang = "ar",
}) {
  const isAr = lang === "ar";
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  /* Merge and group crew and users into clean directory entries */
  const directoryEntries = useMemo(() => {
    const list = [];
    const seenEmails = new Set();

    // Add crew members
    crew.forEach((c) => {
      if (!c) return;
      const email = String(c.email || "").toLowerCase().trim();
      if (email) seenEmails.add(email);

      const rawRole = String(c.role || c.rank || c.position || "").toLowerCase();
      let category = "cockpit";
      if (rawRole.includes("fa") || rawRole.includes("cabin") || rawRole.includes("purser") || rawRole.includes("attendant")) {
        category = "cabin";
      } else if (rawRole.includes("dispatch") || rawRole.includes("ops") || rawRole.includes("occ")) {
        category = "ops";
      } else if (rawRole.includes("maint") || rawRole.includes("camo") || rawRole.includes("eng")) {
        category = "maint";
      } else if (rawRole.includes("ground") || rawRole.includes("catering")) {
        category = "ground";
      }

      const fullName = c.fullName || c.name || c.arabicName || c.englishName || "Crew Member";
      list.push({
        id: `crew_${c.id}`,
        fullName,
        arabicName: c.arabicName || "",
        englishName: c.englishName || "",
        role: c.role || c.rank || c.position || "Crew",
        empNo: c.empNo || c.code || c.crewCode || "",
        phone: c.phone || c.mobile || "",
        email: c.email || "",
        base: c.base || c.station || "",
        department: c.department || c.dept || "",
        avatar: c.avatar || null,
        category,
      });
    });

    // Add users not already in crew
    users.forEach((u) => {
      if (!u) return;
      const email = String(u.email || "").toLowerCase().trim();
      if (email && seenEmails.has(email)) return;

      const rawRole = String(u.role || "").toLowerCase();
      let category = "admin";
      if (rawRole.includes("captain") || rawRole.includes("fo") || rawRole.includes("pilot")) {
        category = "cockpit";
      } else if (rawRole.includes("fa") || rawRole.includes("cabin")) {
        category = "cabin";
      } else if (rawRole.includes("dispatch") || rawRole.includes("ops")) {
        category = "ops";
      } else if (rawRole.includes("camo") || rawRole.includes("maint")) {
        category = "maint";
      }

      const fullName = u.fullName || u.username || u.name || "User";
      list.push({
        id: `user_${u.id}`,
        fullName,
        arabicName: u.nameAr || u.arabicName || "",
        englishName: u.nameEn || u.englishName || "",
        role: u.role || "Admin/User",
        empNo: u.empNo || u.code || "",
        phone: u.phone || u.mobile || "",
        email: u.email || "",
        base: u.base || "",
        department: u.department || "",
        avatar: u.avatar || null,
        category,
      });
    });

    return list;
  }, [crew, users]);

  const DEPARTMENTS = [
    { id: "all", label_ar: "الكل", label_en: "All", icon: Users },
    { id: "cockpit", label_ar: "طاقم القيادة", label_en: "Cockpit Crew", icon: Plane },
    { id: "cabin", label_ar: "الضيافة الجوية", label_en: "Cabin Crew", icon: UserCheck },
    { id: "ops", label_ar: "العمليات والمرحلون", label_en: "Flight Ops & Dispatch", icon: Headphones },
    { id: "maint", label_ar: "الصيانة و CAMO", label_en: "Maintenance & CAMO", icon: Wrench },
    { id: "ground", label_ar: "الخدمات الأرضية والتموين", label_en: "Ground & Catering", icon: Building },
    { id: "admin", label_ar: "الإدارة والقيادة", label_en: "Management & Admin", icon: Shield },
  ];

  /* Advanced Arabic/English Name & Multi-field Search Filter */
  const filteredEntries = useMemo(() => {
    const rawQ = search.trim();
    const qNorm = normalizeSearchText(rawQ);

    return directoryEntries.filter((item) => {
      const matchDept = selectedDept === "all" || item.category === selectedDept;
      if (!matchDept) return false;
      if (!rawQ) return true;

      const nameNorm = normalizeSearchText(item.fullName);
      const arNorm = normalizeSearchText(item.arabicName);
      const enNorm = normalizeSearchText(item.englishName);
      const roleNorm = normalizeSearchText(item.role);
      const deptNorm = normalizeSearchText(item.department);
      const rawPhone = String(item.phone || "").toLowerCase();
      const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
      const rawEmail = String(item.email || "").toLowerCase();
      const rawEmpNo = String(item.empNo || "").toLowerCase();

      // Split words to support multi-term queries (e.g., "محمد علي" or "Capt Ahmed")
      const words = qNorm.split(/\s+/).filter(Boolean);
      const matchesAllWords = words.every(
        (w) =>
          nameNorm.includes(w) ||
          arNorm.includes(w) ||
          enNorm.includes(w) ||
          roleNorm.includes(w) ||
          deptNorm.includes(w) ||
          rawEmpNo.includes(w) ||
          rawEmail.includes(w)
      );

      return (
        matchesAllWords ||
        cleanPhone.includes(rawQ) ||
        rawPhone.includes(rawQ.toLowerCase())
      );
    });
  }, [directoryEntries, search, selectedDept]);

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      wide={true}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base">
                {isAr ? "دليل اتصالات الكادر والأقسام" : "Operational Directory"}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold">
                {filteredEntries.length} {isAr ? "جهة اتصال" : "contacts"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-normal mt-0.5">
              {isAr
                ? "دليل الاتصال المباشر بطواقم العمليات، طاقم القيادة، والضيافة وصيانة الطائرات"
                : "Operational phone & contact directory for crew, ops, maintenance & admin"}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search Input Bar & Department Selector */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute start-3 top-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isAr
                  ? "ابحث بالاسم العربي/الإنجليزي، رقم الهاتف، الكود، أو الصفة الوظيفية..."
                  : "Search by name, phone, employee code, rank, or department..."
              }
              className="w-full ps-9 pe-9 py-2 text-xs rounded-xl border bg-transparent focus:ring-2 focus:ring-blue-500 outline-none transition"
              style={{ borderColor: "var(--border-default)" }}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute end-2.5 top-2.5 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground transition"
                title={isAr ? "مسح البحث" : "Clear search"}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {DEPARTMENTS.map((dept) => {
              const IconComp = dept.icon;
              const isActive = selectedDept === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{isAr ? dept.label_ar : dept.label_en}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Directory Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1">
          {filteredEntries.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-30" />
              <div>
                {isAr
                  ? "لم يتم العثور على أي كادر أو جهة اتصال تظابق بحثك"
                  : "No matching contacts found"}
              </div>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="px-3 py-1 text-[11px] rounded-lg bg-blue-500/10 text-blue-600 font-bold hover:bg-blue-500/20 transition"
                >
                  {isAr ? "إلغاء تصفية البحث" : "Reset search filter"}
                </button>
              )}
            </div>
          ) : (
            filteredEntries.map((item) => {
              const cleanPhone = String(item.phone || "").replace(/[^\d+]/g, "");
              const avatarUrl = toDisplayImageUrl(item.avatar);

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border transition hover:shadow-md flex flex-col justify-between"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--border-default)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border shrink-0 flex items-center justify-center">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={item.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div
                          className="font-bold text-xs truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.fullName}
                        </div>
                        {item.empNo && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 shrink-0">
                            #{item.empNo}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 truncate">
                          {item.role}
                        </span>
                        {item.base && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            📍 {item.base}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    <div className="min-w-0">
                      {item.phone ? (
                        <span className="font-mono text-xs font-bold text-foreground block truncate">
                          {item.phone}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          {isAr ? "بدون رقم مسجل" : "No phone"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.phone && (
                        <>
                          <a
                            href={`tel:${cleanPhone}`}
                            className="p-1.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 transition"
                            title={isAr ? "اتصال تلفوني" : "Call"}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition"
                            title={isAr ? "واتساب" : "WhatsApp"}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                      {item.email && (
                        <a
                          href={`mailto:${item.email}`}
                          className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition"
                          title={isAr ? "إرسال بريد" : "Email"}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}

