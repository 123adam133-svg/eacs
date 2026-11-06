/* ═══════════════════════════════════════════════════════════
 * CATERING PRINT MODAL — Printable Catering Order Sheet
 * Supports Bilingual (AR + EN), English, and Arabic modes
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef, useEffect } from "react";
import { X, Printer, Globe, Stamp, FileX, Lock } from "lucide-react";
import { printHTMLContent } from "../utils/dialog";
import { can as checkPerm } from "../config/permissions";
import { toDisplayImageUrl } from "../api";

export function CateringPrintModal({
  order,
  flight,
  settings = {},
  user,
  onClose,
}) {
  const [langMode, setLangMode] = useState("both");
  const printRef = useRef(null);

  const canPrintStamp = checkPerm(user, "catering.print_with_stamp");
  const canPrintNoStamp = checkPerm(user, "catering.print_without_stamp");
  const canAnyPrint = canPrintStamp || canPrintNoStamp;

  const [includeStamp, setIncludeStamp] = useState(() =>
    canPrintStamp ? true : false
  );

  useEffect(() => {
    if (includeStamp && !canPrintStamp && canPrintNoStamp) {
      setIncludeStamp(false);
    } else if (!includeStamp && !canPrintNoStamp && canPrintStamp) {
      setIncludeStamp(true);
    }
  }, [canPrintStamp, canPrintNoStamp, includeStamp]);

  if (!order) return null;

  const logoUrl = toDisplayImageUrl(settings?.logo);
  const stampUrl = toDisplayImageUrl(settings?.stamp);
  const companyName = settings?.companyName || "EXECUTIVE AUTHORITY FOR SPECIAL FLIGHTS";
  const companyNameAr = settings?.companyNameAr || "الجهاز التنفيذي للطيران الخاص";
  const userName = user?.fullName || user?.username || "Operations";

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${String(d.getUTCDate()).padStart(2, "0")}-${
      months[d.getUTCMonth()]
    }-${d.getUTCFullYear()}`;
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")} UTC`;
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const totalHeadcount = (Number(order.paxCount) || 0) + (Number(order.crewCount) || 0);

  const handlePrint = () => {
    if (includeStamp && !canPrintStamp) return;
    if (!includeStamp && !canPrintNoStamp) return;
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const fullHtml = `
      <!DOCTYPE html>
      <html dir="${langMode === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <title>Catering Order — ${order?.flightNo || ""}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: ${
              langMode === "ar"
                ? "'Cairo', Arial, sans-serif"
                : "Arial, sans-serif"
            };
            color: #000;
            background: white;
            margin: 0;
            padding: 0;
          }
          * { box-sizing: border-box; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          td, th { padding: 7px 9px; border: 1px solid #bbb; font-size: 12px; }
          th { background: #f1f5f9; font-weight: bold; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `;
    printHTMLContent(fullHtml, `Catering Order - ${order?.flightNo || ""}`);
  };

  const lbl = (en, ar) =>
    langMode === "both" ? `${en} / ${ar}` : langMode === "en" ? en : ar;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center p-4 border-b"
          style={{ borderColor: "var(--border-default)" }}
        >
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              🍽️ Print Catering Order — {order.flightNo}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {order.mealType} · {order.paxCount || 0} PAX + {order.crewCount || 0} Crew
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Selector */}
        <div
          className="px-4 py-3 border-b flex items-center gap-3 flex-wrap"
          style={{
            borderColor: "var(--border-default)",
            backgroundColor: "var(--bg-app)",
          }}
        >
          <Globe
            className="w-4 h-4"
            style={{ color: "var(--brand-primary)" }}
          />
          <span
            className="text-xs font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Language:
          </span>
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--border-default)" }}
          >
            {[
              { id: "both", label: "عربي + EN" },
              { id: "en", label: "English" },
              { id: "ar", label: "عربي" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setLangMode(opt.id)}
                className="px-3 py-1.5 text-xs font-bold transition"
                style={{
                  backgroundColor:
                    langMode === opt.id
                      ? "var(--brand-primary)"
                      : "var(--bg-card)",
                  color: langMode === opt.id ? "white" : "var(--text-muted)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Printable Sheet Preview */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "#f1f5f9" }}
        >
          <div
            ref={printRef}
            className="bg-white p-8 mx-auto shadow-lg text-black"
            style={{ maxWidth: "720px" }}
            dir={langMode === "ar" ? "rtl" : "ltr"}
          >
            {/* Company Header */}
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="logo"
                  style={{
                    maxWidth: "90px",
                    maxHeight: "90px",
                    margin: "0 auto 8px",
                    display: "block",
                    objectFit: "contain",
                  }}
                />
              )}
              {companyNameAr && (
                <div style={{ fontSize: "16px", color: "#111827", fontWeight: "bold", lineHeight: "1.3" }}>
                  {companyNameAr}
                </div>
              )}
              {companyName && (
                <div style={{ fontSize: "13px", color: "#374151", fontWeight: "600", fontFamily: "monospace", marginTop: "2px" }}>
                  {companyName}
                </div>
              )}
            </div>

            {/* Title Banner */}
            <div
              style={{
                fontSize: "17px",
                fontWeight: "bold",
                margin: "16px 0",
                textAlign: "center",
                borderTop: "2px solid #000",
                borderBottom: "2px solid #000",
                padding: "9px",
                backgroundColor: "#f8fafc",
              }}
            >
              {langMode === "both" && "IN-FLIGHT CATERING ORDER / أمر تموين الطائرة"}
              {langMode === "en" && "IN-FLIGHT CATERING ORDER"}
              {langMode === "ar" && "أمر تموين الطائرة"}
            </div>

            {/* Flight & Order Details */}
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", width: "26%", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Flight No", "رقم الرحلة")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontFamily: "monospace", fontWeight: "bold", width: "24%" }}>
                    {order.flightNo || flight?.flightNo || "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", width: "26%", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Date", "التاريخ")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", width: "24%" }}>
                    {fmtDate(order.date || flight?.std)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Aircraft Reg", "تسجيل الطائرة")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontFamily: "monospace", fontWeight: "bold" }}>
                    {flight?.acft || "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Route", "خط السير")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontFamily: "monospace" }}>
                    {flight ? `${flight.dep || "—"} → ${flight.arr || "—"}` : "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("STD / STA", "الإقلاع / الوصول")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontFamily: "monospace" }}>
                    {flight ? `${fmtTime(flight.std)} / ${fmtTime(flight.sta)}` : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Meal Type", "نوع الوجبة")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontWeight: "bold" }}>
                    {order.mealType || "LUNCH"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("PAX / Crew", "الركاب / الطاقم")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontWeight: "bold" }}>
                    {order.paxCount || 0} PAX + {order.crewCount || 0} Crew ({totalHeadcount})
                  </td>
                  <td style={{ padding: "6px 8px", fontWeight: "bold", border: "1px solid #bbb", background: "#f8fafc" }}>
                    {lbl("Status", "الحالة")}
                  </td>
                  <td style={{ padding: "6px 8px", border: "1px solid #bbb", fontWeight: "bold" }}>
                    {order.status || "PENDING"}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Menu Items Table */}
            <div style={{ marginTop: "20px", fontSize: "14px", fontWeight: "bold" }}>
              🍽️ {lbl("MENU ITEMS", "قائمة الأصناف المطلوبة")} ({items.length})
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9" }}>
                  <th style={{ padding: "7px 8px", border: "1px solid #bbb", width: "45px", textAlign: "center" }}>
                    #
                  </th>
                  <th style={{ padding: "7px 8px", border: "1px solid #bbb", textAlign: "start" }}>
                    {lbl("Item Description", "وصف الصنف")}
                  </th>
                  <th style={{ padding: "7px 8px", border: "1px solid #bbb", width: "180px", textAlign: "center" }}>
                    {lbl("Quantity / Allocation", "الكمية")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: "12px", textAlign: "center", border: "1px solid #bbb", color: "#666" }}>
                      {lbl("No items specified", "لا توجد أصناف محددة")}
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const itemDisplay =
                      langMode === "ar"
                        ? it.nameAr || it.item || it.nameEn || "—"
                        : langMode === "en"
                        ? it.nameEn || it.item || it.nameAr || "—"
                        : it.nameEn && it.nameAr
                        ? `${it.nameEn} / ${it.nameAr}`
                        : it.item || it.nameAr || it.nameEn || "—";
                    return (
                      <tr key={idx}>
                        <td style={{ padding: "6px 8px", border: "1px solid #bbb", textAlign: "center", fontWeight: "bold" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "6px 8px", border: "1px solid #bbb" }}>
                          <div>{itemDisplay}</div>
                          {it.unit && (
                            <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>
                              {lbl("Unit", "الوحدة")}: {it.unit}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", border: "1px solid #bbb", textAlign: "center", fontFamily: "monospace", fontWeight: "bold" }}>
                          {it.qty || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Special Meals */}
            {order.specialMeals && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  ⚠️ {lbl("SPECIAL MEALS", "وجبات خاصة")}
                </div>
                <div style={{ padding: "8px 10px", border: "1px solid #bbb", background: "#fffbeb", fontSize: "12px" }}>
                  {order.specialMeals}
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                  📝 {lbl("REMARKS / NOTES", "ملاحظات")}
                </div>
                <div style={{ padding: "8px 10px", border: "1px solid #bbb", fontSize: "12px" }}>
                  {order.notes}
                </div>
              </div>
            )}

            {/* Signatures & Stamp */}
            <div
              style={{
                marginTop: "32px",
                paddingTop: "16px",
                borderTop: "1px solid #999",
                fontSize: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
              }}
            >
              <div>
                <div>
                  <b>{lbl("Requested By", "طُلب بواسطة")}:</b> {userName}
                </div>
                <div style={{ marginTop: "4px" }}>
                  <b>{lbl("Issue Date", "تاريخ الإصدار")}:</b>{" "}
                  {new Date().toISOString().slice(0, 10)}
                </div>
                <div style={{ marginTop: "32px" }}>
                  <b>{lbl("Operations Signature", "توقيع العمليات")}:</b>
                  <div
                    style={{
                      marginTop: "8px",
                      borderBottom: "1px solid #000",
                      width: "180px",
                      height: "24px",
                    }}
                  />
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                {stampUrl && includeStamp && canPrintStamp && (
                  <img
                    src={stampUrl}
                    alt="stamp"
                    style={{
                      maxWidth: "85px",
                      maxHeight: "85px",
                      objectFit: "contain",
                      opacity: 0.85,
                      marginBottom: "8px",
                    }}
                  />
                )}
                <div>
                  <b>{lbl("Catering Received By", "استلام التموين")}:</b>
                  <div
                    style={{
                      marginTop: "8px",
                      borderBottom: "1px solid #000",
                      width: "180px",
                      height: "24px",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="p-4 border-t flex items-center justify-between gap-3 flex-wrap"
          style={{ borderColor: "var(--border-default)" }}
        >
          {/* Stamp Mode Selector (Granular Permissions) */}
          <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
            <button
              type="button"
              disabled={!canPrintStamp}
              onClick={() => canPrintStamp && setIncludeStamp(true)}
              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition ${
                includeStamp && canPrintStamp
                  ? "bg-emerald-600 text-white"
                  : canPrintStamp
                  ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  : "opacity-45 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
              }`}
              title={!canPrintStamp ? "يتطلب صلاحية طباعة أوامر التموين بالختم الرسمي" : ""}
            >
              <Stamp className="w-3.5 h-3.5" />
              <span>{lbl("With Stamp", "بالختم الرسمي")}</span>
              {!canPrintStamp && <Lock className="w-3 h-3" />}
            </button>
            <button
              type="button"
              disabled={!canPrintNoStamp}
              onClick={() => canPrintNoStamp && setIncludeStamp(false)}
              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border-s transition ${
                !includeStamp && canPrintNoStamp
                  ? "bg-slate-700 text-white"
                  : canPrintNoStamp
                  ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                  : "opacity-45 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
              }`}
              style={{ borderColor: "var(--border-default)" }}
              title={!canPrintNoStamp ? "يتطلب صلاحية طباعة أوامر التموين بدون ختم" : ""}
            >
              <FileX className="w-3.5 h-3.5" />
              <span>{lbl("Without Stamp", "بدون ختم")}</span>
              {!canPrintNoStamp && <Lock className="w-3 h-3" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={!canAnyPrint}
              className="px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ background: "var(--brand-gradient)" }}
              title={!canAnyPrint ? "لا توجد صلاحية طباعة أوامر التموين" : ""}
            >
              <Printer className="w-4 h-4" /> Print / طباعة
              {!canAnyPrint && <Lock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CateringPrintModal;
