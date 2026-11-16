/* ═══════════════════════════════════════════════════════════
 * NIGHT TIME INPUT WITH QUICK-PICK POPOVER
 * Shows HH:MM editable input with dropdown options below:
 *  - XX:XX - night in air (sunset)
 *  - XX:XX - flight time
 *  - XX:XX - block time
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { minutesToHHMM, hhmmToMinutes } from "../utils/flightTiming";

export function NightTimeInput({
  valueHHMM = "00:00",
  nightMode = "auto",
  sunsetInAirHHMM = "00:00",
  flightTimeHHMM = "00:00",
  blockTimeHHMM = "00:00",
  sunsetInfoText = "",
  onSelectPreset,
  onManualChange,
  isAr = true,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(valueHHMM || "00:00");
  const containerRef = useRef(null);

  useEffect(() => {
    setText(valueHHMM || "00:00");
  }, [valueHHMM]);

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

  const sanitizeTime = (raw) => {
    const clean = String(raw || "").replace(/[^\d:]/g, "").slice(0, 5);
    if (/^\d{4}$/.test(clean)) {
      return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    }
    return clean;
  };

  const handleInputChange = (raw) => {
    const formatted = sanitizeTime(raw);
    setText(formatted);
    if (/^\d{1,2}:\d{2}$/.test(formatted)) {
      const [h, m] = formatted.split(":").map(Number);
      const norm = minutesToHHMM(Math.min(23, h) * 60 + Math.min(59, m));
      onManualChange?.(norm, hhmmToMinutes(norm));
    }
  };

  const handleBlur = () => {
    if (!/^\d{1,2}:\d{2}$/.test(text)) {
      setText(valueHHMM || "00:00");
      return;
    }
    const [h, m] = text.split(":").map(Number);
    const norm = minutesToHHMM(Math.min(23, h) * 60 + Math.min(59, m));
    setText(norm);
    onManualChange?.(norm, hhmmToMinutes(norm));
  };

  const presets = [
    {
      id: "auto",
      hhmm: sunsetInAirHHMM || "00:00",
      labelEn: "sunset in air",
      labelAr: "من الغروب في الجو",
    },
    {
      id: "flight_time",
      hhmm: flightTimeHHMM || "00:00",
      labelEn: "flight time",
      labelAr: "زمن الطيران",
    },
    {
      id: "full_block",
      hhmm: blockTimeHHMM || "00:00",
      labelEn: "block time",
      labelAr: "زمن البلوك",
    },
  ];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={text}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="00:00"
          className="w-full h-7 px-2 pe-6 text-xs font-mono tabular-nums font-bold rounded border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:border-sky-500 outline-none"
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute end-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div
          className="absolute start-0 top-full mt-0.5 min-w-[205px] rounded border shadow-xl z-50 divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
          dir="ltr"
        >
          {presets.map((p) => {
            const isSelected = nightMode === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setText(p.hhmm);
                  onSelectPreset?.(p.id, p.hhmm, hhmmToMinutes(p.hhmm));
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-[11.5px] font-mono tabular-nums transition flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-slate-200 dark:bg-slate-700 font-bold"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>
                  {p.hhmm} - {p.labelEn}
                </span>
                {isAr && (
                  <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400" dir="rtl">
                    {p.labelAr}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {sunsetInfoText && (
        <div className="mt-0.5 text-[10px] font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
          {sunsetInfoText}
        </div>
      )}
    </div>
  );
}

export default NightTimeInput;
