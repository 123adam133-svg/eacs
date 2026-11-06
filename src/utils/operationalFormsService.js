/* ═══════════════════════════════════════════════════════════
 * OPERATIONAL FORMS SERVICE — النماذج التشغيلية المربوطة بالرحلات
 * Persists operational templates (HTML & PDF) locally with
 * optional Google Sheets sync ("OperationalForms"), and exposes
 * active templates to FlightContextMenu on ScheduleBoard.
 * ═══════════════════════════════════════════════════════════ */
import { operationalFormsAPI } from "../api";
import { recognizeHtmlTemplateFields } from "./htmlTemplateEngine";

const STORAGE_KEY = "aeroops.operational_forms_v1";
const SEEDED_KEY = "aeroops.operational_forms_seeded_v1";

const DEFAULT_HANDLING_HTML = `<div style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;color:#0f172a;padding:8px;">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px;">
    <div>
      <div style="font-size:16px;font-weight:800;">{{operatorName}} ({{operatorCode}})</div>
      <div style="font-size:13px;color:#475569;">{{operatorNameAr}}</div>
    </div>
    <div style="text-align:left;direction:ltr;font-family:monospace;font-size:12px;">
      <div><b>DATE:</b> {{date}}</div>
      <div><b>REF:</b> GHR-{{flightNo}}</div>
    </div>
  </div>

  <div style="background:#f1f5f9;border:1px solid #334155;padding:8px 12px;text-align:center;font-weight:800;font-size:14px;margin-bottom:14px;">
    نموذج طلب خدمات مناولة أرضية / GROUND HANDLING REQUEST
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px;">
    <tbody>
      <tr>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;width:22%;">رقم الرحلة / Flight No</td>
        <td style="border:1px solid #334155;padding:6px 10px;font-family:monospace;font-weight:700;width:28%;">{{flightNo}}</td>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;width:22%;">تسجيل الطائرة / Reg</td>
        <td style="border:1px solid #334155;padding:6px 10px;font-family:monospace;font-weight:700;width:28%;">{{aircraft}} ({{aircraftType}})</td>
      </tr>
      <tr>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">مطار المغادرة / ADEP</td>
        <td style="border:1px solid #334155;padding:6px 10px;font-family:monospace;">{{departure}} — {{std}}</td>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">مطار الوصول / ADES</td>
        <td style="border:1px solid #334155;padding:6px 10px;font-family:monospace;">{{arrival}} — {{sta}}</td>
      </tr>
      <tr>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">قائد الطائرة / PIC</td>
        <td style="border:1px solid #334155;padding:6px 10px;">{{picName}}</td>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">الركاب والشحن / Load</td>
        <td style="border:1px solid #334155;padding:6px 10px;font-family:monospace;">PAX: {{pax}} | Cargo: {{cargo}} kg</td>
      </tr>
      <tr>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">وكيل المناولة / Handler</td>
        <td style="border:1px solid #334155;padding:6px 10px;">{{handlingAgent}}</td>
        <td style="border:1px solid #334155;background:#f8fafc;padding:6px 10px;font-weight:700;">الغرض / Purpose</td>
        <td style="border:1px solid #334155;padding:6px 10px;">{{purpose}}</td>
      </tr>
    </tbody>
  </table>

  <div style="font-weight:700;font-size:12px;margin:10px 0 4px;">جدول القطاعات / Flight Sectors:</div>
  <div>{{sectorsTableHtml}}</div>

  <div style="font-weight:700;font-size:12px;margin:12px 0 4px;">كشف الطاقم / Crew Manifest:</div>
  <div>{{crewTableHtml}}</div>

  <div style="margin-top:14px;border:1px solid #334155;padding:8px 10px;font-size:12px;">
    <b>الخدمات الأرضية المطلوبة / Requested Services:</b> GPU · Fueling · Ramp Handling · Crew Transport · VIP/PAX Assistance
  </div>

  <div style="display:flex;justify-content:space-between;margin-top:20px;font-size:11px;color:#334155;">
    <div>أُعد بواسطة / Prepared By: <b>{{preparedBy}}</b></div>
    <div>هاتف العمليات / Ops Tel: <span style="font-family:monospace;">{{phone}}</span> | <span style="font-family:monospace;">{{email}}</span></div>
  </div>
</div>`;

function ensureSeededForms() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    if (!localStorage.getItem(SEEDED_KEY)) {
      const { annotatedHtml, fields } = recognizeHtmlTemplateFields(DEFAULT_HANDLING_HTML);
      const starter = [
        {
          id: "form_ground_handling_starter",
          name: "طلب مناولة أرضية (Handling)",
          category: "Ground Ops",
          format: "html",
          htmlContent: annotatedHtml,
          fields,
          attachments: [],
          showInContextMenu: true,
          notes: "نموذج تشغيلي جاهز مربوط تلقائياً ببيانات الرحلة والقطاعات والطاقم",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starter));
      localStorage.setItem(SEEDED_KEY, "1");
      return starter;
    }
  } catch (e) {
    console.warn("Operational forms storage read warning:", e);
  }
  return [];
}

function writeLocalForms(list) {
  const safe = Array.isArray(list) ? list : [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    localStorage.setItem(SEEDED_KEY, "1");
    window.dispatchEvent(new CustomEvent("aeroops:forms-updated", { detail: safe }));
  } catch (e) {
    console.warn("Operational forms storage write warning:", e);
  }
  return safe;
}

export function listOperationalFormsSync() {
  return ensureSeededForms();
}

export function getContextMenuFormsSync() {
  return ensureSeededForms().filter((f) => f && f.showInContextMenu !== false && f.name);
}

export async function fetchOperationalForms() {
  const local = ensureSeededForms();
  try {
    const remote = await operationalFormsAPI.list();
    if (Array.isArray(remote) && remote.length > 0) {
      const localMap = new Map(local.map((l) => [String(l.id), l]));
      const healedRemote = remote.map((r) => {
        const loc = localMap.get(String(r.id));
        if (!loc) return r;
        const rAtts = Array.isArray(r.attachments) ? r.attachments : [];
        const lAtts = Array.isArray(loc.attachments) ? loc.attachments : [];
        const fixedAtts = rAtts.map((att, idx) => {
          if (
            (!att.url || att.url === "[Data URL - Local Only]") &&
            lAtts[idx]?.url &&
            lAtts[idx].url !== "[Data URL - Local Only]"
          ) {
            return { ...att, url: lAtts[idx].url };
          }
          return att;
        });
        return {
          ...r,
          htmlContent: r.htmlContent || loc.htmlContent || "",
          attachments: fixedAtts.length > 0 ? fixedAtts : lAtts,
        };
      });

      const remoteIds = new Set(healedRemote.map((r) => String(r.id)));
      const merged = [
        ...healedRemote,
        ...local.filter(
          (l) =>
            !remoteIds.has(String(l.id)) &&
            l.id !== "form_ground_handling_starter"
        ),
      ];
      return writeLocalForms(merged);
    }
  } catch (err) {
    console.warn("OperationalForms fetch warning:", err?.message || err);
  }
  return local;
}

export async function saveOperationalForm(draft) {
  const current = ensureSeededForms();
  const isNew = !draft.id || !current.some((x) => String(x.id) === String(draft.id));
  const id = draft.id || `opform_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const record = {
    ...draft,
    id,
    name: String(draft.name || "").trim(),
    category: draft.category || "Operations",
    format: draft.format || "html",
    htmlContent: draft.htmlContent || "",
    fields: Array.isArray(draft.fields) ? draft.fields : [],
    attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
    showInContextMenu: draft.showInContextMenu !== false,
    notes: draft.notes || "",
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Sync to Google Sheets ("OperationalForms") with local fallback
  try {
    if (isNew) {
      const created = await operationalFormsAPI.create(record);
      if (created?.id) record.id = created.id;
    } else {
      await operationalFormsAPI.update(record.id, record);
    }
  } catch (err) {
    console.warn("OperationalForms Sheet sync warning:", err?.message || err);
  }

  const next = isNew
    ? [...current, record]
    : current.map((x) => (String(x.id) === String(draft.id) ? record : x));

  writeLocalForms(next);
  return record;
}

export async function deleteOperationalForm(id) {
  const current = ensureSeededForms();
  const next = current.filter((x) => String(x.id) !== String(id));
  writeLocalForms(next);
  try {
    await operationalFormsAPI.remove(id).catch(() => null);
  } catch {
    // Ignore remote error if sheet isn't created
  }
  return next;
}
