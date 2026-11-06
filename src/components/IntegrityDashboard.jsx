import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Plane, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { normalizeReg } from "../utils/fleetCamoSync";
import { showToast } from "../utils/dialog";

export function IntegrityDashboard({ fleet, camoList, syncAll, setSyncStatus }) {
  const discrepancies = useMemo(() => {
    const fleetMap = new Map(fleet.map(f => [normalizeReg(f.reg), f]));
    const camoMap = new Map(camoList.map(c => [normalizeReg(c.reg), c]));
    
    const issues = [];
    const allRegs = new Set([...fleetMap.keys(), ...camoMap.keys()]);

    allRegs.forEach(reg => {
      const f = fleetMap.get(reg);
      const c = camoMap.get(reg);

      if (!f) {
        issues.push({
          reg,
          type: "MISSING_FLEET",
          severity: "warning",
          msg: "الطائرة مسجلة في سجلات صيانة CAMO ولكنها غير موجودة في قائمة الأسطول الرئيسية (Fleet Master List)",
        });
      } else if (!c) {
        issues.push({
          reg,
          type: "MISSING_CAMO",
          severity: "warning",
          msg: "الطائرة موجودة في قائمة الأسطول الرئيسية ولكنها مفقودة من سجلات صيانة CAMO",
        });
      } else {
        // Compare fields
        if (f.type && c.type && f.type !== c.type) {
          issues.push({
            reg,
            type: "MISMATCH_TYPE",
            severity: "error",
            msg: `اختلاف في الطراز (Type): الأسطول (${f.type}) مقابل CAMO (${c.type})`,
          });
        }
        if (f.tah !== undefined && c.tah !== undefined && f.tah !== c.tah) {
          issues.push({
            reg,
            type: "MISMATCH_TAH",
            severity: "info",
            msg: `اختلاف في ساعات الطائرة TAH: الأسطول (${f.tah}) مقابل CAMO (${c.tah})`,
          });
        }
        if (f.tac !== undefined && c.tac !== undefined && f.tac !== c.tac) {
          issues.push({
            reg,
            type: "MISMATCH_TAC",
            severity: "info",
            msg: `اختلاف في دورات الطائرة TAC: الأسطول (${f.tac}) مقابل CAMO (${c.tac})`,
          });
        }
        if (f.status && c.status && f.status !== c.status) {
          issues.push({
            reg,
            type: "MISMATCH_STATUS",
            severity: "warning",
            msg: `اختلاف في الحالة التشغيلية: الأسطول (${f.status}) مقابل CAMO (${c.status})`,
          });
        }
      }
    });
    return issues;
  }, [fleet, camoList]);

  return (
    <div className="space-y-4">
      <div
        className="p-5 rounded-xl border shadow-sm"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3
              className="text-base font-bold flex items-center gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>لوحة سلامة وبيانات المطابقة (Integrity Dashboard)</span>
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              مقارنة تلقائية وفورية بين قائمة الأسطول الرئيسية (Fleet Master List) وسجلات الصيانة المستمرة (CAMO) لضمان مطابقة بيانات الطائرات.
            </p>
          </div>
          {discrepancies.length > 0 && (
            <button
              onClick={syncAll}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow transition hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              <RefreshCw className="w-4 h-4" />
              <span>إصلاح ومزامنة فورية (One-Click Reconcile)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>إجمالي الطائرات المقارنة</div>
            <div className="text-lg font-bold font-mono mt-1" style={{ color: "var(--text-primary)" }}>
              {new Set([...fleet.map(f => normalizeReg(f.reg)), ...camoList.map(c => normalizeReg(c.reg))]).size}
            </div>
          </div>
          <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>حالة التطابق</div>
            <div className={`text-lg font-bold font-mono mt-1 ${discrepancies.length === 0 ? "text-emerald-500" : "text-amber-500"}`}>
              {discrepancies.length === 0 ? "100% متطابق" : `${discrepancies.length} تعارضات مكتشفة`}
            </div>
          </div>
          <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>وضع المزامنة ثنائية الاتجاه</div>
            <div className="text-sm font-bold text-emerald-500 mt-1 flex items-center gap-1">
              <ArrowRightLeft className="w-4 h-4" /> نشط وآمن (Bidirectional)
            </div>
          </div>
        </div>

        {discrepancies.length === 0 ? (
          <div
            className="flex items-center gap-3 p-4 rounded-xl border text-emerald-600 dark:text-emerald-400 font-bold text-sm"
            style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <div>جميع بيانات الأسطول وسجلات صيانة CAMO متطابقة تماماً.</div>
              <div className="text-xs font-normal opacity-80 mt-0.5">لا توجد أي فجوات أو تباينات في سجلات الطائرات أو ساعات التشغيل.</div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              التعارضات والفجوات المكتشفة ({discrepancies.length}):
            </div>
            {discrepancies.map((d, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border-default)" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        {d.reg}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-500">
                        {d.type}
                      </span>
                    </div>
                    <div className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {d.msg}
                    </div>
                  </div>
                </div>

                <button
                  onClick={syncAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/25 flex items-center gap-1.5 self-end sm:self-center transition whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>مزامنة وإصلاح</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default IntegrityDashboard;
