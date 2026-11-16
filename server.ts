import express from 'express';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL =
  'https://script.google.com/macros/s/AKfycbyWvE4E4dCzWIpm4t6Vul_27CqqYQJ1MsKIUVDZVxAdGogXf76MlR0_Bzs1WHtqYvEXQQ/exec';

let cachedLogoBuffer: Record<number, Buffer> = {};
let lastLogoFetchTime = 0;

async function getCompanyLogoPng(targetSize = 512): Promise<Buffer | null> {
  const now = Date.now();
  if (cachedLogoBuffer[targetSize] && now - lastLogoFetchTime < 180000) {
    return cachedLogoBuffer[targetSize];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(`${API_URL}?sheet=Settings`, {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const txt = await r.text();
    const parsed = txt.trim().startsWith('{') ? JSON.parse(txt) : {};
    const settings =
      Array.isArray(parsed?.data) && parsed.data[0] ? parsed.data[0] : {};
    const rawLogo = settings.logo;
    const logoUrl = toDisplayLogoUrl(rawLogo);

    if (!logoUrl) {
      return null;
    }

    let inputBuffer: Buffer | null = null;
    if (logoUrl.startsWith('data:image/')) {
      const b64Data = logoUrl.split(',')[1];
      if (b64Data) {
        inputBuffer = Buffer.from(b64Data, 'base64');
      }
    } else {
      const imgRes = await fetch(logoUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });
      if (imgRes.ok) {
        const ab = await imgRes.arrayBuffer();
        inputBuffer = Buffer.from(ab);
      }
    }

    if (inputBuffer && inputBuffer.length > 50) {
      const pngBuffer = await sharp(inputBuffer)
        .resize(targetSize, targetSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png({ quality: 90 })
        .toBuffer();

      cachedLogoBuffer[targetSize] = pngBuffer;
      lastLogoFetchTime = now;
      return pngBuffer;
    }
  } catch (err: any) {
    console.warn('Company logo PNG processing notice:', err?.message);
  }

  return cachedLogoBuffer[targetSize] || null;
}

function toDisplayLogoUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  const str = String(rawUrl).trim().replace(/^'/, '');
  if (!str || str === 'undefined' || str === 'null') return '';
  if (str.startsWith('data:')) return str;
  const idQuery = str.match(/[?&]id=([^&]+)/);
  if (idQuery) return `https://lh3.googleusercontent.com/d/${idQuery[1]}`;
  const idPath = str.match(/\/d\/([^/?]+)/);
  if (idPath) return `https://lh3.googleusercontent.com/d/${idPath[1]}`;
  return str;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Same-Origin Proxy to Google Apps Script (Google Sheets + Google Drive)
  // Eliminates browser iframe cross-origin 302 redirect & CORS fetch errors
  app.get('/api/gsheet', async (req, res) => {
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query || {})) {
        if (v !== undefined && v !== null) {
          qs.set(k, String(v));
        }
      }
      const targetUrl = `${API_URL}${qs.toString() ? `?${qs.toString()}` : ''}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });
      clearTimeout(timeout);

      const text = await upstream.text();
      if (text.trim().startsWith('<')) {
        const m = text.match(/<title>(.*?)<\/title>/i);
        res.status(502).json({
          ok: false,
          error: 'Apps Script HTML response: ' + (m ? m[1] : 'HTML'),
        });
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        res.status(502).json({
          ok: false,
          error: 'Non-JSON response from Google Sheets: ' + text.slice(0, 200),
        });
        return;
      }

      res.json(parsed);
    } catch (err: any) {
      res.status(502).json({
        ok: false,
        error: err?.message || 'Google Sheets GET proxy failed',
      });
    }
  });

  app.post('/api/gsheet', async (req, res) => {
    try {
      let payloadStr = '';
      if (typeof req.body === 'string') {
        payloadStr = req.body.startsWith('payload=')
          ? decodeURIComponent(req.body.slice(8))
          : req.body;
      } else if (req.body && typeof req.body.payload === 'string') {
        payloadStr = req.body.payload;
      } else if (req.body && typeof req.body === 'object') {
        payloadStr = JSON.stringify(req.body);
      }

      if (!payloadStr) {
        res.status(400).json({ ok: false, error: 'Missing payload' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      const upstream = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'payload=' + encodeURIComponent(payloadStr),
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await upstream.text();
      if (text.trim().startsWith('<')) {
        const m = text.match(/<title>(.*?)<\/title>/i);
        res.status(502).json({
          ok: false,
          error: 'Apps Script error: ' + (m ? m[1] : 'HTML response'),
        });
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        res.status(502).json({
          ok: false,
          error: 'Non-JSON response from Apps Script: ' + text.slice(0, 300),
        });
        return;
      }

      res.json(parsed);
    } catch (err: any) {
      res.status(502).json({
        ok: false,
        error: err?.message || 'Google Sheets/Drive POST proxy failed',
      });
    }
  });

  // Same-Origin Google Drive File Streamer (Inline PDF, Images, HTML, & Downloads)
  app.get('/api/drive-file/:fileId', async (req, res) => {
    try {
      const rawId = String(req.params.fileId || '').trim();
      const cleanId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanId) {
        res.status(400).send('Invalid Google Drive fileId');
        return;
      }

      const wantDownload = req.query.download === '1' || req.query.download === 'true';
      const requestedName = String(req.query.name || '').trim();

      const detectMime = (buf: Buffer, headerMime?: string, fileNameHint?: string): string => {
        if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
          return 'application/pdf';
        }
        if (
          buf.length >= 8 &&
          buf[0] === 0x89 &&
          buf[1] === 0x50 &&
          buf[2] === 0x4e &&
          buf[3] === 0x47
        ) {
          return 'image/png';
        }
        if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
          return 'image/jpeg';
        }
        if (
          buf.length >= 12 &&
          buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buf.subarray(8, 12).toString('ascii') === 'WEBP'
        ) {
          return 'image/webp';
        }
        if (buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === 'GIF8') {
          return 'image/gif';
        }
        if (/\.html?$/i.test(fileNameHint || '')) {
          return 'text/html; charset=utf-8';
        }
        if (
          headerMime &&
          !headerMime.includes('text/html') &&
          headerMime !== 'application/octet-stream'
        ) {
          return headerMime;
        }
        const headText = buf.subarray(0, 256).toString('utf8').trim().toLowerCase();
        if (headText.startsWith('<svg') || headText.includes('<svg')) {
          return 'image/svg+xml';
        }
        if (
          (headText.startsWith('<!doctype html') ||
            headText.startsWith('<html') ||
            headText.startsWith('<div') ||
            headText.startsWith('<table')) &&
          !headText.includes('google drive') &&
          !headText.includes('accounts.google.com')
        ) {
          return 'text/html; charset=utf-8';
        }
        return headerMime || 'application/octet-stream';
      };

      let fileBuffer: Buffer | null = null;
      let upstreamContentType = '';

      // Strategy 1: Direct Google Drive download endpoint
      try {
        const directUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(cleanId)}`;
        const r1 = await fetch(directUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
        });
        if (r1.ok) {
          const ct = r1.headers.get('content-type') || '';
          const ab = await r1.arrayBuffer();
          const buf = Buffer.from(ab);
          const snippet = buf.subarray(0, 512).toString('utf8').toLowerCase();
          const looksLikeDriveInterstitial =
            ct.includes('text/html') &&
            (snippet.includes('accounts.google.com') ||
              snippet.includes('drive.google.com') ||
              snippet.includes('virus scan warning') ||
              snippet.includes('google drive - quota'));
          if (!looksLikeDriveInterstitial && buf.length > 0) {
            fileBuffer = buf;
            upstreamContentType = ct;
          }
        }
      } catch {}

      // Strategy 2: Apps Script getPDF / DriveApp bridge (works even if file isn't public-anonymous)
      if (!fileBuffer) {
        try {
          const r2 = await fetch(
            `${API_URL}?action=getPDF&fileId=${encodeURIComponent(cleanId)}`,
            { redirect: 'follow' }
          );
          if (r2.ok) {
            const txt = await r2.text();
            if (txt.trim().startsWith('{')) {
              const parsed = JSON.parse(txt);
              if (parsed?.ok && parsed?.base64) {
                fileBuffer = Buffer.from(parsed.base64, 'base64');
                upstreamContentType = parsed.mimeType || '';
              }
            }
          }
        } catch {}
      }

      // Strategy 3: Googleusercontent image CDN (for logos, avatars, stamps, scanned images)
      if (!fileBuffer) {
        try {
          const r3 = await fetch(`https://lh3.googleusercontent.com/d/${encodeURIComponent(cleanId)}`, {
            redirect: 'follow',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
          });
          if (r3.ok) {
            const ab = await r3.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf.length > 0) {
              fileBuffer = buf;
              upstreamContentType = r3.headers.get('content-type') || 'image/png';
            }
          }
        } catch {}
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        res.status(404).json({
          ok: false,
          error: 'تعذر جلب الملف من Google Drive',
        });
        return;
      }

      const finalMime = detectMime(fileBuffer, upstreamContentType, requestedName);
      const asciiSafeName = requestedName
        ? requestedName.replace(/[^\w.-]+/g, '_')
        : '';

      res.setHeader('Content-Type', finalMime);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      if (wantDownload) {
        res.setHeader(
          'Content-Disposition',
          asciiSafeName
            ? `attachment; filename="${asciiSafeName}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`
            : 'attachment'
        );
      } else {
        res.setHeader(
          'Content-Disposition',
          asciiSafeName
            ? `inline; filename="${asciiSafeName}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`
            : 'inline'
        );
      }
      res.send(fileBuffer);
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'Drive file proxy error',
      });
    }
  });

  // Test SMTP connection or Relay readiness for an added sender email account
  app.post('/api/test-email', async (req, res) => {
    try {
      const { account, testRecipient } = req.body || {};
      if (!account || !account.email) {
        res.status(400).json({ ok: false, error: 'البريد المرسل مطلوب' });
        return;
      }

      if (account.mode === 'smtp') {
        if (!account.smtpHost || !account.smtpPass) {
          res.status(400).json({
            ok: false,
            error: 'يرجى إدخال خادم SMTP وكلمة مرور التطبيق (App Password)',
          });
          return;
        }
        const portNum = Number(account.smtpPort) || 465;
        const transporter = nodemailer.createTransport({
          host: String(account.smtpHost).trim(),
          port: portNum,
          secure: portNum === 465,
          auth: {
            user: String(account.smtpUser || account.email).trim(),
            pass: String(account.smtpPass),
          },
        });

        await transporter.verify();

        if (testRecipient) {
          await transporter.sendMail({
            from: account.name
              ? `"${account.name}" <${account.email}>`
              : account.email,
            to: testRecipient,
            replyTo: account.email,
            subject: 'AeroOps — اختبار اتصال البريد المرسل (SMTP Verified)',
            text: `تم التحقق بنجاح من إعدادات الإرسال عبر البريد: ${account.email}`,
          });
        }

        res.json({ ok: true, mode: 'smtp' });
        return;
      }

      // Relay mode test via Apps Script
      if (testRecipient) {
        const payload = JSON.stringify({
          action: 'sendEmail',
          data: {
            to: testRecipient,
            subject: `AeroOps — رسالة تجريبية من ${account.name || account.email}`,
            body: `رسالة اختبارية مرسلة عبر المنظومة.\nالمرسل المعرف: ${account.name ? `${account.name} <${account.email}>` : account.email}\nReply-To: ${account.email}`,
            from: account.email,
            fromName: account.name || '',
            replyTo: account.email,
          },
        });
        const r = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: 'payload=' + encodeURIComponent(payload),
          redirect: 'follow',
        });
        const txt = await r.text();
        const parsed = txt.trim().startsWith('{') ? JSON.parse(txt) : { ok: false, error: txt.slice(0, 120) };
        if (!parsed.ok) {
          res.status(400).json({ ok: false, error: parsed.error || 'Relay test failed' });
          return;
        }
      }

      res.json({ ok: true, mode: 'relay' });
    } catch (err: any) {
      res.status(400).json({
        ok: false,
        error: err?.message || 'تعذر الاتصال بخادم البريد',
      });
    }
  });

  // Send email through a configured SMTP sender account or Apps Script Relay
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, body, html, account, attachments } = req.body || {};
      const normalizedTo = Array.isArray(to)
        ? to.map((x) => String(x || '').trim()).filter(Boolean).join(', ')
        : String(to || '').trim();

      if (!normalizedTo || !subject) {
        res.status(400).json({ ok: false, error: 'المستلم والموضوع مطلوبان' });
        return;
      }

      if (account && account.mode === 'smtp' && account.smtpHost && account.smtpPass) {
        const portNum = Number(account.smtpPort) || 465;
        const transporter = nodemailer.createTransport({
          host: String(account.smtpHost).trim(),
          port: portNum,
          secure: portNum === 465,
          auth: {
            user: String(account.smtpUser || account.email).trim(),
            pass: String(account.smtpPass),
          },
        });

        const formattedAttachments = Array.isArray(attachments)
          ? attachments
              .filter((a) => a && a.filename && (a.content || a.contentBase64))
              .map((a) => ({
                filename: a.filename,
                content: a.content ?? a.contentBase64,
                encoding:
                  a.encoding || (a.contentBase64 && !a.content ? 'base64' : undefined),
                contentType: a.contentType || undefined,
              }))
          : undefined;

        const info = await transporter.sendMail({
          from: account.name
            ? `"${account.name}" <${account.email}>`
            : account.email,
          to: normalizedTo,
          replyTo: account.email,
          subject,
          text: body || '',
          html: html || undefined,
          attachments: formattedAttachments,
        });

        res.json({ ok: true, messageId: info.messageId, via: 'smtp', from: account.email });
        return;
      }

      // Fallback / Relay via Google Apps Script with sender metadata
      const senderHeader =
        account?.email
          ? `\n\n—\nSent on behalf of: ${account.name ? `${account.name} <${account.email}>` : account.email}`
          : '';
      const relayAttachments = Array.isArray(attachments)
        ? attachments
            .filter((a) => a && a.filename && (a.contentBase64 || a.content))
            .map((a) => ({
              fileName: a.filename,
              mimeType: a.contentType || 'application/octet-stream',
              base64:
                a.contentBase64 ||
                (a.encoding === 'base64' ? String(a.content || '') : ''),
            }))
            .filter((a) => a.base64)
        : undefined;

      const payload = JSON.stringify({
        action: 'sendEmail',
        data: {
          to: normalizedTo,
          subject,
          body: (body || '') + senderHeader,
          htmlBody: html || undefined,
          from: account?.email || '',
          fromName: account?.name || '',
          replyTo: account?.email || '',
          attachments: relayAttachments,
        },
      });

      const r = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'payload=' + encodeURIComponent(payload),
        redirect: 'follow',
      });

      const text = await r.text();
      const parsed = text.trim().startsWith('{')
        ? JSON.parse(text)
        : { ok: false, error: 'Non-JSON response from mail relay' };

      if (!parsed.ok) {
        res.status(400).json({ ok: false, error: parsed.error || 'فشل إرسال البريد' });
        return;
      }

      res.json({ ok: true, data: parsed.data, via: 'relay', from: account?.email || 'system' });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'خطأ أثناء إرسال البريد الإلكتروني',
      });
    }
  });

  // Live Aviation Weather (METAR / TAF) & International NOTAM Proxy with 5-minute TTL cache
  const airportIntelCache = new Map<string, { expiresAt: number; payload: any }>();
  let autorouterOAuthCache: { token: string; expiresAt: number } | null = null;

  app.get('/api/airport-intel/:icao', async (req, res) => {
    const icao = String(req.params.icao || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4);

    if (!icao || icao.length < 3) {
      res.status(400).json({ ok: false, error: 'رمز المطار ICAO غير صالح' });
      return;
    }

    const forceRefresh = req.query.refresh === '1';
    const cached = airportIntelCache.get(icao);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    const fetchWithTimeout = async (
      url: string,
      init: RequestInit = {},
      ms = 6000
    ) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ms);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    let metar: any = null;
    let taf: any = null;
    let notams: any[] = [];
    let notamError = '';

    const isSet = (val: string | undefined, placeholder: string) => {
      const v = (val || '').trim();
      return Boolean(v && v !== placeholder);
    };

    const notamifyToken = (process.env.NOTAMIFY_TOKEN || '').trim();
    const notamifyConfigured = isSet(notamifyToken, 'MY_NOTAMIFY_TOKEN');

    const icaoApiKey = (process.env.ICAO_API_KEY || '').trim();
    const icaoApiConfigured = isSet(icaoApiKey, 'MY_ICAO_API_KEY');

    const avwxToken = (process.env.AVWX_TOKEN || '').trim();
    const avwxConfigured = isSet(avwxToken, 'MY_AVWX_TOKEN');

    const autorouterStaticToken = (process.env.AUTOROUTER_TOKEN || '').trim();
    const autorouterUser = (process.env.AUTOROUTER_USERNAME || '').trim();
    const autorouterPass = (process.env.AUTOROUTER_PASSWORD || '').trim();
    const autorouterConfigured =
      isSet(autorouterStaticToken, 'MY_AUTOROUTER_TOKEN') ||
      (isSet(autorouterUser, 'MY_AUTOROUTER_USERNAME') &&
        isSet(autorouterPass, 'MY_AUTOROUTER_PASSWORD'));

    const checkwxKey = (process.env.CHECKWX_API_KEY || '').trim();
    const checkwxConfigured = isSet(checkwxKey, 'MY_CHECKWX_API_KEY');

    const formatUtcShort = (val: any) => {
      if (!val) return '';
      const str = String(val).trim();
      if (/^PERM$/i.test(str)) return 'PERM';
      const d = new Date(str);
      if (isNaN(d.getTime())) return str.slice(0, 16);
      return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}Z`;
    };

    const resolveAutorouterToken = async (): Promise<string> => {
      if (isSet(autorouterStaticToken, 'MY_AUTOROUTER_TOKEN')) {
        return autorouterStaticToken;
      }
      if (autorouterOAuthCache && autorouterOAuthCache.expiresAt > Date.now() + 30000) {
        return autorouterOAuthCache.token;
      }
      if (!autorouterUser || !autorouterPass) return '';
      try {
        const body = new URLSearchParams({
          grant_type: 'password',
          client_id: 'web',
          username: autorouterUser,
          password: autorouterPass,
        });
        const resp = await fetchWithTimeout(
          'https://api.autorouter.aero/v1.0/oauth2/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'AeroOps-FlightOps/1.0',
            },
            body: body.toString(),
          },
          6000
        );
        if (resp.ok) {
          const data: any = await resp.json();
          if (data?.access_token) {
            const ttl = Math.max(60, Number(data.expires_in) || 3600) * 1000;
            autorouterOAuthCache = {
              token: data.access_token,
              expiresAt: Date.now() + ttl,
            };
            return data.access_token;
          }
        }
      } catch {
        // Ignore OAuth error
      }
      return '';
    };

    const [metarRes, tafRes] = await Promise.allSettled([
      fetchWithTimeout(
        `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=json`,
        { headers: { 'User-Agent': 'AeroOps-FlightOps/1.0', Accept: 'application/json' } },
        6000
      ),
      fetchWithTimeout(
        `https://aviationweather.gov/api/data/taf?ids=${encodeURIComponent(icao)}&format=json`,
        { headers: { 'User-Agent': 'AeroOps-FlightOps/1.0', Accept: 'application/json' } },
        6000
      ),
    ]);

    if (metarRes.status === 'fulfilled' && metarRes.value.ok) {
      try {
        const arr = await metarRes.value.json();
        const item = Array.isArray(arr) ? arr[0] : null;
        if (item && (item.rawOb || item.icaoId)) {
          const wdir =
            item.wdir === 'VRB' || item.wdir === 0
              ? item.wdir === 'VRB'
                ? 'VRB'
                : '000'
              : item.wdir != null
              ? String(item.wdir).padStart(3, '0')
              : null;
          const wspd = item.wspd != null ? Number(item.wspd) : null;
          const wgst = item.wgst != null ? Number(item.wgst) : null;
          const windStr =
            wspd != null
              ? `${wdir || '---'}°/${wspd}${wgst ? `G${wgst}` : ''}kt`
              : null;

          metar = {
            icaoId: item.icaoId || icao,
            rawOb: item.rawOb || '',
            obsTime: item.reportTime || item.obsTime || '',
            temp: item.temp != null ? Number(item.temp) : null,
            dewp: item.dewp != null ? Number(item.dewp) : null,
            wdir: item.wdir ?? null,
            wspd,
            wgst,
            windStr,
            visib: item.visib != null ? String(item.visib) : null,
            altim: item.altim != null ? Math.round(Number(item.altim)) : null,
            fltCat: item.fltCat || item.fltcat || null,
            wxString: item.wxString || null,
            clouds: Array.isArray(item.clouds) ? item.clouds : [],
            name: item.name || null,
          };
        }
      } catch {
        // Ignore parse failure
      }
    }

    if (tafRes.status === 'fulfilled' && tafRes.value.ok) {
      try {
        const arr = await tafRes.value.json();
        const item = Array.isArray(arr) ? arr[0] : null;
        if (item && (item.rawTAF || item.icaoId)) {
          taf = {
            icaoId: item.icaoId || icao,
            rawTAF: item.rawTAF || '',
            issueTime: item.issueTime || '',
            validTimeFrom: item.validTimeFrom || null,
            validTimeTo: item.validTimeTo || null,
            remarks: item.remarks || '',
          };
        }
      } catch {
        // Ignore parse failure
      }
    }

    let usedNotamSource = notamifyConfigured
      ? 'NOTAMIFY'
      : icaoApiConfigured
      ? 'ICAO'
      : autorouterConfigured
      ? 'AUTOROUTER'
      : avwxConfigured
      ? 'AVWX'
      : checkwxConfigured
      ? 'CHECKWX'
      : 'ICAO';

    // 1. Notamify Worldwide NOTAMs
    if (notamifyConfigured) {
      try {
        const resp = await fetchWithTimeout(
          `https://api.notamify.com/api/v2/notams?location=${encodeURIComponent(icao)}&per_page=15`,
          {
            headers: {
              Authorization: `Bearer ${notamifyToken}`,
              'User-Agent': 'AeroOps-FlightOps/1.0',
              Accept: 'application/json',
            },
          },
          7000
        );
        if (resp.ok) {
          const parsed: any = await resp.json();
          const list = Array.isArray(parsed?.notams)
            ? parsed.notams
            : Array.isArray(parsed?.data)
            ? parsed.data
            : Array.isArray(parsed)
            ? parsed
            : [];
          notams = list.slice(0, 15).map((n: any, i: number) => {
            const num = String(n.notam_number || n.notamNumber || n.id || `NTM-${i + 1}`);
            const rawMsg = String(n.icao_message || n.message || '').trim();
            const interp = n.interpretation && typeof n.interpretation === 'object' ? n.interpretation : null;
            const affected = Array.isArray(interp?.affected_elements) ? interp.affected_elements : [];
            const hasClosedEffect = affected.some((el: any) => {
              const eff = String(el?.effect || '').toUpperCase();
              const typ = String(el?.type || '').toUpperCase();
              return eff === 'CLOSED' && ['AIRPORT', 'AERODROME', 'AD', 'RUNWAY', 'RWY'].includes(typ);
            });
            const hasRestrictedEffect = affected.some(
              (el: any) => String(el?.effect || '').toUpperCase() === 'RESTRICTED'
            );
            const isTextClosed = /\b(AD CLSD|AIRPORT CLOSED|AERODROME CLOSED|RWY\s*\S*\s*CLSD)\b/i.test(rawMsg);
            return {
              id: String(n.id || num),
              number: num,
              classification: String(n.classification || interp?.category || 'INTL'),
              qCode: String(n.qcode || n.Qcode || ''),
              category: String(interp?.category || ''),
              subcategory: String(interp?.subcategory || ''),
              excerpt: String(interp?.excerpt || ''),
              affectedElements: affected.slice(0, 4).map((el: any) => ({
                type: String(el?.type || ''),
                identifier: String(el?.identifier || el?.name || ''),
                effect: String(el?.effect || ''),
              })),
              effectiveStart: formatUtcShort(n.starts_at || n.startsAt),
              effectiveEnd: formatUtcShort(n.ends_at || n.endsAt) || 'PERM',
              text: rawMsg,
              isClosed: hasClosedEffect || isTextClosed,
              isRestricted: !hasClosedEffect && !isTextClosed && hasRestrictedEffect,
              source: 'NOTAMIFY',
            };
          });
          if (notams.length > 0) usedNotamSource = 'NOTAMIFY';
        } else {
          if (resp.status === 401) notamError = 'NOTAMIFY_UNAUTHORIZED';
          else if (resp.status === 403) notamError = 'NOTAMIFY_QUOTA_EXCEEDED';
          else if (resp.status === 429) notamError = 'NOTAMIFY_RATE_LIMITED';
        }
      } catch {
        // Cascade to next provider
      }
    }

    // 2. ICAO Data Services
    if (notams.length === 0 && icaoApiConfigured) {
      try {
        const resp = await fetchWithTimeout(
          `https://dataservices.icao.int/api/notams-realtime-list?api_key=${encodeURIComponent(
            icaoApiKey
          )}&locations=${encodeURIComponent(icao)}`,
          { headers: { 'User-Agent': 'AeroOps-FlightOps/1.0', Accept: 'application/json' } },
          6500
        );
        if (resp.ok) {
          const rawTxt = await resp.text();
          const trimmed = rawTxt.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const parsed = JSON.parse(trimmed);
            const list = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.data)
              ? parsed.data
              : Array.isArray(parsed?.notams)
              ? parsed.notams
              : [];
            notams = list.slice(0, 15).map((n: any, i: number) => {
              const fullText = String(n.all || n.message || n.Message || '').trim();
              const qCode = String(n.Qcode || n.qcode || '').trim();
              return {
                id: String(n.id || n.key || `icao_notam_${i}`),
                number: String(n.id || n.key || `ICAO-${i + 1}`),
                classification: String(n.type || qCode || n.StateName || 'ICAO INTL'),
                qCode,
                stateName: String(n.StateName || ''),
                effectiveStart: formatUtcShort(n.startdate || n.startDate || n.Created),
                effectiveEnd: formatUtcShort(n.enddate || n.endDate) || 'PERM',
                text: fullText,
                isClosed:
                  /\b(CLSD|CLOSED|AD CLSD|RWY CLSD)\b/i.test(fullText) ||
                  /^Q(M|F|A)[A-Z]*LC/i.test(qCode),
                isRestricted: /\b(RSTD|RESTRICTED|PPR)\b/i.test(fullText),
                source: 'ICAO',
              };
            });
            if (notams.length > 0) {
              usedNotamSource = 'ICAO';
              notamError = '';
            }
          }
        }
      } catch {
        // Cascade to next provider
      }
    }

    // 3. Autorouter Eurocontrol EAD International NOTAMs
    if (notams.length === 0 && autorouterConfigured) {
      try {
        const arToken = await resolveAutorouterToken();
        if (arToken) {
          const resp = await fetchWithTimeout(
            `https://api.autorouter.aero/v1.0/pams/notam?itemas=${encodeURIComponent(
              JSON.stringify([icao])
            )}&limit=15`,
            {
              headers: {
                Authorization: `Bearer ${arToken}`,
                'User-Agent': 'AeroOps-FlightOps/1.0',
                Accept: 'application/json',
              },
            },
            6500
          );
          if (resp.ok) {
            const parsed: any = await resp.json();
            const list = Array.isArray(parsed?.rows)
              ? parsed.rows
              : Array.isArray(parsed?.data)
              ? parsed.data
              : Array.isArray(parsed)
              ? parsed
              : [];
            notams = list.slice(0, 15).map((n: any, i: number) => {
              const num = `${n.series || ''}${String(n.number || '').padStart(4, '0')}/${String(n.year || '').slice(-2)}` || `EAD-${i + 1}`;
              const text = String(n.iteme || n.text || n.raw || '').trim();
              const qCode = String(n.code23 ? `Q${n.code23}${n.code45 || ''}` : n.qcode || '');
              return {
                id: String(n.id || num),
                number: num,
                classification: String(n.type || 'EAD INTL'),
                qCode,
                effectiveStart: formatUtcShort(n.startvalidity ? Number(n.startvalidity) * 1000 : n.start),
                effectiveEnd: n.endvalidity
                  ? formatUtcShort(Number(n.endvalidity) * 1000)
                  : n.estimation || 'PERM',
                text,
                isClosed: /\b(AD CLSD|AIRPORT CLOSED|AERODROME CLOSED|RWY\s*\S*\s*CLSD)\b/i.test(text) || /^Q(M|F|A)[A-Z]*LC/i.test(qCode),
                isRestricted: /\b(RSTD|RESTRICTED|PPR)\b/i.test(text),
                source: 'AUTOROUTER EAD',
              };
            });
            if (notams.length > 0) {
              usedNotamSource = 'AUTOROUTER EAD';
              notamError = '';
            }
          }
        }
      } catch {
        // Cascade to next provider
      }
    }

    // 4. AVWX Worldwide NOTAMs
    if (notams.length === 0 && avwxConfigured) {
      try {
        const resp = await fetchWithTimeout(
          `https://avwx.rest/api/notam/${encodeURIComponent(icao)}`,
          {
            headers: {
              Authorization: `BEARER ${avwxToken}`,
              'User-Agent': 'AeroOps-FlightOps/1.0',
              Accept: 'application/json',
            },
          },
          6500
        );
        if (resp.ok) {
          const parsed: any = await resp.json();
          const list = Array.isArray(parsed?.data)
            ? parsed.data
            : Array.isArray(parsed?.notams)
            ? parsed.notams
            : Array.isArray(parsed)
            ? parsed
            : [];
          notams = list.slice(0, 15).map((n: any, i: number) => {
            const text = String(n.body || n.raw || n.text || '').trim();
            const qCode = String(n.qualifiers?.repr || n.qcode || '');
            return {
              id: String(n.number || `avwx_${i}`),
              number: String(n.number || `AVWX-${i + 1}`),
              classification: String(n.type?.repr || n.type || 'AVWX INTL'),
              qCode,
              effectiveStart: formatUtcShort(n.starttime?.dt || n.start_time || n.starttime),
              effectiveEnd: formatUtcShort(n.endtime?.dt || n.end_time || n.endtime) || 'PERM',
              text,
              isClosed: /\b(AD CLSD|AIRPORT CLOSED|AERODROME CLOSED|RWY\s*\S*\s*CLSD)\b/i.test(text),
              isRestricted: /\b(RSTD|RESTRICTED|PPR)\b/i.test(text),
              source: 'AVWX',
            };
          });
          if (notams.length > 0) {
            usedNotamSource = 'AVWX';
            notamError = '';
          }
        }
      } catch {
        // Cascade to next provider
      }
    }

    // 5. CheckWX Global NOTAMs
    if (notams.length === 0 && checkwxConfigured) {
      try {
        const resp = await fetchWithTimeout(
          `https://api.checkwx.com/notam/${encodeURIComponent(icao)}`,
          {
            headers: {
              'X-API-Key': checkwxKey,
              'User-Agent': 'AeroOps-FlightOps/1.0',
              Accept: 'application/json',
            },
          },
          6500
        );
        if (resp.ok) {
          const parsed: any = await resp.json();
          const list = Array.isArray(parsed?.data) ? parsed.data : [];
          notams = list.slice(0, 15).map((n: any, i: number) => {
            const text = typeof n === 'string' ? n : String(n.raw_text || n.text || n.message || '').trim();
            const num = String(n?.id || n?.notam_number || `CHECKWX-${i + 1}`);
            return {
              id: num,
              number: num,
              classification: 'CHECKWX INTL',
              qCode: String(n?.qcode || ''),
              effectiveStart: formatUtcShort(n?.effective_start || n?.start),
              effectiveEnd: formatUtcShort(n?.effective_end || n?.end) || 'PERM',
              text,
              isClosed: /\b(AD CLSD|AIRPORT CLOSED|AERODROME CLOSED|RWY\s*\S*\s*CLSD)\b/i.test(text),
              isRestricted: /\b(RSTD|RESTRICTED|PPR)\b/i.test(text),
              source: 'CHECKWX',
            };
          });
          if (notams.length > 0) {
            usedNotamSource = 'CHECKWX';
            notamError = '';
          }
        }
      } catch {
        // End of cascade
      }
    }

    const anyNotamSourceConfigured =
      notamifyConfigured ||
      icaoApiConfigured ||
      autorouterConfigured ||
      avwxConfigured ||
      checkwxConfigured;

    const payload = {
      ok: true,
      icao,
      metar,
      taf,
      notams,
      notamSource: usedNotamSource,
      notamifyConfigured,
      icaoApiConfigured,
      autorouterConfigured,
      avwxConfigured,
      checkwxConfigured,
      anyNotamSourceConfigured,
      notamError,
      fetchedAt: new Date().toISOString(),
    };

    airportIntelCache.set(icao, {
      expiresAt: Date.now() + (anyNotamSourceConfigured ? 10 : 5) * 60 * 1000,
      payload,
    });

    res.json(payload);
  });

  // AI-Powered Smart Aviation Document & Form Scanner / Auto-Filler
  app.post('/api/ai/parse-form', async (req, res) => {
    try {
      const {
        fileBase64,
        mimeType = 'image/png',
        htmlContent = '',
        flightData = {},
      } = req.body || {};

      if (!fileBase64 && !htmlContent) {
        res.status(400).json({
          ok: false,
          error: 'يرجى تقديم صورة أو مستند PDF أو كود HTML للتحليل',
        });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;

      const flightContextSummary = `
Target Flight Data to Auto-Fill:
- flightNo (Flight Number): ${flightData.flightNo || '—'}
- date (Date of Flight YYYY-MM-DD): ${flightData.date || flightData.stdDate || '—'}
- departure (ADEP ICAO): ${flightData.dep || flightData.departure || '—'}
- departureFull (ADEP Full): ${flightData.departureFull || flightData.dep || '—'}
- arrival (ADES ICAO): ${flightData.arr || flightData.arrival || '—'}
- arrivalFull (ADES Full): ${flightData.arrivalFull || flightData.arr || '—'}
- route (Route / Sectors): ${flightData.route || (flightData.dep && flightData.arr ? `${flightData.dep}-${flightData.arr}` : '—')}
- std (STD UTC HH:MMZ): ${flightData.stdTime || flightData.std || '—'}
- sta (STA UTC HH:MMZ): ${flightData.staTime || flightData.sta || '—'}
- altn (Alternate ICAO): ${flightData.altn || '—'}
- aircraft (Aircraft Registration): ${flightData.acft || flightData.aircraft || flightData.aircraftReg || '—'}
- aircraftType (Aircraft Type / ICAO): ${flightData.aircraftType || flightData.acftType || '—'}
- seatCapacity / mtow: ${flightData.seatCapacity || flightData.mtow || '—'}
- flightType / flightNature / purpose: ${flightData.flightType || 'CHARTER'} / ${flightData.flightNature || 'PAX'}
- picName (Captain / PIC): ${flightData.picName || flightData.pic || '—'}
- picLicense: ${flightData.picLicense || '—'}
- picPassport: ${flightData.picPassport || '—'}
- picNationality: ${flightData.picNationality || '—'}
- foName (First Officer / SIC): ${flightData.foName || flightData.fo || '—'}
- foLicense: ${flightData.foLicense || '—'}
- foPassport: ${flightData.foPassport || '—'}
- pax (Passenger Count): ${flightData.pax != null ? flightData.pax : '0'}
- cargo (Cargo Weight kg): ${flightData.cargo != null ? flightData.cargo : '0'}
- operatorName (Company Name EN): ${flightData.operatorName || flightData.companyName || 'Flight Operations'}
- operatorNameAr (Company Name AR): ${flightData.operatorNameAr || flightData.companyNameAr || ''}
- operatorCode (ICAO Operator Code): ${flightData.operatorCode || 'EACS'}
- phone / email / sita / address / contactPerson: ${flightData.phone || ''} / ${flightData.email || ''} / ${flightData.sita || ''}
- handlingAgent: ${flightData.handlingAgent || '—'}
- permitsNotes: ${flightData.permits || '—'}
- preparedBy: ${flightData.preparedBy || 'Flight Dispatch'}
`;

      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const prompt = `
You are an ultra-smart aviation document & form OCR layout analysis AI engine.
IMPORTANT: The user uploaded an aviation form (image, PDF, or HTML). Analyze every visual box, table cell, blank line, or field on the form and map it to AeroOps system keys so it can be auto-filled accurately on both the original document overlay AND as a clean printable HTML template.

Use these EXACT AeroOps 'systemKey' identifiers whenever a field matches (otherwise set systemKey to "" and use a descriptive camelCase key):
- Flight 1: flightNo, date, departure, departureFull, arrival, arrivalFull, std, sta, route, altn, flightType, flightNature, purpose, pax, cargo, aircraft, aircraftType, picName
- Flight 2 (Return/Leg 2): flightNo_2, date_2, departure_2, arrival_2, std_2, sta_2, route_2, pax_2, cargo_2, aircraft_2, picName_2
- Flight 3 / 4: flightNo_3, date_3, departure_3, arrival_3, std_3, sta_3, flightNo_4, date_4, departure_4, arrival_4, std_4, sta_4
- Combined Multi-Flight: allFlightNos, allRoutes, allDates, allAircraft, totalPax, totalCargo, flightsCount, sectorsTableHtml, crewTableHtml
- Aircraft & CAMO: coaExpiry, insuranceExpiry, noiseCertExpiry, seatCapacity
- Crew & JL: picLicense, picPassport, picNationality, crewCount, crew, foName, foLicense, foPassport, actualStd, takeoff, landing, actualSta, blockTime, blockFuel, fuelUsed, fuelRemaining, delayCode
- Operator: operatorName, operatorNameAr, operatorCode, operatorCountry, address, phone, fax, email, sita, contactPerson, preparedBy
- Common Manual Permit/Ops fields: entryPoint, exitPoint, atsRoute, handlingAgent, receivingParty, billingAddress, permitNo, issuedDate, expiryDate, permitsNotes

${flightContextSummary}

Tasks:
1. Identify the document title (Arabic or English), issuing Civil Aviation Authority / Operator, country, category ('Ground Ops' | 'Dispatch' | 'Handling' | 'Crew & GenDec' | 'Load & Fuel' | 'Safety & Security' | 'General'), and document type (PERMIT or OPERATIONAL_FORM).
2. Detect EVERY fillable field, box, underline, checkbox, or table cell intended to be filled in the uploaded document.
3. For each detected field:
   - 'key': matching AeroOps systemKey above if applicable, else unique camelCase key.
   - 'systemKey': exact AeroOps systemKey string above if mapped from system data, else "".
   - 'label': clear bilingual label (e.g. "Flight Number / رقم الرحلة").
   - 'value': auto-populated value from Target Flight Data if systemKey matches (never invent fake flight numbers), else "".
   - 'mappedFromFlight': true if systemKey maps to system data, false if manual/unlinked.
   - 'category': 'flight' | 'aircraft' | 'crew' | 'operator' | 'route' | 'manual'.
   - 'align': "center" | "left" | "right".
   - 'box': exact 2D bounding box on a 595x842 A4 page grid where text should be written DIRECTLY inside the blank value slot (NOT covering the printed label!):
     { "x": number (0..595), "y": number (bottom-up: 0 at page bottom, 842 at page top), "width": number, "height": number, "page": number (0-indexed) }.
   - 'fontSize': number between 8 and 13.
4. Put unlinked/manual required fields in 'missingFields' as well.
5. Generate 'formattedHtml': a clean, print-ready A4 HTML recreation of the uploaded form's layout/tables/sections using {{systemKey}} placeholders inside value cells (matching the exact detected keys).

Return STRICT JSON ONLY:
{
  "title": "string",
  "documentType": "PERMIT" | "OPERATIONAL_FORM",
  "category": "Ground Ops" | "Dispatch" | "Handling" | "Crew & GenDec" | "Load & Fuel" | "Safety & Security" | "General",
  "country": "string",
  "authority": "string",
  "detectedFields": [
    {
      "key": "string",
      "systemKey": "string",
      "label": "string",
      "value": "string",
      "mappedFromFlight": boolean,
      "category": "flight" | "aircraft" | "crew" | "operator" | "route" | "manual",
      "align": "center",
      "box": { "x": 180, "y": 720, "width": 140, "height": 20, "page": 0 },
      "fontSize": 10
    }
  ],
  "missingFields": [
    {
      "key": "string",
      "label": "string",
      "placeholder": "string",
      "value": "string",
      "required": boolean
    }
  ],
  "formattedHtml": "string"
}
`;

          const contents: any[] = [];
          if (fileBase64) {
            const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
            contents.push({
              inlineData: {
                mimeType: mimeType || 'image/png',
                data: cleanBase64,
              },
            });
          }
          if (htmlContent) {
            contents.push({
              text: `Raw Document HTML Content:\n${htmlContent.slice(0, 15000)}`,
            });
          }
          contents.push({ text: prompt });

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const rawText = (response.text || '').trim();
          let parsedJson: any = null;
          try {
            parsedJson = JSON.parse(rawText);
          } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsedJson = JSON.parse(jsonMatch[0]);
          }

          if (parsedJson && (parsedJson.detectedFields || parsedJson.title)) {
            res.json({
              ok: true,
              source: 'gemini-ai',
              ...parsedJson,
            });
            return;
          }
        } catch (aiErr: any) {
          console.warn('Gemini parser fallback to heuristic parser:', aiErr?.message);
        }
      }

      // High-Quality Fallback Heuristic Parser (aligned with SYSTEM_DATA_CATALOG keys)
      const flightNo = flightData.flightNo || 'LN-101';
      const dep = flightData.dep || flightData.departure || 'HLLT';
      const arr = flightData.arr || flightData.arrival || 'HECA';
      const date = flightData.date || flightData.stdDate || new Date().toISOString().slice(0, 10);
      const acft = flightData.acft || flightData.aircraft || flightData.aircraftReg || '5A-ONE';
      const acftType = flightData.aircraftType || 'A320';
      const operator = flightData.operatorName || flightData.companyName || 'Flight Operations';
      const opCode = flightData.operatorCode || 'EACS';
      const pic = flightData.picName || flightData.pic || 'Capt. Pilot';
      const fo = flightData.foName || flightData.fo || 'First Officer';
      const pax = flightData.pax != null ? String(flightData.pax) : '0';
      const cargo = flightData.cargo != null ? String(flightData.cargo) : '0';
      const std = flightData.stdTime || flightData.std || '10:00Z';
      const sta = flightData.staTime || flightData.sta || '13:30Z';

      const detectedFields = [
        { key: 'flightNo', systemKey: 'flightNo', label: 'Flight Number / رقم الرحلة', value: flightNo, mappedFromFlight: true, category: 'flight', box: { x: 170, y: 695, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'date', systemKey: 'date', label: 'Date of Flight / تاريخ الرحلة', value: date, mappedFromFlight: true, category: 'flight', box: { x: 390, y: 695, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'departure', systemKey: 'departure', label: 'Departure Airport (ICAO) / مطار الإقلاع', value: dep, mappedFromFlight: true, category: 'route', box: { x: 170, y: 660, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'arrival', systemKey: 'arrival', label: 'Destination Airport (ICAO) / مطار الهبوط', value: arr, mappedFromFlight: true, category: 'route', box: { x: 390, y: 660, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'route', systemKey: 'route', label: 'Route & Sectors / المسار والقطاعات', value: `${dep} - ${arr}`, mappedFromFlight: true, category: 'route', box: { x: 170, y: 625, width: 220, height: 20, page: 0 }, fontSize: 10 },
        { key: 'std', systemKey: 'std', label: 'STD (UTC) / موعد الإقلاع', value: std, mappedFromFlight: true, category: 'flight', box: { x: 170, y: 590, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'sta', systemKey: 'sta', label: 'STA (UTC) / موعد الوصول', value: sta, mappedFromFlight: true, category: 'flight', box: { x: 390, y: 590, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'aircraft', systemKey: 'aircraft', label: 'Aircraft Registration / تسجيل الطائرة', value: acft, mappedFromFlight: true, category: 'aircraft', box: { x: 170, y: 555, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'aircraftType', systemKey: 'aircraftType', label: 'Aircraft Type & ICAO / طراز الطائرة', value: acftType, mappedFromFlight: true, category: 'aircraft', box: { x: 390, y: 555, width: 120, height: 20, page: 0 }, fontSize: 10 },
        { key: 'operatorName', systemKey: 'operatorName', label: 'Operator Name / اسم المشغل الجوي', value: operator, mappedFromFlight: true, category: 'operator', box: { x: 170, y: 520, width: 200, height: 20, page: 0 }, fontSize: 10 },
        { key: 'operatorCode', systemKey: 'operatorCode', label: 'Operator Code / كود المشغل', value: opCode, mappedFromFlight: true, category: 'operator', box: { x: 420, y: 520, width: 90, height: 20, page: 0 }, fontSize: 10 },
        { key: 'picName', systemKey: 'picName', label: 'Pilot in Command (PIC) / قائد الطائرة', value: pic, mappedFromFlight: true, category: 'crew', box: { x: 170, y: 485, width: 160, height: 20, page: 0 }, fontSize: 10 },
        { key: 'foName', systemKey: 'foName', label: 'First Officer (SIC) / المساعد الأول', value: fo, mappedFromFlight: true, category: 'crew', box: { x: 390, y: 485, width: 150, height: 20, page: 0 }, fontSize: 10 },
        { key: 'pax', systemKey: 'pax', label: 'Passenger Count / عدد الركاب', value: pax, mappedFromFlight: true, category: 'flight', box: { x: 170, y: 450, width: 90, height: 20, page: 0 }, fontSize: 10 },
        { key: 'cargo', systemKey: 'cargo', label: 'Cargo Weight / وزن الشحن', value: `${cargo} KG`, mappedFromFlight: true, category: 'flight', box: { x: 390, y: 450, width: 90, height: 20, page: 0 }, fontSize: 10 },
      ];

      const missingFields = [
        { key: 'entryPoint', label: 'Entry Waypoint & Time / نقطة ووقت الدخول الجوي', placeholder: 'e.g. TRL / TRP 11:20 UTC', value: '', required: false },
        { key: 'exitPoint', label: 'Exit Waypoint & Time / نقطة ووقت الخروج الجوي', placeholder: 'e.g. SALUM 12:45 UTC', value: '', required: false },
        { key: 'handlingAgent', label: 'Local Ground Handling Agent / وكيل المناولة الأرضية', placeholder: 'e.g. EAS Ground Services', value: flightData.handlingAgent || '', required: false },
        { key: 'permitNo', label: 'Clearance Ref / رقم التصريح أو المرجع', placeholder: 'CAA/PERMIT/...', value: '', required: false },
      ];

      const formattedHtml = `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 2px solid #1e3a8a; background: #fff; color: #1e293b;">
  <div style="text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 18px;">
    <h2 style="margin: 0; color: #1e3a8a; text-transform: uppercase;">Operational & Flight Clearance Form</h2>
    <div style="font-size: 13px; font-weight: bold; color: #475569; margin-top: 4px;">{{operatorName}} ({{operatorCode}})</div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px;">
    <tbody>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 25%;">Operator / المشغل:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; color: #0369a1;">{{operatorName}} ({{operatorCode}})</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 25%;">Flight No / رقم الرحلة:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace; color: #1e3a8a;">{{flightNo}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Aircraft Reg / التسجيل:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">{{aircraft}}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Type / الطراز:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">{{aircraftType}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Departure / المغادرة:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold;">{{departure}} — STD: {{std}}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Destination / الوصول:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: bold;">{{arrival}} — STA: {{sta}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Date of Flight / التاريخ:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace;">{{date}}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Route / المسار:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace;">{{route}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">Captain (PIC) / قائد الطائرة:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">{{picName}}</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">First Officer / المساعد:</td>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1;">{{foName}}</td>
      </tr>
      <tr>
        <td style="padding: 6px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold;">PAX & Cargo / الركاب والشحن:</td>
        <td colspan="3" style="padding: 6px 10px; border: 1px solid #cbd5e1;">PAX: <b>{{pax}}</b> | Cargo: <b>{{cargo}} KG</b></td>
      </tr>
    </tbody>
  </table>
  <div style="margin-bottom: 12px;">{{sectorsTableHtml}}</div>
  <div>{{crewTableHtml}}</div>
</div>`;

      res.json({
        ok: true,
        source: 'heuristic-engine',
        title: 'Operational & Flight Clearance Form',
        documentType: 'OPERATIONAL_FORM',
        category: 'Dispatch',
        country: 'International Aviation Authority',
        authority: 'Civil Aviation Authority',
        detectedFields,
        missingFields,
        formattedHtml,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'فشل معالجة المستند',
      });
    }
  });

  // AI Interactive Chat Command Engine for Smart Form Scanner
  app.post('/api/ai/form-chat', async (req, res) => {
    try {
      const {
        message = '',
        history = [],
        formState = {},
        flightData = {},
        fileBase64 = '',
        mimeType = '',
      } = req.body || {};

      const cleanMsg = String(message || '').trim();
      if (!cleanMsg) {
        res.status(400).json({ ok: false, error: 'يرجى كتابة الأمر أو الطلب' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const compactFields = Array.isArray(formState.detectedFields)
            ? formState.detectedFields.map((f: any, idx: number) => ({
                index: idx,
                key: f.key,
                systemKey: f.systemKey || '',
                label: f.label,
                value: f.value,
                box: f.box,
                fontSize: f.fontSize,
                align: f.align,
              }))
            : [];

          const recentHistory = Array.isArray(history)
            ? history
                .slice(-6)
                .map((h: any) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`)
                .join('\n')
            : '';

          const prompt = `
You are an intelligent Flight Operations Form Editor Copilot for AeroOps.
The user wants to modify, add, delete, position, or link fields in the currently scanned form, or update its metadata/HTML layout.

Current Form State:
- title: ${formState.title || ''}
- category: ${formState.category || 'Dispatch'}
- authority: ${formState.authority || ''}
- country: ${formState.country || ''}
- outputFormat: ${formState.saveOutputFormat || 'original'}
- detectedFields: ${JSON.stringify(compactFields)}
- missingFields: ${JSON.stringify(formState.missingFields || [])}

Available AeroOps System Keys (for automatic live binding):
flightNo, date, departure, departureFull, arrival, arrivalFull, route, std, sta, altn, flightType, flightNature, purpose, pax, cargo, aircraft, aircraftType, seatCapacity, mtow, picName, picLicense, picPassport, picNationality, foName, foLicense, foPassport, crewCount, crew, actualStd, takeoff, landing, actualSta, blockTime, blockFuel, fuelUsed, fuelRemaining, delayCode, operatorName, operatorNameAr, operatorCode, operatorCountry, address, phone, fax, email, sita, contactPerson, preparedBy, handlingAgent, entryPoint, exitPoint, atsRoute, permitNo, permitsNotes, sectorsTableHtml, crewTableHtml.

Current Target Flight Data:
${JSON.stringify({
  flightNo: flightData.flightNo || '',
  date: flightData.date || flightData.stdDate || '',
  departure: flightData.dep || flightData.departure || '',
  arrival: flightData.arr || flightData.arrival || '',
  std: flightData.stdTime || flightData.std || '',
  sta: flightData.staTime || flightData.sta || '',
  aircraft: flightData.acft || flightData.aircraft || '',
  picName: flightData.picName || '',
  foName: flightData.foName || '',
  pax: flightData.pax ?? '',
  operatorName: flightData.operatorName || '',
})}

Recent Chat History:
${recentHistory || 'None'}

User Command:
"${cleanMsg}"

Return STRICT JSON ONLY with this schema:
{
  "assistantMessage": "Concise Arabic confirmation explaining exactly what commands were applied to the form",
  "commands": [
    // Supported command objects (omit unneeded properties):
    // 1) { "type": "update_meta", "title": "...", "category": "...", "authority": "...", "country": "...", "outputFormat": "original" | "html" }
    // 2) { "type": "add_field", "label": "...", "key": "...", "systemKey": "...", "value": "...", "align": "center", "fontSize": 10, "box": { "x": 160, "y": 500, "width": 140, "height": 20, "page": 0 } }
    // 3) { "type": "update_field", "target": "existing key or label or index", "label": "...", "systemKey": "...", "value": "...", "align": "center", "fontSize": 10, "box": { "x": 160, "y": 500, "width": 140, "height": 20, "page": 0 } }
    // 4) { "type": "remove_field", "target": "existing key or label or index" }
    // 5) { "type": "update_missing_field", "target": "key or label", "value": "..." }
    // 6) { "type": "set_html_template", "formattedHtml": "clean A4 HTML with {{systemKey}} placeholders" }
  ]
}
`;

          const contents: any[] = [];
          if (fileBase64 && (cleanMsg.includes('صورة') || cleanMsg.includes('نموذج') || cleanMsg.includes('مكان') || cleanMsg.includes('حقل') || compactFields.length < 4)) {
            const cleanBase64 = String(fileBase64).replace(/^data:[^;]+;base64,/, '');
            if (cleanBase64.length > 20) {
              contents.push({
                inlineData: {
                  mimeType: mimeType || 'image/png',
                  data: cleanBase64,
                },
              });
            }
          }
          contents.push({ text: prompt });

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              responseMimeType: 'application/json',
            },
          });

          const rawText = (response.text || '').trim();
          let parsedJson: any = null;
          try {
            parsedJson = JSON.parse(rawText);
          } catch {
            const m = rawText.match(/\{[\s\S]*\}/);
            if (m) parsedJson = JSON.parse(m[0]);
          }

          if (parsedJson && Array.isArray(parsedJson.commands)) {
            res.json({
              ok: true,
              source: 'gemini-ai',
              assistantMessage: parsedJson.assistantMessage || 'تم تطبيق الأمر على النموذج.',
              commands: parsedJson.commands,
            });
            return;
          }
        } catch (aiErr: any) {
          console.warn('Gemini form-chat fallback:', aiErr?.message);
        }
      }

      // Smart Heuristic Fallback Command Parser
      const commands: any[] = [];
      let assistantMessage = '';
      const lower = cleanMsg.toLowerCase();

      if (/عنوان|سمّي|غير اسم|اسم النموذج|title/i.test(cleanMsg)) {
        const quoted = cleanMsg.match(/["«']([^"»']+)["»']/);
        const afterColon = cleanMsg.split(/[:=]|إلى|الى/).pop()?.trim();
        const nextTitle = (quoted?.[1] || afterColon || '').trim();
        if (nextTitle && nextTitle.length >= 2 && nextTitle.length <= 120) {
          commands.push({ type: 'update_meta', title: nextTitle });
          assistantMessage = `تم تغيير عنوان النموذج إلى "${nextTitle}".`;
        }
      }

      if (/أضف|اضف|add/i.test(cleanMsg)) {
        const label = cleanMsg.replace(/^(أضف|اضف|add)\s*(حقل|field)?\s*/i, '').trim() || 'حقل جديد';
        const sysMatch =
          /رحلة|flight/i.test(label) ? 'flightNo'
          : /طائرة|تسجيل|aircraft/i.test(label) ? 'aircraft'
          : /كابتن|قائد|pic/i.test(label) ? 'picName'
          : /تاريخ|date/i.test(label) ? 'date'
          : /ركاب|pax/i.test(label) ? 'pax'
          : /وكيل|handling/i.test(label) ? 'handlingAgent'
          : '';
        commands.push({
          type: 'add_field',
          label,
          key: sysMatch || `field_${Date.now().toString(36)}`,
          systemKey: sysMatch,
          value: sysMatch ? String((flightData as any)[sysMatch] || '') : '',
          box: { x: 160, y: 420, width: 150, height: 20, page: 0 },
          fontSize: 10,
          align: 'center',
        });
        assistantMessage = `تمت إضافة الحقل "${label}"${sysMatch ? ` وربطه ببيانات النظام (${sysMatch})` : ''}.`;
      } else if (/احذف|امسح|delete|remove/i.test(cleanMsg)) {
        const target = cleanMsg.replace(/^(احذف|امسح|delete|remove)\s*(حقل|field)?\s*/i, '').trim();
        if (target) {
          commands.push({ type: 'remove_field', target });
          assistantMessage = `تم إرسال أمر حذف الحقل "${target}".`;
        }
      } else if (/html/i.test(lower)) {
        commands.push({ type: 'update_meta', outputFormat: 'html' });
        assistantMessage = 'تم تحويل صيغة الحفظ والمعاينة إلى نموذج HTML المنسق.';
      } else if (/pdf|أصلي|اصلي/i.test(cleanMsg)) {
        commands.push({ type: 'update_meta', outputFormat: 'original' });
        assistantMessage = 'تم تفعيل وضع التعبئة المباشرة فوق المستند الأصلي (PDF).';
      }

      if (commands.length === 0) {
        assistantMessage = 'لم أتمكن من تنفيذ هذا التعديل تلقائياً. جرب كتابة: "أضف حقل رقم التصريح"، أو "غير اسم النموذج إلى تصريح عبور"، أو "احذف حقل الشحن".';
      }

      res.json({
        ok: true,
        source: 'heuristic-engine',
        assistantMessage,
        commands,
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        error: err?.message || 'تعذر تنفيذ أمر المحادثة',
      });
    }
  });

  // Serve the company logo as a clean, same-origin PNG for Android Chrome, WebAPK, iOS, and PWA icons
  app.get(
    [
      '/api/app-logo.png',
      '/apple-touch-icon.png',
      '/pwa-192x192.png',
      '/pwa-512x512.png',
      '/pwa-maskable-512x512.png',
    ],
    async (req, res, next) => {
      try {
        const sizeParam = Number(req.query.size);
        const targetSize =
          sizeParam === 192 || req.path.includes('192') ? 192 : 512;
        const pngBuf = await getCompanyLogoPng(targetSize);
        if (pngBuf && pngBuf.length > 50) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader(
            'Cache-Control',
            'public, max-age=86400, stale-while-revalidate=604800'
          );
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(pngBuf);
          return;
        }
      } catch (e) {
        // Fallback to static public assets
      }
      next();
    }
  );

  // Dynamic PWA manifest route (handles both /manifest.json and /api/manifest.json)
  app.get(['/api/manifest.json', '/manifest.json'], async (_req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${API_URL}?sheet=Settings`, {
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      const text = await response.text();
      const result = text.trim().startsWith('{') ? JSON.parse(text) : {};
      const settings =
        result?.ok && Array.isArray(result.data) && result.data[0]
          ? result.data[0]
          : {};

      const companyName = String(settings.companyName || '').trim();
      const companyNameAr = String(settings.companyNameAr || '').trim();
      const operatorCode = String(settings.operatorCode || '').trim().toUpperCase();

      // Construct app name with Operator Code & Company Names (No AeroOps default)
      const baseTitle = companyName || companyNameAr || 'Flight Operations';
      const appName = operatorCode ? `${baseTitle} (${operatorCode})` : baseTitle;

      // Short Name: Operator Code or short company name (<= 12 chars)
      let shortName = operatorCode || companyName || companyNameAr || 'Flight Ops';
      if (shortName.length > 12) {
        shortName = operatorCode || shortName.slice(0, 12).trim();
      }

      // Always point to same-origin PNG icons so Android WebAPK minting and Chrome install ALWAYS succeed
      const icons = [
        {
          src: '/api/app-logo.png?size=192',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/api/app-logo.png?size=512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/api/app-logo.png?size=512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
      ];

      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.json({
        id: '/',
        name: appName,
        short_name: shortName,
        description: `${appName} — Flight Operations Management System.`,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#1e40af',
        icons,
      });
    } catch {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.sendFile(path.join(__dirname, 'public/manifest.json'));
    }
  });

  // Serve pdfjs-dist worker, cmaps & standard_fonts cleanly without Vite ?import rewriting
  const pdfjsDistDir = path.join(__dirname, 'node_modules/pdfjs-dist');
  app.get('/api/pdfjs/pdf.worker.min.mjs', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(pdfjsDistDir, 'legacy/build/pdf.worker.min.mjs'));
  });
  app.use(
    '/api/pdfjs/cmaps',
    express.static(path.join(pdfjsDistDir, 'cmaps'), { maxAge: '1d' })
  );
  app.use(
    '/api/pdfjs/standard_fonts',
    express.static(path.join(pdfjsDistDir, 'standard_fonts'), { maxAge: '1d' })
  );

  const distPath = path.join(__dirname, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
