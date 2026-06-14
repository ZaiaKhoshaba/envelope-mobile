// lib/idleNotifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Watches the unallocated balance and schedules a single local notification
// 24 hours after funds become idle (unallocated > $1).
//
// Rules:
//   • Only one reminder is ever pending at a time.
//   • Opening the app does NOT reset the 24h clock — the timer starts when
//     money first becomes unallocated and is not pushed back by app usage.
//   • Cancelled immediately when unallocated drops to $0 or below.
//   • Threshold of $1 avoids nagging over rounding dust.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";

const IDLE_ID_KEY     = "@tend_idle_notification_id";
const REMIND_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_IDLE_AMOUNT = 1;                    // ignore balances under $1

// ── Android notification channel ──────────────────────────────────────────────

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("idle", {
    name: "Unallocated funds reminder",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: "#2563EB",
    sound: true,
  });
}

// ── Format currency ───────────────────────────────────────────────────────────

function fmtAmount(amount) {
  return Number(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Cancel any pending idle reminder ─────────────────────────────────────────

export async function cancelIdleReminder() {
  try {
    const id = await AsyncStorage.getItem(IDLE_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(IDLE_ID_KEY);
      console.log("[idleNotifications] Reminder cancelled");
    }
  } catch (e) {
    console.warn("[idleNotifications] cancelIdleReminder error:", e.message);
  }
}

// ── Schedule a 24h idle reminder (only if none is already pending) ────────────

async function scheduleIdleReminder(amount) {
  // Don't push the clock back — if one is already scheduled, leave it alone
  const existing = await AsyncStorage.getItem(IDLE_ID_KEY);
  if (existing) return;

  // Respect existing permission — don't request here (payday flow handles that)
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const fireDate = new Date(Date.now() + REMIND_AFTER_MS);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💡 Funds sitting idle",
        body: `$${fmtAmount(amount)} is unallocated. Assign it to an envelope so every dollar has a job.`,
        data: {
          type:   "idle",
          screen: "envelopes",
        },
        sound: true,
        ...(Platform.OS === "android" && { channelId: "idle" }),
      },
      trigger: { date: fireDate },
    });

    await AsyncStorage.setItem(IDLE_ID_KEY, id);
    console.log(`[idleNotifications] Scheduled for ${fireDate.toLocaleString("en-AU")}`);
  } catch (e) {
    console.warn("[idleNotifications] scheduleNotificationAsync error:", e.message);
  }
}

// ── Hook: call once from _layout.js ──────────────────────────────────────────
// Watches unallocated and reacts whenever it crosses the idle threshold.

export function useIdleReminder() {
  const { unallocated } = useBudget();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const amount = unallocated ?? 0;

    if (amount > MIN_IDLE_AMOUNT) {
      // Money sitting idle — schedule a nudge if not already pending
      scheduleIdleReminder(amount);
    } else {
      // Fully allocated — cancel any pending reminder
      cancelIdleReminder();
    }
  }, [unallocated, isAuthenticated]);
}
