import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, getVerifiedCloudUser } from "../contexts/FirebaseProvider";
import { handleFirestoreError, OperationType } from "./firebaseUtils";
import {
  notificationsAPI,
  readSheetCache,
  hasPendingSheetMutations,
} from "../api";

const LOCAL_NOTIF_KEY = "aeroops.local_notifications";
const LOCAL_READ_SIGS_KEY = "aeroops.read_notification_sigs";
const BOOTSTRAPPED_ADMIN_EMAIL = "123adam133@gmail.com";
const ALLOWED_TYPES = ["FLIGHT_ASSIGNED", "FLIGHT_UPDATED", "GENERAL"];

export function sanitizeFirestoreId(rawId) {
  const cleaned = String(rawId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 128);
  return cleaned || "unknown";
}

function makeSig(item) {
  return `${String(item?.crewId || "").trim()}|${String(
    item?.flightNo || ""
  ).trim()}|${String(item?.message || "").trim()}|${String(
    item?.createdAtIso || ""
  ).slice(0, 16)}`;
}

function readLocalNotifications() {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalNotifications(list) {
  try {
    localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(list.slice(0, 250)));
    window.dispatchEvent(new CustomEvent("aeroops:notifications"));
  } catch {}
}

function readReadSigs() {
  try {
    const raw = localStorage.getItem(LOCAL_READ_SIGS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function addReadSigs(sigs = []) {
  try {
    const current = Array.from(readReadSigs());
    const next = Array.from(new Set([...sigs, ...current])).slice(0, 400);
    localStorage.setItem(LOCAL_READ_SIGS_KEY, JSON.stringify(next));
  } catch {}
}

function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Cloud timeout")), ms)
    ),
  ]);
}

export async function sendNotification(crewId, message, meta = {}) {
  const rawCrewId = String(crewId || "").trim();
  const safeCrewId = sanitizeFirestoreId(rawCrewId);
  const safeMessage = String(message || "").trim().slice(0, 1000);
  if (!rawCrewId || !safeMessage) return null;

  const safeFlightNo = String(meta.flightNo || "").trim().slice(0, 32);
  const safeType = ALLOWED_TYPES.includes(meta.type) ? meta.type : "GENERAL";
  const safeRecipientEmail = String(meta.recipientEmail || "")
    .trim()
    .toLowerCase()
    .slice(0, 254);
  const safeRecipientUsername = String(meta.recipientUsername || "")
    .trim()
    .toLowerCase()
    .slice(0, 128);
  const nowIso = new Date().toISOString();

  // 1. Instant local write so same-browser tabs/views update in 0ms
  const localItem = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    crewId: rawCrewId,
    safeCrewId,
    recipientEmail: safeRecipientEmail,
    recipientUsername: safeRecipientUsername,
    crewName: String(meta.crewName || "").trim(),
    flightId: String(meta.flightId || "").trim(),
    flightNo: safeFlightNo,
    dep: String(meta.dep || "").trim(),
    arr: String(meta.arr || "").trim(),
    std: String(meta.std || "").trim(),
    sta: String(meta.sta || "").trim(),
    acft: String(meta.acft || "").trim(),
    position: String(meta.position || "").trim(),
    type: safeType,
    message: safeMessage,
    read: false,
    createdAtIso: nowIso,
    fromFirestore: false,
    fromSheet: false,
  };
  writeLocalNotifications([localItem, ...readLocalNotifications()]);

  // 2. Primary Cloud Persistence: Google Sheets ("Notifications" sheet)
  // Works for ALL users (username/password & Crew Portal) without Firebase OAuth!
  let sheetCreated = null;
  try {
    sheetCreated = await notificationsAPI.create({
      crewId: rawCrewId,
      recipientEmail: safeRecipientEmail,
      recipientUsername: safeRecipientUsername,
      crewName: localItem.crewName,
      flightId: localItem.flightId,
      flightNo: safeFlightNo,
      dep: localItem.dep,
      arr: localItem.arr,
      std: localItem.std,
      sta: localItem.sta,
      acft: localItem.acft,
      position: localItem.position,
      type: safeType,
      message: safeMessage,
      read: false,
      createdAtIso: nowIso,
    });
    if (sheetCreated?.id) {
      const updatedLocal = readLocalNotifications().map((n) =>
        n.id === localItem.id
          ? { ...n, sheetId: sheetCreated.id, fromSheet: true }
          : n
      );
      writeLocalNotifications(updatedLocal);
    }
  } catch (err) {
    console.warn("Google Sheets notification save warning:", err);
  }

  // 3. Optional secondary mirror to Firestore (strictly non-blocking with timeout)
  const currentUser = getVerifiedCloudUser();
  if (currentUser) {
    withTimeout(
      addDoc(collection(db, "notifications"), {
        crewId: safeCrewId,
        recipientEmail: safeRecipientEmail,
        senderUid: String(currentUser.uid).slice(0, 128),
        flightNo: safeFlightNo,
        type: safeType,
        message: safeMessage,
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      2500
    ).catch((error) => {
      if (error?.message !== "Cloud timeout") {
        try {
          handleFirestoreError(error, OperationType.CREATE, "notifications");
        } catch {}
      }
    });
  }

  return sheetCreated || localItem;
}

function doesNotificationMatchCrew(n, rawCrewId, safeCrewId, userMeta = {}) {
  if (!n) return false;
  const nCrewRaw = String(n.crewId || "").trim();
  const nCrewSafe = sanitizeFirestoreId(nCrewRaw);

  if (nCrewRaw.toUpperCase() === "ALL") return true;
  if (rawCrewId && nCrewRaw === rawCrewId) return true;
  if (safeCrewId && safeCrewId !== "unknown" && nCrewSafe === safeCrewId)
    return true;

  const targetEmail = String(userMeta?.email || "").trim().toLowerCase();
  if (
    targetEmail &&
    n.recipientEmail &&
    String(n.recipientEmail).trim().toLowerCase() === targetEmail
  ) {
    return true;
  }

  const targetUsername = String(userMeta?.username || "").trim().toLowerCase();
  if (
    targetUsername &&
    n.recipientUsername &&
    String(n.recipientUsername).trim().toLowerCase() === targetUsername
  ) {
    return true;
  }

  return false;
}

function mergeNotifications(
  rawCrewId,
  safeCrewId,
  sheetDocs = [],
  firestoreDocs = [],
  userMeta = {}
) {
  const readSigs = readReadSigs();

  const localMatching = readLocalNotifications().filter((n) =>
    doesNotificationMatchCrew(n, rawCrewId, safeCrewId, userMeta)
  );
  const sheetMatching = (sheetDocs || []).filter((n) =>
    doesNotificationMatchCrew(n, rawCrewId, safeCrewId, userMeta)
  );
  const fsMatching = (firestoreDocs || []).filter((n) =>
    doesNotificationMatchCrew(n, rawCrewId, safeCrewId, userMeta)
  );

  const byKey = new Map();

  const ingest = (item, source) => {
    const sortTime = item.createdAtIso
      ? new Date(item.createdAtIso).getTime() || 0
      : item.sortTime || 0;
    const sig = makeSig(item);
    const dedupKey = `${String(item.flightNo || "").trim()}|${String(
      item.message || ""
    ).trim()}|${String(item.createdAtIso || "").slice(0, 16)}`;

    const isRead =
      Boolean(item.read) ||
      readSigs.has(sig) ||
      readSigs.has(String(item.id || "")) ||
      (item.sheetId && readSigs.has(String(item.sheetId)));

    const existing = byKey.get(dedupKey);
    if (!existing) {
      byKey.set(dedupKey, {
        ...item,
        read: isRead,
        sortTime,
        sheetId:
          source === "sheet"
            ? item.id
            : item.sheetId || existing?.sheetId || null,
        firestoreId:
          source === "firestore"
            ? item.id
            : item.firestoreId || existing?.firestoreId || null,
        fromSheet: source === "sheet" || Boolean(item.fromSheet),
        fromFirestore: source === "firestore" || Boolean(item.fromFirestore),
      });
    } else {
      byKey.set(dedupKey, {
        ...existing,
        ...item,
        id: existing.sheetId || (source === "sheet" ? item.id : existing.id),
        sheetId:
          source === "sheet" ? item.id : existing.sheetId || item.sheetId || null,
        firestoreId:
          source === "firestore"
            ? item.id
            : existing.firestoreId || item.firestoreId || null,
        read: Boolean(existing.read || isRead),
        sortTime: Math.max(existing.sortTime || 0, sortTime),
        fromSheet: existing.fromSheet || source === "sheet",
        fromFirestore: existing.fromFirestore || source === "firestore",
      });
    }
  };

  // Ingest sheet first (authoritative cross-device ID), then firestore, then local
  sheetMatching.forEach((n) => ingest(n, "sheet"));
  fsMatching.forEach((n) => ingest(n, "firestore"));
  localMatching.forEach((n) => ingest(n, "local"));

  return Array.from(byKey.values()).sort(
    (a, b) => (b.sortTime || 0) - (a.sortTime || 0)
  );
}

export function subscribeToNotifications(crewId, callback, userMeta = {}) {
  const rawCrewId = String(crewId || "").trim();
  const safeCrewId = sanitizeFirestoreId(rawCrewId);
  const hasAnyIdentity =
    (rawCrewId && safeCrewId !== "unknown") ||
    Boolean(userMeta?.email) ||
    Boolean(userMeta?.username);

  if (!hasAnyIdentity) {
    callback([]);
    return () => {};
  }

  let sheetCache = readSheetCache("Notifications", []);
  let firestoreCache = [];
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    callback(
      mergeNotifications(
        rawCrewId,
        safeCrewId,
        sheetCache,
        firestoreCache,
        userMeta
      )
    );
  };

  // Emit cached notifications immediately (0ms)
  emit();

  // Pull fresh notifications from Google Sheets
  const pullFromGoogleSheets = async () => {
    if (disposed) return;
    try {
      const fresh = await notificationsAPI.list();
      if (!disposed && Array.isArray(fresh)) {
        sheetCache = fresh;
        emit();
      }
    } catch {
      // Keep local + sheet cache seamlessly if offline
    }
  };

  pullFromGoogleSheets();

  // Poll Google Sheets every 12s while visible + on focus so cross-device updates appear fast
  const pollInterval = setInterval(() => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    if (hasPendingSheetMutations()) return;
    pullFromGoogleSheets();
  }, 12000);

  const onFocus = () => {
    if (!hasPendingSheetMutations()) pullFromGoogleSheets();
  };

  const onLocalUpdate = () => {
    sheetCache = readSheetCache("Notifications", sheetCache);
    emit();
  };

  window.addEventListener("aeroops:notifications", onLocalUpdate);
  window.addEventListener("aeroops:sheetCacheUpdated", onLocalUpdate);
  window.addEventListener("storage", onLocalUpdate);
  window.addEventListener("focus", onFocus);

  // Optional Firestore live listener when cloud user is verified
  const currentUser = getVerifiedCloudUser();
  let unsubscribeFirestore = null;

  if (currentUser && safeCrewId && safeCrewId !== "unknown") {
    const userEmail = String(currentUser.email || "").toLowerCase();
    const isBootstrappedAdmin = userEmail === BOOTSTRAPPED_ADMIN_EMAIL;

    const q = isBootstrappedAdmin
      ? query(collection(db, "notifications"), where("crewId", "==", safeCrewId))
      : query(
          collection(db, "notifications"),
          where("crewId", "==", safeCrewId),
          where("recipientEmail", "==", userEmail)
        );

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        firestoreCache = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const tsMillis =
            d.createdAt && typeof d.createdAt.toMillis === "function"
              ? d.createdAt.toMillis()
              : Date.now();
          return {
            id: docSnap.id,
            ...d,
            createdAtIso: new Date(tsMillis).toISOString(),
            sortTime: tsMillis,
            fromFirestore: true,
          };
        });
        emit();
      },
      () => {
        // Silently rely on Google Sheets + local mirror
      }
    );
  }

  return () => {
    disposed = true;
    clearInterval(pollInterval);
    window.removeEventListener("aeroops:notifications", onLocalUpdate);
    window.removeEventListener("aeroops:sheetCacheUpdated", onLocalUpdate);
    window.removeEventListener("storage", onLocalUpdate);
    window.removeEventListener("focus", onFocus);
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

export async function markNotificationRead(notification) {
  if (!notification) return;

  const sig = makeSig(notification);
  const sheetRowId =
    notification.sheetId ||
    (notification.fromSheet && !String(notification.id || "").startsWith("local_")
      ? notification.id
      : null);

  addReadSigs(
    [sig, notification.id, sheetRowId].filter(Boolean).map(String)
  );

  // 1. Update local mirror immediately
  const list = readLocalNotifications().map((n) =>
    n.id === notification.id ||
    (sheetRowId && (n.id === sheetRowId || n.sheetId === sheetRowId)) ||
    (n.message === notification.message &&
      String(n.crewId) === String(notification.crewId))
      ? { ...n, read: true }
      : n
  );
  writeLocalNotifications(list);

  // 2. Update Google Sheets "Notifications" row
  if (sheetRowId) {
    notificationsAPI
      .update(sheetRowId, { read: true })
      .catch((err) => console.warn("Mark read sheet sync warning:", err));
  } else {
    // Try matching row from cached Notifications sheet if sheetId wasn't attached yet
    const cachedSheet = readSheetCache("Notifications", []);
    const matchedRow = cachedSheet.find(
      (r) =>
        String(r.crewId) === String(notification.crewId) &&
        String(r.message) === String(notification.message) &&
        !r.read
    );
    if (matchedRow?.id) {
      notificationsAPI
        .update(matchedRow.id, { read: true })
        .catch(() => {});
    }
  }

  // 3. Optional Firestore update
  const verifiedUser = getVerifiedCloudUser();
  const fsId =
    notification.firestoreId ||
    (notification.fromFirestore ? notification.id : null);
  if (fsId && verifiedUser) {
    withTimeout(
      updateDoc(doc(db, "notifications", fsId), {
        read: true,
        updatedAt: serverTimestamp(),
      }),
      2500
    ).catch(() => {});
  }
}

export async function markAllNotificationsRead(notifications = []) {
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;

  addReadSigs(
    unread
      .flatMap((n) => [makeSig(n), n.id, n.sheetId])
      .filter(Boolean)
      .map(String)
  );

  const unreadMessages = new Set(unread.map((n) => `${n.crewId}|${n.message}`));
  const updatedLocal = readLocalNotifications().map((n) =>
    unreadMessages.has(`${n.crewId}|${n.message}`) ? { ...n, read: true } : n
  );
  writeLocalNotifications(updatedLocal);

  await Promise.allSettled(
    unread.map((n) => markNotificationRead(n))
  );
}
