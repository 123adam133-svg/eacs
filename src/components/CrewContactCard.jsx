/* ═══════════════════════════════════════════════════════════
 * CREW CONTACT CARD & HOVER/CLICK POPOVER
 * Compact, high-clarity telemetry card with configurable size (xs..xl),
 * visible fields, and FTL limits. Uses React Portal to prevent clipping.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  User,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { toDisplayImageUrl } from "../api";
import { getCrewDailyFtlDetailed } from "../utils/multiSectorFtl";

export const CREW_CARD_SIZE_MAP = {
  xs: { width: 215, pad: "p-2 space-y-1.5 text-[10px]", avatar: "w-7 h-7", title: "text-[11px]", ftlPad: "p-1.5" },
  sm: { width: 248, pad: "p-2.5 space-y-2 text-[11px]", avatar: "w-8 h-8", title: "text-xs", ftlPad: "p-1.5" },
  md: { width: 290, pad: "p-3 space-y-2 text-xs", avatar: "w-9 h-9", title: "text-xs", ftlPad: "p-2" },
  lg: { width: 340, pad: "p-3.5 space-y-2.5 text-xs", avatar: "w-11 h-11", title: "text-sm", ftlPad: "p-2.5" },
  xl: { width: 390, pad: "p-4 space-y-3 text-sm", avatar: "w-12 h-12", title: "text-base", ftlPad: "p-3" },
};

export const DEFAULT_CREW_CARD_CONFIG = {
  cardSize: "sm", // "xs" | "sm" | "md" | "lg" | "xl"
  triggerMode: "both", // "both" | "hover" | "click"
  showAvatar: true,
  showEmpNo: true,
  showRole: true,
  showBase: true,
  showPhone: true,
  showWhatsApp: true,
  showEmail: true,
  showFtlStats: true,
  showFtlAlert: true,
};

export function getCrewContactCardConfig() {
  if (typeof window === "undefined") return { ...DEFAULT_CREW_CARD_CONFIG };
  try {
    const raw = localStorage.getItem("aeroops.crewContactCard");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_CREW_CARD_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Failed reading crewContactCard config:", err);
  }
  return { ...DEFAULT_CREW_CARD_CONFIG };
}

export function saveCrewContactCardConfig(newConfig) {
  if (typeof window === "undefined") return;
  try {
    const merged = { ...DEFAULT_CREW_CARD_CONFIG, ...newConfig };
    localStorage.setItem("aeroops.crewContactCard", JSON.stringify(merged));
    window.dispatchEvent(new Event("aeroops:prefsChanged"));
  } catch (err) {
    console.warn("Failed saving crewContactCard config:", err);
  }
}

export function getCrewDailyFtlStats(crewId, dateStr, flights = []) {
  if (!crewId || !flights.length) return null;
  const detailed = getCrewDailyFtlDetailed(crewId, dateStr, flights);
  if (!detailed) return null;

  return {
    sectorsCount: detailed.sectorsCount,
    dutyMin: detailed.dutyMin,
    maxMin: detailed.maxFdpMin,
    actualStr: detailed.dutyStr,
    maxStr: detailed.maxFdpStr,
    isExceeded: detailed.isExceeded,
    pct: detailed.pct,
    sectors: detailed.sectors,
    totalBlockStr: detailed.totalBlockStr,
    restBeforeStr: detailed.restBeforeStr,
    nextEobtStr: detailed.nextEobtStr,
    detailed,
  };
}

export function CrewContactCard({
  member,
  dateStr,
  flights = [],
  children,
  className = "",
  showFtlAlert = true,
  configOverride,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [cardConfig, setCardConfig] = useState(() => configOverride || getCrewContactCardConfig());
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "bottom", width: 248 });

  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (configOverride) {
      setCardConfig(configOverride);
      return;
    }
    const reloadConfig = () => {
      setCardConfig(getCrewContactCardConfig());
    };
    window.addEventListener("aeroops:prefsChanged", reloadConfig);
    window.addEventListener("aeroops:crewContactCardChanged", reloadConfig);
    return () => {
      window.removeEventListener("aeroops:prefsChanged", reloadConfig);
      window.removeEventListener("aeroops:crewContactCardChanged", reloadConfig);
    };
  }, [configOverride]);

  const sizeKey = CREW_CARD_SIZE_MAP[cardConfig.cardSize] ? cardConfig.cardSize : "sm";
  const sizeSpec = CREW_CARD_SIZE_MAP[sizeKey];

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = sizeSpec.width;
    const estHeight = cardConfig.showFtlStats ? 245 : 165;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let placement = "bottom";
    let top = 0;

    if (spaceBelow < estHeight + 12 && spaceAbove > spaceBelow) {
      placement = "top";
      top = rect.top - 6;
    } else {
      placement = "bottom";
      top = rect.bottom + 6;
    }

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(10, Math.min(window.innerWidth - width - 10, left));

    setCoords({ top, left, placement, width });
  }, [sizeSpec.width, cardConfig.showFtlStats]);

  const openCard = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const scheduleClose = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  }, []);

  const handleMouseEnter = () => {
    const mode = cardConfig.triggerMode || "both";
    if (mode === "hover" || mode === "both") {
      openCard();
    }
  };

  const handleMouseLeave = () => {
    const mode = cardConfig.triggerMode || "both";
    if (mode === "hover" || mode === "both") {
      scheduleClose();
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const mode = cardConfig.triggerMode || "both";
    if (mode === "click" || mode === "both") {
      if (isOpen) {
        setIsOpen(false);
      } else {
        openCard();
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        cardRef.current &&
        !cardRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  const ftlStats = useMemo(() => {
    if (!member || !member.id) return null;
    return getCrewDailyFtlStats(member.id, dateStr, flights);
  }, [member, dateStr, flights]);

  if (!member) {
    return <span className={className}>{children}</span>;
  }

  const isExceeded = ftlStats?.isExceeded;
  const avatarUrl = toDisplayImageUrl(member.avatar);
  const cleanPhone = String(member.phone || member.mobile || "").replace(/[^\d+]/g, "");
  const effectiveFtlAlert = cardConfig.showFtlAlert && showFtlAlert;
  const isCompactSize = sizeKey === "xs" || sizeKey === "sm";

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-block ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <span
          className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
            isExceeded && effectiveFtlAlert
              ? "text-rose-600 dark:text-rose-400 font-black bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/30"
              : "hover:text-blue-600 dark:hover:text-blue-400"
          }`}
        >
          {children}
          {isExceeded && effectiveFtlAlert && (
            <ShieldAlert
              className="w-3 h-3 text-rose-500 shrink-0"
              title="تحذير: تجاوز الساعات القانونية Daily FTL Exceeded"
            />
          )}
        </span>
      </span>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={cardRef}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeave}
            className="rounded-xl shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-150 select-text"
            style={{
              position: "fixed",
              left: `${coords.left}px`,
              ...(coords.placement === "top"
                ? { bottom: `${window.innerHeight - coords.top}px` }
                : { top: `${coords.top}px` }),
              width: `${coords.width}px`,
              zIndex: 999999,
              backgroundColor: "var(--bg-card)",
              borderColor:
                isExceeded && effectiveFtlAlert ? "rgba(225, 29, 72, 0.5)" : "var(--border-default)",
              color: "var(--text-primary)",
              boxShadow:
                isExceeded && effectiveFtlAlert
                  ? "0 12px 28px -6px rgba(225, 29, 72, 0.25), 0 0 0 1px rgba(225, 29, 72, 0.2)"
                  : "0 16px 32px -10px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className={sizeSpec.pad}>
              {/* Header */}
              <div className="flex items-center gap-2 pb-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
                {cardConfig.showAvatar && (
                  <div
                    className={`${sizeSpec.avatar} rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border shrink-0 flex items-center justify-center`}
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={member.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <User className={`${isCompactSize ? "w-3.5 h-3.5" : "w-4 h-4"} text-slate-400`} />
                    )}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div
                    className={`font-bold truncate leading-tight ${sizeSpec.title}`}
                    style={{ color: "var(--text-primary)" }}
                  >
                    {member.fullName || member.name}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {cardConfig.showRole && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                        {member.role || member.rank || "Crew"}
                      </span>
                    )}

                    {cardConfig.showEmpNo && member.empNo && (
                      <span className="text-[9.5px] font-mono tabular-nums px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-black/5">
                        #{member.empNo}
                      </span>
                    )}

                    {cardConfig.showBase && member.base && (
                      <span className="text-[9.5px] font-mono font-bold text-slate-500 flex items-center gap-0.5 ms-auto">
                        <MapPin className="w-2.5 h-2.5 text-rose-500" />
                        {member.base}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Daily FTL Section */}
              {cardConfig.showFtlStats && ftlStats && (
                <div
                  className={`rounded-lg border ${sizeSpec.ftlPad} ${
                    isExceeded && effectiveFtlAlert
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[10px] mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>FTL اليومي</span>
                    </span>
                    {isExceeded && effectiveFtlAlert ? (
                      <span className="text-[9.5px] font-black text-rose-600 dark:text-rose-400">
                        تجاوز الحد
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        ضمن الحدود
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px]">
                    <div className="px-1.5 py-1 rounded bg-white/70 dark:bg-slate-900/60 border border-black/5">
                      <span className="block opacity-70 text-[8.5px]">الحد الأقصى</span>
                      <span className="font-extrabold font-mono tabular-nums text-[11px]">{ftlStats.maxStr}</span>
                    </div>
                    <div className="px-1.5 py-1 rounded bg-white/70 dark:bg-slate-900/60 border border-black/5">
                      <span className="block opacity-70 text-[8.5px]">الفعلي ({ftlStats.sectorsCount} Sct)</span>
                      <span
                        className={`font-extrabold font-mono tabular-nums text-[11px] ${
                          isExceeded && effectiveFtlAlert ? "text-rose-600 dark:text-rose-400" : ""
                        }`}
                      >
                        {ftlStats.actualStr}
                      </span>
                    </div>
                  </div>

                  {Array.isArray(ftlStats.sectors) && ftlStats.sectors.length > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-1 text-[9px]">
                      <div className="flex flex-wrap gap-1 min-w-0">
                        {ftlStats.sectors.slice(0, 4).map((sec, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded font-mono font-bold bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700"
                            title={`${sec.flightNo} (${sec.dep} -> ${sec.arr})`}
                          >
                            <span className="text-sky-600">{sec.dep}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-sky-600">{sec.arr}</span>
                          </span>
                        ))}
                      </div>
                      <span className="font-mono tabular-nums font-bold text-sky-600 shrink-0">
                        {ftlStats.totalBlockStr}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Compact Contact Row */}
              {(cardConfig.showPhone && member.phone) || (cardConfig.showEmail && member.email) ? (
                <div className="space-y-1 pt-0.5">
                  {cardConfig.showPhone && member.phone && (
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Phone className="w-3 h-3 shrink-0 text-blue-500" />
                        <span className="font-mono tabular-nums text-[10.5px] truncate">{member.phone}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="p-1 rounded-md bg-blue-500/12 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition cursor-pointer"
                          title="اتصال"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                        {cardConfig.showWhatsApp && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                            title="واتساب"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {cardConfig.showEmail && member.email && (
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Mail className="w-3 h-3 shrink-0 text-amber-500" />
                        <span className="font-mono text-[10px] truncate">{member.email}</span>
                      </div>
                      <a
                        href={`mailto:${member.email}`}
                        className="p-1 rounded-md bg-amber-500/12 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition shrink-0 cursor-pointer"
                        title="إرسال بريد"
                      >
                        <Mail className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
