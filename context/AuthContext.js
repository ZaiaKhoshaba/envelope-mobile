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
import { AppState, Platform } from "react-native";
import { fsSet, fsMerge, fsIncrement } from "../lib/firestore-rest";
import {
  getRememberMe,
  setRememberMe,
  isPinEnabled,
  savePin,
  getPin,
  clearPin,
  recordBgTime,
  popBgTime,
} from "../lib/pinStorage";

const BASE_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

const LOCK_TIMEOUT_MS = 45 * 1000; // 45 seconds

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,       setUser]       = useState(null);
  const [token,      setToken]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [isLocked,   setIsLocked]   = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);

  const appStateRef = useRef(AppState.currentState);
  const userRef     = useRef(null);

  // ── Persist session to AsyncStorage ──────────────────────────────────────────

  const persistSession = useCallback(async (userObj, tokenStr) => {
    setUser(userObj);
    setToken(tokenStr);
    try {
      await AsyncStorage.setItem(
        "authSession",
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
      await AsyncStorage.removeItem("authSession");
    } catch (e) {
      console.log("Auth clear error", e);
    }
  }, []);

  // Keep ref in sync so AppState listener always sees current auth state
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Startup: restore session only when rememberMe = true ─────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [stored, remembered, pinOn] = await Promise.all([
          AsyncStorage.getItem("authSession"),
          getRememberMe(),
          isPinEnabled(),
        ]);

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
        if (userRef.current) {
          const uid = String(userRef.current.id);
          fsMerge("users", uid, { lastActive: new Date() }).catch(() => {});
        }
      }
    });

    return () => sub.remove();
  }, []);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  const register = useCallback(
    async (email, password, firstName, surname, dateOfBirth, gender) => {
      setError(null);
      const delays = [0, 8000, 20000];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
        try {
          const resp = await fetch(`${BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, firstName, surname, dateOfBirth, gender }),
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

          // Mirror to Firestore — background
          const uid = String(json.user.id);
          fsSet("users", uid, {
            email,
            name: `${firstName} ${surname}`,
            firstName,
            createdAt: new Date(),
            lastLogin: new Date(),
            loginCount: 1,
            subscriptionStatus: "trial",
            platform: Platform.OS,
          }).catch(e => console.log("Firestore register error:", e.message));

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

          // Mirror to Firestore — background
          const uid = String(json.user.id);
          Promise.all([
            fsMerge("users", uid, { lastLogin: new Date(), email }),
            fsIncrement("users", uid, "loginCount"),
          ]).catch(e => console.log("Firestore login error:", e.message));

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
    const stored = await getPin();
    return stored === pin;
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    if (userRef.current) {
      const uid = String(userRef.current.id);
      fsMerge("users", uid, { lastActive: new Date() })
        .catch(() => {});
    }
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
