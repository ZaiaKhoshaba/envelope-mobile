// context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "../lib/secureStorage";
import { AppState, Platform } from "react-native";
import {
  getRememberMe,
  setRememberMe,
  isPinEnabled,
  savePin,
  verifyPinHash,
  clearPin,
  recordBgTime,
  popBgTime,
} from "../lib/pinStorage";

// Session lives in the device keychain/keystore, not plain AsyncStorage.
const SESSION_KEY        = "tend_auth_session";
const LEGACY_SESSION_KEY = "authSession"; // old AsyncStorage location — migrated on startup

const BASE_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

// Lock the app when it has been in the background for longer than this
const LOCK_TIMEOUT_MS = 45 * 1000;

const AuthContext = createContext(null);

// Fire-and-forget "user is active" ping to our own backend.
// Replaces the old client→Firestore tracking (no third-party services).
function pingActive(token) {
  if (!token) return;
  fetch(`${BASE_URL}/track/active`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [token,      setToken]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [isLocked,   setIsLocked]   = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const userRef     = useRef(null);
  const tokenRef    = useRef(null);

  // ── Persist session to AsyncStorage ──────────────────────────────────────────

  const persistSession = useCallback(async (userObj, tokenStr) => {
    setUser(userObj);
    setToken(tokenStr);
    try {
      await SecureStore.setItemAsync(
        SESSION_KEY,
        JSON.stringify({ user: userObj, token: tokenStr })
      );
    } catch (e) {
      console.log("Auth save error", e);
    }
  }, []);

  const clearStoredSession = useCallback(async () => {
    setUser(null);
    setToken(null);
    setIsLocked(false);
    try {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (e) {
      console.log("Auth clear error", e);
    }
  }, []);

  // Keep refs in sync so AppState listener always sees current auth state
  useEffect(() => { userRef.current  = user;  }, [user]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // ── Startup: restore session only when rememberMe = true ─────────────────────

  useEffect(() => {
    (async () => {
      try {
        let [stored, remembered, pinOn] = await Promise.all([
          SecureStore.getItemAsync(SESSION_KEY),
          getRememberMe(),
          isPinEnabled(),
        ]);

        // Migrate a legacy AsyncStorage session into the keychain, then wipe it
        if (!stored) {
          const legacy = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
          if (legacy) {
            stored = legacy;
            await SecureStore.setItemAsync(SESSION_KEY, legacy).catch(() => {});
            await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});
          }
        }

        setPinEnabled(pinOn);

        if (stored && remembered) {
          const parsed = JSON.parse(stored);
          if (parsed?.token && parsed?.user) {
            setUser(parsed.user);
            setToken(parsed.token);
            if (pinOn) setIsLocked(true);
          }
        }
      } catch (e) {
        console.log("Auth load error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── AppState listener: lock after 5-min background ───────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === "active" && nextState === "background") {
        await recordBgTime();
      }

      if (prev === "background" && nextState === "active") {
        const bgAt = await popBgTime();
        const pinOn = await isPinEnabled();
        // Only lock if the user is actually authenticated — never on the login screen
        if (bgAt && Date.now() - bgAt >= LOCK_TIMEOUT_MS && pinOn && userRef.current) {
          setIsLocked(true);
        }
        // Record activity whenever app comes to foreground
        if (userRef.current) pingActive(tokenRef.current);
      }
    });

    return () => sub.remove();
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  const register = useCallback(
    async (email, password, firstName, surname) => {
      setError(null);
      const delays = [0, 8000, 20000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
        try {
          const resp = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, firstName, surname, platform: Platform.OS }),
          });

          const json = await resp.json();
          if (!resp.ok) {
            if (resp.status < 500) {
              const msg = json?.error || "Registration failed";
              setError(msg);
              return { ok: false, error: msg };
            }
            console.log(`register attempt ${attempt + 1} failed (${resp.status}), retrying...`);
            continue;
          }

          if (!json.user || !json.token) throw new Error("Invalid response from server");

          // Always remember after registration — user only hits login again via logout
          await setRememberMe(true);
          await persistSession(json.user, json.token);

          return { ok: true };
        } catch (e) {
          console.log(`register attempt ${attempt + 1} error:`, e.message);
          if (attempt === delays.length - 1) {
            const msg = "Registration failed. Please check your connection and try again.";
            setError(msg);
            return { ok: false, error: msg };
          }
        }
      }
      const msg = "Registration failed. Please try again.";
      setError(msg);
      return { ok: false, error: msg };
    },
    [persistSession]
  );

  const login = useCallback(
    async (email, password, remember = false) => {
      setError(null);
      const delays = [0, 8000, 20000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
        try {
          const resp = await fetch(`${BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });

          const json = await resp.json();
          if (!resp.ok) {
            if (resp.status < 500) {
              const msg = json?.error || "Login failed";
              setError(msg);
              return { ok: false, error: msg };
            }
            console.log(`login attempt ${attempt + 1} failed (${resp.status}), retrying...`);
            continue;
          }

          if (!json.user || !json.token) throw new Error("Invalid response from server");

          await setRememberMe(remember);
          if (remember) {
            await persistSession(json.user, json.token);
          } else {
            // Session lives only in memory — fresh login on next cold start
            setUser(json.user);
            setToken(json.token);
          }

          return { ok: true };
        } catch (e) {
          console.log(`login attempt ${attempt + 1} error:`, e.message);
          if (attempt === delays.length - 1) {
            const msg = "Login failed. Please check your connection and try again.";
            setError(msg);
            return { ok: false, error: msg };
          }
        }
      }
      const msg = "Login failed. Please try again.";
      setError(msg);
      return { ok: false, error: msg };
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    await setRememberMe(false);
    await clearStoredSession();
  }, [clearStoredSession]);

  // Permanently delete the account and everything stored for it. The server
  // revokes any bank consents first, then removes the user's records; we only
  // clear the local session once that has actually succeeded.
  const deleteAccount = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return { ok: false, error: "You're not signed in." };
    try {
      const r = await fetch(`${BASE_URL}/account`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) {
        return { ok: false, error: j?.error || `Couldn't delete your account (${r.status}). Please try again.` };
      }
      await setRememberMe(false);
      await clearStoredSession();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
    }
  }, [clearStoredSession]);

  // ── PIN management ────────────────────────────────────────────────────────────

  const enablePin = useCallback(async (pin) => {
    await savePin(pin);
    setPinEnabled(true);
  }, []);

  const disablePin = useCallback(async () => {
    await clearPin();
    setPinEnabled(false);
  }, []);

  const verifyPin = useCallback(async (pin) => {
    return verifyPinHash(pin);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    if (userRef.current) pingActive(tokenRef.current);
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────────

  const value = {
    user,
    token,
    loading,
    error,
    isLocked,
    pinEnabled,
    register,
    login,
    logout,
    deleteAccount,
    enablePin,
    disablePin,
    verifyPin,
    unlock,
    setError,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
}
