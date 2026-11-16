/* ═══════════════════════════════════════════════════════════
 * ALERTS ENGINE
 * Computes expiring documents alerts for crew + users + fleet + CAMO
 * v2.1 — Includes CAMO statutory certificates (COA, Insurance, Noise)
 * ═══════════════════════════════════════════════════════════ */
import { daysUntil } from "./helpers";
import { safeArray } from "./safe";

const LOCAL_DISMISSED_ALERTS_KEY = "aeroops.locallyDismissedAlerts";
export const ALERTS_DISMISSED_EVENT = "aeroops:alerts-dismissed-changed";

export function readLocallyDismissedAlerts() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DISMISSED_ALERTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

export function writeLocallyDismissedAlerts(keys = []) {
  const unique = Array.from(new Set((keys || []).filter(Boolean).map(String)));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCAL_DISMISSED_ALERTS_KEY, JSON.stringify(unique));
    } catch {}
    window.dispatchEvent(new CustomEvent(ALERTS_DISMISSED_EVENT, { detail: unique }));
  }
  return unique;
}

export function dismissAlertsLocally(keysToAdd) {
  const list = Array.isArray(keysToAdd) ? keysToAdd : [keysToAdd];
  return writeLocallyDismissedAlerts([...readLocallyDismissedAlerts(), ...list]);
}

export function undismissAlertLocally(keyToRemove) {
  if (!keyToRemove) return readLocallyDismissedAlerts();
  return writeLocallyDismissedAlerts(
    readLocallyDismissedAlerts().filter((k) => String(k) !== String(keyToRemove))
  );
}

export function computeAlerts(crew = [], users = [], fleet = []) {
  const alerts = [];

  const scan = (item, source, itemIdx = 0) => {
    const itemKeyBase =
      item.reg || item.id || item.empNo || item.fullName || item.name || `idx_${itemIdx}`;

    const checks = [
      { k: "medicalExpiry", label: "Medical" },
      { k: "licenseExpiry", label: "License" },
      { k: "passportExpiry", label: "Passport" },
      { k: "nextCheck", label: "Next Check" },
      { k: "coaExpiry", label: "C of A" },
      { k: "insuranceExpiry", label: "Insurance" },
      { k: "noiseCertExpiry", label: "Noise Cert" },
    ];

    checks.forEach(({ k, label }) => {
      const v = item[k];
      if (!v) return;

      const d = daysUntil(v);
      let sev = null;
      if (d < 0) sev = "expired";
      else if (d <= 15) sev = "critical";
      else if (d <= 60) sev = "expiring";

      if (sev) {
        alerts.push({
          key: `${source}_${itemKeyBase}_${k}`,
          sev,
          subject: item.fullName || item.reg || item.name || "—",
          source,
          label,
          expiry: v,
          days: d,
        });
      }
    });

    const attachments = safeArray(item.attachments);
    attachments.forEach((a, idx) => {
      if (!a || !a.expiry) return;

      const d = daysUntil(a.expiry);
      let sev = null;
      if (d < 0) sev = "expired";
      else if (d <= 15) sev = "critical";
      else if (d <= 60) sev = "expiring";

      if (sev) {
        alerts.push({
          key: `${source}_${itemKeyBase}_att_${a.id || idx}`,
          sev,
          subject: item.fullName || item.reg || item.name || "—",
          source,
          label: a.name || "Attachment",
          expiry: a.expiry,
          days: d,
        });
      }
    });
  };

  safeArray(crew).forEach((c, idx) => scan(c, "crew", idx));
  safeArray(users).forEach((u, idx) => scan(u, "user", idx));
  safeArray(fleet).forEach((a, idx) => scan(a, "aircraft", idx));

  return alerts.sort((a, b) => a.days - b.days);
}
