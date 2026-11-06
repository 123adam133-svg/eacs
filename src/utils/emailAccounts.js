/* ═══════════════════════════════════════════════════════════
 * SENDER EMAIL ACCOUNTS MANAGER
 * Allows adding multiple sender emails (SMTP Direct or System Relay)
 * and choosing which email account sends flight alerts, permits, & forms.
 * ═══════════════════════════════════════════════════════════ */

import { appConfigAPI } from "../api";

const STORAGE_KEY = "aeroops.email_accounts_v1";

export const SMTP_PRESETS = [
  {
    id: "gmail",
    label: "Gmail / Google Workspace",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    hint: "استخدم App Password المكون من 16 حرفاً من إعدادات حساب Google (الأمان -> التحقق بخطوتين -> كلمات مرور التطبيقات)",
  },
  {
    id: "office365",
    label: "Outlook / Microsoft 365",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    hint: "استخدم بريد الشركة وكلمة المرور أو App Password في حال تفعيل المصادقة الثنائية",
  },
  {
    id: "yahoo",
    label: "Yahoo Mail",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    hint: "استخدم App Password من إعدادات أمان حساب Yahoo",
  },
  {
    id: "custom",
    label: "بريد رسمي خاص (Custom Domain / cPanel)",
    smtpHost: "",
    smtpPort: 465,
    hint: "أدخل عنوان خادم البريد الصادر مثل mail.yourdomain.com والمنفذ 465 (SSL) أو 587 (TLS)",
  },
];

export function listEmailAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function hydrateEmailAccountsFromSheet() {
  try {
    const remote = await appConfigAPI.get("emailAccounts");
    if (Array.isArray(remote) && remote.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      window.dispatchEvent(new CustomEvent("aeroops:email-accounts-updated"));
      return remote;
    }
  } catch {}
  return listEmailAccounts();
}

export function saveEmailAccounts(accounts) {
  const safe = Array.isArray(accounts) ? accounts : [];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    window.dispatchEvent(new CustomEvent("aeroops:email-accounts-updated"));
  } catch (e) {
    console.warn("Failed to persist email accounts:", e);
  }
  appConfigAPI.set("emailAccounts", safe).catch(() => {});
  return safe;
}

export function getDefaultEmailAccount(fallbackEmail = "", fallbackName = "") {
  const list = listEmailAccounts();
  const def = list.find((a) => a.isDefault) || list[0];
  if (def) return def;
  if (fallbackEmail) {
    return {
      id: "settings_default",
      email: fallbackEmail,
      name: fallbackName || "Flight Operations",
      mode: "relay",
      isDefault: true,
    };
  }
  return null;
}

export function getEmailAccountById(accountId) {
  if (!accountId) return getDefaultEmailAccount();
  const list = listEmailAccounts();
  return list.find((a) => a.id === accountId) || getDefaultEmailAccount();
}

export function upsertEmailAccount(account) {
  const list = listEmailAccounts();
  const cleanEmail = String(account.email || "").trim();
  if (!cleanEmail) throw new Error("عنوان البريد الإلكتروني مطلوب");

  const id = account.id || `mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const shouldBeDefault = Boolean(account.isDefault) || list.length === 0;

  const entry = {
    id,
    email: cleanEmail,
    name: String(account.name || "").trim(),
    mode: account.mode === "smtp" ? "smtp" : "relay",
    preset: account.preset || "custom",
    smtpHost: String(account.smtpHost || "").trim(),
    smtpPort: Number(account.smtpPort) || 465,
    smtpUser: String(account.smtpUser || cleanEmail).trim(),
    smtpPass: String(account.smtpPass || ""),
    isDefault: shouldBeDefault,
    updatedAt: new Date().toISOString(),
  };

  let next = list.some((a) => a.id === id)
    ? list.map((a) => (a.id === id ? entry : a))
    : [...list, entry];

  if (shouldBeDefault) {
    next = next.map((a) => ({ ...a, isDefault: a.id === id }));
  }

  saveEmailAccounts(next);
  return entry;
}

export function removeEmailAccount(id) {
  const list = listEmailAccounts().filter((a) => a.id !== id);
  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list[0] = { ...list[0], isDefault: true };
  }
  saveEmailAccounts(list);
  return list;
}

export function setDefaultEmailAccount(id) {
  const list = listEmailAccounts().map((a) => ({
    ...a,
    isDefault: a.id === id,
  }));
  saveEmailAccounts(list);
  return list;
}

export async function testSenderEmailAccount(account, testRecipient = "") {
  const res = await fetch("/api/test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account, testRecipient }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "استجابة غير صالحة من الخادم" }));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "تعذر التحقق من إعدادات البريد");
  }
  return data;
}

export async function sendThroughEmailAccount({
  to,
  subject,
  body,
  html,
  accountId,
  account: explicitAccount,
  attachments,
}) {
  const chosenAccount = explicitAccount || getEmailAccountById(accountId);
  const res = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      subject,
      body,
      html,
      account: chosenAccount,
      attachments,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || "فشل إرسال البريد الإلكتروني");
  }
  return data;
}
