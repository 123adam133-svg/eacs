import React from "react";
import { toDisplayImageUrl } from "../api";

/**
 * ReportHeader — Standard header for all printed/previewed reports
 * Renders logo + System Arabic Name + System English Name + Operator Code under the logo
 */
export function ReportHeader({
  settings = {},
  title,
  subtitle,
  issueDate,
  className = "",
  showOperatorCode = true,
}) {
  const logoUrl = toDisplayImageUrl(settings?.logo);
  const companyNameEn = settings?.companyName || "Flight Operations";
  const companyNameAr = settings?.companyNameAr || "نظام إدارة العمليات الجوية";
  const country = settings?.country || "";

  return (
    <div className={`report-header-block border-b-2 border-slate-300 dark:border-slate-700 pb-4 mb-4 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo & System Names */}
        <div className="flex items-center gap-3.5 text-center sm:text-start">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="System Logo"
              className="h-16 max-w-[180px] object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-slate-800 flex items-center justify-center text-white font-bold text-2xl shrink-0 shadow-sm">
              ✈️
            </div>
          )}
          <div className="space-y-0.5">
            {/* Arabic Name under Logo */}
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {companyNameAr}
            </div>
            {/* English Name under Logo */}
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 font-mono tracking-wide leading-snug">
              {companyNameEn}
            </div>
            {/* Country */}
            {showOperatorCode && country && (
              <div className="flex items-center justify-center sm:justify-start gap-2 text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-400 tracking-wider pt-0.5">
                <span>{country}</span>
              </div>
            )}
          </div>
        </div>

        {/* Issue Date Box */}
        {issueDate && (
          <div className="border-2 border-slate-300 dark:border-slate-600 rounded-lg px-3.5 py-1.5 text-center bg-slate-50 dark:bg-slate-800/80 shrink-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Date of Issue / تاريخ الإصدار
            </div>
            <div className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
              {issueDate}
            </div>
          </div>
        )}
      </div>

      {/* Optional Title & Subtitle */}
      {title && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-center">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportHeader;
