/* ═══════════════════════════════════════════════════════════
 * PERMISSIONS SYSTEM
 * v6.0 — FINAL: Added CAMO + Permits + Catering + Portal
 * ═══════════════════════════════════════════════════════════ */

export const ALL_PERMISSIONS = {
  /* ═══ Dashboard ═══ */
  dashboard: {
    label_en: "Dashboard",
    label_ar: "لوحة التحكم",
    icon: "🎛️",
    perms: [
      {
        key: "dashboard.customize",
        en: "Customize Dashboard Widgets & Layout",
        ar: "تخصيص وترتيب بطاقات لوحة التحكم",
      },
      {
        key: "dashboard.quality_view",
        en: "View Quality & Compliance Widgets",
        ar: "عرض بطاقات لوحة الجودة والامتثال",
      },
      {
        key: "dashboard.manage_named",
        en: "Create, Name & Assign Permissions to Dashboards",
        ar: "إنشاء وتسمية لوحات التحكم وتخصيص صلاحياتها",
      },
    ],
  },

  /* ═══ Quality Management (More) ═══ */
  quality: {
    label_en: "Quality Management",
    label_ar: "إدارة الجودة (Quality Management)",
    icon: "🏅",
    perms: [
      {
        key: "quality.view",
        en: "Access Quality Management Module",
        ar: "الوصول لقسم إدارة الجودة (Quality Management)",
      },
      {
        key: "quality.dashboard_view",
        en: "View Quality Management Dashboard",
        ar: "عرض الداشبورد الخاصة بإدارة الجودة",
      },
      {
        key: "quality.manage_dashboards",
        en: "Create, Name & Assign Permissions to Quality Dashboards",
        ar: "إنشاء وتسمية لوحات إدارة الجودة وتخصيص صلاحياتها",
      },
      {
        key: "quality.audits_view",
        en: "View Quality Audits & CAPA Findings",
        ar: "عرض سجلات التدقيق والملاحظات التصحيحية (CAPA)",
      },
      {
        key: "quality.audits_manage",
        en: "Create, Edit & Close Quality Audits / CAPA",
        ar: "إضافة وتعديل وإغلاق ملاحظات التدقيق والجودة",
      },
    ],
  },

  /* ═══ Schedule ═══ */
  schedule: {
    label_en: "Schedule",
    label_ar: "الجدول",
    icon: "📋",
    perms: [
      { key: "schedule.view", en: "View", ar: "عرض" },
      { key: "schedule.create", en: "Create", ar: "إنشاء" },
      { key: "schedule.edit", en: "Edit", ar: "تعديل" },
      { key: "schedule.delete", en: "Delete", ar: "حذف" },
      { key: "schedule.assign_crew", en: "Assign crew", ar: "تعيين طاقم" },
      { key: "schedule.gendec_view", en: "View GenDec", ar: "عرض الإقرار العام GenDec" },
      {
        key: "schedule.gendec_stamp",
        en: "Print GenDec with Official Stamp",
        ar: "طباعة الإقرار العام (GenDec) بالختم الرسمي",
      },
      {
        key: "schedule.gendec_no_stamp",
        en: "Print GenDec without Stamp",
        ar: "طباعة الإقرار العام (GenDec) بدون ختم",
      },
    ],
  },

  /* ═══ FTL ═══ */
  ftl: {
    label_en: "FTL",
    label_ar: "FTL",
    icon: "⏱️",
    perms: [
      { key: "ftl.view", en: "View", ar: "عرض" },
      { key: "ftl.edit", en: "Edit", ar: "تعديل" },
    ],
  },

  /* ═══ Fleet ═══ */
  fleet: {
    label_en: "Fleet",
    label_ar: "الأسطول",
    icon: "✈️",
    perms: [
      { key: "fleet.view", en: "View", ar: "عرض" },
      { key: "fleet.create", en: "Add", ar: "إضافة" },
      { key: "fleet.edit", en: "Edit", ar: "تعديل" },
      { key: "fleet.delete", en: "Delete", ar: "حذف" },
      { key: "fleet.docs", en: "View Documents", ar: "عرض المستندات" },
      { key: "fleet.docs_edit", en: "Edit Documents", ar: "تعديل المستندات" },
      {
        key: "fleet.docs_download",
        en: "Download Documents",
        ar: "تحميل المستندات",
      },
    ],
  },

  /* ⭐ v6.0 — CAMO + MEL + CAMO Dashboard */
  camo: {
    label_en: "CAMO & Airworthiness",
    label_ar: "إدارة الصلاحية (CAMO)",
    icon: "🛡️",
    perms: [
      { key: "camo.view", en: "View CAMO", ar: "عرض CAMO" },
      {
        key: "camo.dashboard_view",
        en: "View CAMO Dashboard",
        ar: "عرض داشبورد إدارة الصلاحية (CAMO)",
      },
      {
        key: "camo.manage_dashboards",
        en: "Create, Name & Assign CAMO Dashboards",
        ar: "إنشاء وتسمية لوحات CAMO وتخصيص صلاحياتها",
      },
      { key: "camo.edit", en: "Edit CAMO", ar: "تعديل CAMO" },
      { key: "mel.view", en: "View MEL", ar: "عرض MEL" },
      { key: "mel.edit", en: "Edit MEL", ar: "تعديل MEL" },
    ],
  },

  /* ⭐ v6.0 — Permits */
  permits: {
    label_en: "Permits",
    label_ar: "التصاريح",
    icon: "📜",
    perms: [
      { key: "permits.view", en: "View Permits", ar: "عرض التصاريح" },
      { key: "permits.create", en: "Add Permits", ar: "إضافة تصاريح" },
      { key: "permits.edit", en: "Edit Permits", ar: "تعديل تصاريح" },
      { key: "permits.delete", en: "Delete Permits", ar: "حذف تصاريح" },
      {
        key: "permits.print_with_stamp",
        en: "Print Permits with Official Stamp",
        ar: "طباعة وثائق وتصاريح الطيران بالختم الرسمي",
      },
      {
        key: "permits.print_without_stamp",
        en: "Print Permits without Stamp",
        ar: "طباعة وثائق وتصاريح الطيران بدون ختم",
      },
    ],
  },

  /* ⭐ Operational Forms — النماذج التشغيلية */
  forms: {
    label_en: "Forms",
    label_ar: "النماذج",
    icon: "📄",
    perms: [
      { key: "forms.view", en: "View Forms", ar: "عرض النماذج" },
      { key: "forms.create", en: "Add Forms", ar: "إدراج نماذج" },
      { key: "forms.edit", en: "Edit & Link Forms", ar: "تعديل وربط النماذج" },
      { key: "forms.delete", en: "Delete Forms", ar: "حذف النماذج" },
      {
        key: "forms.print_with_stamp",
        en: "Print Operational Forms with Official Stamp",
        ar: "طباعة النماذج التشغيلية بالختم الرسمي",
      },
      {
        key: "forms.print_without_stamp",
        en: "Print Operational Forms without Stamp",
        ar: "طباعة النماذج التشغيلية بدون ختم",
      },
    ],
  },

  /* ⭐ v6.0 — Catering */
  catering: {
    label_en: "Catering",
    label_ar: "التموين",
    icon: "🍽️",
    perms: [
      { key: "catering.view", en: "View Catering", ar: "عرض التموين" },
      { key: "catering.create", en: "Create Orders", ar: "إنشاء طلبات" },
      { key: "catering.edit", en: "Edit Orders", ar: "تعديل طلبات" },
      { key: "catering.delete", en: "Delete Orders", ar: "حذف طلبات" },
      {
        key: "catering.dry_store",
        en: "Manage Dry Stores (Stock In/Out)",
        ar: "إدارة مخزن التموين الجاف (صرف / استلام)",
      },
      {
        key: "catering.print_with_stamp",
        en: "Print Catering with Official Stamp",
        ar: "طباعة أوامر ومخزن التموين بالختم الرسمي",
      },
      {
        key: "catering.print_without_stamp",
        en: "Print Catering without Stamp",
        ar: "طباعة أوامر ومخزن التموين بدون ختم",
      },
    ],
  },

  /* ═══ Crew ═══ */
  crew: {
    label_en: "Crew",
    label_ar: "الأطقم",
    icon: "👥",
    perms: [
      { key: "crew.view", en: "View", ar: "عرض" },
      { key: "crew.create", en: "Add", ar: "إضافة" },
      { key: "crew.edit", en: "Edit", ar: "تعديل" },
      { key: "crew.delete", en: "Delete", ar: "حذف" },
      { key: "crew.docs", en: "View Documents", ar: "عرض المستندات" },
      { key: "crew.docs_edit", en: "Edit Documents", ar: "تعديل المستندات" },
      {
        key: "crew.docs_download",
        en: "Download Documents",
        ar: "تحميل المستندات",
      },
      { key: "crew.card", en: "ID Card", ar: "بطاقة" },
      {
        key: "crew.portal",
        en: "Access Crew Portal",
        ar: "الوصول لواجهة الطاقم",
      },
    ],
  },

  /* ⭐ v7.0 — Crew Portal Icons (صلاحية مستقلة لكل أيقونة في كرو بورتال) */
  portal: {
    label_en: "Crew Portal",
    label_ar: "بوابة الطاقم (Crew Portal)",
    icon: "🚪",
    perms: [
      { key: "portal.schedule", en: "My Schedule Icon", ar: "أيقونة جدولي" },
      {
        key: "portal.completed_flights",
        en: "Completed Flights Icon",
        ar: "أيقونة الرحلات المكتملة",
      },
      {
        key: "portal.completed_flights_edit",
        en: "Complete / Edit Flights (24H) in Portal",
        ar: "إكمال وتعديل أوقات الرحلات (24H) في البورتال",
      },
      {
        key: "portal.catering",
        en: "Catering Icon",
        ar: "أيقونة التموين",
      },
      {
        key: "portal.aircraft_status",
        en: "My Aircraft Status Icon",
        ar: "أيقونة حالة طائرتي",
      },
      {
        key: "portal.certificates",
        en: "Certificates Icon",
        ar: "أيقونة الشهادات والمرفقات",
      },
      { key: "portal.ftl", en: "FTL Icon", ar: "أيقونة FTL" },
      { key: "portal.manuals", en: "Manuals Icon", ar: "أيقونة الأدلة والمراجع" },
      { key: "portal.hours", en: "My Hours Icon", ar: "أيقونة ساعاتي" },
      {
        key: "portal.print_with_stamp",
        en: "Print/Export Portal Reports with Official Stamp",
        ar: "طباعة وتصدير تقارير البورتال بالختم الرسمي",
      },
      {
        key: "portal.print_without_stamp",
        en: "Print/Export Portal Reports without Stamp",
        ar: "طباعة وتصدير تقارير البورتال بدون ختم",
      },
    ],
  },

  /* ═══ Manuals ═══ */
  manuals: {
    label_en: "Manuals",
    label_ar: "الأدلة والمراجع",
    icon: "📖",
    perms: [
      { key: "manuals.view", en: "View Manuals", ar: "عرض الأدلة" },
      { key: "manuals.upload", en: "Upload PDF", ar: "رفع PDF" },
      { key: "manuals.manage", en: "Manage Manuals", ar: "إدارة الأدلة" },
      { key: "manuals.audit", en: "View Audit Log", ar: "عرض سجل التحديثات" },
    ],
  },

  /* ═══ Unified Roster & Crew Groups ═══ */
  roster: {
    label_en: "Roster & Crew Groups",
    label_ar: "الروستر والمجموعات (الروستر الموحد)",
    icon: "📅",
    perms: [
      { key: "roster.view", en: "View Roster Hub", ar: "عرض قسم الروستر الموحد" },
      {
        key: "roster.view_all_groups",
        en: "View All Crew Roster Groups",
        ar: "عرض كافة مجموعات الروستر (جوي / ضيافة / ترحيل...)",
      },
      {
        key: "roster.manage_groups",
        en: "Add / Edit Roster Groups & Group Permissions",
        ar: "إضافة وتعديل مجموعات الروستر وتخصيص صلاحياتها",
      },
      { key: "roster.create", en: "Add Roster Shift", ar: "إضافة مناوبة روستر" },
      { key: "roster.edit", en: "Edit Roster Shift", ar: "تعديل مناوبة روستر" },
      { key: "roster.delete", en: "Delete Roster Shift", ar: "حذف مناوبة روستر" },
      { key: "roster.publish", en: "Publish Roster", ar: "نشر الروستر" },
    ],
  },

  /* ═══ Standby (inside Unified Roster Hub) ═══ */
  standby: {
    label_en: "Standby (Roster Hub)",
    label_ar: "الاحتياطي (ضمن قسم الروستر الموحد)",
    icon: "⏰",
    perms: [
      { key: "standby.view", en: "View Standby", ar: "عرض الاحتياطي" },
      { key: "standby.create", en: "Create Standby", ar: "إضافة احتياطي" },
      { key: "standby.edit", en: "Edit / Activate Standby", ar: "تعديل وتفعيل الاحتياطي" },
      { key: "standby.delete", en: "Delete Standby", ar: "حذف الاحتياطي" },
    ],
  },

  /* ═══ Leave (inside Unified Roster Hub) ═══ */
  leave: {
    label_en: "Leave (Roster Hub)",
    label_ar: "الإجازات (ضمن قسم الروستر الموحد)",
    icon: "🌴",
    perms: [
      { key: "leave.view", en: "View Leave", ar: "عرض الإجازات" },
      { key: "leave.create", en: "Request / Create Leave", ar: "إضافة طلب إجازة" },
      { key: "leave.edit", en: "Edit Leave", ar: "تعديل الإجازات" },
      { key: "leave.approve", en: "Approve / Reject Leave", ar: "اعتماد أو رفض الإجازات" },
      { key: "leave.delete", en: "Delete Leave", ar: "حذف الإجازات" },
    ],
  },

  /* ═══ Training + Training Dashboard ═══ */
  training: {
    label_en: "Training & Qualifications",
    label_ar: "التدريب والتأهيل",
    icon: "🎓",
    perms: [
      { key: "training.view", en: "View Training", ar: "عرض التدريب" },
      {
        key: "training.dashboard_view",
        en: "View Training Dashboard",
        ar: "عرض داشبورد التدريب",
      },
      {
        key: "training.manage_dashboards",
        en: "Create, Name & Assign Training Dashboards",
        ar: "إنشاء وتسمية لوحات التدريب وتخصيص صلاحياتها",
      },
      { key: "training.create", en: "Create Training Record", ar: "إضافة سجل تدريب" },
      { key: "training.edit", en: "Edit Training Record", ar: "تعديل سجل تدريب" },
      { key: "training.delete", en: "Delete Training Record", ar: "حذف سجل تدريب" },
    ],
  },

  /* ═══ Reports ═══ */
  reports: {
    label_en: "Reports",
    label_ar: "التقارير",
    icon: "📊",
    perms: [
      { key: "reports.view", en: "View", ar: "عرض" },
      { key: "reports.view_all", en: "View All Crew", ar: "عرض كل الطاقم" },
      { key: "reports.export", en: "Export Data", ar: "تصدير البيانات" },
      {
        key: "reports.print_with_stamp",
        en: "Print/Export Reports with Official Stamp",
        ar: "طباعة وتصدير التقارير بالختم الرسمي",
      },
      {
        key: "reports.print_without_stamp",
        en: "Print/Export Reports without Stamp",
        ar: "طباعة وتصدير التقارير بدون ختم",
      },
    ],
  },

  /* ═══ Tracking & Charts ═══ */
  tracking: {
    label_en: "Flight Following",
    label_ar: "تتبع الرحلات",
    icon: "🛰️",
    perms: [{ key: "tracking.view", en: "View", ar: "عرض" }],
  },
  charts: {
    label_en: "Charts",
    label_ar: "الرسوم البيانية",
    icon: "📈",
    perms: [{ key: "charts.view", en: "View", ar: "عرض" }],
  },

  /* ═══ WhatsApp ═══ */
  whatsapp: {
    label_en: "WhatsApp",
    label_ar: "واتساب",
    icon: "💬",
    perms: [
      { key: "whatsapp.view", en: "View", ar: "عرض" },
      { key: "whatsapp.send", en: "Send", ar: "إرسال" },
      { key: "whatsapp.bulk", en: "Bulk Send", ar: "إرسال جماعي" },
    ],
  },

  /* ═══ Email ═══ */
  email: {
    label_en: "Email",
    label_ar: "البريد الإلكتروني",
    icon: "📧",
    perms: [
      { key: "email.view", en: "View", ar: "عرض" },
      { key: "email.send", en: "Send", ar: "إرسال" },
      { key: "email.bulk", en: "Bulk Send", ar: "إرسال جماعي" },
    ],
  },

  /* ═══ Users ═══ */
  users: {
    label_en: "Users",
    label_ar: "المستخدمون",
    icon: "👤",
    perms: [
      { key: "users.view", en: "View", ar: "عرض" },
      { key: "users.create", en: "Add", ar: "إضافة" },
      { key: "users.edit", en: "Edit", ar: "تعديل" },
      { key: "users.delete", en: "Delete", ar: "حذف" },
      { key: "users.password", en: "Password", ar: "كلمة السر" },
      { key: "users.perms", en: "Permissions", ar: "صلاحيات" },
    ],
  },

  /* ═══ Security ═══ */
  security: {
    label_en: "Security",
    label_ar: "الأمان",
    icon: "🔐",
    perms: [
      { key: "security.login_history", en: "Login History", ar: "سجل الدخول" },
      { key: "security.audit_log", en: "Audit Log", ar: "سجل النشاطات" },
    ],
  },

  /* ═══ Settings ═══ */
  settings: {
    label_en: "Settings",
    label_ar: "الإعدادات",
    icon: "⚙️",
    perms: [
      { key: "settings.view", en: "Access Settings", ar: "الوصول للإعدادات" },
      { key: "settings.general_view", en: "View General", ar: "عرض عام" },
      { key: "settings.general_edit", en: "Edit General", ar: "تعديل عام" },
      { key: "settings.logo_upload", en: "Upload Logo", ar: "رفع الشعار" },
      { key: "settings.logo_remove", en: "Remove Logo", ar: "إزالة الشعار" },
      { key: "settings.view_stamp", en: "View Stamp", ar: "رؤية الختم" },
      {
        key: "settings.edit_stamp",
        en: "Upload/Edit Stamp",
        ar: "رفع/تعديل الختم",
      },
      {
        key: "settings.appearance_view",
        en: "View Appearance",
        ar: "عرض المظهر",
      },
      {
        key: "settings.appearance_edit",
        en: "Edit Appearance",
        ar: "تعديل المظهر",
      },
      {
        key: "settings.global_theme",
        en: "Change Unified System Theme",
        ar: "تغيير ثيم النظام الموحد",
      },
      {
        key: "settings.nav_layout",
        en: "Change Navigation Layout",
        ar: "تغيير تخطيط التنقل",
      },
      {
        key: "settings.tab_prefs",
        en: "Customize Tab Preferences",
        ar: "تخصيص التبويبات",
      },
      { key: "settings.sounds_view", en: "View Sounds", ar: "عرض الأصوات" },
      { key: "settings.sounds_edit", en: "Edit Sounds", ar: "تعديل الأصوات" },
      {
        key: "settings.positions_view",
        en: "View Positions",
        ar: "عرض الوظائف",
      },
      {
        key: "settings.positions_edit",
        en: "Edit Positions",
        ar: "تعديل الوظائف",
      },
      {
        key: "settings.edit",
        en: "Full Edit Settings",
        ar: "تعديل كامل للإعدادات",
      },
    ],
  },

  /* ═══ Alerts ═══ */
  alerts: {
    label_en: "Alerts",
    label_ar: "التنبيهات",
    icon: "🔔",
    perms: [
      { key: "alerts.view", en: "View Alerts", ar: "عرض التنبيهات" },
      { key: "alerts.dismiss", en: "Dismiss Alerts", ar: "تجاهل التنبيهات" },
      {
        key: "alerts.manage",
        en: "Manage Alert Settings",
        ar: "إدارة إعدادات التنبيهات",
      },
    ],
  },

  /* ⭐ Central Documents & Compliance Dashboard */
  documents: {
    label_en: "Documents Dashboard",
    label_ar: "مركز المستندات والامتثال",
    icon: "📁",
    perms: [
      {
        key: "documents.view",
        en: "Access Documents Dashboard",
        ar: "الوصول لمركز المستندات والامتثال",
      },
      {
        key: "documents.upload",
        en: "Upload Documents to Google Drive",
        ar: "رفع وتخزين المستندات في Google Drive",
      },
      {
        key: "documents.edit",
        en: "Edit & Renew Document Expiry",
        ar: "تعديل وتجديد صلاحيات المستندات",
      },
      {
        key: "documents.delete",
        en: "Delete Documents",
        ar: "حذف المستندات",
      },
      {
        key: "documents.manage_departments",
        en: "Manage Departments & Job Roles",
        ar: "إدارة الأقسام والتصنيفات الوظيفية",
      },
      {
        key: "documents.email_alerts",
        en: "Send Expiry Email Notifications",
        ar: "إرسال إشعارات البريد للتنبيه بالانتهاء",
      },
      {
        key: "documents.view_all_depts",
        en: "View Documents Across All Departments",
        ar: "عرض مستندات كافة الأقسام (تجاوز حصر القسم)",
      },
    ],
  },
};

export const ALL_PERMS_FLAT = Object.values(ALL_PERMISSIONS).flatMap((g) =>
  g.perms.map((p) => p.key)
);

export const TOTAL_PERMS_COUNT = ALL_PERMS_FLAT.length;

/* ═══════════════════════════════════════════════════════════
 * ROLE TEMPLATES — محدثة مع CAMO/Permits/Catering/Portal
 * ═══════════════════════════════════════════════════════════ */
export const ROLE_TEMPLATES = {
  superAdmin: {
    label_en: "Super Admin",
    label_ar: "مدير عام",
    description_en: "Full system access",
    description_ar: "وصول كامل للنظام",
    color: "rose",
    icon: "👑",
    perms: ["*"],
  },
  dispatcher: {
    label_en: "Dispatcher",
    label_ar: "منظم رحلات",
    description_en: "Flight dispatcher with full ops access",
    description_ar: "منظم رحلات مع صلاحيات تشغيلية كاملة",
    color: "sky",
    icon: "📋",
    perms: [
      "dashboard.customize",
      "dashboard.quality_view",
      "dashboard.manage_named",
      "quality.view",
      "quality.dashboard_view",
      "quality.manage_dashboards",
      "quality.audits_view",
      "quality.audits_manage",
      "schedule.view",
      "schedule.create",
      "schedule.edit",
      "schedule.delete",
      "schedule.assign_crew",
      "schedule.gendec_view",
      "schedule.gendec_stamp",
      "schedule.gendec_no_stamp",
      "ftl.view",
      "ftl.edit",
      "reports.view",
      "reports.view_all",
      "reports.export",
      "reports.print_with_stamp",
      "reports.print_without_stamp",
      "fleet.view",
      "fleet.docs",
      "fleet.docs_download",
      "camo.view",
      "camo.dashboard_view",
      "mel.view",
      "permits.view",
      "permits.create",
      "permits.edit",
      "permits.print_with_stamp",
      "permits.print_without_stamp",
      "forms.view",
      "forms.create",
      "forms.edit",
      "forms.delete",
      "forms.print_with_stamp",
      "forms.print_without_stamp",
      "catering.view",
      "catering.create",
      "catering.edit",
      "catering.dry_store",
      "catering.print_with_stamp",
      "catering.print_without_stamp",
      "crew.view",
      "crew.edit",
      "crew.docs",
      "crew.docs_edit",
      "crew.docs_download",
      "crew.card",
      "crew.portal",
      "portal.schedule",
      "portal.completed_flights",
      "portal.completed_flights_edit",
      "portal.catering",
      "portal.certificates",
      "portal.ftl",
      "portal.manuals",
      "portal.hours",
      "portal.aircraft_status",
      "portal.print_with_stamp",
      "portal.print_without_stamp",
      "manuals.view",
      "manuals.upload",
      "manuals.manage",
      "manuals.audit",
      "roster.view",
      "roster.view_all_groups",
      "roster.manage_groups",
      "roster.create",
      "roster.edit",
      "roster.delete",
      "roster.publish",
      "standby.view",
      "standby.create",
      "standby.edit",
      "standby.delete",
      "leave.view",
      "leave.create",
      "leave.edit",
      "leave.approve",
      "leave.delete",
      "training.view",
      "training.dashboard_view",
      "training.manage_dashboards",
      "training.create",
      "training.edit",
      "training.delete",
      "tracking.view",
      "charts.view",
      "whatsapp.view",
      "whatsapp.send",
      "whatsapp.bulk",
      "email.view",
      "email.send",
      "email.bulk",
      "users.view",
      "security.login_history",
      "security.audit_log",
      "settings.view",
      "settings.general_view",
      "settings.general_edit",
      "settings.logo_upload",
      "settings.logo_remove",
      "settings.view_stamp",
      "settings.edit_stamp",
      "settings.appearance_view",
      "settings.appearance_edit",
      "settings.global_theme",
      "settings.nav_layout",
      "settings.tab_prefs",
      "settings.sounds_view",
      "settings.sounds_edit",
      "settings.positions_view",
      "settings.positions_edit",
      "settings.edit",
      "alerts.view",
      "alerts.dismiss",
      "alerts.manage",
      "documents.view",
      "documents.upload",
      "documents.edit",
      "documents.delete",
      "documents.manage_departments",
      "documents.email_alerts",
      "documents.view_all_depts",
    ],
  },
  captain: {
    label_en: "Captain",
    label_ar: "كابتن",
    description_en: "Captain with read access to ops",
    description_ar: "كابتن بصلاحيات عرض",
    color: "amber",
    icon: "✈️",
    perms: [
      "dashboard.customize",
      "dashboard.quality_view",
      "quality.view",
      "quality.dashboard_view",
      "quality.audits_view",
      "schedule.view",
      "schedule.gendec_view",
      "schedule.gendec_no_stamp",
      "ftl.view",
      "reports.view",
      "reports.export",
      "reports.print_without_stamp",
      "fleet.view",
      "fleet.docs",
      "fleet.docs_download",
      "camo.view",
      "camo.dashboard_view",
      "mel.view",
      "permits.view",
      "permits.print_without_stamp",
      "forms.view",
      "forms.print_without_stamp",
      "catering.view",
      "catering.print_without_stamp",
      "crew.view",
      "crew.card",
      "crew.docs",
      "crew.docs_download",
      "crew.portal",
      "portal.schedule",
      "portal.completed_flights",
      "portal.completed_flights_edit",
      "portal.catering",
      "portal.certificates",
      "portal.ftl",
      "portal.manuals",
      "portal.hours",
      "portal.aircraft_status",
      "portal.print_without_stamp",
      "manuals.view",
      "roster.view",
      "roster.view_all_groups",
      "standby.view",
      "leave.view",
      "leave.create",
      "training.view",
      "training.dashboard_view",
      "tracking.view",
      "charts.view",
      "email.view",
      "email.send",
      "settings.view",
      "settings.general_view",
      "settings.view_stamp",
      "settings.appearance_view",
      "settings.sounds_view",
      "alerts.view",
      "documents.view",
      "documents.upload",
    ],
  },
  camo: {
    label_en: "CAMO",
    label_ar: "CAMO",
    description_en: "Continuing airworthiness management",
    description_ar: "إدارة صلاحية الطيران",
    color: "purple",
    icon: "🔧",
    perms: [
      "dashboard.customize",
      "dashboard.quality_view",
      "quality.view",
      "quality.dashboard_view",
      "quality.manage_dashboards",
      "quality.audits_view",
      "quality.audits_manage",
      "fleet.view",
      "fleet.create",
      "fleet.edit",
      "fleet.delete",
      "fleet.docs",
      "fleet.docs_edit",
      "fleet.docs_download",
      "camo.view",
      "camo.dashboard_view",
      "camo.manage_dashboards",
      "camo.edit",
      "mel.view",
      "mel.edit",
      "permits.view",
      "permits.create",
      "permits.edit",
      "permits.delete",
      "permits.print_with_stamp",
      "permits.print_without_stamp",
      "catering.view",
      "catering.print_without_stamp",
      "crew.view",
      "crew.docs",
      "crew.docs_download",
      "portal.schedule",
      "portal.completed_flights",
      "portal.catering",
      "portal.certificates",
      "portal.ftl",
      "portal.manuals",
      "portal.hours",
      "portal.aircraft_status",
      "portal.print_without_stamp",
      "manuals.view",
      "manuals.upload",
      "roster.view",
      "standby.view",
      "leave.view",
      "training.view",
      "training.dashboard_view",
      "reports.view",
      "reports.view_all",
      "reports.export",
      "reports.print_with_stamp",
      "reports.print_without_stamp",
      "charts.view",
      "email.view",
      "email.send",
      "email.bulk",
      "settings.view",
      "settings.general_view",
      "settings.general_edit",
      "settings.view_stamp",
      "settings.edit_stamp",
      "settings.appearance_view",
      "settings.sounds_view",
      "alerts.view",
      "alerts.dismiss",
    ],
  },
  crewMember: {
    label_en: "Crew Member",
    label_ar: "عضو طاقم",
    description_en: "Crew member with minimal access",
    description_ar: "عضو طاقم بصلاحيات محدودة",
    color: "emerald",
    icon: "👤",
    perms: [
      "dashboard.customize",
      "schedule.view",
      "ftl.view",
      "reports.view",
      "reports.export",
      "reports.print_without_stamp",
      "camo.view",
      "camo.dashboard_view",
      "mel.view",
      "permits.view",
      "catering.view",
      "crew.view",
      "crew.card",
      "crew.docs",
      "crew.docs_download",
      "crew.portal",
      "portal.schedule",
      "portal.completed_flights",
      "portal.catering",
      "portal.certificates",
      "portal.ftl",
      "portal.manuals",
      "portal.hours",
      "portal.aircraft_status",
      "portal.print_without_stamp",
      "manuals.view",
      "roster.view",
      "standby.view",
      "leave.view",
      "leave.create",
      "training.view",
      "training.dashboard_view",
      "settings.view",
      "settings.general_view",
      "settings.appearance_view",
      "settings.sounds_view",
      "alerts.view",
    ],
  },
};

/* ═══════════════════════════════════════════════════════════
 * Global Roles storage
 * ═══════════════════════════════════════════════════════════ */
let _globalRoles = [];
export const setGlobalRoles = (r) => {
  _globalRoles = Array.isArray(r) ? r : [];
};
export const getGlobalRoles = () => _globalRoles;

let _globalNamedDashboards = [];
export const setGlobalNamedDashboards = (list) => {
  _globalNamedDashboards = Array.isArray(list) ? list : [];
};
export const getGlobalNamedDashboards = () => _globalNamedDashboards;

let _globalRosterGroups = [];
export const setGlobalRosterGroups = (list) => {
  _globalRosterGroups = Array.isArray(list) ? list : [];
};
export const getGlobalRosterGroups = () => _globalRosterGroups;

export const getNamedDashboardPermKeys = (dashId) => {
  const cleanId = String(dashId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 42);
  return {
    view: `named_dash.${cleanId}.view`,
    edit: `named_dash.${cleanId}.edit`,
  };
};

export const getRosterGroupPermKeys = (groupId) => {
  const cleanId = String(groupId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 42);
  return {
    view: `roster_grp.${cleanId}.view`,
    edit: `roster_grp.${cleanId}.edit`,
  };
};

export const getPermissionsWithNamedDashboards = (
  customDashboards,
  customRosterGroups
) => {
  const dashList = Array.isArray(customDashboards)
    ? customDashboards
    : _globalNamedDashboards;
  const groupList = Array.isArray(customRosterGroups)
    ? customRosterGroups
    : _globalRosterGroups;

  const dynamicDashPerms = [];
  (Array.isArray(dashList) ? dashList : []).forEach((d) => {
    if (!d || !d.id) return;
    const keys = getNamedDashboardPermKeys(d.id);
    const titleEn = d.name || d.nameAr || d.id;
    const titleAr = d.nameAr || d.name || d.id;
    const scopeTagEn =
      d.scope === "main"
        ? "Main"
        : d.scope === "camo"
        ? "CAMO"
        : d.scope === "training"
        ? "Training"
        : d.scope === "both"
        ? "Main & Quality"
        : "Quality Mgmt";
    const scopeTagAr =
      d.scope === "main"
        ? "الرئيسية"
        : d.scope === "camo"
        ? "CAMO"
        : d.scope === "training"
        ? "التدريب"
        : d.scope === "both"
        ? "الرئيسية والجودة"
        : "إدارة الجودة";
    dynamicDashPerms.push(
      {
        key: keys.view,
        en: `[${scopeTagEn}] "${titleEn}" — View`,
        ar: `[${scopeTagAr}] "${titleAr}" — عرض`,
      },
      {
        key: keys.edit,
        en: `[${scopeTagEn}] "${titleEn}" — Edit & Customize`,
        ar: `[${scopeTagAr}] "${titleAr}" — تعديل وتخصيص`,
      }
    );
  });

  const dynamicGroupPerms = [];
  (Array.isArray(groupList) ? groupList : []).forEach((g) => {
    if (!g || !g.id) return;
    const keys = getRosterGroupPermKeys(g.id);
    const titleEn = g.name || g.nameAr || g.id;
    const titleAr = g.nameAr || g.name || g.id;
    dynamicGroupPerms.push(
      {
        key: keys.view,
        en: `"${titleEn}" — View Group Roster/Leave/Standby`,
        ar: `"${titleAr}" — عرض روستر وإجازات واحتياطي المجموعة`,
      },
      {
        key: keys.edit,
        en: `"${titleEn}" — Edit Group Shifts & Requests`,
        ar: `"${titleAr}" — تعديل مناوبات وطلبات المجموعة`,
      }
    );
  });

  const extra = {};
  if (dynamicGroupPerms.length > 0) {
    extra.roster_groups = {
      label_en: "Roster Groups Access",
      label_ar: "صلاحيات مجموعات الروستر",
      icon: "👥",
      perms: dynamicGroupPerms,
    };
  }
  if (dynamicDashPerms.length > 0) {
    extra.named_dashboards = {
      label_en: "Named Dashboards Access",
      label_ar: "صلاحيات اللوحات المسماة",
      icon: "🗂️",
      perms: dynamicDashPerms,
    };
  }

  if (Object.keys(extra).length === 0) return ALL_PERMISSIONS;
  return {
    ...ALL_PERMISSIONS,
    ...extra,
  };
};

/* ═══════════════════════════════════════════════════════════
 * Helpers & Legacy Crew Portal Schema Migration (v2)
 * ═══════════════════════════════════════════════════════════ */
export const PORTAL_SCHEMA_MARKER = "portal._v2";
export const PRINT_SCHEMA_MARKER = "portal._print_v1";
export const QUALITY_SCHEMA_MARKER = "quality._v1";
export const OPS_V2_SCHEMA_MARKER = "quality._v2";

export const PORTAL_DEFAULT_VIEW_PERMS = [
  "portal.schedule",
  "portal.completed_flights",
  "portal.catering",
  "portal.aircraft_status",
  "portal.certificates",
  "portal.ftl",
  "portal.manuals",
  "portal.hours",
  "portal.print_without_stamp",
];

const _parsePerms = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const _normalizeRole = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

export const stripInternalPermMarkers = (perms) =>
  _parsePerms(perms).filter(
    (p) =>
      typeof p === "string" &&
      !p.startsWith("portal._") &&
      !p.startsWith("quality._") &&
      p !== "reports.export_stamp"
  );

export const markPortalSchemaSaved = (perms) => {
  const list = _parsePerms(perms);
  if (list.includes("*")) return ["*"];
  return Array.from(
    new Set([
      ...stripInternalPermMarkers(list),
      PORTAL_SCHEMA_MARKER,
      PRINT_SCHEMA_MARKER,
      QUALITY_SCHEMA_MARKER,
      OPS_V2_SCHEMA_MARKER,
    ])
  );
};

/**
 * Ensures roles/users persisted before `portal._v2` & `portal._print_v1`
 * automatically receive sensible defaults, while strictly honoring exact
 * checked/unchecked state (both WITH stamp and WITHOUT stamp) once saved.
 */
export const upgradeLegacyPortalPerms = (rawPerms, roleName = "") => {
  const perms = _parsePerms(rawPerms);
  if (perms.length === 0) return [];
  if (perms.includes("*")) return perms;

  const roleNorm = _normalizeRole(roleName);
  const additions = [];

  if (!perms.includes(PORTAL_SCHEMA_MARKER)) {
    const hasAnyPortalIcon = perms.some(
      (p) =>
        typeof p === "string" &&
        p.startsWith("portal.") &&
        !p.startsWith("portal._")
    );
    const hasPortalContext =
      perms.includes("crew.portal") ||
      hasAnyPortalIcon ||
      ["crewmember", "crew_member", "captain", "dispatcher", "camo"].includes(
        roleNorm
      );

    if (hasPortalContext) {
      if (!hasAnyPortalIcon) {
        additions.push(...PORTAL_DEFAULT_VIEW_PERMS, "catering.view");
      } else {
        additions.push(
          "portal.completed_flights",
          "portal.catering",
          "catering.view"
        );
      }

      if (
        perms.includes("schedule.edit") ||
        ["captain", "dispatcher"].includes(roleNorm)
      ) {
        additions.push("portal.completed_flights_edit");
      }
    }
  }

  if (!perms.includes(PRINT_SCHEMA_MARKER)) {
    const combined = new Set([...perms, ...additions]);

    if (combined.has("reports.export_stamp")) {
      additions.push("reports.print_with_stamp");
      if (combined.has("crew.portal")) {
        additions.push("portal.print_with_stamp");
      }
    }

    if (combined.has("reports.export") || combined.has("reports.view")) {
      additions.push("reports.print_without_stamp");
      if (combined.has("crew.portal")) {
        additions.push("portal.print_without_stamp");
      }
    }

    if (combined.has("schedule.edit") || roleNorm === "dispatcher") {
      additions.push("schedule.gendec_stamp", "schedule.gendec_no_stamp");
    } else if (
      combined.has("schedule.view") ||
      combined.has("schedule.gendec_view")
    ) {
      additions.push("schedule.gendec_no_stamp");
    }

    if (combined.has("permits.edit") && roleNorm === "dispatcher") {
      additions.push("permits.print_with_stamp", "permits.print_without_stamp");
    } else if (combined.has("permits.view") || combined.has("permits.edit")) {
      additions.push("permits.print_without_stamp");
    }

    if (combined.has("forms.edit") && roleNorm === "dispatcher") {
      additions.push("forms.print_with_stamp", "forms.print_without_stamp");
    } else if (combined.has("forms.view") || combined.has("forms.edit")) {
      additions.push("forms.print_without_stamp");
    }

    if (combined.has("catering.edit") && roleNorm === "dispatcher") {
      additions.push(
        "catering.print_with_stamp",
        "catering.print_without_stamp"
      );
    } else if (combined.has("catering.view") || combined.has("catering.edit")) {
      additions.push("catering.print_without_stamp");
    }
  }

  // Ensure existing custom-perm users can customize their dashboard and see quality widgets if they hold quality-related view perms
  additions.push("dashboard.customize");
  if (
    perms.includes("camo.view") ||
    perms.includes("training.view") ||
    perms.includes("manuals.view") ||
    perms.includes("alerts.view")
  ) {
    additions.push("dashboard.quality_view");
  }

  if (!perms.includes(QUALITY_SCHEMA_MARKER)) {
    const combinedQ = new Set([...perms, ...additions]);
    if (
      combinedQ.has("dashboard.quality_view") ||
      combinedQ.has("camo.view") ||
      ["dispatcher", "camo", "captain"].includes(roleNorm) ||
      roleNorm.includes("quality")
    ) {
      additions.push("quality.view", "quality.audits_view");
    }
    if (
      combinedQ.has("camo.edit") ||
      combinedQ.has("users.perms") ||
      combinedQ.has("settings.edit") ||
      ["dispatcher", "camo"].includes(roleNorm) ||
      roleNorm.includes("quality")
    ) {
      additions.push("quality.audits_manage", "quality.manage_dashboards");
    }
    if (
      combinedQ.has("users.perms") ||
      combinedQ.has("settings.edit") ||
      roleNorm === "dispatcher"
    ) {
      additions.push("dashboard.manage_named");
    }
  }

  if (!perms.includes(OPS_V2_SCHEMA_MARKER)) {
    const combinedV2 = new Set([...perms, ...additions]);
    if (combinedV2.has("quality.view")) {
      additions.push("quality.dashboard_view");
    }
    if (combinedV2.has("camo.view")) {
      additions.push("camo.dashboard_view");
    }
    if (
      combinedV2.has("camo.edit") ||
      combinedV2.has("users.perms") ||
      ["camo", "dispatcher"].includes(roleNorm)
    ) {
      additions.push("camo.manage_dashboards");
    }
    if (combinedV2.has("training.view")) {
      additions.push("training.dashboard_view");
    }
    if (
      combinedV2.has("training.edit") ||
      combinedV2.has("users.perms") ||
      roleNorm === "dispatcher"
    ) {
      additions.push("training.manage_dashboards");
    }
    if (
      combinedV2.has("roster.edit") ||
      combinedV2.has("schedule.assign_crew") ||
      ["dispatcher", "captain"].includes(roleNorm)
    ) {
      additions.push("roster.view_all_groups");
    }
    if (
      combinedV2.has("roster.publish") ||
      combinedV2.has("users.perms") ||
      roleNorm === "dispatcher"
    ) {
      additions.push("roster.manage_groups");
    }
    if (combinedV2.has("leave.approve")) {
      additions.push("leave.edit");
    }
  }

  return Array.from(new Set([...perms, ...additions]));
};

const _ADMIN_ALIASES = [
  "superadmin",
  "super_admin",
  "super-admin",
  "admin",
  "administrator",
  "owner",
  "root",
];

const _BASIC_PERMS = [
  "dashboard.customize",
  "dashboard.quality_view",
  "quality.view",
  "quality.dashboard_view",
  "quality.audits_view",
  "schedule.view",
  "fleet.view",
  "crew.view",
  "ftl.view",
  "reports.view",
  "roster.view",
  "leave.view",
  "training.view",
  "training.dashboard_view",
  "standby.view",
  "manuals.view",
  "charts.view",
  "tracking.view",
  "settings.view",
  "alerts.view",
  "users.view",
  "crew.portal",
  "settings.general_view",
  "settings.appearance_view",
  "settings.sounds_view",
  // ⭐ v6.0
  "camo.view",
  "camo.dashboard_view",
  "mel.view",
  "permits.view",
  "forms.view",
  "catering.view",
  "portal.schedule",
  "portal.completed_flights",
  "portal.catering",
  "portal.certificates",
  "portal.ftl",
  "portal.manuals",
  "portal.hours",
  "portal.aircraft_status",
];

const _findRole = (user) => {
  if (!user) return null;
  const roleLower = _normalizeRole(user.role);
  const roleId = user.roleId;
  return _globalRoles.find(
    (r) =>
      _normalizeRole(r.name) === roleLower ||
      _normalizeRole(r.nameAr) === roleLower ||
      (roleId != null && String(r.id) === String(roleId))
  );
};

const _findTemplate = (user) => {
  if (!user) return null;
  const roleLower = _normalizeRole(user.role);
  const key = Object.keys(ROLE_TEMPLATES).find(
    (k) => _normalizeRole(k) === roleLower
  );
  return key ? ROLE_TEMPLATES[key] : null;
};

/* ═══════════════════════════════════════════════════════════
 * can()
 * ═══════════════════════════════════════════════════════════ */
export const can = (user, perm) => {
  if (!user || !perm) return false;

  const roleLower = _normalizeRole(user.role);

  /* 1) صلاحيات مخصصة صريحة على المستخدم */
  const rawUserPerms = _parsePerms(user.perms);
  if (rawUserPerms.length > 0) {
    if (rawUserPerms.includes("*")) return true;
    const effectiveUserPerms = upgradeLegacyPortalPerms(
      rawUserPerms,
      user.role
    );
    return effectiveUserPerms.includes(perm);
  }

  /* 2) الأدوار الإدارية العليا */
  if (_ADMIN_ALIASES.includes(roleLower)) return true;

  /* 3) البحث في _globalRoles — مع ترقية تلقائية للأيقونات الجديدة إن لم يُحفظ الدور بنسخة portal._v2 بعد */
  const role = _findRole(user);
  if (role) {
    const parsedRolePerms = _parsePerms(role.perms);
    if (parsedRolePerms.length > 0) {
      if (parsedRolePerms.includes("*")) return true;
      const effectiveRolePerms = upgradeLegacyPortalPerms(
        parsedRolePerms,
        role.name || user.role
      );
      return effectiveRolePerms.includes(perm);
    }
  }

  /* 4) fallback إلى ROLE_TEMPLATES إذا لم تكن هناك صلاحيات مخصصة في قاعدة البيانات */
  const tpl = _findTemplate(user);
  if (tpl && Array.isArray(tpl.perms) && tpl.perms.length > 0) {
    if (tpl.perms.includes("*")) return true;
    return tpl.perms.includes(perm);
  }

  /* 5) crewMember fallback */
  if (roleLower === "crewmember" || roleLower === "crew_member") {
    return ROLE_TEMPLATES.crewMember.perms.includes(perm);
  }

  /* 6) fallback أخير للأدوار غير المعروفة */
  if (_BASIC_PERMS.includes(perm)) return true;

  return false;
};

/* ═══════════════════════════════════════════════════════════
 * getUserPermissions / countPermissions
 * ═══════════════════════════════════════════════════════════ */
export const getUserPermissions = (user) => {
  if (!user) return [];
  const roleLower = _normalizeRole(user.role);
  if (_ADMIN_ALIASES.includes(roleLower)) return ["*"];
  const userPerms = _parsePerms(user.perms);
  if (userPerms.length > 0) {
    return stripInternalPermMarkers(
      upgradeLegacyPortalPerms(userPerms, user.role)
    );
  }
  const role = _findRole(user);
  let rolePerms = role?.perms;
  if (!rolePerms || _parsePerms(rolePerms).length === 0) {
    const tpl = _findTemplate(user);
    rolePerms = tpl?.perms || [];
  } else {
    rolePerms = upgradeLegacyPortalPerms(rolePerms, role?.name || user.role);
  }
  return stripInternalPermMarkers(rolePerms);
};

export const countPermissions = (user) => {
  if (!user) return 0;
  const roleLower = _normalizeRole(user.role);
  if (_ADMIN_ALIASES.includes(roleLower)) return TOTAL_PERMS_COUNT;
  const userPerms = _parsePerms(user.perms);
  if (userPerms.length > 0) {
    if (userPerms.includes("*")) return TOTAL_PERMS_COUNT;
    return stripInternalPermMarkers(
      upgradeLegacyPortalPerms(userPerms, user.role)
    ).length;
  }
  const role = _findRole(user);
  let rolePerms = role?.perms;
  if (!rolePerms || _parsePerms(rolePerms).length === 0) {
    const tpl = _findTemplate(user);
    rolePerms = tpl?.perms || [];
  } else {
    rolePerms = upgradeLegacyPortalPerms(rolePerms, role?.name || user.role);
  }
  rolePerms = _parsePerms(rolePerms);
  if (rolePerms.includes("*")) return TOTAL_PERMS_COUNT;
  return stripInternalPermMarkers(rolePerms).length;
};

export const getRolePermissions = (roleName) => {
  if (!roleName) return [];
  const roleLower = _normalizeRole(roleName);
  if (_ADMIN_ALIASES.includes(roleLower)) return ["*"];
  const role = _globalRoles.find(
    (r) =>
      _normalizeRole(r.name) === roleLower ||
      _normalizeRole(r.nameAr) === roleLower
  );
  if (role && role.perms) {
    const parsed = _parsePerms(role.perms);
    if (parsed.length > 0) {
      if (parsed.includes("*")) return ["*"];
      return stripInternalPermMarkers(
        upgradeLegacyPortalPerms(parsed, role.name)
      );
    }
  }
  const tplKey = Object.keys(ROLE_TEMPLATES).find(
    (k) => _normalizeRole(k) === roleLower
  );
  const tpl = tplKey ? ROLE_TEMPLATES[tplKey] : null;
  if (tpl && Array.isArray(tpl.perms)) return tpl.perms;
  return [];
};

/* ═══════════════════════════════════════════════════════════
 * Role Color / Icon / Label
 * ═══════════════════════════════════════════════════════════ */
const ROLE_COLOR_MAP = {
  superAdmin:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-700",
  dispatcher:
    "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-700",
  captain:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
  camo: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700",
  crewMember:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
};

const ROLE_ICON_MAP = {
  superAdmin: "👑",
  dispatcher: "📋",
  captain: "✈️",
  camo: "🔧",
  crewMember: "👤",
};

const FALLBACK_COLORS = [
  "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700",
  "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-700",
  "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950 dark:text-pink-200 dark:border-pink-700",
  "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700",
  "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-950 dark:text-lime-200 dark:border-lime-700",
];

const _hashColor = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
};

export const getRoleColor = (roleName) => {
  if (!roleName) return FALLBACK_COLORS[0];
  if (ROLE_COLOR_MAP[roleName]) return ROLE_COLOR_MAP[roleName];
  const roleLower = _normalizeRole(roleName);
  const mapKey = Object.keys(ROLE_COLOR_MAP).find(
    (k) => _normalizeRole(k) === roleLower
  );
  if (mapKey) return ROLE_COLOR_MAP[mapKey];
  const role = _globalRoles.find(
    (r) =>
      _normalizeRole(r.name) === roleLower ||
      _normalizeRole(r.nameAr) === roleLower
  );
  if (role?.color) {
    const c = role.color;
    if (typeof c === "string" && c.startsWith("#"))
      return `border-slate-300 dark:border-slate-600`;
    if (typeof c === "string" && /^[a-z]+$/.test(c))
      return `bg-${c}-100 text-${c}-800 border-${c}-300 dark:bg-${c}-950 dark:text-${c}-200 dark:border-${c}-700`;
  }
  return _hashColor(roleName);
};

export const getRoleIcon = (roleName) => {
  if (!roleName) return "👤";
  if (ROLE_ICON_MAP[roleName]) return ROLE_ICON_MAP[roleName];
  const roleLower = _normalizeRole(roleName);
  const mapKey = Object.keys(ROLE_ICON_MAP).find(
    (k) => _normalizeRole(k) === roleLower
  );
  if (mapKey) return ROLE_ICON_MAP[mapKey];
  const role = _globalRoles.find(
    (r) =>
      _normalizeRole(r.name) === roleLower ||
      _normalizeRole(r.nameAr) === roleLower
  );
  if (role?.icon) return role.icon;
  return "👤";
};

export const getRoleLabel = (roleName, lang = "en") => {
  if (!roleName) return "—";
  const tpl = ROLE_TEMPLATES[roleName];
  if (tpl) return lang === "ar" ? tpl.label_ar : tpl.label_en;
  const roleLower = _normalizeRole(roleName);
  const tplKey = Object.keys(ROLE_TEMPLATES).find(
    (k) => _normalizeRole(k) === roleLower
  );
  if (tplKey) {
    const t = ROLE_TEMPLATES[tplKey];
    return lang === "ar" ? t.label_ar : t.label_en;
  }
  const role = _globalRoles.find(
    (r) =>
      _normalizeRole(r.name) === roleLower ||
      _normalizeRole(r.nameAr) === roleLower
  );
  if (role) return lang === "ar" ? role.nameAr || role.name : role.name;
  return roleName;
};

export const getRoleTemplate = (roleName) => {
  if (!roleName) return null;
  if (ROLE_TEMPLATES[roleName]) return ROLE_TEMPLATES[roleName];
  const roleLower = _normalizeRole(roleName);
  const key = Object.keys(ROLE_TEMPLATES).find(
    (k) => _normalizeRole(k) === roleLower
  );
  return key ? ROLE_TEMPLATES[key] : null;
};

export const hasPermission = can;

export const getPermissionLabel = (permKey, lang = "en") => {
  for (const group of Object.values(ALL_PERMISSIONS)) {
    const perm = group.perms.find((p) => p.key === permKey);
    if (perm) return lang === "ar" ? perm.ar : perm.en;
  }
  return permKey;
};

export const groupPermissions = () => {
  return Object.entries(ALL_PERMISSIONS).map(([key, group]) => ({
    key,
    label_en: group.label_en,
    label_ar: group.label_ar,
    icon: group.icon,
    perms: group.perms,
  }));
};
