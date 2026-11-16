/* ═══════════════════════════════════════════════════════════
 * SYSTEM GUIDE & FEATURES PDF GENERATOR
 * Generates a discrete multi-page A4 bilingual (AR/EN) PDF
 * explaining the full architecture, workflow, & capabilities.
 * Uses pure inline hex/rgb styling + onclone stylesheet strip
 * to guarantee clean html2canvas rendering in any theme.
 * ═══════════════════════════════════════════════════════════ */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { toDisplayImageUrl } from "../api";
import { openPreviewModal } from "./dialog";

const A4_W = 794;
const A4_H = 1122;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPageHeader({ companyName, operatorCode, pageNum, totalPages, sectionTitle, sectionTag }) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0284c7;padding-bottom:10px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="background:#0f172a;color:#ffffff;font-family:monospace;font-weight:900;font-size:12px;padding:4px 10px;border-radius:6px;letter-spacing:1.5px;">
          ${escapeHtml(operatorCode || "AEROOPS")}
        </div>
        <div>
          <div style="font-size:13px;font-weight:800;color:#0f172a;">${escapeHtml(companyName)}</div>
          <div style="font-size:10px;color:#64748b;font-weight:600;">${escapeHtml(sectionTag)}</div>
        </div>
      </div>
      <div style="text-align:end;">
        <div style="font-size:12px;font-weight:800;color:#0284c7;">${escapeHtml(sectionTitle)}</div>
        <div style="font-size:10px;color:#64748b;font-family:monospace;">Page ${pageNum} / ${totalPages}</div>
      </div>
    </div>
  `;
}

function buildPageFooter({ generatedAt, companyName }) {
  return `
    <div style="margin-top:auto;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#64748b;">
      <span>AeroOps Flight Operations Management Suite — Official System Guide & Features Reference</span>
      <span style="font-family:monospace;">${escapeHtml(companyName)} · ${escapeHtml(generatedAt)}</span>
    </div>
  `;
}

function renderCard({ title, badge, color = "#0284c7", bg = "#f8fafc", points = [] }) {
  const listHtml = points
    .map(
      (pt) => `
      <li style="margin-bottom:5px;line-height:1.48;font-size:10.5px;color:#334155;">
        <span style="color:${color};font-weight:800;margin-inline-end:4px;">•</span>
        ${escapeHtml(pt)}
      </li>`
    )
    .join("");
  return `
    <div style="background:${bg};border:1px solid #cbd5e1;border-top:3px solid ${color};border-radius:10px;padding:12px 13px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
        <div style="font-size:12px;font-weight:800;color:#0f172a;">${escapeHtml(title)}</div>
        ${
          badge
            ? `<span style="font-size:9px;font-weight:800;color:${color};background:#ffffff;border:1px solid #cbd5e1;padding:2px 7px;border-radius:4px;white-space:nowrap;">${escapeHtml(
                badge
              )}</span>`
            : ""
        }
      </div>
      <ul style="margin:0;padding:0;list-style:none;">
        ${listHtml}
      </ul>
    </div>
  `;
}

function buildPagesHtml({ settings = {}, lang = "ar" }) {
  const isAr = lang !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const companyName =
    (isAr ? settings.companyNameAr : settings.companyName) ||
    settings.companyName ||
    settings.companyNameAr ||
    "AeroOps Flight Operations";
  const operatorCode = (settings.operatorCode || "AERO").toUpperCase();
  const logoUrl = toDisplayImageUrl(settings.logo);
  const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const totalPages = 6;

  const pageShell = (inner) => `
    <div data-pdf-page="1" dir="${dir}" style="width:${A4_W}px;height:${A4_H}px;background:#ffffff;color:#0f172a;padding:32px 34px;box-sizing:border-box;display:flex;flex-direction:column;font-family:'Tajawal','Cairo','Segoe UI',Tahoma,Arial,sans-serif;position:relative;overflow:hidden;">
      ${inner}
    </div>
  `;

  // PAGE 1 — Cover, System Purpose & End-to-End Architecture
  const page1 = pageShell(`
    <div style="background:linear-gradient(135deg,#0f172a 0%,#0369a1 100%);color:#ffffff;border-radius:14px;padding:26px 28px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:18px;">
      <div style="flex:1;">
        <div style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.3);padding:3px 10px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px;">
          OFFICIAL SYSTEM ARCHITECTURE & OPERATIONS MANUAL
        </div>
        <h1 style="margin:0 0 6px 0;font-size:22px;font-weight:900;line-height:1.25;">
          ${isAr ? "الدليل الشامل لآلية عمل ومزايا منظومة العمليات الجوية" : "AeroOps Flight Operations — System Workflow & Features Guide"}
        </h1>
        <p style="margin:0;font-size:11.5px;color:#e0f2fe;line-height:1.5;">
          ${
            isAr
              ? "منصة متكاملة لإدارة العمليات الجوية، الأسطول، الطواقم، الجداول، التصاريح، الصيانة المستمرة CAMO/MEL، السلامة والجودة، مع مزامنة سحابية لحظية."
              : "Unified platform for Flight Dispatch, Fleet & CAMO/MEL, Crew & FTL, Permits & OCR, Catering, Quality & Safety, and Cloud Sync."
          }
        </p>
      </div>
      <div style="width:84px;height:84px;background:#ffffff;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;box-sizing:border-box;flex-shrink:0;">
        ${
          logoUrl
            ? `<img src="${escapeHtml(logoUrl)}" crossorigin="anonymous" style="max-width:66px;max-height:54px;object-fit:contain;" />`
            : `<div style="font-family:monospace;font-size:18px;font-weight:900;color:#0284c7;">${escapeHtml(operatorCode)}</div>`
        }
        <div style="font-size:9px;font-weight:800;color:#0f172a;font-family:monospace;margin-top:2px;">${escapeHtml(operatorCode)}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
      ${[
        { num: "22+", lbl: isAr ? "وحدة تشغيلية متكاملة" : "Integrated Modules", clr: "#0284c7" },
        { num: "3-Tier", lbl: isAr ? "تخزين سحابي ومحلي هجين" : "Hybrid Cloud & Local Storage", clr: "#059669" },
        { num: "RBAC", lbl: isAr ? "حوكمة صلاحيات دقيقة وسجل تدقيق" : "Granular RBAC & Audit Logs", clr: "#7c3aed" },
      ]
        .map(
          (k) => `
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;text-align:center;">
          <div style="font-family:monospace;font-size:18px;font-weight:900;color:${k.clr};">${k.num}</div>
          <div style="font-size:10.5px;font-weight:700;color:#334155;margin-top:2px;">${k.lbl}</div>
        </div>`
        )
        .join("")}
    </div>

    <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">
      ${isAr ? "1. آلية الربط المعماري والتخزين السحابي (Data Flow & Persistence)" : "1. System Architecture, Cloud Binding & Storage Lifecycle"}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${renderCard({
        title: isAr ? "الواجهة الذكية والذاكرة الفورية (0ms Cache)" : "Instant Zero-Latency Frontend & Local Cache",
        badge: "React 19 + PWA",
        color: "#0284c7",
        points: isAr
          ? [
              "يعمل التطبيق كتطبيق ويب تقدمي (PWA) قابل للتثبيت على الهواتف وسطح المكتب مع دعم العمل دون اتصال.",
              "تُخزن البيانات التشغيلية محلياً في IndexedDB و LocalStorage لتسجيل الدخول والإقلاع الفوري (0ms).",
              "حماية تلقائية تمنع التداخل أثناء الحفظ (Mutation Guard) مع مزامنة دورية في الخلفية كل 25 ثانية."
            ]
          : [
              "Installable Progressive Web App (PWA) supporting offline resilience on mobile & desktop.",
              "Reads cached state immediately from LocalStorage/SheetCache on startup for 0ms boot.",
              "Mutation Guard protects active writes from stale background polling overwrites every 25s."
            ],
      })}
      ${renderCard({
        title: isAr ? "طبقة الربط والتخزين السحابي المشترك" : "Server API, Google Sheets, Drive & Firestore",
        badge: "Multi-Layer Cloud",
        color: "#059669",
        points: isAr
          ? [
              "خادم Express مدمج يوفر نقاط نهاية /api/gsheet و /api/drive-file و /api/send-email و /api/ocr.",
              "تحفظ الجداول (الرحلات، الطاقم، الأسطول، الصيانة، التصاريح، الإعدادات) في Google Sheets + AppConfig.",
              "تُرفع الملفات والصور والنماذج والأدلة والختم والشعار إلى Google Drive وتُعرض عبر بروكسي آمن.",
              "دعم Firebase Firestore لمزامنة إعدادات واتساب، الإشعارات الموحدة، وأدوار الصلاحيات السحابية."
            ]
          : [
              "Built-in Express backend exposes /api/gsheet, /api/drive-file proxy, /api/send-email & /api/ocr.",
              "Core operational tables and AppConfig keys persist directly into Google Sheets.",
              "PDF manuals, stamps, logos & crew documents upload to Google Drive and stream securely.",
              "Optional Cloud Firestore synchronization for WhatsApp provider config & ACL templates."
            ],
      })}
    </div>

    <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;">
      <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-bottom:8px;">
        ${isAr ? "مسار دورة العمل التشغيلية (End-to-End Flight Dispatch Flow)" : "End-to-End Flight Dispatch Lifecycle"}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center;">
        ${(isAr
          ? [
              { s: "1. التجهيز", d: "بيانات الأسطول، CAMO/MEL، وصلاحية الطواقم والمطارات" },
              { s: "2. التصاريح", d: "إصدار تصاريح الهبوط والعبور مع استخراج AI OCR" },
              { s: "3. الجدولة", d: "بناء الرحلة، فحص FTL التلقائي وتعيين الطاقم" },
              { s: "4. التنفيذ", d: "بوابة الطاقم، GenDec، التموين وتتبع Flight Following" },
              { s: "5. التدقيق", d: "حفظ ساعات الطيران، تقارير الجودة، وسجل Audit" },
            ]
          : [
              { s: "1. Readiness", d: "Verify Fleet, CAMO/MEL, Crew & Aerodromes" },
              { s: "2. Permits", d: "Issue Landing/Overflight permits + AI OCR" },
              { s: "3. Dispatch", d: "Build Sectors, Check FTL & Assign Crew" },
              { s: "4. Execute", d: "Crew Portal Briefing, GenDec & Flight Following" },
              { s: "5. Closeout", d: "Log Block/Flight Hours, Quality & Audit Trail" },
            ]
        )
          .map(
            (st) => `
          <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:8px 6px;">
            <div style="font-size:10.5px;font-weight:800;color:#0284c7;margin-bottom:4px;">${st.s}</div>
            <div style="font-size:9px;color:#475569;line-height:1.35;">${st.d}</div>
          </div>`
          )
          .join("")}
      </div>
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  // PAGE 2 — Flight Operations, Schedule, Flight Following, GenDec, Airports, FTL
  const page2 = pageShell(`
    ${buildPageHeader({
      companyName,
      operatorCode,
      pageNum: 2,
      totalPages,
      sectionTitle: isAr ? "إدارة العمليات الجوية والرحلات" : "Flight Operations & Dispatch",
      sectionTag: isAr ? "القسم التشغيلي الأول" : "CORE FLIGHT OPERATIONS",
    })}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      ${renderCard({
        title: isAr ? "لوحة التحكم المخصصة (Multi-Dashboard)" : "Executive & Embedded Dashboards",
        badge: "Dashboard",
        color: "#0284c7",
        points: isAr
          ? [
              "لوحة قيادة تفاعلية قابلة للسحب والإفلات (Drag & Drop Widgets) وإعادة ترتيب البطاقات والمؤشرات.",
              "إمكانية إنشاء عدة لوحات مسماة (Named Dashboards) وتقييد الوصول لكل لوحة حسب الدور أو المستخدم.",
              "مؤشرات لحظية للرحلات اليومية، نسبة جاهزية الأسطول، التنبيهات الحرجة، وحالة التراخيص المنتهية."
            ]
          : [
              "Customizable Drag & Drop analytics boards with KPI widgets & operational charts.",
              "Create multiple Named Dashboards with granular per-role and per-user visibility.",
              "Real-time tracking of active flights, fleet readiness, expiring licenses & safety alerts."
            ],
      })}
      ${renderCard({
        title: isAr ? "جدول الرحلات (Schedule Board & Drawer)" : "Schedule Board & Flight Ops Drawer",
        badge: "Schedule",
        color: "#0369a1",
        points: isAr
          ? [
              "عرض وجدولة القطاعات والرحلات (STD/STA، ATD/ATA، المسار، الطائرة، الركاب، نوع العملية).",
              "حالات طائرات مخصصة بالكامل (INS, RDY, AIR, BRD, DLY, MNT, AOG) مزامنة من Settings إلى اللوحة.",
              "تحديث تلقائي وإشعار فوري للطاقم عبر البريد أو واتساب عند تعيين الرحلة أو تعديل موعدها."
            ]
          : [
              "Manage multi-leg flight sectors with STD/STA/ATD/ATA times, routing, PAX & ops notes.",
              "Dynamic aircraft statuses (INS, RDY, AIR, BRD, DLY, MNT, AOG) synced from AppConfig.",
              "Automated crew notifications via Email, WhatsApp & Lock-Screen Push on assignment changes."
            ],
      })}
      ${renderCard({
        title: isAr ? "متابعة الرحلات والمنعطفات (Flight Following)" : "Flight Following & Turnaround Watch",
        badge: "Ops Watch",
        color: "#0d9488",
        points: isAr
          ? [
              "مراقبة حية لحالة الرحلات في الجو وعلى الأرض، متابعة التأخيرات وأسبابها، وإدارة الـ Slot.",
              "عرض المسارات والإحداثيات والوقت المتبقي وفق توقيت زولو القياسي (UTC) أو التوقيت المحلي (12H/24H).",
              "توثيق إلكتروني فوري لعمليات الإقلاع والهبوط واستهلاك الوقود وأوقات التحرك (Off-Block / On-Block)."
            ]
          : [
              "Live watch board tracking airborne and turnaround flights, delays & block times.",
              "Dual Zulu (UTC) & Local clock engine supporting global 12H/24H time preferences.",
              "Digital log of Off-Block, Airborne, Touchdown & On-Block telemetry plus fuel tracking."
            ],
      })}
      ${renderCard({
        title: isAr ? "الإقرار العام الإلكتروني (GenDec)" : "Electronic General Declaration (GenDec)",
        badge: "ICAO Annex 9",
        color: "#4f46e5",
        points: isAr
          ? [
              "توليد إقرار عام متوافق مع معايير ICAO يضم بيانات الشركة، رمز المشغل، الطائرة، الطاقم، والركاب.",
              "تضمين التوقيع والختم الرسمي للشركة تلقائياً عند التصدير للطباعة أو الحفظ بصيغة PDF.",
              "حفظ السجل والأرقام المرجعية لسرعة التقديم للسلطات والمطارات الدولية."
            ]
          : [
              "Generates ICAO Annex 9 compliant GenDec populated directly from selected flight & crew.",
              "Automatically embeds company logo & official stamp with print/PDF export permissions.",
              "Instant retrieval for airport handling agents and international customs clearance."
            ],
      })}
      ${renderCard({
        title: isAr ? "حدود الطيران والراحة (FTL Engine)" : "Flight Time Limitations (FTL & Rest)",
        badge: "Compliance",
        color: "#d97706",
        points: isAr
          ? [
              "حساب تلقائي لساعات الواجب (FDP)، ساعات الطيران التراكمية (7/28/365 يوماً)، وفترات الراحة.",
              "تحذيرات استباقية قبل تجاوز الحدود النظامية عند توزيع الطواقم على الرحلات في Schedule.",
              "ملخصات فردية لكل طيار ومضيف مع إمكانية التصدير للتفتيش والسلطات المختصة."
            ]
          : [
              "Automated calculation of FDP, cumulative flight hours (7/28/365 days) & minimum rest.",
              "Proactive fatigue & exceedance warnings prior to roster/flight assignment.",
              "Individual crew FTL ledger exportable for civil aviation authority audits."
            ],
      })}
      ${renderCard({
        title: isAr ? "دليل المطارات والاتصالات التشغيلية" : "Aerodrome & Operational Directory",
        badge: "250+ ICAO",
        color: "#0284c7",
        points: isAr
          ? [
              "قاعدة بيانات لأكثر من 250 مطاراً دولياً وإقليمياً مع المدارج، الارتفاع (Elevation)، والإحداثيات.",
              "إضافة وتعديل المطارات غير المدرجة ومزامنتها عبر السحابة لتظهر في قوائم الإكمال التلقائي.",
              "بطاقات معاينة ذكية عند تمرير المؤشر على رموز ICAO بالإضافة لدليل هواتف الطوارئ والعمليات."
            ]
          : [
              "Built-in database of 250+ aerodromes with runways, elevation, coordinates & timezones.",
              "Add or override custom airports in Settings synced via AppConfig across all users.",
              "Interactive Airport Hover Cards & instant Operational Phone Directory accessible from header."
            ],
      })}
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  // PAGE 3 — Fleet, CAMO/MEL, Crew & Crew Portal
  const page3 = pageShell(`
    ${buildPageHeader({
      companyName,
      operatorCode,
      pageNum: 3,
      totalPages,
      sectionTitle: isAr ? "الأسطول والصيانة وبوابة الطاقم" : "Fleet, CAMO/MEL & Crew Portal",
      sectionTag: isAr ? "القسم التشغيلي الثاني" : "FLEET & CREW OPERATIONS",
    })}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${renderCard({
        title: isAr ? "إدارة الأسطول (Fleet Management)" : "Fleet Registry & Airworthiness",
        badge: "Aircraft",
        color: "#0284c7",
        points: isAr
          ? [
              "سجل كامل للطائرات: التسجيل، الطراز، الرقم التسلسلي MSN، ساعات الطيران، والدورات Cycles.",
              "متابعة تواريخ انتهاء الشهادات (COA، ARC، التأمين، شهادة الضوضاء) بتنبيهات ملونة.",
              "بطاقات مدمجة وحديثة تعرض كافة البيانات التشغيلية والفنية في شاشة واحدة عالية الكثافة."
            ]
          : [
              "Complete aircraft registry: tail number, type, MSN, total airframe hours & landing cycles.",
              "Automated tracking of COA, ARC, insurance & noise certificate expiration alerts.",
              "Streamlined high-density fleet cards and tabular views maximizing screen clarity."
            ],
      })}
      ${renderCard({
        title: isAr ? "الصيانة المستمرة والعيوب (CAMO & MEL)" : "CAMO Continuing Airworthiness & MEL",
        badge: "Maintenance",
        color: "#e11d48",
        points: isAr
          ? [
              "جدول فحوصات الصيانة الدورية (A/C Checks، مهام الساعات والتقويم) وربطها التلقائي بحالة الطائرة.",
              "إدارة قائمة الحد الأدنى للمعدات (MEL Deferrals) مع احتساب الفئات الزمنية (Cat A/B/C/D) والموعد النهائي.",
              "منع جدولة طائرة أو تنبيه المرحل الجوي فور وجود عيب مفتوح متجاوز أو صيانة مستحقة."
            ]
          : [
              "Monitor scheduled maintenance checks (Flight Hours, Cycles, Calendar) tied to Fleet state.",
              "Full MEL Deferral tracking by category (Cat A/B/C/D) with automated due-date countdowns.",
              "Synchronizes directly with Dispatch Board to surface open defects before sector release."
            ],
      })}
      ${renderCard({
        title: isAr ? "إدارة الطواقم (Crew & Licenses)" : "Crew Records, Licenses & Ratings",
        badge: "Personnel",
        color: "#059669",
        points: isAr
          ? [
              "ملفات الطيارين والمضيفين والمهندسين مع تحديد الوظائف من قائمة ديناميكية قابلة للتخصيص.",
              "حفظ التراخيص (ATPL/CPL)، الشهادات الطبية Class 1، جوازات السفر، والتأشيرات وروابط مرفقاتها.",
              "واجهة موحدة وفلاتر ذكية عالية الكفاءة لاستعراض حالة صلاحية كل عضو طاقم بنظرة واحدة."
            ]
          : [
              "Full profiles for cockpit, cabin & maintenance crew mapped to customizable Position codes.",
              "Track ATPL/CPL licenses, Class 1 Medicals, Passports, Visas & Drive document attachments.",
              "Compact professional filter bar and dense crew grid eliminating visual clutter."
            ],
      })}
      ${renderCard({
        title: isAr ? "بوابة الطاقم المتنقلة (Crew Portal)" : "Mobile-First Crew Portal",
        badge: "Self-Service",
        color: "#7c3aed",
        points: isAr
          ? [
              "واجهة خاصة لأعضاء الطاقم تعرض الرحلات المسندة، موجز الرحلة (Briefing)، وأوقات التحرك.",
              "استعراض الأدلة المعتمدة، طلبات الإجازات، الجدول الشهري Roster، ومناوبات الاحتياط Standby.",
              "تحكم كامل في ظهور أيقونات البوابة، نمط الأيقونات، العلامة المائية، وبطاقة التواصل مع العمليات."
            ]
          : [
              "Dedicated crew self-service hub showing assigned sectors, duty briefings & reporting times.",
              "Direct access to authorized Manuals, Leave submission, Personal Roster & Standby schedule.",
              "Configurable icon styles, custom watermarks, per-icon ACL permissions & Ops Contact Card."
            ],
      })}
    </div>

    <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:12px 14px;">
      <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-bottom:6px;">
        ${isAr ? "آلية حماية الصلاحيات والتنبيهات الاستباقية للطاقم والأسطول" : "Automated Expiry Guard & Alert Cascade"}
      </div>
      <div style="font-size:10.5px;color:#334155;line-height:1.55;">
        ${
          isAr
            ? "تقوم المنظومة يومياً بفحص صلاحية جميع رخص الطاقم وشهادات الطائرات ومواعيد MEL وإخطار الإدارة والأفراد المعنيين عبر لوحة التنبيهات الفورية (AlertsPanel) والبريد الإلكتروني الرسمي ورسائل واتساب المجدولة، مع عرض حالتها بلون تحذيري قبل 30 يوماً من الانتهاء."
            : "Every operational load inspects Crew license expiries, Fleet certificates, and open MEL limits. Alerts surface immediately inside AlertsPanel and dispatch automated SMTP Email or WhatsApp reminders 30 days ahead of expiry."
        }
      </div>
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  // PAGE 4 — Permits, AI OCR, Manuals, Forms, Documents Vault
  const page4 = pageShell(`
    ${buildPageHeader({
      companyName,
      operatorCode,
      pageNum: 4,
      totalPages,
      sectionTitle: isAr ? "التصاريح، الماسح الذكي OCR، والأدلة" : "Permits, AI OCR, Manuals & Vault",
      sectionTag: isAr ? "القسم التشغيلي الثالث" : "PERMITS, MANUALS & DOCUMENTS",
    })}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${renderCard({
        title: isAr ? "إدارة التصاريح الدولية (Permits Module)" : "Overflight & Landing Permits",
        badge: "Civil Aviation",
        color: "#0284c7",
        points: isAr
          ? [
              "إدارة طلبات وحالات تصاريح العبور (Overflight) والهبوط (Landing) والدول المحددة.",
              "تخزين أرقام الموافقات (Permit Numbers)، فترات الصلاحية (Valid From/To)، وقوالب الطلبات الجاهزة.",
              "إصدار فوري وتصدير ملفات الطلبات والمرفقات مع ربطها برحلات الجدول المحددة."
            ]
          : [
              "Manage Landing, Overflight & Technical Stop permits per country and flight sector.",
              "Save permit reference numbers, validity windows & reusable CAA application templates.",
              "One-click template rendering and PDF attachment archiving."
            ],
      })}
      ${renderCard({
        title: isAr ? "الماسح الذكي بالذكاء الاصطناعي (AI OCR)" : "Smart Document Extractor (/api/ocr)",
        badge: "Gemini AI OCR",
        color: "#7c3aed",
        points: isAr
          ? [
              "رفع صور أو ملفات PDF لتصاريح الطيران أو الوثائق واستخراج النصوص والتواريخ تلقائياً.",
              "معالجة آمنة على الخادم عبر Gemini API دون كشف أي مفاتيح أو بيانات حساسة بالمتصفح.",
              "تعبئة تلقائية لحقول النموذج (رقم التصريح، الدولة، التسجيل، التواريخ) لتقليل الأخطاء البشرية."
            ]
          : [
              "Scan PDF/image permit approvals and aviation documents to auto-extract structured fields.",
              "Processed securely server-side through /api/ocr without exposing client API keys.",
              "Auto-populates permit numbers, states, aircraft registrations & validity ranges."
            ],
      })}
      ${renderCard({
        title: isAr ? "مكتبة الأدلة والكتيبات (Manuals & Audit)" : "Operations Manuals & Revision Control",
        badge: "Document Control",
        color: "#0369a1",
        points: isAr
          ? [
              "إدارة الأدلة التشغيلية (OM-A, OM-B, MEL, QRH, SOP) مع تتبع رقم الإصدار وتاريخ المراجعة.",
              "استعراض مباشر لملفات PDF داخل التطبيق (Canvas Viewer) وتوليد نسخة PDF للدليل عند الحاجة.",
              "سجل تدقيق خاص بتحديثات الأدلة وصلاحيات توزيع محددة لأعضاء الطاقم أو الإدارات."
            ]
          : [
              "Central repository for OM-A, OM-B, MEL, QRH & SOP manuals with revision tracking.",
              "In-app PDF Canvas preview, instant download & automated manual PDF synthesis.",
              "Tracks manual audit trail and controls distribution visibility to Crew Portal."
            ],
      })}
      ${renderCard({
        title: isAr ? "النماذج التشغيلية وخزينة الوثائق (Forms & Vault)" : "Operational Forms & Documents Hub",
        badge: "Paperless",
        color: "#059669",
        points: isAr
          ? [
              "منشئ نماذج تشغيلية مرن لإصدار واعتماد نماذج الرحلات والتفتيش إلكترونياً.",
              "مجلد وثائق مركزي (Documents Hub) يدعم تصنيف الملفات، صلاحية الوصول حسب الدور، والحفظ في Google Drive.",
              "توثيق إلكتروني للختم والتوقيع وسجل زمني كامل للنسخ المرفوعة."
            ]
          : [
              "Configurable electronic forms module for operational checklists & dispatch sign-offs.",
              "Centralized Documents Vault categorized by department with role-based permissions.",
              "Direct Google Drive upload pipeline with secure same-origin file streaming proxy."
            ],
      })}
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  // PAGE 5 — Catering, Quality, Roster, Standby, Leave, Training, Reports
  const page5 = pageShell(`
    ${buildPageHeader({
      companyName,
      operatorCode,
      pageNum: 5,
      totalPages,
      sectionTitle: isAr ? "التموين، الجودة، الجداول، والتدريب" : "Catering, Quality, Workforce & Reports",
      sectionTag: isAr ? "القسم التشغيلي الرابع" : "LOGISTICS, COMPLIANCE & WORKFORCE",
    })}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${renderCard({
        title: isAr ? "التموين والمخزن الجاف (Catering & Dry Store)" : "Catering Orders & Dry Store Ledger",
        badge: "Inflight Service",
        color: "#d97706",
        points: isAr
          ? [
              "إدارة قوائم الوجبات، المشروبات، والمعدات القياسية على متن الطائرة (Dry Store Items).",
              "دفتر حركة مخزون آلي (Dry Store Ledger) يسجل الوارد والمنصرف لكل رحلة ويحسب الرصيد الحالي.",
              "إصدار طلبات التموين المطبوعة للرحلات وفق عدد الركاب والطاقم."
            ]
          : [
              "Catalog standard inflight catering menus and aircraft Dry Store inventory items.",
              "Automated Dry Store Ledger tracks stock in/out per flight leg with live balance calculation.",
              "Generates printable catering dispatch orders based on passenger and crew counts."
            ],
      })}
      ${renderCard({
        title: isAr ? "إدارة الجودة والسلامة (Quality & Compliance)" : "Quality Audits & Safety Compliance",
        badge: "QMS / SMS",
        color: "#7c3aed",
        points: isAr
          ? [
              "تسجيل عمليات التفتيش والتدقيق الداخلي والخارجي، رصد الملاحظات Findings، ومتابعة الإغلاق.",
              "لوحة مؤشرات جودة خاصة (Quality Dashboard) قابلة للتخصيص وتصدير التقارير الدورية.",
              "ربط النتائج بسجل التدقيق العام للتأكد من المعالجة التصحيحية قبل الموعد النهائي."
            ]
          : [
              "Log internal/external operational audits, non-conformities (Findings) & corrective CAPA plans.",
              "Dedicated customizable Quality & Safety Dashboard for executive compliance oversight.",
              "Audit trails monitor closure deadlines and compliance KPIs."
            ],
      })}
      ${renderCard({
        title: isAr ? "تخطيط القوى البشرية (Roster, Standby, Leave)" : "Roster Groups, Standby & Leave",
        badge: "HR & Scheduling",
        color: "#0284c7",
        points: isAr
          ? [
              "إدارة جداول المناوبات (Roster) مع إمكانية إنشاء مجموعات مناوبة مخصصة لكل قسم أو أسطول.",
              "تسجيل حالات الاحتياط (Standby) وساعات الاستدعاء الجوي المربوطة بحسابات FTL.",
              "إدارة طلبات الإجازات السنوية والمرضية (Leave) مع دورة الموافقات والرفض وإشعار الطاقم."
            ]
          : [
              "Dynamic Roster planning with custom named Roster Groups stored across cloud AppConfig.",
              "Standby callout duty tracking integrated directly with flight crew FTL availability.",
              "Structured Leave request & approval workflow reflecting immediately on crew scheduling."
            ],
      })}
      ${renderCard({
        title: isAr ? "التدريب والتقارير التنفيذية (Training & Reports)" : "Recurrent Training & Analytics Reports",
        badge: "Analytics",
        color: "#059669",
        points: isAr
          ? [
              "جدول متابعة دورات المحاكاة (OPC/LPC)، الإنقاذ (SEP)، المواد الخطرة (DGR)، وأمن الطيران.",
              "محرك تقارير شامل يعرض إحصائيات الساعات، الرحلات، الطواقم، الأسطول، ومؤشرات الالتزام.",
              "تصدير فوري لكافة الجداول والتقارير بصيغ Excel / CSV و PDF للطباعة أو الأرشفة."
            ]
          : [
              "Track OPC/LPC Simulator checks, SEP, DGR, CRM & AvSec recurrent currency deadlines.",
              "Comprehensive Reports Engine aggregating hours, flight legs, fleet utilization & training status.",
              "One-click export to CSV/Excel and formatted A4 PDF across all operational tables."
            ],
      })}
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  // PAGE 6 — Security, RBAC, Communications, Appearance & Customization
  const page6 = pageShell(`
    ${buildPageHeader({
      companyName,
      operatorCode,
      pageNum: 6,
      totalPages,
      sectionTitle: isAr ? "الأمان، الاتصالات، وتخصيص المنظومة" : "Security, Comms & UI Customization",
      sectionTag: isAr ? "الحوكمة والإعدادات المتقدمة" : "GOVERNANCE & SETTINGS",
    })}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      ${renderCard({
        title: isAr ? "حوكمة الصلاحيات والأمان (RBAC & Audit Logs)" : "RBAC Permissions, Login History & Audit",
        badge: "Zero-Trust ACL",
        color: "#0f172a",
        points: isAr
          ? [
              "نظام صلاحيات هرمي مرن يغطي كل وحدة (عرض، إنشاء، تعديل، حذف، تصدير، وطباعة بالختم).",
              "قوالب أدوار جاهزة مع إمكانية تعديل صلاحيات كل دور أو منح استثناءات فردية على مستوى المستخدم.",
              "سجل دخول تفصيلي (Login History) وسجل عمليات غير قابل للتلاعب (Audit Log) لكل حدث بالنظام."
            ]
          : [
              "Granular module-level permissions (view, create, edit, delete, export, stamp & crew portal).",
              "Prebuilt role templates plus individual per-user permission overrides & dashboard scopes.",
              "Immutable Audit Log & Login History capturing device, browser, timestamps & status."
            ],
      })}
      ${renderCard({
        title: isAr ? "منظومة الاتصالات والإشعارات الموحدة" : "SMTP Email, WhatsApp & Push Engine",
        badge: "Omni-Channel",
        color: "#059669",
        points: isAr
          ? [
              "دعم تعدد حسابات البريد المرسِل (SMTP / Gmail / Office 365 / Relay) مع اختبار الاتصال من داخل النظام.",
              "إرسال رسائل واتساب فردية وجماعية عبر Meta Cloud API أو Apps Script Webhook أو روابط WhatsApp.",
              "محرك تنبيهات صوتي مدمج (Web Audio API) مع إشعارات شاشة القفل (Push Notifications) وقوالب جاهزة."
            ]
          : [
              "Multi-sender SMTP configuration (Gmail, O365, Custom SMTP or Relay) with live connection test.",
              "Unified WhatsApp dispatcher supporting Meta Cloud API, Apps Script Relay & Direct Links.",
              "Synthesized Web Audio alert cues, Lock-Screen Push alerts & reusable notification templates."
            ],
      })}
      ${renderCard({
        title: isAr ? "تخصيص الشريط العلوي و Grouped Menu" : "Top Bar, Custom Menus & Grouped Menu",
        badge: "Flexible Nav",
        color: "#0284c7",
        points: isAr
          ? [
              "تبديل مرن بين الشريط العلوي (Top Navigation) أو الشريط الجانبي (Sidebar) حسب تفضيل الإدارة.",
              "إنشاء قوائم منسدلة مخصصة، إعادة ترتيب التبويبات، وتفعيل/إخفاء قائمة (المزيد / More).",
              "التحكم الكامل في إظهار أيقونات الرأس مباشرة على الشريط أو تجميعها داخل Grouped Menu مع الحفظ السحابي."
            ]
          : [
              "Switch seamlessly between Top Horizontal Bar and Collapsible Sidebar navigation layouts.",
              "Create custom dropdown menus, reorder tabs & configure visibility of the 'More' menu.",
              "Choose which header tools appear directly on top bar vs Grouped Menu, synced across devices."
            ],
      })}
      ${renderCard({
        title: isAr ? "توحيد الثيمات والهوية المؤسسية" : "Unified Themes & Corporate Branding",
        badge: "Branding Sync",
        color: "#7c3aed",
        points: isAr
          ? [
              "مكتبة ثيمات متكاملة (Modern, Classic, Emerald, Royal, Sky, Ocean, Dark) مع تباين مثالي للقراءة.",
              "رفع الشعار والختم الرسمي للشركة ومزامنتهما فورياً مع GenDec والتقارير والـ PWA Icon.",
              "توحيد كامل لتخصيص بطاقة التواصل في بوابة الطاقم والعلامة المائية من شاشة إعدادات واحدة."
            ]
          : [
              "Multi-theme design engine (Modern, Classic, Emerald, Royal, Sky, Ocean) + Light/Dark parity.",
              "Upload company Logo & Official Stamp syncing automatically into GenDec, Reports & PWA icons.",
              "Full control over Crew Portal contact card & watermarks inside a unified full-page Settings hub."
            ],
      })}
    </div>

    <div style="background:#f0f9ff;border:1px solid #7dd3fc;border-radius:10px;padding:12px 14px;">
      <div style="font-size:11.5px;font-weight:800;color:#0369a1;margin-bottom:4px;">
        ${isAr ? "ملخص جاهزية التشغيل والتدقيق (System Readiness Checklist)" : "System Operational Readiness Summary"}
      </div>
      <div style="font-size:10px;color:#0f172a;line-height:1.5;">
        ${
          isAr
            ? "1. تأكد من إدخال اسم الشركة ورمز المشغل والشعار والختم في (الإعدادات العامة).  •  2. اضبط الأدوار والصلاحيات وربط حسابات البريد SMTP وبوابة واتساب.  •  3. حدّث أسطول الطائرات وحالاتها وبيانات الطاقم والمطارات المخصصة.  •  4. خصص شريط القوائم و Grouped Menu واضغط حفظ لتعميم الإعدادات سحابياً على جميع الأجهزة."
            : "1. Configure Operator Code, Company Identity, Logo & Stamp in General Settings.  •  2. Verify Role Permissions, SMTP Sender Accounts & WhatsApp Provider.  •  3. Keep Fleet Statuses, CAMO/MEL, Crew Licenses & Custom Airports updated.  •  4. Customize Top Bar & Grouped Menu placement and Save to sync across all devices."
        }
      </div>
    </div>

    ${buildPageFooter({ generatedAt, companyName })}
  `);

  return [page1, page2, page3, page4, page5, page6].join("");
}

/**
 * Generate System Guide & Features PDF
 * @param {object} opts
 * @param {object} opts.settings
 * @param {string} opts.lang - "ar" | "en"
 * @param {"download" | "preview"} opts.mode
 */
export async function generateSystemGuidePdf({
  settings = {},
  lang = "ar",
  mode = "download",
} = {}) {
  const operatorCode = (settings?.operatorCode || "AeroOps").toUpperCase();
  const fileName = `${operatorCode}_System_Guide_Features_${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;

  const container = document.createElement("div");
  container.style.cssText = [
    "position:fixed",
    "left:-99999px",
    "top:0",
    `width:${A4_W}px`,
    "background:#ffffff",
    "color:#0f172a",
    "z-index:-1",
    "pointer-events:none",
  ].join(";");
  container.innerHTML = buildPagesHtml({ settings, lang });
  document.body.appendChild(container);

  try {
    // Allow images / fonts inside offscreen container to settle
    await new Promise((resolve) => setTimeout(resolve, 180));

    const pages = Array.from(container.querySelectorAll("[data-pdf-page]"));
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    const pageWidthMm = pdf.internal.pageSize.getWidth();
    const pageHeightMm = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: A4_W,
        height: A4_H,
        onclone: (clonedDoc) => {
          // Strip Tailwind CSS v4 oklch() stylesheets so html2canvas only reads inline hex/rgb rules
          clonedDoc
            .querySelectorAll('style, link[rel="stylesheet"]')
            .forEach((node) => node.remove());
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.94);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm);
    }

    if (mode === "preview") {
      const blob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      openPreviewModal({
        title:
          lang === "ar"
            ? "دليل عمل ومزايا منظومة AeroOps (PDF)"
            : "AeroOps System Guide & Features (PDF)",
        blobUrl,
        fileName,
      });
      return { ok: true, fileName, blobUrl };
    }

    pdf.save(fileName);
    return { ok: true, fileName };
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
