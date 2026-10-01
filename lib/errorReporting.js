// lib/errorReporting.js
// Tells us when Tend breaks on someone's phone.
//
// Until now the only crash reporting was a friend sending a screenshot. That
// worked for five testers and stops working the moment the users are strangers,
// who do not send screenshots — they uninstall.
//
// Reports go to Tend's own backend, not to a third-party crash service. Tend
// dropped Firestore to keep other companies away from its users' data, and
// posting stack traces to one would undo that for no real gain.
//
// What is sent: the error message, the stack, which screen, the platform, the
// app version, and the signed-in user's id when there is one. What is never
// sent: anything from the budget. No balances, no transactions, no merchant
// names, no amounts. A crash report is for us to fix the app, not a back door
// around the rule that bank data stays on the phone.

import { Platform } from "react-native";
import Constants from "expo-constants";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

const APP_VERSION = Constants?.expoConfig?.version || "unknown";

// A crash in a render loop can fire hundreds of times a second. Reporting each
// one would flood the phone's network and our database with the same line, so:
// the same message is reported once, and a session reports at most 10 errors.
const seen = new Set();
let sent = 0;
const MAX_PER_SESSION = 10;

// Set by the navigation layer so a report says which screen broke.
let currentScreen = null;
export function setCurrentScreen(path) { currentScreen = path || null; }

// Set after sign-in so a report can be tied to an account when someone writes in.
let currentUserId = null;
export function setReportingUser(id) { currentUserId = id || null; }

export function reportError(error, { fatal = false, screen } = {}) {
  try {
    const message = String(error?.message || error || "Unknown error").slice(0, 500);

    const key = message + "|" + (screen || currentScreen || "");
    if (seen.has(key) || sent >= MAX_PER_SESSION) return;
    seen.add(key);
    sent++;

    // Deliberately not awaited and never rethrows: reporting a crash must not
    // be able to cause one, and must not hold up whatever the app does next.
    fetch(`${BACKEND_URL}/diag/error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        stack: String(error?.stack || "").slice(0, 4000),
        screen: screen || currentScreen,
        platform: Platform.OS,
        appVersion: APP_VERSION,
        userId: currentUserId,
        fatal,
      }),
    }).catch(() => {});
  } catch {
    /* reporting is best-effort, always */
  }
}

// Catches errors that escape React entirely — a bad await in a handler, a throw
// in a timer. Without this, only render crashes would ever be reported, and
// those are the minority.
export function installGlobalErrorHandler() {
  const g = global;
  if (!g.ErrorUtils || g.__tendErrorHandlerInstalled) return;
  g.__tendErrorHandlerInstalled = true;

  const previous = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: !!isFatal });
    // Hand back to React Native so the red box still appears in development
    // and the app still behaves exactly as it did before in production.
    previous?.(error, isFatal);
  });
}
