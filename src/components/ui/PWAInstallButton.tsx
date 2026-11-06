import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { toDisplayImageUrl } from "../../api";

interface PWAInstallButtonProps {
  settings?: any;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ settings }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const logoUrl = toDisplayImageUrl(settings?.logo);
  const operatorCode = (settings?.operatorCode || "").toUpperCase().trim();
  const companyTitle = settings?.companyName || settings?.companyNameAr || "Flight Operations";
  const appDisplayName = operatorCode ? `${companyTitle} (${operatorCode})` : companyTitle;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:opacity-90 shrink-0"
        style={{ background: "var(--brand-gradient)" }}
        title={`Install ${appDisplayName}`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="w-4 h-4 object-contain rounded-sm bg-white/20 p-0.5" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">
          {operatorCode ? `Install ${operatorCode}` : "Install"}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition shrink-0"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-app)",
          }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="w-4 h-4 object-contain" />
          ) : (
            <Smartphone className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">iOS App</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[980] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border text-center"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
                  ) : null}
                  <h3 className="text-sm font-bold">Install {appDisplayName}</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p
                className="text-xs leading-relaxed text-start"
                style={{ color: "var(--text-muted)" }}
              >
                1. Tap the <strong>Share</strong> button in Safari toolbar.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                3. The app icon will match your official system logo.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg py-2 text-xs font-bold text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export default PWAInstallButton;
