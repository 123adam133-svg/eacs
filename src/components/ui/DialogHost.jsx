import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Printer,
  Download,
} from "lucide-react";
import { subscribeDialogEvents, printHTMLContent } from "../../utils/dialog";
import { toPreviewFileUrl, toDownloadFileUrl } from "../../api";
import { PdfCanvasViewer } from "./PdfCanvasViewer";

export function DialogHost() {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const [previewState, setPreviewState] = useState(null);

  useEffect(() => {
    return subscribeDialogEvents((ev) => {
      if (ev.kind === "toast") {
        setToasts((prev) => [...prev.slice(-4), ev]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== ev.id));
        }, 4200);
      } else if (ev.kind === "confirm") {
        setConfirmState(ev);
      } else if (ev.kind === "preview") {
        setPreviewState(ev);
      }
    });
  }, []);

  const handleConfirmChoice = (accepted) => {
    if (confirmState?.resolve) confirmState.resolve(accepted);
    setConfirmState(null);
  };

  const closePreview = () => {
    if (previewState?.blobUrl && String(previewState.blobUrl).startsWith("blob:")) {
      const urlToRevoke = previewState.blobUrl;
      setTimeout(() => URL.revokeObjectURL(urlToRevoke), 2000);
    }
    setPreviewState(null);
  };

  const lang =
    typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";
  const isRTL = lang === "ar";

  return (
    <>
      {/* Floating Toasts */}
      <div className="fixed bottom-4 end-4 z-[999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const styles =
            t.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500"
              : t.type === "error"
              ? "bg-rose-600 text-white border-rose-500"
              : t.type === "warning"
              ? "bg-amber-500 text-white border-amber-400"
              : "bg-slate-800 text-white border-slate-700";

          const Icon =
            t.type === "success"
              ? CheckCircle2
              : t.type === "error"
              ? AlertCircle
              : t.type === "warning"
              ? AlertTriangle
              : Info;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-xs font-semibold fade-in ${styles}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 whitespace-pre-line leading-relaxed">
                {t.message}
              </div>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }
                className="p-0.5 rounded hover:bg-white/20 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[990] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 fade-in"
          onClick={() => handleConfirmChoice(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl border"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base">
                  {confirmState.title ||
                    (isRTL ? "تأكيد الإجراء" : "Confirm Action")}
                </h3>
                <p
                  className="text-sm mt-1 whitespace-pre-line leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleConfirmChoice(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold border transition hover:opacity-80"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                {isRTL ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={() => handleConfirmChoice(true)}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                style={{ background: "var(--brand-gradient)" }}
              >
                {isRTL ? "تأكيد" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Document / PDF Preview Modal */}
      {previewState && (() => {
        const previewUrl = toPreviewFileUrl(
          previewState.blobUrl,
          previewState.fileName
        );
        const downloadUrl = toDownloadFileUrl(
          previewState.blobUrl,
          previewState.fileName
        );
        const isImage =
          /\.(png|jpe?g|webp|gif|svg)$/i.test(previewState.fileName || "") ||
          String(previewState.blobUrl || "").startsWith("data:image/");

        return (
          <div
            className="fixed inset-0 z-[985] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 fade-in"
            onClick={closePreview}
          >
            <div
              className="w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-default)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-4 py-3 flex items-center justify-between text-white"
                style={{ background: "var(--brand-gradient)" }}
              >
                <span className="font-bold text-sm truncate">
                  {previewState.title}
                </span>
                <div className="flex items-center gap-2">
                  {previewState.html && (
                    <button
                      onClick={() =>
                        printHTMLContent(previewState.html, previewState.title)
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {isRTL ? "طباعة" : "Print"}
                    </button>
                  )}
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      download={previewState.fileName || "document.pdf"}
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isRTL ? "تحميل الملف" : "Download"}
                    </a>
                  )}
                  <button
                    onClick={closePreview}
                    className="p-1.5 rounded-lg hover:bg-white/20 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-200 dark:bg-slate-900 overflow-auto">
                {previewState.html ? (
                  <iframe
                    title={previewState.title}
                    srcDoc={previewState.html}
                    className="w-full h-full border-0 bg-white"
                  />
                ) : previewUrl && isImage ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img
                      src={previewUrl}
                      alt={previewState.title}
                      className="max-w-full max-h-full object-contain rounded shadow"
                    />
                  </div>
                ) : previewState.blobUrl || previewUrl ? (
                  <PdfCanvasViewer
                    pdfData={previewState.blobUrl || previewUrl}
                    title={previewState.title}
                    fileName={previewState.fileName || "document.pdf"}
                    showToolbar={false}
                    maxHeight="100%"
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center gap-2">
                    <AlertTriangle className="w-10 h-10 text-amber-500" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {isRTL
                        ? "تعذر عرض الملف — يرجى إعادة رفعه وحفظه في Google Drive."
                        : "Unable to preview file — please re-upload and save it to Google Drive."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default DialogHost;
