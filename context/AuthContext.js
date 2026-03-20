// context/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "http://localhost:4000";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, email, name }
  const [token, setToken] = useState(null); // JWT from backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load saved session on app startup
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("authSession");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.token && parsed?.user) {
            setToken(parsed.token);
            setUser(parsed.user);
          }
        }
      } catch (e) {
        console.log("Auth load error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveSession = useCallback(async (userObj, tokenStr) => {
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

  const clearSession = useCallback(async () => {
    setUser(null);
    setToken(null);
    try {
      await AsyncStorage.removeItem("authSession");
    } catch (e) {
      console.log("Auth clear error", e);
    }
  }, []);

  const register = useCallback(
    async (email, password, name) => {
      setError(null);
      try {
        const resp = await fetch(`${BASE_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.error || "Registration failed");
        }

        if (!json.user || !json.token) {
          throw new Error("Invalid response from server");
        }

        await saveSession(json.user, json.token);
        return { ok: true };
      } catch (e) {
        console.log("register error", e);
        const msg = e?.message || "Something went wrong";
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [saveSession]
  );

  const login = useCallback(
    async (email, password) => {
      setError(null);
      try {
        const resp = await fetch(`${BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.error || "Login failed");
        }

        if (!json.user || !json.token) {
          throw new Error("Invalid response from server");
        }

        await saveSession(json.user, json.token);
        return { ok: true };
      } catch (e) {
        console.log("login error", e);
        const msg = e?.message || "Something went wrong";
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [saveSession]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = {
    user,
    token,
    loading,
    error,
    register,
    login,
    logout,         // 👈 IMPORTANT: logout is actually in the context
    setError,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
