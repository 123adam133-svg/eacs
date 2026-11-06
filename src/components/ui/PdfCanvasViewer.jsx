/* ═══════════════════════════════════════════════════════════
 * PDF CANVAS VIEWER — Canvas-based PDF Renderer
 * ═══════════════════════════════════════════════════════════
 * Renders PDF documents onto HTML5 Canvas elements using pdfjs-dist.
 * Bypasses Chrome iframe restrictions ("This page has been blocked by Chrome")
 * and works safely inside embedded preview modals, iframes, and mobile browsers.
 * Safe against ArrayBuffer detachment & render cancellations.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ZoomIn,
  ZoomOut,
  Printer,
  Download,
  RotateCw,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Minimize2,
} from "lucide-react";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Normalizes input source into a format pdfjsLib can load.
 * Deep-clones ArrayBuffers so worker transfer never detaches the caller's array.
 */
async function loadPdfDocument(source) {
  if (!source) throw new Error("لا يوجد ملف PDF للعرض");

  // Uint8Array or ArrayBuffer
  if (source instanceof Uint8Array || source instanceof ArrayBuffer) {
    const srcBytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    if (srcBytes.byteLength === 0 || srcBytes.buffer?.detached) {
      throw new Error("بيانات المستند غير متاحة (Buffer detached) — يرجى إعادة تحديث المعاينة");
    }
    // Deep clone into a new ArrayBuffer so worker postMessage transfer won't detach caller's buffer
    const clonedData = new Uint8Array(srcBytes.byteLength);
    clonedData.set(srcBytes);

    return pdfjsLib.getDocument({
      data: clonedData,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
    }).promise;
  }

  // Blob
  if (source instanceof Blob) {
    const buffer = await source.arrayBuffer();
    return pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
      cMapPacked: true,
    }).promise;
  }

  // Data URL or String URL
  if (typeof source === "string") {
    const trimmed = source.trim();

    // Data URL (data:application/pdf;base64,...)
    if (trimmed.startsWith("data:")) {
      const base64Parts = trimmed.split(",");
      const base64Str = base64Parts[1] || base64Parts[0];
      const binaryStr = atob(base64Str);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return pdfjsLib.getDocument({
        data: bytes,
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
        cMapPacked: true,
      }).promise;
    }

    // Blob URL or regular HTTP URL
    if (trimmed.startsWith("blob:") || trimmed.startsWith("http") || trimmed.startsWith("/")) {
      const res = await fetch(trimmed);
      if (!res.ok) throw new Error(`تعذر تحميل الملف (رمز الاستجابة ${res.status})`);
      const buffer = await res.arrayBuffer();
      return pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
        cMapPacked: true,
      }).promise;
    }
  }

  throw new Error("صيغة مصدر PDF غير مدعومة");
}

export function PdfCanvasViewer({
  pdfData,
  title = "PDF Document",
  fileName = "document.pdf",
  className = "",
  style = {},
  showToolbar = true,
  onPrint = null,
  onDownload = null,
  maxHeight = "100%",
}) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [rotation, setRotation] = useState(0);
  const [pageBaseSize, setPageBaseSize] = useState({ width: 595, height: 842 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const containerRef = useRef(null);

  // Load PDF document from source with cancellation support
  const loadPdf = useCallback(async (cancelledRef) => {
    if (!pdfData) return;
    setLoading(true);
    setError("");
    try {
      const doc = await loadPdfDocument(pdfData);
      if (cancelledRef.current) {
        try { doc.destroy(); } catch {}
        return;
      }
      setPdfDoc((prevDoc) => {
        if (prevDoc && prevDoc !== doc) {
          try { prevDoc.destroy(); } catch {}
        }
        return doc;
      });
      setNumPages(doc.numPages);
      try {
        const firstPage = await doc.getPage(1);
        const vp = firstPage.getViewport({ scale: 1, rotation: 0 });
        setPageBaseSize({ width: vp.width, height: vp.height });
      } catch {}
    } catch (err) {
      if (!cancelledRef.current) {
        console.error("PdfCanvasViewer error:", err);
        setError(err.message || "فشل عرض ملف PDF");
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [pdfData]);

  // Fit Width handler
  const handleFitWidth = useCallback(() => {
    if (!containerRef.current || !pageBaseSize.width) return;
    const padding = 64;
    const avail = containerRef.current.clientWidth - padding;
    if (avail > 100) {
      const newScale = Math.max(0.4, Math.min(3.0, avail / pageBaseSize.width));
      setScale(Number(newScale.toFixed(2)));
    }
  }, [pageBaseSize]);

  // Fit Page handler
  const handleFitPage = useCallback(() => {
    if (!containerRef.current || !pageBaseSize.width || !pageBaseSize.height) return;
    const availW = containerRef.current.clientWidth - 64;
    const availH = containerRef.current.clientHeight - 100;
    if (availW > 100 && availH > 100) {
      const sW = availW / pageBaseSize.width;
      const sH = availH / pageBaseSize.height;
      const newScale = Math.max(0.4, Math.min(3.0, Math.min(sW, sH)));
      setScale(Number(newScale.toFixed(2)));
    }
  }, [pageBaseSize]);

  // Support Ctrl + MouseWheel to zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        setScale((s) => Math.max(0.4, Math.min(3.0, Number((s + delta).toFixed(2)))));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadPdf(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadPdf]);

  // Clean up doc on unmount
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
    };
  }, [pdfDoc]);

  // Render individual page onto a canvas with cancel callback
  const renderPage = useCallback(
    async (pageNumber, canvas, onTaskCreated) => {
      if (!pdfDoc || !canvas) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale, rotation });
        const ctx = canvas.getContext("2d");

        // Handle high DPI / retina displays
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        if (typeof onTaskCreated === "function") {
          onTaskCreated(renderTask);
        }

        await renderTask.promise;
      } catch (e) {
        if (e?.name !== "RenderingCancelledException") {
          console.warn(`Error rendering PDF page ${pageNumber}:`, e);
        }
      }
    },
    [pdfDoc, scale, rotation]
  );

  // Default print handler
  const handlePrint = () => {
    if (typeof onPrint === "function") {
      onPrint();
      return;
    }
    window.print();
  };

  // Default download handler
  const handleDownload = async () => {
    if (typeof onDownload === "function") {
      onDownload();
      return;
    }
    try {
      let blob;
      if (pdfData instanceof Blob) {
        blob = pdfData;
      } else if (pdfData instanceof Uint8Array || pdfData instanceof ArrayBuffer) {
        blob = new Blob([pdfData], { type: "application/pdf" });
      } else if (typeof pdfData === "string" && pdfData.startsWith("blob:")) {
        const res = await fetch(pdfData);
        blob = await res.blob();
      } else if (typeof pdfData === "string" && pdfData.startsWith("data:")) {
        const base64 = pdfData.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: "application/pdf" });
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || "document.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden border bg-slate-900 text-slate-100 ${className}`}
      style={{
        height: maxHeight,
        borderColor: "var(--border-default)",
        ...style,
      }}
    >
      {/* Viewer Toolbar */}
      {showToolbar && (
        <div
          className="px-3 py-2 bg-slate-800/90 backdrop-blur-md border-b border-slate-700 flex items-center justify-between flex-wrap gap-2 text-xs font-semibold shrink-0 z-10"
        >
          {/* Document Title / Page Stats */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-200 truncate max-w-[200px] sm:max-w-[300px]">
              {title}
            </span>
            {numPages > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[11px] font-mono tabular-nums shrink-0">
                {numPages} {numPages === 1 ? "صفحة" : "صفحات"}
              </span>
            )}
          </div>

          {/* Controls Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-900/80 rounded-lg border border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.15).toFixed(2))))}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="تصغير (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScale(1.0)}
                className="px-2 font-mono text-[11px] text-slate-300 hover:text-white hover:bg-slate-700/60 rounded py-0.5 min-w-[46px] text-center transition"
                title="إعادة الضبط إلى 100% (Reset Zoom)"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.15).toFixed(2))))}
                className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="تكبير (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Fit Width */}
            <button
              type="button"
              onClick={handleFitWidth}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
              title="ملائمة العرض (Fit Width)"
            >
              <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xl:inline text-[11px]">ملائمة العرض</span>
            </button>

            {/* Fit Page */}
            <button
              type="button"
              onClick={handleFitPage}
              className="px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
              title="ملائمة الصفحة (Fit Page)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xl:inline text-[11px]">ملائمة الصفحة</span>
            </button>

            {/* Rotate */}
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="تدوير الصفحات"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Print & Download */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm"
              title="طباعة"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1 transition"
              title="تحميل PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تحميل</span>
            </button>
          </div>
        </div>
      )}

      {/* Pages Container — Scrollable in all directions with generous bottom padding */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 md:p-8 bg-slate-950/95 scroll-smooth relative select-none"
        tabIndex={0}
      >
        {loading ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
            <span className="text-xs font-semibold">جاري تجهيز ومعاينة المستند...</span>
          </div>
        ) : error ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-rose-400 max-w-md">{error}</div>
            <button
              type="button"
              onClick={() => {
                const cancelledRef = { current: false };
                loadPdf(cancelledRef);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center gap-2 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="min-w-fit min-h-fit mx-auto flex flex-col items-center gap-8 pb-32 pt-2">
            {Array.from({ length: numPages }, (_, idx) => {
              const pageNum = idx + 1;
              return (
                <div
                  key={pageNum}
                  className="relative group shadow-2xl rounded-sm overflow-visible bg-white shrink-0 transition-transform"
                >
                  {/* Page Number Label */}
                  <span className="absolute top-2 start-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono font-bold z-10 pointer-events-none opacity-60 group-hover:opacity-100 transition shadow">
                    صفحة {pageNum} من {numPages}
                  </span>

                  <PageCanvas
                    pageNum={pageNum}
                    renderPage={renderPage}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual Page Canvas Component with render cancellation management
 */
function PageCanvas({ pageNum, renderPage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let active = true;
    let currentRenderTask = null;

    if (canvasRef.current) {
      renderPage(pageNum, canvasRef.current, (task) => {
        if (!active) {
          try { task.cancel(); } catch {}
        } else {
          currentRenderTask = task;
        }
      });
    }

    return () => {
      active = false;
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch {}
      }
    };
  }, [pageNum, renderPage]);

  return <canvas ref={canvasRef} className="block shadow-2xl rounded-xs" />;
}

export default PdfCanvasViewer;
