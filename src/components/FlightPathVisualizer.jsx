/* ═══════════════════════════════════════════════════════════
 * FLIGHT PATH VISUALIZER — Leaflet Real-Time Map
 * High-fidelity interactive aviation map for Flight Following
 * ═══════════════════════════════════════════════════════════ */
import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import {
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Navigation,
  Compass,
  Gauge,
  ArrowUp,
  MapPin,
  Plane,
  Crosshair,
  CloudRain,
  Radio,
  Zap,
  Info,
} from "lucide-react";
import { AIRPORTS } from "../airports";

/* ⭐ Airport Lookup helper */
const AIRPORT_MAP = {};
if (Array.isArray(AIRPORTS)) {
  AIRPORTS.forEach((ap) => {
    if (ap.icao) AIRPORT_MAP[ap.icao] = ap;
    if (ap.iata) AIRPORT_MAP[ap.iata] = ap;
  });
}

function getAirportCoords(code) {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (AIRPORT_MAP[upper]) {
    return {
      lat: AIRPORT_MAP[upper].lat,
      lon: AIRPORT_MAP[upper].lon,
      name: AIRPORT_MAP[upper].name,
      city: AIRPORT_MAP[upper].city,
    };
  }
  return null;
}

/* ⭐ Tile Layers */
const TILE_LAYERS = {
  dark: {
    name: "Dark Aviation",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  street: {
    name: "Standard Map",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    name: "Satellite Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    maxZoom: 18,
  },
  topo: {
    name: "Topographic Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

/* ⭐ Helper Unit Conversions */
const mToFt = (m) => (m ? Math.round(m * 3.28084) : 0);
const msToKt = (ms) => (ms ? Math.round(ms * 1.94384) : 0);
const msToFpm = (ms) => (ms ? Math.round(ms * 196.85) : 0);

/* ⭐ Calculate Distance (Nautical Miles) */
function distanceNM(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  const R = 3440.065; // Radius of earth in NM
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ⭐ Create Leaflet SVG Icon for Aircraft */
function createAircraftIcon(heading = 0, isSelected = false, callsign = "") {
  const color = isSelected ? "#f59e0b" : "#10b981"; // Amber or Emerald
  const glow = isSelected ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.3)";

  const svgHtml = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <div style="
        position: absolute;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: ${glow};
        animation: pulse 2s infinite ease-in-out;
      "></div>
      <div style="
        transform: rotate(${heading}deg);
        transition: transform 0.5s ease-out;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      ">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
      ${
        callsign
          ? `<div style="
              position: absolute;
              bottom: -14px;
              white-space: nowrap;
              background: rgba(15, 23, 42, 0.85);
              color: #ffffff;
              font-size: 10px;
              font-weight: 700;
              font-family: monospace;
              padding: 1px 4px;
              border-radius: 4px;
              border: 1px solid ${color};
              box-shadow: 0 2px 4px rgba(0,0,0,0.4);
            ">${callsign}</div>`
          : ""
      }
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: "aircraft-leaflet-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

/* ⭐ Create Leaflet Airport Icon */
function createAirportIcon(code, type = "dep") {
  const bg = type === "dep" ? "#10b981" : "#ef4444";
  const label = type === "dep" ? "DEP" : "ARR";

  const svgHtml = `
    <div style="
      display: flex;
      align-items: center;
      gap: 3px;
      background: rgba(15, 23, 42, 0.9);
      color: #ffffff;
      border: 1.5px solid ${bg};
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 800;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      white-space: nowrap;
    ">
      <span style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${bg};
        display: inline-block;
      "></span>
      <span>${code}</span>
      <span style="font-size: 8px; opacity: 0.7;">(${label})</span>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: "airport-leaflet-marker",
    iconSize: [60, 22],
    iconAnchor: [30, 11],
  });
}

export function FlightPathVisualizer({
  flights = [],
  fleet = [],
  liveData = {},
  selectedFlightId = null,
  onSelectFlight,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const radarTileLayerRef = useRef(null);

  const [tileStyle, setTileStyle] = useState("dark"); // 'dark' | 'street' | 'satellite' | 'topo'
  const [showRadar, setShowRadar] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeFlightTrails, setActiveFlightTrails] = useState({});

  /* ⭐ Prepare flight objects with coordinates */
  const flightsWithCoords = useMemo(() => {
    return flights
      .map((f) => {
        if (!f) return null;
        const depCoords = getAirportCoords(f.dep);
        const arrCoords = getAirportCoords(f.arr);

        // Find live ADS-B data
        let live = null;
        const flightNoStr = String(f.flightNo || "").replace(/\s+/g, "").toUpperCase();
        if (flightNoStr) {
          for (const icao in liveData) {
            const d = liveData[icao];
            if (d && d.callsign && String(d.callsign).toUpperCase().includes(flightNoStr)) {
              live = d;
              break;
            }
          }
        }

        const livePos =
          live && typeof live.latitude === "number" && typeof live.longitude === "number"
            ? { lat: live.latitude, lon: live.longitude }
            : null;

        return {
          flight: f,
          dep: depCoords,
          arr: arrCoords,
          live,
          livePos,
          hasCoords: !!(depCoords || arrCoords || livePos),
        };
      })
      .filter(Boolean)
      .filter((x) => x.hasCoords);
  }, [flights, liveData]);

  /* ⭐ Initialize Leaflet Map */
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center over North Africa / Mediterranean area (30.0, 18.0)
      const map = L.map(mapContainerRef.current, {
        center: [30.0, 18.0],
        zoom: 5,
        zoomControl: false,
      });

      // Zoom control
      L.control.zoom({ position: "topleft" }).addTo(map);

      // Tile layer
      const initialLayer = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
      const tileLayer = L.tileLayer(initialLayer.url, {
        maxZoom: initialLayer.maxZoom,
        attribution: initialLayer.attribution,
      }).addTo(map);

      tileLayer.refName = tileStyle;

      // Layer group for aircraft and routes
      const layerGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      layerGroupRef.current = layerGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  /* ⭐ Switch Tile Style */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer && !layer.isRadar) {
        map.removeLayer(layer);
      }
    });

    const newStyle = TILE_LAYERS[tileStyle] || TILE_LAYERS.dark;
    L.tileLayer(newStyle.url, {
      maxZoom: newStyle.maxZoom,
      attribution: newStyle.attribution,
    }).addTo(map);
  }, [tileStyle]);

  /* ⭐ Weather / Rain Radar Layer */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showRadar) {
      if (!radarTileLayerRef.current) {
        // RainViewer free animated precipitation radar tile
        const radarLayer = L.tileLayer(
          "https://tilecache.rainviewer.com/v2/radar/nowcast_5min/256/{z}/{x}/{y}/2/1_1.png",
          {
            opacity: 0.55,
            attribution: '&copy; <a href="https://www.rainviewer.com">RainViewer</a>',
            maxZoom: 18,
          }
        );
        radarLayer.isRadar = true;
        radarLayer.addTo(map);
        radarTileLayerRef.current = radarLayer;
      }
    } else {
      if (radarTileLayerRef.current) {
        map.removeLayer(radarTileLayerRef.current);
        radarTileLayerRef.current = null;
      }
    }
  }, [showRadar]);

  /* ⭐ Record Trail History */
  useEffect(() => {
    flightsWithCoords.forEach(({ flight, livePos }) => {
      if (livePos) {
        const id = flight.id || flight.flightNo;
        setActiveFlightTrails((prev) => {
          const currentTrail = prev[id] || [];
          const lastPoint = currentTrail[currentTrail.length - 1];
          if (
            !lastPoint ||
            lastPoint[0] !== livePos.lat ||
            lastPoint[1] !== livePos.lon
          ) {
            const updated = [...currentTrail.slice(-30), [livePos.lat, livePos.lon]];
            return { ...prev, [id]: updated };
          }
          return prev;
        });
      }
    });
  }, [flightsWithCoords]);

  /* ⭐ Render Flight Routes and Aircraft Markers */
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const boundsPoints = [];

    flightsWithCoords.forEach(({ flight, dep, arr, live, livePos }) => {
      const isSelected = selectedFlightId === flight.id;
      const id = flight.id || flight.flightNo;

      // 1. Departure Airport
      if (dep) {
        boundsPoints.push([dep.lat, dep.lon]);
        const depMarker = L.marker([dep.lat, dep.lon], {
          icon: createAirportIcon(flight.dep || "DEP", "dep"),
        });
        depMarker.bindTooltip(
          `<b>Departure:</b> ${dep.name || flight.dep} (${dep.city || ""})`,
          { direction: "top" }
        );
        layerGroup.addLayer(depMarker);
      }

      // 2. Arrival Airport
      if (arr) {
        boundsPoints.push([arr.lat, arr.lon]);
        const arrMarker = L.marker([arr.lat, arr.lon], {
          icon: createAirportIcon(flight.arr || "ARR", "arr"),
        });
        arrMarker.bindTooltip(
          `<b>Arrival:</b> ${arr.name || flight.arr} (${arr.city || ""})`,
          { direction: "top" }
        );
        layerGroup.addLayer(arrMarker);
      }

      // 3. Flight Path Line (Dep -> LivePos -> Arr or Dep -> Arr)
      if (dep && arr) {
        const pathCoords = livePos
          ? [[dep.lat, dep.lon], [livePos.lat, livePos.lon], [arr.lat, arr.lon]]
          : [[dep.lat, dep.lon], [arr.lat, arr.lon]];

        // Flight route polyline
        const routeLine = L.polyline(pathCoords, {
          color: isSelected ? "#f59e0b" : "#0ea5e9",
          weight: isSelected ? 3.5 : 2,
          opacity: isSelected ? 0.9 : 0.6,
          dashArray: isSelected ? null : "6, 6",
        });

        routeLine.on("click", () => {
          onSelectFlight?.(flight);
        });

        layerGroup.addLayer(routeLine);
      }

      // 4. Trail History Line
      const trail = activeFlightTrails[id];
      if (trail && trail.length > 1) {
        const trailLine = L.polyline(trail, {
          color: isSelected ? "#f59e0b" : "#10b981",
          weight: 2,
          opacity: 0.5,
        });
        layerGroup.addLayer(trailLine);
      }

      // 5. Aircraft Marker
      if (livePos) {
        boundsPoints.push([livePos.lat, livePos.lon]);
        const heading = live?.true_track || 0;
        const callsign = live?.callsign || flight.flightNo || "";

        const acMarker = L.marker([livePos.lat, livePos.lon], {
          icon: createAircraftIcon(heading, isSelected, callsign),
          zIndexOffset: isSelected ? 1000 : 500,
        });

        // Popup details
        const altFt = live?.baro_altitude ? mToFt(live.baro_altitude) : null;
        const speedKt = live?.velocity ? msToKt(live.velocity) : null;
        const vrate = live?.vertical_rate ? msToFpm(live.vertical_rate) : 0;
        const fl = altFt ? `FL${Math.round(altFt / 100)}` : "—";

        const popupContent = `
          <div style="font-family: system-ui, sans-serif; padding: 4px; color: #0f172a; min-width: 180px;">
            <div style="font-weight: 800; font-size: 14px; color: #0284c7; margin-bottom: 2px;">
              ✈️ ${flight.flightNo || callsign}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
              ${flight.dep || "—"} ➔ ${flight.arr || "—"} (${flight.acft || "Aircraft"})
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; background: #f8fafc; padding: 6px; border-radius: 6px;">
              <div><b>Altitude:</b> <br/><span style="font-family: monospace; color: #0284c7;">${
                altFt ? `${altFt.toLocaleString()} ft (${fl})` : "—"
              }</span></div>
              <div><b>Speed:</b> <br/><span style="font-family: monospace; color: #059669;">${
                speedKt ? `${speedKt} kt` : "—"
              }</span></div>
              <div><b>Heading:</b> <br/><span style="font-family: monospace;">${
                heading ? `${Math.round(heading)}°` : "—"
              }</span></div>
              <div><b>V/S:</b> <br/><span style="font-family: monospace; color: ${
                vrate > 0 ? "#059669" : vrate < 0 ? "#dc2626" : "#64748b"
              }">${vrate > 0 ? "+" : ""}${vrate} fpm</span></div>
            </div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 6px;">
              Lat: ${livePos.lat.toFixed(4)}, Lon: ${livePos.lon.toFixed(4)}
            </div>
          </div>
        `;

        acMarker.bindPopup(popupContent);

        acMarker.on("click", () => {
          onSelectFlight?.(flight);
        });

        layerGroup.addLayer(acMarker);
      }
    });

    // Auto-fit bounds if first load or requested
    if (boundsPoints.length > 0 && !selectedFlightId) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
      } catch (e) {
        console.warn("Bounds calculation error:", e);
      }
    }
  }, [flightsWithCoords, selectedFlightId, activeFlightTrails]);

  /* ⭐ Center on selected flight */
  const handleCenterSelected = () => {
    const map = mapInstanceRef.current;
    if (!map || !selectedFlightId) return;

    const item = flightsWithCoords.find((x) => x.flight.id === selectedFlightId);
    if (!item) return;

    if (item.livePos) {
      map.flyTo([item.livePos.lat, item.livePos.lon], 8, { duration: 1.2 });
    } else if (item.dep) {
      map.flyTo([item.dep.lat, item.dep.lon], 7, { duration: 1.2 });
    }
  };

  /* ⭐ Fit bounds to all fleet */
  const handleFitFleet = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const points = [];
    flightsWithCoords.forEach(({ dep, arr, livePos }) => {
      if (dep) points.push([dep.lat, dep.lon]);
      if (arr) points.push([arr.lat, arr.lon]);
      if (livePos) points.push([livePos.lat, livePos.lon]);
    });

    if (points.length > 0) {
      map.flyToBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 7 });
    }
  };

  const selectedFlightObj = useMemo(() => {
    return flightsWithCoords.find((x) => x.flight.id === selectedFlightId);
  }, [flightsWithCoords, selectedFlightId]);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg transition-all ${
        fullscreen ? "fixed inset-0 z-50 rounded-none h-screen" : "relative"
      }`}
    >
      {/* ═══ Map Bar / Header ═══ */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold tracking-wide">
            Real-Time Leaflet Radar Map ({flightsWithCoords.length} Active Tracks)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Tile Selector */}
          <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
            <Layers className="w-3.5 h-3.5 text-slate-400 ms-1" />
            <button
              type="button"
              onClick={() => setTileStyle("dark")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tileStyle === "dark"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setTileStyle("satellite")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tileStyle === "satellite"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setTileStyle("street")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tileStyle === "street"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setTileStyle("topo")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                tileStyle === "topo"
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Topo
            </button>
          </div>

          {/* Weather / Radar Toggle */}
          <button
            type="button"
            onClick={() => setShowRadar(!showRadar)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
              showRadar
                ? "bg-emerald-600 border-emerald-500 text-white shadow"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Weather Radar</span>
          </button>

          {/* Fit Fleet Bounds */}
          <button
            type="button"
            onClick={handleFitFleet}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 text-[11px] font-bold transition"
            title="Fit bounds to all active fleet"
          >
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Center Fleet</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition"
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
          >
            {fullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ═══ Map Body ═══ */}
      <div
        ref={mapContainerRef}
        className="w-full bg-slate-900 z-10"
        style={{
          height: fullscreen ? "calc(100vh - 48px)" : "540px",
        }}
      />

      {/* ═══ Floating Map HUD Overlay ═══ */}
      <div className="absolute bottom-4 start-4 z-20 pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 text-white rounded-lg p-2.5 text-[11px] space-y-1.5 shadow-xl pointer-events-auto">
          <div className="font-bold text-sky-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>ADS-B Live Feeds</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Active Aircraft Position</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span>Selected Target Aircraft</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-sky-400 inline-block border-t border-dashed" />
            <span>Planned / Active Route</span>
          </div>
        </div>
      </div>

      {/* ═══ Selected Flight Detail Card Drawer ═══ */}
      {selectedFlightObj && (
        <div className="absolute top-14 end-4 z-20 max-w-sm w-full bg-slate-900/95 backdrop-blur border border-slate-700 text-white rounded-xl shadow-2xl p-4 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-600/30 border border-sky-500 flex items-center justify-center text-sky-400">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-base text-sky-400 leading-tight">
                  {selectedFlightObj.flight.flightNo}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedFlightObj.flight.acft || "Aircraft"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCenterSelected}
                className="p-1.5 bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 border border-sky-500/40 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                title="Focus on map"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Focus</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectFlight?.(null)}
                className="text-slate-400 hover:text-white text-base font-bold px-1"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Route Header */}
          <div className="flex items-center justify-between bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/60">
            <div className="text-center">
              <div className="text-base font-black text-emerald-400">
                {selectedFlightObj.flight.dep}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[90px]">
                {selectedFlightObj.dep?.city || selectedFlightObj.flight.dep}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[10px] text-sky-300 font-mono">
                {selectedFlightObj.dep && selectedFlightObj.arr
                  ? `${Math.round(
                      distanceNM(
                        selectedFlightObj.dep.lat,
                        selectedFlightObj.dep.lon,
                        selectedFlightObj.arr.lat,
                        selectedFlightObj.arr.lon
                      )
                    )} NM`
                  : "En Route"}
              </span>
              <div className="w-full flex items-center my-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <div className="flex-1 h-0.5 bg-gradient-to-r from-emerald-500 to-sky-400" />
                <Plane className="w-3.5 h-3.5 text-sky-400 mx-1" />
                <div className="flex-1 h-0.5 bg-slate-600 border-t border-dashed" />
                <div className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <span className="text-[9px] text-slate-400">
                STD: {selectedFlightObj.flight.std?.slice(11, 16) || "—"} UTC
              </span>
            </div>

            <div className="text-center">
              <div className="text-base font-black text-rose-400">
                {selectedFlightObj.flight.arr}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[90px]">
                {selectedFlightObj.arr?.city || selectedFlightObj.flight.arr}
              </div>
            </div>
          </div>

          {/* Telemetry Metrics */}
          {selectedFlightObj.live ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <div className="text-slate-400 text-[10px] flex items-center gap-1 mb-0.5">
                  <ArrowUp className="w-3 h-3 text-sky-400" /> Altitude
                </div>
                <div className="font-mono font-bold text-sky-300 text-sm">
                  {mToFt(selectedFlightObj.live.baro_altitude).toLocaleString()}{" "}
                  ft
                </div>
                <div className="text-[9px] text-slate-400">
                  FL
                  {Math.round(
                    mToFt(selectedFlightObj.live.baro_altitude) / 100
                  )}
                </div>
              </div>

              <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <div className="text-slate-400 text-[10px] flex items-center gap-1 mb-0.5">
                  <Gauge className="w-3 h-3 text-emerald-400" /> Ground Speed
                </div>
                <div className="font-mono font-bold text-emerald-300 text-sm">
                  {msToKt(selectedFlightObj.live.velocity)} kt
                </div>
                <div className="text-[9px] text-slate-400">
                  {Math.round(
                    (selectedFlightObj.live.velocity || 0) * 3.6
                  )}{" "}
                  km/h
                </div>
              </div>

              <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <div className="text-slate-400 text-[10px] flex items-center gap-1 mb-0.5">
                  <Compass className="w-3 h-3 text-indigo-400" /> Heading
                </div>
                <div className="font-mono font-bold text-indigo-300 text-sm">
                  {Math.round(selectedFlightObj.live.true_track || 0)}°
                </div>
              </div>

              <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-700/50">
                <div className="text-slate-400 text-[10px] flex items-center gap-1 mb-0.5">
                  <Zap className="w-3 h-3 text-amber-400" /> Vertical Rate
                </div>
                <div
                  className={`font-mono font-bold text-sm ${
                    msToFpm(selectedFlightObj.live.vertical_rate) > 0
                      ? "text-emerald-400"
                      : msToFpm(selectedFlightObj.live.vertical_rate) < 0
                      ? "text-rose-400"
                      : "text-slate-300"
                  }`}
                >
                  {msToFpm(selectedFlightObj.live.vertical_rate) > 0
                    ? "+"
                    : ""}
                  {msToFpm(selectedFlightObj.live.vertical_rate)} fpm
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-800/60 text-amber-200 rounded-lg p-2.5 text-center text-[11px] flex items-center justify-center gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>ADS-B live telemetry pending or scheduled departure</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FlightPathVisualizer;
