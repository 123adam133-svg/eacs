/* ═══════════════════════════════════════════════════════════
 * TIME 24H INPUT — Strict Aviation 24-Hour (00:00 – 23:59) Input
 * Eliminates browser 12-hour AM/PM locale formatting completely.
 * Supports fast numeric typing ("0830" -> "08:30"), arrow stepping,
 * quick "Now" button, and 24-hour grid picker.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";

function normalizeTime24(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (!digits) return "";

  let hh = 0;
  let mm = 0;
  if (digits.length <= 2) {
    hh = Math.min(23, parseInt(digits, 10) || 0);
    mm = 0;
  } else if (digits.length === 3) {
    hh = Math.min(23, parseInt(digits.slice(0, 1), 10) || 0);
    mm = Math.min(59, parseInt(digits.slice(1, 3), 10) || 0);
  } else {
    hh = Math.min(23, parseInt(digits.slice(0, 2), 10) || 0);
    mm = Math.min(59, parseInt(digits.slice(2, 4), 10) || 0);
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_STEP = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
];

export function Time24Input({
  value = "",
  onChange,
  placeholder = "00:00",
  disabled = false,
  showNowButton = true,
  className = "",
}) {
  const [text, setText] = useState(value || "");
  const [openPicker, setOpenPicker] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    if (!openPicker) return;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openPicker]);

  const handleRawChange = (e) => {
    const raw = e.target.value.replace(/[^0-9:]/g, "").slice(0, 5);
    // Auto-insert colon when typing 4 digits smoothly
    if (/^\d{4}$/.test(raw)) {
      const formatted = normalizeTime24(raw);
      setText(formatted);
      onChange?.(formatted);
      return;
    }
    setText(raw);
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(raw)) {
      onChange?.(raw);
    } else if (raw === "") {
      onChange?.("");
    }
  };

  const handleBlur = () => {
    if (!text.trim()) {
      onChange?.("");
      return;
    }
    const formatted = normalizeTime24(text);
    setText(formatted);
    onChange?.(formatted);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
      setOpenPicker(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const base = normalizeTime24(text || "00:00");
      const [h, m] = base.split(":").map(Number);
      const delta = e.key === "ArrowUp" ? 5 : -5;
      let total = h * 60 + m + delta;
      if (total < 0) total += 24 * 60;
      total = total % (24 * 60);
      const next = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
        total % 60
      ).padStart(2, "0")}`;
      setText(next);
      onChange?.(next);
    }
  };

  const setNowUtc = () => {
    const now = new Date();
    const next = `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes()
    ).padStart(2, "0")}`;
    setText(next);
    onChange?.(next);
    setOpenPicker(false);
  };

  const currentParts = normalizeTime24(text || "00:00").split(":");
  const curH = currentParts[0] || "00";
  const curM = currentParts[1] || "00";

  const selectHour = (hh) => {
    const next = `${hh}:${curM}`;
    setText(next);
    onChange?.(next);
  };

  const selectMinute = (mm) => {
    const next = `${curH}:${mm}`;
    setText(next);
    onChange?.(next);
    setOpenPicker(false);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`} dir="ltr">
      <div
        className={`flex items-center rounded-lg border px-2.5 py-2 transition focus-within:ring-2 focus-within:ring-sky-500 ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          disabled={disabled}
          value={text}
          onChange={handleRawChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={5}
          className="w-full bg-transparent outline-none font-mono font-bold text-sm tracking-wider tabular-nums"
          style={{ color: "var(--text-primary)" }}
        />

        <span className="text-[10px] font-mono font-semibold text-slate-400 px-1 select-none">
          24H
        </span>

        {showNowButton && !disabled && (
          <button
            type="button"
            onClick={setNowUtc}
            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 me-1 whitespace-nowrap"
            title="إدراج الوقت الحالي UTC"
          >
            UTC
          </button>
        )}

        {!disabled && (
          <button
            type="button"
            onClick={() => setOpenPicker((v) => !v)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
            title="اختيار الوقت بنظام 24 ساعة"
          >
            <Clock className="w-4 h-4" />
          </button>
        )}
      </div>

      {openPicker && !disabled && (
        <div
          className="absolute z-50 mt-1 start-0 w-72 rounded-xl border shadow-2xl p-3 space-y-2"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold pb-1.5 border-b" style={{ borderColor: "var(--border-default)" }}>
            <span style={{ color: "var(--text-primary)" }}>
              24-Hour Time ({curH}:{curM})
            </span>
            <button
              type="button"
              onClick={setNowUtc}
              className="text-[11px] px-2 py-0.5 rounded bg-sky-600 text-white font-bold"
            >
              الآن UTC
            </button>
          </div>

          <div>
            <div className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              Hours (00 – 23)
            </div>
            <div className="grid grid-cols-6 gap-1">
              {HOURS_24.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => selectHour(h)}
                  className={`py-1 rounded font-mono text-xs font-bold tabular-nums transition ${
                    curH === h
                      ? "bg-sky-600 text-white"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  style={curH === h ? undefined : { color: "var(--text-primary)" }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
              Minutes (00 – 55)
            </div>
            <div className="grid grid-cols-6 gap-1">
              {MINUTES_STEP.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectMinute(m)}
                  className={`py-1 rounded font-mono text-xs font-bold tabular-nums transition ${
                    curM === m
                      ? "bg-emerald-600 text-white"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  style={curM === m ? undefined : { color: "var(--text-primary)" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Time24Input;
