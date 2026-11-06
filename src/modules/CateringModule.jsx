/* ═══════════════════════════════════════════════════════════
 * CATERING MODULE — Orders + Templates + Pre-Stored Items Catalog + Dry Store
 * v2.0 — Pre-stored Catering Items Catalog + Searchable Item Picker in Templates & Orders
 * ═══════════════════════════════════════════════════════════ */
import { showToast, confirmAction, openPreviewModal } from "../utils/dialog";
import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Save,
  UtensilsCrossed,
  Plane,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Paperclip,
  Upload,
  FileText,
  Package,
  ChevronDown,
  Check,
  Layers,
  Tag,
  RefreshCw,
  X,
} from "lucide-react";
import { useT, useAuth } from "../contexts";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Modal } from "../components/ui/Modal";
import {
  cateringTemplatesAPI,
  cateringOrdersAPI,
  cateringItemsAPI,
  dryStoreItemsAPI,
  readSheetCache,
  uploadFile,
} from "../api";
import { can as checkPerm } from "../config/permissions";
import { fmtDate } from "../utils/helpers";
import { CateringPrintModal } from "../components/CateringPrintModal";
import { CateringDryStore } from "../components/CateringDryStore";

/* ═══ Styles ═══ */
const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-default)",
  boxShadow: "var(--shadow-sm)",
};
const innerBoxStyle = {
  backgroundColor: "var(--bg-app)",
  border: "1px solid var(--border-default)",
};

const STORAGE_KEY_CATERING_ITEMS = "aeroops.catering_items_v1";
const STORAGE_KEY_ITEMS_SEEDED = "aeroops.catering_items_seeded_v1";

const STATUS_COLORS = {
  PENDING: { bg: "bg-amber-500/15", text: "text-amber-500", label: "PENDING" },
  CONFIRMED: { bg: "bg-sky-500/15", text: "text-sky-500", label: "CONFIRMED" },
  DELIVERED: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-500",
    label: "DELIVERED",
  },
  CANCELLED: {
    bg: "bg-rose-500/15",
    text: "text-rose-500",
    label: "CANCELLED",
  },
};

const MEAL_TYPES = [
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "SNACK",
  "BEVERAGE",
  "SPECIAL",
];

const ITEM_CATEGORIES = [
  { id: "HOT_MEAL", label: "وجبات رئيسية ساخنة / Hot Meals" },
  { id: "BREAKFAST", label: "إفطار ومخبوزات / Breakfast & Bakery" },
  { id: "COLD_MEAL", label: "وجبات باردة وسلطات / Cold Meals & Salads" },
  { id: "SNACK", label: "سناكس وحلويات / Snacks & Desserts" },
  { id: "HOT_BEVERAGE", label: "مشروبات ساخنة / Hot Beverages" },
  { id: "COLD_BEVERAGE", label: "مشروبات باردة وعصائر / Cold Beverages" },
  { id: "VIP_CREW", label: "وجبات الطاقم وكبار الشخصيات / Crew & VIP" },
  { id: "DRY_SERVICE", label: "تموين جاف ومستلزمات تقديم / Dry & Service" },
];

const ITEM_UNITS = [
  "وجبة / Meal",
  "صينية / Tray",
  "علبة / Box",
  "طبق / Platter",
  "قطعة / Piece",
  "قارورة / Bottle",
  "علبة مشروب / Can",
  "كوب / Cup",
  "ظرف / Sachet",
  "كيس / Pack",
  "طقم / Set",
  "ترمس / Thermos",
];

const QTY_PRESETS = [
  { value: "1 per pax", label: "1 لكل راكب (1 per pax)" },
  { value: "2 per pax", label: "2 لكل راكب (2 per pax)" },
  { value: "1 per crew", label: "1 لكل فرد طاقم (1 per crew)" },
  { value: "1 per pax & crew", label: "1 لكل راكب وطاقم (1 per head)" },
  { value: "1 per flight", label: "1 لكل رحلة (1 per flight)" },
  { value: "2 per flight", label: "2 لكل رحلة (2 per flight)" },
  { value: "As required", label: "حسب الطلب (As required)" },
];

const INITIAL_CATERING_ITEMS = [
  {
    id: "cat_item_1",
    code: "CAT-01",
    nameAr: "وجبة دجاج برياني ساخنة",
    nameEn: "Chicken Biryani Hot Meal",
    category: "HOT_MEAL",
    unit: "وجبة / Meal",
    defaultQty: "1 per pax",
    notes: "تقدم مع أرز بسمتي وخضار",
  },
  {
    id: "cat_item_2",
    code: "CAT-02",
    nameAr: "وجبة لحم مشوي مع البطاطس",
    nameEn: "Grilled Beef Fillet with Potatoes",
    category: "HOT_MEAL",
    unit: "وجبة / Meal",
    defaultQty: "1 per pax",
    notes: "خيار رئيسي للغداء والعشاء",
  },
  {
    id: "cat_item_3",
    code: "CAT-03",
    nameAr: "وجبة سمك فيليه مشوي",
    nameEn: "Grilled Fish Fillet Meal",
    category: "HOT_MEAL",
    unit: "وجبة / Meal",
    defaultQty: "1 per pax",
    notes: "مع صوص الليمون والأرز",
  },
  {
    id: "cat_item_4",
    code: "CAT-04",
    nameAr: "فطور شرقي وكرواسون طازج",
    nameEn: "Oriental Breakfast & Fresh Croissant",
    category: "BREAKFAST",
    unit: "وجبة / Meal",
    defaultQty: "1 per pax",
    notes: "جبن، أومليت، مربى، زبدة، كرواسون",
  },
  {
    id: "cat_item_5",
    code: "CAT-05",
    nameAr: "تشكيلة ساندويتشات كلوب وميني برجر",
    nameEn: "Assorted Club Sandwiches & Mini Sliders",
    category: "COLD_MEAL",
    unit: "علبة / Box",
    defaultQty: "1 per pax",
    notes: "مناسبة للرحلات القصيرة والمتوسطة",
  },
  {
    id: "cat_item_6",
    code: "CAT-06",
    nameAr: "سلطة سيزر / سلطة موسمية طازجة",
    nameEn: "Fresh Caesar / Garden Salad",
    category: "COLD_MEAL",
    unit: "علبة / Box",
    defaultQty: "1 per pax",
    notes: "مع صوص منفصل",
  },
  {
    id: "cat_item_7",
    code: "CAT-07",
    nameAr: "طبق فواكه موسمية مقطعة",
    nameEn: "Fresh Seasonal Fruit Platter",
    category: "SNACK",
    unit: "علبة / Box",
    defaultQty: "1 per pax",
    notes: "مبردة وجاهزة للتقديم",
  },
  {
    id: "cat_item_8",
    code: "CAT-08",
    nameAr: "حلويات شرقية وغربية مشكلة",
    nameEn: "Assorted Oriental & French Pastries",
    category: "SNACK",
    unit: "قطعة / Piece",
    defaultQty: "1 per pax",
    notes: "تقدم بعد الوجبة أو مع القهوة",
  },
  {
    id: "cat_item_9",
    code: "CAT-09",
    nameAr: "وجبة طاقم الطائرة المتكاملة",
    nameEn: "Flight & Cabin Crew Complete Meal",
    category: "VIP_CREW",
    unit: "وجبة / Meal",
    defaultQty: "1 per crew",
    notes: "وجبات منفصلة لقائد الطائرة والمساعد الأول",
  },
  {
    id: "cat_item_10",
    code: "CAT-10",
    nameAr: "قهوة عربية وتمر فاخر (ترمس)",
    nameEn: "Arabic Coffee Thermos & Premium Dates",
    category: "HOT_BEVERAGE",
    unit: "ترمس / Thermos",
    defaultQty: "1 per flight",
    notes: "استقبال الضيوف وكبار الشخصيات",
  },
  {
    id: "cat_item_11",
    code: "CAT-11",
    nameAr: "عصائر طبيعية ومشروبات غازية مشكلة",
    nameEn: "Assorted Fresh Juices & Soft Drinks",
    category: "COLD_BEVERAGE",
    unit: "علبة مشروب / Can",
    defaultQty: "2 per pax",
    notes: "برتقال، تفاح، مشروبات غازية",
  },
  {
    id: "cat_item_12",
    code: "CAT-12",
    nameAr: "مياه معدنية 330 مل",
    nameEn: "Mineral Water 330ml Bottles",
    category: "COLD_BEVERAGE",
    unit: "قارورة / Bottle",
    defaultQty: "2 per pax",
    notes: "عبوات فردية للركاب والطاقم",
  },
];

function getCategoryLabel(catId) {
  const found = ITEM_CATEGORIES.find((c) => c.id === catId);
  if (found) return found.label;
  return catId || "عام / General";
}

function getCategoryShortLabel(catId) {
  const found = ITEM_CATEGORIES.find((c) => c.id === catId);
  if (!found) return catId || "عام";
  return found.label.split("/")[0].trim();
}

function formatCatalogItemDisplay(item) {
  if (!item) return "";
  const ar = String(item.nameAr || "").trim();
  const en = String(item.nameEn || "").trim();
  if (ar && en) return `${ar} — ${en}`;
  return ar || en || String(item.item || "").trim();
}

function buildMenuEntryFromCatalogItem(catalogItem, overrideQty) {
  return {
    itemId: catalogItem.id,
    item: formatCatalogItemDisplay(catalogItem),
    nameAr: catalogItem.nameAr || "",
    nameEn: catalogItem.nameEn || "",
    category: catalogItem.category || "HOT_MEAL",
    unit: catalogItem.unit || "وجبة / Meal",
    qty: overrideQty || catalogItem.defaultQty || "1 per pax",
  };
}

/* ═══════════════════════════════════════════════════════════
 * STORED MENU ITEMS EDITOR (مشترك للقوالب والطلبيات)
 * Allows choosing items strictly/conveniently from the Pre-Stored Catalog
 * with Search, Category Filter, Multi-Pick, & Inline Add-to-Catalog
 * ═══════════════════════════════════════════════════════════ */
function StoredMenuItemsEditor({
  items,
  setItems,
  catalogItems,
  onOpenQuickAddItem,
  onSaveLegacyItemToCatalog,
  canManageCatalog,
  label = "الأصناف المختارة من القائمة المخزنة / Menu Items",
}) {
  const [openRowPickerIdx, setOpenRowPickerIdx] = useState(null);
  const [rowSearch, setRowSearch] = useState("");
  const [rowCategory, setRowCategory] = useState("ALL");

  const [showMultiPicker, setShowMultiPicker] = useState(false);
  const [multiSearch, setMultiSearch] = useState("");
  const [multiCategory, setMultiCategory] = useState("ALL");

  const matchCatalogItem = (entry) => {
    if (!entry) return null;
    if (entry.itemId) {
      const byId = catalogItems.find(
        (c) => String(c.id) === String(entry.itemId)
      );
      if (byId) return byId;
    }
    const raw = String(entry.item || "")
      .trim()
      .toLowerCase();
    if (!raw) return null;
    return (
      catalogItems.find((c) => {
        const disp = formatCatalogItemDisplay(c).toLowerCase();
        const ar = String(c.nameAr || "")
          .trim()
          .toLowerCase();
        const en = String(c.nameEn || "")
          .trim()
          .toLowerCase();
        return disp === raw || ar === raw || en === raw;
      }) || null
    );
  };

  const selectedCatalogIds = useMemo(() => {
    const ids = new Set();
    (items || []).forEach((entry) => {
      const matched = matchCatalogItem(entry);
      if (matched?.id) ids.add(String(matched.id));
    });
    return ids;
  }, [items, catalogItems]);

  const filterCatalog = (queryStr, catId) => {
    const q = String(queryStr || "")
      .trim()
      .toLowerCase();
    return catalogItems.filter((c) => {
      const matchCat = catId === "ALL" || c.category === catId;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        (c.nameAr || "").toLowerCase().includes(q) ||
        (c.nameEn || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q)
      );
    });
  };

  const filteredRowCatalog = useMemo(
    () => filterCatalog(rowSearch, rowCategory),
    [catalogItems, rowSearch, rowCategory]
  );

  const filteredMultiCatalog = useMemo(
    () => filterCatalog(multiSearch, multiCategory),
    [catalogItems, multiSearch, multiCategory]
  );

  const handleSelectCatalogForRow = (idx, catItem) => {
    setItems((prev) => {
      const next = [...prev];
      const existing = next[idx] || {};
      const shouldUseCatalogDefaultQty =
        !existing.item ||
        !existing.qty ||
        existing.qty === "1 per pax" ||
        existing.itemId !== catItem.id;
      next[idx] = buildMenuEntryFromCatalogItem(
        catItem,
        shouldUseCatalogDefaultQty
          ? catItem.defaultQty || "1 per pax"
          : existing.qty
      );
      return next;
    });
    setOpenRowPickerIdx(null);
    setRowSearch("");
  };

  const handleToggleMultiItem = (catItem) => {
    const idStr = String(catItem.id);
    if (selectedCatalogIds.has(idStr)) {
      setItems((prev) => {
        const filtered = prev.filter((entry) => {
          const matched = matchCatalogItem(entry);
          return String(matched?.id || "") !== idStr;
        });
        return filtered.length > 0 ? filtered : [];
      });
    } else {
      setItems((prev) => {
        const cleaned = prev.filter((x) => x && x.item);
        return [...cleaned, buildMenuEntryFromCatalogItem(catItem)];
      });
    }
  };

  const addEmptySelectionRow = () => {
    const nextIdx = Array.isArray(items) ? items.length : 0;
    setItems((prev) => [
      ...(Array.isArray(prev) ? prev : []),
      { itemId: "", item: "", qty: "1 per pax" },
    ]);
    setOpenRowPickerIdx(nextIdx);
    setRowSearch("");
    setRowCategory("ALL");
  };

  const updateRowField = (idx, patch) => {
    setItems((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removeRow = (idx) => {
    setItems((prev) =>
      Array.isArray(prev) ? prev.filter((_, i) => i !== idx) : []
    );
    setOpenRowPickerIdx((prevIdx) => {
      if (prevIdx === null) return null;
      if (prevIdx === idx) return null;
      return prevIdx > idx ? prevIdx - 1 : prevIdx;
    });
  };

  const validItemsCount = (items || []).filter((i) => i && i.item).length;

  return (
    <div className="space-y-3">
      {/* Header & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4
            className="text-sm font-bold flex items-center gap-1.5"
            style={{ color: "var(--text-primary)" }}
          >
            <UtensilsCrossed
              className="w-4 h-4"
              style={{ color: "var(--brand-primary)" }}
            />
            <span>{label}</span>
            <span
              className="px-1.5 py-0.5 rounded text-[11px] font-mono"
              style={innerBoxStyle}
            >
              {validItemsCount}
            </span>
          </h4>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            اختر الأصناف من القائمة المخزنة مسبقاً أو أضف صنفاً جديداً للكتالوج ليظهر دائماً في القوائم
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowMultiPicker((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
              showMultiPicker
                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40"
                : "hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            style={
              showMultiPicker
                ? undefined
                : {
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }
            }
          >
            <Layers className="w-3.5 h-3.5" />
            <span>اختيار متعدد من القائمة ({catalogItems.length})</span>
          </button>

          <button
            type="button"
            onClick={addEmptySelectionRow}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
            style={{ background: "var(--brand-primary)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>اختيار صنف مخزن</span>
          </button>

          {canManageCatalog && (
            <button
              type="button"
              onClick={() => onOpenQuickAddItem("append", "")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition"
              title="تعريف وحفظ صنف جديد في قائمة الأصناف المخزنة وإدراجه مباشرة"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف جديد للكتالوج</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Pick Stored Items Panel */}
      {showMultiPicker && (
        <div
          className="rounded-xl p-3 space-y-2.5 border"
          style={{
            backgroundColor: "var(--bg-app)",
            borderColor: "var(--border-default)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-xs font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              قائمة الأصناف المخزنة مسبقاً — انقر على أي صنف لإضافته أو إزالته:
            </span>
            <button
              type="button"
              onClick={() => setShowMultiPicker(false)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={multiSearch}
                onChange={(e) => setMultiSearch(e.target.value)}
                placeholder="بحث سريع في الأصناف المخزنة..."
                className="ps-8 h-8 text-xs"
              />
            </div>
            <div className="min-w-[180px]">
              <Select
                value={multiCategory}
                onChange={(e) => setMultiCategory(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="ALL">جميع التصنيفات ({catalogItems.length})</option>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filteredMultiCatalog.length === 0 ? (
            <div
              className="text-center py-4 text-xs space-y-2"
              style={{ color: "var(--text-muted)" }}
            >
              <div>لا يوجد صنف مخزن مطابق للبحث "{multiSearch}"</div>
              {canManageCatalog && multiSearch.trim() && (
                <button
                  type="button"
                  onClick={() => onOpenQuickAddItem("append", multiSearch.trim())}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  حفظ "{multiSearch.trim()}" كصنف مخزن جديد وإدراجه
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pe-1">
              {filteredMultiCatalog.map((catItem) => {
                const isSelected = selectedCatalogIds.has(String(catItem.id));
                return (
                  <button
                    key={catItem.id}
                    type="button"
                    onClick={() => handleToggleMultiItem(catItem)}
                    className={`p-2 rounded-lg border text-start flex items-center justify-between gap-2 transition ${
                      isSelected
                        ? "border-emerald-500/60 bg-emerald-500/10"
                        : "hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                    style={
                      isSelected
                        ? undefined
                        : {
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-default)",
                          }
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-xs font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {catItem.nameAr || catItem.nameEn}
                      </div>
                      <div
                        className="text-[10px] truncate flex items-center gap-1.5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {catItem.nameAr && catItem.nameEn && (
                          <span>{catItem.nameEn}</span>
                        )}
                        <span>· {getCategoryShortLabel(catItem.category)}</span>
                        <span className="font-mono">({catItem.defaultQty})</span>
                      </div>
                    </div>
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 text-xs font-bold ${
                        isSelected
                          ? "bg-emerald-600 text-white"
                          : "border border-slate-300 dark:border-slate-600 text-transparent"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Rows List */}
      {(!items || items.length === 0) ? (
        <div
          className="rounded-xl p-5 text-center border border-dashed space-y-2"
          style={{
            borderColor: "var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          <div className="text-xs">
            لم يتم اختيار أي صنف بعد. اختر من قائمة الأصناف المخزنة أو أضف صنفاً جديداً للكتالوج.
          </div>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={addEmptySelectionRow}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1"
              style={{ background: "var(--brand-primary)" }}
            >
              <Plus className="w-3.5 h-3.5" /> اختيار صنف مخزن
            </button>
            <button
              type="button"
              onClick={() => setShowMultiPicker(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              <Layers className="w-3.5 h-3.5" /> فتح قائمة الأصناف المخزنة
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => {
            const matchedCatalog = matchCatalogItem(it);
            const isPickerOpen = openRowPickerIdx === idx;
            const isUnstoredLegacy = Boolean(it.item && !matchedCatalog);

            return (
              <div
                key={idx}
                className="rounded-lg p-2 border space-y-2"
                style={{
                  backgroundColor: "var(--bg-app)",
                  borderColor: isPickerOpen
                    ? "var(--brand-primary)"
                    : "var(--border-default)",
                }}
              >
                <div className="grid grid-cols-12 gap-2 items-center">
                  {/* Stored Item Dropdown Trigger */}
                  <div className="col-span-12 md:col-span-7">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isPickerOpen) {
                            setOpenRowPickerIdx(null);
                          } else {
                            setOpenRowPickerIdx(idx);
                            setRowSearch("");
                            setRowCategory("ALL");
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border text-start text-xs flex items-center justify-between gap-2 transition hover:border-sky-500/50"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          borderColor: "var(--border-default)",
                          color: it.item
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          {matchedCatalog ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold truncate">
                                {matchedCatalog.nameAr || matchedCatalog.nameEn}
                              </span>
                              {matchedCatalog.nameAr && matchedCatalog.nameEn && (
                                <span
                                  className="text-[11px] truncate"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  — {matchedCatalog.nameEn}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold">
                                {getCategoryShortLabel(matchedCatalog.category)}
                              </span>
                            </div>
                          ) : it.item ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold truncate">
                                {it.item}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                غير محفوظ بالكتالوج
                              </span>
                            </div>
                          ) : (
                            <span>
                              — اختر الصنف من قائمة الأصناف المخزنة / Select Stored Item —
                            </span>
                          )}
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 transition-transform ${
                            isPickerOpen ? "rotate-180" : ""
                          }`}
                          style={{ color: "var(--text-muted)" }}
                        />
                      </button>

                      {isUnstoredLegacy && canManageCatalog && (
                        <button
                          type="button"
                          onClick={() => onSaveLegacyItemToCatalog(idx, it)}
                          className="px-2 py-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold shrink-0 hover:bg-emerald-500 hover:text-white transition"
                          title="حفظ هذا الصنف في قائمة الأصناف المخزنة"
                        >
                          + حفظ بالكتالوج
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quantity Input + Preset Selector */}
                  <div className="col-span-10 md:col-span-4 flex items-center gap-1.5">
                    <Input
                      value={it.qty || ""}
                      onChange={(e) =>
                        updateRowField(idx, { qty: e.target.value })
                      }
                      placeholder="الكمية (مثال: 1 per pax)"
                      className="text-xs font-mono"
                    />
                    <Select
                      value={
                        QTY_PRESETS.some((p) => p.value === it.qty)
                          ? it.qty
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value) {
                          updateRowField(idx, { qty: e.target.value });
                        }
                      }}
                      className="w-24 text-[11px] px-1.5 shrink-0"
                      title="قوالب كميات سريعة"
                    >
                      <option value="">توزيع...</option>
                      {QTY_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.value}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Delete Row */}
                  <div className="col-span-2 md:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-2 rounded-lg bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                      title="إزالة السطر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Stored Item Picker Dropdown for this row */}
                {isPickerOpen && (
                  <div
                    className="rounded-lg p-2.5 border space-y-2 mt-1"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      borderColor: "var(--border-default)",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[170px]">
                        <Search
                          className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 start-2.5"
                          style={{ color: "var(--text-muted)" }}
                        />
                        <Input
                          autoFocus
                          value={rowSearch}
                          onChange={(e) => setRowSearch(e.target.value)}
                          placeholder="ابحث باسم الصنف المخزن (عربي / English)..."
                          className="ps-8 h-8 text-xs"
                        />
                      </div>
                      <div className="min-w-[165px]">
                        <Select
                          value={rowCategory}
                          onChange={(e) => setRowCategory(e.target.value)}
                          className="h-8 text-xs"
                        >
                          <option value="ALL">كل التصنيفات</option>
                          {ITEM_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {canManageCatalog && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenRowPickerIdx(null);
                            onOpenQuickAddItem(idx, rowSearch.trim());
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>صنف جديد للكتالوج</span>
                        </button>
                      )}
                    </div>

                    {filteredRowCatalog.length === 0 ? (
                      <div
                        className="py-3 text-center text-xs space-y-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div>لا توجد أصناف مخزنة مطابقة للبحث</div>
                        {canManageCatalog && rowSearch.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenRowPickerIdx(null);
                              onOpenQuickAddItem(idx, rowSearch.trim());
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            إضافة "{rowSearch.trim()}" كصنف مخزن واختياره
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y rounded border" style={{ borderColor: "var(--border-default)" }}>
                        {filteredRowCatalog.map((catItem) => {
                          const isCurrent =
                            matchedCatalog &&
                            String(matchedCatalog.id) === String(catItem.id);
                          return (
                            <button
                              key={catItem.id}
                              type="button"
                              onClick={() =>
                                handleSelectCatalogForRow(idx, catItem)
                              }
                              className={`w-full px-3 py-2 text-start text-xs flex items-center justify-between gap-2 transition ${
                                isCurrent
                                  ? "bg-sky-500/10"
                                  : "hover:bg-black/5 dark:hover:bg-white/5"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div
                                  className="font-bold flex flex-wrap items-center gap-1.5"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  <span>{catItem.nameAr || catItem.nameEn}</span>
                                  {catItem.nameAr && catItem.nameEn && (
                                    <span
                                      className="font-normal text-[11px]"
                                      style={{ color: "var(--text-muted)" }}
                                    >
                                      — {catItem.nameEn}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="text-[10px] flex flex-wrap items-center gap-2 mt-0.5"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  <span>
                                    {getCategoryShortLabel(catItem.category)}
                                  </span>
                                  <span>· الوحدة: {catItem.unit}</span>
                                  <span className="font-mono">
                                    · افتراضي: {catItem.defaultQty}
                                  </span>
                                </div>
                              </div>
                              {isCurrent ? (
                                <span className="px-2 py-0.5 rounded bg-sky-500 text-white text-[10px] font-bold">
                                  محدد ✓
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-0.5 rounded border text-[10px] font-semibold"
                                  style={{
                                    borderColor: "var(--border-default)",
                                    color: "var(--brand-primary)",
                                  }}
                                >
                                  اختيار
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
 * MAIN CATERING MODULE
 * ═══════════════════════════════════════════════════════════ */
export function CateringModule({
  flights = [],
  settings = {},
  user,
  setSyncStatus,
}) {
  const t = useT();
  const { user: authUser } = useAuth();
  const effectiveUser = user || authUser;

  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "templates" | "items_catalog" | "dry_store"
  const [orders, setOrders] = useState(() =>
    readSheetCache("CateringOrders", [])
  );
  const [templates, setTemplates] = useState(() =>
    readSheetCache("CateringTemplates", [])
  );
  const [cateringItems, setCateringItems] = useState(() => {
    const cachedSheet = readSheetCache("CateringItems", null);
    if (Array.isArray(cachedSheet) && cachedSheet.length > 0)
      return cachedSheet;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CATERING_ITEMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_CATERING_ITEMS;
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  /* ═══ Catalog Filter & Modal State ═══ */
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("ALL");
  const [showStoredItemModal, setShowStoredItemModal] = useState(false);
  const [editingStoredItem, setEditingStoredItem] = useState(null);
  // quickAddContext: null | { scope: "template" | "order", targetIdx: number | "append" }
  const [quickAddContext, setQuickAddContext] = useState(null);
  const [storedItemDraft, setStoredItemDraft] = useState({
    code: "",
    nameAr: "",
    nameEn: "",
    category: "HOT_MEAL",
    unit: "وجبة / Meal",
    defaultQty: "1 per pax",
    notes: "",
  });

  /* ═══ Order State ═══ */
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderDraft, setOrderDraft] = useState({});
  const [orderItems, setOrderItems] = useState([]);

  /* ═══ Template State ═══ */
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateDraft, setTemplateDraft] = useState({});
  const [templateItems, setTemplateItems] = useState([]);

  /* ═══ Print State ═══ */
  const [printingOrder, setPrintingOrder] = useState(null);

  const canView =
    checkPerm(effectiveUser, "catering.view") ||
    checkPerm(effectiveUser, "portal.catering");
  const canEdit = checkPerm(effectiveUser, "catering.edit");
  const canCreate = checkPerm(effectiveUser, "catering.create");
  const canDelete = checkPerm(effectiveUser, "catering.delete");
  const canManageCatalog =
    canCreate ||
    canEdit ||
    checkPerm(effectiveUser, "catering.dry_store");

  /* Persist cateringItems to localStorage */
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_CATERING_ITEMS,
        JSON.stringify(cateringItems)
      );
    } catch {}
  }, [cateringItems]);

  /* ═══ Load Orders, Templates, & Stored Items Catalog ═══ */
  const loadData = async () => {
    setLoading(true);
    setSyncStatus?.("syncing");
    try {
      const [o, tplList, remoteCatalog] = await Promise.all([
        cateringOrdersAPI.list().catch(() => readSheetCache("CateringOrders", [])),
        cateringTemplatesAPI
          .list()
          .catch(() => readSheetCache("CateringTemplates", [])),
        cateringItemsAPI.list().catch(() => null),
      ]);

      setOrders(Array.isArray(o) ? o : []);
      const safeTemplates = Array.isArray(tplList) ? tplList : [];
      setTemplates(safeTemplates);

      if (Array.isArray(remoteCatalog) && remoteCatalog.length > 0) {
        setCateringItems(remoteCatalog);
        try {
          localStorage.setItem(STORAGE_KEY_ITEMS_SEEDED, "1");
        } catch {}
      } else if (
        remoteCatalog === null &&
        !localStorage.getItem(STORAGE_KEY_ITEMS_SEEDED)
      ) {
        // First-time seed: merge INITIAL_CATERING_ITEMS + any unique items already in existing templates
        const merged = [...INITIAL_CATERING_ITEMS];
        const existingNames = new Set(
          merged.flatMap((m) => [
            (m.nameAr || "").trim().toLowerCase(),
            (m.nameEn || "").trim().toLowerCase(),
            formatCatalogItemDisplay(m).toLowerCase(),
          ])
        );

        safeTemplates.forEach((tpl) => {
          (tpl.items || []).forEach((entry, idx) => {
            const rawName = String(entry?.item || "").trim();
            if (rawName && !existingNames.has(rawName.toLowerCase())) {
              existingNames.add(rawName.toLowerCase());
              const hasArabic = /[\u0600-\u06FF]/.test(rawName);
              merged.push({
                id: `cat_tpl_${Date.now()}_${idx}_${Math.random()
                  .toString(36)
                  .slice(2, 5)}`,
                code: `CAT-${String(merged.length + 1).padStart(2, "0")}`,
                nameAr: hasArabic ? rawName : "",
                nameEn: hasArabic ? "" : rawName,
                category:
                  tpl.mealType === "BREAKFAST"
                    ? "BREAKFAST"
                    : tpl.mealType === "BEVERAGE"
                    ? "COLD_BEVERAGE"
                    : tpl.mealType === "SNACK"
                    ? "SNACK"
                    : "HOT_MEAL",
                unit: "وجبة / Meal",
                defaultQty: entry?.qty || "1 per pax",
                notes: `مستورد من قالب: ${tpl.name || ""}`,
              });
            }
          });
        });

        setCateringItems(merged);
        try {
          localStorage.setItem(STORAGE_KEY_ITEMS_SEEDED, "1");
        } catch {}
        cateringItemsAPI.saveAll(merged).catch(() => {});
      } else if (Array.isArray(remoteCatalog)) {
        setCateringItems(remoteCatalog);
      }

      setSyncStatus?.("synced");
    } catch {
      setSyncStatus?.("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ═══ PRE-STORED ITEMS CATALOG — CRUD (آلية إضافة وإدارة الأصناف المخزنة) ═══ */
  const generateNextItemCode = () => {
    const nextNum = cateringItems.length + 1;
    return `CAT-${String(nextNum).padStart(2, "0")}`;
  };

  const openAddStoredItemModal = (context = null, initialName = "") => {
    if (!canManageCatalog) return showToast("⚠️ ليس لديك صلاحية إدارة الأصناف");
    const trimmed = String(initialName || "").trim();
    const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
    setEditingStoredItem(null);
    setQuickAddContext(context);
    setStoredItemDraft({
      code: generateNextItemCode(),
      nameAr: hasArabic ? trimmed : "",
      nameEn: !hasArabic ? trimmed : "",
      category: "HOT_MEAL",
      unit: "وجبة / Meal",
      defaultQty: "1 per pax",
      notes: "",
    });
    setShowStoredItemModal(true);
  };

  const openEditStoredItemModal = (item) => {
    if (!canManageCatalog) return showToast("⚠️ ليس لديك صلاحية تعديل الأصناف");
    setEditingStoredItem(item);
    setQuickAddContext(null);
    setStoredItemDraft({
      code: item.code || "",
      nameAr: item.nameAr || "",
      nameEn: item.nameEn || "",
      category: item.category || "HOT_MEAL",
      unit: item.unit || "وجبة / Meal",
      defaultQty: item.defaultQty || "1 per pax",
      notes: item.notes || "",
    });
    setShowStoredItemModal(true);
  };

  const saveStoredItem = async () => {
    const nameAr = String(storedItemDraft.nameAr || "").trim();
    const nameEn = String(storedItemDraft.nameEn || "").trim();
    if (!nameAr && !nameEn) {
      return showToast(
        "⚠️ يرجى إدخال اسم الصنف بالعربية أو الإنجليزية",
        "warning"
      );
    }

    setSyncStatus?.("syncing");
    try {
      if (editingStoredItem) {
        const updatedItem = {
          ...editingStoredItem,
          ...storedItemDraft,
          nameAr,
          nameEn,
          id: editingStoredItem.id,
        };
        const nextCatalog = cateringItems.map((it) =>
          String(it.id) === String(editingStoredItem.id) ? updatedItem : it
        );
        setCateringItems(nextCatalog);
        await cateringItemsAPI.saveAll(nextCatalog);

        // Keep any open draft rows referencing this itemId in sync
        const syncRowList = (rows) =>
          rows.map((r) =>
            String(r.itemId) === String(updatedItem.id)
              ? buildMenuEntryFromCatalogItem(updatedItem, r.qty)
              : r
          );
        if (editingTemplate) setTemplateItems((prev) => syncRowList(prev));
        if (editingOrder) setOrderItems((prev) => syncRowList(prev));

        showToast("✅ تم تحديث الصنف المخزن بنجاح", "success");
      } else {
        const newItem = {
          id: `cat_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          code: storedItemDraft.code || generateNextItemCode(),
          nameAr,
          nameEn,
          category: storedItemDraft.category || "HOT_MEAL",
          unit: storedItemDraft.unit || "وجبة / Meal",
          defaultQty: storedItemDraft.defaultQty || "1 per pax",
          notes: storedItemDraft.notes || "",
        };
        const nextCatalog = [...cateringItems, newItem];
        setCateringItems(nextCatalog);
        await cateringItemsAPI.saveAll(nextCatalog);

        // If added directly from inside Template Modal or Order Modal, select it automatically!
        if (quickAddContext) {
          const entry = buildMenuEntryFromCatalogItem(newItem);
          const targetSetter =
            quickAddContext.scope === "template"
              ? setTemplateItems
              : setOrderItems;

          targetSetter((prev) => {
            if (
              typeof quickAddContext.targetIdx === "number" &&
              quickAddContext.targetIdx >= 0 &&
              quickAddContext.targetIdx < prev.length
            ) {
              const next = [...prev];
              next[quickAddContext.targetIdx] = entry;
              return next;
            }
            const cleaned = prev.filter((x) => x && x.item);
            return [...cleaned, entry];
          });
        }

        showToast("✅ تم حفظ الصنف في القائمة المخزنة", "success");
      }

      setShowStoredItemModal(false);
      setEditingStoredItem(null);
      setQuickAddContext(null);
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("فشل حفظ الصنف: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const deleteStoredItem = async (item) => {
    if (!canManageCatalog && !canDelete)
      return showToast("⚠️ ليس لديك صلاحية حذف الأصناف");
    const label = item.nameAr || item.nameEn || item.code;
    if (!(await confirmAction(`حذف الصنف "${label}" من قائمة الأصناف المخزنة؟`)))
      return;

    setSyncStatus?.("syncing");
    try {
      const nextCatalog = cateringItems.filter(
        (x) => String(x.id) !== String(item.id)
      );
      setCateringItems(nextCatalog);
      await cateringItemsAPI.saveAll(nextCatalog);
      showToast("✅ تم حذف الصنف من القائمة المخزنة", "info");
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("فشل الحذف: " + e.message);
      setSyncStatus?.("error");
    }
  };

  /* Save an unstored legacy item from a template/order directly into the catalog */
  const handleSaveLegacyItemToCatalog = async (scope, rowIdx, entry) => {
    const raw = String(entry?.item || "").trim();
    if (!raw) return;
    const hasArabic = /[\u0600-\u06FF]/.test(raw);
    const newItem = {
      id: `cat_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      code: generateNextItemCode(),
      nameAr: hasArabic ? raw : "",
      nameEn: !hasArabic ? raw : "",
      category: "HOT_MEAL",
      unit: entry?.unit || "وجبة / Meal",
      defaultQty: entry?.qty || "1 per pax",
      notes: "",
    };
    const nextCatalog = [...cateringItems, newItem];
    setCateringItems(nextCatalog);
    cateringItemsAPI.saveAll(nextCatalog).catch(() => {});

    const setter = scope === "template" ? setTemplateItems : setOrderItems;
    setter((prev) => {
      const next = [...prev];
      if (next[rowIdx]) {
        next[rowIdx] = buildMenuEntryFromCatalogItem(newItem, entry.qty);
      }
      return next;
    });
    showToast(`✅ تم حفظ "${raw}" في قائمة الأصناف المخزنة`, "success");
  };

  /* Sync / Import items from Dry Store & Existing Templates */
  const syncFromDryStoreAndTemplates = async () => {
    if (!canManageCatalog) return;
    setSyncStatus?.("syncing");
    try {
      const dryItems =
        (await dryStoreItemsAPI
          .list()
          .catch(() => readSheetCache("DryStoreItems", []))) || [];

      const existingKeys = new Set(
        cateringItems
          .flatMap((c) => [
            (c.nameAr || "").trim().toLowerCase(),
            (c.nameEn || "").trim().toLowerCase(),
            formatCatalogItemDisplay(c).toLowerCase(),
          ])
          .filter(Boolean)
      );

      const additions = [];

      dryItems.forEach((d, idx) => {
        const ar = String(d.nameAr || "").trim();
        const en = String(d.nameEn || "").trim();
        if (!ar && !en) return;
        const alreadyExists =
          (ar && existingKeys.has(ar.toLowerCase())) ||
          (en && existingKeys.has(en.toLowerCase()));
        if (!alreadyExists) {
          if (ar) existingKeys.add(ar.toLowerCase());
          if (en) existingKeys.add(en.toLowerCase());
          additions.push({
            id: `cat_dry_${Date.now()}_${idx}`,
            code: `DRY-${String(idx + 1).padStart(2, "0")}`,
            nameAr: ar,
            nameEn: en,
            category: String(d.category || "").includes("Hot")
              ? "HOT_BEVERAGE"
              : String(d.category || "").includes("Cold")
              ? "COLD_BEVERAGE"
              : String(d.category || "").includes("Snack")
              ? "SNACK"
              : "DRY_SERVICE",
            unit: d.unit || "قطعة / Piece",
            defaultQty: "1 per pax",
            notes: d.notes || "مستورد من المخزن الجاف",
          });
        }
      });

      templates.forEach((tpl) => {
        (tpl.items || []).forEach((it, idx) => {
          const raw = String(it?.item || "").trim();
          if (!raw || existingKeys.has(raw.toLowerCase())) return;
          existingKeys.add(raw.toLowerCase());
          const hasArabic = /[\u0600-\u06FF]/.test(raw);
          additions.push({
            id: `cat_tpl_${Date.now()}_${idx}`,
            code: `TPL-${String(additions.length + 1).padStart(2, "0")}`,
            nameAr: hasArabic ? raw : "",
            nameEn: !hasArabic ? raw : "",
            category: "HOT_MEAL",
            unit: it?.unit || "وجبة / Meal",
            defaultQty: it?.qty || "1 per pax",
            notes: `مستورد من القالب: ${tpl.name || ""}`,
          });
        });
      });

      if (additions.length === 0) {
        showToast("جميع أصناف القوالب والمخزن الجاف مضافة مسبقاً في الكتالوج");
        setSyncStatus?.("synced");
        return;
      }

      const nextCatalog = [...cateringItems, ...additions];
      setCateringItems(nextCatalog);
      await cateringItemsAPI.saveAll(nextCatalog);
      showToast(
        `✅ تم استيراد ${additions.length} صنف جديد إلى قائمة الأصناف المخزنة`,
        "success"
      );
      setSyncStatus?.("synced");
    } catch (e) {
      showToast("فشل الاستيراد: " + e.message);
      setSyncStatus?.("error");
    }
  };

  /* ═══ ORDERS — CRUD ═══ */
  const openNewOrder = () => {
    if (!canCreate) return showToast("⚠️ ليس لديك صلاحية");
    setOrderDraft({
      flightId: "",
      flightNo: "",
      date: new Date().toISOString().slice(0, 10),
      templateId: "",
      templateName: "",
      mealType: "LUNCH",
      paxCount: 0,
      crewCount: 0,
      specialMeals: "",
      status: "PENDING",
      notes: "",
      attachments: [],
    });
    setOrderItems([{ itemId: "", item: "", qty: "1 per pax" }]);
    setEditingOrder("new");
  };

  const openEditOrder = (o) => {
    if (!canEdit) return showToast("⚠️ ليس لديك صلاحية");
    setOrderDraft({ ...o });
    setOrderItems(
      o.items && o.items.length > 0
        ? o.items.map((x) => ({ ...x }))
        : [{ itemId: "", item: "", qty: "1 per pax" }]
    );
    setEditingOrder(o.id);
  };

  const applyTemplate = (templateId) => {
    if (!templateId) {
      setOrderDraft((prev) => ({
        ...prev,
        templateId: "",
        templateName: "",
      }));
      return;
    }
    const tpl = templates.find((x) => String(x.id) === String(templateId));
    if (!tpl) return;
    setOrderDraft((prev) => ({
      ...prev,
      templateId: tpl.id,
      templateName: tpl.name,
      mealType: tpl.mealType || prev.mealType,
    }));
    setOrderItems(
      tpl.items && tpl.items.length > 0
        ? tpl.items.map((x) => ({ ...x }))
        : [{ itemId: "", item: "", qty: "1 per pax" }]
    );
  };

  const saveOrder = async () => {
    if (!orderDraft.flightNo) return showToast("⚠️ اختر الرحلة");
    if (!orderItems.some((i) => i && i.item))
      return showToast("⚠️ اختر صنفاً واحداً على الأقل من القائمة");
    setSyncStatus?.("syncing");
    try {
      const finalDraft = {
        ...orderDraft,
        items: orderItems.filter((i) => i && i.item),
        updatedBy: effectiveUser?.fullName || effectiveUser?.username || "",
      };
      if (editingOrder === "new") {
        const created = await cateringOrdersAPI.create(finalDraft);
        setOrders([...orders, { ...finalDraft, id: created.id }]);
      } else {
        await cateringOrdersAPI.update(editingOrder, finalDraft);
        setOrders(
          orders.map((o) =>
            o.id === editingOrder ? { ...finalDraft, id: editingOrder } : o
          )
        );
      }
      setEditingOrder(null);
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ طلب التموين بنجاح", "success");
    } catch (e) {
      showToast("فشل: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const removeOrder = async (id) => {
    if (!canDelete) return showToast("⚠️ ليس لديك صلاحية");
    if (!(await confirmAction("حذف طلب التموين؟"))) return;
    try {
      await cateringOrdersAPI.remove(id);
      setOrders(orders.filter((o) => o.id !== id));
    } catch (e) {
      showToast("فشل: " + e.message);
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    if (!canEdit) return;
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    try {
      await cateringOrdersAPI.update(id, { ...order, status: newStatus });
      setOrders(
        orders.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
      );
    } catch (e) {
      showToast("فشل: " + e.message);
    }
  };

  /* ═══ TEMPLATES — CRUD ═══ */
  const openNewTemplate = (prefillItems = null) => {
    if (!canEdit && !canCreate) return showToast("⚠️ ليس لديك صلاحية");
    setTemplateDraft({
      name: "",
      mealType: orderDraft?.mealType || "LUNCH",
      notes: "",
    });
    setTemplateItems(
      Array.isArray(prefillItems) && prefillItems.length > 0
        ? prefillItems.map((x) => ({ ...x }))
        : [{ itemId: "", item: "", qty: "1 per pax" }]
    );
    setEditingTemplate("new");
  };

  const openEditTemplate = (tpl) => {
    if (!canEdit && !canCreate) return showToast("⚠️ ليس لديك صلاحية");
    setTemplateDraft({ ...tpl });
    setTemplateItems(
      tpl.items && tpl.items.length > 0
        ? tpl.items.map((x) => ({ ...x }))
        : [{ itemId: "", item: "", qty: "1 per pax" }]
    );
    setEditingTemplate(tpl.id);
  };

  const saveTemplate = async () => {
    if (!templateDraft.name) return showToast("⚠️ أدخل اسم القالب");
    if (!templateItems.some((i) => i && i.item))
      return showToast("⚠️ اختر صنفاً واحداً على الأقل من القائمة المخزنة");
    setSyncStatus?.("syncing");
    try {
      const cleanedItems = templateItems.filter((i) => i && i.item);
      const finalDraft = {
        ...templateDraft,
        items: cleanedItems,
      };
      let savedId = editingTemplate;
      if (editingTemplate === "new") {
        const created = await cateringTemplatesAPI.create(finalDraft);
        savedId = created.id;
        const createdTpl = { ...finalDraft, id: savedId };
        setTemplates((prev) => [...prev, createdTpl]);

        // If an Order Modal is currently open in the background, link & apply this newly created template
        if (editingOrder) {
          setOrderDraft((prev) => ({
            ...prev,
            templateId: savedId,
            templateName: finalDraft.name,
            mealType: finalDraft.mealType || prev.mealType,
          }));
          setOrderItems(cleanedItems.map((x) => ({ ...x })));
        }
      } else {
        await cateringTemplatesAPI.update(editingTemplate, finalDraft);
        setTemplates((prev) =>
          prev.map((x) =>
            String(x.id) === String(editingTemplate)
              ? { ...finalDraft, id: editingTemplate }
              : x
          )
        );
        // If an Order Modal is open and using this template, refresh its items too
        if (
          editingOrder &&
          String(orderDraft.templateId) === String(editingTemplate)
        ) {
          setOrderDraft((prev) => ({
            ...prev,
            templateName: finalDraft.name,
            mealType: finalDraft.mealType || prev.mealType,
          }));
          setOrderItems(cleanedItems.map((x) => ({ ...x })));
        }
      }
      setEditingTemplate(null);
      setSyncStatus?.("synced");
      showToast("✅ تم حفظ القالب بنجاح", "success");
    } catch (e) {
      showToast("فشل: " + e.message);
      setSyncStatus?.("error");
    }
  };

  const removeTemplate = async (id) => {
    if (!canDelete) return showToast("⚠️ ليس لديك صلاحية");
    if (!(await confirmAction("حذف هذا القالب؟"))) return;
    try {
      await cateringTemplatesAPI.remove(id);
      setTemplates(templates.filter((x) => x.id !== id));
    } catch (e) {
      showToast("فشل: " + e.message);
    }
  };

  /* ═══ Upload PDF ═══ */
  const uploadPdf = async (e, setDraft) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showToast("⚠️ الحد الأقصى 5 MB");
    try {
      const result = await uploadFile(file, "catering");
      setDraft((prev) => ({
        ...prev,
        attachments: [
          ...(prev.attachments || []),
          {
            name: file.name,
            url: result.fileUrl,
            size: result.size,
            type: file.type,
          },
        ],
      }));
    } catch (err) {
      showToast("فشل الرفع: " + err.message);
    }
    e.target.value = "";
  };

  /* ═══ Filtered Orders & Filtered Stored Catalog ═══ */
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          `${o.flightNo || ""} ${o.templateName || ""}`
            .toLowerCase()
            .includes(q);
        const matchStatus = !statusFilter || o.status === statusFilter;
        const matchDate = !dateFilter || o.date === dateFilter;
        return matchSearch && matchStatus && matchDate;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [orders, search, statusFilter, dateFilter]);

  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return cateringItems.filter((item) => {
      const matchCat =
        catalogCategoryFilter === "ALL" ||
        item.category === catalogCategoryFilter;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        (item.nameAr || "").toLowerCase().includes(q) ||
        (item.nameEn || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.notes || "").toLowerCase().includes(q)
      );
    });
  }, [cateringItems, catalogSearch, catalogCategoryFilter]);

  /* ═══ Counters ═══ */
  const counters = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    confirmed: orders.filter((o) => o.status === "CONFIRMED").length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
  };

  if (!canView) {
    return (
      <div className="rounded-xl p-8 text-center" style={cardStyle}>
        <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-amber-500" />
        <div
          className="font-bold text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          ليس لديك صلاحية عرض التموين / No permission to view Catering
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* ═══ Header ═══ */}
      <div className="rounded-xl p-3" style={cardStyle}>
        <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md"
              style={{ background: "var(--brand-gradient)" }}
            >
              <UtensilsCrossed className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {t.catering || "Catering / التموين"}
              </h2>
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {counters.total} طلبية · {templates.length} قالب ·{" "}
                {cateringItems.length} صنف مخزن
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManageCatalog && activeTab !== "dry_store" && (
              <button
                type="button"
                onClick={() => openAddStoredItemModal(null, "")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                  activeTab === "items_catalog"
                    ? "text-white"
                    : "border hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={
                  activeTab === "items_catalog"
                    ? { background: "var(--brand-gradient)" }
                    : {
                        borderColor: "var(--border-default)",
                        color: "var(--text-primary)",
                      }
                }
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف مخزن / Add Item</span>
              </button>
            )}

            {activeTab === "orders" && canCreate && (
              <button
                type="button"
                onClick={openNewOrder}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> طلبية جديدة / New Order
              </button>
            )}

            {activeTab === "templates" && (canEdit || canCreate) && (
              <button
                type="button"
                onClick={() => openNewTemplate()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white whitespace-nowrap shrink-0"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Plus className="w-4 h-4" /> قالب جديد / New Template
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex flex-wrap gap-1 border-b mb-3"
          style={{ borderColor: "var(--border-default)" }}
        >
          {[
            { id: "orders", label: "طلبات الوجبات / Orders", icon: Plane },
            {
              id: "templates",
              label: `مكتبة القوالب / Templates (${templates.length})`,
              icon: FileText,
            },
            {
              id: "items_catalog",
              label: `الأصناف المخزنة / Items Catalog (${cateringItems.length})`,
              icon: Tag,
            },
            {
              id: "dry_store",
              label: "مخزن التموين الجاف / Dry Store",
              icon: Package,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition"
                style={{
                  borderColor: active ? "var(--brand-primary)" : "transparent",
                  color: active ? "var(--brand-primary)" : "var(--text-muted)",
                  backgroundColor: active ? "var(--bg-app)" : "transparent",
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters (Orders only) */}
        {activeTab === "orders" && (
          <>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برقم الرحلة أو اسم القالب..."
                  className="ps-9"
                />
              </div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-auto"
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-auto"
              >
                <option value="">All Statuses / كل الحالات</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>

            <div
              className="flex flex-wrap gap-3 mt-3 pt-3 border-t text-[11px] font-mono"
              style={{ borderColor: "var(--border-default)" }}
            >
              <span>
                Pending: <b>{counters.pending}</b>
              </span>
              <span>
                Confirmed: <b>{counters.confirmed}</b>
              </span>
              <span>
                Delivered: <b>{counters.delivered}</b>
              </span>
              <span className="ms-auto">
                Showing {filteredOrders.length} / {counters.total}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ═══ TAB 1: ORDERS ═══ */}
      {activeTab === "orders" && (
        <>
          {loading && orders.length === 0 ? (
            <div
              className="text-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              جاري التحميل... / Loading...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 rounded-xl space-y-3" style={cardStyle}>
              <UtensilsCrossed
                className="w-12 h-12 mx-auto opacity-30"
                style={{ color: "var(--text-muted)" }}
              />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                لا توجد طلبيات تموين مسجلة حالياً / No catering orders yet
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={openNewOrder}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-4 h-4" /> إنشاء أول طلبية تموين
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredOrders.map((o) => {
                const sc = STATUS_COLORS[o.status] || STATUS_COLORS.PENDING;
                return (
                  <div key={o.id} className="rounded-xl p-4" style={cardStyle}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Plane
                            className="w-4 h-4"
                            style={{ color: "var(--brand-primary)" }}
                          />
                          <span
                            className="font-bold font-mono"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {o.flightNo}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <div
                          className="text-xs flex flex-wrap gap-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span className="font-mono">{fmtDate(o.date)}</span>
                          <span className="font-mono">
                            · {o.paxCount} PAX + {o.crewCount} Crew
                          </span>
                          <span>· {o.mealType}</span>
                        </div>
                        {o.templateName && (
                          <div
                            className="text-[11px] mt-1 font-semibold"
                            style={{ color: "var(--brand-primary)" }}
                          >
                            القالب: {o.templateName}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="mt-2 space-y-1">
                      {(o.items || []).map((m, i) => (
                        <div
                          key={i}
                          className="p-1.5 rounded text-xs flex justify-between items-center gap-2"
                          style={innerBoxStyle}
                        >
                          <span
                            className="truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            • {m.item}
                          </span>
                          <span
                            className="font-mono text-[10px] shrink-0"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {m.qty}
                          </span>
                        </div>
                      ))}
                    </div>

                    {o.specialMeals && (
                      <div className="mt-2 p-2 rounded text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        ⚠️ {o.specialMeals}
                      </div>
                    )}

                    {o.notes && (
                      <div
                        className="mt-1 text-xs italic"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {o.notes}
                      </div>
                    )}

                    {Array.isArray(o.attachments) && o.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {o.attachments.map((att, ai) => (
                          <button
                            key={ai}
                            type="button"
                            onClick={() =>
                              openPreviewModal({
                                title: att.name || "Attachment",
                                blobUrl: att.url,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold border transition hover:opacity-80"
                            style={{
                              backgroundColor: "var(--bg-app)",
                              borderColor: "var(--border-default)",
                              color: "var(--brand-primary)",
                            }}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[160px]">
                              {att.name || `File ${ai + 1}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div
                      className="flex flex-wrap gap-1 mt-3 pt-2 border-t"
                      style={{ borderColor: "var(--border-default)" }}
                    >
                      {o.status === "PENDING" && canEdit && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(o.id, "CONFIRMED")}
                          className="flex-1 py-1.5 rounded bg-sky-500/15 text-sky-500 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                        </button>
                      )}
                      {o.status === "CONFIRMED" && canEdit && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(o.id, "DELIVERED")}
                          className="flex-1 py-1.5 rounded bg-emerald-500/15 text-emerald-500 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrintingOrder(o)}
                        className="py-1.5 px-2 rounded bg-purple-500/15 text-purple-500 text-[11px]"
                        title="Print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEditOrder(o)}
                          className="py-1.5 px-2 rounded bg-amber-500/15 text-amber-500 text-[11px]"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => removeOrder(o.id)}
                          className="py-1.5 px-2 rounded bg-rose-500/15 text-rose-500 text-[11px]"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB 2: TEMPLATES LIBRARY ═══ */}
      {activeTab === "templates" && (
        <>
          {loading && templates.length === 0 ? (
            <div
              className="text-center py-12"
              style={{ color: "var(--text-muted)" }}
            >
              جاري التحميل... / Loading...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 rounded-xl space-y-3" style={cardStyle}>
              <FileText
                className="w-12 h-12 mx-auto opacity-30"
                style={{ color: "var(--text-muted)" }}
              />
              <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                لا توجد قوالب تموين بعد — أنشئ قالباً واختر أصنافه من القائمة المخزنة
              </div>
              {(canEdit || canCreate) && (
                <button
                  type="button"
                  onClick={() => openNewTemplate()}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-4 h-4" /> إنشاء قالب جديد
                </button>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-xl p-4" style={cardStyle}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div
                        className="font-bold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {tpl.name}
                      </div>
                      <div
                        className="text-xs font-mono"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {tpl.mealType} · {(tpl.items || []).length} أصناف
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 mt-3">
                    {(tpl.items || []).map((m, i) => (
                      <div
                        key={i}
                        className="p-1.5 rounded text-xs flex justify-between items-center gap-2"
                        style={innerBoxStyle}
                      >
                        <span
                          className="truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          • {m.item}
                        </span>
                        <span
                          className="font-mono text-[10px] shrink-0"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {m.qty}
                        </span>
                      </div>
                    ))}
                  </div>

                  {tpl.notes && (
                    <div
                      className="mt-2 text-xs italic"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {tpl.notes}
                    </div>
                  )}

                  <div
                    className="flex gap-1 mt-3 pt-2 border-t"
                    style={{ borderColor: "var(--border-default)" }}
                  >
                    {(canEdit || canCreate) && (
                      <button
                        type="button"
                        onClick={() => openEditTemplate(tpl)}
                        className="flex-1 py-1.5 rounded bg-amber-500/15 text-amber-500 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" /> تعديل القالب / Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => removeTemplate(tpl.id)}
                        className="py-1.5 px-2 rounded bg-rose-500/15 text-rose-500 text-[11px]"
                        title="حذف القالب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB 3: PRE-STORED ITEMS CATALOG (قائمة الأصناف المخزنة مسبقاً) ═══ */}
      {activeTab === "items_catalog" && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div
            className="rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
            style={cardStyle}
          >
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
                  style={{ color: "var(--text-muted)" }}
                />
                <Input
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="بحث باسم الصنف بالعربي أو الإنجليزي أو الرمز..."
                  className="ps-9 h-9 text-xs"
                />
              </div>
              <div className="min-w-[200px]">
                <Select
                  value={catalogCategoryFilter}
                  onChange={(e) => setCatalogCategoryFilter(e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="ALL">
                    جميع التصنيفات ({cateringItems.length})
                  </option>
                  {ITEM_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {canManageCatalog && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={syncFromDryStoreAndTemplates}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
                  style={{
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                  title="استيراد أي أصناف مسجلة في المخزن الجاف أو القوالب السابقة إلى الكتالوج"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>استيراد من المخزن الجاف والقوالب</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddStoredItemModal(null, "")}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة صنف جديد</span>
                </button>
              </div>
            )}
          </div>

          {/* Stored Items Table */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor: "var(--border-default)",
                      backgroundColor: "var(--bg-app)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <th className="py-2.5 px-3 text-start font-semibold w-24">
                      الرمز
                    </th>
                    <th className="py-2.5 px-3 text-start font-semibold">
                      اسم الصنف المخزن (عربي / English)
                    </th>
                    <th className="py-2.5 px-3 text-start font-semibold">
                      التصنيف
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold">
                      الوحدة
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold">
                      الكمية الافتراضية بالقالب
                    </th>
                    <th className="py-2.5 px-3 text-start font-semibold">
                      ملاحظات
                    </th>
                    {canManageCatalog && (
                      <th className="py-2.5 px-3 text-end font-semibold w-28">
                        إجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody
                  className="divide-y"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  {filteredCatalogItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-10 text-center space-y-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div>لا توجد أصناف مخزنة مطابقة للبحث</div>
                        {canManageCatalog && (
                          <button
                            type="button"
                            onClick={() =>
                              openAddStoredItemModal(null, catalogSearch)
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1"
                            style={{ background: "var(--brand-primary)" }}
                          >
                            <Plus className="w-3.5 h-3.5" /> إضافة صنف مخزن جديد
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredCatalogItems.map((item, index) => (
                      <tr
                        key={item.id}
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-sky-600 dark:text-sky-400">
                          {item.code || `CAT-${index + 1}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <div
                            className="font-bold text-sm"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {item.nameAr || item.nameEn}
                          </div>
                          {item.nameAr && item.nameEn && (
                            <div
                              className="text-[11px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {item.nameEn}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/5 font-medium">
                            {getCategoryShortLabel(item.category)}
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3 text-center font-medium"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                            {item.defaultQty || "1 per pax"}
                          </span>
                        </td>
                        <td
                          className="py-2.5 px-3 text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {item.notes || "—"}
                        </td>
                        {canManageCatalog && (
                          <td className="py-2.5 px-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditStoredItemModal(item)}
                                className="p-1.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition"
                                title="تعديل الصنف"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteStoredItem(item)}
                                className="p-1.5 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white transition"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 4: DRY STORE ═══ */}
      {activeTab === "dry_store" && (
        <CateringDryStore
          flights={flights}
          settings={settings}
          user={effectiveUser}
        />
      )}

      {/* ═══ ORDER MODAL (إضافة / تعديل طلبية تموين) ═══ */}
      <Modal
        open={!!editingOrder}
        title={
          editingOrder === "new"
            ? "إضافة طلبية تموين جديدة / New Catering Order"
            : "تعديل طلبية التموين / Edit Catering Order"
        }
        onClose={() => setEditingOrder(null)}
        wide
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingOrder(null)}
              className="px-4 py-2 rounded-lg text-sm font-bold border"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-muted)",
              }}
            >
              إلغاء / Cancel
            </button>
            <button
              type="button"
              onClick={saveOrder}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{ background: "var(--brand-gradient)" }}
            >
              <Save className="w-4 h-4" /> حفظ الطلبية / Save Order
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Flight + Date + Template */}
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="الرحلة / Flight *">
              <Select
                value={orderDraft.flightNo || ""}
                onChange={(e) => {
                  const flight = flights.find(
                    (f) => f.flightNo === e.target.value
                  );
                  setOrderDraft({
                    ...orderDraft,
                    flightNo: e.target.value,
                    flightId: flight?.id || "",
                    date: flight?.std
                      ? String(flight.std).slice(0, 10)
                      : orderDraft.date,
                    paxCount: flight?.pax ?? orderDraft.paxCount,
                    crewCount:
                      (flight?.crewSlots || []).length || orderDraft.crewCount,
                  });
                }}
              >
                <option value="">— اختر الرحلة / Select Flight —</option>
                {flights.map((f) => (
                  <option key={f.id} value={f.flightNo}>
                    {f.flightNo} — {f.dep} → {f.arr}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="التاريخ / Date">
              <Input
                type="date"
                value={orderDraft.date || ""}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, date: e.target.value })
                }
              />
            </Field>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  تحديد القالب / Apply Template
                </label>
                {(canEdit || canCreate) && (
                  <div className="flex items-center gap-1.5">
                    {orderDraft.templateId && (
                      <button
                        type="button"
                        onClick={() => {
                          const found = templates.find(
                            (x) =>
                              String(x.id) === String(orderDraft.templateId)
                          );
                          if (found) openEditTemplate(found);
                        }}
                        className="text-[10px] font-bold text-amber-500 hover:underline"
                      >
                        تعديل القالب
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openNewTemplate(
                          orderItems.filter((x) => x && x.item)
                        )
                      }
                      className="text-[10px] font-bold hover:underline"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      + قالب جديد
                    </button>
                  </div>
                )}
              </div>
              <Select
                value={orderDraft.templateId || ""}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">
                  — يدوي (اختيار مباشر من الأصناف المخزنة) —
                </option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.mealType} · {(tpl.items || []).length}{" "}
                    أصناف)
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Meal + PAX + Crew + Status */}
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="نوع الوجبة / Meal Type">
              <Select
                value={orderDraft.mealType || "LUNCH"}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, mealType: e.target.value })
                }
              >
                {MEAL_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الركاب / PAX">
              <Input
                type="number"
                value={orderDraft.paxCount || 0}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, paxCount: +e.target.value })
                }
              />
            </Field>
            <Field label="الطاقم / Crew">
              <Input
                type="number"
                value={orderDraft.crewCount || 0}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, crewCount: +e.target.value })
                }
              />
            </Field>
            <Field label="الحالة / Status">
              <Select
                disabled={!canEdit && editingOrder === "new"}
                value={orderDraft.status || "PENDING"}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, status: e.target.value })
                }
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </Field>
          </div>

          {/* Stored Menu Items Picker */}
          <StoredMenuItemsEditor
            items={orderItems}
            setItems={setOrderItems}
            catalogItems={cateringItems}
            canManageCatalog={canManageCatalog}
            label="أصناف الطلبية (من قائمة الأصناف المخزنة)"
            onOpenQuickAddItem={(targetIdx, initialName) =>
              openAddStoredItemModal(
                { scope: "order", targetIdx },
                initialName
              )
            }
            onSaveLegacyItemToCatalog={(rowIdx, entry) =>
              handleSaveLegacyItemToCatalog("order", rowIdx, entry)
            }
          />

          {/* Special + Notes */}
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="وجبات خاصة / Special Meals">
              <Input
                value={orderDraft.specialMeals || ""}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, specialMeals: e.target.value })
                }
                placeholder="مثال: 2 نباتي، 1 قليل الملح / 2 vegetarian"
              />
            </Field>
            <Field label="ملاحظات / Notes">
              <Input
                value={orderDraft.notes || ""}
                onChange={(e) =>
                  setOrderDraft({ ...orderDraft, notes: e.target.value })
                }
              />
            </Field>
          </div>

          {/* Attachments */}
          <div>
            <h4 className="text-sm font-bold mb-2">المرفقات / Attachments</h4>
            {(orderDraft.attachments || []).map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 mb-1 rounded text-xs"
                style={innerBoxStyle}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span
                  className="flex-1 truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {att.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    openPreviewModal({ title: "Attachment", blobUrl: att.url })
                  }
                  className="text-sky-500 font-bold px-1"
                >
                  معاينة
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setOrderDraft({
                      ...orderDraft,
                      attachments: orderDraft.attachments.filter(
                        (_, idx) => idx !== i
                      ),
                    })
                  }
                  className="text-rose-500 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <label
              className="flex items-center justify-center gap-2 p-2 rounded cursor-pointer border-2 border-dashed text-xs font-bold"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--brand-primary)",
              }}
            >
              <Upload className="w-4 h-4" /> رفع مرفق PDF أو صورة / Upload File
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => uploadPdf(e, setOrderDraft)}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </Modal>

      {/* ═══ TEMPLATE MODAL (إضافة / تعديل قالب تموين — z-[60] فوق الطلبية إن لزم) ═══ */}
      {!!editingTemplate && (
        <div
          className="fixed inset-0 bg-black/55 z-[60] flex items-center justify-center p-4 fade-in"
          onClick={() => setEditingTemplate(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                {editingTemplate === "new"
                  ? "إنشاء قالب تموين جديد / New Catering Template"
                  : "تعديل قالب التموين / Edit Catering Template"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <Field label="اسم القالب / Template Name *">
                  <Input
                    value={templateDraft.name || ""}
                    onChange={(e) =>
                      setTemplateDraft({
                        ...templateDraft,
                        name: e.target.value,
                      })
                    }
                    placeholder="مثال: قالب غداء الضيافة القياسي / Standard Lunch"
                  />
                </Field>
                <Field label="نوع الوجبة / Meal Type">
                  <Select
                    value={templateDraft.mealType || "LUNCH"}
                    onChange={(e) =>
                      setTemplateDraft({
                        ...templateDraft,
                        mealType: e.target.value,
                      })
                    }
                  >
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Stored Menu Items Picker inside Template */}
              <StoredMenuItemsEditor
                items={templateItems}
                setItems={setTemplateItems}
                catalogItems={cateringItems}
                canManageCatalog={canManageCatalog}
                label="أصناف القالب (اختر من قائمة الأصناف المخزنة)"
                onOpenQuickAddItem={(targetIdx, initialName) =>
                  openAddStoredItemModal(
                    { scope: "template", targetIdx },
                    initialName
                  )
                }
                onSaveLegacyItemToCatalog={(rowIdx, entry) =>
                  handleSaveLegacyItemToCatalog("template", rowIdx, entry)
                }
              />

              <Field label="ملاحظات القالب / Notes">
                <Input
                  value={templateDraft.notes || ""}
                  onChange={(e) =>
                    setTemplateDraft({
                      ...templateDraft,
                      notes: e.target.value,
                    })
                  }
                  placeholder="ملاحظات إضافية حول القالب..."
                />
              </Field>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء / Cancel
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Save className="w-4 h-4" /> حفظ القالب / Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD / EDIT PRE-STORED ITEM MODAL (آلية إضافة الصنف المخزن — z-[70]) ═══ */}
      {showStoredItemModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 fade-in"
          onClick={() => {
            setShowStoredItemModal(false);
            setEditingStoredItem(null);
            setQuickAddContext(null);
          }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  {editingStoredItem
                    ? "تعديل صنف مخزن / Edit Stored Item"
                    : "إضافة صنف جديد للقائمة المخزنة / Add Stored Item"}
                </h3>
                {quickAddContext && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    سيتم حفظ الصنف في الكتالوج واختياره تلقائياً في{" "}
                    {quickAddContext.scope === "template" ? "القالب" : "الطلبية"}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowStoredItemModal(false);
                  setEditingStoredItem(null);
                  setQuickAddContext(null);
                }}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="اسم الصنف بالعربية *">
                    <Input
                      autoFocus
                      value={storedItemDraft.nameAr}
                      onChange={(e) =>
                        setStoredItemDraft({
                          ...storedItemDraft,
                          nameAr: e.target.value,
                        })
                      }
                      placeholder="مثال: وجبة دجاج مشوي مع الأرز"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="الرمز (اختياري)">
                    <Input
                      value={storedItemDraft.code}
                      onChange={(e) =>
                        setStoredItemDraft({
                          ...storedItemDraft,
                          code: e.target.value,
                        })
                      }
                      placeholder="CAT-01"
                      className="font-mono"
                    />
                  </Field>
                </div>
              </div>

              <Field label="اسم الصنف بالإنجليزية / English Name">
                <Input
                  value={storedItemDraft.nameEn}
                  onChange={(e) =>
                    setStoredItemDraft({
                      ...storedItemDraft,
                      nameEn: e.target.value,
                    })
                  }
                  placeholder="e.g., Grilled Chicken with Rice"
                />
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="التصنيف / Category">
                  <Select
                    value={storedItemDraft.category}
                    onChange={(e) =>
                      setStoredItemDraft({
                        ...storedItemDraft,
                        category: e.target.value,
                      })
                    }
                  >
                    {ITEM_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="الوحدة / Unit">
                  <Select
                    value={storedItemDraft.unit}
                    onChange={(e) =>
                      setStoredItemDraft({
                        ...storedItemDraft,
                        unit: e.target.value,
                      })
                    }
                  >
                    {ITEM_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="الكمية الافتراضية عند الاختيار">
                  <Input
                    value={storedItemDraft.defaultQty}
                    onChange={(e) =>
                      setStoredItemDraft({
                        ...storedItemDraft,
                        defaultQty: e.target.value,
                      })
                    }
                    placeholder="مثال: 1 per pax"
                    className="font-mono"
                  />
                </Field>
                <Field label="اختيار سريع للتوزيع">
                  <Select
                    value={
                      QTY_PRESETS.some(
                        (p) => p.value === storedItemDraft.defaultQty
                      )
                        ? storedItemDraft.defaultQty
                        : ""
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        setStoredItemDraft({
                          ...storedItemDraft,
                          defaultQty: e.target.value,
                        });
                      }
                    }}
                  >
                    <option value="">— اختر توزيعاً قياسياً —</option>
                    {QTY_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="ملاحظات / وصف إضافي">
                <Input
                  value={storedItemDraft.notes}
                  onChange={(e) =>
                    setStoredItemDraft({
                      ...storedItemDraft,
                      notes: e.target.value,
                    })
                  }
                  placeholder="تفاصيل المكونات أو التقديم..."
                />
              </Field>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowStoredItemModal(false);
                  setEditingStoredItem(null);
                  setQuickAddContext(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold border"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-muted)",
                }}
              >
                إلغاء / Cancel
              </button>
              <button
                type="button"
                onClick={saveStoredItem}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
                style={{ background: "var(--brand-gradient)" }}
              >
                <Save className="w-4 h-4" />
                <span>
                  {quickAddContext
                    ? "حفظ في الكتالوج واختياره"
                    : "حفظ الصنف المخزن"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PRINT MODAL ═══ */}
      {printingOrder && (
        <CateringPrintModal
          order={printingOrder}
          flight={flights.find(
            (f) =>
              f.id === printingOrder.flightId ||
              f.flightNo === printingOrder.flightNo
          )}
          settings={settings}
          user={effectiveUser}
          onClose={() => setPrintingOrder(null)}
        />
      )}
    </div>
  );
}

export default CateringModule;
