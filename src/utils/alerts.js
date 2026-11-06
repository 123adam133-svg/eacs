/* ═══════════════════════════════════════════════════════════
 * ALERTS ENGINE
 * Computes expiring documents alerts for crew + users + fleet + CAMO
 * v2.1 — Includes CAMO statutory certificates (COA, Insurance, Noise)
 * ═══════════════════════════════════════════════════════════ */
import { daysUntil } from "./helpers";
import { safeArray } from "./safe";

export function computeAlerts(crew = [], users = [], fleet = []) {
  const alerts = [];

  const scan = (item, source) => {
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
          key: `${source}_${item.reg || item.id}_${k}`,
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
          key: `${source}_${item.reg || item.id}_att_${a.id || idx}`,
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

  safeArray(crew).forEach((c) => scan(c, "crew"));
  safeArray(users).forEach((u) => scan(u, "user"));
  safeArray(fleet).forEach((a) => scan(a, "aircraft"));

  return alerts.sort((a, b) => a.days - b.days);
}
