/* ═══════════════════════════════════════════════════════════
 * SOUND NOTIFICATIONS — Global sound alerts
 * ═══════════════════════════════════════════════════════════ */
import { useEffect } from "react";
import { useSounds } from "../hooks/useSounds";
import {
  alertSuccess,
  alertError,
  alertWarning,
  alertNotification,
  alertDanger,
} from "../utils/sounds";

export function SoundNotifications() {
  /* ⭐ Sync sounds settings مع الوحدة */
  useSounds();

  useEffect(() => {
    const onSuccess = () => alertSuccess();
    const onError = () => alertError();
    const onWarning = () => alertWarning();
    const onNotification = () => alertNotification();
    const onDanger = () => alertDanger();

    window.addEventListener("app:sound:success", onSuccess);
    window.addEventListener("app:sound:error", onError);
    window.addEventListener("app:sound:warning", onWarning);
    window.addEventListener("app:sound:notification", onNotification);
    window.addEventListener("app:sound:danger", onDanger);

    return () => {
      window.removeEventListener("app:sound:success", onSuccess);
      window.removeEventListener("app:sound:error", onError);
      window.removeEventListener("app:sound:warning", onWarning);
      window.removeEventListener("app:sound:notification", onNotification);
      window.removeEventListener("app:sound:danger", onDanger);
    };
  }, []);

  return null;
}

/* ⭐ Helpers للاستدعاء من أي مكان */
export const sound = {
  success: () => window.dispatchEvent(new Event("app:sound:success")),
  error: () => window.dispatchEvent(new Event("app:sound:error")),
  warning: () => window.dispatchEvent(new Event("app:sound:warning")),
  notification: () => window.dispatchEvent(new Event("app:sound:notification")),
  danger: () => window.dispatchEvent(new Event("app:sound:danger")),
};

export default SoundNotifications;
