import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { FirebaseProvider } from "./contexts/FirebaseProvider";
import "./index.css";

export function registerAppServiceWorker() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const doRegister = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("AeroOps ServiceWorker active for Lock Screen notifications:", reg.scope);
        })
        .catch((err) => {
          console.warn("ServiceWorker registration skipped or unsupported:", err);
        });
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      doRegister();
    } else {
      window.addEventListener("load", doRegister);
    }
  }
}

registerAppServiceWorker();

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : String(error || "Unknown error"),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("Application ErrorBoundary caught:", error, info);
  }

  handleRecover = () => {
    try {
      window.localStorage.removeItem("aeroops.tab");
      window.localStorage.removeItem("aeroops.settingsCache");
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4 text-center">
            <h1 className="text-lg font-bold">تعذّر تحميل الواجهة مؤقتاً</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              حدث خطأ غير متوقع أثناء تشغيل الواجهة. يمكنك إعادة تحميل النظام وتنظيف
              الذاكرة المؤقتة مباشرة.
            </p>
            {this.state.errorMessage && (
              <pre
                dir="ltr"
                className="text-[11px] font-mono text-rose-400 bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-x-auto text-left"
              >
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleRecover}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              إعادة تشغيل النظام الآن
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    </AppErrorBoundary>
  </StrictMode>
);
