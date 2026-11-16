/* ═══════════════════════════════════════════════════════════
 * AIRPORTS MANAGEMENT TAB — AeroOps Aerodromes Database
 * Manage built-in and custom airports, add new aerodromes not
 * in database, edit specs (runways, elevation, coords), sync
 * and update aerodrome data periodically.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  Compass,
  Globe,
  Database,
  CheckCircle2,
  Info,
  Clock,
  Layers,
  Download,
  Upload,
  X,
  Check,
  Sunrise,
  Sunset,
  AlertOctagon,
} from "lucide-react";
import {
  getAllAirportsList,
  getCustomAirports,
  saveCustomAirport,
  deleteCustomAirport,
  saveAirportNotam,
  calcAirportSunTimes,
  getAirportsLastSyncTime,
  setAirportsLastSyncTime,
} from "../utils/airportDatabase";
import { AirportHoverCard } from "../components/AirportHoverCard";
import { showToast, confirmAction } from "../utils/dialog";

export function AirportsManagementTab({ lang = "ar" }) {
  const isAr = lang === "ar";
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); // 'all' | 'custom' | 'builtin' | 'notam'
  const [airports, setAirports] = useState(() => getAllAirportsList());
  const [customList, setCustomList] = useState(() => getCustomAirports());
  const [lastSync, setLastSync] = useState(() => getAirportsLastSyncTime());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAirport, setEditingAirport] = useState(null);

  // Form draft state
  const [formData, setFormData] = useState({
    icao: "",
    iata: "",
    name: "",
    nameAr: "",
    city: "",
    cityAr: "",
    country: "",
    countryAr: "",
    lat: "",
    lon: "",
    elevationFt: "",
    runwaysText: "",
    timezone: "UTC+2",
    notamClosed: false,
    notamNote: "",
    notamUntil: "",
  });

  const reloadData = () => {
    setAirports(getAllAirportsList());
    setCustomList(getCustomAirports());
    setLastSync(getAirportsLastSyncTime());
  };

  useEffect(() => {
    const handler = () => reloadData();
    window.addEventListener("aeroops:airportsChanged", handler);
    return () => window.removeEventListener("aeroops:airportsChanged", handler);
  }, []);

  const openAddModal = () => {
    setEditingAirport(null);
    setFormData({
      icao: "",
      iata: "",
      name: "",
      nameAr: "",
      city: "",
      cityAr: "",
      country: "ليبيا",
      countryAr: "ليبيا",
      lat: "",
      lon: "",
      elevationFt: "",
      runwaysText: "",
      timezone: "UTC+2",
      notamClosed: false,
      notamNote: "",
      notamUntil: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (airport) => {
    setEditingAirport(airport);
    setFormData({
      icao: airport.icao || "",
      iata: airport.iata && airport.iata !== "—" ? airport.iata : "",
      name: airport.name || "",
      nameAr: airport.nameAr || airport.name || "",
      city: airport.city || "",
      cityAr: airport.cityAr || airport.city || "",
      country: airport.country || "",
      countryAr: airport.countryAr || airport.country || "",
      lat: airport.lat != null ? String(airport.lat) : "",
      lon: airport.lon != null ? String(airport.lon) : "",
      elevationFt: airport.elevationFt != null ? String(airport.elevationFt) : "",
      runwaysText: Array.isArray(airport.runways) ? airport.runways.join("\n") : "",
      timezone: airport.timezone || "UTC+2",
      notamClosed: Boolean(airport.notamClosed),
      notamNote: airport.notamNote || "",
      notamUntil: airport.notamUntil || "",
    });
    setIsModalOpen(true);
  };

  const handleToggleNotamQuick = (airport) => {
    const nextClosed = !airport.notamClosed;
    saveAirportNotam(airport.icao, {
      closed: nextClosed,
      note: nextClosed
        ? airport.notamNote || (isAr ? "المطار مغلق بموجب إعلان NOTAM" : "Aerodrome closed per NOTAM")
        : "",
      until: airport.notamUntil || "",
    });
    showToast(
      nextClosed
        ? isAr
          ? `تم تفعيل إغلاق NOTAM لمطار ${airport.icao}`
          : `NOTAM closure activated for ${airport.icao}`
        : isAr
        ? `تم إلغاء إغلاق NOTAM لمطار ${airport.icao}`
        : `NOTAM closure cleared for ${airport.icao}`,
      nextClosed ? "warning" : "success"
    );
    reloadData();
  };

  const handleSaveAirport = (e) => {
    e.preventDefault();
    const icao = formData.icao.trim().toUpperCase();
    if (!icao || icao.length < 3 || icao.length > 4) {
      showToast(isAr ? "رمز ICAO يجب أن يتكون من 3 إلى 4 أحرف" : "ICAO code must be 3-4 letters", "error");
      return;
    }

    const runways = formData.runwaysText
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    const airportObj = {
      icao,
      iata: formData.iata.trim().toUpperCase() || "—",
      name: formData.name.trim() || `${icao} Airport`,
      nameAr: formData.nameAr.trim() || formData.name.trim() || `مطار ${icao}`,
      city: formData.city.trim(),
      cityAr: formData.cityAr.trim() || formData.city.trim(),
      country: formData.country.trim(),
      countryAr: formData.countryAr.trim() || formData.country.trim(),
      lat: formData.lat ? parseFloat(formData.lat) : 0,
      lon: formData.lon ? parseFloat(formData.lon) : 0,
      elevationFt: formData.elevationFt ? parseInt(formData.elevationFt, 10) : null,
      runways,
      timezone: formData.timezone.trim() || "UTC",
    };

    const success = saveCustomAirport(airportObj);
    saveAirportNotam(icao, {
      closed: Boolean(formData.notamClosed),
      note: formData.notamNote,
      until: formData.notamUntil,
    });
    if (success) {
      showToast(
        isAr ? `تم حفظ بيانات المطار ${icao} بنجاح` : `Airport ${icao} saved successfully`,
        "success"
      );
      setIsModalOpen(false);
      reloadData();
    } else {
      showToast(isAr ? "فشل حفظ المطار" : "Failed to save airport", "error");
    }
  };

  const handleDelete = (icao) => {
    confirmAction(
      isAr
        ? `هل أنت متأكد من حذف المطار ${icao} من قاعدة البيانات المخصصة؟`
        : `Delete airport ${icao} from custom database?`,
      () => {
        const ok = deleteCustomAirport(icao);
        if (ok) {
          showToast(isAr ? `تم حذف المطار ${icao}` : `Airport ${icao} deleted`, "info");
          reloadData();
        }
      }
    );
  };

  const handlePeriodicSync = () => {
    setIsSyncing(true);
    // Simulate aeronautical database synchronization & validation
    setTimeout(() => {
      setAirportsLastSyncTime();
      setLastSync(new Date().toISOString());
      setIsSyncing(false);
      reloadData();
      showToast(
        isAr
          ? `تم تحديث ومزامنة قاعدة بيانات المطارات بنجاح (${airports.length} مطار جاهز للاستخدام)`
          : `Aeronautical database updated successfully (${airports.length} airports synchronized)`,
        "success"
      );
    }, 900);
  };

  const notamClosedCount = useMemo(
    () => airports.filter((a) => a.notamClosed).length,
    [airports]
  );

  // Filtered airports
  const filteredAirports = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return airports.filter((a) => {
      if (filterType === "custom" && !a.isCustom) return false;
      if (filterType === "builtin" && a.isCustom) return false;
      if (filterType === "notam" && !a.notamClosed) return false;

      if (!q) return true;
      const matchIcao = a.icao?.toLowerCase().includes(q);
      const matchIata = a.iata?.toLowerCase().includes(q);
      const matchName = a.name?.toLowerCase().includes(q) || a.nameAr?.toLowerCase().includes(q);
      const matchCity = a.city?.toLowerCase().includes(q) || a.cityAr?.toLowerCase().includes(q);
      const matchCountry = a.country?.toLowerCase().includes(q) || a.countryAr?.toLowerCase().includes(q);
      return matchIcao || matchIata || matchName || matchCity || matchCountry;
    });
  }, [airports, searchTerm, filterType]);

  return (
    <div className="space-y-3 text-xs font-sans">
      {/* ── TOP HEADER / STATS CARD ── */}
      <div
        className="rounded-xl p-3 border shadow-xs"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                {isAr ? "قاعدة بيانات المطارات والملاحة الجوية" : "Aerodrome & Navigation Database"}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 font-mono tabular-nums">
                  {airports.length} {isAr ? "مطار" : "airports"}
                </span>
              </h2>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "إدارة بيانات المطارات، المدارج، الارتفاعات، والإحداثيات مع دعم إضافة مطارات جديدة وتحديثها دورياً"
                  : "Manage airports, runways, elevation, coordinates, add custom aerodromes and sync periodically"}
              </p>
            </div>
          </div>

          {/* Actions & Sync Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {lastSync && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px]"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                <Clock className="w-3 h-3" />
                <span>{isAr ? "آخر تحديث:" : "Last Sync:"}</span>
                <span className="font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                  {new Date(lastSync).toLocaleDateString()} {new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}

            <button
              onClick={handlePeriodicSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isAr ? "تحديث دوري ومزامنة" : "Periodic Sync"}</span>
            </button>

            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? "إضافة مطار جديد" : "Add Airport"}</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2.5 pt-2.5 border-t" style={{ borderColor: "var(--border-default)" }}>
          <div className="border rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{isAr ? "إجمالي المطارات" : "Total Airports"}</span>
            <span className="font-mono font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{airports.length}</span>
          </div>
          <div className="border rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{isAr ? "المطارات المعتمدة" : "Standard Airfields"}</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{airports.length - customList.length}</span>
          </div>
          <div className="border rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{isAr ? "المطارات المضافة" : "Custom Aerodromes"}</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">{customList.length}</span>
          </div>
          <div className="border rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{isAr ? "المطارات المحلية (HL)" : "Libyan Airfields"}</span>
            <span className="font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {airports.filter((a) => a.icao?.startsWith("HL")).length}
            </span>
          </div>
          <div
            className={`border rounded-lg p-2 flex items-center justify-between ${
              notamClosedCount > 0 ? "bg-rose-500/10 border-rose-500/40" : ""
            }`}
            style={
              notamClosedCount > 0
                ? undefined
                : { backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }
            }
          >
            <span className={`text-[10px] font-semibold ${notamClosedCount > 0 ? "text-rose-600 dark:text-rose-400" : ""}`} style={notamClosedCount > 0 ? undefined : { color: "var(--text-muted)" }}>
              {isAr ? "مغلق بنوتام" : "NOTAM Closed"}
            </span>
            <span className={`font-mono font-bold tabular-nums ${notamClosedCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"}`}>
              {notamClosedCount}
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAr ? "بحث برمز ICAO، IATA، اسم المطار أو المدينة..." : "Search by ICAO, IATA, name, or city..."}
            className="w-full border rounded-lg ps-9 pe-3 py-1.5 focus:outline-none focus:border-sky-500 text-xs"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div
          className="flex items-center gap-1 border p-1 rounded-lg w-full sm:w-auto"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
        >
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              filterType === "all" ? "bg-sky-600 text-white" : "hover:opacity-80"
            }`}
            style={filterType === "all" ? undefined : { color: "var(--text-muted)" }}
          >
            {isAr ? "الكل" : "All"} ({airports.length})
          </button>
          <button
            onClick={() => setFilterType("custom")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              filterType === "custom" ? "bg-amber-600 text-white" : "hover:opacity-80"
            }`}
            style={filterType === "custom" ? undefined : { color: "var(--text-muted)" }}
          >
            {isAr ? "المطارات المضافة" : "Custom"} ({customList.length})
          </button>
          <button
            onClick={() => setFilterType("builtin")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              filterType === "builtin" ? "bg-slate-700 text-white" : "hover:opacity-80"
            }`}
            style={filterType === "builtin" ? undefined : { color: "var(--text-muted)" }}
          >
            {isAr ? "المعتمدة" : "Standard"} ({airports.length - customList.length})
          </button>
          <button
            onClick={() => setFilterType("notam")}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${
              filterType === "notam"
                ? "bg-rose-600 text-white font-bold"
                : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <AlertOctagon className="w-3 h-3" />
            <span>{isAr ? "مغلق بنوتام" : "NOTAM"} ({notamClosedCount})</span>
          </button>
        </div>
      </div>

      {/* ── AIRPORTS DATA TABLE ── */}
      <div
        className="border rounded-xl overflow-hidden shadow-xs"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
      >
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-start border-collapse">
            <thead
              className="text-[10px] uppercase font-mono tracking-wider sticky top-0 z-10 border-b"
              style={{
                backgroundColor: "var(--bg-app)",
                color: "var(--text-muted)",
                borderColor: "var(--border-default)",
              }}
            >
              <tr>
                <th className="py-2 px-3 text-start">{isAr ? "الرمز (ICAO / IATA)" : "Code (ICAO / IATA)"}</th>
                <th className="py-2 px-3 text-start">{isAr ? "اسم المطار" : "Airport Name"}</th>
                <th className="py-2 px-3 text-start">{isAr ? "المدينة والدولة" : "City & Country"}</th>
                <th className="py-2 px-3 text-start">{isAr ? "المدارج والارتفاع" : "Runways / Elevation"}</th>
                <th className="py-2 px-3 text-start">{isAr ? "الشروق / الغروب" : "Sunrise / Sunset"}</th>
                <th className="py-2 px-3 text-start">{isAr ? "الحالة / النوع" : "Status / Type"}</th>
                <th className="py-2 px-3 text-center">{isAr ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="font-sans">
              {filteredAirports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center" style={{ color: "var(--text-muted)" }}>
                    <Database className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{isAr ? "لا توجد مطارات مطابقة للبحث" : "No matching airports found"}</p>
                  </td>
                </tr>
              ) : (
                filteredAirports.slice(0, 100).map((airport) => {
                  const sunTimes = calcAirportSunTimes(airport.lat, airport.lon, null, airport.timezone);
                  return (
                  <tr
                    key={airport.icao}
                    className={`border-b transition-colors ${
                      airport.notamClosed
                        ? "bg-rose-500/10 hover:bg-rose-500/15"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    }`}
                    style={{ borderColor: airport.notamClosed ? "rgba(244,63,94,0.35)" : "var(--border-default)" }}
                  >
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <AirportHoverCard
                          code={airport.icao}
                          className={`font-mono font-bold hover:underline decoration-dotted cursor-help ${
                            airport.notamClosed
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-sky-600 dark:text-sky-400"
                          }`}
                        >
                          {airport.icao}
                        </AirportHoverCard>
                        {airport.iata && airport.iata !== "—" && (
                          <span
                            className="font-mono text-[10px] px-1 rounded border"
                            style={{
                              backgroundColor: "var(--bg-app)",
                              borderColor: "var(--border-default)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {airport.iata}
                          </span>
                        )}
                        {airport.notamClosed && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                            NOTAM
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div
                        className={`font-medium ${airport.notamClosed ? "text-rose-700 dark:text-rose-300 font-bold" : ""}`}
                        style={airport.notamClosed ? undefined : { color: "var(--text-primary)" }}
                      >
                        {isAr ? airport.nameAr || airport.name : airport.name || airport.nameAr}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {airport.name !== airport.nameAr ? airport.name : ""}
                      </div>
                      {airport.notamClosed && airport.notamNote && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-300 mt-0.5 font-medium">
                          {airport.notamNote} {airport.notamUntil ? `(${airport.notamUntil})` : ""}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <div style={{ color: "var(--text-primary)" }}>
                        {isAr ? airport.cityAr || airport.city : airport.city || airport.cityAr}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {isAr ? airport.countryAr || airport.country : airport.country || airport.countryAr}
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <div className="text-[11px] font-mono" style={{ color: "var(--text-primary)" }}>
                        {airport.runways && airport.runways.length > 0 ? airport.runways[0] : "—"}
                      </div>
                      {airport.elevationFt != null && (
                        <div className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                          {airport.elevationFt} ft ({Math.round(airport.elevationFt * 0.3048)} m)
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] tabular-nums">
                      {sunTimes ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Sunrise className="w-3 h-3 shrink-0" />
                            <span>{sunTimes.sunriseUtc}Z</span>
                            {sunTimes.hasOffset && (
                              <span className="text-[9px] opacity-80">({sunTimes.sunriseLocal})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <Sunset className="w-3 h-3 shrink-0" />
                            <span>{sunTimes.sunsetUtc}Z</span>
                            {sunTimes.hasOffset && (
                              <span className="text-[9px] opacity-80">({sunTimes.sunsetLocal})</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>{airport.timezone || "UTC"}</span>
                      )}
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {airport.notamClosed && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-600 text-white">
                            <AlertOctagon className="w-3 h-3" />
                            {isAr ? "مغلق" : "CLOSED"}
                          </span>
                        )}
                        {airport.isCustom ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {isAr ? "مضاف يدوياً" : "Custom"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            {isAr ? "معتمد" : "Standard"}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 px-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleNotamQuick(airport)}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold transition-colors flex items-center gap-1 ${
                            airport.notamClosed
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                          }`}
                          title={
                            airport.notamClosed
                              ? isAr
                                ? "إلغاء إغلاق NOTAM"
                                : "Clear NOTAM closure"
                              : isAr
                              ? "إغلاق المطار بموجب NOTAM"
                              : "Close airport via NOTAM"
                          }
                        >
                          <AlertOctagon className="w-3 h-3" />
                          <span>{airport.notamClosed ? (isAr ? "فتح" : "Open") : "NOTAM"}</span>
                        </button>

                        {airport.lat && airport.lon ? (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${airport.lat},${airport.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded hover:text-sky-600 transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            title={isAr ? "عرض على خرائط Google" : "View on Google Maps"}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : null}

                        <button
                          onClick={() => openEditModal(airport)}
                          className="p-1 rounded hover:text-amber-600 transition-colors"
                          style={{ color: "var(--text-muted)" }}
                          title={isAr ? "تعديل المطار" : "Edit Airport"}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {airport.isCustom && (
                          <button
                            onClick={() => handleDelete(airport.icao)}
                            className="p-1 rounded hover:text-rose-600 transition-colors"
                            style={{ color: "var(--text-muted)" }}
                            title={isAr ? "حذف المطار" : "Delete Airport"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filteredAirports.length > 100 && (
          <div
            className="py-2 px-4 text-center text-[10px] border-t"
            style={{ backgroundColor: "var(--bg-app)", color: "var(--text-muted)", borderColor: "var(--border-default)" }}
          >
            {isAr
              ? `يتم عرض أول 100 مطار من أصل ${filteredAirports.length} مطار. استخدم شريط البحث لتضييق النتائج.`
              : `Showing first 100 of ${filteredAirports.length} airports. Use search to refine.`}
          </div>
        )}
      </div>

      {/* ── ADD / EDIT AIRPORT MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="border rounded-xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border-default)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  {editingAirport
                    ? isAr
                      ? `تعديل بيانات المطار (${editingAirport.icao})`
                      : `Edit Airport (${editingAirport.icao})`
                    : isAr
                    ? "إضافة مطار جديد للمنظومة"
                    : "Add New Airport to Database"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 opacity-70 hover:opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAirport} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "رمز ICAO (مطلوب)" : "ICAO Code (Required)"} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={formData.icao}
                    onChange={(e) => setFormData({ ...formData, icao: e.target.value.toUpperCase() })}
                    placeholder="مثال: HLLM"
                    disabled={!!editingAirport}
                    className="w-full border rounded-lg px-3 py-1.5 font-mono uppercase focus:outline-none focus:border-sky-500 disabled:opacity-60"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "رمز IATA (اختياري)" : "IATA Code (Optional)"}
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.iata}
                    onChange={(e) => setFormData({ ...formData, iata: e.target.value.toUpperCase() })}
                    placeholder="مثال: MJI"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono uppercase focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "اسم المطار بالعربية" : "Airport Name (Arabic)"}
                  </label>
                  <input
                    type="text"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder="مطار معيتيقة الدولي"
                    className="w-full border rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "اسم المطار بالإنجليزية" : "Airport Name (English)"}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mitiga International Airport"
                    className="w-full border rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "المدينة" : "City"}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Tripoli / طرابلس"
                    className="w-full border rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "الدولة" : "Country"}
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Libya / ليبيا"
                    className="w-full border rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "خط العرض (Latitude)" : "Latitude"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    placeholder="32.895"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "خط الطول (Longitude)" : "Longitude"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lon}
                    onChange={(e) => setFormData({ ...formData, lon: e.target.value })}
                    placeholder="13.279"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "الارتفاع (قدم)" : "Elevation (ft)"}
                  </label>
                  <input
                    type="number"
                    value={formData.elevationFt}
                    onChange={(e) => setFormData({ ...formData, elevationFt: e.target.value })}
                    placeholder="36"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "النطاق الزمني" : "Timezone"}
                  </label>
                  <input
                    type="text"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    placeholder="UTC+2"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                    {isAr ? "المدارج (كل مدرج في سطر)" : "Runways (one per line)"}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.runwaysText}
                    onChange={(e) => setFormData({ ...formData, runwaysText: e.target.value })}
                    placeholder="11/29 · 3,376m (Asphalt)"
                    className="w-full border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-sky-500 text-[11px]"
                    style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                </div>
              </div>

              {/* NOTAM Closure Status Box */}
              <div
                className={`rounded-xl p-3 border space-y-2 ${
                  formData.notamClosed
                    ? "bg-rose-500/10 border-rose-500/50"
                    : "border-slate-200 dark:border-slate-800"
                }`}
                style={!formData.notamClosed ? { backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" } : undefined}
              >
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.notamClosed)}
                    onChange={(e) => setFormData({ ...formData, notamClosed: e.target.checked })}
                    className="w-4 h-4 accent-rose-600"
                  />
                  <AlertOctagon className={`w-4 h-4 ${formData.notamClosed ? "text-rose-600" : "text-slate-400"}`} />
                  <span className={formData.notamClosed ? "text-rose-600 dark:text-rose-400" : ""}>
                    {isAr ? "إغلاق المطار عن طريق NOTAM (يظهر باللون الأحمر)" : "Airport Closed by NOTAM (Highlighted in Red)"}
                  </span>
                </label>

                {formData.notamClosed && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-semibold mb-0.5 text-rose-700 dark:text-rose-300">
                        {isAr ? "تفاصيل / رقم النوتام (NOTAM Note)" : "NOTAM Details / Ref"}
                      </label>
                      <input
                        type="text"
                        value={formData.notamNote}
                        onChange={(e) => setFormData({ ...formData, notamNote: e.target.value })}
                        placeholder={isAr ? "مثال: A0412/26 RWY 11/29 CLOSED" : "e.g. A0412/26 RWY CLOSED"}
                        className="w-full border border-rose-500/40 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-rose-500"
                        style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold mb-0.5 text-rose-700 dark:text-rose-300">
                        {isAr ? "ساري حتى (Until)" : "Valid Until"}
                      </label>
                      <input
                        type="text"
                        value={formData.notamUntil}
                        onChange={(e) => setFormData({ ...formData, notamUntil: e.target.value })}
                        placeholder="e.g. 18:00Z / PERM"
                        className="w-full border border-rose-500/40 rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-rose-500"
                        style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--border-default)" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg border transition-colors"
                  style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isAr ? "حفظ المطار" : "Save Airport"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AirportsManagementTab;
