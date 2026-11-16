/* ═══════════════════════════════════════════════════════════
 * AIRPORT DIRECTORY MODAL — AeroOps Aeronautical Directory
 * Complete aerodromes lookup with AirportHoverCard integration,
 * advanced category filters, runways specs, elevation, coordinates,
 * and instant Google Maps / METAR access in a clean, theme-aware layout.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo, useEffect } from "react";
import {
  Compass,
  Search,
  X,
  ExternalLink,
  MapPin,
  Globe,
  SlidersHorizontal,
  CloudSun,
  Layers,
  ArrowUpDown,
  Settings,
  Check,
  Copy,
  Info,
  Sunrise,
  Sunset,
  AlertOctagon,
} from "lucide-react";
import {
  getAllAirportsList,
  findAirportDetails,
  calcAirportSunTimes,
} from "../utils/airportDatabase";
import { AirportHoverCard } from "./AirportHoverCard";
import { showToast } from "../utils/dialog";

export function AirportDirectoryModal({ isOpen, onClose, lang = "ar", onOpenSettings }) {
  const isAr = lang === "ar";
  const isRTL = isAr;
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("all"); // 'all' | 'libya' | 'mena' | 'intl' | 'custom' | 'notam'
  const [sortBy, setSortBy] = useState("icao"); // 'icao' | 'city' | 'country'
  const [copiedCode, setCopiedCode] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onChanged = () => setRefreshTick((v) => v + 1);
    window.addEventListener("aeroops:airportsChanged", onChanged);
    return () => window.removeEventListener("aeroops:airportsChanged", onChanged);
  }, []);

  const allAirports = useMemo(() => {
    return getAllAirportsList();
  }, [isOpen, refreshTick]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(isAr ? `تم نسخ الرمز ${code}` : `Copied code ${code}`, "success");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredAirports = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return allAirports
      .filter((a) => {
        // Category filter
        const icao = String(a.icao || "").toUpperCase();
        const country = String(a.country || a.countryAr || "").toLowerCase();

        if (category === "libya") {
          if (!icao.startsWith("HL") && !country.includes("libya") && !country.includes("ليبيا")) {
            return false;
          }
        } else if (category === "mena") {
          const isMena =
            icao.startsWith("HL") ||
            icao.startsWith("HE") ||
            icao.startsWith("DT") ||
            icao.startsWith("DA") ||
            icao.startsWith("GM") ||
            icao.startsWith("OE") ||
            icao.startsWith("OM") ||
            icao.startsWith("OJ") ||
            icao.startsWith("OK") ||
            icao.startsWith("OB") ||
            icao.startsWith("OT") ||
            icao.startsWith("OL") ||
            icao.startsWith("OS") ||
            country.includes("مصر") ||
            country.includes("تونس") ||
            country.includes("السعودية") ||
            country.includes("الإمارات");
          if (!isMena) return false;
        } else if (category === "intl") {
          const isMenaOrLibya =
            icao.startsWith("HL") ||
            icao.startsWith("HE") ||
            icao.startsWith("DT") ||
            icao.startsWith("DA") ||
            icao.startsWith("GM");
          if (isMenaOrLibya) return false;
        } else if (category === "custom") {
          if (!a.isCustom) return false;
        } else if (category === "notam") {
          if (!a.notamClosed) return false;
        }

        // Search text query
        if (!q) return true;

        const nameAr = String(a.nameAr || "").toLowerCase();
        const nameEn = String(a.name || "").toLowerCase();
        const cityAr = String(a.cityAr || "").toLowerCase();
        const cityEn = String(a.city || "").toLowerCase();
        const iata = String(a.iata || "").toLowerCase();

        return (
          icao.toLowerCase().includes(q) ||
          iata.includes(q) ||
          nameAr.includes(q) ||
          nameEn.includes(q) ||
          cityAr.includes(q) ||
          cityEn.includes(q) ||
          country.includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === "icao") {
          return String(a.icao || "").localeCompare(String(b.icao || ""));
        }
        if (sortBy === "city") {
          const cA = isAr ? a.cityAr || a.city : a.city || a.cityAr;
          const cB = isAr ? b.cityAr || b.city : b.city || b.cityAr;
          return (cA || "").localeCompare(cB || "");
        }
        if (sortBy === "country") {
          const cA = isAr ? a.countryAr || a.country : a.country || a.countryAr;
          const cB = isAr ? b.countryAr || b.country : b.country || b.countryAr;
          return (cA || "").localeCompare(cB || "");
        }
        return 0;
      });
  }, [allAirports, searchTerm, category, sortBy, isAr]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-900 dark:text-slate-100">
        {/* ═══ MODAL HEADER ═══ */}
        <div className="p-3.5 sm:p-4 bg-[#1b365d] text-white flex items-center justify-between border-b border-[#142947] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold truncate text-white">
                  {isAr ? "دليل المطارات والملاحة الجوية (Airport Directory)" : "Aeronautical Airport Directory"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-sky-900/80 border border-sky-600/50 text-sky-200">
                  {allAirports.length} {isAr ? "مطار" : "airports"}
                </span>
              </div>
              <p className="text-[11px] text-sky-200/70 truncate">
                {isAr
                  ? "قاعدة بيانات متكاملة لرموز ICAO/IATA، المدارج، الارتفاعات والإحداثيات مع دعم بطاقات العرض التفاعلية"
                  : "Comprehensive aerodrome database with runway specs, elevation, coordinates & live hover cards"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenSettings && (
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 border border-sky-500/40 text-xs font-semibold text-sky-200 transition"
                title={isAr ? "إدارة المطارات في الإعدادات" : "Manage in Settings"}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{isAr ? "إدارة المطارات" : "Manage Airports"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ FILTER & SEARCH BAR ═══ */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? "ابحث برمز ICAO، IATA، اسم المطار أو المدينة..." : "Search by ICAO, IATA, airport or city..."}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-lg ps-9 pe-8 py-1.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-sky-500 text-xs font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto py-0.5">
            {[
              { id: "all", labelAr: "الكل", labelEn: "All" },
              { id: "libya", labelAr: "ليبيا (HL)", labelEn: "Libya (HL)" },
              { id: "mena", labelAr: "الشرق الأوسط وأفريقيا", labelEn: "MENA" },
              { id: "intl", labelAr: "دولي / عالمي", labelEn: "International" },
              { id: "custom", labelAr: "المضافة مخصصة", labelEn: "Custom Added" },
              { id: "notam", labelAr: "مغلق بنوتام", labelEn: "NOTAM Closed" },
            ].map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition ${
                    active
                      ? cat.id === "notam"
                        ? "bg-rose-600 text-white shadow-xs font-bold"
                        : "bg-sky-600 text-white shadow-xs font-bold"
                      : cat.id === "notam"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
                      : "bg-slate-200 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {isAr ? cat.labelAr : cat.labelEn}
                </button>
              );
            })}
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 ms-auto shrink-0 text-xs text-slate-500 dark:text-slate-400">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] hidden md:inline">{isAr ? "ترتيب:" : "Sort:"}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:border-sky-500"
            >
              <option value="icao">ICAO (الرمز)</option>
              <option value="city">{isAr ? "المدينة" : "City"}</option>
              <option value="country">{isAr ? "الدولة" : "Country"}</option>
            </select>
          </div>
        </div>

        {/* ═══ AIRPORTS DIRECTORY GRID / TABLE ═══ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50">
          {filteredAirports.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
              <Compass className="w-12 h-12 mb-2 opacity-30 animate-pulse" />
              <p className="text-sm font-semibold">{isAr ? "لم يتم العثور على مطارات مطابقة للبحث" : "No matching aerodromes found"}</p>
              <p className="text-xs text-slate-500 mt-1">{isAr ? "جرب البحث برمز أو اسم آخر" : "Try searching for another airport or city"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredAirports.map((airport) => {
                const details = findAirportDetails(airport.icao);
                const isLibyan = details.icao?.startsWith("HL");
                const runways = details.runways || [];
                const primaryRunway = runways[0] || "—";
                const sunTimes = calcAirportSunTimes(details.lat, details.lon, null, details.timezone);

                return (
                  <div
                    key={airport.icao}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between group shadow-2xs ${
                      details.notamClosed
                        ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/25 hover:border-rose-600"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/70 hover:border-sky-500/50 dark:hover:border-sky-500/40 hover:shadow-md"
                    }`}
                  >
                    <div>
                      {details.notamClosed && (
                        <div className="mb-2 px-2 py-1 rounded-lg bg-rose-600 text-white flex items-center justify-between gap-2 text-[10px] font-bold">
                          <span className="flex items-center gap-1">
                            <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                            <span>{isAr ? "مغلق بنوتام (NOTAM CLOSED)" : "NOTAM CLOSED"}</span>
                          </span>
                          {details.notamUntil && (
                            <span className="font-mono text-rose-100">{details.notamUntil}</span>
                          )}
                        </div>
                      )}

                      {/* Top Bar: ICAO badge + IATA + Copy + Type */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          {/* Live AirportHoverCard on ICAO code */}
                          <AirportHoverCard
                            code={details.icao}
                            className={`font-mono text-sm font-black underline decoration-dotted cursor-help ${
                              details.notamClosed
                                ? "text-rose-600 dark:text-rose-400 decoration-rose-500/50"
                                : "text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 decoration-sky-500/40"
                            }`}
                          >
                            {details.icao}
                          </AirportHoverCard>

                          {details.iata && details.iata !== "—" && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">
                              {details.iata}
                            </span>
                          )}

                          <button
                            onClick={() => handleCopy(details.icao)}
                            className="text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 transition p-0.5"
                            title={isAr ? "نسخ رمز ICAO" : "Copy ICAO"}
                          >
                            {copiedCode === details.icao ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1">
                          {details.notamClosed && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-rose-600 text-white">
                              NOTAM
                            </span>
                          )}
                          {isLibyan && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                              {isAr ? "محلي" : "DOM"}
                            </span>
                          )}
                          {details.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              {isAr ? "مخصص" : "CUSTOM"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Airport Name */}
                      <h3
                        className={`text-xs font-bold transition line-clamp-1 ${
                          details.notamClosed
                            ? "text-rose-700 dark:text-rose-300"
                            : "text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-300"
                        }`}
                      >
                        {isAr ? details.nameAr || details.name : details.name || details.nameAr}
                      </h3>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono line-clamp-1">
                        {details.name !== details.nameAr ? details.name : ""}
                      </div>

                      {/* City & Country */}
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 font-medium">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="truncate">
                          {isAr ? details.cityAr || details.city : details.city || details.cityAr}
                          {details.countryAr || details.country ? `, ${isAr ? details.countryAr || details.country : details.country || details.countryAr}` : ""}
                        </span>
                      </div>

                      {details.notamClosed && details.notamNote && (
                        <div className="mt-1.5 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1 line-clamp-2">
                          {details.notamNote}
                        </div>
                      )}

                      {/* Sunrise & Sunset Row */}
                      {sunTimes && (
                        <div className="grid grid-cols-2 gap-1.5 mt-2 p-1.5 rounded-lg bg-amber-500/8 border border-amber-500/20 text-[10px] font-mono tabular-nums">
                          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                            <Sunrise className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{sunTimes.sunriseUtc}Z</span>
                            {sunTimes.hasOffset && (
                              <span className="text-[9px] text-amber-700 dark:text-amber-300">({sunTimes.sunriseLocal})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-200">
                            <Sunset className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span>{sunTimes.sunsetUtc}Z</span>
                            {sunTimes.hasOffset && (
                              <span className="text-[9px] text-orange-700 dark:text-orange-300">({sunTimes.sunsetLocal})</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Runways & Specs */}
                      <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] font-mono">
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400 block text-[9px]">{isAr ? "المدارج:" : "Runway:"}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">{primaryRunway}</span>
                        </div>
                        <div className="p-1 rounded bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80 text-slate-600 dark:text-slate-300">
                          <span className="text-slate-400 block text-[9px]">{isAr ? "الارتفاع:" : "Elevation:"}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {details.elevationFt != null ? `${details.elevationFt.toLocaleString()} ft` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {details.lat && details.lon ? `${details.lat.toFixed(2)}°, ${details.lon.toFixed(2)}°` : "GPS N/A"}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Live METAR Link */}
                        <a
                          href={`https://metar-taf.com/${details.icao}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800/60 text-[10px] font-bold transition flex items-center gap-1"
                          title={isAr ? "عرض طقس المطار METAR / TAF" : "View Live METAR Weather"}
                        >
                          <CloudSun className="w-3 h-3 text-sky-500" />
                          <span>METAR</span>
                        </a>

                        {/* Google Maps Link */}
                        {details.lat && details.lon && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${details.lat},${details.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-white transition"
                            title={isAr ? "عرض موقع المطار على خرائط Google" : "View Location on Google Maps"}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="p-2.5 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-sky-500 shrink-0" />
            <span>
              {isRTL
                ? "انقر على رمز أي مطار لعرض بطاقة تفاصيل المدرج، التوقيت، وخرائط الموقع فوراً"
                : "Hover over any ICAO code for runway details, time zone & instant coordinates"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition text-xs"
          >
            {isRTL ? "إغلاق" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AirportDirectoryModal;
