/* ═══════════════════════════════════════════════════════════
 * AVATAR UPLOAD Component
 * Upload crew/user photos to Google Drive
 * ═══════════════════════════════════════════════════════════ */
import { showToast } from "../utils/dialog";
import React, { useRef, useState } from "react";
import { Camera, User } from "lucide-react";
import { uploadFile, toDisplayImageUrl } from "../api";
import { useT } from "../contexts";

export function AvatarUpload({ value, onChange, name }) {
  const t = useT();
  const ref = useRef();
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setBusy(true);
    try {
      const r = await uploadFile(f, "avatars");
      onChange(r.fileUrl);
    } catch (err) {
      showToast("Upload failed: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const avatarSrc = toDisplayImageUrl(value);

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={name || "avatar"}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-7 h-7 text-slate-400" />
        )}
      </div>

      <button
        type="button"
        onClick={() => ref.current.click()}
        disabled={busy}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50"
      >
        <Camera className="w-3.5 h-3.5" />
        {busy ? "…" : t.avatar}
      </button>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        onChange={handle}
        className="hidden"
      />
    </div>
  );
}

export default AvatarUpload;
