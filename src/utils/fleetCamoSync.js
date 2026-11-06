/* ═══════════════════════════════════════════════════════════
 * TWO-WAY SYNC ENGINE: FLEET ↔ CAMO (Aircraft + Documents)
 * Unifies aircraft records and attachments by registration (reg)
 * ═══════════════════════════════════════════════════════════ */
import { fleetAPI, camoAPI } from "../api";

export function normalizeReg(reg) {
  return String(reg || "").trim().toUpperCase();
}

export function normalizeDocItem(doc, idx = 0) {
  if (!doc) return null;
  if (typeof doc === "string") {
    return {
      id: `DOC_${idx}_${doc.slice(-10).replace(/[^a-zA-Z0-9]/g, "")}`,
      name: doc.split("/").pop() || `Document ${idx + 1}`,
      expiry: null,
      fileName: doc.split("/").pop() || "",
      url: doc,
      path: "",
      mime: "",
      size: 0,
      uploadedAt: "",
    };
  }

  const name = doc.name || doc.fileName || doc.title || `Document ${idx + 1}`;
  const url = doc.url || doc.fileUrl || doc.data || "";
  const fallbackId = url
    ? "DOC_" +
      encodeURIComponent(url)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(-16)
    : `DOC_${idx}_${String(name).replace(/[^a-zA-Z0-9]/g, "")}`;

  return {
    id: doc.id || fallbackId,
    name,
    expiry: doc.expiry ? String(doc.expiry).slice(0, 10) : null,
    fileName: doc.fileName || doc.name || "",
    url,
    path: doc.path || doc.filePath || "",
    mime: doc.mime || doc.type || doc.mimeType || "",
    size: Number(doc.size) || 0,
    uploadedAt: doc.uploadedAt || "",
  };
}

export function parseDocsList(raw) {
  if (!raw) return [];
  let arr = raw;
  for (let i = 0; i < 3; i++) {
    if (Array.isArray(arr)) break;
    if (typeof arr === "string") {
      const trimmed = arr.trim();
      if (!trimmed) return [];
      try {
        arr = JSON.parse(trimmed);
      } catch {
        return [];
      }
    } else {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item, idx) => normalizeDocItem(item, idx))
    .filter(Boolean);
}

export function mergeDocsLists(listA = [], listB = []) {
  const a = parseDocsList(listA);
  const b = parseDocsList(listB);
  const map = new Map();

  for (const doc of [...b, ...a]) {
    const dedupKey = doc.id || (doc.url ? `url:${doc.url}` : `name:${doc.name}`);
    const existing = map.get(dedupKey);
    map.set(dedupKey, existing ? { ...existing, ...doc } : doc);
  }

  return Array.from(map.values());
}

/**
 * Builds unified Fleet and CAMO lists linked by registration (`reg`)
 * so every aircraft and its documents appear consistently on both sides.
 */
export function buildUnifiedFleetAndCamo(fleet = [], camoList = []) {
  const fleetByReg = new Map();
  const camoByReg = new Map();

  (fleet || []).forEach((f) => {
    const key = normalizeReg(f.reg);
    if (key) fleetByReg.set(key, f);
  });

  (camoList || []).forEach((c) => {
    const key = normalizeReg(c.reg);
    if (key) camoByReg.set(key, c);
  });

  console.log("DEBUG: Fleet-CAMO Sync Linking", {
    fleetRegs: Array.from(fleetByReg.keys()),
    camoRegs: Array.from(camoByReg.keys()),
  });

  const allRegs = Array.from(
    new Set([...fleetByReg.keys(), ...camoByReg.keys()])
  );

  const unifiedFleet = allRegs.map((regKey) => {
    const f = fleetByReg.get(regKey);
    const c = camoByReg.get(regKey);
    const mergedDocs = mergeDocsLists(f?.attachments, c?.attachments);

    return {
      ...(f || {}),
      id: f?.id || `camo_virtual_${c?.id || regKey}`,
      _fleetId: f?.id || null,
      _camoId: c?.id || null,
      _linkedCamo: !!c?.id,
      reg: f?.reg || c?.reg || regKey,
      type: f?.type || c?.type || "",
      status: f?.status || c?.status || "AIRWORTHY",
      tah: f?.tah ?? c?.tah ?? 0,
      tac: f?.tac ?? c?.tac ?? 0,
      lastCheck:
        (f?.lastCheck ? String(f.lastCheck).slice(0, 10) : "") ||
        (c?.lastCheckDate ? String(c.lastCheckDate).slice(0, 10) : ""),
      nextCheck:
        (f?.nextCheck ? String(f.nextCheck).slice(0, 10) : "") ||
        (c?.nextCheckDate ? String(c.nextCheckDate).slice(0, 10) : ""),
      coaExpiry: c?.coaExpiry ? String(c.coaExpiry).slice(0, 10) : "",
      insuranceExpiry: c?.insuranceExpiry
        ? String(c.insuranceExpiry).slice(0, 10)
        : "",
      noiseCertExpiry: c?.noiseCertExpiry
        ? String(c.noiseCertExpiry).slice(0, 10)
        : "",
      attachments: mergedDocs,
    };
  });

  const unifiedCamo = allRegs.map((regKey) => {
    const c = camoByReg.get(regKey);
    const f = fleetByReg.get(regKey);
    const mergedDocs = mergeDocsLists(c?.attachments, f?.attachments);

    return {
      ...(c || {}),
      id: c?.id || `fleet_virtual_${f?.id || regKey}`,
      _camoId: c?.id || null,
      _fleetId: f?.id || null,
      _linkedFleet: !!f?.id,
      reg: c?.reg || f?.reg || regKey,
      type: c?.type || f?.type || "",
      status: c?.status || f?.status || "AIRWORTHY",
      tah: c?.tah ?? f?.tah ?? 0,
      tac: c?.tac ?? f?.tac ?? 0,
      lastCheckDate:
        (c?.lastCheckDate ? String(c.lastCheckDate).slice(0, 10) : "") ||
        (f?.lastCheck ? String(f.lastCheck).slice(0, 10) : ""),
      lastCheckType: c?.lastCheckType || "A",
      nextCheckDate:
        (c?.nextCheckDate ? String(c.nextCheckDate).slice(0, 10) : "") ||
        (f?.nextCheck ? String(f.nextCheck).slice(0, 10) : ""),
      nextCheckType: c?.nextCheckType || "A",
      coaExpiry: c?.coaExpiry ? String(c.coaExpiry).slice(0, 10) : "",
      insuranceExpiry: c?.insuranceExpiry
        ? String(c.insuranceExpiry).slice(0, 10)
        : "",
      noiseCertExpiry: c?.noiseCertExpiry
        ? String(c.noiseCertExpiry).slice(0, 10)
        : "",
      engine1Hours: c?.engine1Hours ?? 0,
      engine1Cycles: c?.engine1Cycles ?? 0,
      engine2Hours: c?.engine2Hours ?? 0,
      engine2Cycles: c?.engine2Cycles ?? 0,
      apuHours: c?.apuHours ?? 0,
      apuCycles: c?.apuCycles ?? 0,
      llpHours: c?.llpHours ?? 0,
      llpCycles: c?.llpCycles ?? 0,
      adCompliance: c?.adCompliance || [],
      sbCompliance: c?.sbCompliance || [],
      damageList: c?.damageList || [],
      notes: c?.notes || "",
      attachments: mergedDocs,
    };
  });

  return { unifiedFleet, unifiedCamo };
}

/**
 * Save aircraft from Fleet view -> updates BOTH Fleet and CAMO
 */
export async function saveAircraftFromFleet({
  draft,
  isNew,
  beforeReg,
  fleet,
  setFleet,
  camoList,
  setCamoList,
  userName = "",
}) {
  const regClean = String(draft.reg || "").trim().toUpperCase();
  const lookupKey = normalizeReg(beforeReg || regClean);

  const existingFleet = (fleet || []).find(
    (a) =>
      (draft._fleetId && a.id === draft._fleetId) ||
      (!String(a.id).startsWith("camo_virtual_") &&
        normalizeReg(a.reg) === lookupKey)
  );
  const existingCamo = (camoList || []).find(
    (c) =>
      (draft._camoId && c.id === draft._camoId) ||
      (!String(c.id).startsWith("fleet_virtual_") &&
        normalizeReg(c.reg) === lookupKey)
  );

  const docs = parseDocsList(
    draft.attachments ??
      mergeDocsLists(existingFleet?.attachments, existingCamo?.attachments)
  );

  const fleetPayload = {
    reg: regClean,
    type: draft.type || existingCamo?.type || "",
    status: draft.status || "AIRWORTHY",
    tah: Number(draft.tah) || 0,
    tac: Number(draft.tac) || 0,
    lastCheck: draft.lastCheck || "",
    nextCheck: draft.nextCheck || "",
    attachments: docs,
  };

  let savedFleetId = existingFleet?.id;
  if (!isNew && savedFleetId && !String(savedFleetId).startsWith("camo_virtual_")) {
    await fleetAPI.update(savedFleetId, fleetPayload);
  } else {
    const created = await fleetAPI.create(fleetPayload);
    savedFleetId = created.id;
  }

  const camoPayload = {
    ...(existingCamo || {}),
    reg: regClean,
    type: fleetPayload.type,
    status: fleetPayload.status === "GROUNDED" ? "GROUNDED" : "AIRWORTHY",
    tah: fleetPayload.tah,
    tac: fleetPayload.tac,
    lastCheckDate: fleetPayload.lastCheck || existingCamo?.lastCheckDate || "",
    lastCheckType: existingCamo?.lastCheckType || "A",
    nextCheckDate: fleetPayload.nextCheck || existingCamo?.nextCheckDate || "",
    nextCheckType: existingCamo?.nextCheckType || "A",
    coaExpiry: draft.coaExpiry ?? existingCamo?.coaExpiry ?? "",
    insuranceExpiry:
      draft.insuranceExpiry ?? existingCamo?.insuranceExpiry ?? "",
    noiseCertExpiry:
      draft.noiseCertExpiry ?? existingCamo?.noiseCertExpiry ?? "",
    attachments: docs,
    updatedBy: userName,
  };

  let savedCamoId = existingCamo?.id;
  if (savedCamoId && !String(savedCamoId).startsWith("fleet_virtual_")) {
    await camoAPI.update(savedCamoId, camoPayload);
  } else {
    const createdCamo = await camoAPI.create(camoPayload);
    savedCamoId = createdCamo.id;
  }

  const newFleetItem = { ...fleetPayload, id: savedFleetId };
  const newCamoItem = { ...camoPayload, id: savedCamoId };

  setFleet?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedFleetId || normalizeReg(x.reg) === lookupKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedFleetId || normalizeReg(x.reg) === lookupKey
          ? newFleetItem
          : x
      );
    }
    return [...prev, newFleetItem];
  });

  setCamoList?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedCamoId || normalizeReg(x.reg) === lookupKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedCamoId || normalizeReg(x.reg) === lookupKey
          ? newCamoItem
          : x
      );
    }
    return [...prev, newCamoItem];
  });

  return { fleetItem: newFleetItem, camoItem: newCamoItem };
}

/**
 * Save aircraft from CAMO view -> updates BOTH CAMO and Fleet
 */
export async function saveAircraftFromCamo({
  draft,
  isNew,
  beforeReg,
  fleet,
  setFleet,
  camoList,
  setCamoList,
  userName = "",
}) {
  const regClean = String(draft.reg || "").trim().toUpperCase();
  const lookupKey = normalizeReg(beforeReg || regClean);

  const existingCamo = (camoList || []).find(
    (c) =>
      (draft._camoId && c.id === draft._camoId) ||
      (!String(c.id).startsWith("fleet_virtual_") &&
        normalizeReg(c.reg) === lookupKey)
  );
  const existingFleet = (fleet || []).find(
    (f) =>
      (draft._fleetId && f.id === draft._fleetId) ||
      (!String(f.id).startsWith("camo_virtual_") &&
        normalizeReg(f.reg) === lookupKey)
  );

  const docs = parseDocsList(
    draft.attachments ??
      mergeDocsLists(existingCamo?.attachments, existingFleet?.attachments)
  );

  const camoPayload = {
    ...(existingCamo || {}),
    ...draft,
    reg: regClean,
    tah: Number(draft.tah) || 0,
    tac: Number(draft.tac) || 0,
    attachments: docs,
    updatedBy: userName,
  };

  let savedCamoId = existingCamo?.id;
  if (!isNew && savedCamoId && !String(savedCamoId).startsWith("fleet_virtual_")) {
    await camoAPI.update(savedCamoId, camoPayload);
  } else {
    const createdCamo = await camoAPI.create(camoPayload);
    savedCamoId = createdCamo.id;
  }

  const fleetStatus =
    camoPayload.status === "GROUNDED"
      ? "GROUNDED"
      : existingFleet?.status && existingFleet.status !== "GROUNDED"
      ? existingFleet.status
      : "AIRWORTHY";

  const fleetPayload = {
    ...(existingFleet || {}),
    reg: regClean,
    type: camoPayload.type || existingFleet?.type || "",
    status: fleetStatus,
    tah: camoPayload.tah,
    tac: camoPayload.tac,
    lastCheck: camoPayload.lastCheckDate || existingFleet?.lastCheck || "",
    nextCheck: camoPayload.nextCheckDate || existingFleet?.nextCheck || "",
    attachments: docs,
  };

  let savedFleetId = existingFleet?.id;
  if (savedFleetId && !String(savedFleetId).startsWith("camo_virtual_")) {
    await fleetAPI.update(savedFleetId, fleetPayload);
  } else {
    const createdFleet = await fleetAPI.create(fleetPayload);
    savedFleetId = createdFleet.id;
  }

  const newCamoItem = { ...camoPayload, id: savedCamoId };
  const newFleetItem = { ...fleetPayload, id: savedFleetId };

  setCamoList?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedCamoId || normalizeReg(x.reg) === lookupKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedCamoId || normalizeReg(x.reg) === lookupKey
          ? newCamoItem
          : x
      );
    }
    return [...prev, newCamoItem];
  });

  setFleet?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedFleetId || normalizeReg(x.reg) === lookupKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedFleetId || normalizeReg(x.reg) === lookupKey
          ? newFleetItem
          : x
      );
    }
    return [...prev, newFleetItem];
  });

  return { camoItem: newCamoItem, fleetItem: newFleetItem };
}

/**
 * Save aircraft documents (and optional statutory certificate dates)
 * from EITHER Fleet OR CAMO -> updates BOTH Fleet and CAMO sheets & states
 */
export async function saveAircraftDocsBothWays({
  reg,
  docs,
  certDates = null,
  fleet,
  setFleet,
  camoList,
  setCamoList,
  userName = "",
}) {
  const regKey = normalizeReg(reg);
  if (!regKey) throw new Error("Aircraft registration is required");

  const normalizedDocs = parseDocsList(docs);

  const existingFleet = (fleet || []).find(
    (a) =>
      !String(a.id).startsWith("camo_virtual_") &&
      normalizeReg(a.reg) === regKey
  );
  const existingCamo = (camoList || []).find(
    (c) =>
      !String(c.id).startsWith("fleet_virtual_") &&
      normalizeReg(c.reg) === regKey
  );

  const fleetPayload = {
    reg: existingFleet?.reg || existingCamo?.reg || regKey,
    type: existingFleet?.type || existingCamo?.type || "",
    status: existingFleet?.status || existingCamo?.status || "AIRWORTHY",
    tah: existingFleet?.tah ?? existingCamo?.tah ?? 0,
    tac: existingFleet?.tac ?? existingCamo?.tac ?? 0,
    lastCheck:
      existingFleet?.lastCheck || existingCamo?.lastCheckDate || "",
    nextCheck:
      existingFleet?.nextCheck || existingCamo?.nextCheckDate || "",
    attachments: normalizedDocs,
  };

  let savedFleetId = existingFleet?.id;
  if (savedFleetId) {
    await fleetAPI.update(savedFleetId, fleetPayload);
  } else {
    const createdF = await fleetAPI.create(fleetPayload);
    savedFleetId = createdF.id;
  }

  const camoPayload = {
    ...(existingCamo || {}),
    reg: fleetPayload.reg,
    type: existingCamo?.type || fleetPayload.type,
    status:
      existingCamo?.status ||
      (fleetPayload.status === "GROUNDED" ? "GROUNDED" : "AIRWORTHY"),
    tah: existingCamo?.tah ?? fleetPayload.tah,
    tac: existingCamo?.tac ?? fleetPayload.tac,
    lastCheckDate:
      existingCamo?.lastCheckDate || fleetPayload.lastCheck || "",
    lastCheckType: existingCamo?.lastCheckType || "A",
    nextCheckDate:
      existingCamo?.nextCheckDate || fleetPayload.nextCheck || "",
    nextCheckType: existingCamo?.nextCheckType || "A",
    coaExpiry:
      certDates?.coaExpiry !== undefined
        ? certDates.coaExpiry
        : existingCamo?.coaExpiry || "",
    insuranceExpiry:
      certDates?.insuranceExpiry !== undefined
        ? certDates.insuranceExpiry
        : existingCamo?.insuranceExpiry || "",
    noiseCertExpiry:
      certDates?.noiseCertExpiry !== undefined
        ? certDates.noiseCertExpiry
        : existingCamo?.noiseCertExpiry || "",
    attachments: normalizedDocs,
    updatedBy: userName,
  };

  let savedCamoId = existingCamo?.id;
  if (savedCamoId) {
    await camoAPI.update(savedCamoId, camoPayload);
  } else {
    const createdC = await camoAPI.create(camoPayload);
    savedCamoId = createdC.id;
  }

  const updatedFleetItem = { ...fleetPayload, id: savedFleetId };
  const updatedCamoItem = { ...camoPayload, id: savedCamoId };

  setFleet?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedFleetId || normalizeReg(x.reg) === regKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedFleetId || normalizeReg(x.reg) === regKey
          ? updatedFleetItem
          : x
      );
    }
    return [...prev, updatedFleetItem];
  });

  setCamoList?.((prev = []) => {
    const exists = prev.some(
      (x) => x.id === savedCamoId || normalizeReg(x.reg) === regKey
    );
    if (exists) {
      return prev.map((x) =>
        x.id === savedCamoId || normalizeReg(x.reg) === regKey
          ? updatedCamoItem
          : x
      );
    }
    return [...prev, updatedCamoItem];
  });

  return { fleetItem: updatedFleetItem, camoItem: updatedCamoItem };
}

/**
 * Delete aircraft from BOTH Fleet and CAMO
 */
export async function deleteAircraftBothWays({
  reg,
  fleet,
  setFleet,
  camoList,
  setCamoList,
}) {
  const regKey = normalizeReg(reg);
  const existingFleet = (fleet || []).find(
    (a) =>
      !String(a.id).startsWith("camo_virtual_") &&
      normalizeReg(a.reg) === regKey
  );
  const existingCamo = (camoList || []).find(
    (c) =>
      !String(c.id).startsWith("fleet_virtual_") &&
      normalizeReg(c.reg) === regKey
  );

  const ops = [];
  if (existingFleet?.id) ops.push(fleetAPI.remove(existingFleet.id));
  if (existingCamo?.id) ops.push(camoAPI.remove(existingCamo.id));
  await Promise.all(ops);

  setFleet?.((prev = []) =>
    prev.filter((a) => normalizeReg(a.reg) !== regKey)
  );
  setCamoList?.((prev = []) =>
    prev.filter((c) => normalizeReg(c.reg) !== regKey)
  );
}

/**
 * Full 2-way reconciliation of any unlinked legacy records between Fleet and CAMO
 */
export async function syncAllFleetAndCamo({
  fleet,
  setFleet,
  camoList,
  setCamoList,
  userName = "",
}) {
  const { unifiedFleet, unifiedCamo } = buildUnifiedFleetAndCamo(
    fleet,
    camoList
  );

  for (const uf of unifiedFleet) {
    if (!uf._fleetId) {
      await fleetAPI.create({
        reg: uf.reg,
        type: uf.type,
        status: uf.status,
        tah: uf.tah,
        tac: uf.tac,
        lastCheck: uf.lastCheck,
        nextCheck: uf.nextCheck,
        attachments: uf.attachments,
      });
    }
  }

  for (const uc of unifiedCamo) {
    if (!uc._camoId) {
      await camoAPI.create({
        ...uc,
        updatedBy: userName,
      });
    } else {
      const f = (fleet || []).find(
        (x) => normalizeReg(x.reg) === normalizeReg(uc.reg)
      );
      if (f) {
        const fDocs = parseDocsList(f.attachments);
        const cDocs = parseDocsList(uc.attachments);
        if (fDocs.length !== cDocs.length) {
          const merged = mergeDocsLists(fDocs, cDocs);
          await Promise.all([
            fleetAPI.update(f.id, { ...f, attachments: merged }),
            camoAPI.update(uc._camoId, { ...uc, attachments: merged, updatedBy: userName }),
          ]);
        }
      }
    }
  }

  const [freshFleet, freshCamo] = await Promise.all([
    fleetAPI.list(),
    camoAPI.list(),
  ]);
  setFleet?.(freshFleet);
  setCamoList?.(freshCamo);
  return { fleet: freshFleet, camo: freshCamo };
}
