/* ═══════════════════════════════════════════════════════════
 * PERMIT HTML PREVIEW — v3.0
 * نموذج تصريح HTML جاهز للطباعة
 * يدعم: Libya Flight Permission + Morocco Landing + Generic
 * ═══════════════════════════════════════════════════════════ */
import React, { useRef, useState } from "react";
import { X, Printer, Globe } from "lucide-react";
import { printHTMLContent } from "../utils/dialog";
import { toDisplayImageUrl } from "../api";

/* ═══ helper: استنتاج layout من name ═══ */
function inferLayout(template) {
  if (!template) return "generic";
  if (template.layout) return template.layout;

  const name = (template.name || "").toLowerCase();
  const country = (template.country || "").toLowerCase();

  if (
    name.includes("libya") &&
    (name.includes("permission") || name.includes("flight permission"))
  ) {
    return "libya_flight_permission";
  }
  if (name.includes("libya") && name.includes("overflight")) {
    return "libya_overflight";
  }
  if (name.includes("morocco") || country === "morocco") {
    return "morocco_landing";
  }
  return "generic";
}

export function PermitHTMLPreview({
  template,
  flight,
  crew = [],
  settings = {},
  permit = {},
  user,
  initialIncludeStamp,
  onClose,
}) {
  const [langMode, setLangMode] = useState("both");
  const printRef = useRef(null);
  const logoDisplayUrl = toDisplayImageUrl(settings?.logo || "");

  /* ═══ helper: تنسيق التاريخ ═══ */
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

  const fmtDateAr = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}Z`;
  };

  /* ═══ helper: قيمة من source ═══ */
  const getValue = (source) => {
    if (!source) return "—";
    if (source.startsWith("static:")) return source.slice(7);
    if (source.startsWith("settings.")) {
      const key = source.slice(9);
      return settings?.[key] ?? "—";
    }
    if (source.startsWith("flight.")) {
      const key = source.slice(7);
      return flight?.[key] ?? "—";
    }
    if (source.startsWith("permit.")) {
      const key = source.slice(7);
      return permit?.[key] ?? "—";
    }
    return "—";
  };

  /* ═══ طباعة ═══ */
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const fullHtml = `
      <!DOCTYPE html>
      <html dir="${langMode === "ar" ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <title>${template?.name || "Permit"} — ${flight?.flightNo || ""}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: white; }
          table { width: 100%; border-collapse: collapse; margin: 4px 0; }
          td, th { border: 1px solid #000; padding: 5px 7px; vertical-align: top; font-size: 11px; }
          .no-border td, .no-border th { border: none; }
          .header-title { text-align: center; font-weight: bold; }
          .section-title { background: #e5e5e5; font-weight: bold; text-align: center; }
          .label { background: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #999; font-size: 10px; }
          .mono { font-family: 'Courier New', monospace; }
          .bold { font-weight: bold; }
          img { max-width: 100px; max-height: 100px; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `;
    printHTMLContent(
      fullHtml,
      `${template?.name || "Permit"} - ${flight?.flightNo || ""}`
    );
  };

  /* ═══════════════════════════════════════════════════════
   * LIBYA — FLIGHT PERMISSION REQUEST
   * نموذج هيئة الطيران المدني الليبي
   * ═══════════════════════════════════════════════════════ */
  const renderLibyaFlightPermission = () => {
    const operatorName =
      settings?.companyName || "Executive Authority for Special Flights";
    const operatorNameAr =
      settings?.companyNameAr || "الجهاز التنفيذي للطيران الخاص";
    const date = flight?.std ? String(flight.std).slice(0, 10) : "—";
    const aircraftType = settings?.aircraftType || flight?.acftType || "A319";
    const registration = flight?.acft || "—";
    const callSign = flight?.flightNo || "—";
    const sectors =
      flight?.route ||
      `${flight?.dep || "—"}/${flight?.arr || "—"} ${
        flight?.std ? String(flight.std).slice(11, 16) + "Z" : ""
      }`;
    const purpose = flight?.notes || permit?.notes || "—";
    const coaExpiry = settings?.coaExpiry || "—";
    const userName = user?.fullName || user?.username || "—";
    const userTitle = user?.jobTitle || "رئيس قسم الترحيل الجوي";

    return (
      <div
        ref={printRef}
        style={{
          fontFamily: "Arial, sans-serif",
          direction: "rtl",
          color: "#000",
        }}
      >
        {/* ═══ HEADER ═══ */}
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          {logoDisplayUrl && (
            <img
              src={logoDisplayUrl}
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
          {operatorNameAr && (
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#111827", lineHeight: "1.3" }}>
              {operatorNameAr}
            </div>
          )}
          {operatorName && (
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", fontFamily: "monospace", marginBottom: "8px" }}>
              {operatorName}
            </div>
          )}
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "2px",
              borderTop: "1px solid #ccc",
              paddingTop: "8px",
            }}
          >
            طلب إصدار تصريح رحلة
          </div>
          <div style={{ fontSize: "13px", fontWeight: "bold", color: "#374151" }}>
            FLIGHT PERMISSION REQUEST
          </div>
        </div>

        {/* ═══ DATE + ADDRESSEE ═══ */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <b>التاريخ:</b> {fmtDateAr(date)}
          </div>
          <div style={{ textAlign: "left" }}>
            <b>السادة / إدارة النقل الجوي</b>
          </div>
        </div>

        <div style={{ fontSize: "12px", marginBottom: "15px" }}>
          الرجاء إصدار تصريح إقلاع وهبوط للرحلة على حسب البيانات التالية :
        </div>

        {/* ═══ MAIN TABLE ═══ */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "11px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  width: "35%",
                  backgroundColor: "#f5f5f5",
                }}
              >
                1- مشغل الرحلة (OPERATOR)
              </td>
              <td style={{ border: "1px solid #000", padding: "6px 8px" }}>
                <div style={{ fontWeight: "bold" }}>{operatorNameAr}</div>
                <div style={{ fontSize: "10px", color: "#444" }}>
                  {operatorName}
                </div>
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                2- تاريخ التشغيل (DATE OF FLIGHT)
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontFamily: "monospace",
                }}
              >
                {fmtDateAr(date)}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                3- طراز الطائرة (TYPE OF A/C)
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontFamily: "monospace",
                }}
              >
                {aircraftType}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                4- حروف التسجيل (REG OF A/C)
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                }}
              >
                {registration}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                5- علامة النداء (CALL SIGN)
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontFamily: "monospace",
                  fontWeight: "bold",
                }}
              >
                {callSign}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                6- خط السير (SECTORS)
              </td>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontSize: "10px",
                  fontFamily: "monospace",
                  lineHeight: "1.6",
                }}
              >
                {sectors.split(",").map((s, i) => (
                  <div key={i}>{s.trim()}</div>
                ))}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                7- الغرض من الرحلة (PURPOSE OF FLT)
              </td>
              <td style={{ border: "1px solid #000", padding: "6px 8px" }}>
                {purpose}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  border: "1px solid #000",
                  padding: "6px 8px",
                  fontWeight: "bold",
                  backgroundColor: "#f5f5f5",
                }}
              >
                8- ملاحظات
              </td>
              <td style={{ border: "1px solid #000", padding: "6px 8px" }}>
                تاريخ شهادة الصلاحية : {fmtDateAr(coaExpiry)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ═══ SIGNATURE + LOGO + STAMP ═══ */}
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {/* Signature (left) */}
          <div style={{ fontSize: "12px", textAlign: "center" }}>
            <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
              {userName}
            </div>
            <div style={{ fontSize: "11px", color: "#444" }}>{userTitle}</div>
            <div
              style={{
                marginTop: "40px",
                borderTop: "1px solid #000",
                width: "180px",
                paddingTop: "4px",
                fontSize: "10px",
              }}
            >
              التوقيع
            </div>
          </div>

          {/* Logo (right) */}
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {logoDisplayUrl && (
              <img
                src={logoDisplayUrl}
                alt="logo"
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div
          style={{
            marginTop: "30px",
            paddingTop: "10px",
            borderTop: "1px solid #999",
            fontSize: "9px",
            color: "#666",
            textAlign: "center",
          }}
        >
          {operatorNameAr} — {operatorName}
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
   * MOROCCO — LANDING PERMIT
   * ═══════════════════════════════════════════════════════ */
  const renderMoroccoLanding = () => {
    const operatorName = settings?.companyName || "GLOBAL AIR TRANSPORT";
    const operatorNameAr = settings?.companyNameAr || "الجهاز التنفيذي";
    const operatorCode = (settings?.operatorCode || "GAK").toUpperCase();
    const date = flight?.std ? String(flight.std).slice(0, 10) : "—";
    const aircraftType = settings?.aircraftType || "EMB-145";
    const registration = flight?.acft || "—";
    const callSign = flight?.flightNo || "—";
    const sectors =
      flight?.route || `${flight?.dep || "—"}/${flight?.arr || "—"}`;

    return (
      <div
        ref={printRef}
        style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "15px" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold" }}>
            Kingdom of Morocco
          </div>
          <div style={{ fontSize: "10px", color: "#666" }}>
            F.RTA.004.REG/04 · V16062025
          </div>
          <div style={{ fontSize: "11px", marginTop: "4px" }}>
            Ministry of Transport and Logistic
          </div>
          <div style={{ fontSize: "11px" }}>Directorate of Air Transport</div>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              marginTop: "12px",
              borderTop: "2px solid #000",
              borderBottom: "2px solid #000",
              padding: "6px",
            }}
          >
            Application form related to traffic rights' authorization
          </div>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "10px",
          }}
        >
          <tbody>
            {/* AIR CARRIER */}
            <tr>
              <td
                colSpan={4}
                style={{
                  background: "#e5e5e5",
                  fontWeight: "bold",
                  textAlign: "center",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                AIR CARRIER
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                  width: "25%",
                }}
              >
                Name
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {operatorName}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Type of air carrier
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                classic ☑ / charter ☐ / low cost ☐ / cargo ☐
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Address
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {settings?.address || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Nationality
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {settings?.country || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Phone
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.phone || "—"}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                  width: "20%",
                }}
              >
                Fax
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.fax || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                E-mail
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.email || "—"}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                SITA
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.sita || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                ICAO/IATA Codes
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {operatorCode}/5S
              </td>
            </tr>

            {/* AIRCRAFT */}
            <tr>
              <td
                colSpan={4}
                style={{
                  background: "#e5e5e5",
                  fontWeight: "bold",
                  textAlign: "center",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                AIRCRAFT
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Registration marks
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {registration}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Nationality
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.country || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Type
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {aircraftType}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Seat capacity
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {settings?.seatCapacity || "—"}
              </td>
            </tr>

            {/* FLIGHT INFORMATION */}
            <tr>
              <td
                colSpan={4}
                style={{
                  background: "#e5e5e5",
                  fontWeight: "bold",
                  textAlign: "center",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                FLIGHT INFORMATION
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Flight number
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {callSign}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Number of flights
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>1</td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Airport of Origin
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {flight?.dep || "—"}
              </td>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Airport of destination
              </td>
              <td style={{ border: "1px solid #000", padding: "5px" }}>
                {flight?.arr || "—"}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Complete route
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {sectors}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Operation day(s)
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {fmtDate(date)}
              </td>
            </tr>
            <tr>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  border: "1px solid #000",
                  padding: "5px",
                }}
              >
                Schedules UTC
              </td>
              <td
                colSpan={3}
                style={{ border: "1px solid #000", padding: "5px" }}
              >
                {fmtTime(flight?.std)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "10px",
            borderTop: "1px solid #999",
            fontSize: "9px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <b>Issued by:</b> {user?.fullName || user?.username || "—"}
            </div>
            <div>
              <b>Date:</b> {new Date().toISOString().slice(0, 10)}
            </div>
          </div>
          <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <b>Signature:</b>
              <div
                style={{
                  marginTop: "8px",
                  borderBottom: "1px solid #000",
                  width: "200px",
                  height: "30px",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════
   * GENERIC LAYOUT — fallback
   * ═══════════════════════════════════════════════════════ */
  const renderGeneric = () => (
    <div
      ref={printRef}
      style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        {logoDisplayUrl && (
          <img
            src={logoDisplayUrl}
            alt="logo"
            style={{
              maxWidth: "85px",
              maxHeight: "85px",
              margin: "0 auto 8px",
              display: "block",
              objectFit: "contain",
            }}
          />
        )}
        {settings?.companyNameAr && (
          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#111827" }}>
            {settings.companyNameAr}
          </div>
        )}
        {settings?.companyName && (
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151", fontFamily: "monospace", marginBottom: "8px" }}>
            {settings.companyName}
          </div>
        )}
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          {template?.name}
        </div>
        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          {template?.country} · {template?.permitType}
        </div>
      </div>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}
      >
        <tbody>
          {(template?.fields || []).map((f) => (
            <tr key={f.key}>
              <td
                style={{
                  background: "#f5f5f5",
                  fontWeight: "bold",
                  width: "40%",
                  border: "1px solid #333",
                  padding: "6px",
                }}
              >
                {f.label}
              </td>
              <td style={{ border: "1px solid #333", padding: "6px" }}>
                {getValue(f.source)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        style={{
          marginTop: "20px",
          paddingTop: "10px",
          borderTop: "1px solid #999",
          fontSize: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <b>Issued by:</b> {user?.fullName || "—"} · <b>Date:</b>{" "}
          {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </div>
  );

  /* ═══ اختيار التخطيط ═══ */
  const renderLayout = () => {
    const layout = inferLayout(template);
    switch (layout) {
      case "libya_flight_permission":
        return renderLibyaFlightPermission();
      case "morocco_landing":
        return renderMoroccoLanding();
      default:
        return renderGeneric();
    }
  };

  /* ═══ RENDER ═══ */
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
              🖨️ {template?.name} — {flight?.flightNo}
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {template?.country} · {template?.permitType} · {template?.notes}
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

        {/* Preview */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "#f5f5f5" }}
        >
          <div
            className="bg-white p-8 mx-auto shadow-lg"
            style={{ maxWidth: "750px", minHeight: "900px" }}
          >
            {renderLayout()}
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex flex-wrap items-center justify-end gap-3"
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
              className="px-6 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 hover:opacity-90"
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

export default PermitHTMLPreview;
