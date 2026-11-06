/* ═══════════════════════════════════════════════════════════
 * AUTH CONTEXT
 * v5.0 — FINAL: standalone provider, no external initialUser
 * ═══════════════════════════════════════════════════════════ */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export const AuthCtx = createContext({
  user: null,
  setUser: () => {},
  logout: () => {},
  can: () => false,
});

const readUserFromStorage = () => {
  try {
    const raw = localStorage.getItem("aeroops.user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  /* ⭐ يُقرأ من localStorage مباشرة عند mount */
  const [user, setUserState] = useState(() => readUserFromStorage());

  /* ⭐ مزامنة عند تغيير localStorage من تاب آخر */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "aeroops.user") {
        setUserState(readUserFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ⭐ setUser يحفظ في state + localStorage */
  const setUser = useCallback((u) => {
    setUserState(u);
    try {
      if (u) {
        localStorage.setItem("aeroops.user", JSON.stringify(u));
      } else {
        localStorage.removeItem("aeroops.user");
      }
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    try {
      localStorage.removeItem("aeroops.user");
    } catch {}
  }, []);

  const value = {
    user,
    setUser,
    logout,
    can: () => false,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  return (
    ctx || {
      user: null,
      setUser: () => {},
      logout: () => {},
      can: () => false,
    }
  );
};
