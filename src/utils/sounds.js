/* ═══════════════════════════════════════════════════════════
 * SOUNDS — أصوات التنبيه
 * Web Audio API — لا يحتاج ملفات صوتية
 * ═══════════════════════════════════════════════════════════ */

let audioContext = null;
let enabled = true;
let volume = 0.5;
let alertSoundsEnabled = true;

/* ⭐ Initialize AudioContext */
function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioContext = new AudioCtx();
    } catch (e) {
      console.warn("AudioContext not supported");
    }
  }

  /* ⭐ Resume if suspended */
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

/* ⭐ Unlock Audio (يُستدعى عند أول تفاعل) */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => {
        console.log("🔊 Audio unlocked");
      })
      .catch((e) => {
        console.warn("Audio unlock failed:", e);
      });
  }
}

/* ⭐ Enable / Disable (عام) */
export function setSoundsEnabled(value) {
  enabled = !!value;
}

export function isSoundsEnabled() {
  return enabled;
}

/* ⭐ Enable / Disable (أصوات التنبيه) */
export function setAlertSoundsEnabled(value) {
  alertSoundsEnabled = !!value;
}

export function isAlertSoundsEnabled() {
  return alertSoundsEnabled;
}

/* ⭐ Volume */
export function setSoundsVolume(value) {
  volume = Math.max(0, Math.min(1, value));
}

export function getSoundsVolume() {
  return volume;
}

/* ⭐ Play simple tone */
function playTone(frequency, duration, type = "sine", when = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  /* ⭐ Resume if suspended */
  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

/* ═══════════════════════════════════════════════════════════
 * BASIC SOUNDS
 * ═══════════════════════════════════════════════════════════ */

export function playSuccess() {
  if (!enabled) return;
  playTone(523.25, 0.15, "sine", 0);
  playTone(783.99, 0.25, "sine", 0.12);
}

export function playError() {
  if (!enabled) return;
  playTone(329.63, 0.15, "sawtooth", 0);
  playTone(220.0, 0.25, "sawtooth", 0.12);
}

export function playWarning() {
  if (!enabled) return;
  playTone(587.33, 0.2, "triangle", 0);
}

export function playClick() {
  if (!enabled) return;
  playTone(800, 0.05, "sine", 0);
}

export function playNotification() {
  if (!enabled) return;
  playTone(659.25, 0.12, "sine", 0);
  playTone(783.99, 0.12, "sine", 0.13);
  playTone(1046.5, 0.18, "sine", 0.26);
}

export function playAlarm() {
  if (!enabled) return;
  playTone(880, 0.15, "square", 0);
  playTone(880, 0.15, "square", 0.2);
  playTone(880, 0.15, "square", 0.4);
  playTone(880, 0.15, "square", 0.6);
}

/* ═══════════════════════════════════════════════════════════
 * ALERT SOUNDS
 * ═══════════════════════════════════════════════════════════ */

export function alertSuccess() {
  if (!alertSoundsEnabled) return;
  playSuccess();
}

export function alertError() {
  if (!alertSoundsEnabled) return;
  playError();
}

export function alertWarning() {
  if (!alertSoundsEnabled) return;
  playWarning();
}

export function alertNotification() {
  if (!alertSoundsEnabled) return;
  playNotification();
}

export function alertDanger() {
  if (!alertSoundsEnabled) return;
  playAlarm();
}

export function testSound() {
  const wasEnabled = enabled;
  enabled = true;
  playNotification();
  enabled = wasEnabled;
}

/* ⭐ Available sounds */
export const SOUND_TYPES = [
  {
    key: "success",
    label_en: "Success",
    label_ar: "نجاح",
    icon: "✅",
    play: playSuccess,
  },
  {
    key: "error",
    label_en: "Error",
    label_ar: "خطأ",
    icon: "❌",
    play: playError,
  },
  {
    key: "warning",
    label_en: "Warning",
    label_ar: "تحذير",
    icon: "⚠️",
    play: playWarning,
  },
  {
    key: "notification",
    label_en: "Notification",
    label_ar: "إشعار",
    icon: "🔔",
    play: playNotification,
  },
  {
    key: "click",
    label_en: "Click",
    label_ar: "نقرة",
    icon: "🖱️",
    play: playClick,
  },
  {
    key: "alarm",
    label_en: "Alarm",
    label_ar: "إنذار",
    icon: "🚨",
    play: playAlarm,
  },
];

/* ⭐ Global listener — unlock on first interaction */
if (typeof window !== "undefined") {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}
