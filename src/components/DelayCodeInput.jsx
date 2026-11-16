/* ═══════════════════════════════════════════════════════════
 * SEARCHABLE IATA DELAY CODE INPUT WITH LIVE DROPDOWN
 * Matches aviation dispatch UX: type digits/keyword or pick from list.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import {
  searchDelayCodes,
  findDelayCodeInfo,
  normalizeDelayCode,
} from "../config/delayCodes";

export function DelayCodeInput({
  code = "",
  minutes = "",
  onChangeCode,
  onChangeMinutes,
  isAr = true,
  showMinutes = true,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(code || "");
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(code || "");
  }, [code]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const matches = useMemo(() => searchDelayCodes(query), [query]);
  const resolved = findDelayCodeInfo(code || query);

  const handleTextChange = (raw) => {
    const clean = raw.replace(/\s+/g, "").slice(0, 6);
    setQuery(clean);
    onChangeCode?.(normalizeDelayCode(clean));
    setOpen(true);
  };

  const handleSelectItem = (itemCode) => {
    setQuery(itemCode);
    onChangeCode?.(itemCode);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="---"
            className="w-full h-7 px-2 pe-6 text-xs font-mono font-bold rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-sky-500 outline-none"
            dir="ltr"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChangeCode?.("");
                setOpen(false);
              }}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-500"
              title={isAr ? "مسح كود التأخير" : "Clear delay code"}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {showMinutes && (
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={0}
              value={minutes ?? ""}
              onChange={(e) =>
                onChangeMinutes?.(
                  e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0)
                )
              }
              placeholder="min"
              className="w-14 h-7 px-1.5 text-xs font-mono tabular-nums text-center rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-sky-500 outline-none"
              title={isAr ? "مدة التأخير بالدقائق" : "Delay minutes"}
            />
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown (matching screenshot style) */}
      {open && (
        <div
          className="absolute start-0 top-full mt-0.5 w-72 sm:w-80 max-h-56 overflow-y-auto rounded border shadow-xl z-50 divide-y divide-slate-200 dark:divide-slate-700"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
          dir="ltr"
        >
          {matches.length === 0 ? (
            <div className="px-2.5 py-2 text-[11px] text-slate-500">
              {query
                ? `Custom code "${normalizeDelayCode(query)}" will be saved`
                : "No matching delay codes"}
            </div>
          ) : (
            matches.map((item) => {
              const isSelected = normalizeDelayCode(code) === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectItem(item.code);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-[11.5px] leading-snug transition flex flex-col gap-0.5 ${
                    isSelected
                      ? "bg-slate-200 dark:bg-slate-700 font-semibold"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="text-slate-900 dark:text-slate-100">
                    <strong className="font-mono">{item.code}</strong> - {item.en}
                  </span>
                  {isAr && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 text-right w-full" dir="rtl">
                      {item.ar}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Selected Delay Code Readout */}
      {resolved && (
        <div className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
          <span className="font-mono font-black px-1 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 shrink-0">
            DLY {resolved.code}
            {Number(minutes) > 0 ? ` · ${minutes}m` : ""}
          </span>
          <span className="truncate">{isAr ? resolved.ar : resolved.en}</span>
        </div>
      )}
    </div>
  );
}

export default DelayCodeInput;
