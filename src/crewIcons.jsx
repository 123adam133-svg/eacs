/* ═══════════════════════════════════════════════════════════
 * crewIcons.jsx — 36 Custom SVG Icons
 * ═══════════════════════════════════════════════════════════ */
import React from "react";

/* ⭐ Base SVG wrapper */
const S = ({ className = "w-4 h-4", children, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

/* 1 */
export const CrewTableIcon = (p) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="14" x2="21" y2="14" />
    <line x1="3" y1="19" x2="21" y2="19" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <circle cx="6" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </S>
);

/* 2 */
export const CrewTableIconFilled = ({ className = "w-4 h-4", ...p }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} {...p}>
    <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v3h16V5H4zm0 5v3h6v-3H4zm8 0v3h8v-3h-8zm-8 5v4h6v-4H4zm8 0v4h8v-4h-8z" />
  </svg>
);

/* 3 */
export const CrewRosterIcon = (p) => (
  <S {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M2.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <line x1="16" y1="7" x2="22" y2="7" />
    <line x1="16" y1="11" x2="22" y2="11" />
    <line x1="16" y1="15" x2="22" y2="15" />
    <line x1="16" y1="19" x2="22" y2="19" />
  </S>
);

/* 4 */
export const CrewRosterPublishedIcon = (p) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <path d="M13 15l2 2 4-4" />
  </S>
);

/* 5 */
export const CrewAssignmentIcon = (p) => (
  <S {...p}>
    <rect x="3" y="4" width="12" height="16" rx="2" />
    <line x1="3" y1="9" x2="15" y2="9" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <path d="M16 14l2 2 4-4" />
  </S>
);

/* 6 */
export const CrewRestIcon = (p) => (
  <S {...p}>
    <path d="M4 16v-4a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4" />
    <line x1="2" y1="16" x2="22" y2="16" />
    <line x1="4" y1="16" x2="4" y2="19" />
    <line x1="20" y1="16" x2="20" y2="19" />
    <circle cx="7" cy="11" r="1.2" />
  </S>
);

/* 7 */
export const CrewFTLIcon = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 6v6l3.5 2" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
  </S>
);

/* 8 */
export const CrewBlockHoursIcon = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <path d="M17 3l2 2-2 2" />
    <path d="M7 21l-2-2 2-2" />
  </S>
);

/* 9 */
export const CrewQualifiedIcon = (p) => (
  <S {...p}>
    <circle cx="12" cy="9" r="4" />
    <path d="M8 12l-2 9 6-3 6 3-2-9" />
    <path d="M10.5 8.5l1.2 1.2 2.3-2.3" />
  </S>
);

/* 10 */
export const CrewRankIcon = (p) => (
  <S {...p}>
    <path d="M4 8l4 3 4-6 4 6 4-3-2 10H6L4 8z" />
  </S>
);

/* 11 */
export const CrewExperienceIcon = (p) => (
  <S {...p}>
    <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z" />
  </S>
);

/* 12 */
export const CrewScheduleIcon = (p) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="16" y1="3" x2="16" y2="7" />
  </S>
);

/* 13 */
export const CrewRotationIcon = (p) => (
  <S {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <polyline points="21,3 21,9 15,9" />
  </S>
);

/* 14 */
export const CrewPairingIcon = (p) => (
  <S {...p}>
    <circle cx="9" cy="12" r="5" />
    <circle cx="15" cy="12" r="5" />
    <path d="M12 8v8" />
  </S>
);

/* 15 */
export const CrewSwapIcon = (p) => (
  <S {...p}>
    <path d="M4 8h12l-3-3M20 16H8l3 3" />
  </S>
);

/* 16 */
export const CrewLeaveIcon = (p) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <line x1="3" y1="11" x2="21" y2="11" />
    <line x1="8" y1="4" x2="8" y2="8" />
    <line x1="16" y1="4" x2="16" y2="8" />
    <path d="M9 15l2 2 4-4" />
  </S>
);

/* 17 */
export const CrewDutyIcon = (p) => (
  <S {...p}>
    <path d="M5 8h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4v-5a2 2 0 0 1 1-1z" />
    <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </S>
);

/* 18 */
export const CrewTimeOffIcon = (p) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="14" rx="2" />
    <line x1="3" y1="11" x2="21" y2="11" />
    <line x1="8" y1="3" x2="8" y2="8" />
    <line x1="16" y1="3" x2="16" y2="8" />
    <path d="M9 16h6" />
  </S>
);

/* 19 */
export const CrewMedicalLeaveIcon = (p) => (
  <S {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M12 11v5M9.5 13.5h5" />
  </S>
);

/* 20 */
export const CrewTrainingIcon = (p) => (
  <S {...p}>
    <path d="M2 12l10-5 10 5-10 5L2 12z" />
    <path d="M6 14v4c0 1 3 3 6 3s6-2 6-3v-4" />
    <line x1="22" y1="12" x2="22" y2="18" />
  </S>
);

/* 21 */
export const CrewSimulatorIcon = (p) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M7 20h10" />
    <path d="M12 16v4" />
    <circle cx="12" cy="10" r="2.5" />
  </S>
);

/* 22 */
export const CrewIDCardIcon = (p) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8" cy="11" r="2" />
    <path d="M5.5 16c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5" />
    <line x1="14" y1="10" x2="18" y2="10" />
    <line x1="14" y1="13" x2="18" y2="13" />
    <line x1="14" y1="16" x2="17" y2="16" />
  </S>
);

/* 23 */
export const CrewMedicalIcon = (p) => (
  <S {...p}>
    <path d="M12 21s-7-4.5-7-11a5 5 0 0 1 9.9-1.2A5 5 0 0 1 19 10c0 6.5-7 11-7 11z" />
    <path d="M12 10v3M10.5 11.5h3" />
  </S>
);

/* 24 */
export const CrewLicenseIcon = (p) => (
  <S {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <circle cx="12" cy="9" r="2.5" />
    <path d="M8.5 15.5c0-1.7 1.6-3 3.5-3s3.5 1.3 3.5 3" />
    <line x1="8" y1="18" x2="16" y2="18" />
  </S>
);

/* 25 */
export const CrewEditorIcon = (p) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6 1.1 0 2.1.3 3 .9" />
    <path d="M15 19l5-5-2-2-5 5v2h2z" />
  </S>
);

/* 26 */
export const CrewLinkIcon = (p) => (
  <S {...p}>
    <circle cx="8" cy="9" r="3" />
    <circle cx="16" cy="9" r="3" />
    <path d="M3 20c0-2.8 2.2-5 5-5" />
    <path d="M21 20c0-2.8-2.2-5-5-5" />
    <line x1="11" y1="9" x2="13" y2="9" />
  </S>
);

/* 27 */
export const CrewMultiIcon = (p) => (
  <S {...p}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="16" cy="8" r="3" />
    <path d="M2.5 20c0-3 2.5-5 5.5-5" />
    <path d="M21.5 20c0-3-2.5-5-5.5-5" />
    <circle cx="12" cy="16" r="2.5" />
  </S>
);

/* 28 */
export const CrewCopyIcon = (p) => (
  <S {...p}>
    <rect x="8" y="3" width="12" height="14" rx="2" />
    <path d="M4 7h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
  </S>
);

/* 29 */
export const CrewNightLandingIcon = (p) => (
  <S {...p}>
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
    <path d="M6 19l3-1 4 2 3-1" />
  </S>
);

/* 30 */
export const CrewStandbyIcon = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <path d="M4.5 4.5l2 2M19.5 4.5l-2 2" />
  </S>
);

/* 31 */
export const CrewLayoverIcon = (p) => (
  <S {...p}>
    <path d="M3 12h18" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="12" r="2" />
  </S>
);

/* 32 */
export const CrewCheckInIcon = (p) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M8 12l3 3 5-6" />
    <line x1="3" y1="8" x2="21" y2="8" />
  </S>
);

/* 33 */
export const CrewCheckOutIcon = (p) => (
  <S {...p}>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10,17 15,12 10,7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </S>
);

/* 34 */
export const CrewAircraftIcon = (p) => (
  <S {...p}>
    <path d="M2 16l20-6-20-6 3 6-3 6z" />
    <circle cx="16" cy="19" r="2" />
    <circle cx="8" cy="19" r="1.5" />
  </S>
);

/* 35 */
export const CrewReserveIcon = (p) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M17 8l2 2 3-3" />
  </S>
);

/* 36 */
export const CrewWarningIcon = (p) => (
  <S {...p}>
    <path d="M12 3l9 16H3l9-16z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
  </S>
);
