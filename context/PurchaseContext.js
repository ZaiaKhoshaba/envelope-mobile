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
import * as Store from "../lib/purchases";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

// ── Launch feature flags ───────────────────────────────────────────────────────
// Flip these to true once Fiskl is integrated and subscriptions are live.
const BANK_ENABLED          = true;
const SUBSCRIPTIONS_ENABLED = true;

// ── Config ─────────────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 30;

/* ═══════════════════════════════════════════════════════════════════════════
   PRICING — edit your prices here, and nowhere else.

   Change `amount` to whatever you want to charge. Everything in the app
   (onboarding, paywall, settings) reads from here, and the annual saving
   badge recalculates itself, so the numbers can never contradict each other.

   Note: once the app is live in the stores, customers always pay the price
   set in App Store Connect / Play Console. These amounts are what Tend shows
   before the store prices load — keep them in step with the store.
   ═══════════════════════════════════════════════════════════════════════════ */
// productId must match the store identifier configured in RevenueCat. These are
// deliberately price-agnostic: store product IDs can never be renamed once the
// stores have them, so the price must not be baked into the name.
export const PRICING = {
  currency: "$",
  monthly: { amount: 4.99,  productId: "tend_premium_monthly" },
  annual:  { amount: 29.99, productId: "tend_premium_annual" },
};

/* Accounts allowed to use the internal testing tools. Add your own logins here.
   Anyone not on this list never sees them, no matter what they tap. */
export const TEST_ACCOUNTS = [
  "zaia.khoshaba@outlook.com",
];

export function isTestAccount(email) {
  if (!email) return false;
  return TEST_ACCOUNTS.includes(String(email).trim().toLowerCase());
}

const money = (n) => `${PRICING.currency}${Number(n).toFixed(2)}`;

// How much cheaper the annual plan is per year, as a whole percentage.
const annualSavingPct = Math.round(
  (1 - PRICING.annual.amount / (PRICING.monthly.amount * 12)) * 100
);

// Prices shown in the UI (AUD) — derived from PRICING above.
export const PLANS = {
  monthly: {
    id:        PRICING.monthly.productId,
    label:     "Monthly",
    price:     money(PRICING.monthly.amount),
    period:    "/ month",
    savingTag: null,
  },
  annual: {
    id:        PRICING.annual.productId,
    label:     "Annual",
    price:     money(PRICING.annual.amount),
    period:    "/ year",
    savingTag: annualSavingPct > 0 ? `Save ${annualSavingPct}%` : null,
  },
};

// ── Context ────────────────────────────────────────────────────────────────────

const PurchaseContext = createContext(null);

export function PurchaseProvider({ children }) {
  const { user, token } = useAuth();

  // The server's view of entitlement (subscription or trial). Authoritative when
  // we have it — a local flag can be wrong after a reinstall or device change.
  const [serverEnt, setServerEnt] = useState(null);

  const [trialStartDate,  setTrialStartDate]  = useState(null);
  const [isSubscribed,    setIsSubscribed]    = useState(false);
  const [isFreeUser,      setIsFreeUser]      = useState(false); // chose "continue free"
  const [devForceFree,    setDevForceFree]    = useState(false); // dev tools toggle
  const [isLoading,       setIsLoading]       = useState(true);

  // Internal testing tools are limited to known accounts (see TEST_ACCOUNTS).
  const isTester = useMemo(() => isTestAccount(user?.email), [user?.email]);

  // Load the dev override once on mount (device-wide, not per-user)
  useEffect(() => {
    AsyncStorage.getItem("dev_force_free_user").then(val => {
      if (val === "true") setDevForceFree(true);
    });
  }, []);

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

  // Identify this user to RevenueCat, then confirm entitlement with the SDK.
  // The app user ID must be the Tend user id so the admin panel, the webhook and
  // the app all refer to the same customer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) { await Store.logOut(); return; }
      const ready = await Store.configure(user.id);
      if (!ready || cancelled) return;
      const entitled = await Store.isEntitled();
      if (!cancelled && entitled) {
        setIsSubscribed(true);
        await AsyncStorage.setItem(`subscribed_${user.id}`, "true");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Ask the server whether bank sync is available for this account.
  const refreshEntitlement = useCallback(async () => {
    if (!token) { setServerEnt(null); return; }
    try {
      const r = await fetch(`${BACKEND_URL}/me/entitlement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        if (j?.ok) setServerEnt(j);
      }
    } catch { /* offline — fall back to local state */ }
  }, [token]);

  useEffect(() => { refreshEntitlement(); }, [refreshEntitlement]);

  // Days remaining in the trial (0 = expired)
  const localDaysRemaining = useMemo(() => {
    if (!trialStartDate) return TRIAL_DAYS;
    const elapsed = Math.floor(
      (Date.now() - new Date(trialStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, TRIAL_DAYS - elapsed);
  }, [trialStartDate]);

  // Only follow the server once it is actually enforcing entitlement. While
  // enforcement is off the server never blocks, so the app must not gate either —
  // otherwise an existing account whose server-side trial window has passed would
  // suddenly lose bank features that still work perfectly.
  const useServer = !!serverEnt && serverEnt.enforced === true;

  const daysRemaining = useServer && serverEnt.reason === "trial" && typeof serverEnt.daysRemaining === "number"
    ? serverEnt.daysRemaining
    : localDaysRemaining;

  const trialExpired = useServer
    ? serverEnt.reason === "trial_expired"
    : localDaysRemaining === 0;

  // When SUBSCRIPTIONS_ENABLED is false every user gets full access automatically.
  const isActive = !SUBSCRIPTIONS_ENABLED
    ? true
    : (!user?.id || isSubscribed || !trialExpired || isFreeUser);

  // Bank access: the server decides when it can tell us, since that's what the
  // bank routes actually enforce. Falls back to local state when offline.
  const localBankAccess = !user?.id || isSubscribed || !trialExpired;
  const hasBankAccess = BANK_ENABLED && !devForceFree
    ? (useServer ? !!serverEnt.entitled : localBankAccess)
    : false;

  // ── Purchase ────────────────────────────────────────────────────────────────
  // TODO: replace the body of this function with RevenueCat when going live.
  //
  //   import Purchases from "react-native-purchases";
  //   const { customerInfo } = await Purchases.purchaseProduct(productId);
  //   const active = customerInfo.entitlements.active["premium"] != null;
  //   if (active) { ... mark subscribed ... }

  const purchase = useCallback(async (planKey) => {
    const plan = PLANS[planKey];
    if (!plan) return { ok: false, error: "That plan isn't available." };

    console.log("[purchases] Purchase triggered:", plan.id);

    // ── Real purchase, through the store ──────────────────────────────────────
    if (Store.isAvailable()) {
      const offering = await Store.getOfferings();
      const pkgs = offering?.availablePackages || [];
      let pkg = pkgs.find((p) => p?.product?.identifier === plan.id);
      if (!pkg) {
        const wanted = planKey === "annual" ? "ANNUAL" : "MONTHLY";
        pkg = pkgs.find((p) => String(p?.packageType || "").toUpperCase() === wanted);
      }
      if (!pkg) return { ok: false, error: "That plan isn't available in the store yet." };

      const res = await Store.purchasePackage(pkg);
      if (res.ok && user?.id) {
        await AsyncStorage.setItem(`subscribed_${user.id}`, "true");
        setIsSubscribed(true);
        refreshEntitlement(); // let the server catch up via the webhook
      }
      return res;
    }

    // Test accounts can simulate a subscription so the paid experience can be
    // walked end-to-end before the stores are live. Never available to real users.
    if (isTester && user?.id) {
      await AsyncStorage.setItem(`subscribed_${user.id}`, "true");
      setIsSubscribed(true);
      return { ok: true, simulated: true };
    }

    return {
      ok:    false,
      error: Store.unavailableReason()
        || "Payments aren't available yet. Your free trial keeps everything unlocked in the meantime.",
    };
  }, [user?.id, isTester, refreshEntitlement]);

  // ── Dev: force free user mode ─────────────────────────────────────────────
  const toggleDevForceFree = useCallback(async (value) => {
    setDevForceFree(value);
    await AsyncStorage.setItem("dev_force_free_user", value ? "true" : "false");
  }, []);

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

    if (Store.isAvailable()) {
      const res = await Store.restore();
      if (res.ok && user?.id) {
        await AsyncStorage.setItem(`subscribed_${user.id}`, "true");
        setIsSubscribed(true);
        refreshEntitlement();
      }
      return res;
    }

    return {
      ok:    false,
      error: Store.unavailableReason()
        || "There's nothing to restore yet — no purchases exist until Tend is published.",
    };
  }, [user?.id, refreshEntitlement]);

  // ── Testing: flip your own account between paid and unpaid ─────────────────
  // Only works for accounts in TEST_ACCOUNTS. Once RevenueCat is wired up, the
  // admin panel's grant/revoke entitlement replaces this entirely.
  const setTestSubscription = useCallback(async (value) => {
    if (!user?.id || !isTester) return { ok: false, error: "Not a test account." };
    await AsyncStorage.setItem(`subscribed_${user.id}`, value ? "true" : "false");
    setIsSubscribed(value);
    return { ok: true };
  }, [user?.id, isTester]);

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
      devForceFree,
      toggleDevForceFree,
      isTester,
      setTestSubscription,
      refreshEntitlement,
      storeAvailable: Store.isAvailable(),
      storeUnavailableReason: Store.unavailableReason(),
      entitlementSource: serverEnt?.reason ?? null,
      PLANS,
      PRICING,
      TRIAL_DAYS,
    }),
    [isLoading, isSubscribed, isFreeUser, isActive, hasBankAccess, trialExpired, daysRemaining, purchase, restorePurchases, continueForFree, devForceFree, toggleDevForceFree, isTester, setTestSubscription, refreshEntitlement, serverEnt]
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
