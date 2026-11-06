import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, getVerifiedCloudUser } from '../contexts/FirebaseProvider';
import { API_URL, appConfigAPI } from '../api';
import { handleFirestoreError, OperationType } from './firebaseUtils';

const LOCAL_WA_CONFIG_KEY = 'aeroops.whatsapp.config';
const ALLOWED_PROVIDERS = ['cloud_api', 'apps_script', 'wa_link'];

export const DEFAULT_WHATSAPP_SETTINGS = {
  whatsappPhoneNumber: '',
  phoneNumberId: '',
  whatsappApiKey: '',
  provider: 'apps_script',
  autoNotifyFlights: false,
};

function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Cloud timeout')), ms)
    ),
  ]);
}

function sanitizeWhatsAppConfig(raw = {}) {
  return {
    whatsappPhoneNumber: String(raw.whatsappPhoneNumber || '').trim().slice(0, 32),
    phoneNumberId: String(raw.phoneNumberId || '').trim().slice(0, 64),
    whatsappApiKey: String(raw.whatsappApiKey || '').trim().slice(0, 512),
    provider: ALLOWED_PROVIDERS.includes(raw.provider)
      ? raw.provider
      : 'apps_script',
    autoNotifyFlights: Boolean(raw.autoNotifyFlights),
  };
}

function readLocalWhatsAppConfig() {
  try {
    const raw = localStorage.getItem(LOCAL_WA_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_WHATSAPP_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_WHATSAPP_SETTINGS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULT_WHATSAPP_SETTINGS };
  }
}

function writeLocalWhatsAppConfig(cfg) {
  try {
    localStorage.setItem(
      LOCAL_WA_CONFIG_KEY,
      JSON.stringify(sanitizeWhatsAppConfig(cfg))
    );
  } catch {}
}

const BOOTSTRAPPED_ADMIN_EMAIL = '123adam133@gmail.com';

async function isCurrentUserCloudAdmin(user) {
  if (!user || !user.emailVerified) return false;
  if (String(user.email || '').toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
    return true;
  }
  const cleanUid = String(user.uid || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!cleanUid || cleanUid.length > 128) return false;
  try {
    const adminSnap = await withTimeout(getDoc(doc(db, 'admins', cleanUid)), 2500);
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export async function getWhatsAppSettings() {
  const localCfg = readLocalWhatsAppConfig();

  // 1. Primary Cloud Source: Google Sheets ("AppConfig" -> "whatsappSettings")
  try {
    const sheetCfg = await appConfigAPI.get('whatsappSettings');
    if (sheetCfg && typeof sheetCfg === 'object') {
      const merged = sanitizeWhatsAppConfig(sheetCfg);
      writeLocalWhatsAppConfig(merged);
      return { ...merged, cloudSynced: true };
    }
  } catch {
    // Fall back to local / Firestore seamlessly
  }

  // 2. Optional Secondary Source: Firestore (if verified Google admin)
  const currentUser = getVerifiedCloudUser();
  if (!currentUser) {
    return { ...localCfg, cloudSynced: false };
  }

  const canAccessCloudSettings = await isCurrentUserCloudAdmin(currentUser);
  if (!canAccessCloudSettings) {
    return { ...localCfg, cloudSynced: false };
  }

  try {
    const docRef = doc(db, 'settings', 'whatsapp');
    const docSnap = await withTimeout(getDoc(docRef), 2500);
    if (docSnap.exists()) {
      const merged = sanitizeWhatsAppConfig(docSnap.data());
      writeLocalWhatsAppConfig(merged);
      appConfigAPI.set('whatsappSettings', merged).catch(() => {});
      return { ...merged, cloudSynced: true };
    }
    return { ...localCfg, cloudSynced: true };
  } catch (error) {
    if (error?.message !== 'Cloud timeout') {
      try {
        handleFirestoreError(error, OperationType.GET, 'settings/whatsapp');
      } catch {}
    }
    return { ...localCfg, cloudSynced: false };
  }
}

export async function saveWhatsAppSettings(rawSettings) {
  const sanitized = sanitizeWhatsAppConfig(rawSettings);
  writeLocalWhatsAppConfig(sanitized);

  let savedSheet = false;
  try {
    await appConfigAPI.set('whatsappSettings', sanitized);
    savedSheet = true;
  } catch (err) {
    console.warn('Google Sheets WhatsApp settings sync warning:', err);
  }

  // Non-blocking Firestore mirror when verified admin is connected
  const currentUser = getVerifiedCloudUser();
  if (currentUser) {
    isCurrentUserCloudAdmin(currentUser)
      .then(async (canAccess) => {
        if (!canAccess) return;
        const docRef = doc(db, 'settings', 'whatsapp');
        const existingSnap = await withTimeout(getDoc(docRef), 2500);
        if (existingSnap.exists()) {
          await withTimeout(
            updateDoc(docRef, {
              ...sanitized,
              updatedBy: String(currentUser.uid).slice(0, 128),
              updatedAt: serverTimestamp(),
            }),
            2500
          );
        } else {
          await withTimeout(
            setDoc(docRef, {
              ...sanitized,
              updatedBy: String(currentUser.uid).slice(0, 128),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
            2500
          );
        }
      })
      .catch(() => {});
  }

  return { savedCloud: savedSheet, settings: sanitized };
}

function safeUtcStamp(iso) {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function formatFlightWhatsAppTemplate(
  flight,
  crewMember,
  eventType = 'ASSIGNED'
) {
  const name = crewMember?.fullName || 'Crew Member';
  const flightNo = flight?.flightNo || 'N/A';
  const route =
    flight?.dep && flight?.arr
      ? `${flight.dep} → ${flight.arr}`
      : flight?.route || 'N/A';
  const stdStr = safeUtcStamp(flight?.std);
  const staStr = safeUtcStamp(flight?.sta);
  const acft = flight?.acft || 'TBD';
  const status = flight?.status || 'SCHEDULED';

  const header =
    eventType === 'ASSIGNED'
      ? `✈️ *Flight Operations — New Flight Assignment*`
      : `🔄 *Flight Operations — Flight Schedule Update*`;

  return [
    header,
    `Dear ${name},`,
    ``,
    `• *Flight:* ${flightNo} (${status})`,
    `• *Route:* ${route}`,
    `• *Aircraft:* ${acft}`,
    `• *STD:* ${stdStr}`,
    `• *STA:* ${staStr}`,
    ``,
    `Please check your Crew Portal for full briefing details.`,
  ].join('\n');
}

export const sendWhatsAppMessage = async (to, message, configOverride = null) => {
  const cleanPhone = String(to || '').replace(/[^\d+]/g, '');
  if (!cleanPhone) {
    throw new Error('Recipient phone number is missing.');
  }

  const cfg = configOverride || (await getWhatsAppSettings());
  const provider = cfg?.provider || 'apps_script';

  if (provider === 'cloud_api') {
    if (!cfg.whatsappApiKey || !cfg.phoneNumberId) {
      throw new Error(
        'Meta WhatsApp Cloud API requires both Phone Number ID and API Access Token.'
      );
    }
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(
        cfg.phoneNumberId
      )}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.whatsappApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone.replace(/^\+/, ''),
          type: 'text',
          text: { body: String(message || '') },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(
        `WhatsApp Cloud API error (${response.status}): ${errBody.slice(0, 200)}`
      );
    }
    return await response.json();
  }

  if (provider === 'wa_link') {
    const waUrl = `https://wa.me/${cleanPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
      String(message || '')
    )}`;
    return { ok: true, waUrl };
  }

  // Default: Google Apps Script Twilio/WhatsApp webhook relay
  const res = await fetch(API_URL, {
    method: 'POST',
    body:
      'payload=' +
      encodeURIComponent(
        JSON.stringify({
          action: 'sendWhatsApp',
          to: cleanPhone,
          from: cfg?.whatsappPhoneNumber || undefined,
          message: String(message || ''),
        })
      ),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'WhatsApp dispatch failed');
  return data;
};

export async function triggerFlightWhatsAppNotifications(
  flight,
  crewList = [],
  eventType = 'UPDATED'
) {
  const cfg = await getWhatsAppSettings();
  if (!cfg?.autoNotifyFlights) return { skipped: true, results: [] };

  const slots = Array.isArray(flight?.crewSlots) ? flight.crewSlots : [];
  const results = [];

  for (const slot of slots) {
    if (!slot?.crewId) continue;
    const member = crewList.find((c) => String(c.id) === String(slot.crewId));
    if (!member?.phone) continue;

    const text = formatFlightWhatsAppTemplate(flight, member, eventType);
    try {
      await sendWhatsAppMessage(member.phone, text, cfg);
      results.push({ crewId: member.id, ok: true });
    } catch (e) {
      results.push({
        crewId: member.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { skipped: false, results };
}
