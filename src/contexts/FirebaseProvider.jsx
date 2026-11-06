import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let cloudTokenVerified = false;

/**
 * Returns the active Firebase Auth user ONLY after their ID token and refresh
 * pipeline (securetoken.googleapis.com) have been verified healthy.
 * Prevents Firestore from attaching broken/unrefreshable credentials.
 */
export function getVerifiedCloudUser() {
  if (!cloudTokenVerified) return null;
  const u = auth.currentUser;
  if (!u || !u.emailVerified) return null;
  return u;
}

function isUnrecoverableAuthTokenError(error) {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    code.includes('token-service-api') ||
    msg.includes('token-service-api') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('service_disabled') ||
    code === 'auth/invalid-user-token' ||
    code === 'auth/user-token-expired' ||
    code === 'auth/token-expired' ||
    code === 'auth/user-disabled' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-api-key' ||
    code.includes('api-key-not-valid')
  );
}

function extractFriendlyCloudAuthError(error) {
  const raw = String(error?.message || error || '');
  const lower = raw.toLowerCase();
  if (
    lower.includes('token-service-api') ||
    lower.includes('securetoken.googleapis.com')
  ) {
    const projectMatch = raw.match(/project[=-](\d+)/i);
    const projectNum = projectMatch ? projectMatch[1] : firebaseConfig.messagingSenderId || '';
    const url = projectNum
      ? `https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=${projectNum}`
      : 'https://console.cloud.google.com/apis/library/securetoken.googleapis.com';
    return `Token Service API (securetoken.googleapis.com) is disabled in Google Cloud project ${projectNum}. Enable it at ${url} and retry in a few minutes.`;
  }
  return raw || 'Cloud authentication session expired.';
}

function purgeBrowserFirebaseAuthKeys() {
  if (typeof window === 'undefined') return;
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      if (!store) continue;
      const toRemove = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith('firebase:authUser:')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => store.removeItem(k));
    }
  } catch {
    // Ignore storage access errors in restricted iframes
  }
}

async function clearBrokenAuthSession() {
  cloudTokenVerified = false;
  try {
    await signOut(auth);
  } catch {
    // Best-effort sign-out
  }
  purgeBrowserFirebaseAuthKeys();
}

let connectionTested = false;
async function testConnection() {
  if (connectionTested) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export const FirebaseContext = createContext({
  db,
  auth,
  firebaseUser: null,
  authReady: false,
  cloudAuthError: null,
  signInWithGoogle: async () => null,
  signOutFirebase: async () => {},
});

export function FirebaseProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudAuthError, setCloudAuthError] = useState(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = null;

    const bootstrapFirebase = async () => {
      try {
        if (typeof auth.authStateReady === 'function') {
          await auth.authStateReady();
        }
      } catch {
        // Proceed to explicit user check
      }

      // Validate any persisted IndexedDB auth user BEFORE Firestore touches auth credentials
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(true);
          cloudTokenVerified = true;
          if (active) {
            setCloudAuthError(null);
            setFirebaseUser(auth.currentUser);
          }
        } catch (tokenErr) {
          cloudTokenVerified = false;
          if (isUnrecoverableAuthTokenError(tokenErr)) {
            const friendly = extractFriendlyCloudAuthError(tokenErr);
            console.warn('[AeroOps Cloud] Resetting unrefreshable Firebase Auth session:', friendly);
            await clearBrokenAuthSession();
            if (active) {
              setCloudAuthError(friendly);
              setFirebaseUser(null);
            }
          } else {
            // Even on transient token refresh errors, clear session if expired so Firestore stays online
            await clearBrokenAuthSession();
            if (active) {
              setFirebaseUser(null);
            }
          }
        }
      } else {
        cloudTokenVerified = false;
        if (active) setFirebaseUser(null);
      }

      // Now safe to validate Cloud Firestore connection without broken auth tokens
      await testConnection();

      if (!active) return;
      setAuthReady(true);

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return;
        if (!user) {
          cloudTokenVerified = false;
          setFirebaseUser(null);
          setAuthReady(true);
          return;
        }

        try {
          await user.getIdToken();
          if (!active) return;
          cloudTokenVerified = true;
          setCloudAuthError(null);
          setFirebaseUser(user);
          setAuthReady(true);
        } catch (err) {
          cloudTokenVerified = false;
          if (isUnrecoverableAuthTokenError(err)) {
            const friendly = extractFriendlyCloudAuthError(err);
            await clearBrokenAuthSession();
            if (active) {
              setCloudAuthError(friendly);
              setFirebaseUser(null);
              setAuthReady(true);
            }
          } else if (active) {
            setFirebaseUser(null);
            setAuthReady(true);
          }
        }
      });
    };

    bootstrapFirebase();

    const handleOnline = () => {
      if (!connectionTested) {
        testConnection();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setCloudAuthError(null);
    const cred = await signInWithPopup(auth, googleProvider);

    // Immediately verify Token Service API (securetoken.googleapis.com) can refresh tokens
    // so an unrefreshable token never forces Firestore offline later.
    try {
      await cred.user.getIdToken(true);
      cloudTokenVerified = true;
      setFirebaseUser(cred.user);
      return cred.user;
    } catch (tokenErr) {
      if (isUnrecoverableAuthTokenError(tokenErr)) {
        const friendly = extractFriendlyCloudAuthError(tokenErr);
        const snapshotUser = {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: cred.user.displayName,
          emailVerified: cred.user.emailVerified,
          cloudSyncDisabled: true,
          cloudSyncReason: friendly,
        };
        await clearBrokenAuthSession();
        setCloudAuthError(friendly);
        setFirebaseUser(null);
        return snapshotUser;
      }
      cloudTokenVerified = true;
      setFirebaseUser(cred.user);
      return cred.user;
    }
  }, []);

  const signOutFirebase = useCallback(async () => {
    cloudTokenVerified = false;
    setFirebaseUser(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase sign-out warning:', e);
    }
    purgeBrowserFirebaseAuthKeys();
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        db,
        auth,
        firebaseUser,
        authReady,
        cloudAuthError,
        signInWithGoogle,
        signOutFirebase,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);
