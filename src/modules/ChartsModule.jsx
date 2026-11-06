/* ═══════════════════════════════════════════════════════════
 * CHARTS MODULE — Interactive Statistics
 * Pure SVG charts (no external chart library)
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  Activity,
  Plane,
  Users,
  Award,
  Calendar,
  Download,
} from "lucide-react";
import { useT } from "../contexts";
import { todayISO, daysAgoISO } from "../utils/helpers";

/* ═══════════════════════════════════════════════════════════
 * BAR CHART
 * ═══════════════════════════════════════════════════════════ */
function BarChart({
  data,
  height = 200,
  color = "#0ea5e9",
  formatValue = (v) => v,
}) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 text-sm"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ height }} className="flex items-end gap-1 px-2">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end group"
            style={{ minWidth: "30px" }}
          >
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition">
              {formatValue(d.value)}
            </div>
            <div
              className="w-full rounded-t transition-all hover:opacity-80 relative"
              style={{
                height: `${pct}%`,
                background: d.color || color,
                minHeight: "4px",
              }}
              title={`${d.label}: ${formatValue(d.value)}`}
            />
            <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 truncate w-full text-center">
              {d.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * LINE CHART
 * ═══════════════════════════════════════════════════════════ */
function LineChart({ data, height = 200, color = "#0ea5e9" }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 text-sm"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const padding = 30;
  const width = 600;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding + chartH - ((d.value - min) / range) * chartH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${
    padding + chartH
  } L ${points[0].x} ${padding + chartH} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1={padding}
          y1={padding + chartH * p}
          x2={width - padding}
          y2={padding + chartH * p}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      ))}

      {[0, 0.5, 1].map((p, i) => (
        <text
          key={i}
          x={padding - 5}
          y={padding + chartH * (1 - p) + 4}
          textAnchor="end"
          className="fill-slate-400 text-[10px]"
        >
          {Math.round(min + range * p)}
        </text>
      ))}

      <path d={areaD} fill={color} opacity="0.15" />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4"
            fill="white"
            stroke={color}
            strokeWidth="2"
          />
          <text
            x={p.x}
            y={height - 5}
            textAnchor="middle"
            className="fill-slate-500 text-[9px]"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
 * PIE CHART
 * ═══════════════════════════════════════════════════════════ */
function PieChart({ data, size = 180 }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 text-sm"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  let cumulative = 0;
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  const polarToCartesian = (angle) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return [
      "M",
      cx,
      cy,
      "L",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArc,
      0,
      end.x,
      end.y,
      "Z",
    ].join(" ");
  };

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const angle = (d.value / total) * 360;
          const path = describeArc(cumulative, cumulative + angle);
          cumulative += angle;
          return (
            <path
              key={i}
              d={path}
              fill={d.color || "#94a3b8"}
              stroke="white"
              strokeWidth="2"
              className="hover:opacity-80 transition cursor-pointer"
            >
              <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r={radius * 0.55} fill="white" />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-slate-800 dark:fill-slate-200 text-lg font-bold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-slate-500 text-[10px]"
        >
          Total
        </text>
      </svg>

      <div className="flex-1 space-y-1 min-w-[150px]">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded"
              style={{ background: d.color || "#94a3b8" }}
            />
            <span className="flex-1 text-slate-700 dark:text-slate-300">
              {d.label}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100">
              {d.value}
            </span>
            <span className="text-slate-400 w-10 text-end">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * MAIN MODULE
 * ═══════════════════════════════════════════════════════════ */
export function ChartsModule({
  flights = [],
  crew = [],
  fleet = [],
  leave = [],
  embedded = false,
}) {
  const t = useT();
  const lang = document.documentElement.lang || "en";

  const [period, setPeriod] = useState("30");
  const [activeSection, setActiveSection] = useState("overview");

  /* ⭐ Filtered flights */
  const filteredFlights = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));
    return flights.filter((f) => f.std && new Date(f.std) >= since);
  }, [flights, period]);

  /* ⭐ 1. Flights by Aircraft */
  const flightsByAircraft = useMemo(() => {
    const map = {};
    filteredFlights.forEach((f) => {
      if (!f.acft) return;
      map[f.acft] = (map[f.acft] || 0) + 1;
    });
    const colors = [
      "#0ea5e9",
      "#22c55e",
      "#f59e0b",
      "#ef4444",
      "#a855f7",
      "#6366f1",
      "#ec4899",
      "#14b8a6",
    ];
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([reg, count], i) => ({
        label: reg,
        value: count,
        color: colors[i % colors.length],
      }));
  }, [filteredFlights]);

  /* ⭐ 2. Flights by Status */
  const flightsByStatus = useMemo(() => {
    const statusColors = {
      SCHEDULED: "#0ea5e9",
      BOARDING: "#6366f1",
      DELAYED: "#ef4444",
      DEPARTED: "#06b6d4",
      ARRIVED: "#22c55e",
      CANCELLED: "#64748b",
    };
    const map = {};
    filteredFlights.forEach((f) => {
      const status = f.status || "SCHEDULED";
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      label: status,
      value: count,
      color: statusColors[status] || "#94a3b8",
    }));
  }, [filteredFlights]);

  /* ⭐ 3. Daily Flights */
  const dailyFlights = useMemo(() => {
    const days = parseInt(period) >= 30 ? 30 : 14;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = filteredFlights.filter((f) =>
        f.std?.startsWith(dateStr)
      ).length;
      result.push({
        label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        value: count,
      });
    }
    return result;
  }, [filteredFlights, period]);

  /* ⭐ 4. Top Destinations */
  const flightsByDestination = useMemo(() => {
    const map = {};
    filteredFlights.forEach((f) => {
      if (!f.arr) return;
      map[f.arr] = (map[f.arr] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([dest, count]) => ({
        label: dest,
        value: count,
        color: "#0ea5e9",
      }));
  }, [filteredFlights]);

  /* ⭐ 5. Crew by Role */
  const crewByRole = useMemo(() => {
    const roleColors = {
      captain: "#0ea5e9",
      firstOfficer: "#22c55e",
      flightAttendant: "#f59e0b",
      engineer: "#a855f7",
      security: "#ef4444",
      loadmaster: "#14b8a6",
    };
    const roleLabels = {
      captain: "Captain",
      firstOfficer: "First Officer",
      flightAttendant: "Flight Attendant",
      engineer: "Engineer",
      security: "Security",
      loadmaster: "Loadmaster",
    };
    const map = {};
    crew.forEach((c) => {
      if (c.status !== "active") return;
      map[c.role] = (map[c.role] || 0) + 1;
    });
    return Object.entries(map).map(([role, count]) => ({
      label: roleLabels[role] || role,
      value: count,
      color: roleColors[role] || "#94a3b8",
    }));
  }, [crew]);

  /* ⭐ 6. Fleet by Status */
  const fleetByStatus = useMemo(() => {
    const statusColors = {
      AIRWORTHY: "#22c55e",
      MAINTENANCE: "#f59e0b",
      AOG: "#ef4444",
      INSPECTION_DUE: "#fb923c",
      STORED: "#94a3b8",
      IN_FLIGHT: "#0ea5e9",
      RESERVED: "#6366f1",
      RETIRED: "#475569",
      LEASED_OUT: "#a855f7",
      GROUNDED: "#b91c1c",
    };
    const map = {};
    fleet.forEach((a) => {
      const status = a.status || "AIRWORTHY";
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({
      label: status,
      value: count,
      color: statusColors[status] || "#94a3b8",
    }));
  }, [fleet]);

  /* ⭐ 7. Leave by Type */
  const leaveByType = useMemo(() => {
    const typeColors = {
      ANNUAL: "#22c55e",
      SICK: "#ef4444",
      MEDICAL: "#a855f7",
      MATERNITY: "#ec4899",
      PATERNITY: "#3b82f6",
      UNPAID: "#94a3b8",
      COMPASSIONATE: "#6366f1",
      STUDY: "#f59e0b",
    };
    const map = {};
    leave.forEach((l) => {
      if (l.status !== "approved") return;
      map[l.type] = (map[l.type] || 0) + 1;
    });
    return Object.entries(map).map(([type, count]) => ({
      label: type,
      value: count,
      color: typeColors[type] || "#94a3b8",
    }));
  }, [leave]);

  /* ⭐ KPIs */
  const kpis = {
    totalFlights: filteredFlights.length,
    totalCrew: crew.filter((c) => c.status === "active").length,
    totalFleet: fleet.length,
    totalLeave: leave.filter((l) => l.status === "approved").length,
    activeAircraft: fleet.filter(
      (a) => a.status === "AIRWORTHY" || a.status === "IN_FLIGHT"
    ).length,
    pendingLeave: leave.filter((l) => l.status === "pending").length,
  };

  /* ⭐ Export CSV */
  const exportCSV = () => {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Flights", kpis.totalFlights],
      ["Active Crew", kpis.totalCrew],
      ["Total Fleet", kpis.totalFleet],
      ["Active Aircraft", kpis.activeAircraft],
      ["Approved Leave", kpis.totalLeave],
      ["Pending Leave", kpis.pendingLeave],
      ["", ""],
      ["Flights by Aircraft", ""],
      ...flightsByAircraft.map((d) => [d.label, d.value]),
      ["", ""],
      ["Flights by Status", ""],
      ...flightsByStatus.map((d) => [d.label, d.value]),
      ["", ""],
      ["Top Destinations", ""],
      ...flightsByDestination.map((d) => [d.label, d.value]),
    ];
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `charts-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SECTIONS = [
    { id: "overview", label: t.overview, icon: BarChart3 },
    { id: "flights", label: t.scheduleBoard, icon: Plane },
    { id: "crew", label: t.crew, icon: Users },
    { id: "fleet", label: t.fleet, icon: Activity },
  ];

  return (
    <div className="space-y-3">
      {!embedded && (
        <div
          className="rounded-xl p-4 text-white shadow-sm"
          style={{ background: "var(--brand-gradient)" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{t.chartsTitle}</h2>
                <div className="text-xs text-white/80 font-mono tabular-nums">
                  {t.interactiveCharts} · {period} days
                </div>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-3 py-2 bg-white/15 border border-white/30 rounded-lg text-sm text-white outline-none"
              >
                <option value="7" className="text-slate-800">
                  {t.last7days}
                </option>
                <option value="14" className="text-slate-800">
                  {t.last14days}
                </option>
                <option value="30" className="text-slate-800">
                  {t.last30days}
                </option>
                <option value="90" className="text-slate-800">
                  {t.last90days}
                </option>
                <option value="365" className="text-slate-800">
                  {t.lastYear}
                </option>
              </select>

              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-bold"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Sections + Controls Bar ═══ */}
      <div
        className="rounded-xl border p-2.5 flex flex-wrap items-center justify-between gap-2"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <div
          className="flex flex-wrap items-center gap-1 p-1 rounded-lg"
          style={{ backgroundColor: "var(--bg-app)" }}
        >
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-bold transition whitespace-nowrap"
                style={
                  isActive
                    ? { background: "var(--brand-gradient)", color: "#ffffff" }
                    : { color: "var(--text-muted)" }
                }
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {embedded && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold border outline-none"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <option value="7">{t.last7days}</option>
              <option value="14">{t.last14days}</option>
              <option value="30">{t.last30days}</option>
              <option value="90">{t.last90days}</option>
              <option value="365">{t.lastYear}</option>
            </select>

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        )}
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-sky-200 dark:border-sky-800 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="w-4 h-4 text-sky-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {t.scheduleBoard}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {kpis.totalFlights}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {t.activeCrew}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {kpis.totalCrew}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {t.activeFleet}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {kpis.activeAircraft}/{kpis.totalFleet}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border-2 border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              {t.pendingLeaveChart}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {kpis.pendingLeave}
          </div>
        </div>
      </div>

      {/* ═══ OVERVIEW Section ═══ */}
      {activeSection === "overview" && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              {t.dailyActivity}
            </h3>
            <LineChart data={dailyFlights} height={220} color="#0ea5e9" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <PieIcon className="w-4 h-4 text-sky-600" />
                {t.flightsByStatus}
              </h3>
              <PieChart data={flightsByStatus} size={200} />
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Users className="w-4 h-4 text-emerald-600" />
                {t.crewDistribution}
              </h3>
              <PieChart data={crewByRole} size={200} />
            </div>
          </div>
        </div>
      )}

      {/* ═══ FLIGHTS Section ═══ */}
      {activeSection === "flights" && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Plane className="w-4 h-4 text-sky-600" />
              {t.flightsByAircraft}
            </h3>
            <BarChart data={flightsByAircraft} height={220} color="#0ea5e9" />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Award className="w-4 h-4 text-purple-600" />
              {t.topDestinations}
            </h3>
            <BarChart
              data={flightsByDestination}
              height={220}
              color="#a855f7"
            />
          </div>
        </div>
      )}

      {/* ═══ CREW Section ═══ */}
      {activeSection === "crew" && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Users className="w-4 h-4 text-emerald-600" />
              {t.crewDistribution}
            </h3>
            <PieChart data={crewByRole} size={220} />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Calendar className="w-4 h-4 text-amber-600" />
              {t.leaveByType}
            </h3>
            <PieChart data={leaveByType} size={220} />
          </div>
        </div>
      )}

      {/* ═══ FLEET Section ═══ */}
      {activeSection === "fleet" && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Activity className="w-4 h-4 text-purple-600" />
              {t.fleetByStatus}
            </h3>
            <PieChart data={fleetByStatus} size={220} />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Plane className="w-4 h-4 text-sky-600" />
              {t.flightsPerAircraft}
            </h3>
            <BarChart data={flightsByAircraft} height={220} color="#14b8a6" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartsModule;
