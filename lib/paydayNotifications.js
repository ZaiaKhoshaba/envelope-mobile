// lib/paydayNotifications.js
// ─────────────────────────────────────────────────────────────────────────────
// Schedules local push notifications for upcoming paydays based on the user's
// income schedule. Called whenever the schedule changes or income is logged.
//
// Flow:
//   1. User saves income schedule  →  schedulePaydayReminders()
//   2. Notification fires at 8am on payday  →  user taps it
//   3. App opens /add-income with amount pre-filled
//   4. User confirms (or edits) and logs income  →  schedulePaydayReminders()
//      queues the next reminder
// ─────────────────────────────────────────────────────────────────────────────

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PAYDAY_IDS_KEY  = "@tend_payday_notification_ids";
const NOTIFY_AT_HOUR  = 8;   // fire at 8:00 am on payday
const SCHEDULES_AHEAD = 3;   // how many future paydays to schedule at once

// ── Android notification channel ──────────────────────────────────────────────

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("payday", {
    name: "Payday reminders",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    sound: true,
  });
}

// ── Compute upcoming pay dates ────────────────────────────────────────────────
// Mirrors the logic in income-schedule.js getNextPayDates but without UI deps.
// dayOfWeek: 1=Mon … 7=Sun  (matches the DAYS picker in income-schedule.js)

function getPaydayDates(schedule, count = SCHEDULES_AHEAD) {
  const { frequency, dayOfWeek, dayOfMonth, anchorDate } = schedule || {};
  if (!frequency) return [];

  const dates = [];
  const now   = new Date();

  try {
    if (frequency === "weekly" || frequency === "fortnightly") {
      const interval = frequency === "weekly" ? 7 : 14;
      let base;

      if (anchorDate) {
        // Anchor already falls on the right weekday — just step forward
        base = new Date(anchorDate);
        if (isNaN(base.getTime())) base = new Date();
        while (base <= now) base = new Date(base.getTime() + interval * 86400000);
      } else {
        // No anchor — walk forward until we hit the selected weekday
        // dayOfWeek 1=Mon…6=Sat, 7=Sun  →  JS getDay() 1=Mon…6=Sat, 0=Sun
        const jsTarget = dayOfWeek === 7 ? 0 : dayOfWeek;
        base = new Date(now);
        base.setHours(0, 0, 0, 0);
        do {
          base = new Date(base.getTime() + 86400000);
        } while (base.getDay() !== jsTarget);
      }

      for (let i = 0; i < count; i++) {
        const d = new Date(base);
        d.setHours(NOTIFY_AT_HOUR, 0, 0, 0);
        dates.push(d);
        base = new Date(base.getTime() + interval * 86400000);
      }

    } else {
      // Monthly — day-of-month based
      const dom = Number(dayOfMonth) || 1;
      let d = new Date(now.getFullYear(), now.getMonth(), dom, NOTIFY_AT_HOUR, 0, 0, 0);
      if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, dom, NOTIFY_AT_HOUR, 0, 0, 0);
      for (let i = 0; i < count; i++) {
        dates.push(new Date(d));
        d = new Date(d.getFullYear(), d.getMonth() + 1, dom, NOTIFY_AT_HOUR, 0, 0, 0);
      }
    }
  } catch (e) {
    console.warn("[paydayNotifications] getPaydayDates error:", e.message);
  }

  return dates;
}

// ── Format currency for notification body ─────────────────────────────────────

function fmtAmount(amount) {
  return Number(amount).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Cancel all previously scheduled payday reminders ─────────────────────────

export async function cancelPaydayReminders() {
  try {
    const raw = await AsyncStorage.getItem(PAYDAY_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    await Promise.all(
      ids.map(id =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );
    await AsyncStorage.removeItem(PAYDAY_IDS_KEY);
    console.log(`[paydayNotifications] Cancelled ${ids.length} existing reminder(s)`);
  } catch (e) {
    console.warn("[paydayNotifications] cancelPaydayReminders error:", e.message);
  }
}

// ── Schedule the next N payday reminders ─────────────────────────────────────
// Safe to call at any time — cancels existing ones before scheduling fresh ones.

export async function schedulePaydayReminders(schedule) {
  if (!schedule?.amount || !schedule?.frequency) return;

  // Request permission if not already granted
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    if (asked !== "granted") {
      console.log("[paydayNotifications] Permission denied — skipping");
      return;
    }
  }

  // Cancel any stale reminders before scheduling fresh ones
  await cancelPaydayReminders();

  const dates = getPaydayDates(schedule);
  if (!dates.length) return;

  const ids = [];

  for (const date of dates) {
    if (date <= new Date()) continue; // skip any date already in the past

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💰 Payday!",
          body: `You're due $${fmtAmount(schedule.amount)}. Tap to log it.`,
          data: {
            type:   "payday",
            amount: schedule.amount,
            screen: "add-income",
          },
          sound: true,
          ...(Platform.OS === "android" && { channelId: "payday" }),
        },
        trigger: { date },
      });
      ids.push(id);
      console.log(`[paydayNotifications] Scheduled for ${date.toLocaleString("en-AU")}`);
    } catch (e) {
      console.warn("[paydayNotifications] scheduleNotificationAsync error:", e.message);
    }
  }

  // Persist IDs so cancelPaydayReminders can find them later
  await AsyncStorage.setItem(PAYDAY_IDS_KEY, JSON.stringify(ids));
  console.log(`[paydayNotifications] ${ids.length} reminder(s) scheduled`);
}
