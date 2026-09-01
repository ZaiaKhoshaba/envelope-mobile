// lib/purchases.js
//
// A thin wrapper around RevenueCat that degrades gracefully.
//
// react-native-purchases is a native module, so it does NOT work in Expo Go —
// only in a development build or a real store build. Every call here is guarded,
// so in Expo Go the app keeps running and simply reports that purchases are
// unavailable, instead of crashing.
//
// Set these in your .env (they are public SDK keys, safe to ship):
//   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx
//   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxx
//   EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=premium   (optional, defaults to "premium")

import { Platform } from "react-native";

const IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY     || "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";

export const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || "premium";

// Load the native module defensively — missing in Expo Go.
let Purchases = null;
try {
  const mod = require("react-native-purchases");
  Purchases = mod?.default ?? mod ?? null;
} catch {
  Purchases = null;
}

let configured = false;

export function apiKey() {
  return Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
}

/** True when the SDK is present AND a key is configured. */
export function isAvailable() {
  return !!Purchases && !!apiKey();
}

/** Why purchases aren't available — used for honest messaging. */
export function unavailableReason() {
  if (!Purchases) {
    return "Purchases need a development build of Tend — they don't run inside Expo Go.";
  }
  if (!apiKey()) {
    return "Purchases aren't configured yet (no RevenueCat key set for this platform).";
  }
  return null;
}

/**
 * Point RevenueCat at this user. The app user ID MUST be the Tend user id so the
 * admin panel and the subscription webhook are talking about the same person.
 */
export async function configure(appUserId) {
  if (!isAvailable() || !appUserId) return false;
  try {
    if (!configured) {
      await Purchases.configure({ apiKey: apiKey(), appUserID: appUserId });
      configured = true;
    } else {
      await Purchases.logIn(appUserId);
    }
    return true;
  } catch (e) {
    console.log("[purchases] configure failed:", e?.message || e);
    return false;
  }
}

export async function logOut() {
  if (!isAvailable() || !configured) return;
  try { await Purchases.logOut(); } catch { /* ignore */ }
}

/** Live products from the stores, so prices are always the real ones. */
export async function getOfferings() {
  if (!isAvailable()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch (e) {
    console.log("[purchases] getOfferings failed:", e?.message || e);
    return null;
  }
}

/** Buy a package from an offering. Returns { ok, cancelled?, error? }. */
export async function purchasePackage(pkg) {
  if (!isAvailable()) return { ok: false, error: unavailableReason() };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ok: !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] };
  } catch (e) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message || "The purchase didn't complete." };
  }
}

/** Restore a subscription bought with the same store account. */
export async function restore() {
  if (!isAvailable()) return { ok: false, error: unavailableReason() };
  try {
    const customerInfo = await Purchases.restorePurchases();
    const active = !!customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
    return { ok: active, error: active ? null : "No active subscription was found for this store account." };
  } catch (e) {
    return { ok: false, error: e?.message || "Restore didn't complete." };
  }
}

/** Current entitlement straight from the SDK cache. */
export async function isEntitled() {
  if (!isAvailable()) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info?.entitlements?.active?.[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}
