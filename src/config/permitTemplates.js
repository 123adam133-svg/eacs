/* ═══════════════════════════════════════════════════════════
 * PERMIT TEMPLATES CONFIG
 * ═══════════════════════════════════════════════════════════ */

export const PERMIT_TEMPLATES = {
  LIBYA_FLIGHT_PERMISSION: {
    id: "libya_flight_permission",
    name: "Libya Flight Permission Request",
    country: "Libya",
    permitType: "LANDING",
    layout: "libya_flight_permission",
    notes: "طلب إصدار تصريح رحلة — هيئة الطيران المدني الليبي",
    fields: [
      { key: "operatorName", label: "Operator", source: "settings.companyName" },
      {
        key: "operatorNameAr",
        label: "Operator (AR)",
        source: "settings.companyNameAr",
      },
      {
        key: "operatorCode",
        label: "Operator Code",
        source: "settings.operatorCode",
      },
      { key: "date", label: "Date of Flight", source: "flight.date" },
      {
        key: "aircraftType",
        label: "Aircraft Type",
        source: "settings.aircraftType",
      },
      { key: "registration", label: "Registration", source: "flight.acft" },
      { key: "callSign", label: "Call Sign", source: "flight.flightNo" },
      { key: "sectors", label: "Sectors", source: "flight.route" },
      { key: "purpose", label: "Purpose of Flight", source: "flight.notes" },
      { key: "coaExpiry", label: "C of A Expiry", source: "settings.coaExpiry" },
    ],
  },
};

export default PERMIT_TEMPLATES;