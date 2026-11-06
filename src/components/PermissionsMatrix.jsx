/* ═══════════════════════════════════════════════════════════
 * PERMISSIONS MATRIX — Modern grid
 * v2.0 — Better UX, select all per group, theme-aware
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { getPermissionsWithNamedDashboards } from "../config/permissions";
import { readSheetCache } from "../api";
import { safeArray } from "../utils/helpers";

export function PermissionsMatrix({ value, onChange, lang = "en" }) {
  const safeValue = safeArray(value);
  const [namedDashboards, setNamedDashboards] = useState(() =>
    readSheetCache("NamedDashboards", [])
  );
  const [rosterGroups, setRosterGroups] = useState(() =>
    readSheetCache("RosterGroups", [])
  );

  useEffect(() => {
    const sync = (e) => {
      const sheet = e?.detail?.sheetName;
      if (!sheet || sheet === "NamedDashboards") {
        setNamedDashboards(readSheetCache("NamedDashboards", []));
      }
      if (!sheet || sheet === "RosterGroups") {
        setRosterGroups(readSheetCache("RosterGroups", []));
      }
    };
    window.addEventListener("aeroops:sheetCacheUpdated", sync);
    return () => window.removeEventListener("aeroops:sheetCacheUpdated", sync);
  }, []);

  const permissionsMap = useMemo(
    () => getPermissionsWithNamedDashboards(namedDashboards, rosterGroups),
    [namedDashboards, rosterGroups]
  );

  const [expanded, setExpanded] = useState(() => {
    const o = {};
    Object.keys(permissionsMap).forEach((k) => (o[k] = false));
    o.schedule = true;
    o.crew = true;
    o.quality = true;
    o.roster = true;
    o.roster_groups = true;
    o.named_dashboards = true;
    return o;
  });

  const togglePerm = (key) => {
    if (safeValue.includes(key)) {
      onChange(safeValue.filter((k) => k !== key));
    } else {
      onChange([...safeValue, key]);
    }
  };

  const toggleGroup = (group) => {
    const keys = group.perms.map((p) => p.key);
    const allOn = keys.every((k) => safeValue.includes(k));
    if (allOn) {
      onChange(safeValue.filter((k) => !keys.includes(k)));
    } else {
      onChange([...new Set([...safeValue, ...keys])]);
    }
  };

  const isAllOn = safeValue.includes("*");

  return (
    <div
      className="space-y-2 max-h-[480px] overflow-auto rounded-lg p-2"
      style={{
        backgroundColor: "var(--bg-app)",
        border: "1px solid var(--border-default)",
      }}
    >
      {Object.entries(permissionsMap).map(([gk, g]) => {
        const keys = g.perms.map((p) => p.key);
        const allOn = isAllOn || keys.every((k) => safeValue.includes(k));
        const someOn = !isAllOn && keys.some((k) => safeValue.includes(k));
        const open = expanded[gk];

        return (
          <div
            key={gk}
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-default)",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{
                borderBottom: open ? "1px solid var(--border-default)" : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, [gk]: !e[gk] }))}
                className="flex items-center gap-2 text-sm font-bold flex-1 text-start"
                style={{ color: "var(--text-primary)" }}
              >
                {open ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span className="text-base">{g.icon}</span>
                <span>{lang === "ar" ? g.label_ar : g.label_en}</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: allOn
                      ? "rgba(34, 197, 94, 0.15)"
                      : "var(--bg-app)",
                    color: allOn ? "#22c55e" : "var(--text-muted)",
                  }}
                >
                  {keys.filter((k) => safeValue.includes(k)).length}/
                  {keys.length}
                </span>
              </button>

              <label
                className="flex items-center gap-1.5 text-xs cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOn && someOn;
                  }}
                  onChange={() => toggleGroup(g)}
                  disabled={isAllOn}
                  className="w-4 h-4 accent-sky-600"
                />
                {lang === "ar" ? "الكل" : "All"}
              </label>
            </div>

            {/* Body */}
            {open && (
              <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                {g.perms.map((p) => {
                  const isSelected = isAllOn || safeValue.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition"
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(99, 102, 241, 0.08)"
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.backgroundColor =
                            "var(--bg-app)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePerm(p.key)}
                        disabled={isAllOn}
                        className="w-4 h-4 accent-sky-600"
                      />
                      <span
                        className="flex-1 text-xs"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {lang === "ar" ? p.ar : p.en}
                      </span>
                      <code
                        className="text-[9px] font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {p.key}
                      </code>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PermissionsMatrix;
