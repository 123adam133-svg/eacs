/* ═══════════════════════════════════════════════════════════
 * IFRAME-SAFE DIALOG, TOAST & PRINT HELPERS
 * Replaces window.alert, window.confirm, and window.open
 * ═══════════════════════════════════════════════════════════ */

const listeners = new Set();

export function subscribeDialogEvents(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(payload) {
  queueMicrotask(() => {
    listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error("Dialog event dispatch error:", e);
      }
    });
  });
}

export function showToast(message, explicitType) {
  if (!message) return;
  const text = String(message);
  let type = explicitType || "info";
  if (!explicitType) {
    if (text.includes("✅") || /success|تم |بنجاح|saved/i.test(text)) {
      type = "success";
    } else if (text.includes("❌") || /fail|error|فشل|خطأ/i.test(text)) {
      type = "error";
    } else if (text.includes("⚠️") || /warn|ليس لديك|تنبيه/i.test(text)) {
      type = "warning";
    }
  }
  emit({
    kind: "toast",
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    message: text,
    type,
  });
}

export function confirmAction(message, title = "") {
  return new Promise((resolve) => {
    emit({
      kind: "confirm",
      id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      message: String(message || ""),
      resolve,
    });
  });
}

export function openPreviewModal({ title = "Document Preview", html = "", blobUrl = "", fileName = "" }) {
  emit({
    kind: "preview",
    title,
    html,
    blobUrl,
    fileName,
  });
}

export function printHTMLContent(fullHtml, docTitle = "Flight Operations Document") {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(fullHtml);
  doc.close();
  doc.title = docTitle;

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch (err) {
      console.error("Print error:", err);
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 3000);
    }
  };

  setTimeout(triggerPrint, 650);
}
