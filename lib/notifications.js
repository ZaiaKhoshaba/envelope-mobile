// lib/notifications.js

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useBudget } from "../context/BudgetContext";

const BASE_URL = "https://envelope-bank-backend.onrender.com";

console.log("[notifications] MODULE LOADED, BASE_URL:", BASE_URL);

// ── Android notification channel ──────────────────────────────────────────────

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("transactions", {
    name: "Transaction alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2563EB",
    sound: true,
  });
}

// ── Foreground notification behaviour ────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Helper: sleep ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Register push token with backend (with retry) ─────────────────────────────
// Render free tier sleeps after inactivity and takes ~30s to wake.
// We retry up to 3 times with increasing delays to handle cold starts.

async function registerPushToken(authToken) {
  try {
    // Check / request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[notifications] Permission not granted — skipping registration");
      return null;
    }

    // Get Expo push token
    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "517157dd-876b-450b-bedd-761c640396d6",
      });
    } catch (tokenErr) {
      console.warn("[notifications] getExpoPushTokenAsync failed:", tokenErr.message);
      return null;
    }

    const pushToken = tokenData.data;
    console.log("[notifications] Push token:", pushToken);
    console.log("[notifications] Auth token present:", !!authToken);

    // Retry loop — 3 attempts with delays of 2s, 15s, 40s
    // This handles Render cold starts which can take up to 60s
    const delays = [2000, 15000, 40000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      await sleep(delays[attempt]);
      console.log(`[notifications] Registration attempt ${attempt + 1} of ${delays.length}...`);

      try {
        const resp = await fetch(`${BASE_URL}/push/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token: pushToken }),
        });

        const responseText = await resp.text();
        console.log(`[notifications] Attempt ${attempt + 1} status:`, resp.status);
        console.log(`[notifications] Attempt ${attempt + 1} body:`, responseText);

        if (resp.ok) {
          console.log("[notifications] Token registered with backend ✓");
          return pushToken;
        }

        // 401 means bad auth token — no point retrying
        if (resp.status === 401) {
          console.warn("[notifications] Auth token rejected — not retrying");
          return null;
        }

        console.warn(`[notifications] Attempt ${attempt + 1} failed (${resp.status}), will retry...`);

      } catch (fetchErr) {
        console.warn(`[notifications] Attempt ${attempt + 1} network error:`, fetchErr.message);
        // Network error — Render might still be waking, continue to next attempt
      }
    }

    console.warn("[notifications] All registration attempts failed");
    return null;

  } catch (e) {
    console.warn("[notifications] registerPushToken unexpected error:", e.message);
    return null;
  }
}

// ── Unregister on logout ──────────────────────────────────────────────────────

export async function unregisterPushToken(authToken) {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "517157dd-876b-450b-bedd-761c640396d6",
    });
    await fetch(`${BASE_URL}/push/unregister`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: tokenData.data }),
    });
    console.log("[notifications] Token unregistered ✓");
  } catch (e) {
    console.warn("[notifications] unregisterPushToken error:", e.message);
  }
}

// ── Hook: call once from _layout.js ──────────────────────────────────────────

export function usePushNotifications() {
  const { token: authToken, isAuthenticated } = useAuth();
  const { setPendingSpend } = useBudget();
  const router = useRouter();
  const notificationListener = useRef(null);
  const responseListener     = useRef(null);
  const hasRegistered        = useRef(false);

  // Keep a stable ref to setPendingSpend so the tap listener closure never goes stale
  const setPendingSpendRef = useRef(setPendingSpend);
  useEffect(() => { setPendingSpendRef.current = setPendingSpend; }, [setPendingSpend]);

  useEffect(() => {
    if (!isAuthenticated || !authToken) {
      hasRegistered.current = false;
      return;
    }

    if (hasRegistered.current) return;
    hasRegistered.current = true;

    console.log("[notifications] Auth confirmed, starting registration...");
    console.log("[notifications] Auth token (first 20):", authToken.slice(0, 20) + "...");

    // Fire and forget — retry logic is inside registerPushToken
    registerPushToken(authToken);

    // Listen for notifications received while app is open (no action needed)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("[notifications] Received:", notification.request.content.data);
    });

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("[notifications] Tapped:", data);

      try {
        // ── Spend notification: open the SpendChooserModal ──────────────────
        // The backend sends type:"spend" plus the transaction fields so the
        // user can allocate without having to sync first.
        if (data?.type === "spend") {
          const tx = {
            id:          data.txId || data.id || `notif_${Date.now()}`,
            merchant:    data.merchant || data.description || "Transaction",
            amount:      -(Math.abs(Number(data.amount || 0))), // ensure negative
            postedAt:    data.postedAt || new Date().toISOString(),
            allocations: [],
            allocated:   false,
          };

          // Queue the transaction for allocation, then surface the home screen
          // where the global SpendChooserModal will appear automatically.
          setPendingSpendRef.current(tx);
          router.push("/");
        } else {
          // ── All other notifications: navigate to the flagged screen ────────
          const screen = data?.screen || "transactions";
          router.push(`/${screen}`);
        }
      } catch (e) {
        console.warn("[notifications] Navigation error:", e.message);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [isAuthenticated, authToken]);
}