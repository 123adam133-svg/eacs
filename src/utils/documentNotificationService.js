/* ═══════════════════════════════════════════════════════════
 * DOCUMENT EXPIRY & COMPLIANCE NOTIFICATION SERVICE
 * Generates aviation-branded HTML alerts & sends via configured email accounts
 * ═══════════════════════════════════════════════════════════ */

import { sendThroughEmailAccount, getDefaultEmailAccount } from "./emailAccounts";
import { sendNotification } from "./notificationService";
import { toDisplayImageUrl } from "../api";

/**
 * Calculates days remaining until a given date string.
 * Negative number means expired.
 */
export function getDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return null;
  const exp = new Date(expiryDateStr);
  if (isNaN(exp.getTime())) return null;
  const now = new Date();
  // Strip time part for pure calendar day calculation
  const expUTC = Date.UTC(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = expUTC - nowUTC;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generates rich HTML email template for document expiry alerts
 */
export function buildDocumentExpiryEmailHtml({
  document,
  recipientName,
  recipientRole,
  daysRemaining,
  companyName,
  companyNameAr,
  logoUrl,
  customNotes = "",
}) {
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isUrgent = daysRemaining !== null && daysRemaining <= 30;

  const statusColor = isExpired ? "#e11d48" : isUrgent ? "#d97706" : "#0284c7";
  const statusBg = isExpired ? "#ffe4e6" : isUrgent ? "#fef3c7" : "#e0f2fe";
  const statusTextAr = isExpired
    ? `منتهية الصلاحية منذ ${Math.abs(daysRemaining)} يوم`
    : daysRemaining === 0
    ? "تنتهي اليوم!"
    : `تنتهي خلال ${daysRemaining} يوم`;
  const statusTextEn = isExpired
    ? `Expired ${Math.abs(daysRemaining)} day(s) ago`
    : daysRemaining === 0
    ? "Expires Today!"
    : `Expires in ${daysRemaining} day(s)`;

  const directViewUrl = document.viewUrl || document.fileUrl || "";

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تنبيه صلاحية وثيقة طيران — ${document.title || "وثيقة"}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center;">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 140px; margin-bottom: 12px; object-fit: contain; background: #ffffff; padding: 6px; border-radius: 8px;">`
                  : ""
              }
              <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 800; letter-spacing: 0.5px;">
                ${companyNameAr || "إدارة العمليات الجوية والامتثال"}
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; font-family: monospace;">
                ${companyName || "FLIGHT OPERATIONS & COMPLIANCE SYSTEM"}
              </p>
            </td>
          </tr>

          <!-- Urgency Status Strip -->
          <tr>
            <td style="background-color: ${statusBg}; padding: 14px 24px; border-bottom: 2px solid ${statusColor}; text-align: center;">
              <span style="display: inline-block; font-size: 14px; font-weight: bold; color: ${statusColor};">
                ⚠️ تنبيه صلاحية وثيقة طيران: ${statusTextAr} (${statusTextEn})
              </span>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 15px; line-height: 1.6; margin: 0 0 18px 0; color: #334155;">
                السلام عليكم ورحمة الله،<br>
                السيد/ة <strong>${recipientName || "عضو الطاقم"}</strong> (${recipientRole || "طيران"}),
              </p>
              
              <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #475569;">
                نود إحاطتكم علماً بقرب انتهاء / انتهاء صلاحية الوثيقة الرسمية المسجلة في منظومة الطيران والامتثال، ويرجى المبادرة بالتجديد وفقاً للبيانات التالية:
              </p>

              <!-- Document Details Table -->
              <table role="presentation" width="100%" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">اسم الوثيقة / Document</td>
                  <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${document.title || "—"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">رقم الوثيقة / Doc No</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-family: monospace; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${document.docNo || "—"}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">التصنيف / Category</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${document.categoryLabel || document.category || "—"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">القسم / Department</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${document.departmentName || "—"}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">جهة الإصدار / Authority</td>
                  <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${document.issuingAuthority || "—"}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">تاريخ الانتهاء / Expiry</td>
                  <td style="padding: 10px 14px; font-size: 14px; color: ${statusColor}; font-weight: bold; font-family: monospace; border-bottom: 1px solid #e2e8f0;">
                    ${document.expiryDate || "—"} (${statusTextAr})
                  </td>
                </tr>
              </table>

              ${
                customNotes
                  ? `
                <div style="background-color: #f8fafc; border-right: 4px solid #0284c7; padding: 12px 16px; margin-bottom: 24px; border-radius: 6px;">
                  <strong style="font-size: 13px; color: #0f172a;">ملاحظات إضافية من إدارة العمليات:</strong>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569; line-height: 1.5;">${customNotes}</p>
                </div>
              `
                  : ""
              }

              <!-- Action Instructions -->
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 14px 18px; border-radius: 10px; margin-bottom: 24px;">
                <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #9a3412;">⚡ الإجراء المطلوب / Action Required:</h4>
                <p style="margin: 0; font-size: 12px; color: #c2410c; line-height: 1.5;">
                  يرجى تجديد الوثيقة فوراً ورفع النسخة المحدثة (PDF أو صورة واضحة) إلى مركز المستندات الموحد أو تزويد إدارة العمليات بنسخة التجديد لتفادي تعليق الجداول والرحلات المعتمدة.
                </p>
              </div>

              <!-- Drive Link Button -->
              ${
                directViewUrl
                  ? `
                <div style="text-align: center; margin-top: 20px;">
                  <a href="${directViewUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: bold; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);">
                    📄 فتح الملف في Google Drive
                  </a>
                </div>
              `
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
              هذه الرسالة آلية صادرة من منظومة العمليات الجوية ومطابقة لمعايير الامتثال والجودة في الطيران.<br>
              AeroOps Flight Operations & Crew Compliance System
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends an email alert for an individual document.
 */
export async function sendDocumentExpiryAlert({
  document,
  recipientEmail,
  recipientName = "",
  recipientRole = "",
  departmentHeadEmail = "",
  customMessage = "",
  settings = {},
  senderAccountId = "",
}) {
  const targetEmail = String(recipientEmail || document.personEmail || "").trim();
  if (!targetEmail) {
    throw new Error("لا يوجد بريد إلكتروني مسجل للموظف أو الوثيقة");
  }

  const daysRemaining = getDaysRemaining(document.expiryDate);
  const companyName = settings?.companyName || "Executive Aviation Authority";
  const companyNameAr = settings?.companyNameAr || "الجهاز التنفيذي للطيران";
  const logoUrl = toDisplayImageUrl(settings?.logo);

  const subject = `⚠️ [AeroOps] تنبيه صلاحية وثيقة: ${document.title || "وثيقة طيران"} — ${
    daysRemaining !== null && daysRemaining <= 0
      ? "منتهية الصلاحية"
      : `متبقي ${daysRemaining} يوم`
  }`;

  const html = buildDocumentExpiryEmailHtml({
    document,
    recipientName: recipientName || document.personName || "عضو الطاقم",
    recipientRole: recipientRole || document.personRole || "",
    daysRemaining,
    companyName,
    companyNameAr,
    logoUrl,
    customNotes: customMessage,
  });

  // Prepare recipient list (include department head CC if available)
  const toList = [targetEmail];
  if (
    departmentHeadEmail &&
    departmentHeadEmail.includes("@") &&
    departmentHeadEmail.toLowerCase() !== targetEmail.toLowerCase()
  ) {
    toList.push(departmentHeadEmail.trim());
  }

  const result = await sendThroughEmailAccount({
    to: toList.join(", "),
    subject,
    body: `تنبيه صلاحية وثيقة: ${document.title} - تاريخ الانتهاء: ${document.expiryDate}`,
    html,
    accountId: senderAccountId,
  });

  // Also dispatch in-app notification to user/crew member if applicable
  if (document.personId) {
    try {
      await sendNotification(
        String(document.personId),
        `⚠️ تنبيه وثيقة: تقترب أو انتهت صلاحية "${document.title}". تاريخ الانتهاء: ${document.expiryDate}`,
        {
          type: "GENERAL",
          recipientEmail: targetEmail,
          crewName: document.personName,
        }
      );
    } catch {}
  }

  return result;
}
