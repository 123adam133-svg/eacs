/* ═══════════════════════════════════════════════════════════
 * ATTACHMENTS EDITOR Component
 * Upload + edit + preview + manage documents with expiry tracking
 * v3.0 — Supports replacing file during edit, normalized IDs & iframe preview
 * ═══════════════════════════════════════════════════════════ */
import React, { useRef, useState } from "react";
import {
  Eye,
  Download,
  Trash2,
  Upload,
  Plus,
  Image as ImageIcon,
  FileText,
  Paperclip,
  Edit,
  Save,
  X,
  Calendar,
} from "lucide-react";
import { uploadFile, toPreviewFileUrl, toDownloadFileUrl } from "../api";
import { useT } from "../contexts";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";
import { showToast, confirmAction, openPreviewModal } from "../utils/dialog";
import { normalizeDocItem, parseDocsList } from "../utils/fleetCamoSync";
import {
  uid,
  docStatus,
  formatFileSize,
  canPreviewFile,
  fileTypeIcon,
} from "../utils/helpers";

function daysUntil(expiry) {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
}

export function AttachmentsEditor({ value, onChange }) {
  const t = useT();
  const ref = useRef(null);
  const editFileRef = useRef(null);

  const safeValue = parseDocsList(value);

  const [pendingName, setPendingName] = useState("");
  const [pendingExpiry, setPendingExpiry] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editBusy, setEditBusy] = useState(false);

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const docTitle = pendingName.trim() || f.name.replace(/\.[^/.]+$/, "");
    setBusy(true);
    try {
      const r = await uploadFile(f, "documents");
      const newItem = normalizeDocItem(
        {
          id: uid("DOC"),
          name: docTitle,
          expiry: pendingExpiry || null,
          fileName: r.fileName || f.name,
          url: r.fileUrl,
          viewUrl: r.viewUrl || "",
          fileId: r.fileId || "",
          path: r.filePath || "",
          mime: r.mimeType || f.type,
          size: r.size || f.size,
          uploadedAt: new Date().toISOString(),
        },
        safeValue.length
      );
      onChange([...safeValue, newItem]);
      setPendingName("");
      setPendingExpiry("");
      setPendingFile(null);
      showToast("✅ تم رفع الملف في Google Drive وإضافته للمرفقات", "success");
    } catch (err) {
      showToast("فشل الرفع إلى Google Drive: " + err.message, "error");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const pickEditFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setEditBusy(true);
    try {
      const r = await uploadFile(f, "documents");
      setEditFile({
        fileName: r.fileName || f.name,
        url: r.fileUrl,
        viewUrl: r.viewUrl || "",
        fileId: r.fileId || "",
        path: r.filePath || "",
        mime: r.mimeType || f.type,
        size: r.size || f.size,
      });
      if (!editName) setEditName(f.name.replace(/\.[^/.]+$/, ""));
      showToast("✅ تم رفع الملف الجديد في Google Drive — اضغط حفظ التعديل", "success");
    } catch (err) {
      showToast("فشل الرفع إلى Google Drive: " + err.message, "error");
    } finally {
      setEditBusy(false);
      e.target.value = "";
    }
  };

  const add = () => {
    if (!pendingName.trim()) {
      showToast("⚠️ أدخل اسم المستند", "warning");
      return;
    }
    const newItem = normalizeDocItem(
      {
        id: uid("DOC"),
        name: pendingName.trim(),
        expiry: pendingExpiry || null,
        fileName: pendingFile?.fileName || "",
        url: pendingFile?.url || "",
        path: pendingFile?.path || "",
        mime: pendingFile?.mime || "",
        size: pendingFile?.size || 0,
        uploadedAt: new Date().toISOString(),
      },
      safeValue.length
    );
    onChange([...safeValue, newItem]);
    setPendingName("");
    setPendingExpiry("");
    setPendingFile(null);
  };

  const remove = async (id) => {
    if (await confirmAction("حذف هذا المستند؟")) {
      onChange(safeValue.filter((x) => x.id !== id));
    }
  };

  const startEdit = (doc) => {
    setEditingId(doc.id);
    setEditName(doc.name || "");
    setEditExpiry(doc.expiry ? String(doc.expiry).slice(0, 10) : "");
    setEditFile(null);
  };

  const saveEdit = () => {
    if (!editName.trim()) {
      showToast("⚠️ أدخل اسم المستند", "warning");
      return;
    }
    onChange(
      safeValue.map((d) =>
        d.id === editingId
          ? {
              ...d,
              name: editName.trim(),
              expiry: editExpiry || null,
              ...(editFile
                ? {
                    fileName: editFile.fileName,
                    url: editFile.url,
                    viewUrl: editFile.viewUrl || "",
                    fileId: editFile.fileId || "",
                    path: editFile.path,
                    mime: editFile.mime,
                    size: editFile.size,
                    uploadedAt: new Date().toISOString(),
                  }
                : {}),
            }
          : d
      )
    );
    setEditingId(null);
    setEditName("");
    setEditExpiry("");
    setEditFile(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditExpiry("");
    setEditFile(null);
  };

  const renderIcon = (fileName, mime) => {
    const type = fileTypeIcon(fileName, mime);
    if (type === "image")
      return <ImageIcon className="w-5 h-5 text-emerald-600" />;
    if (type === "pdf") return <FileText className="w-5 h-5 text-rose-600" />;
    if (type === "word") return <FileText className="w-5 h-5 text-blue-600" />;
    if (type === "excel")
      return <FileText className="w-5 h-5 text-green-600" />;
    return <Paperclip className="w-5 h-5 text-slate-500" />;
  };

  return (
    <div className="space-y-3">
      {safeValue.length > 0 && (
        <div className="space-y-2">
          {safeValue.map((a, idx) => {
            const st = docStatus(a.expiry);
            const days = daysUntil(a.expiry);
            const preview = canPreviewFile(a.fileName || a.name, a.mime);
            const isEditing = editingId === a.id;

            if (isEditing) {
              return (
                <div
                  key={`${a.id}-${idx}`}
                  className="p-3 bg-purple-50 dark:bg-purple-950 border-2 border-purple-400 dark:border-purple-700 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                    <span className="flex items-center gap-1.5">
                      <Edit className="w-3.5 h-3.5" /> تعديل المستند / Edit Document
                    </span>
                    {editFile && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ✓ {editFile.fileName}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-5">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="اسم المستند / Document Name"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Input
                        type="date"
                        value={editExpiry}
                        onChange={(e) => setEditExpiry(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <button
                        type="button"
                        onClick={() => editFileRef.current?.click()}
                        disabled={editBusy}
                        className="w-full px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5 inline me-1" />
                        {editBusy
                          ? "..."
                          : editFile
                          ? "تم التحديث ✓"
                          : a.url
                          ? "استبدال الملف"
                          : "رفع ملف"}
                      </button>
                      <input
                        ref={editFileRef}
                        type="file"
                        onChange={pickEditFile}
                        className="hidden"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={editBusy}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> حفظ التعديل
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> إلغاء
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={`${a.id}-${idx}`}
                className={`flex items-center gap-3 p-3 border rounded-lg ${
                  st === "expired"
                    ? "bg-rose-50 dark:bg-rose-950 border-rose-300 dark:border-rose-800"
                    : st === "critical"
                    ? "bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-800"
                    : st === "expiring"
                    ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex-shrink-0">
                  {renderIcon(a.fileName || a.name, a.mime)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-slate-800 dark:text-slate-100">
                    {a.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {a.fileName && (
                      <span className="truncate">{a.fileName}</span>
                    )}
                    {a.size > 0 && <span> • {formatFileSize(a.size)}</span>}
                    {!a.url && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        • بدون ملف مرفق
                      </span>
                    )}
                  </div>
                  {a.expiry && days !== null && (
                    <div
                      className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        days < 0
                          ? "bg-rose-200 text-rose-800"
                          : days < 7
                          ? "bg-orange-200 text-orange-800"
                          : days < 30
                          ? "bg-amber-200 text-amber-800"
                          : "bg-emerald-200 text-emerald-800"
                      }`}
                    >
                      <Calendar className="w-2.5 h-2.5" />
                      {days < 0
                        ? `منتهي منذ ${Math.abs(days)} يوم`
                        : days === 0
                        ? "ينتهي اليوم"
                        : `${days} يوم متبقٍ (${a.expiry})`}
                    </div>
                  )}
                </div>

                {a.expiry && <Badge kind={st}>{t[st] || st}</Badge>}

                <div className="flex gap-1">
                  {preview && a.url && (
                    <button
                      type="button"
                      onClick={() =>
                        openPreviewModal({
                          title: a.name,
                          blobUrl: toPreviewFileUrl(a.url, a.fileName || a.name),
                          fileName: a.fileName || a.name,
                        })
                      }
                      className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      title="معاينة / Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {a.url && (
                    <a
                      href={toDownloadFileUrl(a.url, a.fileName || a.name)}
                      download={a.fileName || a.name}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300"
                      title="تحميل / Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    className="p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300"
                    title="تعديل / Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="p-2 rounded hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300"
                    title="حذف / Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new document */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-5">
            <Input
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder="اسم المستند (مثال: C of A, Insurance...)"
            />
          </div>
          <div className="md:col-span-3">
            <Input
              type="date"
              value={pendingExpiry}
              onChange={(e) => setPendingExpiry(e.target.value)}
              title="تاريخ الانتهاء (اختياري)"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={() => ref.current?.click()}
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 inline me-1" />
              {busy ? "..." : pendingFile ? "✓ ملف جاهز" : "رفع ملف"}
            </button>
            <input
              ref={ref}
              type="file"
              onChange={pickFile}
              className="hidden"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={add}
              disabled={!pendingName.trim() || busy}
              className="w-full px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 inline me-1" /> إضافة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttachmentsEditor;
