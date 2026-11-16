/* ═══════════════════════════════════════════════════════════
 * FLIGHT CONTEXT MENU — Customizable via Settings
 * Supports GenDec (Preview / Stamped / No Stamp),
 * Unified Completed Flight / Journey Log (JL),
 * Operational Forms, Notes, Email, Edit & Delete.
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Edit,
  Trash2,
  CheckCircle2,
  Plane,
  MessageSquare,
  Send,
  FileText,
  Stamp,
  FileX,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { can as checkPerm } from "../config/permissions";
import {
  getContextMenuFormsSync,
  fetchOperationalForms,
} from "../utils/operationalFormsService";
import {
  getFlightContextMenuConfig,
  FLIGHT_CONTEXT_MENU_EVENT,
} from "../utils/flightContextMenuConfig";

export function FlightContextMenu({
  flight,
  legIdx = -1,
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
  const isAr = (t?.locale || "ar") === "ar";

  const [contextForms, setContextForms] = useState(() =>
    getContextMenuFormsSync()
  );
  const [menuConfig, setMenuConfig] = useState(() =>
    getFlightContextMenuConfig()
  );

  useEffect(() => {
    const syncForms = () => setContextForms(getContextMenuFormsSync());
    const syncMenuCfg = () => setMenuConfig(getFlightContextMenuConfig());
    window.addEventListener("aeroops:forms-updated", syncForms);
    window.addEventListener(FLIGHT_CONTEXT_MENU_EVENT, syncMenuCfg);
    fetchOperationalForms()
      .then(() => setContextForms(getContextMenuFormsSync()))
      .catch(() => {});
    return () => {
      window.removeEventListener("aeroops:forms-updated", syncForms);
      window.removeEventListener(FLIGHT_CONTEXT_MENU_EVENT, syncMenuCfg);
    };
  }, []);

  /* Close on outside click / ESC */
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

  /* Permissions */
  const canEdit = checkPerm(user, "schedule.edit");
  const canDelete = checkPerm(user, "schedule.delete");
  const canViewForms = checkPerm(user, "forms.view");
  const canGenDecStamp = checkPerm(user, "schedule.gendec_stamp");
  const canGenDecNoStamp = checkPerm(user, "schedule.gendec_no_stamp");
  const canGenDecView =
    checkPerm(user, "schedule.gendec_view") || canGenDecStamp || canGenDecNoStamp;

  const isFormsSectionEnabled = useMemo(() => {
    const cfg = menuConfig.find((c) => c.id === "operational_forms");
    return cfg ? cfg.enabled !== false : true;
  }, [menuConfig]);

  const visibleContextForms =
    canViewForms && isFormsSectionEnabled ? contextForms : [];

  /* Adjust position to viewport */
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
  }, [x, y, visibleContextForms.length, menuConfig]);

  /* Configurable Single-Flight Item Catalog */
  const singleItemCatalog = {
    edit: {
      id: "edit",
      label: isAr
        ? legIdx >= 0
          ? `تعديل السكتر ${legIdx + 2}`
          : t.edit || "تعديل الرحلة"
        : legIdx >= 0
        ? `Edit Sector ${legIdx + 2}`
        : t.edit || "Edit Flight",
      icon: Edit,
      show: canEdit,
      color: "text-amber-700 dark:text-amber-300",
      hover: "hover:bg-amber-50 dark:hover:bg-amber-950",
    },
    complete_flight: {
      id: "complete_flight",
      label: isAr
        ? "الرحلة المكتملة · سجل الرحلة (JL)"
        : "Completed Flight · Journey Log (JL)",
      icon: CheckCircle2,
      show: canEdit,
      color: "text-emerald-700 dark:text-emerald-300",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950",
    },
    gendec: {
      id: "gendec",
      label: isAr
        ? "معاينة الإقرار العام (GenDec)"
        : "Preview GenDec (GD)",
      icon: FileText,
      show: canGenDecView,
      color: "text-sky-700 dark:text-sky-300",
      hover: "hover:bg-sky-50 dark:hover:bg-sky-950",
    },
    print_gendec_stamped: {
      id: "print_gendec_stamped",
      label: isAr
        ? "طباعة GenDec بالختم الرسمي"
        : "Print GenDec (With Stamp)",
      icon: Stamp,
      show: canGenDecStamp,
      color: "text-emerald-700 dark:text-emerald-300",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950",
    },
    print_gendec_nostamp: {
      id: "print_gendec_nostamp",
      label: isAr
        ? "طباعة GenDec بدون ختم"
        : "Print GenDec (No Stamp)",
      icon: FileX,
      show: canGenDecNoStamp,
      color: "text-slate-700 dark:text-slate-300",
      hover: "hover:bg-slate-100 dark:hover:bg-slate-700/60",
    },
    open_notes_modal: {
      id: "open_notes_modal",
      label: isAr ? "ملاحظات الرحلة والتصاريح" : t.notes || "Flight Notes",
      icon: MessageSquare,
      show: canEdit,
      color: "text-purple-700 dark:text-purple-300",
      hover: "hover:bg-purple-50 dark:hover:bg-purple-950",
    },
    send_flight_email: {
      id: "send_flight_email",
      label: isAr
        ? "إرسال تفاصيل الرحلة للطاقم"
        : t.sendFlightEmail || "Send Flight Email",
      icon: Send,
      show: canEdit,
      color: "text-blue-700 dark:text-blue-300",
      hover: "hover:bg-blue-50 dark:hover:bg-blue-950",
    },
    delete: {
      id: "delete",
      label: t.delete || "حذف الرحلة",
      icon: Trash2,
      show: canDelete,
      color: "text-rose-700 dark:text-rose-300",
      hover: "hover:bg-rose-50 dark:hover:bg-rose-950",
    },
  };

  const orderedSingleItems = menuConfig
    .filter((cfg) => cfg.enabled !== false && singleItemCatalog[cfg.id])
    .map((cfg) => singleItemCatalog[cfg.id])
    .filter((it) => it.show);

  /* Bulk items */
  const bulkItems = [
    {
      id: "bulk_complete",
      label: isAr
        ? "إكمال القطاعات المحددة (JL)"
        : "Complete Selected (JL)",
      icon: CheckCircle2,
      show: canEdit,
      color: "text-emerald-700 dark:text-emerald-300",
      hover: "hover:bg-emerald-50 dark:hover:bg-emerald-950",
    },
    {
      id: "bulk_gendec",
      label: t.gendec || "General Declaration (متعدد)",
      icon: Plane,
      show: canGenDecView,
      color: "text-sky-700 dark:text-sky-300",
      hover: "hover:bg-sky-50 dark:hover:bg-sky-950",
    },
  ].filter((it) => it.show);

  const items = isBulk ? bulkItems : orderedSingleItems;

  if (items.length === 0 && visibleContextForms.length === 0 && !isBulk) {
    onClose();
    return null;
  }

  const activeSector =
    !isBulk && legIdx >= 0 && Array.isArray(flight?.legs) && flight.legs[legIdx]
      ? flight.legs[legIdx]
      : flight;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl shadow-2xl py-1 min-w-[235px] overflow-hidden"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — Single flight / sector */}
      {!isBulk && flight && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <div className="font-bold text-xs font-mono text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2">
            <span>{activeSector?.flightNo || flight.flightNo}</span>
            {legIdx >= 0 && (
              <span className="text-[10px] text-purple-600 dark:text-purple-400">
                S{legIdx + 2}
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {activeSector?.dep || "—"} → {activeSector?.arr || "—"}
          </div>
        </div>
      )}

      {/* Header — Bulk */}
      {isBulk && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-sky-50 dark:bg-sky-950">
          <div className="font-bold text-xs text-sky-800 dark:text-sky-200">
            {flight.rowKeys?.length || flight.ids?.length || 0}{" "}
            {isAr ? "سكتر / رحلة محددة" : t.selected || "selected"}
          </div>
        </div>
      )}

      {/* Configured Action Items */}
      <div className="py-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onAction(item.id, isBulk ? null : flight, legIdx);
                onClose();
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-start transition cursor-pointer ${item.color} ${item.hover}`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Operational Forms — Dynamic Templates from Forms */}
      {visibleContextForms.length > 0 && (
        <>
          {items.length > 0 && (
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          )}
          <div className="px-3 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isAr ? "النماذج التشغيلية" : "Operational Forms"}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {visibleContextForms.map((opForm) => (
              <button
                key={opForm.id}
                type="button"
                onClick={() => {
                  onAction(`open_op_form:${opForm.id}`, flight, legIdx);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-start text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate max-w-[200px]">
                  {opForm.name}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Bulk: Edit Legs | Delete side by side */}
      {isBulk && (canEdit || canDelete) && (
        <>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <div className="flex gap-1 px-2 py-1.5">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onAction("bulk_edit_legs", null);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                {t.editLegs || "تعديل"}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  onAction("bulk_delete", null);
                  onClose();
                }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition cursor-pointer"
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
