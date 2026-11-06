/* ═══════════════════════════════════════════════════════════
 * EMAIL MODULE — Sender Email Accounts + Crew & External Dispatch
 * v3.0 — Add/Manage Sender Emails (SMTP Direct or System Relay),
 *        Test Connection, Send From Selector, Custom Recipients
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction } from "../utils/dialog";
import React, { useState, useMemo, useEffect } from "react";
import {
  Mail,
  Send,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Lock,
  User as UserIcon,
  Settings,
  Save,
  Plus,
  Trash2,
  Edit,
  Star,
  Server,
  ShieldCheck,
  X,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { can as checkPerm } from "../config/permissions";
import { sendEmail, settingsAPI } from "../api";
import {
  SMTP_PRESETS,
  listEmailAccounts,
  upsertEmailAccount,
  removeEmailAccount,
  setDefaultEmailAccount,
  testSenderEmailAccount,
} from "../utils/emailAccounts";

const TEMPLATES = [
  {
    id: "roster",
    icon: "📅",
    label_en: "Roster Notification",
    label_ar: "إشعار الجدول",
    category: "Operations",
    subject_en: "New Roster Published",
    subject_ar: "تم نشر جدول جديد",
    text: "عزيزي {name},\nتم نشر جدولك الجديد. الرجاء مراجعة Roster في المنظومة.\n\nOperations Team",
  },
  {
    id: "flight_change",
    icon: "✈️",
    label_en: "Flight Change",
    label_ar: "تغيير رحلة",
    category: "Operations",
    subject_en: "Flight Change Notification",
    subject_ar: "إشعار تغيير رحلة",
    text: "عزيزي {name},\nتم تغيير تفاصيل رحلتك. الرجاء مراجعة الجدول فوراً.\n\nOperations Team",
  },
  {
    id: "standby_alert",
    icon: "⏰",
    label_en: "Standby Alert",
    label_ar: "تنبيه احتياطي",
    category: "Operations",
    subject_en: "Standby Alert",
    subject_ar: "تنبيه احتياطي",
    text: "عزيزي {name},\nأنت في Standby. الرجاء البقاء متاحاً.\n\nOperations Team",
  },
  {
    id: "reminder",
    icon: "🔔",
    label_en: "Duty Reminder",
    label_ar: "تذكير واجب",
    category: "Operations",
    subject_en: "Duty Reminder",
    subject_ar: "تذكير واجب",
    text: "عزيزي {name},\nتذكير: لديك رحلة غداً. الرجاء الحضور قبل STD بـ 60 دقيقة.\n\nOperations Team",
  },
  {
    id: "medical",
    icon: "🩺",
    label_en: "Medical Expiry",
    label_ar: "انتهاء طبي",
    category: "Compliance",
    subject_en: "Medical Certificate Expiry",
    subject_ar: "انتهاء الشهادة الطبية",
    text: "عزيزي {name},\nشهادتك الطبية على وشك الانتهاء. الرجاء التجديد قبل الموعد.\n\nOperations Team",
  },
  {
    id: "training",
    icon: "🎓",
    label_en: "Training Due",
    label_ar: "تدريب مستحق",
    category: "Compliance",
    subject_en: "Training Due",
    subject_ar: "تدريب مستحق",
    text: "عزيزي {name},\nلديك تدريب مستحق. الرجاء مراجعة المنظومة.\n\nOperations Team",
  },
  {
    id: "leave_approved",
    icon: "✅",
    label_en: "Leave Approved",
    label_ar: "موافقة إجازة",
    category: "HR",
    subject_en: "Leave Request Approved",
    subject_ar: "تمت الموافقة على طلب الإجازة",
    text: "عزيزي {name},\nتمت الموافقة على طلب إجازتك. نتمنى لك وقتاً سعيداً!\n\nOperations Team",
  },
  {
    id: "custom",
    icon: "✍️",
    label_en: "Custom Message",
    label_ar: "رسالة مخصصة",
    category: "Custom",
    subject_en: "",
    subject_ar: "",
    text: "",
  },
];

const EMPTY_ACCOUNT_FORM = {
  id: "",
  email: "",
  name: "Flight Operations",
  mode: "smtp",
  preset: "gmail",
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpUser: "",
  smtpPass: "",
  isDefault: true,
};

export function EmailModule({ crew = [], users = [], setSyncStatus }) {
  const t = useT();
  const { user } = useAuth();
  const lang = document.documentElement.lang || "en";

  const canView =
    checkPerm(user, "email.view") || checkPerm(user, "settings.view");
  const canSend =
    checkPerm(user, "email.send") || checkPerm(user, "settings.edit");
  const canBulk =
    checkPerm(user, "email.bulk") || checkPerm(user, "settings.edit");

  /* ═══ Sender Accounts State ═══ */
  const [accounts, setAccounts] = useState(() => listEmailAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    const list = listEmailAccounts();
    const def = list.find((a) => a.isDefault) || list[0];
    return def?.id || "";
  });
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountDraft, setAccountDraft] = useState(EMPTY_ACCOUNT_FORM);
  const [testRecipient, setTestRecipient] = useState("");
  const [testingAccount, setTestingAccount] = useState(false);

  /* ═══ Compose State ═══ */
  const [selectedCrew, setSelectedCrew] = useState("");
  const [customEmailsInput, setCustomEmailsInput] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("roster");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [sendHistory, setSendHistory] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCrewList, setSelectedCrewList] = useState([]);

  /* ═══ Auto Settings State ═══ */
  const [autoFlightEmails, setAutoFlightEmails] = useState(true);
  const [autoExpiryAlerts, setAutoExpiryAlerts] = useState(true);
  const [savingAuto, setSavingAuto] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    const syncAccounts = () => {
      const next = listEmailAccounts();
      setAccounts(next);
      setSelectedAccountId((prev) => {
        if (prev && next.some((a) => a.id === prev)) return prev;
        const def = next.find((a) => a.isDefault) || next[0];
        return def?.id || "";
      });
    };
    window.addEventListener("aeroops:email-accounts-updated", syncAccounts);
    return () =>
      window.removeEventListener("aeroops:email-accounts-updated", syncAccounts);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      try {
        const s = await settingsAPI.get();
        if (!mounted) return;
        if (s) {
          setAutoFlightEmails(s.autoFlightEmails !== false);
          setAutoExpiryAlerts(s.autoExpiryAlerts !== false);
        }
      } catch (e) {
        console.warn("Failed to load auto settings:", e.message);
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  const saveAutoSettings = async () => {
    setSavingAuto(true);
    try {
      await settingsAPI.save({ autoFlightEmails, autoExpiryAlerts });
      showToast("✅ " + (t.settingsSaved || "تم حفظ الإعدادات"));
    } catch (e) {
      showToast("❌ " + (t.failedSave || "فشل الحفظ") + ": " + e.message);
    } finally {
      setSavingAuto(false);
    }
  };

  /* ═══ Account Management Handlers ═══ */
  const openAddAccount = () => {
    setAccountDraft({
      ...EMPTY_ACCOUNT_FORM,
      isDefault: accounts.length === 0,
    });
    setTestRecipient("");
    setShowAccountForm(true);
  };

  const openEditAccount = (acc) => {
    setAccountDraft({ ...EMPTY_ACCOUNT_FORM, ...acc });
    setTestRecipient(acc.email || "");
    setShowAccountForm(true);
  };

  const handlePresetChange = (presetId) => {
    const preset = SMTP_PRESETS.find((p) => p.id === presetId);
    setAccountDraft((prev) => ({
      ...prev,
      preset: presetId,
      smtpHost: preset ? preset.smtpHost || prev.smtpHost : prev.smtpHost,
      smtpPort: preset ? preset.smtpPort : prev.smtpPort,
    }));
  };

  const handleSaveAccount = async () => {
    if (!accountDraft.email.trim()) {
      return showToast("⚠️ يرجى إدخال عنوان البريد الإلكتروني", "warning");
    }
    if (accountDraft.mode === "smtp") {
      if (!accountDraft.smtpHost.trim() || !accountDraft.smtpPass.trim()) {
        return showToast(
          "⚠️ لإرسال البريد مباشرة عبر SMTP يرجى إدخال خادم البريد وكلمة مرور التطبيق (App Password)",
          "warning"
        );
      }
    }
    try {
      const saved = upsertEmailAccount({
        ...accountDraft,
        smtpUser: accountDraft.smtpUser?.trim() || accountDraft.email.trim(),
      });
      setAccounts(listEmailAccounts());
      setSelectedAccountId(saved.id);
      setShowAccountForm(false);
      if (saved.isDefault) {
        settingsAPI.save({ email: saved.email }).catch(() => {});
      }
      showToast(`✅ تم حفظ حساب البريد المرسل (${saved.email}) بنجاح`, "success");
    } catch (e) {
      showToast("❌ " + e.message, "error");
    }
  };

  const handleTestAccount = async (targetAcc = accountDraft, customTestTo = testRecipient) => {
    if (!targetAcc.email?.trim()) {
      return showToast("⚠️ أدخل عنوان البريد أولاً", "warning");
    }
    setTestingAccount(true);
    try {
      const res = await testSenderEmailAccount(
        {
          ...targetAcc,
          smtpUser: targetAcc.smtpUser?.trim() || targetAcc.email.trim(),
        },
        customTestTo?.trim() || targetAcc.email.trim()
      );
      showToast("✅ " + (res.message || "تم التحقق من إعدادات البريد بنجاح!"), "success");
    } catch (e) {
      showToast("❌ فشل الاختبار: " + e.message, "error");
    } finally {
      setTestingAccount(false);
    }
  };

  const handleDeleteAccount = async (acc) => {
    if (!(await confirmAction(`حذف حساب البريد المرسل (${acc.email})؟`))) return;
    const next = removeEmailAccount(acc.id);
    setAccounts(next);
    showToast("✅ تم حذف حساب البريد", "success");
  };

  const handleMakeDefault = (acc) => {
    const next = setDefaultEmailAccount(acc.id);
    setAccounts(next);
    setSelectedAccountId(acc.id);
    settingsAPI.save({ email: acc.email }).catch(() => {});
    showToast(`✅ تم تعيين ${acc.email} كبريد افتراضي للمنظومة`, "success");
  };

  /* ═══ Templates & Crew Filter ═══ */
  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return TEMPLATES;
    return TEMPLATES.filter((tmp) => tmp.category === categoryFilter);
  }, [categoryFilter]);

  const filteredCrew = useMemo(() => {
    return crew.filter((c) => {
      if (!c.email) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [crew, search]);

  const applyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmp = TEMPLATES.find((x) => x.id === templateId);
    if (tmp) {
      setMessage(tmp.text);
      setSubject(lang === "ar" ? tmp.subject_ar : tmp.subject_en);
    }
  };

  const parsedCustomEmails = useMemo(() => {
    return customEmailsInput
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));
  }, [customEmailsInput]);

  const sendMessage = async () => {
    if (!canSend) {
      setResult({ ok: false, message: "ليس لديك صلاحية إرسال الإيميلات" });
      return;
    }
    if (bulkMode && !canBulk) {
      setResult({ ok: false, message: "ليس لديك صلاحية الإرسال الجماعي" });
      return;
    }
    if (!subject.trim()) {
      setResult({ ok: false, message: "الرجاء إدخال موضوع الرسالة" });
      return;
    }
    if (!message.trim()) {
      setResult({ ok: false, message: "الرسالة فارغة" });
      return;
    }

    const crewRecipientIds = bulkMode
      ? selectedCrewList
      : selectedCrew
      ? [selectedCrew]
      : [];

    if (crewRecipientIds.length === 0 && parsedCustomEmails.length === 0) {
      setResult({
        ok: false,
        message: "اختر مستلماً من الطاقم أو أدخل بريداً إلكترونياً في خانة المستلم المباشر",
      });
      return;
    }

    setSending(true);
    setResult(null);

    const results = [];
    const activeSender = accounts.find((a) => a.id === selectedAccountId) || null;

    // 1. Send to selected crew members
    for (const crewId of crewRecipientIds) {
      const member = crew.find((c) => c.id === crewId);
      if (!member?.email) {
        results.push({ crewId, ok: false, error: "No email" });
        continue;
      }
      const finalMessage = message.replace(/{name}/g, member.fullName);

      try {
        const res = await sendEmail({
          to: member.email,
          subject: subject,
          body: finalMessage,
          accountId: selectedAccountId,
        });
        if (!res || res.ok === false)
          throw new Error(res?.error || "Send failed");
        results.push({
          crewId,
          ok: true,
          name: `${member.fullName} (${member.email})`,
        });
      } catch (e) {
        results.push({
          crewId,
          ok: false,
          error: e.message,
          name: member.fullName,
        });
      }
    }

    // 2. Send to any custom external email addresses
    for (const emailAddr of parsedCustomEmails) {
      const fallbackName = emailAddr.split("@")[0];
      const finalMessage = message.replace(/{name}/g, fallbackName);
      try {
        const res = await sendEmail({
          to: emailAddr,
          subject: subject,
          body: finalMessage,
          accountId: selectedAccountId,
        });
        if (!res || res.ok === false)
          throw new Error(res?.error || "Send failed");
        results.push({ ok: true, name: emailAddr });
      } catch (e) {
        results.push({ ok: false, error: e.message, name: emailAddr });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    setResult({
      ok: failCount === 0,
      message: `✅ ${t.sent || "تم الإرسال"}: ${successCount} · ❌ ${
        t.failed || "فشل"
      }: ${failCount}${activeSender ? ` (عبر ${activeSender.email})` : ""}`,
      details: results,
    });

    setSendHistory((prev) => [
      {
        id: `email_${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: activeSender?.email || "System Relay",
        recipients: results.map((r) => r.name || r.crewId),
        subject: subject.substring(0, 100),
        message: message.substring(0, 100),
        success: successCount,
        failed: failCount,
      },
      ...prev.slice(0, 49),
    ]);

    setSending(false);
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Lock className="w-12 h-12 mb-2" />
        <p>ليس لديك صلاحية الوصول إلى البريد الإلكتروني</p>
      </div>
    );
  }

  const activePresetInfo = SMTP_PRESETS.find(
    (p) => p.id === accountDraft.preset
  );

  return (
    <div className="space-y-4">
      {/* ═══ Header ═══ */}
      <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-xl p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-sky-600 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {t.emailTitle || "إدارة وإرسال البريد الإلكتروني"}
              </h2>
              <div className="text-xs text-slate-300">
                إضافة حسابات البريد المرسل (SMTP / Relay) والبعث من خلالها للطاقم والجهات الخارجية
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canSend && (
              <button
                type="button"
                onClick={openAddAccount}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white whitespace-nowrap shrink-0 transition"
              >
                <Plus className="w-4 h-4" />
                إضافة إيميل مرسل
              </button>
            )}
            {canBulk && (
              <button
                type="button"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  setSelectedCrewList([]);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
                  bulkMode
                    ? "bg-white text-slate-900"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                {bulkMode ? t.bulkModeOn || "إرسال جماعي مفعل" : t.bulkMode || "إرسال جماعي"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
       * SENDER EMAIL ACCOUNTS MANAGER (حسابات البريد المرسل)
       * ═══════════════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Server className="w-4 h-4 text-sky-600" />
              حسابات البريد المرسل (Sender Email Accounts)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              أضف بريدك الرسمي أو حساب Gmail / Microsoft 365 للإرسال المباشر من خلاله في الرسائل والرحلات والتصاريح والنماذج
            </p>
          </div>
          {canSend && !showAccountForm && (
            <button
              type="button"
              onClick={openAddAccount}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> إضافة إيميل جديد
            </button>
          )}
        </div>

        {/* Account Editor Form */}
        {showAccountForm && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {accountDraft.id ? "تعديل حساب البريد المرسل" : "إضافة حساب بريد مرسل جديد"}
              </span>
              <button
                type="button"
                onClick={() => setShowAccountForm(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switch */}
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountDraft((d) => ({ ...d, mode: "smtp" }))}
                className={`p-2.5 rounded-lg border text-start transition ${
                  accountDraft.mode === "smtp"
                    ? "bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-900 dark:text-sky-100"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-bold">إرسال مباشر عبر البريد (SMTP Direct)</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  يبعث الرسائل فعلياً من عنوان إيميلك نفسه (Gmail / Office 365 / بريد الشركة)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAccountDraft((d) => ({ ...d, mode: "relay" }))}
                className={`p-2.5 rounded-lg border text-start transition ${
                  accountDraft.mode === "relay"
                    ? "bg-sky-50 dark:bg-sky-950/60 border-sky-500 text-sky-900 dark:text-sky-100"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <div className="text-xs font-bold">إرسال عبر وسيط المنظومة (Reply-To)</div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  لا يتطلب كلمة مرور SMTP — يرسل عبر خادم المنظومة ويجعل الرد يصل لبريدك
                </div>
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  عنوان البريد الإلكتروني المرسل *
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={accountDraft.email}
                  onChange={(e) =>
                    setAccountDraft((d) => ({ ...d, email: e.target.value }))
                  }
                  placeholder="ops@airline.com"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم المرسل الظاهر (Sender Name)
                </label>
                <input
                  value={accountDraft.name}
                  onChange={(e) =>
                    setAccountDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="Flight Operations / إدارة العمليات"
                  className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>
            </div>

            {accountDraft.mode === "smtp" && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مزود البريد السريع (Provider)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {SMTP_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePresetChange(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                          accountDraft.preset === p.id
                            ? "bg-sky-600 text-white border-sky-600"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {activePresetInfo?.hint && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {activePresetInfo.hint}
                    </div>
                  )}
                </div>

                <div className="grid sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      خادم البريد الصادر (SMTP Host) *
                    </label>
                    <input
                      dir="ltr"
                      value={accountDraft.smtpHost}
                      onChange={(e) =>
                        setAccountDraft((d) => ({ ...d, smtpHost: e.target.value }))
                      }
                      placeholder="smtp.gmail.com"
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      المنفذ (Port) *
                    </label>
                    <input
                      type="number"
                      dir="ltr"
                      value={accountDraft.smtpPort}
                      onChange={(e) =>
                        setAccountDraft((d) => ({
                          ...d,
                          smtpPort: Number(e.target.value) || 465,
                        }))
                      }
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono tabular-nums bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      اسم مستخدم SMTP
                    </label>
                    <input
                      dir="ltr"
                      value={accountDraft.smtpUser}
                      onChange={(e) =>
                        setAccountDraft((d) => ({ ...d, smtpUser: e.target.value }))
                      }
                      placeholder={accountDraft.email || "اختياري"}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      كلمة مرور التطبيق / البريد (SMTP / App Password) *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={accountDraft.smtpPass}
                      onChange={(e) =>
                        setAccountDraft((d) => ({ ...d, smtpPass: e.target.value }))
                      }
                      placeholder="••••••••••••••••"
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      إرسال رسالة تجريبية إلى (اختياري)
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder={accountDraft.email || "test@domain.com"}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={accountDraft.isDefault}
                onChange={(e) =>
                  setAccountDraft((d) => ({ ...d, isDefault: e.target.checked }))
                }
                className="w-4 h-4 accent-sky-600"
              />
              اعتماد هذا الحساب كبريد افتراضي للإرسال من المنظومة
            </label>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleTestAccount(accountDraft, testRecipient)}
                disabled={testingAccount}
                className="px-3.5 py-2 rounded-lg border border-sky-500 text-sky-700 dark:text-sky-300 text-xs font-bold hover:bg-sky-50 dark:hover:bg-sky-950/50 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                {testingAccount ? "جاري الاختبار..." : "اختبار الاتصال والإرسال"}
              </button>
              <button
                type="button"
                onClick={handleSaveAccount}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Save className="w-4 h-4" />
                حفظ حساب البريد
              </button>
            </div>
          </div>
        )}

        {/* Saved Accounts List */}
        {accounts.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div>
              لم تقم بإضافة بريد مرسل خاص بعد — يتم الإرسال حالياً عبر وسيط المنظومة الافتراضي. اضغط{" "}
              <b>"إضافة إيميل جديد"</b> لإضافة بريدك والبعث من خلاله.
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2.5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  acc.isDefault
                    ? "bg-sky-50/60 dark:bg-sky-950/30 border-sky-400 dark:border-sky-700"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {acc.email}
                    </span>
                    {acc.isDefault && (
                      <span className="text-[11px] font-bold text-sky-700 dark:text-sky-300 whitespace-nowrap">
                        · الافتراضي
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{acc.name || "Flight Operations"}</span>
                    <span>·</span>
                    <span className="font-mono">
                      {acc.mode === "smtp"
                        ? `SMTP (${acc.smtpHost}:${acc.smtpPort})`
                        : "System Relay"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!acc.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleMakeDefault(acc)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500"
                      title="تعيين كبريد افتراضي"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTestAccount(acc, acc.email)}
                    disabled={testingAccount}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/25 whitespace-nowrap"
                    title="إرسال رسالة اختبار"
                  >
                    اختبار
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditAccount(acc)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                    title="تعديل"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600"
                    title="حذف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════
       * AUTO SETTINGS
       * ═══════════════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <Settings className="w-4 h-4 text-sky-600" />
          {t.autoSettings || "الإعدادات التلقائية"}
        </h3>

        {loadingSettings ? (
          <div className="text-center text-xs text-slate-400 py-4">
            {t.loading || "جاري التحميل…"}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3 items-center">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">
                  {t.autoFlightEmails || "إيميل الرحلة التلقائي"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {t.autoFlightEmailsHint || "للطاقم عند إنشاء/تعديل رحلة"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoFlightEmails(!autoFlightEmails)}
                className={`relative w-12 h-7 rounded-full transition shrink-0 ${
                  autoFlightEmails
                    ? "bg-sky-600"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
                aria-label="toggle auto flight emails"
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    autoFlightEmails ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="font-bold text-xs text-slate-800 dark:text-slate-100">
                  {t.autoExpiryAlerts || "تنبيهات الوثائق التلقائية"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {t.autoExpiryAlertsHint || "عند قرب انتهاء وثائق الطاقم"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoExpiryAlerts(!autoExpiryAlerts)}
                className={`relative w-12 h-7 rounded-full transition shrink-0 ${
                  autoExpiryAlerts
                    ? "bg-amber-600"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
                aria-label="toggle auto expiry alerts"
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    autoExpiryAlerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={saveAutoSettings}
              disabled={savingAuto}
              className="h-full px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="w-4 h-4" />
              {savingAuto
                ? "…"
                : t.saveAutoSettings || "حفظ الإعدادات التلقائية"}
            </button>
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ═══ LEFT: Compose ═══ */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Send className="w-4 h-4 text-sky-600" />{" "}
            {t.composeEmail || "إرسال بريد إلكتروني"}
          </h3>

          {/* Send From Account Selector */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              الإرسال من حساب (Send From)
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
            >
              {accounts.length === 0 ? (
                <option value="">وسيط المنظومة الافتراضي (System Relay)</option>
              ) : (
                accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name ? `${acc.name} <${acc.email}>` : acc.email}
                    {acc.isDefault ? " (الافتراضي)" : ""} —{" "}
                    {acc.mode === "smtp" ? "SMTP" : "Relay"}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Direct / External Email Recipient */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              إرسال إلى بريد مباشر / خارجي (اختياري — افصل بفاصلة لعدة إيميلات)
            </label>
            <input
              type="text"
              dir="ltr"
              value={customEmailsInput}
              onChange={(e) => setCustomEmailsInput(e.target.value)}
              placeholder="caa@authority.gov, handling@airport.com"
              className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Crew Recipient */}
          {!bulkMode ? (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t.recipient || "أو اختر عضو طاقم"}
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search || "بحث في الطاقم..."}
                className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              />
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                size={4}
                className="w-full mt-1 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              >
                <option value="">— بدون اختيار من الطاقم —</option>
                {filteredCrew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.email}
                  </option>
                ))}
              </select>
              {selectedCrew && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.selected || "المحدد"}:{" "}
                  {crew.find((c) => c.id === selectedCrew)?.fullName}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t.recipients || "أعضاء الطاقم"} — {selectedCrewList.length}{" "}
                {t.selected || "محدد"}
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search || "بحث..."}
                className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              />
              <div className="mt-1 border border-slate-300 dark:border-slate-600 rounded-lg max-h-[150px] overflow-auto p-2 bg-white dark:bg-slate-900">
                <label className="flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={
                      filteredCrew.length > 0 &&
                      selectedCrewList.length === filteredCrew.length
                    }
                    onChange={(e) =>
                      setSelectedCrewList(
                        e.target.checked ? filteredCrew.map((c) => c.id) : []
                      )
                    }
                    className="w-3.5 h-3.5 accent-sky-600"
                  />
                  <b className="text-slate-700 dark:text-slate-300">
                    {t.selectAll || "تحديد الكل"} ({filteredCrew.length})
                  </b>
                </label>
                {filteredCrew.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 py-1 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCrewList.includes(c.id)}
                      onChange={(e) =>
                        setSelectedCrewList(
                          e.target.checked
                            ? [...selectedCrewList, c.id]
                            : selectedCrewList.filter((x) => x !== c.id)
                        )
                      }
                      className="w-3.5 h-3.5 accent-sky-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      {c.fullName} — {c.email}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t.subject || "الموضوع"}
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.subjectPlaceholder || "موضوع الرسالة..."}
              className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Templates */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t.template || "قالب جاهز"}
            </label>
            <div className="flex gap-1 mt-1 flex-wrap">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-2.5 py-1 rounded text-xs font-bold ${
                  categoryFilter === "all"
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t.all || "الكل"}
              </button>
              {["Operations", "Compliance", "HR", "Custom"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    categoryFilter === cat
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {filteredTemplates.map((tmp) => (
                <button
                  key={tmp.id}
                  type="button"
                  onClick={() => applyTemplate(tmp.id)}
                  className={`p-2 rounded-lg border text-xs font-bold text-start ${
                    selectedTemplate === tmp.id
                      ? "bg-sky-50 dark:bg-sky-950 border-sky-500 text-sky-900 dark:text-sky-200"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="truncate">
                    {lang === "ar" ? tmp.label_ar : tmp.label_en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t.message || "نص الرسالة"} — يمكنك استخدام {"{name}"} لاسم المستلم
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder={t.messagePlaceholder || "اكتب نص الرسالة هنا..."}
              className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 text-end">
              {message.length} {t.characters || "حرف"}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={sendMessage}
              disabled={sending || !message.trim() || !canSend}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold disabled:opacity-50 whitespace-nowrap"
              title={canSend ? "" : "ليس لديك صلاحية الإرسال"}
            >
              {sending ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />{" "}
                  {t.sending || "جاري الإرسال..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> {t.send || "إرسال الآن"}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setMessage("");
                setSubject("");
                setCustomEmailsInput("");
                setResult(null);
              }}
              className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold whitespace-nowrap"
            >
              {t.clear || "مسح"}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                result.ok
                  ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {result.ok ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {result.message}
              </div>
              {result.details && (
                <div className="mt-2 max-h-32 overflow-auto">
                  {result.details.map((d, i) => (
                    <div key={i} className="text-[11px] py-0.5">
                      {d.ok ? "✓" : "✕"} {d.name}{" "}
                      {d.error ? `— ${d.error}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: History & Guide ═══ */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-100">
              <History className="w-4 h-4 text-slate-500" />{" "}
              {t.recentSends || "سجل الإرسال الأخير"} ({sendHistory.length})
            </h3>
            {sendHistory.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-6">
                {t.noMessagesSent || "لم يتم إرسال رسائل في هذه الجلسة بعد"}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto">
                {sendHistory.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono tabular-nums">
                      <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                      <span className="font-bold">
                        {h.success > 0 && (
                          <span className="text-emerald-600">
                            ✓ {h.success}
                          </span>
                        )}
                        {h.failed > 0 && (
                          <span className="text-rose-600 ms-2">
                            ✕ {h.failed}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 truncate font-semibold">
                      {h.subject}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate font-mono">
                      From: {h.from} → {h.recipients.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
              <UserIcon className="w-4 h-4 text-sky-600" />{" "}
              إرشادات ربط البريد المرسل
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>
                في وضع <b>SMTP المباشر</b> تخرج جميع الرسائل (إشعارات الطاقم، التصاريح، والنماذج التشغيلية) مباشرة من عنوان بريدك المضاف.
              </li>
              <li>
                لحسابات Gmail و Google Workspace استخدم كلمة مرور التطبيقات المكونة من 16 حرفاً (App Password).
              </li>
              <li>
                يمكنك إضافة عدة حسابات بريد (مثل بريد العمليات وبريد التصاريح) واختيار الحساب المناسب عند كل إرسال.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailModule;
