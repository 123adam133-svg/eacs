/* ═══════════════════════════════════════════════════════════
 * FLIGHT CONTEXT MENU
 * v3.7 — Bulk: Edit Legs | Delete side by side (horizontal row)
 *        Fixed: bulk_edit → bulk_edit_legs
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef } from "react";
import {
  Edit,
  Trash2,
  CheckCircle2,
  Plane,
  MessageSquare,
  Send,
  FileText,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { can as checkPerm } from "../config/permissions";
import {
  getContextMenuFormsSync,
  fetchOperationalForms,
} from "../utils/operationalFormsService";

export function FlightContextMenu({
  flight,
  x,
  y,
  user: userProp,
  onClose,
  onAction,
}) {
  const t = useT();
  const { user: authUser } = useAuth();
  const user = userProp || authUser;
  const menuRef = useRef(null);

  const [contextForms, setContextForms] = useState(() =>
    getContextMenuFormsSync()
  );

  useEffect(() => {
    const syncForms = () => setContextForms(getContextMenuFormsSync());
    window.addEventListener("aeroops:forms-updated", syncForms);
    fetchOperationalForms()
      .then(() => setContextForms(getContextMenuFormsSync()))
      .catch(() => {});
    return () => window.removeEventListener("aeroops:forms-updated", syncForms);
  }, []);

  /* ⭐ Close on outside click / ESC */
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const isBulk = flight?.bulk === true;

  /* ⭐ Permissions */
  const canEdit = checkPerm(user, "schedule.edit");
  const canDelete = checkPerm(user, "schedule.delete");
  const canViewForms = checkPerm(user, "forms.view");
  const canGenDecAny =
    checkPerm(user, "schedule.gendec_stamp") ||
    checkPerm(user, "schedule.gendec_no_stamp") ||
    checkPerm(user, "schedule.gendec_view");
  const visibleContextForms = canViewForms ? contextForms : [];

  /* ⭐ Adjust position to viewport */
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    if (x + rect.width > window.innerWidth) {
      menu.style.left = `${Math.max(10, window.innerWidth - rect.width - 10)}px`;
    }
    if (y + rect.height > window.innerHeight) {
      menu.style.top = `${Math.max(10, window.innerHeight - rect.height - 10)}px`;
    }
  }, [x, y, visibleContextForms.length]);

  /* ⭐ Single items — بدون gendec وبدون send_expiry_alerts */
  const singleItems = [
    {
      id: "edit",
      label: t.edit || "تعديل",
      icon: Edit,
      show: canEdit,
      color: "text-amber-700 dark:text-amber-300",
      hover: "hover:bg-amber-50 dark:hover:bg-amber-950",
      divider: false,
    },
    {
      id: "delete",
      label: t.delete || "حذف",
      icon: Trash2,
      show: canDelete,
      color: "text-rose-700 dark:text-rose-300",
      hover: "hover:bg-rose-50 dark:hover:bg-rose-950",
      divider: false,
    },
    {
      id: "complete_flight",
      label: t.completeJL || "إكمال الرحلة (JL)",
      icon: CheckCircle2,
      show: canEdit,
      color: "text-emerald-700 dark:text-emerald-300",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950",
      divider: true,
    },
    {
      id: "send_flight_email",
      label: t.sendFlightEmail || "📧 إرسال تفاصيل الرحلة للطاقم",
      icon: Send,
      show: canEdit,
      color: "text-blue-700 dark:text-blue-300",
      hover: "hover:bg-blue-50 dark:hover:bg-blue-950",
      divider: true,
    },
    {
      id: "open_notes_modal",
      label: t.notes || "الملاحظات",
      icon: MessageSquare,
      show: canEdit,
      color: "text-purple-700 dark:text-purple-300",
      hover: "hover:bg-purple-50 dark:hover:bg-purple-950",
      divider: true,
    },
  ];

  /* ⭐ Bulk items — بدون delete (سيكون في الصف الأفقي) */
  const bulkItems = [
    {
      id: "bulk_complete",
      label: t.completeJL || "إكمال الرحلات المحددة",
      icon: CheckCircle2,
      show: canEdit,
      color: "text-emerald-700 dark:text-emerald-300",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950",
      divider: false,
    },
    {
      id: "bulk_gendec",
      label: t.gendec || "General Declaration (متعدد)",
      icon: Plane,
      show: canGenDecAny,
      color: "text-sky-700 dark:text-sky-300",
      hover: "hover:bg-sky-50 dark:hover:bg-sky-950",
      divider: false,
    },
  ];

  const items = (isBulk ? bulkItems : singleItems).filter((it) => it.show);

  /* ⭐ If no items */
  if (items.length === 0 && visibleContextForms.length === 0 && !isBulk) {
    onClose();
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl py-1 min-w-[220px]"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — Single flight */}
      {!isBulk && flight && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
            {flight.flightNo}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {flight.dep} → {flight.arr}
          </div>
        </div>
      )}

      {/* Header — Bulk */}
      {isBulk && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-sky-950">
          <div className="font-bold text-sm text-sky-800 dark:text-sky-200">
            ⭐ {flight.ids?.length || 0} {t.selected || "محدد"}
          </div>
        </div>
      )}

      {/* Items — vertical list */}
      {items.map((item, idx) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.id}>
            {item.divider && idx > 0 && (
              <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            )}
            <button
              onClick={() => {
                onAction(item.id, isBulk ? null : flight);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-start transition ${item.color} ${item.hover}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
            </button>
          </React.Fragment>
        );
      })}

      {/* Operational Forms — Dynamic Templates from More -> Forms */}
      {visibleContextForms.length > 0 && (
        <>
          {items.length > 0 && (
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          )}
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            النماذج التشغيلية
          </div>
          <div className="max-h-56 overflow-y-auto">
            {visibleContextForms.map((opForm) => (
              <button
                key={opForm.id}
                onClick={() => {
                  onAction(`open_op_form:${opForm.id}`, flight);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate max-w-[200px]">
                  {opForm.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ⭐ v3.7 — Bulk: Edit Legs | Delete side by side */}
      {isBulk && (canEdit || canDelete) && (
        <>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <div className="flex gap-1 px-2 py-1.5">
            {canEdit && (
              <button
                onClick={() => {
                  onAction("bulk_edit_legs", null);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition"
              >
                <Edit className="w-3.5 h-3.5" />
                {t.editLegs || "تعديل القطاعات"}
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => {
                  onAction("bulk_delete", null);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.delete || "حذف"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FlightContextMenu;
