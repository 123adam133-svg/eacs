/* ═══════════════════════════════════════════════════════════
 * AIRPORT INPUT Component
 * Autocomplete from airports database
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import { findAirport, searchAirports } from "../airports";
import { Input } from "./ui/Input";

export function AirportInput({
  value,
  onChange,
  placeholder = "IATA / ICAO…",
}) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const results = useMemo(() => searchAirports(query, 8), [query]);
  const matched = findAirport(query);

  const select = (a) => {
    onChange?.(a.icao);
    setQuery(a.icao);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    const upper = e.target.value.toUpperCase();
    setQuery(upper);
    onChange?.(upper.trim());
    setOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false);
      const trimmed = String(query || "").trim().toUpperCase();
      if (!trimmed) {
        onChange?.("");
        return;
      }
      const exact = findAirport(trimmed);
      if (exact && exact.icao) {
        setQuery(exact.icao);
        onChange?.(exact.icao);
      } else {
        setQuery(trimmed);
        onChange?.(trimmed);
      }
    }, 180);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && open && results.length > 0) {
      e.preventDefault();
      const trimmed = String(query || "").trim().toUpperCase();
      const exact = findAirport(trimmed);
      select(exact || results[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="uppercase font-mono"
        />

        {matched && (
          <span className="absolute top-1/2 -translate-y-1/2 end-2 text-[10px] text-emerald-600 font-mono bg-emerald-50 px-1.5 py-0.5 rounded pointer-events-none">
            {matched.iata}
          </span>
        )}
      </div>

      {matched && (
        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
          {matched.name} · {matched.city}
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-auto">
          {results.map((a) => (
            <button
              key={a.icao}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(a);
              }}
              className="w-full text-start px-3 py-2 text-sm hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center gap-2"
            >
              <span className="font-mono font-bold w-12 text-slate-800 dark:text-slate-100">
                {a.icao}
              </span>
              <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded w-10 text-center text-slate-700 dark:text-slate-200">
                {a.iata}
              </span>
              <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                {a.city} — {a.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AirportInput;
