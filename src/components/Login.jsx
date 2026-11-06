/* ═══════════════════════════════════════════════════════════
 * LOGIN Component
 * v5.0 — Credentials + Google Cloud Auth (Firebase) Sign-In
 * ═══════════════════════════════════════════════════════════ */
import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, AlertCircle, RefreshCw, Cloud } from "lucide-react";
import { useT } from "../contexts";
import { useFirebase } from "../contexts/FirebaseProvider";
import { Field } from "./ui/Field";
import { Input } from "./ui/Input";
import { logLoginSafe, logSafe } from "../utils/audit";
import { alertSuccess, alertError } from "../utils/sounds";
import { usersAPI, readSheetCache, toDisplayImageUrl } from "../api";

const BOOTSTRAPPED_ADMIN_EMAIL = "123adam133@gmail.com";

const isActiveValue = (v) => {
  if (v === true || v === 1 || v === undefined || v === null || v === "") {
    return true;
  }
  const s = String(v).toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "active";
};

const IGNORED_NAMES = [
  "AeroOps",
  "AEROOPS",
  "aeroops",
  "إيرو أوبس",
  "ايرو أوبس",
];

const isValidName = (name) => {
  if (!name) return false;
  const trimmed = String(name).trim();
  if (!trimmed) return false;
  return !IGNORED_NAMES.includes(trimmed);
};

export function Login({ users, onLogin, settings, loading }) {
  const t = useT();
  const { signInWithGoogle } = useFirebase();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [showP, setShowP] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [err, setErr] = useState("");

  const cached = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("aeroops.settingsCache");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const rawLogo = settings?.logo || cached?.logo;
  const logoUrl = toDisplayImageUrl(rawLogo) || "/api/app-logo.png";
  const companyNameEn =
    settings?.companyName || cached?.companyName || "Flight Operations";
  const companyNameAr =
    settings?.companyNameAr || cached?.companyNameAr || "إدارة العمليات الجوية";

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setErr("");

    const loginInput = String(u || "").trim().toLowerCase();
    const passInput = String(p ?? "");
    if (!loginInput || !passInput) {
      setErr(t.invalidLogin || "Invalid credentials");
      alertError();
      return;
    }

    setSubmitting(true);
    try {
      let directory =
        Array.isArray(users) && users.length > 0
          ? users
          : readSheetCache("Users", []);

      if (directory.length === 0) {
        directory = await usersAPI.list().catch(() => []);
      }

      const matchUser = (list) =>
        list.find((x) => {
          const uname = String(x.username ?? "").trim().toLowerCase();
          const uemail = String(x.email ?? "").trim().toLowerCase();
          const idMatch =
            (uname && uname === loginInput) ||
            (uemail && uemail === loginInput);
          if (!idMatch) return false;
          const storedPass = String(x.password ?? "");
          return (
            storedPass === passInput ||
            storedPass.trim() === passInput.trim()
          );
        });

      let foundRaw = matchUser(directory);

      // If cached directory didn't match (e.g. password or user just added in Google Sheets), fetch fresh once
      if (!foundRaw) {
        const freshUsers = await usersAPI.list().catch(() => []);
        if (freshUsers.length > 0) {
          foundRaw = matchUser(freshUsers);
        }
      }

      if (!foundRaw) {
        setErr(t.invalidLogin || "Invalid credentials");
        alertError();
        logLoginSafe(
          { id: "unknown", fullName: u, username: u, role: "unknown" },
          "LOGIN_FAILED",
          false,
          "Invalid credentials"
        );
        return;
      }

      if (!isActiveValue(foundRaw.active)) {
        const msg =
          "هذا المستخدم غير مفعّل (active = " +
          String(foundRaw.active) +
          "). فعّله من Google Sheets.";
        setErr(msg);
        alertError();
        logLoginSafe(foundRaw, "LOGIN_FAILED", false, "User inactive");
        return;
      }

      setErr("");
      logLoginSafe(foundRaw, "LOGIN", true);
      logSafe(foundRaw, "LOGIN", "Auth", foundRaw.id, foundRaw.fullName, {
        username: foundRaw.username,
        role: foundRaw.role,
      });

      alertSuccess();
      onLogin(foundRaw);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErr("");
    setGoogleBusy(true);
    try {
      const fbUser = await signInWithGoogle();
      if (!fbUser?.email) {
        throw new Error("No email returned from Google account.");
      }
      const emailLower = fbUser.email.toLowerCase();

      let directory =
        Array.isArray(users) && users.length > 0
          ? users
          : await usersAPI.list().catch(() => readSheetCache("Users", []));

      // Match against AeroOps Users directory by email
      let matchedUser = directory.find(
        (x) => String(x.email || "").trim().toLowerCase() === emailLower
      );

      // Bootstrapped Admin fallback
      if (!matchedUser && emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
        matchedUser =
          directory.find(
            (x) =>
              String(x.role || "").toLowerCase() === "superadmin" ||
              String(x.username || "").toLowerCase() === "admin"
          ) || {
            id: fbUser.uid,
            username: "admin",
            fullName: fbUser.displayName || "System Administrator",
            email: fbUser.email,
            role: "superAdmin",
            perms: ["*"],
            active: true,
          };
      }

      if (!matchedUser) {
        setErr(
          `Signed in to Google (${fbUser.email}) for Cloud Sync. Now sign in with your username below, or link ${fbUser.email} to a user in Settings → Users.`
        );
        return;
      }

      if (!isActiveValue(matchedUser.active)) {
        setErr("Account is inactive.");
        alertError();
        return;
      }

      const enriched = {
        ...matchedUser,
        uid: fbUser.uid,
        email: matchedUser.email || fbUser.email,
      };
      logLoginSafe(enriched, "LOGIN_GOOGLE", true);
      alertSuccess();
      onLogin(enriched);
    } catch (e) {
      if (e?.code !== "auth/popup-closed-by-user") {
        setErr(e?.message || "Google sign-in failed");
        alertError();
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--bg-app)" }}
    >
      <div
        className="absolute inset-0 opacity-90 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 20% 20%, var(--brand-primary), transparent 50%),
                       radial-gradient(circle at 80% 80%, var(--brand-secondary), transparent 50%),
                       var(--bg-app)`,
        }}
      />

      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-30 pointer-events-none -top-40 -left-40"
        style={{ backgroundColor: "var(--brand-accent)" }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full blur-3xl opacity-20 pointer-events-none -bottom-32 -right-32"
        style={{ backgroundColor: "var(--brand-primary)" }}
      />

      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl fade-in"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="text-center mb-6">
          {logoUrl ? (
            <div
              className="mx-auto mb-3 w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{
                background: "white",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <img
                src={logoUrl}
                alt="logo"
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  const parent = e.currentTarget.parentElement;
                  if (parent) parent.style.display = "none";
                }}
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <h1
              className="font-black text-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              {companyNameEn}
            </h1>
            {companyNameAr && (
              <p
                className="text-sm font-sans"
                style={{ color: "var(--text-muted)" }}
                dir="rtl"
              >
                {companyNameAr}
              </p>
            )}
          </div>
        </div>

        {loading && users.length === 0 && (
          <div
            className="mb-4 p-2.5 rounded-lg text-xs flex items-center gap-2"
            style={{
              backgroundColor: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              color: "var(--brand-primary)",
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {t.loadingData}
          </div>
        )}

        {err && (
          <div className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2 bg-rose-500/10 border border-rose-500/40 text-rose-500">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{err}</span>
          </div>
        )}

        <div className="space-y-4">
          <Field label={t.username}>
            <div className="relative">
              <User
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                value={u}
                onChange={(e) => setU(e.target.value)}
                className="ps-9"
                autoComplete="off"
              />
            </div>
          </Field>

          <Field label={t.password}>
            <div className="relative">
              <Lock
                className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <Input
                type={showP ? "text" : "password"}
                value={p}
                onChange={(e) => setP(e.target.value)}
                className="ps-9 pe-9"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowP((s) => !s)}
                className="absolute top-1/2 -translate-y-1/2 end-3 transition"
                style={{ color: "var(--text-muted)" }}
              >
                {showP ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-6 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: "var(--brand-gradient)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
          {submitting ? "Signing in..." : t.signIn}
        </button>

        <div className="relative my-4 flex items-center justify-center">
          <div
            className="w-full border-t"
            style={{ borderColor: "var(--border-default)" }}
          />
          <span
            className="px-3 text-xs font-semibold"
            style={{
              backgroundColor: "var(--bg-card)",
              color: "var(--text-muted)",
            }}
          >
            OR
          </span>
          <div
            className="w-full border-t"
            style={{ borderColor: "var(--border-default)" }}
          />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleBusy}
          className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-app)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
        >
          <Cloud
            className="w-4 h-4"
            style={{ color: "var(--brand-primary)" }}
          />
          {googleBusy
            ? "Connecting Google…"
            : "Sign in with Google (Cloud Sync)"}
        </button>
      </form>
    </div>
  );
}

export default Login;
