/* ═══════════════════════════════════════════════════════════
 * REPORTS MODULE — v7.3
 * - Hours by Position (CPT / OBS / TRI / FA1 / ...)
 * - Per-flight unique block (no duplication when multi-position)
 * - Full report view (all crew / all aircraft in date range)
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Printer,
  Lock,
  User as UserIcon,
  BarChart3,
  Plane as PlaneIcon,
  Stamp,
  FileX,
  Clock,
  Users,
  Edit,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { useT } from "../contexts";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pdfSafe } from "../utils/pdf";
import { fmtDuty, safeArray } from "../utils/helpers";
import { can as checkPerm } from "../config/permissions";
import { flightsAPI } from "../api";
import { CompleteFlightModal } from "../components/CompleteFlightModal";
import { ReportHeader } from "../components/ReportHeader";
import { computeAutoStatus } from "./ScheduleBoard";
import { ChartsModule } from "./ChartsModule";

function logoToDisplayUrl(url) {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  const match = url.match(/[?&]id=([^&]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  const pathMatch = url.match(/\/d\/([^/]+)/);
  if (pathMatch) return `https://lh3.googleusercontent.com/d/${pathMatch[1]}`;
  return url;
}

/* ⭐ خريطة اختصارات الوظائف */
const POS_SHORT_MAP = {
  captain: "CPT",
  firstOfficer: "FO",
  observer: "OBS",
  tri: "TRI",
  fa1: "FA1",
  fa2: "FA2",
  flightAttendant: "FA",
  engineer: "ENG1",
  security: "SEC",
  loadmaster: "LMC",
  flightDispatcher: "FD",
};

const POS_ORDER = [
  "CPT",
  "FO",
  "OBS",
  "TRI",
  "FA1",
  "FA2",
  "FA",
  "ENG1",
  "SEC",
  "LMC",
  "FD",
];

export function ReportsModule({
  flights,
  setFlights,
  reloadFlights,
  setSyncStatus,
  crew,
  fleet,
  leave = [],
  settings,
  user,
  lang,
  initialSubTab = "crewHours",
}) {
  const t = useT();
  const isAr = (lang || document.documentElement.lang || "ar") === "ar";
  const logoUrl = settings?.logo ? logoToDisplayUrl(settings.logo) : "";
  const canViewReports = checkPerm(user, "reports.view");
  const canViewCharts = checkPerm(user, "charts.view");
  const canViewAll = checkPerm(user, "reports.view_all");
  const canExportStamp = checkPerm(user, "reports.print_with_stamp");
  const canExportNoStamp = checkPerm(user, "reports.print_without_stamp");
  const canEditFlight = checkPerm(user, "schedule.edit");
  const [editingCompletedFlight, setEditingCompletedFlight] = useState(null);
  const [quickCompleteFlightId, setQuickCompleteFlightId] = useState("");

  const saveCompletedFlightFromReports = async (updatedFlight) => {
    if (!canEditFlight) throw new Error("No permission");
    const autoStatus = computeAutoStatus(updatedFlight);
    const finalFlight = {
      ...updatedFlight,
      status: autoStatus,
      actual: { ...(updatedFlight.actual || {}) },
    };
    setSyncStatus?.("syncing");
    try {
      const apiResponse = await flightsAPI.update(finalFlight.id, finalFlight);
      const savedFlight = {
        ...finalFlight,
        ...(apiResponse || {}),
        id: finalFlight.id,
        actual: { ...(apiResponse?.actual || {}), ...finalFlight.actual },
      };
      setFlights?.((prev) =>
        Array.isArray(prev)
          ? prev.map((f) => (f.id === savedFlight.id ? savedFlight : f))
          : prev
      );
      setSyncStatus?.("synced");
      if (typeof reloadFlights === "function") {
        setTimeout(() => {
          reloadFlights().catch((err) =>
            console.warn("reloadFlights failed:", err)
          );
        }, 400);
      }
    } catch (e) {
      setSyncStatus?.("error");
      throw e;
    }
  };

  const availableCrew = useMemo(() => {
    if (canViewAll) return crew;
    if (!user?.crewId) return [];
    const self = crew.find((c) => c.id === user.crewId);
    return self ? [self] : [];
  }, [crew, user, canViewAll]);

  const isLimited = !canViewAll;

  const reportTabs = useMemo(() => {
    const list = [];
    if (canViewReports) {
      list.push(
        {
          id: "crewHours",
          icon: BarChart3,
          labelAr: "ساعات الطاقم",
          labelEn: "Crew Hours",
        },
        {
          id: "fullReport",
          icon: Users,
          labelAr: "التقرير الشامل",
          labelEn: "Full Report",
        },
        {
          id: "completedFlights",
          icon: PlaneIcon,
          labelAr: "الرحلات المنفذة",
          labelEn: "Completed Flights",
        },
        {
          id: "dutyTime",
          icon: Clock,
          labelAr: "ساعات الخدمة",
          labelEn: "Duty Time",
        }
      );
    }
    if (canViewCharts) {
      list.push({
        id: "charts",
        icon: TrendingUp,
        labelAr: "الإحصائيات والرسوم البيانية",
        labelEn: "Analytics & Charts",
      });
    }
    return list;
  }, [canViewReports, canViewCharts]);

  const resolveValidTab = (candidate) => {
    if (reportTabs.some((rt) => rt.id === candidate)) return candidate;
    return reportTabs[0]?.id || "crewHours";
  };

  const [activeSubTab, setActiveSubTab] = useState(() =>
    resolveValidTab(initialSubTab)
  );

  useEffect(() => {
    setActiveSubTab((prev) =>
      initialSubTab && reportTabs.some((rt) => rt.id === initialSubTab)
        ? initialSubTab
        : resolveValidTab(prev)
    );
  }, [initialSubTab, reportTabs]);

  const [selectedCrew, setSelectedCrew] = useState("");
  const [selectedAcft, setSelectedAcft] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [timezone, setTimezone] = useState("UTC");
  const [busyPdf, setBusyPdf] = useState(false);

  useEffect(() => {
    if (isLimited && availableCrew.length === 1)
      setSelectedCrew(availableCrew[0].id);
  }, [isLimited, availableCrew]);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}-${d.getUTCFullYear()}`;
  };
  const activeTimeFormat =
    settings?.timeFormat ||
    (typeof window !== "undefined" && window.__AEROOPS_TIME_FORMAT) ||
    "24";

  const fmtTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    let h, m;
    if (timezone === "UTC") {
      h = d.getUTCHours();
      m = d.getUTCMinutes();
    } else {
      h = d.getHours();
      m = d.getMinutes();
    }
    if (activeTimeFormat === "12") {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const addMinutes = (iso, mins) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() + mins * 60000).toISOString();
  };

  const isCompleted = (f) => {
    const a = f.actual || {};
    return a.std && a.sta && !a.cancelled && f.status !== "CANCELLED";
  };

  /* ⭐ v7.3 — Crew Hours: صف لكل (رحلة × slot) */
  const crewHoursFiltered = useMemo(() => {
    if (!selectedCrew) return [];
    const from = new Date(fromDate + "T00:00:00Z").getTime();
    const to = new Date(toDate + "T23:59:59Z").getTime();

    const result = [];
    flights.forEach((f) => {
      if (selectedAcft && f.acft !== selectedAcft) return;
      if (!isCompleted(f)) return;
      const t = new Date(f.actual?.std || f.std).getTime();
      if (t < from || t > to) return;

      const slots = safeArray(f.crewSlots);

      slots
        .filter((s) => s.crewId === selectedCrew)
        .forEach((slot) => {
          result.push({ flight: f, slot });
        });
    });

    return result.sort(
      (a, b) =>
        new Date(a.flight.actual?.std || a.flight.std).getTime() -
        new Date(b.flight.actual?.std || b.flight.std).getTime()
    );
  }, [flights, selectedCrew, selectedAcft, fromDate, toDate]);

  const crewHoursRows = useMemo(() => {
    return crewHoursFiltered.map(({ flight: f, slot }) => {
      const a = f.actual || {};
      const baseStd = a.std || f.std;
      const baseSta = a.sta || f.sta;
      const blockMin = Math.max(
        0,
        Math.round(
          (new Date(baseSta).getTime() - new Date(baseStd).getTime()) / 60000
        )
      );
      let flightMin = 0;
      if (a.takeoff && a.landing) {
        const tko = new Date(a.takeoff);
        const lnd = new Date(a.landing);
        if (!isNaN(tko.getTime()) && !isNaN(lnd.getTime()))
          flightMin = Math.max(
            0,
            Math.round((lnd.getTime() - tko.getTime()) / 60000)
          );
      }
      const nightMin = Math.max(0, Number(a.night) || 0);
      const instrumentMin = Math.max(0, Number(a.instrument) || 0);
      const acftType = fleet.find((x) => x.reg === f.acft)?.type || "—";
      const func =
        POS_SHORT_MAP[slot.position] || slot.position?.toUpperCase() || "—";

      const comSlot = (f.crewSlots || []).find((s) => s.position === "captain");
      const comMember = comSlot
        ? crew.find((c) => c.id === comSlot.crewId)
        : null;
      const com = comMember?.fullName || "—";

      return {
        id: `${f.id}-${slot.position}`,
        flightId: f.id,
        position: slot.position,
        date: fmtDate(baseStd),
        acftType,
        reg: f.acft || "—",
        flightNo: f.flightNo,
        adep: f.dep,
        ades: f.arr,
        blockOff: fmtTime(baseStd),
        t_o: a.takeoff ? fmtTime(a.takeoff) : "—",
        lnd: a.landing ? fmtTime(a.landing) : "—",
        blockOn: fmtTime(baseSta),
        blockMin,
        block: blockMin > 0 ? fmtDuty(blockMin) : "—",
        flightMin,
        flight: flightMin > 0 ? fmtDuty(flightMin) : "—",
        nightMin,
        night: nightMin > 0 ? fmtDuty(nightMin) : "—",
        instrumentMin,
        instrument: instrumentMin > 0 ? fmtDuty(instrumentMin) : "—",
        func,
        com,
        showFlightTime: flightMin > 0,
        showNight: nightMin > 0,
        showInstrument: instrumentMin > 0,
      };
    });
  }, [crewHoursFiltered, fleet, crew, timezone, activeTimeFormat]);

  /* ⭐ v7.3 — Summary مع byPosition (ساعات حسب الوظيفة) */
  const crewHoursSummary = useMemo(() => {
    const totals = {
      blockMin: 0,
      flightMin: 0,
      nightMin: 0,
      instrumentMin: 0,
      sectors: crewHoursRows.length,
      uniqueFlights: 0,
      byType: {},
      byPosition: {},
    };

    const seenFlights = new Set();
    crewHoursRows.forEach((r) => {
      // byPosition: كل تعيين على حدة
      if (!totals.byPosition[r.func]) {
        totals.byPosition[r.func] = {
          blockMin: 0,
          flightMin: 0,
          nightMin: 0,
          instrumentMin: 0,
          sectors: 0,
        };
      }
      totals.byPosition[r.func].blockMin += r.blockMin;
      totals.byPosition[r.func].flightMin += r.flightMin;
      totals.byPosition[r.func].nightMin += r.nightMin;
      totals.byPosition[r.func].instrumentMin += r.instrumentMin;
      totals.byPosition[r.func].sectors += 1;

      // byType + totals: مرة واحدة لكل رحلة
      if (!seenFlights.has(r.flightId)) {
        seenFlights.add(r.flightId);
        totals.uniqueFlights += 1;
        totals.blockMin += r.blockMin;
        totals.flightMin += r.flightMin;
        totals.nightMin += r.nightMin;
        totals.instrumentMin += r.instrumentMin;
      }

      if (!totals.byType[r.acftType])
        totals.byType[r.acftType] = {
          block: 0,
          flight: 0,
          sectors: 0,
          _seenSet: new Set(),
        };

      if (!totals.byType[r.acftType]._seenSet.has(r.flightId)) {
        totals.byType[r.acftType]._seenSet.add(r.flightId);
        totals.byType[r.acftType].block += r.blockMin;
        totals.byType[r.acftType].flight += r.flightMin;
      }
      totals.byType[r.acftType].sectors += 1;
    });

    Object.values(totals.byType).forEach((v) => delete v._seenSet);

    return totals;
  }, [crewHoursRows]);

  /* ⭐ v7.3 — Full Report: كل الطاقم، كل الرحلات في النطاق */
  const fullReportFiltered = useMemo(() => {
    const from = new Date(fromDate + "T00:00:00Z").getTime();
    const to = new Date(toDate + "T23:59:59Z").getTime();

    return flights
      .filter((f) => {
        if (selectedAcft && f.acft !== selectedAcft) return false;
        if (!isCompleted(f)) return false;
        const t = new Date(f.actual?.std || f.std).getTime();
        return t >= from && t <= to;
      })
      .sort(
        (a, b) =>
          new Date(a.actual?.std || a.std).getTime() -
          new Date(b.actual?.std || b.std).getTime()
      );
  }, [flights, selectedAcft, fromDate, toDate]);

  /* ⭐ Full Report Rows — صف لكل رحلة */
  const fullReportRows = useMemo(() => {
    return fullReportFiltered.map((f) => {
      const a = f.actual || {};
      const baseStd = a.std || f.std;
      const baseSta = a.sta || f.sta;
      const blockMin = Math.max(
        0,
        Math.round(
          (new Date(baseSta).getTime() - new Date(baseStd).getTime()) / 60000
        )
      );
      let flightMin = 0;
      if (a.takeoff && a.landing) {
        const tko = new Date(a.takeoff);
        const lnd = new Date(a.landing);
        if (!isNaN(tko.getTime()) && !isNaN(lnd.getTime()))
          flightMin = Math.max(
            0,
            Math.round((lnd.getTime() - tko.getTime()) / 60000)
          );
      }
      const nightMin = Math.max(0, Number(a.night) || 0);
      const instrumentMin = Math.max(0, Number(a.instrument) || 0);
      const acftType = fleet.find((x) => x.reg === f.acft)?.type || "—";

      const slots = (f.crewSlots || []).map((s) => ({
        ...s,
        member: crew.find((c) => c.id === s.crewId),
      }));
      const com =
        slots.find((s) => s.position === "captain")?.member?.fullName || "—";
      const sic =
        slots.find((s) => s.position === "firstOfficer")?.member?.fullName ||
        "—";

      return {
        id: f.id,
        date: fmtDate(baseStd),
        acftType,
        reg: f.acft || "—",
        flightNo: f.flightNo,
        adep: f.dep,
        ades: f.arr,
        blockOff: fmtTime(baseStd),
        t_o: a.takeoff ? fmtTime(a.takeoff) : "—",
        lnd: a.landing ? fmtTime(a.landing) : "—",
        blockOn: fmtTime(baseSta),
        blockMin,
        block: blockMin > 0 ? fmtDuty(blockMin) : "—",
        flightMin,
        flight: flightMin > 0 ? fmtDuty(flightMin) : "—",
        nightMin,
        night: nightMin > 0 ? fmtDuty(nightMin) : "—",
        instrumentMin,
        instrument: instrumentMin > 0 ? fmtDuty(instrumentMin) : "—",
        com,
        sic,
        crewCount: slots.filter((s) => s.member).length,
      };
    });
    }, [fullReportFiltered, fleet, crew, timezone, activeTimeFormat]);

  /* ⭐ Full Report Summary — مجموع كل الرحلات */
  const fullReportSummary = useMemo(() => {
    const totals = {
      blockMin: 0,
      flightMin: 0,
      nightMin: 0,
      instrumentMin: 0,
      sectors: fullReportRows.length,
      byType: {},
    };

    fullReportRows.forEach((r) => {
      totals.blockMin += r.blockMin;
      totals.flightMin += r.flightMin;
      totals.nightMin += r.nightMin;
      totals.instrumentMin += r.instrumentMin;

      if (!totals.byType[r.acftType])
        totals.byType[r.acftType] = {
          block: 0,
          flight: 0,
          sectors: 0,
        };
      totals.byType[r.acftType].block += r.blockMin;
      totals.byType[r.acftType].flight += r.flightMin;
      totals.byType[r.acftType].sectors += 1;
    });

    return totals;
  }, [fullReportRows]);

  /* ⭐ Full Report by Position — إجمالي الساعات لكل وظيفة (مجموع كل الأعضاء) */
  const fullReportByPosition = useMemo(() => {
    const byPos = {};
    fullReportFiltered.forEach((f) => {
      const a = f.actual || {};
      const baseStd = a.std || f.std;
      const baseSta = a.sta || f.sta;
      const blockMin = Math.max(
        0,
        Math.round(
          (new Date(baseSta).getTime() - new Date(baseStd).getTime()) / 60000
        )
      );
      const slots = safeArray(f.crewSlots);
      slots.forEach((s) => {
        if (!s.crewId) return;
        const pos =
          POS_SHORT_MAP[s.position] || s.position?.toUpperCase() || "—";
        if (!byPos[pos]) byPos[pos] = { blockMin: 0, sectors: 0 };
        byPos[pos].blockMin += blockMin;
        byPos[pos].sectors += 1;
      });
    });
    return byPos;
  }, [fullReportFiltered]);

  /* ⭐ Completed Flights (v7.2 — محفوظة كما هي) */
  const completedFlightsFiltered = useMemo(() => {
    const from = new Date(fromDate + "T00:00:00Z").getTime();
    const to = new Date(toDate + "T23:59:59Z").getTime();
    return flights
      .filter((f) => {
        if (selectedAcft && f.acft !== selectedAcft) return false;
        if (!isCompleted(f)) return false;
        const t = new Date(f.actual?.std || f.std).getTime();
        return t >= from && t <= to;
      })
      .sort(
        (a, b) =>
          new Date(a.actual?.std || a.std).getTime() -
          new Date(b.actual?.std || b.std).getTime()
      );
  }, [flights, selectedAcft, fromDate, toDate]);

  const completedFlightsRows = useMemo(() => {
    return completedFlightsFiltered.map((f) => {
      const a = f.actual || {};
      const baseStd = a.std || f.std;
      const baseSta = a.sta || f.sta;
      const acftType = fleet.find((x) => x.reg === f.acft)?.type || "—";
      const slots = (f.crewSlots || []).map((s) => ({
        ...s,
        member: crew.find((c) => c.id === s.crewId),
      }));
      const com =
        slots.find((s) => s.position === "captain")?.member?.fullName || "—";
      const sic =
        slots.find((s) => s.position === "firstOfficer")?.member?.fullName ||
        "—";
      return {
        id: f.id,
        date: fmtDate(baseStd),
        acftType,
        reg: f.acft || "—",
        flightNo: f.flightNo,
        adep: f.dep,
        ades: f.arr,
        blockOff: fmtTime(baseStd),
        t_o: a.takeoff ? fmtTime(a.takeoff) : "—",
        lnd: a.landing ? fmtTime(a.landing) : "—",
        blockOn: fmtTime(baseSta),
        com,
        sic,
      };
    });
  }, [completedFlightsFiltered, fleet, crew, timezone, activeTimeFormat]);

  const completedFlightsSummary = useMemo(() => {
    const totals = { count: 0, byType: {} };
    completedFlightsRows.forEach((r) => {
      totals.count += 1;
      if (!totals.byType[r.acftType]) totals.byType[r.acftType] = { count: 0 };
      totals.byType[r.acftType].count += 1;
    });
    return totals;
  }, [completedFlightsRows]);

  /* ⭐ Duty Time (v7.2 — محفوظة) */
  const dutyTimeFiltered = useMemo(() => {
    if (!selectedCrew) return [];
    const from = new Date(fromDate + "T00:00:00Z").getTime();
    const to = new Date(toDate + "T23:59:59Z").getTime();

    const result = [];
    flights.forEach((f) => {
      if (selectedAcft && f.acft !== selectedAcft) return;
      if (!isCompleted(f)) return;
      const t = new Date(f.actual?.std || f.std).getTime();
      if (t < from || t > to) return;

      const slots = safeArray(f.crewSlots);

      slots
        .filter((s) => s.crewId === selectedCrew)
        .forEach((slot) => {
          result.push({ flight: f, slot });
        });
    });

    return result.sort(
      (a, b) =>
        new Date(a.flight.actual?.std || a.flight.std).getTime() -
        new Date(b.flight.actual?.std || b.flight.std).getTime()
    );
  }, [flights, selectedCrew, selectedAcft, fromDate, toDate]);

  const dutyTimeRows = useMemo(() => {
    return dutyTimeFiltered.map(({ flight: f, slot }) => {
      const a = f.actual || {};
      const scheduledStd = f.std;
      const actualSta = a.sta || f.sta;
      const dutyStartISO = addMinutes(scheduledStd, -60);
      const dutyEndISO = addMinutes(actualSta, 30);
      const dutyMin =
        dutyStartISO && dutyEndISO
          ? Math.max(
              0,
              Math.round(
                (new Date(dutyEndISO).getTime() -
                  new Date(dutyStartISO).getTime()) /
                  60000
              )
            )
          : 0;
      const acftType = fleet.find((x) => x.reg === f.acft)?.type || "—";
      const func =
        POS_SHORT_MAP[slot.position] || slot.position?.toUpperCase() || "—";

      return {
        id: `${f.id}-${slot.position}`,
        flightId: f.id,
        position: slot.position,
        date: fmtDate(f.std),
        acftType,
        reg: f.acft || "—",
        flightNo: f.flightNo,
        adep: f.dep,
        ades: f.arr,
        stdSched: fmtTime(f.std),
        staActual: fmtTime(actualSta),
        dutyStart: fmtTime(dutyStartISO),
        dutyEnd: fmtTime(dutyEndISO),
        dutyMin,
        duty: dutyMin > 0 ? fmtDuty(dutyMin) : "—",
        func,
      };
    });
  }, [dutyTimeFiltered, fleet, timezone, activeTimeFormat]);

  const dutyTimeSummary = useMemo(() => {
    const totals = { dutyMin: 0, sectors: dutyTimeRows.length, byType: {} };
    const seenFlights = new Set();

    dutyTimeRows.forEach((r) => {
      if (!seenFlights.has(r.flightId)) {
        seenFlights.add(r.flightId);
        totals.dutyMin += r.dutyMin;
      }

      if (!totals.byType[r.acftType])
        totals.byType[r.acftType] = {
          duty: 0,
          sectors: 0,
          _seenSet: new Set(),
        };

      if (!totals.byType[r.acftType]._seenSet.has(r.flightId)) {
        totals.byType[r.acftType]._seenSet.add(r.flightId);
        totals.byType[r.acftType].duty += r.dutyMin;
      }
      totals.byType[r.acftType].sectors += 1;
    });

    Object.values(totals.byType).forEach((v) => delete v._seenSet);

    return totals;
  }, [dutyTimeRows]);

  const personInfo = selectedCrew
    ? crew.find((c) => c.id === selectedCrew)
    : null;
  const personFullName = personInfo?.fullName || "—";
  const personEmpNo = personInfo?.empNo || "";
  const personName = personEmpNo
    ? `${personEmpNo} - ${personFullName}`
    : personFullName;
  const periodLabel = `${fmtDate(fromDate)} - ${fmtDate(toDate)}`;
  const issueDate = fmtDate(new Date().toISOString());

  const hasAnyFlightTime = crewHoursRows.some((r) => r.showFlightTime);
  const hasAnyNight = crewHoursRows.some((r) => r.showNight);
  const hasAnyInstrument = crewHoursRows.some((r) => r.showInstrument);

  /* ═══════════════════════════════════════════════════════════
   * EXPORT PDF — مع byPosition + Full Report
   * ═══════════════════════════════════════════════════════════ */
  const exportPDF = async (showStamp = false) => {
    if (showStamp && !canExportStamp) return;
    if (!showStamp && !canExportNoStamp) return;
    setBusyPdf(true);
    try {
      const pdf = await PDFDocument.create();
      let page = pdf.addPage([842, 595]);
      const { height, width } = page.getSize();
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontMono = await pdf.embedFont(StandardFonts.Courier);

      let logoImage = null;
      if (settings?.logo) {
        try {
          const lRes = await fetch(logoToDisplayUrl(settings.logo));
          const lBytes = await lRes.arrayBuffer();
          try {
            logoImage = await pdf.embedPng(new Uint8Array(lBytes));
          } catch {
            logoImage = await pdf.embedJpg(new Uint8Array(lBytes));
          }
        } catch (e) {
          console.warn("Logo failed:", e.message);
        }
      }

      if (logoImage) {
        const dims = logoImage.scale(0.3);
        const scale = Math.min(1, 55 / dims.height);
        page.drawImage(logoImage, {
          x: 25,
          y: height - 75,
          width: dims.width * scale,
          height: dims.height * scale,
        });
      }

      const reportTitle =
        activeSubTab === "crewHours"
          ? t.crewHoursReport || "Flights by Crew Member"
          : activeSubTab === "fullReport"
          ? t.fullReport || "Full Report — All Flights"
          : activeSubTab === "completedFlights"
          ? t.completedFlights || "Completed Flights"
          : t.dutyTimeReport || "Crew Duty Time";

      page.drawText(reportTitle, {
        x: width / 2 - (activeSubTab === "crewHours" ? 90 : 110),
        y: height - 35,
        size: 20,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.2),
      });
      page.drawRectangle({
        x: width - 120,
        y: height - 55,
        width: 100,
        height: 40,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      });
      page.drawText(t.dateOfIssue || "Date of Issue", {
        x: width - 115,
        y: height - 32,
        size: 9,
        font: fontBold,
        color: rgb(0.4, 0.4, 0.5),
      });
      page.drawText(issueDate, {
        x: width - 115,
        y: height - 48,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.2),
      });

      if (activeSubTab === "crewHours" || activeSubTab === "dutyTime") {
        page.drawText(pdfSafe(personName), {
          x: 25,
          y: height - 95,
          size: 16,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.2),
        });
      } else if (activeSubTab === "fullReport") {
        page.drawText(
          (t.totalFlights || "Total Flights") +
            ": " +
            fullReportSummary.sectors,
          {
            x: 25,
            y: height - 95,
            size: 16,
            font: fontBold,
            color: rgb(0.1, 0.2, 0.5),
          }
        );
      } else {
        page.drawText(
          (t.totalSectors || "Total Sectors") +
            ": " +
            completedFlightsSummary.count,
          {
            x: 25,
            y: height - 95,
            size: 16,
            font: fontBold,
            color: rgb(0.1, 0.4, 0.2),
          }
        );
      }
      page.drawText(pdfSafe(periodLabel), {
        x: width - 150,
        y: height - 95,
        size: 11,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.4),
      });
      page.drawLine({
        start: { x: 20, y: height - 105 },
        end: { x: width - 20, y: height - 105 },
        thickness: 1.5,
        color: rgb(0, 0, 0),
      });

      let y = height - 130;

      /* ═══ Summary Tables ═══ */
      if (activeSubTab === "crewHours") {
        // byType
        page.drawText("Aircraft Type", { x: 25, y, size: 10, font: fontBold });
        page.drawText("Block", { x: 130, y, size: 10, font: fontBold });
        page.drawText("Flight time", { x: 200, y, size: 10, font: fontBold });
        page.drawText("Sectors", { x: 280, y, size: 10, font: fontBold });
        y -= 15;
        page.drawText("Total", { x: 25, y, size: 11, font: fontBold });
        page.drawText(fmtDuty(crewHoursSummary.blockMin), {
          x: 130,
          y,
          size: 11,
          font: fontBold,
        });
        page.drawText(fmtDuty(crewHoursSummary.flightMin), {
          x: 200,
          y,
          size: 11,
          font: fontBold,
        });
        page.drawText(String(crewHoursSummary.sectors), {
          x: 280,
          y,
          size: 11,
          font: fontBold,
        });
        y -= 18;
        Object.entries(crewHoursSummary.byType).forEach(([type, data]) => {
          page.drawText(type, { x: 25, y, size: 11, font: fontBold });
          page.drawText(fmtDuty(data.block), { x: 130, y, size: 11, font });
          page.drawText(fmtDuty(data.flight), { x: 200, y, size: 11, font });
          page.drawText(String(data.sectors), { x: 280, y, size: 11, font });
          y -= 14;
        });

        y -= 10;

        // ⭐ byPosition
        const posEntries = Object.entries(crewHoursSummary.byPosition || {});
        if (posEntries.length > 0) {
          page.drawText("Hours by Position", {
            x: 25,
            y,
            size: 12,
            font: fontBold,
            color: rgb(0.3, 0.2, 0.6),
          });
          y -= 15;
          page.drawText("Position", { x: 25, y, size: 10, font: fontBold });
          page.drawText("Block", { x: 130, y, size: 10, font: fontBold });
          page.drawText("Flight time", { x: 200, y, size: 10, font: fontBold });
          page.drawText("Sectors", { x: 280, y, size: 10, font: fontBold });
          y -= 15;

          posEntries
            .sort(([a], [b]) => POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b))
            .forEach(([pos, data]) => {
              page.drawText(pos, { x: 25, y, size: 11, font: fontBold });
              page.drawText(fmtDuty(data.blockMin), {
                x: 130,
                y,
                size: 11,
                font,
              });
              page.drawText(
                data.flightMin > 0 ? fmtDuty(data.flightMin) : "—",
                { x: 200, y, size: 11, font }
              );
              page.drawText(String(data.sectors), {
                x: 280,
                y,
                size: 11,
                font,
              });
              y -= 14;
            });

          y -= 5;
          page.drawLine({
            start: { x: 20, y },
            end: { x: 320, y },
            thickness: 1,
            color: rgb(0.5, 0.5, 0.7),
          });
          y -= 12;
          page.drawText("TOTAL", { x: 25, y, size: 11, font: fontBold });
          page.drawText(fmtDuty(crewHoursSummary.blockMin), {
            x: 130,
            y,
            size: 11,
            font: fontBold,
          });
          page.drawText(fmtDuty(crewHoursSummary.flightMin), {
            x: 200,
            y,
            size: 11,
            font: fontBold,
          });
          page.drawText(String(crewHoursSummary.sectors), {
            x: 280,
            y,
            size: 11,
            font: fontBold,
          });
          y -= 12;
          page.drawText(
            "Note: Total Block is unique per flight (not duplicated if member is in multiple positions on same flight).",
            { x: 25, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
          );
          y -= 15;
        }
      } else if (activeSubTab === "fullReport") {
        // byType
        page.drawText("Aircraft Type", { x: 25, y, size: 10, font: fontBold });
        page.drawText("Block", { x: 130, y, size: 10, font: fontBold });
        page.drawText("Flight time", { x: 200, y, size: 10, font: fontBold });
        page.drawText("Sectors", { x: 280, y, size: 10, font: fontBold });
        y -= 15;
        page.drawText("Total", { x: 25, y, size: 11, font: fontBold });
        page.drawText(fmtDuty(fullReportSummary.blockMin), {
          x: 130,
          y,
          size: 11,
          font: fontBold,
        });
        page.drawText(fmtDuty(fullReportSummary.flightMin), {
          x: 200,
          y,
          size: 11,
          font: fontBold,
        });
        page.drawText(String(fullReportSummary.sectors), {
          x: 280,
          y,
          size: 11,
          font: fontBold,
        });
        y -= 18;
        Object.entries(fullReportSummary.byType).forEach(([type, data]) => {
          page.drawText(type, { x: 25, y, size: 11, font: fontBold });
          page.drawText(fmtDuty(data.block), { x: 130, y, size: 11, font });
          page.drawText(fmtDuty(data.flight), { x: 200, y, size: 11, font });
          page.drawText(String(data.sectors), { x: 280, y, size: 11, font });
          y -= 14;
        });

        y -= 10;

        // ⭐ byPosition (full report — مجموع كل الطاقم)
        const posEntries = Object.entries(fullReportByPosition || {});
        if (posEntries.length > 0) {
          page.drawText("Total Hours by Position (All Crew)", {
            x: 25,
            y,
            size: 12,
            font: fontBold,
            color: rgb(0.3, 0.2, 0.6),
          });
          y -= 15;
          page.drawText("Position", { x: 25, y, size: 10, font: fontBold });
          page.drawText("Block", { x: 130, y, size: 10, font: fontBold });
          page.drawText("Sectors", { x: 280, y, size: 10, font: fontBold });
          y -= 15;
          posEntries
            .sort(([a], [b]) => POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b))
            .forEach(([pos, data]) => {
              page.drawText(pos, { x: 25, y, size: 11, font: fontBold });
              page.drawText(fmtDuty(data.blockMin), {
                x: 130,
                y,
                size: 11,
                font,
              });
              page.drawText(String(data.sectors), {
                x: 280,
                y,
                size: 11,
                font,
              });
              y -= 14;
            });
          y -= 10;
        }
      } else if (activeSubTab === "completedFlights") {
        page.drawText("Sectors", { x: 100, y, size: 10, font: fontBold });
        y -= 15;
        page.drawText("Total", { x: 25, y, size: 11, font: fontBold });
        page.drawText(String(completedFlightsSummary.count), {
          x: 100,
          y,
          size: 11,
          font: fontBold,
        });
        y -= 18;
        Object.entries(completedFlightsSummary.byType).forEach(
          ([type, data]) => {
            page.drawText(type, { x: 25, y, size: 11, font: fontBold });
            page.drawText(String(data.count), { x: 100, y, size: 11, font });
            y -= 14;
          }
        );
      } else if (activeSubTab === "dutyTime") {
        page.drawText("Duty Time", { x: 100, y, size: 10, font: fontBold });
        page.drawText("Sectors", { x: 180, y, size: 10, font: fontBold });
        y -= 15;
        page.drawText("Total", { x: 25, y, size: 11, font: fontBold });
        page.drawText(fmtDuty(dutyTimeSummary.dutyMin), {
          x: 100,
          y,
          size: 11,
          font: fontBold,
        });
        page.drawText(String(dutyTimeSummary.sectors), {
          x: 180,
          y,
          size: 11,
          font: fontBold,
        });
        y -= 18;
        Object.entries(dutyTimeSummary.byType).forEach(([type, data]) => {
          page.drawText(type, { x: 25, y, size: 11, font: fontBold });
          page.drawText(fmtDuty(data.duty), { x: 100, y, size: 11, font });
          page.drawText(String(data.sectors), { x: 180, y, size: 11, font });
          y -= 14;
        });
      }

      y -= 10;
      page.drawText(
        "Total sum may not be the sum of each positions because pilots can be assigned to several positions at the same time.",
        { x: 25, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }
      );
      y -= 30;

      /* ═══ Detail Table ═══ */
      let detailCols;
      if (activeSubTab === "crewHours") {
        detailCols = [
          { x: 20, label: "Date" },
          { x: 80, label: "Aircraft" },
          { x: 130, label: "Reg." },
          { x: 175, label: "Flight No." },
          { x: 235, label: "ADEP" },
          { x: 280, label: "ADES" },
          { x: 325, label: "BLOCK OFF" },
          { x: 405, label: "T/O" },
          { x: 455, label: "LND" },
          { x: 505, label: "BLOCK ON" },
          { x: 580, label: "BLOCK" },
          ...(hasAnyFlightTime ? [{ x: 635, label: "Flight time" }] : []),
          ...(hasAnyNight ? [{ x: 700, label: "Night" }] : []),
          ...(hasAnyInstrument ? [{ x: 750, label: "Instr" }] : []),
          { x: 795, label: "Func." },
        ];
      } else if (activeSubTab === "fullReport") {
        detailCols = [
          { x: 20, label: "Date" },
          { x: 80, label: "Aircraft" },
          { x: 130, label: "Reg." },
          { x: 175, label: "Flight No." },
          { x: 235, label: "ADEP" },
          { x: 280, label: "ADES" },
          { x: 325, label: "OFF" },
          { x: 375, label: "T/O" },
          { x: 425, label: "LND" },
          { x: 470, label: "ON" },
          { x: 520, label: "BLOCK" },
          { x: 575, label: "Flight" },
          { x: 630, label: "COM" },
          { x: 720, label: "SIC" },
        ];
      } else if (activeSubTab === "completedFlights") {
        detailCols = [
          { x: 20, label: "Date" },
          { x: 85, label: "Aircraft" },
          { x: 140, label: "Reg." },
          { x: 195, label: "Flight No." },
          { x: 260, label: "ADEP" },
          { x: 305, label: "ADES" },
          { x: 350, label: "OFF" },
          { x: 405, label: "T/O" },
          { x: 455, label: "LND" },
          { x: 500, label: "ON" },
          { x: 550, label: "Sector" },
          { x: 610, label: "COM" },
          { x: 690, label: "SIC" },
        ];
      } else {
        detailCols = [
          { x: 20, label: "Date" },
          { x: 80, label: "Aircraft" },
          { x: 130, label: "Reg." },
          { x: 175, label: "Flight No." },
          { x: 235, label: "ADEP" },
          { x: 280, label: "ADES" },
          { x: 325, label: "STD" },
          { x: 380, label: "STA (Act)" },
          { x: 450, label: "Duty Start" },
          { x: 530, label: "Duty End" },
          { x: 610, label: "Duty" },
        ];
      }

      const drawDetailHeader = () => {
        page.drawRectangle({
          x: 15,
          y: y - 6,
          width: width - 30,
          height: 22,
          color: rgb(0.9, 0.9, 0.9),
        });
        detailCols.forEach((c) =>
          page.drawText(c.label, { x: c.x, y, size: 10, font: fontBold })
        );
        y -= 22;
      };
      drawDetailHeader();

      const activeRows =
        activeSubTab === "crewHours"
          ? crewHoursRows
          : activeSubTab === "fullReport"
          ? fullReportRows
          : activeSubTab === "completedFlights"
          ? completedFlightsRows
          : dutyTimeRows;

      activeRows.forEach((r) => {
        if (y < 40) {
          page = pdf.addPage([842, 595]);
          y = 555;
          drawDetailHeader();
        }
        let vals;
        if (activeSubTab === "crewHours") {
          vals = [
            r.date,
            r.acftType,
            r.reg,
            r.flightNo,
            r.adep,
            r.ades,
            r.blockOff,
            r.t_o,
            r.lnd,
            r.blockOn,
            r.block,
          ];
          if (hasAnyFlightTime) vals.push(r.flight);
          if (hasAnyNight) vals.push(r.night);
          if (hasAnyInstrument) vals.push(r.instrument);
          vals.push(r.func);
        } else if (activeSubTab === "fullReport") {
          vals = [
            r.date,
            r.acftType,
            r.reg,
            r.flightNo,
            r.adep,
            r.ades,
            r.blockOff,
            r.t_o,
            r.lnd,
            r.blockOn,
            r.block,
            r.flight,
            r.com.substring(0, 15),
            r.sic.substring(0, 15),
          ];
        } else if (activeSubTab === "completedFlights") {
          vals = [
            r.date,
            r.acftType,
            r.reg,
            r.flightNo,
            r.adep,
            r.ades,
            r.blockOff,
            r.t_o,
            r.lnd,
            r.blockOn,
            "1",
            r.com.substring(0, 15),
            r.sic.substring(0, 15),
          ];
        } else {
          vals = [
            r.date,
            r.acftType,
            r.reg,
            r.flightNo,
            r.adep,
            r.ades,
            r.stdSched,
            r.staActual,
            r.dutyStart,
            r.dutyEnd,
            r.duty,
          ];
        }
        vals.forEach((v, i) =>
          page.drawText(pdfSafe(String(v || "")), {
            x: detailCols[i].x,
            y,
            size: 9,
            font: fontMono,
          })
        );
        y -= 16;
      });

      /* ═══ Total Row ═══ */
      y -= 10;
      page.drawRectangle({
        x: 15,
        y: y - 5,
        width: width - 30,
        height: 20,
        color: rgb(0.85, 0.95, 0.85),
      });
      page.drawText(t.totalLabel || "TOTAL", {
        x: 20,
        y: y + 2,
        size: 11,
        font: fontBold,
      });
      if (activeSubTab === "crewHours")
        page.drawText(fmtDuty(crewHoursSummary.blockMin), {
          x: 580,
          y: y + 2,
          size: 11,
          font: fontBold,
        });
      else if (activeSubTab === "fullReport")
        page.drawText(fmtDuty(fullReportSummary.blockMin), {
          x: 520,
          y: y + 2,
          size: 11,
          font: fontBold,
        });
      else if (activeSubTab === "completedFlights")
        page.drawText(String(completedFlightsSummary.count), {
          x: 550,
          y: y + 2,
          size: 11,
          font: fontBold,
        });
      else if (activeSubTab === "dutyTime")
        page.drawText(fmtDuty(dutyTimeSummary.dutyMin), {
          x: 610,
          y: y + 2,
          size: 11,
          font: fontBold,
        });

      /* ═══ Stamp ═══ */
      if (showStamp && settings?.stamp) {
        try {
          const sRes = await fetch(logoToDisplayUrl(settings.stamp));
          const sBytes = await sRes.arrayBuffer();
          let stampImage;
          try {
            stampImage = await pdf.embedPng(new Uint8Array(sBytes));
          } catch {
            stampImage = await pdf.embedJpg(new Uint8Array(sBytes));
          }
          if (stampImage) {
            const pages = pdf.getPages();
            pages.forEach((p) => {
              const { height } = p.getSize();
              const dims = stampImage.scale(0.5);
              const scale = Math.min(1, 65 / dims.height);
              p.drawImage(stampImage, {
                x: 50,
                y: 40,
                width: dims.width * scale,
                height: dims.height * scale,
                opacity: 0.8,
              });
            });
          }
        } catch (e) {
          console.warn("Stamp failed in PDF:", e.message);
        }
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const suffix = showStamp ? "_Stamped" : "_NoStamp";
      a.download =
        activeSubTab === "crewHours"
          ? `Crew_${
              personInfo?.empNo || "report"
            }_${fromDate}_${toDate}${suffix}.pdf`
          : activeSubTab === "fullReport"
          ? `Full_Report_${fromDate}_${toDate}${suffix}.pdf`
          : activeSubTab === "completedFlights"
          ? `Completed_Flights_${fromDate}_${toDate}${suffix}.pdf`
          : `Duty_Time_${
              personInfo?.empNo || "report"
            }_${fromDate}_${toDate}${suffix}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast("PDF failed: " + e.message);
      console.error(e);
    } finally {
      setBusyPdf(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4 fade-in">
      {/* ═══ UNIFIED REPORTS & ANALYTICS HUB HEADER ═══ */}
      <div
        className="rounded-xl p-4 border"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1
                className="text-lg md:text-xl font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {isAr
                  ? "مركز التقارير والإحصائيات الشامل"
                  : "Unified Reports & Analytics Hub"}
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isAr
                  ? "ساعات الطاقم · التقرير الشامل · الرحلات المنفذة · ساعات الخدمة · الإحصائيات والرسوم البيانية"
                  : "Crew Hours · Full Flight Report · Completed Flights · Duty Time · Interactive Analytics"}
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Report Selector */}
        {reportTabs.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl"
            style={{ backgroundColor: "var(--bg-app)" }}
          >
            {reportTabs.map((rt) => {
              const TabIcon = rt.icon;
              const isActive = activeSubTab === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => setActiveSubTab(rt.id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition whitespace-nowrap"
                  style={
                    isActive
                      ? {
                          background: "var(--brand-gradient)",
                          color: "#ffffff",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  <TabIcon className="w-4 h-4 shrink-0" />
                  <span>{isAr ? rt.labelAr : rt.labelEn}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLimited &&
        (activeSubTab === "crewHours" || activeSubTab === "dutyTime") && (
          <div className="bg-gradient-to-r from-sky-500 to-indigo-600 rounded-lg p-3 text-white shadow-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">
                ساعاتي فقط — {personInfo?.fullName || user?.fullName}
              </div>
              <div className="text-[10px] text-sky-100">
                يمكنك عرض ساعاتك فقط
              </div>
            </div>
            <Lock className="w-5 h-5 text-white/70" />
          </div>
        )}

      {/* ═══ Filters (Tabular Flight/Crew Reports Only) ═══ */}
      {activeSubTab !== "charts" && (
        <div
          className="border rounded-xl p-3.5"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
        <div
          className={`grid grid-cols-2 gap-2 ${
            activeSubTab === "crewHours" || activeSubTab === "dutyTime"
              ? "md:grid-cols-6"
              : "md:grid-cols-5"
          }`}
        >
          {(activeSubTab === "crewHours" || activeSubTab === "dutyTime") && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                👤 {t.crewMember || "Crew Member"}{" "}
                {isLimited && <span className="text-rose-500">🔒</span>}
              </label>
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                disabled={isLimited}
                className={`w-full px-2 py-1.5 border rounded text-xs ${
                  isLimited
                    ? "bg-slate-100 dark:bg-slate-700 cursor-not-allowed text-slate-500"
                    : "bg-white dark:bg-slate-900"
                }`}
              >
                <option value="">— {t.selectCrew || "Select Crew"} —</option>
                {availableCrew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.empNo} - {c.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              ✈️ {t.aircraft || "Aircraft"}
            </label>
            <select
              value={selectedAcft}
              onChange={(e) => setSelectedAcft(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-xs bg-white dark:bg-slate-900"
            >
              <option value="">{t.allAircraft || "All Aircraft"}</option>
              {fleet.map((a) => (
                <option key={a.id} value={a.reg}>
                  {a.reg}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              📅 {t.fromDate || "From"}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-xs bg-white dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              📅 {t.toDate || "To"}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-xs bg-white dark:bg-slate-900"
            />
          </div>
          <div className="flex items-end gap-1 col-span-2 md:col-span-2">
            <button
              onClick={() => exportPDF(true)}
              disabled={
                busyPdf ||
                ((activeSubTab === "crewHours" ||
                  activeSubTab === "dutyTime") &&
                  !selectedCrew) ||
                !canExportStamp
              }
              className="w-1/2 px-2 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title={
                canExportStamp
                  ? "تصدير PDF بالختم الرسمي"
                  : "مقفل: يتطلب صلاحية الطباعة والتصدير بالختم الرسمي"
              }
            >
              <Stamp className="w-3.5 h-3.5" />{" "}
              {busyPdf ? "…" : "PDF بالختم"}
              {!canExportStamp && <Lock className="w-3 h-3" />}
            </button>
            <button
              onClick={() => exportPDF(false)}
              disabled={
                busyPdf ||
                ((activeSubTab === "crewHours" ||
                  activeSubTab === "dutyTime") &&
                  !selectedCrew) ||
                !canExportNoStamp
              }
              className="w-1/2 px-2 py-2 rounded bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title={
                canExportNoStamp
                  ? "تصدير PDF بدون ختم"
                  : "مقفل: يتطلب صلاحية الطباعة والتصدير بدون ختم"
              }
            >
              <FileX className="w-3.5 h-3.5" />{" "}
              {busyPdf ? "…" : "PDF بدون ختم"}
              {!canExportNoStamp && <Lock className="w-3 h-3" />}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: CREW HOURS
       * ═══════════════════════════════════════════════════════ */}
      {activeSubTab === "crewHours" && (
        <>
          {selectedCrew ? (
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg p-4">
              {/* Header */}
              <ReportHeader
                settings={settings}
                issueDate={issueDate}
                title={t.crewHoursReport || "Flights by Crew Member"}
              />
              <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.crewMember || "Crew Member"}
                  </div>
                  <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                    {personName}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.period || "Period"}
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {periodLabel}
                  </div>
                </div>
              </div>

              {/* Summary byType */}
              <div className="mb-4">
                <table className="w-full text-sm max-w-md">
                  <thead>
                    <tr className="text-slate-600">
                      <th className="text-start py-1"></th>
                      <th className="text-center py-1 font-bold">Block</th>
                      <th className="text-center py-1 font-bold">
                        Flight time
                      </th>
                      <th className="text-center py-1 font-bold">Sectors</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-300 font-bold">
                      <td className="py-1">Total</td>
                      <td className="text-center py-1 font-mono">
                        {fmtDuty(crewHoursSummary.blockMin)}
                      </td>
                      <td className="text-center py-1 font-mono">
                        {fmtDuty(crewHoursSummary.flightMin)}
                      </td>
                      <td className="text-center py-1 font-mono">
                        {crewHoursSummary.sectors}
                      </td>
                    </tr>
                    {Object.entries(crewHoursSummary.byType).map(
                      ([type, data]) => (
                        <tr key={type} className="border-t border-slate-200">
                          <td className="py-1">{type}</td>
                          <td className="text-center py-1 font-mono">
                            {fmtDuty(data.block)}
                          </td>
                          <td className="text-center py-1 font-mono">
                            {fmtDuty(data.flight)}
                          </td>
                          <td className="text-center py-1 font-mono">
                            {data.sectors}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* ⭐ Summary byPosition */}
              {Object.keys(crewHoursSummary.byPosition).length > 0 && (
                <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-100 mb-2 uppercase flex items-center gap-1">
                    🎯 {t.hoursByPosition || "الساعات حسب الوظيفة"}
                  </div>
                  <table className="w-full text-sm max-w-md">
                    <thead>
                      <tr className="text-indigo-700 dark:text-indigo-300">
                        <th className="text-start py-1 font-bold">Position</th>
                        <th className="text-center py-1 font-bold">Block</th>
                        <th className="text-center py-1 font-bold">
                          Flight time
                        </th>
                        <th className="text-center py-1 font-bold">Sectors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(crewHoursSummary.byPosition)
                        .sort(
                          ([a], [b]) =>
                            POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)
                        )
                        .map(([pos, data]) => (
                          <tr
                            key={pos}
                            className="border-t border-indigo-200 dark:border-indigo-800"
                          >
                            <td className="py-1 font-bold text-indigo-900 dark:text-indigo-100 font-mono">
                              {pos}
                            </td>
                            <td className="text-center py-1 font-mono font-bold bg-indigo-100 dark:bg-indigo-900/50">
                              {fmtDuty(data.blockMin)}
                            </td>
                            <td className="text-center py-1 font-mono">
                              {data.flightMin > 0
                                ? fmtDuty(data.flightMin)
                                : "—"}
                            </td>
                            <td className="text-center py-1 font-mono font-bold">
                              {data.sectors}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot className="border-t-2 border-indigo-400 dark:border-indigo-600">
                      <tr>
                        <td className="py-1 font-bold text-indigo-900 dark:text-indigo-100">
                          Total
                        </td>
                        <td className="text-center py-1 font-mono font-bold bg-indigo-200 dark:bg-indigo-900">
                          {fmtDuty(crewHoursSummary.blockMin)}
                        </td>
                        <td className="text-center py-1 font-mono font-bold">
                          {fmtDuty(crewHoursSummary.flightMin)}
                        </td>
                        <td className="text-center py-1 font-mono font-bold">
                          {crewHoursSummary.sectors}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-2 italic">
                    ℹ️{" "}
                    {t.byPositionNote ||
                      "ملاحظة: Total Block هو مجموع فريد لكل رحلة — لا يُكرر إذا كان العضو في أكثر من position في نفس الرحلة."}
                  </div>
                </div>
              )}

              {/* Detail Table */}
              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-200 dark:bg-slate-700">
                    <tr>
                      {[
                        "Date",
                        "Aircraft",
                        "Reg.",
                        "Flight No.",
                        "ADEP",
                        "ADES",
                        "BLOCK OFF",
                        "T/O",
                        "LND",
                        "BLOCK ON",
                        "BLOCK",
                      ]
                        .concat(hasAnyFlightTime ? ["Flight time"] : [])
                        .concat(hasAnyNight ? ["Night"] : [])
                        .concat(hasAnyInstrument ? ["Instrument"] : [])
                        .concat(["Func.", "COM"])
                        .map((h, i) => (
                          <th
                            key={`${h}-${i}`}
                            className="px-3 py-2 text-start font-bold border-e border-slate-300 whitespace-nowrap text-xs"
                          >
                            {h}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crewHoursRows.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-t border-slate-200 ${
                          i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-900/50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="px-3 py-2">{r.acftType}</td>
                        <td className="px-3 py-2 font-bold bg-amber-50 dark:bg-amber-950">
                          {r.reg}
                        </td>
                        <td className="px-3 py-2 font-mono">{r.flightNo}</td>
                        <td className="px-3 py-2 font-bold text-center">
                          {r.adep}
                        </td>
                        <td className="px-3 py-2 font-bold text-center">
                          {r.ades}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.blockOff}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.t_o}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.lnd}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.blockOn}
                        </td>
                        <td className="px-3 py-2 font-mono text-center bg-sky-50 dark:bg-sky-950 font-bold">
                          {r.block}
                        </td>
                        {hasAnyFlightTime && (
                          <td className="px-3 py-2 font-mono text-center bg-emerald-50 dark:bg-emerald-950 font-bold">
                            {r.flight}
                          </td>
                        )}
                        {hasAnyNight && (
                          <td className="px-3 py-2 font-mono text-center text-indigo-700">
                            {r.night}
                          </td>
                        )}
                        {hasAnyInstrument && (
                          <td className="px-3 py-2 font-mono text-center text-purple-700">
                            {r.instrument}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center font-bold text-indigo-700 dark:text-indigo-300">
                          {r.func}
                        </td>
                        <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                          {r.com}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 dark:bg-slate-700 font-bold">
                    <tr>
                      <td colSpan="10" className="px-3 py-2 text-end text-sm">
                        TOTAL ({crewHoursSummary.uniqueFlights}{" "}
                        {t.flights || "flights"} · {crewHoursSummary.sectors}{" "}
                        {t.assignments || "assignments"})
                      </td>
                      <td className="px-3 py-2 font-mono text-center text-sm">
                        {fmtDuty(crewHoursSummary.blockMin)}
                      </td>
                      {hasAnyFlightTime && (
                        <td className="px-3 py-2 font-mono text-center text-sm">
                          {fmtDuty(crewHoursSummary.flightMin)}
                        </td>
                      )}
                      {hasAnyNight && (
                        <td className="px-3 py-2 font-mono text-center text-sm">
                          {fmtDuty(crewHoursSummary.nightMin)}
                        </td>
                      )}
                      {hasAnyInstrument && (
                        <td className="px-3 py-2 font-mono text-center text-sm">
                          {fmtDuty(crewHoursSummary.instrumentMin)}
                        </td>
                      )}
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {isLimited ? "جاري تحميل ساعاتك…" : "اختر عضو طاقم لعرض ساعاته"}
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: FULL REPORT (جديد — كل الرحلات)
       * ═══════════════════════════════════════════════════════ */}
      {activeSubTab === "fullReport" && (
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg p-4">
          <ReportHeader
            settings={settings}
            issueDate={issueDate}
            title={t.fullReport || "Full Report — All Flights"}
          />
          <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                {t.totalFlights || "Total Flights"}
              </div>
              <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {fullReportSummary.sectors}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                {t.period || "Period"}
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {periodLabel}
              </div>
            </div>
          </div>

          {/* Summary byType */}
          <div className="mb-4">
            <table className="w-full text-sm max-w-md">
              <thead>
                <tr className="text-slate-600">
                  <th className="text-start py-1"></th>
                  <th className="text-center py-1 font-bold">Block</th>
                  <th className="text-center py-1 font-bold">Flight time</th>
                  <th className="text-center py-1 font-bold">Sectors</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-300 font-bold">
                  <td className="py-1">Total</td>
                  <td className="text-center py-1 font-mono">
                    {fmtDuty(fullReportSummary.blockMin)}
                  </td>
                  <td className="text-center py-1 font-mono">
                    {fmtDuty(fullReportSummary.flightMin)}
                  </td>
                  <td className="text-center py-1 font-mono">
                    {fullReportSummary.sectors}
                  </td>
                </tr>
                {Object.entries(fullReportSummary.byType).map(
                  ([type, data]) => (
                    <tr key={type} className="border-t border-slate-200">
                      <td className="py-1">{type}</td>
                      <td className="text-center py-1 font-mono">
                        {fmtDuty(data.block)}
                      </td>
                      <td className="text-center py-1 font-mono">
                        {fmtDuty(data.flight)}
                      </td>
                      <td className="text-center py-1 font-mono">
                        {data.sectors}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* ⭐ Total by Position (each position's total block across all crew) */}
          {Object.keys(fullReportByPosition).length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-xs font-bold text-purple-900 dark:text-purple-100 mb-2 uppercase flex items-center gap-1">
                🎯 {t.totalByPosition || "إجمالي الساعات لكل وظيفة (كل الطاقم)"}
              </div>
              <table className="w-full text-sm max-w-md">
                <thead>
                  <tr className="text-purple-700 dark:text-purple-300">
                    <th className="text-start py-1 font-bold">Position</th>
                    <th className="text-center py-1 font-bold">Block</th>
                    <th className="text-center py-1 font-bold">Sectors</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(fullReportByPosition)
                    .sort(
                      ([a], [b]) => POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b)
                    )
                    .map(([pos, data]) => (
                      <tr
                        key={pos}
                        className="border-t border-purple-200 dark:border-purple-800"
                      >
                        <td className="py-1 font-bold text-purple-900 dark:text-purple-100 font-mono">
                          {pos}
                        </td>
                        <td className="text-center py-1 font-mono font-bold bg-purple-100 dark:bg-purple-900/50">
                          {fmtDuty(data.blockMin)}
                        </td>
                        <td className="text-center py-1 font-mono font-bold">
                          {data.sectors}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail Table */}
          <div className="overflow-x-auto border border-slate-300 rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-200 dark:bg-slate-700">
                <tr>
                  {[
                    "Date",
                    "Aircraft",
                    "Reg.",
                    "Flight No.",
                    "ADEP",
                    "ADES",
                    "OFF",
                    "T/O",
                    "LND",
                    "ON",
                    "BLOCK",
                    "Flight",
                    "COM",
                    "SIC",
                  ].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-3 py-2 text-start font-bold border-e border-slate-300 whitespace-nowrap text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fullReportRows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-200 ${
                      i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-900/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-3 py-2">{r.acftType}</td>
                    <td className="px-3 py-2 font-bold bg-amber-50 dark:bg-amber-950">
                      {r.reg}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.flightNo}</td>
                    <td className="px-3 py-2 font-bold text-center">
                      {r.adep}
                    </td>
                    <td className="px-3 py-2 font-bold text-center">
                      {r.ades}
                    </td>
                    <td className="px-3 py-2 font-mono text-center">
                      {r.blockOff}
                    </td>
                    <td className="px-3 py-2 font-mono text-center">{r.t_o}</td>
                    <td className="px-3 py-2 font-mono text-center">{r.lnd}</td>
                    <td className="px-3 py-2 font-mono text-center">
                      {r.blockOn}
                    </td>
                    <td className="px-3 py-2 font-mono text-center bg-sky-50 dark:bg-sky-950 font-bold">
                      {r.block}
                    </td>
                    <td className="px-3 py-2 font-mono text-center bg-emerald-50 dark:bg-emerald-950 font-bold">
                      {r.flight}
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                      {r.com}
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                      {r.sic}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-200 dark:bg-slate-700 font-bold">
                <tr>
                  <td colSpan="10" className="px-3 py-2 text-end text-sm">
                    TOTAL
                  </td>
                  <td className="px-3 py-2 font-mono text-center text-sm">
                    {fmtDuty(fullReportSummary.blockMin)}
                  </td>
                  <td className="px-3 py-2 font-mono text-center text-sm">
                    {fmtDuty(fullReportSummary.flightMin)}
                  </td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: COMPLETED FLIGHTS
       * ═══════════════════════════════════════════════════════ */}
      {activeSubTab === "completedFlights" && (
        <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg p-4">
          {canEditFlight && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>إدخال / تعديل بيانات إكمال الرحلة (نظام 24 ساعة UTC — شاشة كاملة)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={quickCompleteFlightId}
                  onChange={(e) => setQuickCompleteFlightId(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono tabular-nums min-w-[230px]"
                >
                  <option value="">— اختر رحلة لإدخال أوقاتها (24H) —</option>
                  {[...(flights || [])]
                    .sort(
                      (a, b) =>
                        new Date(b.std || 0).getTime() -
                        new Date(a.std || 0).getTime()
                    )
                    .map((fl) => (
                      <option key={fl.id} value={fl.id}>
                        {fl.flightNo || "—"} | {fl.dep}→{fl.arr} |{" "}
                        {fl.std ? String(fl.std).slice(0, 10) : "—"} (
                        {fl.acft || "—"})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!quickCompleteFlightId}
                  onClick={() => {
                    const target = (flights || []).find(
                      (fl) => fl.id === quickCompleteFlightId
                    );
                    if (target) setEditingCompletedFlight(target);
                  }}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  فتح نافذة الإكمال (24H)
                </button>
              </div>
            </div>
          )}

          <ReportHeader
            settings={settings}
            issueDate={issueDate}
            title={t.completedFlights || "Completed Flights"}
          />
          <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                {t.totalSectors || "Total Sectors"}
              </div>
              <h2 className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {completedFlightsSummary.count}
              </h2>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                {t.period || "Period"}
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                {periodLabel}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <table className="w-full text-sm max-w-md">
              <thead>
                <tr className="text-slate-600">
                  <th className="text-start py-1"></th>
                  <th className="text-center py-1 font-bold">Sectors</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-300 font-bold">
                  <td className="py-1">Total</td>
                  <td className="text-center py-1 font-mono tabular-nums text-lg">
                    {completedFlightsSummary.count}
                  </td>
                </tr>
                {Object.entries(completedFlightsSummary.byType).map(
                  ([type, data]) => (
                    <tr key={type} className="border-t border-slate-200">
                      <td className="py-1">{type}</td>
                      <td className="text-center py-1 font-mono tabular-nums font-bold">
                        {data.count}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded">
            <table className="w-full text-sm">
              <thead className="bg-slate-200 dark:bg-slate-700">
                <tr>
                  {[
                    t.date || "Date",
                    t.aircraftCol || "Aircraft",
                    t.regCol || "Reg.",
                    t.flightNoCol || "Flight No.",
                    "ADEP",
                    "ADES",
                    t.blockOffCol || "OFF (24H)",
                    "T/O (24H)",
                    "LND (24H)",
                    t.blockOnCol || "ON (24H)",
                    t.sector || "Sector",
                    t.com || "COM",
                    t.sic || "SIC",
                    ...(canEditFlight ? ["24H JL"] : []),
                  ].map((h, i) => (
                    <th
                      key={`${h}-${i}`}
                      className="px-3 py-2 text-start font-bold border-e border-slate-300 whitespace-nowrap text-xs"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completedFlightsRows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-200 ${
                      i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-900/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono tabular-nums whitespace-nowrap">
                      {r.date}
                    </td>
                    <td className="px-3 py-2">{r.acftType}</td>
                    <td className="px-3 py-2 font-bold bg-amber-50 dark:bg-amber-950">
                      {r.reg}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">{r.flightNo}</td>
                    <td className="px-3 py-2 font-bold text-center">
                      {r.adep}
                    </td>
                    <td className="px-3 py-2 font-bold text-center">
                      {r.ades}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-center">
                      {r.blockOff}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-center">{r.t_o}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-center">{r.lnd}</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-center">
                      {r.blockOn}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums text-center bg-sky-50 dark:bg-sky-950 font-bold">
                      1
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                      {r.com}
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                      {r.sic}
                    </td>
                    {canEditFlight && (
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            const target = (flights || []).find(
                              (fl) => fl.id === r.id
                            );
                            if (target) setEditingCompletedFlight(target);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition whitespace-nowrap shrink-0"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          تعديل (24H)
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-200 dark:bg-slate-700 font-bold">
                <tr>
                  <td colSpan={10} className="px-3 py-2 text-end text-sm">
                    {t.totalSectorsLabel || "TOTAL SECTORS"}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-center bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-sm">
                    {completedFlightsSummary.count}
                  </td>
                  <td colSpan={canEditFlight ? 3 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: DUTY TIME
       * ═══════════════════════════════════════════════════════ */}
      {activeSubTab === "dutyTime" && (
        <>
          {selectedCrew ? (
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg p-4">
              <ReportHeader
                settings={settings}
                issueDate={issueDate}
                title={t.dutyTimeReport || "Crew Duty Time"}
              />
              <div className="flex justify-between items-end mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.crewMember || "Crew Member"}
                  </div>
                  <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                    {personName}
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">
                    {t.period || "Period"}
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {periodLabel}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <table className="w-full text-sm max-w-md">
                  <thead>
                    <tr className="text-slate-600">
                      <th className="text-start py-1"></th>
                      <th className="text-center py-1 font-bold">Duty Time</th>
                      <th className="text-center py-1 font-bold">Sectors</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-300 font-bold">
                      <td className="py-1">Total</td>
                      <td className="text-center py-1 font-mono">
                        {fmtDuty(dutyTimeSummary.dutyMin)}
                      </td>
                      <td className="text-center py-1 font-mono">
                        {dutyTimeSummary.sectors}
                      </td>
                    </tr>
                    {Object.entries(dutyTimeSummary.byType).map(
                      ([type, data]) => (
                        <tr key={type} className="border-t border-slate-200">
                          <td className="py-1">{type}</td>
                          <td className="text-center py-1 font-mono">
                            {fmtDuty(data.duty)}
                          </td>
                          <td className="text-center py-1 font-mono">
                            {data.sectors}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-200 dark:bg-slate-700">
                    <tr>
                      {[
                        "Date",
                        "Aircraft",
                        "Reg.",
                        "Flight No.",
                        "ADEP",
                        "ADES",
                        "STD (Sched)",
                        "STA (Actual)",
                        "Duty Start",
                        "Duty End",
                        "Duty",
                        "Func.",
                      ].map((h, i) => (
                        <th
                          key={`${h}-${i}`}
                          className="px-3 py-2 text-start font-bold border-e border-slate-300 whitespace-nowrap text-xs"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dutyTimeRows.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-t border-slate-200 ${
                          i % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-900/50"
                        }`}
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap">
                          {r.date}
                        </td>
                        <td className="px-3 py-2">{r.acftType}</td>
                        <td className="px-3 py-2 font-bold bg-amber-50 dark:bg-amber-950">
                          {r.reg}
                        </td>
                        <td className="px-3 py-2 font-mono">{r.flightNo}</td>
                        <td className="px-3 py-2 font-bold text-center">
                          {r.adep}
                        </td>
                        <td className="px-3 py-2 font-bold text-center">
                          {r.ades}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.stdSched}
                        </td>
                        <td className="px-3 py-2 font-mono text-center">
                          {r.staActual}
                        </td>
                        <td className="px-3 py-2 font-mono text-center text-sky-700 dark:text-sky-400">
                          {r.dutyStart}
                        </td>
                        <td className="px-3 py-2 font-mono text-center text-sky-700 dark:text-sky-400">
                          {r.dutyEnd}
                        </td>
                        <td className="px-3 py-2 font-mono text-center bg-emerald-50 dark:bg-emerald-950 font-bold">
                          {r.duty}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-indigo-700 dark:text-indigo-300">
                          {r.func}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-200 dark:bg-slate-700 font-bold">
                    <tr>
                      <td colSpan="10" className="px-3 py-2 text-end text-sm">
                        TOTAL
                      </td>
                      <td className="px-3 py-2 font-mono text-center text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {fmtDuty(dutyTimeSummary.dutyMin)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {isLimited
                  ? "جاري تحميل ساعاتك…"
                  : "اختر عضو طاقم لعرض ساعات الخدمة (Duty)"}
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
       * TAB: ANALYTICS & CHARTS
       * ═══════════════════════════════════════════════════════ */}
      {activeSubTab === "charts" && canViewCharts && (
        <ChartsModule
          flights={flights}
          crew={crew}
          fleet={fleet}
          leave={leave}
          embedded
        />
      )}

      {editingCompletedFlight && (
        <CompleteFlightModal
          flight={editingCompletedFlight}
          fleet={fleet}
          crew={crew}
          onClose={() => setEditingCompletedFlight(null)}
          onSave={saveCompletedFlightFromReports}
        />
      )}
    </div>
  );
}

export default ReportsModule;
