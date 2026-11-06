/* ═══════════════════════════════════════════════════════════
 * WHATSAPP MODULE — Twilio Integration + Permissions
 * v1.1 — Added whatsapp.view, whatsapp.send, whatsapp.bulk
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from "react";
import {
  MessageCircle,
  Send,
  Users,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Zap,
  Clock,
  History,
  Lock,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { can as checkPerm } from "../config/permissions";
import { API_URL } from "../api";

/* ⭐ Templates */
const TEMPLATES = [
  {
    id: "roster",
    icon: "📅",
    label_en: "Roster Notification",
    label_ar: "إشعار الجدول",
    category: "Operations",
    text: "عزيزي {name},\nتم نشر جدولك الجديد. الرجاء مراجعة Roster في المنظومة.\n\nOperations Team",
  },
  {
    id: "flight_change",
    icon: "✈️",
    label_en: "Flight Change",
    label_ar: "تغيير رحلة",
    category: "Operations",
    text: "عزيزي {name},\nتم تغيير تفاصيل رحلتك. الرجاء مراجعة الجدول فوراً.\n\nOperations Team",
  },
  {
    id: "standby_alert",
    icon: "⏰",
    label_en: "Standby Alert",
    label_ar: "تنبيه احتياطي",
    category: "Operations",
    text: "عزيزي {name},\nأنت في Standby. الرجاء البقاء متاحاً.\n\nOperations Team",
  },
  {
    id: "reminder",
    icon: "🔔",
    label_en: "Duty Reminder",
    label_ar: "تذكير واجب",
    category: "Operations",
    text: "عزيزي {name},\nتذكير: لديك رحلة غداً. الرجاء الحضور قبل STD بـ 60 دقيقة.\n\nOperations Team",
  },
  {
    id: "medical",
    icon: "🩺",
    label_en: "Medical Expiry",
    label_ar: "انتهاء طبي",
    category: "Compliance",
    text: "عزيزي {name},\nشهادتك الطبية على وشك الانتهاء. الرجاء التجديد قبل الموعد.\n\nOperations Team",
  },
  {
    id: "training",
    icon: "🎓",
    label_en: "Training Due",
    label_ar: "تدريب مستحق",
    category: "Compliance",
    text: "عزيزي {name},\nلديك تدريب مستحق. الرجاء مراجعة المنظومة.\n\nOperations Team",
  },
  {
    id: "leave_approved",
    icon: "✅",
    label_en: "Leave Approved",
    label_ar: "موافقة إجازة",
    category: "HR",
    text: "عزيزي {name},\nتمت الموافقة على طلب إجازتك. نتمنى لك وقتاً سعيداً!\n\nOperations Team",
  },
  {
    id: "custom",
    icon: "✍️",
    label_en: "Custom Message",
    label_ar: "رسالة مخصصة",
    category: "Custom",
    text: "",
  },
];

/* ⭐ Bot Commands */
const COMMANDS = [
  { cmd: "STATUS", desc_en: "Today status", desc_ar: "حالة اليوم", icon: "📊" },
  {
    cmd: "ROSTER",
    desc_en: "Weekly roster",
    desc_ar: "جدول الأسبوع",
    icon: "📅",
  },
  {
    cmd: "STANDBY",
    desc_en: "Next standby",
    desc_ar: "الاحتياطي القادم",
    icon: "⏰",
  },
  {
    cmd: "HELP",
    desc_en: "Command list",
    desc_ar: "قائمة الأوامر",
    icon: "❓",
  },
];

export function WhatsAppModule({ crew = [], users = [], setSyncStatus }) {
  const t = useT();
  const { user } = useAuth();
  const lang = document.documentElement.lang || "en";

  // ⭐ الصلاحيات
  const canView = checkPerm(user, "whatsapp.view");
  const canSend = checkPerm(user, "whatsapp.send");
  const canBulk = checkPerm(user, "whatsapp.bulk");

  const [selectedCrew, setSelectedCrew] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("roster");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [sendHistory, setSendHistory] = useState([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedCrewList, setSelectedCrewList] = useState([]);

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === "all") return TEMPLATES;
    return TEMPLATES.filter((tmp) => tmp.category === categoryFilter);
  }, [categoryFilter]);

  const filteredCrew = useMemo(() => {
    return crew.filter((c) => {
      if (!c.phone) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [crew, search]);

  const applyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmp = TEMPLATES.find((x) => x.id === templateId);
    if (tmp) setMessage(tmp.text);
  };

  const sendMessage = async () => {
    if (!canSend) {
      setResult({ ok: false, message: "ليس لديك صلاحية إرسال رسائل واتساب" });
      return;
    }
    if (bulkMode && !canBulk) {
      setResult({ ok: false, message: "ليس لديك صلاحية الإرسال الجماعي" });
      return;
    }
    if (!message.trim()) {
      setResult({ ok: false, message: t.messageEmpty || "الرسالة فارغة" });
      return;
    }
    if (!bulkMode && !selectedCrew) {
      setResult({ ok: false, message: t.selectCrewFirst || "اختر عضواً" });
      return;
    }
    if (bulkMode && selectedCrewList.length === 0) {
      setResult({ ok: false, message: t.selectRecipients || "اختر مستلمين" });
      return;
    }

    setSending(true);
    setResult(null);

    const recipients = bulkMode ? selectedCrewList : [selectedCrew];
    const results = [];

    for (const crewId of recipients) {
      const member = crew.find((c) => c.id === crewId);
      if (!member?.phone) {
        results.push({ crewId, ok: false, error: "No phone" });
        continue;
      }
      const finalMessage = message.replace(/{name}/g, member.fullName);

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          body:
            "payload=" +
            encodeURIComponent(
              JSON.stringify({
                action: "sendWhatsApp",
                to: member.phone,
                message: finalMessage,
              })
            ),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Send failed");
        results.push({ crewId, ok: true, name: member.fullName });
      } catch (e) {
        results.push({
          crewId,
          ok: false,
          error: e.message,
          name: member.fullName,
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    setResult({
      ok: failCount === 0,
      message: `✅ ${t.sent}: ${successCount} · ❌ ${t.failed}: ${failCount}`,
      details: results,
    });

    setSendHistory((prev) => [
      {
        id: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        recipients: results.map((r) => r.name || r.crewId),
        message: message.substring(0, 100),
        success: successCount,
        failed: failCount,
      },
      ...prev.slice(0, 49),
    ]);

    setSending(false);
  };

  const getWhatsAppWebUrl = (phone, text) => {
    const cleanPhone = String(phone || "").replace(/[^\d]/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text || "")}`;
  };

  // ⭐ منع العرض إذا لم تكن هناك صلاحية view
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Lock className="w-12 h-12 mb-2" />
        <p>ليس لديك صلاحية الوصول إلى واتساب</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ═══ Header ═══ */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-xl p-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t.whatsappTitle}</h2>
              <div className="text-xs text-green-100">
                {t.whatsappNotifications}
              </div>
            </div>
          </div>
          {canBulk && (
            <button
              onClick={() => {
                setBulkMode(!bulkMode);
                setSelectedCrewList([]);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold ${
                bulkMode
                  ? "bg-white text-green-700"
                  : "bg-white/20 hover:bg-white/30"
              }`}
            >
              <Users className="w-4 h-4" />
              {bulkMode ? t.bulkModeOn : t.bulkMode}
            </button>
          )}
        </div>
      </div>

      {/* ═══ Setup Warning ═══ */}
      <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-200">
          <b>⚠️ {t.whatsappSetup}:</b> {t.whatsappSetupInfo}
          <br />
          <b>Sandbox:</b> {t.sandboxHint}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* ═══ LEFT: Compose ═══ */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Send className="w-4 h-4 text-green-600" /> {t.composeMessage}
          </h3>

          {/* Recipient */}
          {!bulkMode ? (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t.recipient}
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
                className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              />
              <select
                value={selectedCrew}
                onChange={(e) => setSelectedCrew(e.target.value)}
                size="5"
                className="w-full mt-1 px-2 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
              >
                {filteredCrew.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.phone}
                  </option>
                ))}
              </select>
              {selectedCrew && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.selected}:{" "}
                  {crew.find((c) => c.id === selectedCrew)?.fullName}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t.recipients} — {selectedCrewList.length} {t.selected}
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
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
                    className="w-3.5 h-3.5 accent-green-600"
                  />
                  <b className="text-slate-700 dark:text-slate-300">
                    {t.selectAll} ({filteredCrew.length})
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
                      className="w-3.5 h-3.5 accent-green-600"
                    />
                    <span className="text-slate-700 dark:text-slate-300">
                      {c.fullName} — {c.phone}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t.template}
            </label>
            <div className="flex gap-1 mt-1 flex-wrap">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  categoryFilter === "all"
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {t.all}
              </button>
              {["Operations", "Compliance", "HR", "Custom"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-1 rounded text-[10px] font-bold ${
                    categoryFilter === cat
                      ? "bg-green-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {filteredTemplates.map((tmp) => (
                <button
                  key={tmp.id}
                  onClick={() => applyTemplate(tmp.id)}
                  className={`p-2 rounded border text-[10px] font-bold text-start ${
                    selectedTemplate === tmp.id
                      ? "bg-green-100 dark:bg-green-950 border-green-400 text-green-800 dark:text-green-200"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="text-lg leading-none">{tmp.icon}</div>
                  <div className="truncate mt-1">
                    {lang === "ar" ? tmp.label_ar : tmp.label_en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t.message} — use {"{name}"} for crew name
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="5"
              placeholder={t.messagePlaceholder}
              className="w-full mt-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="text-[10px] text-slate-500 dark:text-slate-400 text-end">
              {message.length} {t.characters}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={sendMessage}
              disabled={sending || !message.trim() || !canSend}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-50"
              title={canSend ? "" : "ليس لديك صلاحية الإرسال"}
            >
              {sending ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" /> {t.sending}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> {t.send}{" "}
                  {bulkMode ? `(${selectedCrewList.length})` : ""}
                </>
              )}
            </button>
            <button
              onClick={() => {
                setMessage("");
                setResult(null);
              }}
              className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold"
            >
              {t.clear}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg border-2 text-xs ${
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
                    <div key={i} className="text-[10px] py-0.5">
                      {d.ok ? "✅" : "❌"} {d.name}{" "}
                      {d.error ? `— ${d.error}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Info ═══ */}
        <div className="space-y-3">
          {/* Bot Commands */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-100">
              <Zap className="w-4 h-4 text-amber-500" /> {t.botCommands}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {t.botCommandsDesc}
            </p>
            <div className="space-y-1">
              {COMMANDS.map((cmd) => (
                <div
                  key={cmd.cmd}
                  className="flex items-center gap-2 p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs"
                >
                  <span className="text-lg">{cmd.icon}</span>
                  <code className="font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {cmd.cmd}
                  </code>
                  <span className="text-slate-600 dark:text-slate-400 flex-1">
                    {lang === "ar" ? cmd.desc_ar : cmd.desc_en}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-100">
              <History className="w-4 h-4 text-slate-500" /> {t.recentSends} (
              {sendHistory.length})
            </h3>
            {sendHistory.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-4">
                {t.noMessagesSent}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {sendHistory.map((h) => (
                  <div
                    key={h.id}
                    className="p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                      <span>{new Date(h.timestamp).toLocaleString()}</span>
                      <span className="font-bold">
                        {h.success > 0 && (
                          <span className="text-emerald-600">
                            ✅ {h.success}
                          </span>
                        )}
                        {h.failed > 0 && (
                          <span className="text-rose-600 ms-2">
                            ❌ {h.failed}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-slate-700 dark:text-slate-300 truncate">
                      {h.message}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                      → {h.recipients.join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Open */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-bold text-sm flex items-center gap-2 mb-2 text-slate-800 dark:text-slate-100">
              <Smartphone className="w-4 h-4 text-green-600" /> {t.manualOpen}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {t.manualOpenDesc}
            </p>
            {selectedCrew && message && canSend && (() => {
              const member = crew.find((c) => c.id === selectedCrew);
              if (!member?.phone) return null;
              return (
                <a
                  href={getWhatsAppWebUrl(
                    member.phone,
                    message.replace(/{name}/g, member.fullName)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-950 hover:bg-green-200 dark:hover:bg-green-900 text-green-800 dark:text-green-200 text-sm font-bold"
                >
                  <MessageCircle className="w-4 h-4" /> {t.openInWhatsApp}
                </a>
              );
            })()}
            {(!selectedCrew || !message || !canSend) && (
              <div className="text-center text-slate-400 text-xs py-3">
                {!canSend ? "ليس لديك صلاحية" : t.selectCrewFirst}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppModule;
