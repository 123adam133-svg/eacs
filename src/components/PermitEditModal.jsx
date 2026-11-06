/* ═══════════════════════════════════════════════════════════
 * PERMIT EDIT MODAL — v1.1
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";

export function PermitEditModal({ permit, flight, user, onClose, onSave }) {
  const [draft, setDraft] = useState({
    ...permit,
    permitNo: permit.permitNo || "",
    issuedDate: permit.issuedDate || "",
    expiryDate: permit.expiryDate || "",
    issuedBy: permit.issuedBy || "",
    status: permit.status || "DRAFT",
    notes: permit.notes || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.permitNo) return showToast("⚠️ أدخل رقم التصريح");
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex justify-between items-center p-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Edit Permit — {permit.country}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {permit.permitType} · {flight?.flightNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30">
            <h4
              className="text-sm font-bold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              📋 Permit Data
            </h4>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Permit No *">
                <Input
                  value={draft.permitNo}
                  onChange={(e) =>
                    setDraft({ ...draft, permitNo: e.target.value })
                  }
                  placeholder="LBY-2026-001"
                />
              </Field>
              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FINAL">FINAL</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                </Select>
              </Field>
              <Field label="Issued Date">
                <Input
                  type="date"
                  value={draft.issuedDate}
                  onChange={(e) =>
                    setDraft({ ...draft, issuedDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Expiry Date">
                <Input
                  type="date"
                  value={draft.expiryDate}
                  onChange={(e) =>
                    setDraft({ ...draft, expiryDate: e.target.value })
                  }
                />
              </Field>
              <Field label="Issued By">
                <Input
                  value={draft.issuedBy}
                  onChange={(e) =>
                    setDraft({ ...draft, issuedBy: e.target.value })
                  }
                  placeholder="Libyan CAA"
                />
              </Field>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <h4
              className="text-sm font-bold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              ✈️ Flight Data (Auto-filled)
            </h4>
            <div
              className="text-xs space-y-1"
              style={{ color: "var(--text-muted)" }}
            >
              <div>
                <b>Flight:</b> {flight?.flightNo || "—"}
              </div>
              <div>
                <b>Aircraft:</b> {flight?.acft || "—"}
              </div>
              <div>
                <b>Route:</b> {flight?.dep} → {flight?.arr}
              </div>
              <div>
                <b>STD:</b>{" "}
                {flight?.std ? String(flight.std).slice(11, 16) : "—"} UTC
              </div>
              <div>
                <b>STA:</b>{" "}
                {flight?.sta ? String(flight.sta).slice(11, 16) : "—"} UTC
              </div>
            </div>
          </div>

          <Field label="Notes">
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
                backgroundColor: "var(--bg-app)",
              }}
            />
          </Field>
        </div>

        <div
          className="p-4 border-t flex justify-end gap-2"
          style={{ borderColor: "var(--border-default)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold border"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-muted)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-50"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermitEditModal;
