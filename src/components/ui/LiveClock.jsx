/* ═══════════════════════════════════════════════════════════
 * LIVE CLOCK — Inline (Single Line, Theme-aware)
 * Shows UTC + Local Time
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect } from "react";
import { Clock, Globe } from "lucide-react";

export function LiveClock() {
  const [now, setNow] = useState(new Date());
  const [tf, setTf] = useState(() => {
    if (typeof window === "undefined") return "24";
    return (
      window.__AEROOPS_TIME_FORMAT ||
      window.localStorage?.getItem("aeroops.timeFormat") ||
      "24"
    );
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onTfChange = (e) => {
      const next =
        e?.detail ||
        window.__AEROOPS_TIME_FORMAT ||
        window.localStorage?.getItem("aeroops.timeFormat") ||
        "24";
      setTf(next === "12" ? "12" : "24");
    };
    window.addEventListener("aeroops:timeFormatChanged", onTfChange);
    return () =>
      window.removeEventListener("aeroops:timeFormatChanged", onTfChange);
  }, []);

  const pad = (n) => String(n).padStart(2, "0");

  const formatClockStr = (h, m, s) => {
    const activeTf =
      (typeof window !== "undefined" && window.__AEROOPS_TIME_FORMAT) || tf;
    if (activeTf === "12") {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${pad(h12)}:${pad(m)}:${pad(s)} ${ampm}`;
    }
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  const utcTime = formatClockStr(
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );

  const localTime = formatClockStr(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );

  const getLocalTZ = () => {
    try {
      return Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone.split("/")
        .pop()
        .replace(/_/g, " ");
    } catch {
      return "Local";
    }
  };

  const localTZ = getLocalTZ();
  const isUTCOnly = Math.abs(now.getTimezoneOffset()) === 0;

  return (
    <div className="flex items-center gap-2 text-xs font-mono font-bold">
      {/* ═══ Local Time ═══ */}
      <div className="flex items-center gap-1">
        <Clock
          className="w-3.5 h-3.5"
          style={{ color: "var(--brand-primary)" }}
        />
        <span className="tabular-nums" style={{ color: "var(--text-primary)" }}>
          {localTime}
        </span>
        <span
          className="text-[10px] font-normal hidden md:inline"
          style={{ color: "var(--text-muted)" }}
        >
          {localTZ}
        </span>
      </div>

      {/* ═══ Separator + UTC (if not already in UTC) ═══ */}
      {!isUTCOnly && (
        <>
          <span style={{ color: "var(--border-default)" }}>·</span>
          <div className="flex items-center gap-1">
            <Globe
              className="w-3.5 h-3.5"
              style={{ color: "var(--brand-secondary)" }}
            />
            <span
              className="tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {utcTime}
            </span>
            <span
              className="text-[10px] font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              UTC
            </span>
          </div>
        </>
      )}

      {/* ═══ If user in UTC, just show single UTC label ═══ */}
      {isUTCOnly && (
        <span
          className="text-[10px] font-normal"
          style={{ color: "var(--text-muted)" }}
        >
          UTC
        </span>
      )}
    </div>
  );
}

export default LiveClock;
