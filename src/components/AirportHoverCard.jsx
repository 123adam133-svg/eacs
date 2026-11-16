/* ═══════════════════════════════════════════════════════════
 * AIRPORT HOVER CARD & POPOVER
 * Compact, high-clarity aerodrome card with Sunrise/Sunset,
 * NOTAM closure banner, live METAR/TAF/NOTAM hover previews,
 * and configurable size (xs..xl) via Settings.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  Compass,
  Layers,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Plane,
  Radio,
  Settings,
  Sunrise,
  Sunset,
  AlertOctagon,
  CloudSun,
  FileWarning,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
import { findAirportDetails, calcAirportSunTimes } from "../utils/airportDatabase";
import { showToast } from "../utils/dialog";

export const AIRPORT_CARD_SIZE_MAP = {
  xs: { width: 235, pad: "p-2 space-y-1.5 text-[10px]", title: "text-[11px]", tilePad: "p-1" },
  sm: { width: 272, pad: "p-2.5 space-y-1.5 text-[11px]", title: "text-xs", tilePad: "p-1.5" },
  md: { width: 312, pad: "p-3 space-y-2 text-xs", title: "text-xs", tilePad: "p-1.5" },
  lg: { width: 356, pad: "p-3.5 space-y-2 text-xs", title: "text-sm", tilePad: "p-2" },
  xl: { width: 405, pad: "p-4 space-y-2.5 text-sm", title: "text-sm", tilePad: "p-2" },
};

export const DEFAULT_AIRPORT_CARD_CONFIG = {
  cardSize: "sm", // "xs" | "sm" | "md" | "lg" | "xl"
  triggerMode: "both", // "both" | "hover" | "click"
  showSunTimes: true,
  showWeatherNotam: true,
  showCoordinates: true,
  showElevation: true,
  showTimezone: true,
  showRunways: true,
};

// Shared 3-minute client cache for live METAR / TAF / NOTAM per ICAO
const airportIntelCache = new Map();
const airportIntelInFlight = new Map();

async function fetchLiveAirportIntel(icao, forceRefresh = false) {
  const code = String(icao || "").toUpperCase().trim();
  if (!code || code.length < 3) return null;

  const cached = airportIntelCache.get(code);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  if (!forceRefresh && airportIntelInFlight.has(code)) {
    return airportIntelInFlight.get(code);
  }

  const req = fetch(
    `/api/airport-intel/${encodeURIComponent(code)}${forceRefresh ? "?refresh=1" : ""}`
  )
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      if (!json?.ok) throw new Error(json?.error || "تعذر جلب البيانات");
      airportIntelCache.set(code, {
        expiresAt: Date.now() + 3 * 60 * 1000,
        data: json,
      });
      return json;
    })
    .finally(() => {
      airportIntelInFlight.delete(code);
    });

  airportIntelInFlight.set(code, req);
  return req;
}

function getFltCatStyle(cat) {
  switch (String(cat || "").toUpperCase()) {
    case "VFR":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
    case "MVFR":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40";
    case "IFR":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40";
    case "LIFR":
      return "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/40";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30";
  }
}

export function getAirportCardConfig() {
  if (typeof window === "undefined") return { ...DEFAULT_AIRPORT_CARD_CONFIG };
  try {
    const raw = localStorage.getItem("aeroops.airportCard");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_AIRPORT_CARD_CONFIG, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Failed reading airportCard config:", err);
  }
  return { ...DEFAULT_AIRPORT_CARD_CONFIG };
}

export function saveAirportCardConfig(newConfig) {
  if (typeof window === "undefined") return;
  try {
    const merged = { ...DEFAULT_AIRPORT_CARD_CONFIG, ...newConfig };
    localStorage.setItem("aeroops.airportCard", JSON.stringify(merged));
    window.dispatchEvent(new Event("aeroops:prefsChanged"));
    window.dispatchEvent(new Event("aeroops:airportCardChanged"));
  } catch (err) {
    console.warn("Failed saving airportCard config:", err);
  }
}

export function AirportHoverCard({
  code,
  icao,
  flightDate,
  children,
  className = "",
  onOpenSettings,
  configOverride,
}) {
  const airportCode = code || icao;
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedIntel, setCopiedIntel] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [cardConfig, setCardConfig] = useState(() => configOverride || getAirportCardConfig());
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "bottom", width: 272 });

  // Live METAR / TAF / NOTAM Hover Preview state
  const [activeIntelTab, setActiveIntelTab] = useState(null); // null | "metar" | "taf" | "notam"
  const [intelData, setIntelData] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState("");

  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (configOverride) {
      setCardConfig(configOverride);
      return;
    }
    const reloadCfg = () => setCardConfig(getAirportCardConfig());
    window.addEventListener("aeroops:prefsChanged", reloadCfg);
    window.addEventListener("aeroops:airportCardChanged", reloadCfg);
    return () => {
      window.removeEventListener("aeroops:prefsChanged", reloadCfg);
      window.removeEventListener("aeroops:airportCardChanged", reloadCfg);
    };
  }, [configOverride]);

  useEffect(() => {
    const onChanged = () => setRefreshTick((v) => v + 1);
    window.addEventListener("aeroops:airportsChanged", onChanged);
    return () => window.removeEventListener("aeroops:airportsChanged", onChanged);
  }, []);

  const airport = useMemo(() => {
    return findAirportDetails(airportCode);
  }, [airportCode, refreshTick]);

  const resolvedIcao = String(airport?.icao || airportCode || "").toUpperCase().trim();

  const sunTimes = useMemo(() => {
    if (!airport) return null;
    return calcAirportSunTimes(airport.lat, airport.lon, flightDate, airport.timezone);
  }, [airport, flightDate]);

  const sizeKey = AIRPORT_CARD_SIZE_MAP[cardConfig.cardSize] ? cardConfig.cardSize : "sm";
  const sizeSpec = AIRPORT_CARD_SIZE_MAP[sizeKey];

  const loadIntel = useCallback(
    async (forceRefresh = false) => {
      if (!resolvedIcao || resolvedIcao.length < 3) return;
      const cached = airportIntelCache.get(resolvedIcao);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        setIntelData(cached.data);
        setIntelError("");
        return;
      }
      setIntelLoading(true);
      setIntelError("");
      try {
        const res = await fetchLiveAirportIntel(resolvedIcao, forceRefresh);
        setIntelData(res);
      } catch (err) {
        setIntelError(err?.message || "تعذر الاتصال بمزود الطقس والمعلومات");
      } finally {
        setIntelLoading(false);
      }
    },
    [resolvedIcao]
  );

  // Reset tab when closing card
  useEffect(() => {
    if (!isOpen) {
      setActiveIntelTab(null);
    } else if (resolvedIcao) {
      const cached = airportIntelCache.get(resolvedIcao);
      if (cached && cached.expiresAt > Date.now()) {
        setIntelData(cached.data);
      }
    }
  }, [isOpen, resolvedIcao]);

  const handleIntelHover = (tab) => {
    setActiveIntelTab(tab);
    loadIntel(false);
  };

  const handleIntelClick = (e, tab) => {
    e.stopPropagation();
    setActiveIntelTab((prev) => {
      const next = prev === tab ? null : tab;
      if (next) loadIntel(false);
      return next;
    });
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const cardWidth = activeIntelTab ? Math.max(sizeSpec.width, 320) : sizeSpec.width;
    const estHeight = activeIntelTab
      ? airport?.notamClosed
        ? 440
        : 395
      : airport?.notamClosed
      ? 305
      : 265;
    const padding = 10;

    let left = rect.left + rect.width / 2 - cardWidth / 2;
    if (left < padding) left = padding;
    if (left + cardWidth > window.innerWidth - padding) {
      left = window.innerWidth - cardWidth - padding;
    }

    let top = rect.bottom + 6;
    let placement = "bottom";

    if (top + estHeight > window.innerHeight - padding && rect.top > estHeight + padding) {
      top = rect.top - estHeight - 6;
      placement = "top";
    } else if (top + estHeight > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - estHeight - padding);
    }

    setCoords({
      top: Math.round(top + window.scrollY),
      left: Math.round(left + window.scrollX),
      placement,
      width: cardWidth,
    });
  }, [sizeSpec.width, airport?.notamClosed, activeIntelTab]);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, activeIntelTab, updatePosition]);

  const handleMouseEnter = () => {
    const mode = cardConfig.triggerMode || "both";
    if (mode !== "hover" && mode !== "both") return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 110);
  };

  const handleMouseLeave = () => {
    const mode = cardConfig.triggerMode || "both";
    if (mode !== "hover" && mode !== "both") return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    const mode = cardConfig.triggerMode || "both";
    if (mode !== "click" && mode !== "both") return;
    updatePosition();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleDocClick = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        cardRef.current &&
        !cardRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [isOpen]);

  const copyCode = (e) => {
    e.stopPropagation();
    if (!resolvedIcao) return;
    navigator.clipboard?.writeText(resolvedIcao);
    setCopied(true);
    showToast(`✅ تم نسخ رمز المطار: ${resolvedIcao}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRawIntel = (e, text) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedIntel(true);
    showToast("✅ تم نسخ النص");
    setTimeout(() => setCopiedIntel(false), 1800);
  };

  const openGoogleMaps = (e) => {
    e.stopPropagation();
    if (airport?.lat != null && airport?.lon != null) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${airport.lat},${airport.lon}`,
        "_blank"
      );
    } else {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${resolvedIcao || code} airport`
        )}`,
        "_blank"
      );
    }
  };

  const specItemsCount =
    (cardConfig.showCoordinates !== false ? 1 : 0) +
    (cardConfig.showElevation !== false ? 1 : 0) +
    (cardConfig.showTimezone !== false ? 1 : 0) +
    (cardConfig.showRunways !== false ? 1 : 0);

  const liveNotams = Array.isArray(intelData?.notams) ? intelData.notams : [];
  const hasAnyNotam = Boolean(airport?.notamClosed) || liveNotams.length > 0;
  const metar = intelData?.metar || null;
  const taf = intelData?.taf || null;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`inline-flex items-center cursor-pointer transition hover:opacity-85 ${
          airport?.notamClosed ? "text-rose-600 dark:text-rose-400" : ""
        } ${className}`}
      >
        {children}
      </span>

      {isOpen &&
        createPortal(
          <div
            ref={cardRef}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className={`rounded-xl border shadow-2xl max-h-[82vh] overflow-y-auto ${sizeSpec.pad} animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 ${
              airport?.notamClosed
                ? "border-rose-500 ring-1 ring-rose-500/30"
                : "border-slate-200 dark:border-slate-800"
            }`}
          >
            {/* NOTAM Closure Alert */}
            {airport?.notamClosed && (
              <div className="p-1.5 rounded-lg bg-rose-600 text-white flex items-start gap-1.5 shadow-xs">
                <AlertOctagon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black tracking-wide">
                    NOTAM CLOSED · المطار مغلق
                  </div>
                  {airport.notamNote && (
                    <div className="text-[9.5px] text-rose-100 mt-0.5 leading-snug break-words">
                      {airport.notamNote}
                    </div>
                  )}
                  {airport.notamUntil && (
                    <div className="text-[9px] font-mono tabular-nums text-rose-100/90 mt-0.5">
                      UNTIL: {airport.notamUntil}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span
                    className={`font-mono font-black text-xs tracking-wider ${
                      airport?.notamClosed
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {resolvedIcao}
                  </span>
                  {airport?.iata && airport.iata !== "—" && (
                    <span className="font-mono text-[10px] font-bold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {airport.iata}
                    </span>
                  )}
                  {metar?.fltCat && (
                    <span
                      className={`font-mono text-[9px] font-black px-1.5 py-0.2 rounded border ${getFltCatStyle(
                        metar.fltCat
                      )}`}
                    >
                      {metar.fltCat}
                    </span>
                  )}
                  {airport?.notamClosed && (
                    <span className="text-[8.5px] font-black px-1 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/40">
                      NOTAM
                    </span>
                  )}
                </div>
                <div className={`font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5 leading-tight ${sizeSpec.title}`}>
                  {airport?.nameAr || airport?.name || airportCode}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {airport?.city || airport?.cityAr || "—"}
                    {(airport?.country || airport?.countryAr) ? `, ${airport.country || airport.countryAr}` : ""}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={copyCode}
                className="p-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 shrink-0"
                title="نسخ ICAO"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Compact Sunrise & Sunset Strip */}
            {cardConfig.showSunTimes !== false && sunTimes && (
              <div className="p-1.5 rounded-lg bg-amber-500/8 dark:bg-amber-500/10 border border-amber-500/25 grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="flex items-center gap-1 min-w-0">
                  <Sunrise className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[8.5px] text-slate-500 dark:text-slate-400 leading-none">الشروق · SR</div>
                    <div className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                      {sunTimes.sunriseUtc}Z
                      {sunTimes.hasOffset && (
                        <span className="text-[9px] text-amber-700 dark:text-amber-300 ms-1">
                          ({sunTimes.sunriseLocal})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <Sunset className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[8.5px] text-slate-500 dark:text-slate-400 leading-none">الغروب · SS</div>
                    <div className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                      {sunTimes.sunsetUtc}Z
                      {sunTimes.hasOffset && (
                        <span className="text-[9px] text-orange-700 dark:text-orange-300 ms-1">
                          ({sunTimes.sunsetLocal})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Details Grid */}
            {specItemsCount > 0 && (
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {cardConfig.showCoordinates !== false && (
                  <div className={`${sizeSpec.tilePad} rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800`}>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Compass className="w-2.5 h-2.5 text-sky-500" />
                      <span>الإحداثيات</span>
                    </div>
                    <div className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                      {airport?.lat != null && airport?.lon != null
                        ? `${Number(airport.lat).toFixed(2)}, ${Number(airport.lon).toFixed(2)}`
                        : "—"}
                    </div>
                  </div>
                )}

                {cardConfig.showElevation !== false && (
                  <div className={`${sizeSpec.tilePad} rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800`}>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5 text-emerald-500" />
                      <span>الارتفاع</span>
                    </div>
                    <div className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 mt-0.5">
                      {airport?.elevationFt != null ? `${airport.elevationFt.toLocaleString()} ft` : "—"}
                    </div>
                  </div>
                )}

                {cardConfig.showTimezone !== false && (
                  <div className={`${sizeSpec.tilePad} rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800`}>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-amber-500" />
                      <span>التوقيت</span>
                    </div>
                    <div className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-300 mt-0.5 truncate">
                      {airport?.timezone || "UTC"}
                      {sunTimes?.dayLength && (
                        <span className="text-[8.5px] text-slate-400 font-normal ms-1">· {sunTimes.dayLength}h</span>
                      )}
                    </div>
                  </div>
                )}

                {cardConfig.showRunways !== false && (
                  <div className={`${sizeSpec.tilePad} rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800`}>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Plane className="w-2.5 h-2.5 text-purple-500" />
                      <span>المدرج</span>
                    </div>
                    <div className="font-mono text-[9.5px] font-bold text-slate-700 dark:text-slate-300 mt-0.5 truncate" title={airport?.runways?.join(", ") || "—"}>
                      {airport?.runways && airport.runways.length > 0 ? airport.runways[0] : "1+ RWY"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ LIVE HOVER TRIGGERS: METAR · TAF · NOTAM ═══ */}
            {cardConfig.showWeatherNotam !== false && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onMouseEnter={() => handleIntelHover("metar")}
                    onClick={(e) => handleIntelClick(e, "metar")}
                    className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition cursor-pointer ${
                      activeIntelTab === "metar"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15"
                    }`}
                    title="مرر الفأرة لعرض أحدث METAR"
                  >
                    <Radio className="w-3 h-3 shrink-0" />
                    <span>METAR</span>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => handleIntelHover("taf")}
                    onClick={(e) => handleIntelClick(e, "taf")}
                    className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition cursor-pointer ${
                      activeIntelTab === "taf"
                        ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                        : "bg-sky-500/8 text-sky-700 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/15"
                    }`}
                    title="مرر الفأرة لعرض أحدث TAF"
                  >
                    <CloudSun className="w-3 h-3 shrink-0" />
                    <span>TAF</span>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => handleIntelHover("notam")}
                    onClick={(e) => handleIntelClick(e, "notam")}
                    className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition cursor-pointer ${
                      activeIntelTab === "notam"
                        ? airport?.notamClosed
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : airport?.notamClosed
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25"
                        : "bg-amber-500/8 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/15"
                    }`}
                    title="مرر الفأرة لعرض أحدث NOTAM"
                  >
                    <FileWarning className="w-3 h-3 shrink-0" />
                    <span>NOTAM</span>
                    {liveNotams.length > 0 && (
                      <span className="text-[8.5px] opacity-85 tabular-nums">
                        ({liveNotams.length})
                      </span>
                    )}
                  </button>
                </div>

                {/* Live Expanded Hover Panel */}
                {activeIntelTab && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-2 space-y-1.5 text-[10px] animate-in fade-in duration-100">
                    <div className="flex items-center justify-between gap-1 pb-1 border-b border-slate-200 dark:border-slate-700">
                      <span className="font-mono font-black uppercase text-[10px] text-slate-700 dark:text-slate-200">
                        {activeIntelTab === "metar"
                          ? `METAR · ${resolvedIcao}`
                          : activeIntelTab === "taf"
                          ? `TAF · ${resolvedIcao}`
                          : `ICAO NOTAM · ${resolvedIcao}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadIntel(true);
                          }}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          title="تحديث مباشر"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${intelLoading ? "animate-spin" : ""}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveIntelTab(null);
                          }}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          title="إغلاق"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {intelLoading && !intelData ? (
                      <div className="py-3 flex items-center justify-center gap-1.5 text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                        <span>جاري جلب أحدث {activeIntelTab.toUpperCase()}...</span>
                      </div>
                    ) : intelError && !intelData ? (
                      <div className="py-2 text-rose-500 text-[10px] text-center">
                        {intelError}
                      </div>
                    ) : activeIntelTab === "metar" ? (
                      metar ? (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-4 gap-1 text-center">
                            <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <div className="text-[8px] text-slate-400">WIND</div>
                              <div className="font-mono font-bold tabular-nums truncate">
                                {metar.windStr || "—"}
                              </div>
                            </div>
                            <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <div className="text-[8px] text-slate-400">VIS</div>
                              <div className="font-mono font-bold tabular-nums truncate">
                                {metar.visib != null ? `${metar.visib}` : "—"}
                              </div>
                            </div>
                            <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <div className="text-[8px] text-slate-400">TEMP</div>
                              <div className="font-mono font-bold tabular-nums">
                                {metar.temp != null ? `${metar.temp}/${metar.dewp ?? "—"}°` : "—"}
                              </div>
                            </div>
                            <div className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                              <div className="text-[8px] text-slate-400">QNH</div>
                              <div className="font-mono font-bold tabular-nums">
                                {metar.altim != null ? `${metar.altim}` : "—"}
                              </div>
                            </div>
                          </div>

                          <div
                            dir="ltr"
                            className="p-1.5 rounded bg-slate-900 text-emerald-300 font-mono text-[9.5px] leading-relaxed break-all select-text relative"
                          >
                            {metar.rawOb || "—"}
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span className="font-mono tabular-nums">
                              {metar.obsTime ? String(metar.obsTime).replace("T", " ").slice(0, 16) + "Z" : ""}
                            </span>
                            {metar.rawOb && (
                              <button
                                type="button"
                                onClick={(e) => copyRawIntel(e, metar.rawOb)}
                                className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-bold hover:underline"
                              >
                                {copiedIntel ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>نسخ</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-500 space-y-1">
                          <div>لا يتوفر تقرير METAR مباشر حالياً لمحطة {resolvedIcao}</div>
                          <button
                            type="button"
                            onClick={() => window.open(`https://metar-taf.com/${resolvedIcao}`, "_blank")}
                            className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                          >
                            فتح المصدر الخارجي ↗
                          </button>
                        </div>
                      )
                    ) : activeIntelTab === "taf" ? (
                      taf ? (
                        <div className="space-y-1.5">
                          <div
                            dir="ltr"
                            className="p-1.5 rounded bg-slate-900 text-sky-300 font-mono text-[9.5px] leading-relaxed break-all select-text max-h-32 overflow-y-auto whitespace-pre-wrap"
                          >
                            {taf.rawTAF || "—"}
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span className="font-mono tabular-nums">
                              {taf.issueTime ? `ISS: ${String(taf.issueTime).replace("T", " ").slice(0, 16)}Z` : ""}
                            </span>
                            {taf.rawTAF && (
                              <button
                                type="button"
                                onClick={(e) => copyRawIntel(e, taf.rawTAF)}
                                className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 font-bold hover:underline"
                              >
                                {copiedIntel ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>نسخ</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-500 space-y-1">
                          <div>لا يتوفر تقرير TAF مباشر حالياً لمطار {resolvedIcao}</div>
                          <button
                            type="button"
                            onClick={() => window.open(`https://metar-taf.com/${resolvedIcao}`, "_blank")}
                            className="text-sky-600 dark:text-sky-400 font-bold hover:underline"
                          >
                            فتح المصدر الخارجي ↗
                          </button>
                        </div>
                      )
                    ) : (
                      /* International NOTAM Tab (Notamify / ICAO) */
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {airport?.notamClosed && (
                          <div className="p-1.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-[9.5px] font-bold">
                            <div>CLOSED NOTAM (النظام): {airport.notamNote || "المطار مغلق"}</div>
                            {airport.notamUntil && (
                              <div className="font-mono text-[8.5px] mt-0.5">UNTIL: {airport.notamUntil}</div>
                            )}
                          </div>
                        )}

                        {liveNotams.length > 0 ? (
                          <>
                            {liveNotams.map((n, idx) => (
                              <div
                                key={n.id || idx}
                                dir="ltr"
                                className={`p-1.5 rounded border text-[9px] font-mono leading-snug break-words space-y-1 ${
                                  n.isClosed
                                    ? "bg-rose-950/85 text-rose-100 border-rose-600"
                                    : n.isRestricted
                                    ? "bg-amber-950/80 text-amber-100 border-amber-600"
                                    : "bg-slate-900 text-slate-100 border-slate-700"
                                }`}
                              >
                                {/* Header: NOTAM Number citation + Category/QCode + UTC Validity */}
                                <div className="flex items-center justify-between gap-1 text-[8.5px] font-bold flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <span className="px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[8px]">
                                      {n.source || "ICAO"}
                                    </span>
                                    <span className="text-amber-300">{n.number}</span>
                                    {(n.category || n.qCode) && (
                                      <span className="text-slate-400">· {n.category || n.qCode}</span>
                                    )}
                                  </span>
                                  <span className="text-[8px] text-slate-300">
                                    {n.effectiveStart ? `${n.effectiveStart} → ` : ""}
                                    {n.effectiveEnd || "PERM"}
                                  </span>
                                </div>

                                {/* Separate Interpretation Summary (Informational) */}
                                {n.excerpt && (
                                  <div className="px-1.5 py-1 rounded bg-white/10 text-emerald-200 font-sans text-[9.5px] leading-tight">
                                    {n.excerpt} ({n.number})
                                  </div>
                                )}

                                {/* Affected Elements Badges (CLOSED vs RESTRICTED kept distinct) */}
                                {Array.isArray(n.affectedElements) && n.affectedElements.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {n.affectedElements.map((el, ei) => (
                                      <span
                                        key={ei}
                                        className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                          String(el.effect).toUpperCase() === "CLOSED"
                                            ? "bg-rose-600/80 text-white"
                                            : "bg-amber-500/25 text-amber-200"
                                        }`}
                                      >
                                        {el.type} {el.identifier}: {el.effect}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Raw Source NOTAM Fact */}
                                {n.text && (
                                  <div className="text-[8.5px] text-slate-300 opacity-90 whitespace-pre-wrap">
                                    {n.text}
                                  </div>
                                )}
                              </div>
                            ))}
                            <div className="text-[8px] text-slate-400 text-center pt-0.5">
                              التحليلات معلوماتية فقط — القرارات التشغيلية تُراجع من المصادر الرسمية للطيران
                            </div>
                          </>
                        ) : !hasAnyNotam ? (
                          <div className="py-2 text-center text-slate-500 space-y-1">
                            <div>
                              {intelData?.notamError === "NOTAMIFY_QUOTA_EXCEEDED"
                                ? "انتهى رصيد Notamify حالياً"
                                : intelData?.notamError === "NOTAMIFY_UNAUTHORIZED"
                                ? "مفتاح NOTAMIFY_TOKEN غير صالح"
                                : !intelData?.anyNotamSourceConfigured &&
                                  !intelData?.notamifyConfigured &&
                                  !intelData?.icaoApiConfigured
                                ? `إشعارات NOTAM الدولية للمطار ${resolvedIcao} (فعّل NOTAMIFY_TOKEN أو AUTOROUTER أو AVWX أو CHECKWX أو ICAO على الخادم)`
                                : `لا توجد إشعارات NOTAM دولية نشطة حالياً للمطار ${resolvedIcao}`}
                            </div>
                            <a
                              href="https://dataservices.icao.int/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-sky-600 dark:text-sky-400 font-bold hover:underline"
                            >
                              بوابة ICAO NOTAM الدولية ↗
                            </a>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[10px]">
              <button
                type="button"
                onClick={openGoogleMaps}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition font-semibold"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                <span>الخريطة</span>
              </button>

              <button
                type="button"
                onClick={() => window.open(`https://metar-taf.com/${resolvedIcao}`, "_blank")}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition font-semibold"
              >
                <Radio className="w-2.5 h-2.5" />
                <span>metar-taf</span>
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-semibold ms-auto"
                >
                  <Settings className="w-2.5 h-2.5" />
                  <span>الإعدادات</span>
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
