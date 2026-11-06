/* ═══════════════════════════════════════════════════════════
 * PERMIT PRINT MODAL — v1.1
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useRef } from "react";
import { X, Printer, Globe } from "lucide-react";
import { printHTMLContent } from "../utils/dialog";
import { toDisplayImageUrl } from "../api";

export function PermitPrintModal({
  permit,
  flight,
  crew = [],
  settings = {},
  user,
  onClose,
}) {
  const [langMode, setLangMode] = useState("both");
  const printRef = useRef(null);

  const logoUrl = toDisplayImageUrl(settings?.logo || "");
  const companyName = settings?.companyName || "EACS";
  const companyNameAr = settings?.companyNameAr || "الجهاز التنفيذي";
  const userName = user?.fullName || user?.username || "User";

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
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

  const crewList = (flight?.crewSlots || [])
    .map((slot) => {
      const m = crew.find((c) => String(c.id) === String(slot.crewId));
      return m
        ? { position: slot.position, name: m.fullName, license: m.licenseNo }
        : null;
    })
    .filter(Boolean);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const fullHtml = `
      <!DOCTYPE html>
      <html dir="${langMode === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <title>${permit?.permitType || "Permit"} — ${
      flight?.flightNo || ""
    }</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: ${
            langMode === "ar"
              ? "'Cairo', Arial, sans-serif"
              : "Arial, sans-serif"
          }; color: #000; background: white; }
          * { box-sizing: border-box; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          td, th { padding: 6px 8px; border: 1px solid #ccc; font-size: 12px; }
          th { background: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `;
    printHTMLContent(
      fullHtml,
      `${permit?.permitType || "Permit"} - ${flight?.flightNo || ""}`
    );
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col"
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
              🖨️ Print Permit — {permit?.country}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {permit?.permitType} · {flight?.flightNo}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              { id: "both", label: "🌐 عربي + EN" },
              { id: "en", label: "🇬🇧 English" },
              { id: "ar", label: "🇸🇦 عربي" },
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

        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "#f5f5f5" }}
        >
          <div
            ref={printRef}
            className="bg-white p-8 mx-auto shadow-lg"
            style={{ maxWidth: "700px" }}
          >
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="logo"
                  style={{
                    maxWidth: "100px",
                    maxHeight: "100px",
                    margin: "0 auto 10px",
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

            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: "20px 0",
                textAlign: "center",
                borderTop: "2px solid #000",
                borderBottom: "2px solid #000",
                padding: "10px",
              }}
            >
              {langMode === "both" && `${permit?.permitType} PERMIT / تصريح`}
              {langMode === "en" && `${permit?.permitType} PERMIT`}
              {langMode === "ar" && `تصريح ${permit?.permitType}`}
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "normal",
                  marginTop: "4px",
                  color: "#555",
                }}
              >
                {permit?.country || "—"}
              </div>
            </div>

            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", width: "150px" }}>
                    Permit No
                  </td>
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {permit?.permitNo || "—"}
                  </td>
                  <td style={{ fontWeight: "bold", width: "150px" }}>Status</td>
                  <td>{permit?.status || "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Issued Date</td>
                  <td>{fmtDate(permit?.issuedDate)}</td>
                  <td style={{ fontWeight: "bold" }}>Expiry Date</td>
                  <td>{fmtDate(permit?.expiryDate)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Issued By</td>
                  <td colSpan={3}>{permit?.issuedBy || "—"}</td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                marginTop: "20px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ✈️ FLIGHT DATA
            </div>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: "bold", width: "150px" }}>
                    Flight No
                  </td>
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {flight?.flightNo || "—"}
                  </td>
                  <td style={{ fontWeight: "bold", width: "150px" }}>
                    Aircraft
                  </td>
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {flight?.acft || "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Departure</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {flight?.dep || "—"}
                  </td>
                  <td style={{ fontWeight: "bold" }}>Arrival</td>
                  <td style={{ fontFamily: "monospace" }}>
                    {flight?.arr || "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Date</td>
                  <td>{fmtDate(flight?.std)}</td>
                  <td style={{ fontWeight: "bold" }}>STD / STA</td>
                  <td>
                    {fmtTime(flight?.std)} / {fmtTime(flight?.sta)}
                  </td>
                </tr>
              </tbody>
            </table>

            {crewList.length > 0 && (
              <>
                <div
                  style={{
                    marginTop: "20px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  👥 CREW ({crewList.length})
                </div>
                <table>
                  <thead>
                    <tr style={{ backgroundColor: "#f0f0f0" }}>
                      <th style={{ width: "40px" }}>#</th>
                      <th>Position</th>
                      <th>Name</th>
                      <th>License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crewList.map((c, i) => (
                      <tr key={i}>
                        <td style={{ textAlign: "center" }}>{i + 1}</td>
                        <td style={{ fontWeight: "bold" }}>{c.position}</td>
                        <td>{c.name}</td>
                        <td
                          style={{ fontFamily: "monospace", fontSize: "11px" }}
                        >
                          {c.license || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {permit?.notes && (
              <>
                <div
                  style={{
                    marginTop: "20px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  📝 NOTES
                </div>
                <div
                  style={{
                    padding: "8px",
                    border: "1px solid #ccc",
                    marginTop: "4px",
                    fontSize: "12px",
                  }}
                >
                  {permit.notes}
                </div>
              </>
            )}

            <div
              style={{
                marginTop: "30px",
                paddingTop: "20px",
                borderTop: "1px solid #999",
                fontSize: "12px",
                color: "#333",
              }}
            >
              <table style={{ width: "100%", border: "none" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "4px 0", border: "none" }}>
                      <b>Issued by:</b> {userName}
                    </td>
                    <td
                      style={{
                        padding: "4px 0",
                        textAlign: "end",
                        border: "none",
                      }}
                    >
                      <b>Date:</b> {new Date().toISOString().slice(0, 10)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <b>Signature:</b>
                  <div
                    style={{
                      marginTop: "10px",
                      borderBottom: "1px solid #000",
                      width: "200px",
                      height: "30px",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="p-4 border-t flex items-center justify-end gap-3 flex-wrap"
          style={{ borderColor: "var(--border-default)" }}
        >
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
              className="px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 shadow-sm hover:opacity-90"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Printer className="w-4 h-4" /> Print / طباعة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PermitPrintModal;
