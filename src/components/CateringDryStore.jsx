/* ═══════════════════════════════════════════════════════════
 * CATERING DRY STORE (مخزن التموين الجاف)
 * Inventory management for dry catering goods:
 * - Stock-In (توريد واستلام رصيد مخزني)
 * - Stock-Out (صرف لحساب رحلة محددة مع الربط بالرحلات)
 * - Minimum threshold & low stock warnings
 * - Movement ledger (سجل حركة الوارد والمنصرف)
 * - Official inventory printout with stamp permission support
 * ═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Search,
  Filter,
  Printer,
  History,
  Plane,
  Layers,
  Edit,
  Trash2,
  CheckCircle2,
  Calendar,
  User,
  ShieldCheck,
  Stamp,
  FileX,
  Lock,
  Tag,
  Building2,
} from "lucide-react";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { Modal } from "./ui/Modal";
import { showToast, confirmAction, printHTMLContent } from "../utils/dialog";
import { can as checkPerm } from "../config/permissions";
import {
  dryStoreItemsAPI,
  dryStoreLedgerAPI,
  readSheetCache,
  toDisplayImageUrl,
} from "../api";

const STORAGE_KEY_ITEMS = "aeroops.dry_store_items";
const STORAGE_KEY_LEDGER = "aeroops.dry_store_ledger";

const DEFAULT_CATEGORIES = [
  "Hot Beverages / المشروبات الساخنة",
  "Cold Beverages / العصائر والمياه",
  "Snacks & Dry Food / المقرمشات والوجبات الخفيفة",
  "Paper & Disposables / الأكواب والمحارم الورقية",
  "Cutlery & Service / أدوات التقديم والملاعق",
  "Amenities & Cleaning / المستلزمات والنظافة",
];

const INITIAL_ITEMS = [
  {
    id: "item-1",
    nameAr: "نسكافيه سريع التحضير (أظرف)",
    nameEn: "Nescafe Instant Coffee Sachets",
    category: "Hot Beverages / المشروبات الساخنة",
    unit: "ظرف / Sachet",
    currentStock: 450,
    minThreshold: 100,
    binLocation: "A-01",
    notes: "علب 100 ظرف",
  },
  {
    id: "item-2",
    nameAr: "شاي ليبتون أسود (ميداليات)",
    nameEn: "Lipton Black Tea Bags",
    category: "Hot Beverages / المشروبات الساخنة",
    unit: "كيس / Bag",
    currentStock: 600,
    minThreshold: 150,
    binLocation: "A-02",
    notes: "كرتون أصفر",
  },
  {
    id: "item-3",
    nameAr: "سكر أبيض (أظرف فردية)",
    nameEn: "White Sugar Sachets",
    category: "Hot Beverages / المشروبات الساخنة",
    unit: "ظرف / Sachet",
    currentStock: 1200,
    minThreshold: 300,
    binLocation: "A-03",
    notes: "5 جرام للظرف",
  },
  {
    id: "item-4",
    nameAr: "مياه معدنية 330 مل",
    nameEn: "Mineral Water 330ml Bottles",
    category: "Cold Beverages / العصائر والمياه",
    unit: "قارورة / Bottle",
    currentStock: 72,
    minThreshold: 120, // Low stock trigger!
    binLocation: "B-01",
    notes: "كراتين 24 عبوة",
  },
  {
    id: "item-5",
    nameAr: "أكواب ورقية 8 أونصة لشاي وقهوة",
    nameEn: "Paper Cups 8oz (Hot Drinks)",
    category: "Paper & Disposables / الأكواب والمحارم الورقية",
    unit: "كوب / Cup",
    currentStock: 850,
    minThreshold: 200,
    binLocation: "C-01",
    notes: "مع أغطية عازلة",
  },
  {
    id: "item-6",
    nameAr: "أطقم شوك وسكاكين بلاستيك مغلفة",
    nameEn: "Sealed Plastic Cutlery Pack",
    category: "Cutlery & Service / أدوات التقديم والملاعق",
    unit: "طقم / Set",
    currentStock: 320,
    minThreshold: 100,
    binLocation: "C-02",
    notes: "ملعقة + شوكة + محرمة + مسواك",
  },
  {
    id: "item-7",
    nameAr: "مكسرات ومقرمشات مشكلة (أكياس طيران)",
    nameEn: "Aviation Mixed Nuts 30g",
    category: "Snacks & Dry Food / المقرمشات والوجبات الخفيفة",
    unit: "كيس / Pack",
    currentStock: 45,
    minThreshold: 80, // Low stock trigger!
    binLocation: "D-01",
    notes: "خاص بدرجة الضيافة ورجال الأعمال",
  },
  {
    id: "item-8",
    nameAr: "محارم معطرة لليدين (مغلفة)",
    nameEn: "Refreshing Wet Wipes",
    category: "Amenities & Cleaning / المستلزمات والنظافة",
    unit: "حبة / Piece",
    currentStock: 500,
    minThreshold: 150,
    binLocation: "D-02",
    notes: "برائحة الليمون الخفيف",
  },
];

const INITIAL_LEDGER = [
  {
    id: "tx-1",
    type: "IN",
    itemId: "item-4",
    itemName: "مياه معدنية 330 مل / Mineral Water 330ml",
    qty: 120,
    ref: "SkyCatering Wholesaler - PO#8841",
    flightNo: "",
    recipient: "مخزن التموين الرئيسي",
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    operator: "Admin",
    notes: "استلام دفعة جديدة من المورد",
  },
  {
    id: "tx-2",
    type: "OUT",
    itemId: "item-4",
    itemName: "مياه معدنية 330 مل / Mineral Water 330ml",
    qty: 48,
    ref: "Flight Catering Dispatch",
    flightNo: "AW-102",
    recipient: "طاقم الضيافة (Senior Purser)",
    date: new Date(Date.now() - 86400000).toISOString(),
    operator: "Catering Agent",
    notes: "صرف لرحلة الذهاب والعودة",
  },
];

export function CateringDryStore({ flights = [], settings = {}, user }) {
  const [items, setItems] = useState(() => {
    const cachedSheet = readSheetCache("DryStoreItems", null);
    if (Array.isArray(cachedSheet) && cachedSheet.length > 0) return cachedSheet;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_ITEMS;
  });

  const [ledger, setLedger] = useState(() => {
    const cachedSheet = readSheetCache("DryStoreLedger", null);
    if (Array.isArray(cachedSheet) && cachedSheet.length > 0) return cachedSheet;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LEDGER);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_LEDGER;
  });

  // Navigation inside Dry Store
  const [subTab, setSubTab] = useState("inventory"); // "inventory" | "ledger"
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Modals
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printWithStamp, setPrintWithStamp] = useState(false);

  // Forms Drafts
  const [stockInDraft, setStockInDraft] = useState({
    itemId: "",
    qty: "",
    source: "",
    batchNo: "",
    notes: "",
  });

  const [stockOutDraft, setStockOutDraft] = useState({
    itemId: "",
    flightId: "",
    flightNo: "",
    qty: "",
    recipient: "",
    notes: "",
  });

  const [itemDraft, setItemDraft] = useState({
    nameAr: "",
    nameEn: "",
    category: DEFAULT_CATEGORIES[0],
    unit: "قطعة / Piece",
    currentStock: 0,
    minThreshold: 50,
    binLocation: "",
    notes: "",
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {}
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(ledger));
    } catch (e) {}
  }, [ledger]);

  // Sync with Google Sheets ("DryStoreItems" & "DryStoreLedger")
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [remoteItems, remoteLedger] = await Promise.all([
          dryStoreItemsAPI.list().catch(() => null),
          dryStoreLedgerAPI.list().catch(() => null),
        ]);
        if (!active) return;

        if (Array.isArray(remoteItems)) {
          if (remoteItems.length > 0) {
            setItems(remoteItems);
          } else {
            // Seed initial items into Google Sheets once so all devices share the same IDs
            const seeded = [];
            for (const item of items) {
              try {
                const res = await dryStoreItemsAPI.create(item);
                seeded.push({ ...item, id: String(res?.id || item.id) });
              } catch {
                seeded.push(item);
              }
            }
            if (active && seeded.length > 0) {
              setItems(seeded);
            }
          }
        }

        if (Array.isArray(remoteLedger) && remoteLedger.length > 0) {
          setLedger(remoteLedger);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  // Permissions
  const canDryStore =
    checkPerm(user, "catering.dry_store") ||
    checkPerm(user, "catering.edit") ||
    checkPerm(user, "catering.create");

  const canPrintStamp = checkPerm(user, "catering.print_with_stamp");
  const canPrintNoStamp = checkPerm(user, "catering.print_without_stamp");
  const canAnyPrint = canPrintStamp || canPrintNoStamp;

  // Sync stamp mode with user permissions
  useEffect(() => {
    if (printWithStamp && !canPrintStamp && canPrintNoStamp) {
      setPrintWithStamp(false);
    } else if (!printWithStamp && !canPrintNoStamp && canPrintStamp) {
      setPrintWithStamp(true);
    } else if (!canPrintStamp) {
      setPrintWithStamp(false);
    }
  }, [canPrintStamp, canPrintNoStamp, printWithStamp]);

  // Summary Metrics
  const lowStockItems = useMemo(
    () => items.filter((i) => Number(i.currentStock) <= Number(i.minThreshold)),
    [items]
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.currentStock) || 0), 0),
    [items]
  );

  const todayLedger = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return ledger.filter((l) => (l.date || "").startsWith(today));
  }, [ledger]);

  const todayIn = useMemo(
    () =>
      todayLedger
        .filter((l) => l.type === "IN")
        .reduce((sum, l) => sum + (Number(l.qty) || 0), 0),
    [todayLedger]
  );

  const todayOut = useMemo(
    () =>
      todayLedger
        .filter((l) => l.type === "OUT")
        .reduce((sum, l) => sum + (Number(l.qty) || 0), 0),
    [todayLedger]
  );

  // Filtered inventory
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (item.nameAr || "").toLowerCase().includes(q) ||
        (item.nameEn || "").toLowerCase().includes(q) ||
        (item.binLocation || "").toLowerCase().includes(q);
      const matchCat =
        categoryFilter === "ALL" || item.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [items, search, categoryFilter]);

  // Filtered ledger
  const filteredLedger = useMemo(() => {
    return ledger
      .filter((entry) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          (entry.itemName || "").toLowerCase().includes(q) ||
          (entry.flightNo || "").toLowerCase().includes(q) ||
          (entry.ref || "").toLowerCase().includes(q) ||
          (entry.recipient || "").toLowerCase().includes(q);
        const matchType = typeFilter === "ALL" || entry.type === typeFilter;
        return matchSearch && matchType;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [ledger, search, typeFilter]);

  // Handlers
  const handleOpenStockIn = (preselectedItem = null) => {
    setStockInDraft({
      itemId: preselectedItem ? preselectedItem.id : items[0]?.id || "",
      qty: "",
      source: "المستودع الرئيسي / Central Supplier",
      batchNo: "",
      notes: "",
    });
    setShowStockInModal(true);
  };

  const handleOpenStockOut = (preselectedItem = null) => {
    setStockOutDraft({
      itemId: preselectedItem ? preselectedItem.id : items[0]?.id || "",
      flightId: flights[0]?.id || "",
      flightNo: flights[0]?.flightNumber || flights[0]?.flightNo || "",
      qty: "",
      recipient: "طاقم الضيافة (Senior Purser)",
      notes: "",
    });
    setShowStockOutModal(true);
  };

  const submitStockIn = () => {
    const qty = parseInt(stockInDraft.qty, 10);
    if (!stockInDraft.itemId) return showToast("⚠️ يرجى اختيار الصنف", "warning");
    if (isNaN(qty) || qty <= 0)
      return showToast("⚠️ يرجى إدخال كمية واردة صحيحة", "warning");

    const targetItem = items.find((i) => i.id === stockInDraft.itemId);
    if (!targetItem) return;

    // Update item stock
    const newStockIn = (Number(targetItem.currentStock) || 0) + qty;
    const updatedItemIn = { ...targetItem, currentStock: newStockIn };
    const updatedItems = items.map((i) =>
      i.id === targetItem.id ? updatedItemIn : i
    );
    setItems(updatedItems);
    dryStoreItemsAPI.update(targetItem.id, updatedItemIn).catch(() => {});

    // Create ledger entry
    const newEntry = {
      id: "tx-" + Date.now(),
      type: "IN",
      itemId: targetItem.id,
      itemName: `${targetItem.nameAr} / ${targetItem.nameEn}`,
      qty,
      ref: stockInDraft.source || "توريد مخزني",
      flightNo: "",
      recipient: "المخزن",
      date: new Date().toISOString(),
      operator: user?.fullName || user?.username || "Catering Admin",
      notes: stockInDraft.notes || (stockInDraft.batchNo ? `رقم الشحنة: ${stockInDraft.batchNo}` : ""),
    };
    setLedger([newEntry, ...ledger]);
    dryStoreLedgerAPI.create(newEntry).catch(() => {});

    setShowStockInModal(false);
    showToast(`✅ تم استلام وربط ${qty} ${targetItem.unit} إلى رصيد المخزن`, "success");
  };

  const submitStockOut = () => {
    const qty = parseInt(stockOutDraft.qty, 10);
    if (!stockOutDraft.itemId) return showToast("⚠️ يرجى اختيار الصنف", "warning");
    if (isNaN(qty) || qty <= 0)
      return showToast("⚠️ يرجى إدخال كمية منصرفة صحيحة", "warning");

    const targetItem = items.find((i) => i.id === stockOutDraft.itemId);
    if (!targetItem) return;

    if (qty > (Number(targetItem.currentStock) || 0)) {
      return showToast(
        `⚠️ الكمية المطلوبة (${qty}) تتجاوز الرصيد الحالي المتوفر (${targetItem.currentStock})!`,
        "error"
      );
    }

    // Deduct stock
    const newStockOut = Math.max(0, (Number(targetItem.currentStock) || 0) - qty);
    const updatedItemOut = { ...targetItem, currentStock: newStockOut };
    const updatedItems = items.map((i) =>
      i.id === targetItem.id ? updatedItemOut : i
    );
    setItems(updatedItems);
    dryStoreItemsAPI.update(targetItem.id, updatedItemOut).catch(() => {});

    // Create ledger entry linked to flight
    const newEntry = {
      id: "tx-" + Date.now(),
      type: "OUT",
      itemId: targetItem.id,
      itemName: `${targetItem.nameAr} / ${targetItem.nameEn}`,
      qty,
      ref: stockOutDraft.flightNo ? `صرف للرحلة ${stockOutDraft.flightNo}` : "صرف تشغيلي",
      flightNo: stockOutDraft.flightNo || "",
      recipient: stockOutDraft.recipient || "طاقم الرحلة",
      date: new Date().toISOString(),
      operator: user?.fullName || user?.username || "Catering Admin",
      notes: stockOutDraft.notes || "",
    };
    setLedger([newEntry, ...ledger]);
    dryStoreLedgerAPI.create(newEntry).catch(() => {});

    setShowStockOutModal(false);
    showToast(
      `✅ تم صرف ${qty} ${targetItem.unit} بنجاح للرحلة ${stockOutDraft.flightNo || ""}`,
      "success"
    );
  };

  const handleSaveItem = async () => {
    if (!itemDraft.nameAr && !itemDraft.nameEn) {
      return showToast("⚠️ يرجى كتابة اسم الصنف بالعربية أو الإنجليزية", "warning");
    }

    if (editingItem) {
      const updated = { ...itemDraft, id: editingItem.id };
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? updated : i))
      );
      dryStoreItemsAPI.update(editingItem.id, updated).catch(() => {});
      showToast("✅ تم تحديث بيانات الصنف", "success");
    } else {
      const tempId = "item-" + Date.now();
      const newItem = {
        ...itemDraft,
        id: tempId,
        currentStock: Number(itemDraft.currentStock) || 0,
        minThreshold: Number(itemDraft.minThreshold) || 10,
      };
      setItems((prev) => [...prev, newItem]);
      showToast("✅ تم إضافة الصنف الجديد إلى المخزن الجاف", "success");
      dryStoreItemsAPI
        .create(newItem)
        .then((res) => {
          if (res?.id) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === tempId ? { ...i, id: String(res.id) } : i
              )
            );
          }
        })
        .catch(() => {});
    }

    setShowItemModal(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (item) => {
    if (!(await confirmAction(`هل أنت متأكد من حذف الصنف "${item.nameAr || item.nameEn}" من المخزن؟`))) {
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    dryStoreItemsAPI.remove(item.id).catch(() => {});
    showToast("✅ تم حذف الصنف", "info");
  };

  const logoSrc = toDisplayImageUrl(settings.logo || settings.logoUrl);
  const stampSrc = toDisplayImageUrl(settings.stampUrl || settings.stamp);
  const companyAr = settings.companyNameAr || settings.companyNameArabic || settings.companyName || "شركة الطيران";
  const companyEn = settings.companyNameEnglish || settings.companyName || "Aviation Company";

  const handlePrintDryStoreSheet = () => {
    if (printWithStamp && !canPrintStamp) return;
    if (!printWithStamp && !canPrintNoStamp) return;
    const sheetEl = document.getElementById("dry-store-print-sheet");
    if (!sheetEl) return;
    const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>تقرير جرد المخزن الجاف</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Cairo', Tahoma, Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12px; direction: rtl; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
    th { background: #f1f5f9; font-weight: bold; }
  </style>
</head>
<body>${sheetEl.innerHTML}</body>
</html>`;
    printHTMLContent(html, "Dry_Store_Inventory_Report");
  };

  return (
    <div className="space-y-4">
      {/* ═══ Top Metric Cards ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="p-3.5 rounded-xl border flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              إجمالي الأصناف بالمخزن
            </div>
            <div
              className="text-xl font-bold mt-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {items.length} <span className="text-xs font-normal">صنف</span>
            </div>
            <div className="text-[11px] text-sky-500 font-medium">
              {totalUnits} وحدة مخزنة
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between ${
            lowStockItems.length > 0 ? "border-amber-500/40 bg-amber-500/5" : ""
          }`}
          style={{
            backgroundColor: lowStockItems.length > 0 ? undefined : "var(--bg-card)",
            borderColor: lowStockItems.length > 0 ? undefined : "var(--border-default)",
          }}
        >
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              تنبيهات نقص المخزون
            </div>
            <div
              className={`text-xl font-bold mt-0.5 ${
                lowStockItems.length > 0 ? "text-amber-500" : ""
              }`}
              style={{
                color: lowStockItems.length > 0 ? undefined : "var(--text-primary)",
              }}
            >
              {lowStockItems.length} <span className="text-xs font-normal">أصناف</span>
            </div>
            <div className="text-[11px] text-amber-500 font-medium">
              {lowStockItems.length > 0 ? "تتطلب إعادة طلب فورية" : "المخزون آمن ومكتمل"}
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              lowStockItems.length > 0
                ? "bg-amber-500/20 text-amber-500 animate-pulse"
                : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div
          className="p-3.5 rounded-xl border flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              وارد المخزن اليوم (IN)
            </div>
            <div className="text-xl font-bold mt-0.5 text-emerald-500">
              +{todayIn} <span className="text-xs font-normal">وحدة</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-medium">
              توريد واستلام مخزني
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div
          className="p-3.5 rounded-xl border flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-default)",
          }}
        >
          <div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              منصرف للرحلات اليوم (OUT)
            </div>
            <div className="text-xl font-bold mt-0.5 text-rose-500">
              -{todayOut} <span className="text-xs font-normal">وحدة</span>
            </div>
            <div className="text-[11px] text-rose-500 font-medium">
              صرف لطواقم الطائرات
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ═══ Low Stock Warning Banner ═══ */}
      {lowStockItems.length > 0 && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              يوجد ({lowStockItems.length}) صنف وصل إلى الحد الأدنى لإعادة الطلب:{" "}
              {lowStockItems.map((i) => i.nameAr || i.nameEn).join("، ")}
            </span>
          </div>
          <button
            onClick={() => handleOpenStockIn(lowStockItems[0])}
            className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            توريد واستلام فوري
          </button>
        </div>
      )}

      {/* ═══ Control Bar & Sub-Tabs ═══ */}
      <div
        className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Sub-tab pills */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-lg">
          <button
            onClick={() => setSubTab("inventory")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              subTab === "inventory"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            الأصناف والمخزون الحالي ({items.length})
          </button>
          <button
            onClick={() => setSubTab("ledger")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
              subTab === "ledger"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            سجل حركة الوارد والمنصرف ({ledger.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canDryStore && (
            <>
              <button
                onClick={() => handleOpenStockIn()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                title="تسجيل استلام بضاعة جديدة في المخزن الجاف"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                استلام بضاعة (Stock IN)
              </button>
              <button
                onClick={() => handleOpenStockOut()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition"
                title="صرف مواد تموين لحساب رحلة محددة"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                صرف لرحلة (Stock OUT)
              </button>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setItemDraft({
                    nameAr: "",
                    nameEn: "",
                    category: DEFAULT_CATEGORIES[0],
                    unit: "قطعة / Piece",
                    currentStock: 0,
                    minThreshold: 50,
                    binLocation: "",
                    notes: "",
                  });
                  setShowItemModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition"
                style={{
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                صنف جديد
              </button>
            </>
          )}

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 transition"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
            }}
            title="طباعة جرد وتقرير المخزن الجاف الرسمي"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة تقرير المخزن
          </button>
        </div>
      </div>

      {/* ═══ Search & Filters ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3"
            style={{ color: "var(--text-muted)" }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              subTab === "inventory"
                ? "بحث باسم الصنف، الرمز، أو الرف..."
                : "بحث برقم الرحلة، الصنف، أو المستلم..."
            }
            className="ps-9 h-9 text-xs"
          />
        </div>

        {subTab === "inventory" ? (
          <div className="min-w-[180px]">
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="ALL">جميع التصنيفات</option>
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="min-w-[150px]">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="ALL">جميع الحركات</option>
              <option value="IN">الوارد فقط (Stock IN)</option>
              <option value="OUT">المنصرف فقط (Stock OUT)</option>
            </Select>
          </div>
        )}
      </div>

      {/* ═══ TAB 1: INVENTORY TABLE ═══ */}
      {subTab === "inventory" && (
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
                  <th className="py-2.5 px-3 text-start font-semibold">الصنف (عربي / English)</th>
                  <th className="py-2.5 px-3 text-start font-semibold">التصنيف</th>
                  <th className="py-2.5 px-3 text-center font-semibold">الوحدة</th>
                  <th className="py-2.5 px-3 text-center font-semibold">موقع الرف</th>
                  <th className="py-2.5 px-3 text-center font-semibold">الرصيد الحالي</th>
                  <th className="py-2.5 px-3 text-center font-semibold">الحد الأدنى</th>
                  <th className="py-2.5 px-3 text-center font-semibold">الحالة</th>
                  {canDryStore && (
                    <th className="py-2.5 px-3 text-end font-semibold">إجراءات سريعة</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-default)" }}>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-8 text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      لا توجد أصناف تطابق البحث
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = Number(item.currentStock) <= Number(item.minThreshold);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-black/5 dark:hover:bg-white/5 transition ${
                          isLow ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                            {item.nameAr || item.nameEn}
                          </div>
                          {item.nameAr && item.nameEn && (
                            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {item.nameEn}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              {item.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3" style={{ color: "var(--text-muted)" }}>
                          <span className="px-2 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/5">
                            {item.category?.split("/")[0] || item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium" style={{ color: "var(--text-primary)" }}>
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold">
                            {item.binLocation || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono text-sm font-bold ${
                              isLow ? "text-amber-500" : "text-emerald-500"
                            }`}
                          >
                            {item.currentStock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                          {item.minThreshold}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> نقص مخزون
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" /> متوفر
                            </span>
                          )}
                        </td>
                        {canDryStore && (
                          <td className="py-2.5 px-3 text-end">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenStockIn(item)}
                                className="px-2 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 hover:text-white font-bold text-[11px] transition"
                                title="استلام توريد لهذا الصنف"
                              >
                                + توريد
                              </button>
                              <button
                                onClick={() => handleOpenStockOut(item)}
                                className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500 text-rose-600 hover:text-white font-bold text-[11px] transition"
                                title="صرف لهذا الصنف"
                              >
                                - صرف
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setItemDraft({ ...item });
                                  setShowItemModal(true);
                                }}
                                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                title="تعديل الصنف"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1 rounded hover:bg-rose-500/15 text-rose-500"
                                title="حذف الصنف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: LEDGER (حركات الوارد والمنصرف) ═══ */}
      {subTab === "ledger" && (
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
                  <th className="py-2.5 px-3 text-start font-semibold">التاريخ والوقت (24h)</th>
                  <th className="py-2.5 px-3 text-center font-semibold">نوع الحركة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الصنف</th>
                  <th className="py-2.5 px-3 text-center font-semibold">الكمية</th>
                  <th className="py-2.5 px-3 text-start font-semibold">الرحلة / المرجع</th>
                  <th className="py-2.5 px-3 text-start font-semibold">المستلم / الوجهة</th>
                  <th className="py-2.5 px-3 text-start font-semibold">المسؤول</th>
                  <th className="py-2.5 px-3 text-start font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--border-default)" }}>
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="text-center py-8 text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      لا توجد حركات مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => {
                    const isOut = entry.type === "OUT";
                    const dt = entry.date ? new Date(entry.date) : new Date();
                    const formattedDate = `${dt.getFullYear()}-${String(
                      dt.getMonth() + 1
                    ).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(
                      dt.getHours()
                    ).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-black/5 dark:hover:bg-white/5 transition"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                              <ArrowUpRight className="w-3 h-3" /> صرف (OUT)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <ArrowDownLeft className="w-3 h-3" /> استلام (IN)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                          {entry.itemName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span
                            className={
                              isOut
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {isOut ? `-${entry.qty}` : `+${entry.qty}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {entry.flightNo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold font-mono text-[11px]">
                              <Plane className="w-3 h-3" />
                              {entry.flightNo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              {entry.ref || "—"}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {entry.recipient || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {entry.operator || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                          {entry.notes || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ MODAL: STOCK IN (استلام وتوريد) ═══ */}
      {showStockInModal && (
        <Modal
          title="استلام بضاعة وتوريد للمخزن الجاف (Stock IN)"
          isOpen={true}
          onClose={() => setShowStockInModal(false)}
        >
          <div className="space-y-3.5 text-xs">
            <Field label="اختر الصنف المراد توريده">
              <Select
                value={stockInDraft.itemId}
                onChange={(e) =>
                  setStockInDraft({ ...stockInDraft, itemId: e.target.value })
                }
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameAr || i.nameEn} (الرصيد الحالي: {i.currentStock} {i.unit})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="الكمية الواردة">
                <Input
                  type="number"
                  min="1"
                  value={stockInDraft.qty}
                  onChange={(e) =>
                    setStockInDraft({ ...stockInDraft, qty: e.target.value })
                  }
                  placeholder="مثال: 50"
                  autoFocus
                />
              </Field>

              <Field label="المورد / المصدر">
                <Input
                  value={stockInDraft.source}
                  onChange={(e) =>
                    setStockInDraft({ ...stockInDraft, source: e.target.value })
                  }
                  placeholder="مثال: شركة تموين المطار"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم الشحنة / الفاتورة (اختياري)">
                <Input
                  value={stockInDraft.batchNo}
                  onChange={(e) =>
                    setStockInDraft({ ...stockInDraft, batchNo: e.target.value })
                  }
                  placeholder="PO-2026-091"
                />
              </Field>

              <Field label="المستلم المسؤول">
                <Input
                  value={user?.fullName || user?.username || "Catering Admin"}
                  disabled
                  className="opacity-75"
                />
              </Field>
            </div>

            <Field label="ملاحظات الاستلام">
              <Input
                value={stockInDraft.notes}
                onChange={(e) =>
                  setStockInDraft({ ...stockInDraft, notes: e.target.value })
                }
                placeholder="حالة الشحنة، مكان التخزين..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowStockInModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitStockIn}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <ArrowDownLeft className="w-4 h-4" />
                تأكيد الاستلام وإضافة الرصيد
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: STOCK OUT (صرف لرحلة محددة) ═══ */}
      {showStockOutModal && (
        <Modal
          title="صرف مواد تموين لحساب رحلة (Stock OUT)"
          isOpen={true}
          onClose={() => setShowStockOutModal(false)}
        >
          <div className="space-y-3.5 text-xs">
            <Field label="اختر الصنف المراد صرفه">
              <Select
                value={stockOutDraft.itemId}
                onChange={(e) =>
                  setStockOutDraft({ ...stockOutDraft, itemId: e.target.value })
                }
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nameAr || i.nameEn} — متوفر بالمخزن: {i.currentStock} {i.unit}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="ربط بالرحلة (Flight No)">
                <Select
                  value={stockOutDraft.flightNo}
                  onChange={(e) => {
                    const selNo = e.target.value;
                    const matched = flights.find(
                      (f) => (f.flightNumber || f.flightNo) === selNo
                    );
                    setStockOutDraft({
                      ...stockOutDraft,
                      flightNo: selNo,
                      flightId: matched?.id || "",
                    });
                  }}
                >
                  <option value="">-- رحلة غير محددة / صرف عام --</option>
                  {flights.map((f) => {
                    const fn = f.flightNumber || f.flightNo || "FLT";
                    const route = `${f.departureAirport || f.dep || "DEP"} → ${
                      f.arrivalAirport || f.arr || "ARR"
                    }`;
                    return (
                      <option key={f.id || fn} value={fn}>
                        {fn} ({route}) - {f.flightDate || f.date || ""}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label="الكمية المراد صرفها">
                <Input
                  type="number"
                  min="1"
                  value={stockOutDraft.qty}
                  onChange={(e) =>
                    setStockOutDraft({ ...stockOutDraft, qty: e.target.value })
                  }
                  placeholder="مثال: 24"
                  autoFocus
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="المستلم (طاقم الرحلة / المشرف)">
                <Input
                  value={stockOutDraft.recipient}
                  onChange={(e) =>
                    setStockOutDraft({ ...stockOutDraft, recipient: e.target.value })
                  }
                  placeholder="مثال: Senior Purser / كابتن الرحلة"
                />
              </Field>

              <Field label="مسؤول الصرف">
                <Input
                  value={user?.fullName || user?.username || "Catering Admin"}
                  disabled
                  className="opacity-75"
                />
              </Field>
            </div>

            <Field label="ملاحظات الصرف">
              <Input
                value={stockOutDraft.notes}
                onChange={(e) =>
                  setStockOutDraft({ ...stockOutDraft, notes: e.target.value })
                }
                placeholder="أسباب الصرف الإضافي، تغليف، تسليم الطائرة..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowStockOutModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={submitStockOut}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <ArrowUpRight className="w-4 h-4" />
                تأكيد الصرف وخصم الرصيد
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: NEW / EDIT ITEM ═══ */}
      {showItemModal && (
        <Modal
          title={editingItem ? "تعديل بيانات الصنف" : "إضافة صنف جديد للمخزن الجاف"}
          isOpen={true}
          onClose={() => setShowItemModal(false)}
        >
          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم الصنف بالعربية">
                <Input
                  value={itemDraft.nameAr}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, nameAr: e.target.value })
                  }
                  placeholder="مثال: أكواب ورقية 8 أونصة"
                  autoFocus
                />
              </Field>
              <Field label="Item Name (English)">
                <Input
                  value={itemDraft.nameEn}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, nameEn: e.target.value })
                  }
                  placeholder="e.g. Paper Cups 8oz"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="التصنيف">
                <Select
                  value={itemDraft.category}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, category: e.target.value })
                  }
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="وحدة القياس / العبوة">
                <Input
                  value={itemDraft.unit}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, unit: e.target.value })
                  }
                  placeholder="مثال: كرتون / عبوة / حبة"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="الرصيد الحالي">
                <Input
                  type="number"
                  min="0"
                  value={itemDraft.currentStock}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, currentStock: e.target.value })
                  }
                  disabled={!!editingItem} // If editing, change via IN/OUT
                />
              </Field>
              <Field label="الحد الأدنى للتنبيه">
                <Input
                  type="number"
                  min="1"
                  value={itemDraft.minThreshold}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, minThreshold: e.target.value })
                  }
                />
              </Field>
              <Field label="رقم/موقع الرف (Bin)">
                <Input
                  value={itemDraft.binLocation}
                  onChange={(e) =>
                    setItemDraft({ ...itemDraft, binLocation: e.target.value })
                  }
                  placeholder="مثال: A-04"
                />
              </Field>
            </div>

            <Field label="ملاحظات إضافية">
              <Input
                value={itemDraft.notes}
                onChange={(e) =>
                  setItemDraft({ ...itemDraft, notes: e.target.value })
                }
                placeholder="سعة العبوة، مورد مفضل..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm"
              >
                حفظ الصنف
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: PRINT DRY STORE REPORT WITH STAMP PERMISSION ═══ */}
      {showPrintModal && (
        <Modal
          title="معاينة وطباعة تقرير جرد المخزن الجاف"
          isOpen={true}
          onClose={() => setShowPrintModal(false)}
        >
          <div className="space-y-4">
            {/* Stamp Permission Control (Granular Stamp & No-Stamp RBAC) */}
            <div
              className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2"
              style={{
                backgroundColor: "var(--bg-app)",
                borderColor: "var(--border-default)",
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  className={`w-5 h-5 ${
                    canAnyPrint ? "text-emerald-500" : "text-muted-foreground"
                  }`}
                />
                <div>
                  <div className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    صلاحيات الختم والطباعة لتقرير الجرد
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {canAnyPrint
                      ? "اختر نمط الطباعة المسموح لصلاحيات حسابك"
                      : "لا تملك صلاحية طباعة تقرير المخزن (لا بالختم ولا بدون ختم)"}
                  </div>
                </div>
              </div>

              <div
                className="inline-flex rounded-lg border overflow-hidden"
                style={{ borderColor: "var(--border-default)" }}
              >
                <button
                  type="button"
                  disabled={!canPrintStamp}
                  onClick={() => canPrintStamp && setPrintWithStamp(true)}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition ${
                    printWithStamp && canPrintStamp
                      ? "bg-emerald-600 text-white"
                      : canPrintStamp
                      ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "opacity-45 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
                  }`}
                  title={!canPrintStamp ? "يتطلب صلاحية الطباعة بالختم الرسمي" : ""}
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>بالختم الرسمي</span>
                  {!canPrintStamp && <Lock className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  disabled={!canPrintNoStamp}
                  onClick={() => canPrintNoStamp && setPrintWithStamp(false)}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 border-s transition ${
                    !printWithStamp && canPrintNoStamp
                      ? "bg-slate-700 text-white"
                      : canPrintNoStamp
                      ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                      : "opacity-45 cursor-not-allowed bg-slate-100 dark:bg-slate-900 text-slate-400"
                  }`}
                  style={{ borderColor: "var(--border-default)" }}
                  title={!canPrintNoStamp ? "يتطلب صلاحية الطباعة بدون ختم" : ""}
                >
                  <FileX className="w-3.5 h-3.5" />
                  <span>بدون ختم</span>
                  {!canPrintNoStamp && <Lock className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Document Print Area */}
            <div
              id="dry-store-print-sheet"
              className="p-6 bg-white text-slate-900 rounded-lg shadow-sm border space-y-4 font-sans text-xs"
              style={{ direction: "rtl" }}
            >
              {/* Document Header with Logo and bilingual name */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt="Logo"
                      className="h-14 w-auto max-w-[120px] object-contain"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                      <Building2 className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div>
                    <div className="font-extrabold text-base text-slate-900">
                      {companyAr}
                    </div>
                    <div className="text-xs font-medium text-slate-500 tracking-wide">
                      {companyEn}
                    </div>
                  </div>
                </div>

                <div className="text-start">
                  <div className="text-xs font-bold text-slate-800">
                    تقرير جرد وتوزيع التموين الجاف
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    DRY CATERING INVENTORY REPORT
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    DATE: {new Date().toISOString().slice(0, 10)} {new Date().toTimeString().slice(0, 5)}
                  </div>
                </div>
              </div>

              {/* Items Inventory Table */}
              <div>
                <div className="font-bold text-xs text-slate-800 mb-1.5">
                  أولاً: قائمة المخزون الفعلي والأرصدة المتوفرة
                </div>
                <table className="w-full text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="border border-slate-300 p-1.5 text-start">م</th>
                      <th className="border border-slate-300 p-1.5 text-start">الصنف</th>
                      <th className="border border-slate-300 p-1.5 text-start">التصنيف</th>
                      <th className="border border-slate-300 p-1.5 text-center">الوحدة</th>
                      <th className="border border-slate-300 p-1.5 text-center">الرف</th>
                      <th className="border border-slate-300 p-1.5 text-center font-bold">الرصيد</th>
                      <th className="border border-slate-300 p-1.5 text-center">الحد الأدنى</th>
                      <th className="border border-slate-300 p-1.5 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const isLow = Number(item.currentStock) <= Number(item.minThreshold);
                      return (
                        <tr key={item.id} className={idx % 2 === 1 ? "bg-slate-50" : ""}>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 p-1.5 font-semibold">
                            {item.nameAr || item.nameEn}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-slate-600">
                            {item.category?.split("/")[0]}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center">{item.unit}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{item.binLocation || "—"}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-bold font-mono">
                            {item.currentStock}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{item.minThreshold}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-bold">
                            {isLow ? "نقص مخزون" : "مطابق"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures & Official Stamp */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 text-center items-end">
                <div>
                  <div className="text-[10px] text-slate-500 mb-8">مسؤول مخزن التموين</div>
                  <div className="font-bold text-slate-800 border-t border-dashed border-slate-400 pt-1">
                    {user?.fullName || user?.username || "Catering Supervisor"}
                  </div>
                </div>

                {/* Stamp Rendering */}
                <div className="flex flex-col items-center justify-center">
                  {printWithStamp && canPrintStamp ? (
                    stampSrc ? (
                      <div className="relative">
                        <img
                          src={stampSrc}
                          alt="Official Stamp"
                          className="w-24 h-24 object-contain opacity-90 rotate-[-4deg]"
                        />
                        <div className="text-[9px] text-emerald-700 font-bold mt-1">
                          معتمد رسمياً
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-full border-2 border-dashed border-red-500 text-red-500 flex flex-col items-center justify-center rotate-[-6deg] p-1 shadow-sm">
                        <div className="text-[9px] font-bold tracking-tighter">
                          {companyAr.slice(0, 15)}
                        </div>
                        <div className="text-[8px] font-mono font-black">OFFICIAL</div>
                        <div className="text-[8px] font-bold uppercase">APPROVED</div>
                      </div>
                    )
                  ) : (
                    <div className="h-20 flex items-center justify-center text-slate-300 text-[10px] border border-dashed border-slate-200 rounded w-full">
                      (بدون ختم رسمي)
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[10px] text-slate-500 mb-8">مدير العمليات الأرضية والتموين</div>
                  <div className="font-bold text-slate-800 border-t border-dashed border-slate-400 pt-1">
                    Ground Operations Director
                  </div>
                </div>
              </div>
            </div>

            {/* Print Modal Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-lg border text-xs font-semibold"
              >
                إغلاق
              </button>
              <button
                type="button"
                disabled={!canAnyPrint}
                onClick={handlePrintDryStoreSheet}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                title={!canAnyPrint ? "لا توجد صلاحية طباعة تقرير المخزن" : ""}
              >
                <Printer className="w-4 h-4" />
                طباعة الآن
                {!canAnyPrint && <Lock className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default CateringDryStore;
