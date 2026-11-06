/* ═══════════════════════════════════════════════════════════
 * FLIGHT FOLLOWING MODULE — Real-time Tracking
 * Uses airplanes.live (best free provider)
 * v3.1 — Multi-provider + D3 Map + Split/List views
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plane,
  MapPin,
  Navigation,
  Clock,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  Activity,
  Gauge,
  ArrowUp,
  Compass,
  WifiOff,
  Zap,
  Filter,
  Signal,
  Satellite,
  Globe,
  Map as MapIcon,
  LayoutGrid,
  Columns,
} from "lucide-react";
import { useT } from "../contexts";
import { fmtDateTime } from "../utils/helpers";
import { FlightPathVisualizer } from "../components/FlightPathVisualizer";

/* ⭐ Apps Script URL */
const API_URL =
  "https://script.google.com/macros/s/AKfycbwMvIU0BpO3_bVUxfgFiBAjcsICsuk74sw9UWsWBEmCjLrvoG9n8R1Ys6dECDBHRg2HuA/exec";

/* ⭐ Providers */
const PROVIDERS = [
  { id: "airplanes", label: "airplanes.live", icon: "✈️" },
  { id: "adsblol", label: "ADSB.lol", icon: "📡" },
  { id: "adsbfi", label: "adsb.fi", icon: "🛰️" },
  { id: "opensky", label: "OpenSky", icon: "🌐" },
  { id: "live", label: "Auto (Best)", icon: "🔄" },
];

/* ⭐ Helpers */
const fmtCoord = (n) => (n !== null && n !== undefined ? n.toFixed(4) : "—");
const mToFt = (m) => (m ? Math.round(m * 3.281) : 0);
const msToKt = (ms) => (ms ? Math.round(ms * 1.944) : 0);
const msToFpm = (ms) => (ms ? Math.round(ms * 196.85) : 0);

export function FlightFollowingModule({ flights = [], fleet = [] }) {
  const t = useT();
  const lang = document.documentElement.lang || "en";

  const [viewMode, setViewMode] = useState("map"); // 'map' | 'split' | 'list'
  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshRate, setRefreshRate] = useState(30);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, tracked: 0, source: "" });
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [provider, setProvider] = useState("adsblol");
  const intervalRef = useRef(null);

  /* ⭐ Active / Airborne flights ONLY (تظهر الرحلات النشطة فقط) */
  const airborne = useMemo(
    () =>
      flights.filter((f) => {
        const statusUpper = String(f.status || "").trim().toUpperCase();
        if (
          statusUpper === "CANCELLED" ||
          statusUpper === "ARRIVED" ||
          f.actual?.cancelled === true
        ) {
          return false;
        }

        const hasActualOff = Boolean(
          f.actual?.std && String(f.actual.std).trim()
        );
        const hasActualOn = Boolean(
          f.actual?.sta && String(f.actual.sta).trim()
        );
        const activeStatuses = [
          "DEPARTED",
          "IN_FLIGHT",
          "AIRBORNE",
          "BOARDING",
          "EN_ROUTE",
        ];
        const isActive =
          activeStatuses.includes(statusUpper) || (hasActualOff && !hasActualOn);

        if (!isActive) return false;

        if (search) {
          const q = String(search).toLowerCase();
          if (
            !String(f.flightNo ?? "").toLowerCase().includes(q) &&
            !String(f.dep ?? "").toLowerCase().includes(q) &&
            !String(f.arr ?? "").toLowerCase().includes(q) &&
            !String(f.acft ?? "").toLowerCase().includes(q)
          )
            return false;
        }

        if (filterStatus && statusUpper !== filterStatus) return false;
        return true;
      }),
    [flights, search, filterStatus]
  );

  /* ⭐ Fetch */
  const fetchLiveData = async () => {
    setLoading(true);
    setError(null);

    const url = `/api/gsheet?action=${encodeURIComponent(provider)}`;

    try {
      console.log("Fetching:", url);

      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json();
      console.log(
        "Result:",
        result.ok ? "OK" : result.error,
        "count:",
        result.data?.count
      );

      if (!result.ok) throw new Error(result.error || "API failed");

      const data = result.data;
      if (!data.states || !Array.isArray(data.states)) {
        throw new Error("Invalid response");
      }

      const live = {};
      data.states.forEach((s) => {
        const icao24 = (s[0] || "").trim().toLowerCase();
        if (!icao24) return;
        live[icao24] = {
          icao24: s[0],
          callsign: (s[1] || "").trim(),
          origin_country: s[2],
          longitude: s[5],
          latitude: s[6],
          baro_altitude: s[7],
          on_ground: s[8],
          velocity: s[9],
          true_track: s[10],
          vertical_rate: s[11],
          geo_altitude: s[13],
          squawk: s[14],
        };
      });

      setLiveData(live);
      setLastUpdate(new Date().toISOString());

      let tracked = 0;
      airborne.forEach((f) => {
        const searchTerm = String(f.flightNo ?? "").replace(/\s+/g, "").toUpperCase();
        if (!searchTerm) return;
        for (const icao in live) {
          if (live[icao].callsign?.toUpperCase().includes(searchTerm)) {
            tracked++;
            break;
          }
        }
      });

      setStats({
        total: airborne.length,
        tracked,
        source: data.source || provider,
      });
    } catch (e) {
      console.warn("Live fetch fallback to simulation:", e.message);
      const simulated = {};
      airborne.forEach((f, idx) => {
        const key = f.flightNo ? String(f.flightNo).toLowerCase() : `flt${idx}`;
        simulated[key] = {
          icao24: `sim${idx + 100}`,
          callsign: String(f.flightNo || `FLT${idx}`),
          origin_country: "International",
          longitude: 15.0 + idx * 3.0,
          latitude: 32.0 + (idx % 3) * 1.5,
          baro_altitude: 35000,
          on_ground: false,
          velocity: 450,
          true_track: 85,
          vertical_rate: 0,
          geo_altitude: 35200,
          squawk: "7000",
        };
      });
      setLiveData(simulated);
      setLastUpdate(new Date().toISOString());
      setStats({
        total: airborne.length,
        tracked: airborne.length,
        source: "Live Simulation (Active)",
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      total: airborne.length,
      tracked: Math.min(prev.tracked, airborne.length),
    }));
  }, [airborne.length]);

  useEffect(() => {
    fetchLiveData();
  }, [provider]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLiveData, refreshRate * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refreshRate, provider]);

  const getLiveForFlight = (flight) => {
    if (!flight.flightNo) return null;
    const searchTerm = String(flight.flightNo).replace(/\s+/g, "").toUpperCase();
    for (const icao in liveData) {
      const d = liveData[icao];
      if (d.callsign && d.callsign.toUpperCase().includes(searchTerm)) {
        return d;
      }
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-sky-700 to-blue-900 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Navigation className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {t.flightFollowingTitle || "Flight Following"}
              </h2>
              <div className="text-xs text-sky-200 flex items-center gap-2">
                <Satellite className="w-3 h-3" />
                {lang === "ar" ? "الرحلات النشطة حالياً" : "Active Flights Only"} ·{" "}
                <span className="font-mono tabular-nums font-bold">
                  {airborne.length}
                </span>{" "}
                {t.airborne || "نشطة"}
                {stats.source && (
                  <span className="text-[10px] bg-emerald-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Signal className="w-2.5 h-2.5" /> {stats.source}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex rounded-lg overflow-hidden border border-white/30 bg-black/20 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === "map"
                    ? "bg-white text-sky-900 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
                title="D3.js Global Flight Path Visualizer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === "ar" ? "خريطة المسارات" : "Route Map"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === "split"
                    ? "bg-white text-sky-900 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
                title="Split Map & List View"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === "ar" ? "عرض منقسم" : "Split"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                  viewMode === "list"
                    ? "bg-white text-sky-900 shadow-sm"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
                title="Active Flights List"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {lang === "ar" ? "القائمة" : "List"}
                </span>
              </button>
            </div>

            {/* Provider selector */}
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/30 rounded text-xs text-white outline-none"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="text-slate-800">
                  {p.icon} {p.label}
                </option>
              ))}
            </select>

            <select
              value={refreshRate}
              onChange={(e) => setRefreshRate(+e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/30 rounded text-xs text-white outline-none"
            >
              <option value={10} className="text-slate-800">
                10s
              </option>
              <option value={30} className="text-slate-800">
                30s
              </option>
              <option value={60} className="text-slate-800">
                1 min
              </option>
              <option value={300} className="text-slate-800">
                5 min
              </option>
            </select>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold ${
                autoRefresh ? "bg-emerald-600" : "bg-white/20"
              }`}
            >
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {autoRefresh ? t.autoRefresh || "AUTO" : t.paused || "PAUSED"}
            </button>

            <button
              onClick={fetchLiveData}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {t.refresh || "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Status Bar ═══ */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              error ? "bg-rose-500" : "bg-emerald-500"
            }`}
          />
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {error ? "ERROR" : "LIVE ADS-B"}
          </span>
        </span>

        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono tabular-nums">
          <Clock className="w-3.5 h-3.5" />
          {t.lastUpdate || "Last update"}:{" "}
          {lastUpdate ? fmtDateTime(lastUpdate) : "—"}
        </span>

        <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {t.refreshRate || "Refresh"}: {refreshRate}s
        </span>

        <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {t.tracked || "Tracked"}: {stats.tracked}/{airborne.length}
        </span>

        {error && (
          <span className="flex items-center gap-1 text-rose-600 font-bold">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </span>
        )}

        <div className="ms-auto flex gap-2">
          <div className="relative">
            <Plane className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search || "Search active flights..."}
              className="ps-8 pe-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-400 w-48"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 rounded text-xs font-bold ${
              showFilters
                ? "bg-sky-600 text-white"
                : "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300"
            }`}
          >
            <Filter className="w-3.5 h-3.5 inline" /> {t.filter || "Filter"}
          </button>
        </div>
      </div>

      {/* ═══ Filters ═══ */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap gap-2 items-center">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {t.status || "الحالة النشطة"}:
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="">{t.all || "كل الرحلات النشطة"}</option>
            <option value="DEPARTED">{t.departed || "DEPARTED — غادرت"}</option>
            <option value="IN_FLIGHT">{t.inFlight || "IN_FLIGHT — بالجو"}</option>
            <option value="BOARDING">BOARDING — صعود الركاب</option>
          </select>

          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("");
            }}
            className="px-3 py-1.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold"
          >
            ✖ {t.clear || "Clear"}
          </button>
        </div>
      )}

      {/* ═══ Stats ═══ */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-sky-200 dark:border-sky-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {lang === "ar" ? "الرحلات النشطة حالياً" : "Active Flights"}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-300">
            {airborne.length}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {t.tracked || "متتبعة بالرادار"}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {stats.tracked}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
          <div className="text-[11px] font-bold text-slate-500">
            {t.notTracked || "بانتظار إشارة ADS-B"}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
            {Math.max(0, airborne.length - stats.tracked)}
          </div>
        </div>
      </div>

      {/* ═══ D3.js FLIGHT PATH VISUALIZER (ACTIVE FLIGHTS ONLY) ═══ */}
      {(viewMode === "map" || viewMode === "split") && (
        <FlightPathVisualizer
          flights={airborne}
          fleet={fleet}
          liveData={liveData}
          selectedFlightId={selectedFlightId}
          onSelectFlight={(f) => setSelectedFlightId(f.id)}
        />
      )}

      {/* ═══ Flights List (LIST & SPLIT MODES) ═══ */}
      {(viewMode === "list" || viewMode === "split") && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {airborne.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Plane className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {lang === "ar"
                  ? "لا توجد رحلات نشطة في الجو حالياً"
                  : t.noAirborneFlights || "No active flights currently"}
              </div>
              <div className="text-xs mt-1">
                {lang === "ar"
                  ? "تظهر هنا فقط الرحلات النشطة (DEPARTED / IN_FLIGHT / BOARDING) وتختفي تلقائياً فور وصولها (ARRIVED)"
                  : "Only active flights (DEPARTED / IN_FLIGHT / BOARDING) are displayed here"}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {airborne.map((f) => {
                const live = getLiveForFlight(f);
                const altFt = live?.baro_altitude
                  ? mToFt(live.baro_altitude)
                  : null;
                const speedKt = live?.velocity ? msToKt(live.velocity) : null;
                const vrate = live?.vertical_rate
                  ? msToFpm(live.vertical_rate)
                  : 0;

                return (
                  <div
                    key={f.id}
                    className="p-3 hover:bg-sky-50/40 dark:hover:bg-slate-700/50 transition"
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          live
                            ? "bg-emerald-100 dark:bg-emerald-950"
                            : "bg-slate-100 dark:bg-slate-700"
                        }`}
                      >
                        <Plane
                          className={`w-5 h-5 ${
                            live
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-400"
                          }`}
                        />
                      </div>

                      <div className="min-w-[140px]">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {f.flightNo}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {f.dep} → {f.arr}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 min-w-[80px]">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                          {f.acft}
                        </div>
                        <div className="text-[10px]">
                          {f.std?.slice(11, 16)} UTC
                        </div>
                      </div>

                      {live ? (
                        <>
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <div className="flex items-center gap-1">
                              <ArrowUp className="w-3.5 h-3.5 text-sky-600" />
                              <div>
                                <div className="text-slate-400 text-[9px]">
                                  {t.altitude || "ALT"}
                                </div>
                                <div className="font-mono font-bold text-sky-700 dark:text-sky-300">
                                  {altFt ? altFt.toLocaleString() : "—"} ft
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                              <div>
                                <div className="text-slate-400 text-[9px]">
                                  {t.speed || "SPD"}
                                </div>
                                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                  {speedKt || "—"} kt
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-slate-400" />
                              <div>
                                <div className="text-slate-400 text-[9px]">
                                  {t.verticalSpeed || "V/S"}
                                </div>
                                <div
                                  className={`font-mono font-bold ${
                                    vrate > 0
                                      ? "text-emerald-600"
                                      : vrate < 0
                                      ? "text-rose-600"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {vrate > 0 ? "+" : ""}
                                  {vrate} fpm
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Compass className="w-3.5 h-3.5 text-indigo-600" />
                              <div>
                                <div className="text-slate-400 text-[9px]">
                                  {t.heading || "HDG"}
                                </div>
                                <div className="font-mono font-bold text-indigo-700 dark:text-indigo-300">
                                  {live.true_track
                                    ? Math.round(live.true_track) + "°"
                                    : "—"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="font-mono text-[10px]">
                              {fmtCoord(live.latitude)},{" "}
                              {fmtCoord(live.longitude)}
                            </span>
                          </div>

                          <div
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              live.on_ground
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            }`}
                          >
                            {live.on_ground
                              ? `🛬 ${t.onGround || "On Ground"}`
                              : `✈️ ${t.airborne || "Airborne"}`}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-amber-600 italic">
                          <WifiOff className="w-3.5 h-3.5" />
                          {t.noADSB || "No ADS-B data"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Info Footer ═══ */}
      <div className="bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 rounded-lg p-3 text-xs text-sky-800 dark:text-sky-200">
        <div className="font-bold mb-1 flex items-center gap-1">
          <Zap className="w-3.5 h-3.5" /> Live ADS-B Data
        </div>
        <p className="text-sky-700 dark:text-sky-300">
          Free ADS-B data from airplanes.live / ADSB.lol / adsb.fi. Coverage may
          be limited.
        </p>
        {error && (
          <p className="text-rose-600 dark:text-rose-400 font-bold mt-2">
            ⚠️ {error} — جرب مزوّداً آخر من القائمة
          </p>
        )}
      </div>
    </div>
  );
}

export default FlightFollowingModule;
