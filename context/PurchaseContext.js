// context/PurchaseContext.js
//
// Manages the 30-day free trial and subscription status.
// During development the purchase/restore calls are stubs — wire up
// RevenueCat (react-native-purchases) here when submitting to the stores.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";

// ── Config ─────────────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 30;

// ── Dev override ───────────────────────────────────────────────────────────────
// Set to true to simulate a free user (no bank access) in Expo Go.
// Flip back to false when testing premium features.
const DEV_FORCE_FREE_USER = true;

// Prices shown in the UI (AUD)
export const PLANS = {
  monthly: {
    id:        "envelopes_monthly_499",   // ← replace with your App Store product ID
    label:     "Monthly",
    price:     "$4.99",
    period:    "/ month",
    savingTag: null,
  },
  annual: {
    id:        "envelopes_annual_2999",   // ← replace with your App Store product ID
    label:     "Annual",
    price:     "$29.99",
    period:    "/ year",
    savingTag: "Save 50%",
  },
};

// ── Context ────────────────────────────────────────────────────────────────────

const PurchaseContext = createContext(null);

export function PurchaseProvider({ children }) {
  const { user } = useAuth();

  const [trialStartDate, setTrialStartDate] = useState(null);
  const [isSubscribed,   setIsSubscribed]   = useState(false);
  const [isFreeUser,     setIsFreeUser]     = useState(false); // chose "continue free"
  const [isLoading,      setIsLoading]      = useState(true);

  // Load (or initialise) trial data whenever the logged-in user changes
  useEffect(() => {
    if (!user?.id) {
      setTrialStartDate(null);
      setIsSubscribed(false);
      setIsLoading(false);
      return;
    }

    (async () => {
      setIsLoading(true);
      try {
        // Trial start date — set once on first login, never changed
        const trialKey = `trial_start_${user.id}`;
        let stored = await AsyncStorage.getItem(trialKey);
        if (!stored) {
          stored = new Date().toISOString();
          await AsyncStorage.setItem(trialKey, stored);
        }
        setTrialStartDate(stored);

        // Subscription flag (set locally after a successful purchase)
        const subKey = `subscribed_${user.id}`;
        const subStored = await AsyncStorage.getItem(subKey);
        setIsSubscribed(subStored === "true");

        // Free user flag (chose "continue for free" after trial expired)
        const freeKey = `free_user_${user.id}`;
        const freeStored = await AsyncStorage.getItem(freeKey);
        setIsFreeUser(freeStored === "true");
      } catch (e) {
        console.log("[PurchaseContext] load error:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user?.id]);

  // Days remaining in the trial (0 = expired)
  const daysRemaining = useMemo(() => {
    if (!trialStartDate) return TRIAL_DAYS;
    const elapsed = Math.floor(
      (Date.now() - new Date(trialStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, TRIAL_DAYS - elapsed);
  }, [trialStartDate]);

  const trialExpired = daysRemaining === 0;

  // App is accessible when: subscribed, in trial, or chose "continue for free"
  // When no user is logged in we allow access so login/register screens work
  const isActive = !user?.id || isSubscribed || !trialExpired || isFreeUser;

  // Bank sync + notifications require an active subscription or active trial
  // Free users (post-trial, no subscription) cannot access bank connectivity
  const hasBankAccess = DEV_FORCE_FREE_USER
    ? false
    : (!user?.id || isSubscribed || !trialExpired);

  // ── Purchase ────────────────────────────────────────────────────────────────
  // TODO: replace the body of this function with RevenueCat when going live.
  //
  //   import Purchases from "react-native-purchases";
  //   const { customerInfo } = await Purchases.purchaseProduct(productId);
  //   const active = customerInfo.entitlements.active["premium"] != null;
  //   if (active) { ... mark subscribed ... }

  const purchase = useCallback(async (planKey) => {
    const plan = PLANS[planKey];
    if (!plan) return { ok: false, error: "Unknown plan" };

    console.log("[purchases] Purchase triggered:", plan.id);

    // ── Development stub ────────────────────────────────────────────────────
    // Uncomment the lines below to simulate a successful purchase locally
    // (useful for testing the post-paywall experience before the app is live).
    //
    // if (user?.id) {
    //   await AsyncStorage.setItem(`subscribed_${user.id}`, "true");
    //   setIsSubscribed(true);
    //   return { ok: true };
    // }

    return {
      ok:    false,
      error: "In-app purchases are not available in this build.\nThey will work once the app is published to the App Store and Google Play.",
    };
  }, [user?.id]);

  // ── Continue for free ──────────────────────────────────────────────────────
  // Lets the user past the paywall with manual-only access (no bank sync).

  const continueForFree = useCallback(async () => {
    if (!user?.id) return;
    try {
      await AsyncStorage.setItem(`free_user_${user.id}`, "true");
      setIsFreeUser(true);
    } catch (e) {
      console.log("[purchases] continueForFree error:", e);
    }
  }, [user?.id]);

  // ── Restore ────────────────────────────────────────────────────────────────
  // TODO: replace with RevenueCat restore when going live.
  //
  //   import Purchases from "react-native-purchases";
  //   const customerInfo = await Purchases.restorePurchases();
  //   const active = customerInfo.entitlements.active["premium"] != null;

  const restorePurchases = useCallback(async () => {
    console.log("[purchases] Restore triggered");
    return {
      ok:    false,
      error: "Restore is not available in this build.\nIt will work once the app is published.",
    };
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      isSubscribed,
      isFreeUser,
      isActive,
      hasBankAccess,
      trialExpired,
      daysRemaining,
      purchase,
      restorePurchases,
      continueForFree,
      PLANS,
      TRIAL_DAYS,
    }),
    [isLoading, isSubscribed, isFreeUser, isActive, hasBankAccess, trialExpired, daysRemaining, purchase, restorePurchases, continueForFree]
  );

  return (
    <PurchaseContext.Provider value={value}>{children}</PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error("usePurchase must be used inside PurchaseProvider");
  return ctx;
}
