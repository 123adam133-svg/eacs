import React, { useState, useEffect, useMemo } from "react";
import { X, History, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { auditAPI, readSheetCache } from "../api";
import { buildFlightHistorySnapshot } from "../utils/audit";
import { findAirport } from "../airports";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function calcGreatCircleNM(depIcao, arrIcao) {
  const a1 = findAirport(depIcao);
  const a2 = findAirport(arrIcao);
  if (!a1 || !a2 || a1.lat == null || a1.lon == null || a2.lat == null || a2.lon == null) {
    return null;
  }
  const R = 3440.065; // Earth radius in Nautical Miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(a2.lat - a1.lat);
  const dLon = toRad(a2.lon - a1.lon);
  const lat1 = toRad(a1.lat);
  const lat2 = toRad(a2.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS_SHORT[d.getUTCMonth()] || "";
  return `${day} ${mon}`;
}

function formatTimelineStamp(isoTs, tzMode, baseOffsetHours = 2) {
  const d = new Date(isoTs || Date.now());
  if (isNaN(d.getTime())) {
    return { dateLine: "—", timeLine: "—", tzSuffix: "Z" };
  }

  let target = d;
  let tzSuffix = "Z";

  if (tzMode === "LT") {
    const day = String(d.getDate()).padStart(2, "0");
    const mon = MONTHS_SHORT[d.getMonth()] || "";
    const yr = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return {
      dateLine: `${day} ${mon} ${yr}`,
      timeLine: `${hh}:${mm}:${ss} LT`,
    };
  }

  if (tzMode === "BASE") {
    target = new Date(d.getTime() + baseOffsetHours * 3600 * 1000);
    tzSuffix = "BT";
  }

  const day = String(target.getUTCDate()).padStart(2, "0");
  const mon = MONTHS_SHORT[target.getUTCMonth()] || "";
  const yr = target.getUTCFullYear();
  const hh = String(target.getUTCHours()).padStart(2, "0");
  const mm = String(target.getUTCMinutes()).padStart(2, "0");
  const ss = String(target.getUTCSeconds()).padStart(2, "0");
  return {
    dateLine: `${day} ${mon} ${yr}`,
    timeLine: `${hh}:${mm}:${ss} ${tzSuffix}`,
  };
}

function formatTimeTz(hhmm, tzMode, baseOffsetHours = 2) {
  const clean = String(hhmm || "").slice(0, 5);
  if (!clean || !clean.includes(":")) return "—";
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return clean;

  if (tzMode === "UTC") return `${clean} Z`;
  const offset =
    tzMode === "LT" ? -new Date().getTimezoneOffset() / 60 : baseOffsetHours;
  const total = (((h * 60 + m + Math.round(offset * 60)) % 1440) + 1440) % 1440;
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm} ${tzMode === "LT" ? "LT" : "BT"}`;
}

function tripTypeLabel(ft) {
  const map = {
    SCHEDULED: "Regular PAX transport",
    CHARTER: "Charter flight",
    VIP: "VIP Executive transport",
    CARGO: "Cargo / Freight",
    TRAINING: "Training flight",
    FERRY: "Ferry / Positioning",
    MEDICAL: "Medevac / Ambulance",
    PRIVATE: "Private / GA",
  };
  return map[String(ft || "").toUpperCase()] || String(ft || "Regular PAX transport");
}

function statusLabel(st) {
  const map = {
    SCHEDULED: "confirmed",
    CONFIRMED: "confirmed",
    DEPARTED: "departed",
    IN_FLIGHT: "in flight",
    ARRIVED: "arrived",
    DELAYED: "delayed",
    CANCELLED: "cancelled",
  };
  return map[String(st || "").toUpperCase()] || String(st || "confirmed").toLowerCase();
}

function safeParseDetails(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function TripHistoryModal({
  isOpen,
  onClose,
  flight,
  crew = [],
  currentUser,
  isAr = false,
}) {
  const [tzMode, setTzMode] = useState("UTC"); // "UTC" | "LT" | "BASE"
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState(() => readSheetCache("AuditLog", []) || []);
  const [collapsedMap, setCollapsedMap] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    auditAPI
      .list()
      .then((res) => {
        if (active && Array.isArray(res)) {
          setLogs(res);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, flight?.id]);

  const currentSnapshot = useMemo(
    () => buildFlightHistorySnapshot(flight, crew),
    [flight, crew]
  );

  // Base airport UTC offset fallback (HLLM/Tripoli = +2, or dep airport tz)
  const baseOffsetHours = useMemo(() => {
    const depAp = findAirport(flight?.dep);
    if (depAp && depAp.utcOffset != null && !isNaN(Number(depAp.utcOffset))) {
      return Number(depAp.utcOffset);
    }
    return 2;
  }, [flight?.dep]);

  const entries = useMemo(() => {
    const fid = String(flight?.id || "");
    const fno = String(flight?.flightNo || "").trim().toUpperCase();

    const matched = (Array.isArray(logs) ? logs : [])
      .filter((l) => {
        if (!l || l.entity !== "Flight") return false;
        if (fid && String(l.entityId) === fid) return true;
        if (!fid && fno && String(l.entityName || "").toUpperCase() === fno) return true;
        return false;
      })
      .map((l) => {
        const parsed = safeParseDetails(l.details);
        const hasSnapshot = Boolean(parsed && (parsed.flightNo || parsed.dep || parsed.crewCodes));
        return {
          id: l.id || `${l.timestamp}_${l.userName}`,
          timestamp: l.timestamp,
          userName: String(l.userName || "SYSTEM").toUpperCase(),
          action: String(l.action || "UPDATE").toUpperCase(),
          snapshot: hasSnapshot ? parsed : null,
        };
      })
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    // If there are no audit entries yet or the latest audit entry has empty snapshot (older logs),
    // synthesize a clean baseline entry from the current flight data so the modal is always informative.
    if (matched.length === 0) {
      return [
        {
          id: "current_state",
          timestamp: flight?.updatedAt || flight?.createdAt || new Date().toISOString(),
          userName: String(currentUser?.fullName || currentUser?.username || "FLIGHT OPS").toUpperCase(),
          action: "CURRENT",
          snapshot: currentSnapshot,
        },
      ];
    }

    return matched.map((item, idx) => ({
      ...item,
      snapshot: item.snapshot || (idx === 0 ? currentSnapshot : currentSnapshot),
    }));
  }, [logs, flight, currentSnapshot, currentUser]);

  if (!isOpen || !flight) return null;

  const tripTitle = flight.flightNo
    ? `${flight.flightNo}${flight.dep && flight.arr ? ` (${flight.dep}-${flight.arr})` : ""}`
    : flight.id || "Flight";

  const toggleCard = (id) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const Hl = ({ changed, children }) =>
    changed ? (
      <span className="bg-lime-300 text-slate-950 font-semibold px-1 rounded-[2px]">
        {children}
      </span>
    ) : (
      <span>{children}</span>
    );

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 md:p-6 bg-black/55 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        dir="ltr"
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-md overflow-hidden shadow-2xl border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar matching reference screenshot */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-sky-600 shrink-0" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">
              Trip History: {tripTitle}
            </h3>
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500 shrink-0" />}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* UTC | LT | BASE TIME switcher */}
            <div className="inline-flex rounded overflow-hidden border border-slate-300 dark:border-slate-700 text-[11px] font-bold">
              {[
                { id: "UTC", label: "UTC" },
                { id: "LT", label: "LT" },
                { id: "BASE", label: "BASE TIME" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setTzMode(btn.id)}
                  className={`px-2.5 py-1 transition ${
                    tzMode === btn.id
                      ? "bg-sky-500 text-white"
                      : "bg-slate-400/80 dark:bg-slate-700 text-white hover:bg-slate-500"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title={isAr ? "إغلاق" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Vertical Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4 bg-white dark:bg-slate-950">
          <div className="relative space-y-4">
            {/* Vertical continuous line aligned with the dot */}
            <div
              className="absolute top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-800"
              style={{ left: "105px" }}
            />

            {entries.map((entry, idx) => {
              const prevEntry = entries[idx + 1] || null;
              const s = entry.snapshot || currentSnapshot;
              const ps = prevEntry?.snapshot || null;

              const stamp = formatTimelineStamp(entry.timestamp, tzMode, baseOffsetHours);
              const isCollapsed = Boolean(collapsedMap[entry.id]);

              const distNm = calcGreatCircleNM(s.dep, s.arr);
              const prevDistNm = ps ? calcGreatCircleNM(ps.dep, ps.arr) : null;

              const prevCrewSet = new Set(Array.isArray(ps?.crewCodes) ? ps.crewCodes : []);
              const crewList = Array.isArray(s.crewCodes) ? s.crewCodes : [];

              const diff = (field) => ps != null && String(s[field] ?? "") !== String(ps[field] ?? "");

              return (
                <div key={entry.id} className="relative flex items-start gap-4">
                  {/* Date & Time Stamp */}
                  <div className="w-[92px] text-right shrink-0 pt-2 text-[11px] leading-tight text-slate-600 dark:text-slate-400 font-medium tabular-nums">
                    <div>{stamp.dateLine}</div>
                    <div className="mt-0.5">{stamp.timeLine}</div>
                  </div>

                  {/* Timeline Dot */}
                  <div className="relative z-10 pt-3 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700 dark:bg-sky-400 ring-4 ring-white dark:ring-slate-950" />
                  </div>

                  {/* Revision Card */}
                  <div className="flex-1 min-w-0 border border-slate-200 dark:border-slate-800 rounded-[3px] bg-white dark:bg-slate-900 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => toggleCard(entry.id)}
                      className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs tracking-wide text-slate-800 dark:text-slate-100 truncate">
                          {entry.userName}
                        </span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            entry.action === "CREATE"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : entry.action === "DELETE"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                              : "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                          }`}
                        >
                          {entry.action}
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {!isCollapsed && (
                      <div className="px-4 pb-3.5 pt-0.5 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300 space-y-2.5">
                        {/* Trip Meta Block */}
                        <div>
                          <div>
                            Commercial:{" "}
                            <Hl changed={diff("commercial")}>{s.commercial || "Yes"}</Hl>,{" "}
                            Trip type:{" "}
                            <Hl changed={diff("flightType")}>{tripTypeLabel(s.flightType)}</Hl>,
                          </div>
                          <div>
                            Trip tag list:{" "}
                            <Hl changed={diff("permits") || diff("services")}>
                              {s.permits || s.services || "---"}
                            </Hl>
                          </div>
                        </div>

                        {/* Sector Summary Block */}
                        <div>
                          <div>
                            Flight rules:{" "}
                            <Hl changed={diff("flightRules")}>{s.flightRules || "I"}</Hl>,{" "}
                            ICAO type:{" "}
                            <Hl changed={diff("icaoType")}>{s.icaoType || "S"}</Hl>,{" "}
                            Status:{" "}
                            <Hl changed={diff("status")}>{statusLabel(s.status)}</Hl>,
                          </div>

                          <div>
                            <Hl changed={diff("date")}>{formatDateShort(s.date)}</Hl>,{" "}
                            <Hl changed={diff("flightNo")}>{s.flightNo || "—"}</Hl>,{" "}
                            <Hl changed={diff("std")}>{formatTimeTz(s.std, tzMode, baseOffsetHours)}</Hl>,{" "}
                            <Hl changed={diff("dep")}>{s.dep || "—"}</Hl>,{" "}
                            <Hl changed={diff("arr")}>{s.arr || "—"}</Hl>,{" "}
                            <Hl changed={diff("sta")}>{formatTimeTz(s.sta, tzMode, baseOffsetHours)}</Hl>,{" "}
                            Block time:{" "}
                            <Hl changed={diff("blockTime")}>{s.blockTime || "00:00"}</Hl>,
                          </div>

                          <div>
                            ALTN: <Hl changed={diff("altn")}>{s.altn || "---"}</Hl>,{" "}
                            ALTN2: <Hl changed={diff("altn2")}>{s.altn2 || "---"}</Hl>,{" "}
                            T/O ALTN: ---,{" "}
                            Distance:{" "}
                            <Hl changed={ps != null && distNm !== prevDistNm}>
                              {distNm != null ? `${distNm} NM` : "---"}
                            </Hl>,
                          </div>

                          <div>
                            <Hl changed={diff("acft")}>{s.acft || "—"}</Hl>,{" "}
                            Pax: <Hl changed={diff("pax")}>{s.pax ?? 0}</Hl>,{" "}
                            PIC: <Hl changed={diff("pic")}>{s.pic || "---"}</Hl>,{" "}
                            Crew:{" "}
                            {crewList.length > 0 ? (
                              crewList.map((code, ci) => (
                                <React.Fragment key={`${code}_${ci}`}>
                                  <Hl changed={ps != null && !prevCrewSet.has(code)}>{code}</Hl>
                                  {ci < crewList.length - 1 ? ", " : ","}
                                </React.Fragment>
                              ))
                            ) : (
                              <span>---,</span>
                            )}
                          </div>

                          <div>
                            Leg tag list:{" "}
                            <Hl changed={diff("notes")}>{s.notes || "---"}</Hl>
                          </div>

                          {Array.isArray(s.sectors) && s.sectors.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                              {s.sectors.map((sec, si) => (
                                <div key={si}>
                                  Sector {si + 2}: {sec.flightNo || s.flightNo},{" "}
                                  {formatTimeTz(sec.std, tzMode, baseOffsetHours)}, {sec.dep || "—"},{" "}
                                  {sec.arr || "—"}, {formatTimeTz(sec.sta, tzMode, baseOffsetHours)},{" "}
                                  {sec.acft || s.acft}, Pax: {sec.pax ?? 0}
                                  {Array.isArray(sec.crewCodes) && sec.crewCodes.length > 0
                                    ? `, Crew: ${sec.crewCodes.join(", ")}`
                                    : ""}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
