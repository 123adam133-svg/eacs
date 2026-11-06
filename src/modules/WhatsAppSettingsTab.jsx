import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  Save,
  Cloud,
  CheckCircle2,
  Send,
  Key,
  Phone,
  LogIn,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseProvider';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { showToast } from '../utils/dialog';
import {
  getWhatsAppSettings,
  saveWhatsAppSettings,
  formatFlightWhatsAppTemplate,
  sendWhatsAppMessage,
  DEFAULT_WHATSAPP_SETTINGS,
} from '../utils/whatsapp';

export function WhatsAppSettingsTab() {
  const { firebaseUser, authReady, signInWithGoogle } = useFirebase();
  const lang = document.documentElement.lang || 'en';

  const [form, setForm] = useState(DEFAULT_WHATSAPP_SETTINGS);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    setLoading(true);
    getWhatsAppSettings()
      .then((res) => {
        if (!active || !res) return;
        setForm({
          whatsappPhoneNumber: res.whatsappPhoneNumber || '',
          phoneNumberId: res.phoneNumberId || '',
          whatsappApiKey: res.whatsappApiKey || '',
          provider: res.provider || 'apps_script',
          autoNotifyFlights: Boolean(res.autoNotifyFlights),
        });
        setCloudSynced(Boolean(res.cloudSynced));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authReady, firebaseUser?.uid]);

  const samplePreview = useMemo(
    () =>
      formatFlightWhatsAppTemplate(
        {
          flightNo: 'EA104',
          dep: 'HLLM',
          arr: 'LTBA',
          acft: '5A-EAC',
          std: new Date(Date.now() + 3600 * 1000 * 4).toISOString(),
          sta: new Date(Date.now() + 3600 * 1000 * 7).toISOString(),
          status: 'SCHEDULED',
        },
        { fullName: 'Capt. Ahmed' },
        'ASSIGNED'
      ),
    []
  );

  const handleConnectGoogle = async () => {
    try {
      const fbUser = await signInWithGoogle();
      if (fbUser?.cloudSyncDisabled) {
        showToast('⚠️ ' + fbUser.cloudSyncReason, 'warning');
        return;
      }
      showToast(
        lang === 'ar'
          ? '✅ تم ربط حساب Google للمزامنة السحابية'
          : '✅ Connected Google account for Cloud Firestore sync'
      );
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        showToast(
          (lang === 'ar' ? '❌ تعذر تسجيل الدخول: ' : '❌ Sign-in cancelled: ') +
            (e?.message || '')
        );
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveWhatsAppSettings(form);
      setCloudSynced(Boolean(result?.savedCloud));
      showToast(
        result?.savedCloud
          ? lang === 'ar'
            ? '✅ تم حفظ إعدادات واتساب في السحابة بنجاح'
            : '✅ WhatsApp settings saved to Cloud Firestore'
          : lang === 'ar'
          ? '✅ تم حفظ إعدادات واتساب محلياً'
          : '✅ WhatsApp settings saved locally'
      );
    } catch (e) {
      let friendly = e?.message || 'Save failed';
      try {
        const parsed = JSON.parse(friendly);
        if (parsed?.error) friendly = parsed.error;
      } catch {}
      showToast('❌ ' + friendly, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      showToast(
        lang === 'ar'
          ? '⚠️ أدخل رقم الهاتف للاختبار أولاً'
          : '⚠️ Enter a recipient phone number first'
      );
      return;
    }
    setTesting(true);
    try {
      const res = await sendWhatsAppMessage(testPhone, samplePreview, form);
      if (res?.waUrl) {
        showToast(
          lang === 'ar'
            ? '✅ تم تجهيز رابط واتساب المباشر'
            : '✅ Direct WhatsApp link prepared'
        );
      } else {
        showToast(
          lang === 'ar'
            ? '✅ تم إرسال رسالة الاختبار بنجاح'
            : '✅ Test WhatsApp template sent'
        );
      }
    } catch (e) {
      showToast('❌ ' + (e?.message || 'Test failed'), 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: 'var(--brand-primary)',
            borderTopColor: 'transparent',
          }}
        />
      </div>
    );
  }

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header Banner */}
      <div className="rounded-2xl p-4 text-white bg-gradient-to-r from-emerald-600 to-green-700 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {lang === 'ar'
                ? 'إعدادات الربط مع واتساب للأعمال'
                : 'WhatsApp Business Integration'}
            </h3>
            <p className="text-xs text-emerald-100">
              {lang === 'ar'
                ? 'ربط مفتاح API ورقم الهاتف وتفعيل إشعارات الجدول التلقائية'
                : 'Configure Business API credentials and automated flight schedule templates'}
            </p>
          </div>
        </div>

        {firebaseUser ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>
              {cloudSynced ? 'Cloud Synced' : firebaseUser.email}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnectGoogle}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-emerald-800 text-xs font-bold shadow hover:bg-emerald-50 transition"
          >
            <LogIn className="w-4 h-4" />
            {lang === 'ar'
              ? 'ربط Google للحفظ السحابي'
              : 'Connect Google for Cloud Sync'}
          </button>
        )}
      </div>

      {/* Credentials Form */}
      <section className="p-5 rounded-2xl space-y-4" style={cardStyle}>
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label={
              lang === 'ar' ? 'مزود خدمة الإرسال' : 'Delivery Provider'
            }
          >
            <Select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
            >
              <option value="cloud_api">
                Meta WhatsApp Cloud API (Official)
              </option>
              <option value="apps_script">
                Google Apps Script / Twilio Relay
              </option>
              <option value="wa_link">
                WhatsApp Direct Link (wa.me)
              </option>
            </Select>
          </Field>

          <Field
            label={
              lang === 'ar'
                ? 'رقم هاتف واتساب للأعمال'
                : 'Business Phone Number (E.164)'
            }
          >
            <div className="relative">
              <Phone
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <Input
                value={form.whatsappPhoneNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    whatsappPhoneNumber: e.target.value.slice(0, 32),
                  })
                }
                placeholder="+218910000000"
                className="ps-9 font-mono"
              />
            </div>
          </Field>

          {form.provider === 'cloud_api' && (
            <Field
              label={
                lang === 'ar'
                  ? 'معرّف رقم الهاتف (Phone Number ID)'
                  : 'Meta Phone Number ID'
              }
            >
              <Input
                value={form.phoneNumberId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phoneNumberId: e.target.value.slice(0, 64),
                  })
                }
                placeholder="109876543210123"
                className="font-mono"
              />
            </Field>
          )}

          <Field
            label={
              lang === 'ar'
                ? 'مفتاح الوصول (WhatsApp Business API Key / Token)'
                : 'WhatsApp Business API Key / Access Token'
            }
            span={form.provider !== 'cloud_api'}
          >
            <div className="relative">
              <Key
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <Input
                type={showKey ? 'text' : 'password'}
                value={form.whatsappApiKey}
                onChange={(e) =>
                  setForm({
                    ...form,
                    whatsappApiKey: e.target.value.slice(0, 512),
                  })
                }
                placeholder="EAAG..."
                className="ps-9 pe-9 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute top-1/2 -translate-y-1/2 end-3"
                style={{ color: 'var(--text-muted)' }}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>
        </div>

        {/* Auto-trigger toggle */}
        <div
          className="flex items-center justify-between p-3.5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div>
            <div
              className="text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {lang === 'ar'
                ? 'إرسال قالب واتساب تلقائياً عند تعيين أو تعديل رحلة'
                : 'Auto-trigger Flight Schedule WhatsApp Templates'}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ar'
                ? 'يُرسل إشعاراً فورياً لأفراد الطاقم المعينين عند إنشاء أو تحديث رحلة في الجدول'
                : 'Automatically dispatches flight details to assigned crew members on flight create/update'}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setForm((f) => ({ ...f, autoNotifyFlights: !f.autoNotifyFlights }))
            }
            className="relative w-14 h-8 rounded-full transition flex-shrink-0"
            style={{
              backgroundColor: form.autoNotifyFlights
                ? '#16a34a'
                : 'var(--border-default)',
            }}
          >
            <span
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform"
              style={{
                transform: form.autoNotifyFlights
                  ? 'translateX(28px)'
                  : 'translateX(4px)',
              }}
            />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
        >
          {firebaseUser ? (
            <Cloud className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving
            ? '…'
            : lang === 'ar'
            ? 'حفظ إعدادات واتساب'
            : 'Save WhatsApp Configuration'}
        </button>
      </section>

      {/* Template Preview & Test */}
      <section className="p-5 rounded-2xl space-y-3" style={cardStyle}>
        <h4
          className="text-sm font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {lang === 'ar'
            ? 'معاينة واختبار قالب تحديث جدول الرحلات'
            : 'Flight Schedule Template Preview & Test'}
        </h4>

        <pre
          className="p-3 rounded-xl text-xs whitespace-pre-wrap font-sans leading-relaxed"
          style={{
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          {samplePreview}
        </pre>

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]">
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'رقم المستلم للاختبار (+218...)'
                  : 'Test recipient phone (+218...)'
              }
              className="font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {testing
              ? '…'
              : lang === 'ar'
              ? 'إرسال رسالة تجريبية'
              : 'Send Test Template'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default WhatsAppSettingsTab;
