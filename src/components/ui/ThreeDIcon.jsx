/* ═══════════════════════════════════════════════════════════
 * THREE D ICON — Theme-Bound 3D Vector Icon System
 * ═══════════════════════════════════════════════════════════
 * Renders high-fidelity, isometric/3D illuminated vector icons
 * whose color palettes, specular highlights, rim lights, and
 * ambient glows dynamically react to the active theme & dark mode.
 * ═══════════════════════════════════════════════════════════ */
import React, { useId } from "react";

const SIZE_MAP = {
  xs: 18,
  sm: 24,
  md: 36,
  lg: 56,
  xl: 72,
  "2xl": 88,
};

/**
 * Extracts RGB components from hex or returns fallback
 */
function hexToRgb(hex, fallback = { r: 14, g: 165, b: 233 }) {
  if (!hex || typeof hex !== "string") return fallback;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
  }
  return fallback;
}

/**
 * Adjusts color brightness (factor > 1 = lighter, factor < 1 = darker)
 */
function adjustBrightness({ r, g, b }, factor) {
  return {
    r: Math.min(255, Math.max(0, Math.round(r * factor))),
    g: Math.min(255, Math.max(0, Math.round(g * factor))),
    b: Math.min(255, Math.max(0, Math.round(b * factor))),
  };
}

function rgbStr({ r, g, b }, alpha = 1) {
  return alpha < 1
    ? `rgba(${r}, ${g}, ${b}, ${alpha})`
    : `rgb(${r}, ${g}, ${b})`;
}

export function ThreeDIcon({
  name,
  size = "md",
  theme,
  darkMode = false,
  className = "",
  style = {},
  interactive = true,
}) {
  const uid = useId().replace(/:/g, "_");
  const pxSize = typeof size === "number" ? size : SIZE_MAP[size] || 36;

  // Extract primary & secondary theme colors
  const primaryHex =
    theme?.accent ||
    theme?.border ||
    (typeof window !== "undefined"
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-primary")
          ?.trim()
      : "") ||
    "#0284c7";

  const secondaryHex =
    theme?.info ||
    (typeof window !== "undefined"
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-secondary")
          ?.trim()
      : "") ||
    "#3b82f6";

  const pRgb = hexToRgb(primaryHex, { r: 14, g: 165, b: 233 });
  const sRgb = hexToRgb(secondaryHex, { r: 59, g: 130, b: 246 });

  // Dynamic 3D lighting palette computed from the active theme
  const lightTone = adjustBrightness(pRgb, 1.45);
  const midTone = pRgb;
  const darkTone = adjustBrightness(pRgb, 0.65);
  const deepShadow = adjustBrightness(pRgb, 0.35);

  const secLight = adjustBrightness(sRgb, 1.35);
  const secMid = sRgb;
  const secDark = adjustBrightness(sRgb, 0.6);

  const goldLight = { r: 254, g: 240, b: 138 };
  const goldMid = { r: 234, g: 179, b: 8 };
  const goldDark = { r: 161, g: 98, b: 7 };

  const emeraldLight = { r: 110, g: 231, b: 183 };
  const emeraldMid = { r: 16, g: 185, b: 129 };
  const emeraldDark = { r: 4, g: 120, b: 87 };

  // Shared gradients & filter definitions
  const defs = (
    <defs>
      {/* Dynamic Theme Primary 3D Gradient */}
      <linearGradient id={`${uid}_themePrimary`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={rgbStr(lightTone)} />
        <stop offset="50%" stopColor={rgbStr(midTone)} />
        <stop offset="100%" stopColor={rgbStr(darkTone)} />
      </linearGradient>

      {/* Dynamic Theme Specular Highlighting */}
      <linearGradient id={`${uid}_specular`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={darkMode ? "0.85" : "0.95"} />
        <stop offset="40%" stopColor="#ffffff" stopOpacity={darkMode ? "0.3" : "0.4"} />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>

      {/* Dynamic Theme Glow Filter */}
      <filter id={`${uid}_glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      {/* 3D Ambient Floor Shadow */}
      <radialGradient id={`${uid}_floorShadow`} cx="50%" cy="50%" r="50%">
        <stop
          offset="0%"
          stopColor={darkMode ? "rgba(0,0,0,0.7)" : rgbStr(deepShadow, 0.35)}
        />
        <stop
          offset="60%"
          stopColor={darkMode ? "rgba(0,0,0,0.3)" : rgbStr(deepShadow, 0.12)}
        />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>

      {/* Metallic Chrome / Bevel Gradient */}
      <linearGradient id={`${uid}_chrome`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="35%" stopColor="#e2e8f0" />
        <stop offset="70%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>

      {/* Gold Aviator Wings Gradient */}
      <linearGradient id={`${uid}_gold`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={rgbStr(goldLight)} />
        <stop offset="50%" stopColor={rgbStr(goldMid)} />
        <stop offset="100%" stopColor={rgbStr(goldDark)} />
      </linearGradient>

      {/* Emerald Achievement Gradient */}
      <linearGradient id={`${uid}_emerald`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={rgbStr(emeraldLight)} />
        <stop offset="55%" stopColor={rgbStr(emeraldMid)} />
        <stop offset="100%" stopColor={rgbStr(emeraldDark)} />
      </linearGradient>

      {/* Glassmorphic Front Face */}
      <linearGradient id={`${uid}_glass`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
      </linearGradient>
    </defs>
  );

  // Render specific 3D SVG icon based on name
  const renderIconContent = () => {
    switch (name) {
      /* ═══════════════════════════════════════════════════════
       * 1. AIRCRAFT / MY AIRCRAFT STATUS (Commercial Jetliner 3D)
       * ═══════════════════════════════════════════════════════ */
      case "aircraft-status":
      case "plane":
      case "airplane":
        return (
          <g>
            {/* Ambient Ground Shadow */}
            <ellipse
              cx="50"
              cy="84"
              rx="38"
              ry="7"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Jet Engine Pods (Underwing) */}
            {/* Left Engine */}
            <g transform="translate(26, 52)">
              <ellipse cx="6" cy="7" rx="4.5" ry="5.5" fill={rgbStr(deepShadow)} />
              <rect x="3" y="1" width="6" height="12" rx="3" fill={`url(#${uid}_chrome)`} />
              <ellipse cx="6" cy="1" rx="3.5" ry="2" fill={rgbStr(lightTone)} />
              {/* Spinner neon core */}
              <circle cx="6" cy="1" r="1.5" fill="#ffffff" />
            </g>
            {/* Right Engine */}
            <g transform="translate(62, 52)">
              <ellipse cx="6" cy="7" rx="4.5" ry="5.5" fill={rgbStr(deepShadow)} />
              <rect x="3" y="1" width="6" height="12" rx="3" fill={`url(#${uid}_chrome)`} />
              <ellipse cx="6" cy="1" rx="3.5" ry="2" fill={rgbStr(lightTone)} />
              {/* Spinner neon core */}
              <circle cx="6" cy="1" r="1.5" fill="#ffffff" />
            </g>

            {/* Swept Wings (3D Layered Plane) */}
            {/* Left Wing Underside / Bevel */}
            <path
              d="M 50 46 L 6 56 L 8 62 L 50 54 Z"
              fill={rgbStr(darkTone)}
            />
            {/* Left Wing Top Face */}
            <path
              d="M 50 44 L 6 54 L 9 58 L 50 50 Z"
              fill={`url(#${uid}_themePrimary)`}
            />
            {/* Left Winglet (Turned Upward) */}
            <polygon points="6,54 5,47 8,46 9,56" fill={rgbStr(lightTone)} />

            {/* Right Wing Underside / Bevel */}
            <path
              d="M 50 46 L 94 56 L 92 62 L 50 54 Z"
              fill={rgbStr(darkTone)}
            />
            {/* Right Wing Top Face */}
            <path
              d="M 50 44 L 94 54 L 91 58 L 50 50 Z"
              fill={`url(#${uid}_themePrimary)`}
            />
            {/* Right Winglet (Turned Upward) */}
            <polygon points="94,54 95,47 92,46 91,56" fill={rgbStr(lightTone)} />

            {/* Horizontal Stabilizers (Tail) */}
            <path d="M 50 70 L 28 75 L 30 78 L 50 74 Z" fill={rgbStr(darkTone)} />
            <path d="M 50 70 L 72 75 L 70 78 L 50 74 Z" fill={rgbStr(darkTone)} />

            {/* 3D Fuselage Body (Aerodynamic Streamline) */}
            <path
              d="M 50 12 C 43 20 42 66 45 76 C 46 80 54 80 55 76 C 58 66 57 20 50 12 Z"
              fill={darkMode ? "#1e293b" : "#ffffff"}
              stroke={rgbStr(midTone, 0.4)}
              strokeWidth="0.8"
            />
            {/* Theme Livery Top Stripe */}
            <path
              d="M 50 12 C 45 22 45 52 47 76 L 53 76 C 55 52 55 22 50 12 Z"
              fill={`url(#${uid}_themePrimary)`}
              opacity="0.85"
            />

            {/* Vertical Fin / Rudder (3D Isometric Tailfin) */}
            <path
              d="M 49 60 L 51 60 L 51.5 76 L 48.5 76 Z"
              fill={rgbStr(deepShadow)}
            />
            <path
              d="M 50 52 L 49 74 L 51 74 Z"
              fill={`url(#${uid}_themePrimary)`}
            />
            <polygon
              points="49.5,50 47.5,66 50,66"
              fill={rgbStr(lightTone)}
            />

            {/* Glass Cockpit Visor with High-Gloss Specular Flash */}
            <path
              d="M 47 24 C 47 21 53 21 53 24 C 53 26 47 26 47 24 Z"
              fill="#0f172a"
            />
            <ellipse
              cx="50"
              cy="24"
              rx="2.6"
              ry="1.3"
              fill="#38bdf8"
            />
            <ellipse
              cx="49.2"
              cy="23.6"
              rx="1.2"
              ry="0.6"
              fill="#ffffff"
            />

            {/* Specular Rim Light running along top fuselage */}
            <path
              d="M 49 14 C 47.5 24 47.5 48 48 64"
              stroke="#ffffff"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity={darkMode ? "0.7" : "0.9"}
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 2. SCHEDULE / CALENDAR (Isometric 3D Flip Roster)
       * ═══════════════════════════════════════════════════════ */
      case "schedule":
      case "calendar":
        return (
          <g>
            {/* Drop Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Calendar Base Block (Thickness Layer) */}
            <path
              d="M 18 36 L 82 36 L 82 78 C 82 82 79 85 75 85 L 25 85 C 21 85 18 82 18 78 Z"
              fill={rgbStr(deepShadow)}
            />
            <path
              d="M 19 35 L 81 35 L 81 77 C 81 81 78 84 74 84 L 26 84 C 22 84 19 81 19 77 Z"
              fill={darkMode ? "#1e293b" : "#f1f5f9"}
            />

            {/* Calendar Sheets (Page Thickness Edge) */}
            <path
              d="M 20 42 L 80 42 L 80 76 C 80 79 78 81 75 81 L 25 81 C 22 81 20 79 20 76 Z"
              fill={darkMode ? "#0f172a" : "#ffffff"}
              stroke={darkMode ? "#334155" : "#e2e8f0"}
              strokeWidth="0.8"
            />

            {/* Calendar Header Top Banner (Theme Accent) */}
            <path
              d="M 18 28 C 18 24 21 21 25 21 L 75 21 C 79 21 82 24 82 28 L 82 42 L 18 42 Z"
              fill={`url(#${uid}_themePrimary)`}
            />
            {/* Glossy Reflection across Header */}
            <path
              d="M 18 28 C 18 24 21 21 25 21 L 75 21 C 79 21 82 24 82 28 L 82 31 L 18 35 Z"
              fill={`url(#${uid}_specular)`}
            />

            {/* 4 Chrome Spiral Rings at Top */}
            {[28, 42, 58, 72].map((x, i) => (
              <g key={i} transform={`translate(${x}, 16)`}>
                <rect
                  x="-2"
                  y="0"
                  width="4"
                  height="10"
                  rx="2"
                  fill={`url(#${uid}_chrome)`}
                />
                <circle cx="0" cy="8" r="1.5" fill={rgbStr(deepShadow)} />
              </g>
            ))}

            {/* Date Grid Cells (Embossed 3D Matrix) */}
            <g transform="translate(26, 48)">
              {/* Row 1 */}
              <rect x="0" y="0" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="13" y="0" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="26" y="0" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="39" y="0" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />

              {/* Row 2 */}
              <rect x="0" y="10" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              {/* Highlighted Selected Flight Date */}
              <rect
                x="13"
                y="9"
                width="10"
                height="8"
                rx="2"
                fill={`url(#${uid}_themePrimary)`}
              />
              <circle cx="18" cy="13" r="1.5" fill="#ffffff" />
              <rect x="26" y="10" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="39" y="10" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />

              {/* Row 3 */}
              <rect x="0" y="20" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="13" y="20" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="26" y="20" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
              <rect x="39" y="20" width="8" height="6" rx="1.5" fill={rgbStr(midTone, 0.25)} />
            </g>

            {/* Floating 3D Check/Star Pin in Bottom Corner */}
            <g transform="translate(64, 60)">
              <circle cx="6" cy="6" r="8" fill={`url(#${uid}_gold)`} />
              <circle cx="6" cy="6" r="6" fill={`url(#${uid}_themePrimary)`} />
              <path
                d="M 3.5 6 L 5.2 7.8 L 8.5 4.5"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 3. COMPLETED FLIGHTS / LOGBOOK SEAL (3D Flight Seal)
       * ═══════════════════════════════════════════════════════ */
      case "completed-flights":
      case "completed":
      case "check":
      case "checklist":
        return (
          <g>
            {/* Ambient Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Outer Hexagonal/Scalloped Flight Seal Bezel */}
            <circle
              cx="50"
              cy="48"
              r="34"
              fill={rgbStr(deepShadow)}
            />
            <circle
              cx="50"
              cy="47"
              r="33"
              fill={`url(#${uid}_gold)`}
            />
            {/* Inner Ring with Theme Accent */}
            <circle
              cx="50"
              cy="47"
              r="27"
              fill={darkMode ? "#0f172a" : "#ffffff"}
            />
            <circle
              cx="50"
              cy="47"
              r="24"
              fill={`url(#${uid}_emerald)`}
            />

            {/* Radial Concentric Flight Grooves */}
            <circle
              cx="50"
              cy="47"
              r="21"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeDasharray="2 3"
              opacity="0.45"
            />

            {/* 3D Floating Checkmark with Extruded Bevel */}
            {/* Shadow of checkmark */}
            <path
              d="M 36 49 L 45 58 L 65 37"
              stroke={rgbStr(emeraldDark)}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="translate(0, 3)"
            />
            {/* Main 3D checkmark */}
            <path
              d="M 36 48 L 45 57 L 65 36"
              stroke="#ffffff"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Top specular reflection on checkmark */}
            <path
              d="M 37 47 L 45 55 L 64 35"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 3D Golden Aviation Star Accent */}
            <polygon
              points="50,16 52,21 57,21 53,24 55,29 50,26 45,29 47,24 43,21 48,21"
              fill={`url(#${uid}_gold)`}
            />

            {/* Top Gloss Dome Reflection */}
            <path
              d="M 26 44 C 28 30 40 22 56 22 C 68 22 73 26 74 30 C 60 28 40 32 26 44 Z"
              fill="#ffffff"
              opacity={darkMode ? "0.25" : "0.4"}
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 4. CATERING / IN-FLIGHT DINING (3D Cloche & Platter)
       * ═══════════════════════════════════════════════════════ */
      case "catering":
      case "utensils":
      case "food":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="85"
              rx="38"
              ry="7"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Serving Platter / Tray Base (Dual-rim 3D Oval) */}
            <ellipse
              cx="50"
              cy="74"
              rx="40"
              ry="11"
              fill={rgbStr(deepShadow)}
            />
            <ellipse
              cx="50"
              cy="72"
              rx="39"
              ry="10"
              fill={`url(#${uid}_chrome)`}
            />
            <ellipse
              cx="50"
              cy="71"
              rx="34"
              ry="7.5"
              fill={darkMode ? "#1e293b" : "#ffffff"}
            />
            {/* Inner Platter Inset in Theme Accent */}
            <ellipse
              cx="50"
              cy="71"
              rx="31"
              ry="6"
              fill={`url(#${uid}_themePrimary)`}
              opacity="0.35"
            />

            {/* Cloche Dome Cover (Luxury Food Cloche) */}
            {/* Rear shadow inside */}
            <path
              d="M 24 67 C 24 40 76 40 76 67 Z"
              fill={rgbStr(deepShadow)}
            />
            {/* Main Dome Body */}
            <path
              d="M 23 66 C 23 38 77 38 77 66 Z"
              fill={`url(#${uid}_chrome)`}
            />
            {/* Theme Reflected Ring along Base */}
            <path
              d="M 23 64 C 25 61 75 61 77 64 L 77 66 C 75 69 25 69 23 66 Z"
              fill={`url(#${uid}_themePrimary)`}
            />

            {/* Top Specular Arc Curve */}
            <path
              d="M 32 58 C 32 44 48 38 60 38"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />

            {/* Cloche Top Ring Handle (3D Torus) */}
            <circle
              cx="50"
              cy="34"
              r="6.5"
              fill={`url(#${uid}_gold)`}
            />
            <circle
              cx="50"
              cy="34"
              r="3.5"
              fill={darkMode ? "#0f172a" : "#f8fafc"}
            />
            <circle
              cx="50"
              cy="39"
              r="3"
              fill={`url(#${uid}_chrome)`}
            />

            {/* First-Class Cutlery (Fork and Knife in 3D Perspective) */}
            {/* Fork on Left */}
            <g transform="translate(14, 52) rotate(-18)">
              <rect x="0" y="0" width="3" height="24" rx="1.5" fill={`url(#${uid}_chrome)`} />
              {/* Prongs */}
              <path d="M -2 0 L 5 0 L 4 7 L -1 7 Z" fill={`url(#${uid}_chrome)`} />
              <line x1="0" y1="0" x2="0" y2="5" stroke="#475569" strokeWidth="0.8" />
              <line x1="3" y1="0" x2="3" y2="5" stroke="#475569" strokeWidth="0.8" />
            </g>
            {/* Knife on Right */}
            <g transform="translate(82, 44) rotate(18)">
              <rect x="0" y="0" width="2.8" height="24" rx="1.4" fill={`url(#${uid}_chrome)`} />
              <path d="M 0 0 C 4 3 4 10 0 12 Z" fill={`url(#${uid}_chrome)`} />
            </g>

            {/* Rising Culinary Steam / Aroma Wisps */}
            <path
              d="M 44 26 C 42 22 45 19 44 15"
              stroke={rgbStr(lightTone)}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />
            <path
              d="M 50 24 C 52 20 49 17 52 13"
              stroke={rgbStr(lightTone)}
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
            <path
              d="M 56 26 C 58 22 55 19 57 15"
              stroke={rgbStr(lightTone)}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.75"
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 5. CERTIFICATES / LICENSES (3D Aviator Wings & Badge)
       * ═══════════════════════════════════════════════════════ */
      case "certificates":
      case "award":
      case "license":
      case "badge":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Suspended Lanyard Ribbon */}
            <path
              d="M 42 12 L 46 36 L 54 36 L 58 12 Z"
              fill={`url(#${uid}_themePrimary)`}
              opacity="0.8"
            />
            <line x1="50" y1="12" x2="50" y2="36" stroke="#ffffff" strokeWidth="0.8" opacity="0.4" />

            {/* Official ID Credential Card */}
            {/* Card Thickness Base */}
            <rect
              x="25"
              y="37"
              width="50"
              height="48"
              rx="6"
              fill={rgbStr(deepShadow)}
            />
            {/* Card Front Face */}
            <rect
              x="25"
              y="35"
              width="50"
              height="48"
              rx="6"
              fill={darkMode ? "#1e293b" : "#ffffff"}
              stroke={darkMode ? "#334155" : "#e2e8f0"}
              strokeWidth="1"
            />
            {/* Top Color Header Band on Card */}
            <path
              d="M 25 41 C 25 37.7 27.7 35 31 35 L 69 35 C 72.3 35 75 37.7 75 41 L 75 47 L 25 47 Z"
              fill={`url(#${uid}_themePrimary)`}
            />

            {/* ID Photo Frame Silhouette */}
            <rect
              x="30"
              y="52"
              width="14"
              height="16"
              rx="2.5"
              fill={darkMode ? "#0f172a" : "#f1f5f9"}
            />
            <circle cx="37" cy="57" r="3" fill={rgbStr(midTone)} />
            <path d="M 33 66 C 33 62 41 62 41 66 Z" fill={rgbStr(midTone)} />

            {/* Text lines on credential card */}
            <rect x="48" y="53" width="22" height="2.5" rx="1.2" fill={rgbStr(midTone, 0.4)} />
            <rect x="48" y="58" width="16" height="2" rx="1" fill={rgbStr(midTone, 0.25)} />
            <rect x="48" y="63" width="18" height="2" rx="1" fill={rgbStr(midTone, 0.25)} />

            {/* Holographic Security Stamp / Chip */}
            <rect
              x="30"
              y="72"
              width="7"
              height="6"
              rx="1.5"
              fill={`url(#${uid}_gold)`}
            />
            <circle cx="64" cy="74" r="4.5" fill={`url(#${uid}_emerald)`} />
            <path
              d="M 62 74 L 63.5 75.5 L 66 73"
              stroke="#ffffff"
              strokeWidth="1"
              strokeLinecap="round"
            />

            {/* 3D Captain Aviator Wings Floating in Front */}
            <g transform="translate(0, 5)">
              {/* Left Wing Feathers */}
              <path
                d="M 50 32 C 40 32 20 25 10 30 C 18 36 34 38 48 37 Z"
                fill={`url(#${uid}_gold)`}
              />
              <path
                d="M 50 34 C 42 34 26 31 16 35 C 24 40 38 41 48 39 Z"
                fill={rgbStr(goldDark)}
              />

              {/* Right Wing Feathers */}
              <path
                d="M 50 32 C 60 32 80 25 90 30 C 82 36 66 38 52 37 Z"
                fill={`url(#${uid}_gold)`}
              />
              <path
                d="M 50 34 C 58 34 74 31 84 35 C 76 40 62 41 52 39 Z"
                fill={rgbStr(goldDark)}
              />

              {/* Central Heraldic Aviator Shield */}
              <polygon
                points="50,25 58,29 56,41 50,47 44,41 42,29"
                fill={`url(#${uid}_themePrimary)`}
              />
              <polygon
                points="50,27 56,30 54,40 50,45 46,40 44,30"
                fill="#ffffff"
                opacity="0.3"
              />
              {/* Star inside shield */}
              <polygon
                points="50,31 51.5,34.5 55,34.5 52,36.5 53.5,40 50,38 46.5,40 48,36.5 45,34.5 48.5,34.5"
                fill={`url(#${uid}_gold)`}
              />
            </g>
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 6. FTL / CHRONOMETER (3D Cockpit Flight Duty Clock)
       * ═══════════════════════════════════════════════════════ */
      case "ftl":
      case "clock":
      case "timer":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Outer Bezel (Aircraft Cockpit Instrument Ring) */}
            <circle
              cx="50"
              cy="48"
              r="36"
              fill={rgbStr(deepShadow)}
            />
            <circle
              cx="50"
              cy="47"
              r="35"
              fill={`url(#${uid}_chrome)`}
            />
            {/* 4 Corner Screws / Bolts */}
            {[
              [24, 22],
              [76, 22],
              [24, 72],
              [76, 72],
            ].map(([bx, by], i) => (
              <g key={i}>
                <circle cx={bx} cy={by} r="2.2" fill={rgbStr(deepShadow)} />
                <circle cx={bx} cy={by - 0.5} r="1.8" fill={`url(#${uid}_chrome)`} />
                <line x1={bx - 1} y1={by - 0.5} x2={bx + 1} y2={by - 0.5} stroke="#334155" strokeWidth="0.6" />
              </g>
            ))}

            {/* Stepped Inner Dial Ring with Theme Primary Accent */}
            <circle
              cx="50"
              cy="47"
              r="30"
              fill={`url(#${uid}_themePrimary)`}
            />
            {/* Matte Black Instrument Dial Face */}
            <circle
              cx="50"
              cy="47"
              r="27"
              fill="#090d16"
            />

            {/* Radial Tachymeter / Hour Ticks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
              (deg, idx) => {
                const isMajor = idx % 3 === 0;
                return (
                  <line
                    key={deg}
                    x1="50"
                    y1={isMajor ? "23" : "24.5"}
                    x2="50"
                    y2="26"
                    stroke={isMajor ? rgbStr(lightTone) : "#64748b"}
                    strokeWidth={isMajor ? "1.8" : "1"}
                    strokeLinecap="round"
                    transform={`rotate(${deg} 50 47)`}
                  />
                );
              }
            )}

            {/* Chronograph Sub-dials (Duty & Flight Hours) */}
            <g transform="translate(50, 37)">
              <circle cx="0" cy="0" r="6" fill="#1e293b" stroke={rgbStr(midTone, 0.4)} strokeWidth="0.8" />
              <line x1="0" y1="0" x2="3" y2="-3" stroke={rgbStr(goldMid)} strokeWidth="1" strokeLinecap="round" />
            </g>
            <g transform="translate(50, 56)">
              <circle cx="0" cy="0" r="6" fill="#1e293b" stroke={rgbStr(midTone, 0.4)} strokeWidth="0.8" />
              <line x1="0" y1="0" x2="-2.5" y2="2.5" stroke={rgbStr(lightTone)} strokeWidth="1" strokeLinecap="round" />
            </g>

            {/* Main Instrument Hands (10:10 Flight Pilot Position) */}
            {/* Hour Hand */}
            <polygon
              points="48.5,47 49,34 51,34 51.5,47"
              fill="#f8fafc"
              transform="rotate(-55 50 47)"
            />
            {/* Minute Hand (Theme Accent Glow) */}
            <polygon
              points="48.8,47 49.3,26 50.7,26 51.2,47"
              fill={`url(#${uid}_themePrimary)`}
              transform="rotate(45 50 47)"
            />
            {/* Sweep Second Hand (High-visibility Orange/Red) */}
            <line
              x1="50"
              y1="54"
              x2="50"
              y2="23"
              stroke="#f97316"
              strokeWidth="1.2"
              strokeLinecap="round"
              transform="rotate(130 50 47)"
            />
            {/* Center Cap */}
            <circle cx="50" cy="47" r="3.2" fill={`url(#${uid}_chrome)`} />
            <circle cx="50" cy="47" r="1.5" fill="#f97316" />

            {/* Curved Crystal Glass Reflection Dome */}
            <path
              d="M 30 33 C 35 24 65 24 70 33 C 60 30 40 30 30 33 Z"
              fill="#ffffff"
              opacity={darkMode ? "0.35" : "0.55"}
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 7. MANUALS / FLIGHT LIBRARY (3D FCOM Flight Binder)
       * ═══════════════════════════════════════════════════════ */
      case "manuals":
      case "book":
      case "library":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Binder Back / Bottom Edge */}
            <path
              d="M 22 28 L 72 20 L 78 72 L 28 80 Z"
              fill={rgbStr(deepShadow)}
            />

            {/* Multi-layered White Page Block (Thick Operations Manual) */}
            <path
              d="M 27 27 L 71 20 L 76 68 L 32 75 Z"
              fill={darkMode ? "#334155" : "#e2e8f0"}
            />
            <path
              d="M 28 26 L 70 19 L 75 67 L 33 74 Z"
              fill={darkMode ? "#1e293b" : "#ffffff"}
            />

            {/* Protruding Colored Index Divider Tabs (QRH Quick-Access) */}
            <path d="M 70 26 L 76 25 L 75 32 L 69 33 Z" fill="#ef4444" />
            <path d="M 69 36 L 75 35 L 74 42 L 68 43 Z" fill="#f59e0b" />
            <path d="M 68 46 L 74 45 L 73 52 L 67 53 Z" fill={rgbStr(lightTone)} />

            {/* Front Binder Cover in Theme Leatherette */}
            <path
              d="M 22 24 L 68 17 L 72 69 L 26 76 Z"
              fill={`url(#${uid}_themePrimary)`}
              stroke={rgbStr(lightTone, 0.4)}
              strokeWidth="0.8"
            />
            {/* Spine Bevel Shadow */}
            <path
              d="M 22 24 L 27 23 L 31 75 L 26 76 Z"
              fill={rgbStr(darkTone)}
            />

            {/* Metallic Corner Protectors (3D Chrome Brackets) */}
            <polygon points="22,24 28,23 27,29 23,30" fill={`url(#${uid}_chrome)`} />
            <polygon points="68,17 62,18 63,24 67,23" fill={`url(#${uid}_chrome)`} />
            <polygon points="26,76 32,75 31,69 25,70" fill={`url(#${uid}_chrome)`} />
            <polygon points="72,69 66,70 67,64 73,63" fill={`url(#${uid}_chrome)`} />

            {/* Embossed Golden Aviator Wings Insignia on Cover */}
            <g transform="translate(48, 44) rotate(-8)">
              <ellipse cx="0" cy="0" rx="4" ry="4" fill={`url(#${uid}_gold)`} />
              <path
                d="M -14 -2 C -8 -4 -2 -1 0 0 C 2 -1 8 -4 14 -2 C 9 3 4 3 0 1 C -4 3 -9 3 -14 -2 Z"
                fill={`url(#${uid}_gold)`}
              />
              {/* "OPS" Text Line */}
              <rect x="-8" y="7" width="16" height="2" rx="1" fill="#ffffff" opacity="0.8" />
              <rect x="-5" y="11" width="10" height="1.6" rx="0.8" fill="#ffffff" opacity="0.6" />
            </g>

            {/* Satin Bookmark Ribbon Draped Over Edge */}
            <path
              d="M 44 19 L 46 19 L 48 84 L 45 81 L 42 84 Z"
              fill={`url(#${uid}_gold)`}
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 8. MY HOURS / CLIMB GAUGE (3D Horizon Telemetry Ascent)
       * ═══════════════════════════════════════════════════════ */
      case "hours":
      case "trending":
      case "gauge":
      case "analytics":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="36"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* 3D Tiered Pillar 1 (Left - Initial Stage) */}
            <g transform="translate(20, 48)">
              {/* Back depth */}
              <path d="M 0 12 L 12 12 L 12 34 L 0 34 Z" fill={rgbStr(deepShadow)} />
              {/* Side face */}
              <polygon points="12,12 16,8 16,30 12,34" fill={rgbStr(darkTone)} />
              {/* Top face */}
              <polygon points="0,12 4,8 16,8 12,12" fill={rgbStr(lightTone)} />
              {/* Front face */}
              <rect x="0" y="12" width="12" height="22" fill={rgbStr(midTone)} />
            </g>

            {/* 3D Tiered Pillar 2 (Center - Moderate Hours) */}
            <g transform="translate(38, 34)">
              {/* Back depth */}
              <path d="M 0 12 L 13 12 L 13 48 L 0 48 Z" fill={rgbStr(deepShadow)} />
              {/* Side face */}
              <polygon points="13,12 17,8 17,44 13,48" fill={rgbStr(secDark)} />
              {/* Top face */}
              <polygon points="0,12 4,8 17,8 13,12" fill={rgbStr(secLight)} />
              {/* Front face */}
              <rect x="0" y="12" width="13" height="36" fill={`url(#${uid}_themePrimary)`} />
            </g>

            {/* 3D Tiered Pillar 3 (Right - High Altitude Mastery) */}
            <g transform="translate(58, 20)">
              {/* Back depth */}
              <path d="M 0 12 L 14 12 L 14 62 L 0 62 Z" fill={rgbStr(deepShadow)} />
              {/* Side face */}
              <polygon points="14,12 18,8 18,58 14,62" fill={rgbStr(goldDark)} />
              {/* Top face */}
              <polygon points="0,12 4,8 18,8 14,12" fill={rgbStr(goldLight)} />
              {/* Front face */}
              <rect x="0" y="12" width="14" height="50" fill={`url(#${uid}_gold)`} />
            </g>

            {/* Soaring 3D Aerodynamic Climb Arrow */}
            {/* Shadow beneath arrow */}
            <path
              d="M 18 64 Q 44 48 76 22 L 78 30 L 86 16 L 70 17 L 74 24 Q 42 48 18 64 Z"
              fill={rgbStr(deepShadow)}
              transform="translate(1, 3)"
            />
            {/* Main 3D Arrow */}
            <path
              d="M 18 64 Q 44 48 76 22 L 78 30 L 86 16 L 70 17 L 74 24 Q 42 48 18 64 Z"
              fill={darkMode ? "#ffffff" : "#0f172a"}
            />
            {/* Arrow Bevel Top Streak in Theme Color */}
            <path
              d="M 19 63 Q 44 47 75 22 L 77 28 L 84 17 L 72 18 L 74 23 Q 43 47 19 63 Z"
              fill={`url(#${uid}_themePrimary)`}
            />

            {/* Telemetry Target Rings at Apex */}
            <circle cx="86" cy="16" r="6" fill="none" stroke={rgbStr(goldLight)} strokeWidth="1" strokeDasharray="1.5 2" />
            <circle cx="86" cy="16" r="2.5" fill="#ffffff" />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 9. LOCK / PASSWORD / SECURITY (3D Titanium Padlock)
       * ═══════════════════════════════════════════════════════ */
      case "lock":
      case "password":
      case "security":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="30"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Chrome Shackle (Curved 3D Arch) */}
            <path
              d="M 32 44 L 32 28 C 32 17 68 17 68 28 L 68 44"
              stroke={rgbStr(deepShadow)}
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
              transform="translate(0, 2)"
            />
            <path
              d="M 32 42 L 32 28 C 32 18 68 18 68 28 L 68 42"
              stroke={`url(#${uid}_chrome)`}
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
            {/* Specular highlight on shackle */}
            <path
              d="M 34 28 C 34 20 66 20 66 28"
              stroke="#ffffff"
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />

            {/* Padlock Body (3D Chamfered Block) */}
            <rect
              x="22"
              y="42"
              width="56"
              height="40"
              rx="8"
              fill={rgbStr(deepShadow)}
            />
            <rect
              x="22"
              y="40"
              width="56"
              height="40"
              rx="8"
              fill={`url(#${uid}_themePrimary)`}
            />

            {/* Front Inset Plate with High Contrast */}
            <rect
              x="26"
              y="44"
              width="48"
              height="32"
              rx="5"
              fill={darkMode ? "#0f172a" : "#ffffff"}
              opacity={darkMode ? "0.85" : "0.95"}
            />

            {/* Aviation Security Emblem / Keyhole */}
            <circle cx="50" cy="57" r="5" fill={`url(#${uid}_gold)`} />
            <polygon points="48,57 52,57 53,67 47,67" fill={`url(#${uid}_gold)`} />
            <circle cx="50" cy="57" r="2.5" fill="#090d16" />
            <polygon points="48.8,57 51.2,57 52,65 48,65" fill="#090d16" />

            {/* Top Gloss Reflection on Lock Body */}
            <path
              d="M 24 44 C 24 41 27 40 31 40 L 69 40 C 73 40 76 41 76 44 L 76 47 L 24 51 Z"
              fill={`url(#${uid}_specular)`}
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 10. BELL / NOTIFICATIONS (3D Resonant Brass Chime)
       * ═══════════════════════════════════════════════════════ */
      case "bell":
      case "notifications":
        return (
          <g transform="rotate(-8 50 50)">
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="30"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Bell Clapper Ball (Hanging Inside) */}
            <circle cx="50" cy="74" r="5" fill={`url(#${uid}_gold)`} />
            <circle cx="50" cy="74" r="2" fill={rgbStr(deepShadow)} />

            {/* Bell Flared Body */}
            {/* Shadow under rim */}
            <path
              d="M 50 20 C 38 20 30 38 28 62 L 20 68 C 18 70 20 74 24 74 L 76 74 C 80 74 82 70 80 68 L 72 62 C 70 38 62 20 50 20 Z"
              fill={rgbStr(deepShadow)}
              transform="translate(0, 2)"
            />
            {/* Main Bell Body in Theme Accent + Gold Luster */}
            <path
              d="M 50 20 C 38 20 30 38 28 62 L 20 68 C 18 70 20 74 24 74 L 76 74 C 80 74 82 70 80 68 L 72 62 C 70 38 62 20 50 20 Z"
              fill={`url(#${uid}_gold)`}
            />
            {/* Inner Theme Glow Layer */}
            <path
              d="M 50 22 C 40 22 34 38 32 60 L 26 66 L 74 66 L 68 60 C 66 38 60 22 50 22 Z"
              fill={`url(#${uid}_themePrimary)`}
              opacity="0.35"
            />

            {/* Top Crown Ring */}
            <circle cx="50" cy="18" r="4.5" fill={`url(#${uid}_gold)`} />
            <circle cx="50" cy="18" r="2.2" fill={darkMode ? "#0f172a" : "#ffffff"} />

            {/* Specular Highlight along Left Contour */}
            <path
              d="M 46 24 C 36 28 32 44 30 62"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />

            {/* Acoustic Soundwave Ripples */}
            <path
              d="M 80 34 C 86 42 86 52 80 60"
              stroke={rgbStr(lightTone)}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.8"
            />
            <path
              d="M 87 28 C 95 40 95 58 87 70"
              stroke={rgbStr(lightTone)}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * 11. USER / PILOT (3D Captain's Peaked Visor Cap)
       * ═══════════════════════════════════════════════════════ */
      case "user":
      case "pilot":
      case "profile":
        return (
          <g>
            {/* Ground Shadow */}
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />

            {/* Cap Crown / Dome (Crisp Uniform White/Navy) */}
            <path
              d="M 22 50 C 18 36 28 22 50 22 C 72 22 82 36 78 50 Z"
              fill={darkMode ? "#1e293b" : "#ffffff"}
              stroke={darkMode ? "#334155" : "#cbd5e1"}
              strokeWidth="1"
            />

            {/* Black Velvet Headband Base */}
            <path
              d="M 18 52 C 26 48 74 48 82 52 L 84 62 C 74 66 26 66 16 62 Z"
              fill="#090d16"
            />

            {/* Gold Visor Cord / Braided Strap */}
            <path
              d="M 18 56 C 28 53 72 53 82 56"
              stroke={`url(#${uid}_gold)`}
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="2.5 1.5"
            />
            {/* Side Brass Buttons */}
            <circle cx="18" cy="56" r="2.5" fill={`url(#${uid}_gold)`} />
            <circle cx="82" cy="56" r="2.5" fill={`url(#${uid}_gold)`} />

            {/* Glossy Black Patent Leather Visor / Peak */}
            <path
              d="M 14 62 C 26 76 74 76 86 62 C 76 82 24 82 14 62 Z"
              fill="#090d16"
            />
            {/* High-Gloss Specular Streak across Visor */}
            <path
              d="M 24 67 C 36 74 64 74 76 67"
              stroke="#ffffff"
              strokeWidth="1.8"
              fill="none"
              opacity="0.6"
            />

            {/* Gold Embroidered Oak Leaves ("Scrambled Eggs") on Visor */}
            <path
              d="M 26 70 Q 32 74 38 73 M 42 74 Q 50 76 58 74 M 62 73 Q 68 74 74 70"
              stroke={`url(#${uid}_gold)`}
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Winged Gold Crest / Cap Badge */}
            <polygon
              points="50,30 54,34 53,44 50,47 47,44 46,34"
              fill={`url(#${uid}_gold)`}
            />
            {/* Wings on cap badge */}
            <path
              d="M 50 36 C 42 34 36 32 32 34 C 36 39 44 41 50 40 Z"
              fill={`url(#${uid}_gold)`}
            />
            <path
              d="M 50 36 C 58 34 64 32 68 34 C 64 39 56 41 50 40 Z"
              fill={`url(#${uid}_gold)`}
            />
            {/* Center Anchor / Propeller Star */}
            <circle cx="50" cy="38" r="2.5" fill={`url(#${uid}_themePrimary)`} />
            <circle cx="50" cy="38" r="1.2" fill="#ffffff" />
          </g>
        );

      /* ═══════════════════════════════════════════════════════
       * DEFAULT / HOME (3D Airport Terminal Radar Base)
       * ═══════════════════════════════════════════════════════ */
      default:
        return (
          <g>
            <ellipse
              cx="50"
              cy="86"
              rx="34"
              ry="6"
              fill={`url(#${uid}_floorShadow)`}
            />
            <path
              d="M 50 16 L 82 40 L 82 76 C 82 80 79 84 75 84 L 25 84 C 21 84 18 80 18 76 L 18 40 Z"
              fill={`url(#${uid}_themePrimary)`}
            />
            <polygon
              points="50,14 84,39 80,43 50,19 20,43 16,39"
              fill={`url(#${uid}_chrome)`}
            />
            {/* Doorway / Hangar Gate */}
            <path
              d="M 38 84 L 38 56 C 38 52 42 48 50 48 C 58 48 62 52 62 56 L 62 84 Z"
              fill={darkMode ? "#0f172a" : "#ffffff"}
            />
          </g>
        );
    }
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none relative ${
        interactive ? "transition-all duration-300 hover:scale-105" : ""
      } ${className}`}
      style={{
        width: pxSize,
        height: pxSize,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={pxSize}
        height={pxSize}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {defs}
        {renderIconContent()}
      </svg>
    </div>
  );
}

export default ThreeDIcon;
