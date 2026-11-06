import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ShieldCheck,
  Save,
  Cloud,
  CheckCircle2,
  LogIn,
  Eye,
  Edit3,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { db, useFirebase } from '../contexts/FirebaseProvider';
import {
  ALL_PERMISSIONS,
  ROLE_TEMPLATES,
  setGlobalRoles,
  upgradeLegacyPortalPerms,
  markPortalSchemaSaved,
  stripInternalPermMarkers,
  getPermissionsWithNamedDashboards,
  can as checkPerm,
} from '../config/permissions';
import { useAuth } from '../contexts';
import { rolesAPI, readSheetCache } from '../api';
import { showToast } from '../utils/dialog';
import { safeArray } from '../utils/helpers';
import { handleFirestoreError, OperationType } from '../utils/firebaseUtils';

const BOOTSTRAPPED_ADMIN_EMAIL = '123adam133@gmail.com';

function sanitizeRoleId(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 64);
}

function isReadPermission(permKey) {
  return (
    permKey.endsWith('.view') ||
    permKey.endsWith('_view') ||
    permKey.endsWith('.docs') ||
    permKey.endsWith('_download') ||
    permKey.endsWith('.card') ||
    permKey.endsWith('.audit') ||
    permKey.endsWith('.login_history') ||
    permKey.endsWith('.audit_log') ||
    (permKey.startsWith('portal.') &&
      !permKey.endsWith('_edit') &&
      permKey !== 'portal.print_with_stamp') ||
    permKey === 'crew.portal'
  );
}

export default function PermissionManager({
  roles = [],
  setRoles,
  setSyncStatus,
}) {
  const { user } = useAuth();
  const { firebaseUser, authReady, signInWithGoogle } = useFirebase();
  const lang = document.documentElement.lang || 'en';

  const canManagePerms = checkPerm(user, 'users.perms');

  const [cloudRolesMap, setCloudRolesMap] = useState({});
  const [selectedRoleKey, setSelectedRoleKey] = useState('dispatcher');
  const [draftPerms, setDraftPerms] = useState([]);
  const [expandedModules, setExpandedModules] = useState({});
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [saving, setSaving] = useState(false);
  const [namedDashboards, setNamedDashboards] = useState(() =>
    readSheetCache('NamedDashboards', [])
  );
  const [rosterGroups, setRosterGroups] = useState(() =>
    readSheetCache('RosterGroups', [])
  );

  useEffect(() => {
    const sync = (e) => {
      const sheet = e?.detail?.sheetName;
      if (!sheet || sheet === 'NamedDashboards') {
        setNamedDashboards(readSheetCache('NamedDashboards', []));
      }
      if (!sheet || sheet === 'RosterGroups') {
        setRosterGroups(readSheetCache('RosterGroups', []));
      }
    };
    window.addEventListener('aeroops:sheetCacheUpdated', sync);
    return () => window.removeEventListener('aeroops:sheetCacheUpdated', sync);
  }, []);

  const permissionsMap = useMemo(
    () => getPermissionsWithNamedDashboards(namedDashboards, rosterGroups),
    [namedDashboards, rosterGroups]
  );

  // Merge database roles, ROLE_TEMPLATES, and Firestore overrides into a unified ACL list
  const unifiedRoles = useMemo(() => {
    const map = new Map();

    Object.entries(ROLE_TEMPLATES).forEach(([key, tpl]) => {
      map.set(key.toLowerCase(), {
        id: null,
        roleKey: key,
        name: key,
        nameAr: tpl.label_ar || key,
        description:
          (lang === 'ar' ? tpl.description_ar : tpl.description_en) || '',
        perms: safeArray(tpl.perms),
        active: true,
        icon: tpl.icon || '🔐',
      });
    });

    (Array.isArray(roles) ? roles : []).forEach((r) => {
      if (!r?.name) return;
      const k = String(r.name).trim().toLowerCase();
      const existing = map.get(k);
      const rawPerms = safeArray(r.perms);
      const resolvedPerms =
        rawPerms.length > 0
          ? stripInternalPermMarkers(upgradeLegacyPortalPerms(rawPerms, r.name))
          : existing?.perms || [];
      map.set(k, {
        id: r.id || existing?.id || null,
        roleKey: r.name,
        name: r.name,
        nameAr: r.nameAr || existing?.nameAr || r.name,
        description: r.description || existing?.description || '',
        perms: resolvedPerms,
        active: r.active !== false,
        icon: existing?.icon || '🔐',
      });
    });

    Object.values(cloudRolesMap).forEach((cr) => {
      if (!cr?.name) return;
      const k = String(cr.name).trim().toLowerCase();
      const existing = map.get(k);
      const rawPerms = safeArray(cr.perms);
      const resolvedPerms =
        rawPerms.length > 0
          ? stripInternalPermMarkers(
              upgradeLegacyPortalPerms(rawPerms, cr.name)
            )
          : existing?.perms || [];
      map.set(k, {
        id: existing?.id || null,
        cloudId: cr.cloudId,
        roleKey: existing?.roleKey || cr.name,
        name: existing?.name || cr.name,
        nameAr: cr.nameAr || existing?.nameAr || cr.name,
        description: cr.description || existing?.description || '',
        perms: resolvedPerms,
        active: cr.active !== false,
        icon: existing?.icon || '🔐',
      });
    });

    return Array.from(map.values());
  }, [roles, cloudRolesMap, lang]);

  // Fetch Cloud Firestore roles ONLY when authenticated with a verified Google account
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) {
      return;
    }

    let cancelled = false;
    setLoadingCloud(true);

    const fetchCloudRoles = async () => {
      try {
        const isBootstrappedAdmin =
          String(firebaseUser.email || '').toLowerCase() ===
          BOOTSTRAPPED_ADMIN_EMAIL;
        const q = isBootstrappedAdmin
          ? collection(db, 'roles')
          : query(collection(db, 'roles'), where('active', '==', true));

        const snapshot = await getDocs(q);
        if (cancelled) return;
        const nextMap = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          nextMap[d.id] = {
            cloudId: d.id,
            ...data,
            perms: safeArray(data.perms),
          };
        });
        setCloudRolesMap(nextMap);
      } catch (error) {
        try {
          handleFirestoreError(error, OperationType.LIST, 'roles');
        } catch {
          // Logged via handleFirestoreError; keep local/API roles active
        }
      } finally {
        if (!cancelled) setLoadingCloud(false);
      }
    };

    fetchCloudRoles();
    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser?.uid, firebaseUser?.emailVerified]);

  const activeRole = useMemo(() => {
    return (
      unifiedRoles.find(
        (r) => r.name.toLowerCase() === selectedRoleKey.toLowerCase()
      ) || unifiedRoles[0]
    );
  }, [unifiedRoles, selectedRoleKey]);

  useEffect(() => {
    if (activeRole) {
      setDraftPerms(safeArray(activeRole.perms));
    }
  }, [activeRole?.name, cloudRolesMap]);

  const isSuperRole = activeRole?.name === 'superAdmin' || draftPerms.includes('*');

  const togglePermList = (keysToAddOrRemove, turnOn) => {
    if (!canManagePerms || activeRole?.name === 'superAdmin') return;
    const base = draftPerms.includes('*')
      ? Object.values(permissionsMap).flatMap((g) => g.perms.map((p) => p.key))
      : [...draftPerms];

    if (turnOn) {
      setDraftPerms(Array.from(new Set([...base, ...keysToAddOrRemove])));
    } else {
      setDraftPerms(base.filter((k) => !keysToAddOrRemove.includes(k)));
    }
  };

  const handleSaveRole = async () => {
    if (!activeRole || !canManagePerms) return;
    setSaving(true);
    setSyncStatus?.('syncing');

    const cleanPerms = (
      activeRole.name === 'superAdmin'
        ? ['*']
        : markPortalSchemaSaved(draftPerms)
    )
      .map((p) => String(p).slice(0, 120))
      .slice(0, 400);

    try {
      // 1) Update primary backend Roles table + global in-memory ACL immediately
      const rolePayload = {
        name: activeRole.name,
        nameAr: activeRole.nameAr || activeRole.name,
        description: activeRole.description || '',
        perms: cleanPerms,
        active: activeRole.active !== false,
      };

      let savedId = activeRole.id;
      if (savedId) {
        await rolesAPI.update(savedId, rolePayload);
      } else {
        const created = await rolesAPI.create(rolePayload);
        savedId = created?.id || savedId;
      }

      const nextRoles = (() => {
        const list = Array.isArray(roles) ? [...roles] : [];
        const idx = list.findIndex(
          (r) =>
            (savedId && r.id === savedId) ||
            String(r.name).toLowerCase() === activeRole.name.toLowerCase()
        );
        const updatedRecord = { ...rolePayload, id: savedId || activeRole.name };
        if (idx >= 0) {
          list[idx] = updatedRecord;
          return list;
        }
        return [...list, updatedRecord];
      })();

      setRoles?.(nextRoles);
      setGlobalRoles(nextRoles);

      // 2) Sync to Cloud Firestore ACL when signed into Firebase Auth
      let syncedToFirestore = false;
      if (firebaseUser && firebaseUser.emailVerified) {
        const docId = sanitizeRoleId(activeRole.name);
        const roleDocRef = doc(db, 'roles', docId);
        let exists = false;
        try {
          const snap = await getDoc(roleDocRef);
          exists = snap.exists();
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `roles/${docId}`);
        }

        try {
          const firestorePerms = cleanPerms
            .map((p) => String(p).slice(0, 64))
            .slice(0, 200);
          if (exists) {
            await updateDoc(roleDocRef, {
              nameAr: String(rolePayload.nameAr || '').slice(0, 64),
              description: String(rolePayload.description || '').slice(0, 256),
              perms: firestorePerms,
              active: Boolean(rolePayload.active),
              updatedBy: String(firebaseUser.uid).slice(0, 128),
              updatedAt: serverTimestamp(),
            });
          } else {
            await setDoc(roleDocRef, {
              name: docId,
              nameAr: String(rolePayload.nameAr || '').slice(0, 64),
              description: String(rolePayload.description || '').slice(0, 256),
              perms: firestorePerms,
              active: Boolean(rolePayload.active),
              updatedBy: String(firebaseUser.uid).slice(0, 128),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          setCloudRolesMap((prev) => ({
            ...prev,
            [docId]: {
              cloudId: docId,
              ...rolePayload,
              name: docId,
            },
          }));
          syncedToFirestore = true;
        } catch (err) {
          handleFirestoreError(
            err,
            exists ? OperationType.UPDATE : OperationType.CREATE,
            `roles/${docId}`
          );
        }
      }

      setSyncStatus?.('synced');
      showToast(
        syncedToFirestore
          ? lang === 'ar'
            ? '✅ تم تحديث مصفوفة الصلاحيات ومزامنتها سحابياً'
            : '✅ Role permissions saved and synced to Cloud Firestore'
          : lang === 'ar'
          ? '✅ تم تحديث صلاحيات الدور بنجاح'
          : '✅ Role permissions updated successfully'
      );
    } catch (error) {
      setSyncStatus?.('error');
      let msg = error instanceof Error ? error.message : String(error);
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      showToast('❌ ' + msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const fbUser = await signInWithGoogle();
      if (fbUser?.cloudSyncDisabled) {
        showToast('⚠️ ' + fbUser.cloudSyncReason, 'warning');
        return;
      }
      showToast(
        lang === 'ar'
          ? '✅ تم ربط حساب Google لمزامنة الصلاحيات'
          : '✅ Google account connected for Cloud ACL sync'
      );
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user') {
        showToast(
          (lang === 'ar' ? '❌ تعذر الربط: ' : '❌ Sign-in cancelled: ') +
            (e?.message || '')
        );
      }
    }
  };

  const cardStyle = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-4 text-white flex flex-wrap items-center justify-between gap-3"
        style={{ background: 'var(--brand-gradient)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {lang === 'ar'
                ? 'مدير الصلاحيات المتقدم (ACL)'
                : 'Fine-Grained Permission Manager'}
            </h3>
            <p className="text-xs opacity-85">
              {lang === 'ar'
                ? 'تحكم دقيق بصلاحيات القراءة والكتابة لكل وحدة حسب الدور الوظيفي'
                : 'Toggle granular module Read & Write access per role'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {firebaseUser ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              {loadingCloud ? 'Syncing…' : 'Firestore ACL Active'}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold shadow hover:opacity-95 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'مزامنة سحابية (Google)' : 'Cloud Sync (Google)'}
            </button>
          )}
        </div>
      </div>

      {/* Role Selector */}
      <div className="p-3 rounded-2xl flex flex-wrap gap-2" style={cardStyle}>
        {unifiedRoles.map((r) => {
          const selected =
            activeRole?.name.toLowerCase() === r.name.toLowerCase();
          return (
            <button
              key={r.name}
              type="button"
              onClick={() => setSelectedRoleKey(r.name)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition"
              style={
                selected
                  ? {
                      background: 'var(--brand-gradient)',
                      color: 'white',
                      boxShadow: 'var(--shadow-sm)',
                    }
                  : {
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                    }
              }
            >
              <span>{r.icon}</span>
              <span>{lang === 'ar' ? r.nameAr || r.name : r.name}</span>
            </button>
          );
        })}
      </div>

      {/* Active Role Module Read/Write Matrix */}
      {activeRole && (
        <div className="p-4 rounded-2xl space-y-3" style={cardStyle}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-default)]">
            <div>
              <div
                className="text-base font-bold flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <span>{activeRole.icon}</span>
                <span>
                  {lang === 'ar'
                    ? activeRole.nameAr || activeRole.name
                    : activeRole.name}
                </span>
                <code
                  className="text-[11px] px-2 py-0.5 rounded font-mono"
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {activeRole.name}
                </code>
              </div>
              {activeRole.description && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {activeRole.description}
                </p>
              )}
            </div>

            {canManagePerms && activeRole.name !== 'superAdmin' && (
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-2 transition disabled:opacity-50"
                style={{
                  background: 'var(--brand-gradient)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {firebaseUser ? (
                  <Cloud className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving
                  ? '…'
                  : lang === 'ar'
                  ? 'حفظ صلاحيات الدور'
                  : 'Save Role Permissions'}
              </button>
            )}
          </div>

          {activeRole.name === 'superAdmin' && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold">
              {lang === 'ar'
                ? 'يمتلك دور المدير العام (Super Admin) كافة صلاحيات القراءة والكتابة في النظام بشكل دائم.'
                : 'Super Admin permanently holds full Read & Write access across all system modules.'}
            </div>
          )}

          <div className="divide-y divide-[var(--border-default)]">
            {Object.entries(permissionsMap).map(([moduleKey, group]) => {
              const allKeys = group.perms.map((p) => p.key);
              const readKeys = allKeys.filter(isReadPermission);
              const writeKeys = allKeys.filter((k) => !isReadPermission(k));

              const hasAllRead =
                readKeys.length > 0 &&
                (isSuperRole || readKeys.every((k) => draftPerms.includes(k)));
              const hasAllWrite =
                writeKeys.length > 0 &&
                (isSuperRole || writeKeys.every((k) => draftPerms.includes(k)));
              const isOpen = Boolean(expandedModules[moduleKey]);

              return (
                <div key={moduleKey} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedModules((prev) => ({
                          ...prev,
                          [moduleKey]: !prev[moduleKey],
                        }))
                      }
                      className="flex items-center gap-2 text-sm font-bold text-start flex-1 min-w-[180px]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span>{group.icon}</span>
                      <span>
                        {lang === 'ar' ? group.label_ar : group.label_en}
                      </span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {isSuperRole
                          ? `${allKeys.length}/${allKeys.length}`
                          : `${
                              allKeys.filter((k) => draftPerms.includes(k))
                                .length
                            }/${allKeys.length}`}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      {readKeys.length > 0 && (
                        <button
                          type="button"
                          disabled={
                            !canManagePerms || activeRole.name === 'superAdmin'
                          }
                          onClick={() => togglePermList(readKeys, !hasAllRead)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition disabled:opacity-60 ${
                            hasAllRead
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                              : 'border-[var(--border-default)] text-[var(--text-muted)]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'قراءة' : 'Read'}
                        </button>
                      )}

                      {writeKeys.length > 0 && (
                        <button
                          type="button"
                          disabled={
                            !canManagePerms || activeRole.name === 'superAdmin'
                          }
                          onClick={() =>
                            togglePermList(writeKeys, !hasAllWrite)
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition disabled:opacity-60 ${
                            hasAllWrite
                              ? 'bg-sky-500/15 border-sky-500 text-sky-700 dark:text-sky-300'
                              : 'border-[var(--border-default)] text-[var(--text-muted)]'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {lang === 'ar' ? 'كتابة' : 'Write'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      className="mt-2 p-3 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-1.5"
                      style={{ backgroundColor: 'var(--bg-app)' }}
                    >
                      {group.perms.map((p) => {
                        const checked =
                          isSuperRole || draftPerms.includes(p.key);
                        const isRead = isReadPermission(p.key);
                        return (
                          <label
                            key={p.key}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs"
                            style={{
                              backgroundColor: checked
                                ? 'var(--bg-card)'
                                : 'transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={
                                !canManagePerms ||
                                activeRole.name === 'superAdmin'
                              }
                              onChange={() =>
                                togglePermList([p.key], !checked)
                              }
                              className="w-4 h-4 accent-sky-600"
                            />
                            <span
                              className="flex-1 font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {lang === 'ar' ? p.ar : p.en}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                isRead
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : 'bg-sky-500/15 text-sky-600'
                              }`}
                            >
                              {isRead ? 'R' : 'W'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
