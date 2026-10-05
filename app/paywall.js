// app/paywall.js
// The subscribe screen. Shows live store prices when the RevenueCat SDK is
// available, and falls back to the prices in PRICING so the screen is never
// blank. Restore and the legal links are required by both app stores.

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePurchase, PLANS } from "../context/PurchaseContext";
import * as Store from "../lib/purchases";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { PRIVACY_URL, TERMS_URL } from "../lib/legal";


const BENEFITS = [
  { icon: "sync",              text: "Your bank balance, brought into Tend" },
  { icon: "receipt-outline",   text: "Transactions import automatically — no typing" },
  { icon: "flash-outline",     text: "One tap to draw a spend from the right envelope" },
  { icon: "notifications-outline", text: "A notification when new transactions arrive" },
];

export default function Paywall() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    purchase, restorePurchases, isSubscribed,
    trialExpired, daysRemaining, storeAvailable, storeUnavailableReason, isTester,
  } = usePurchase();
  const s = makeStyles(colors);

  const [offering, setOffering] = useState(null);
  const [selected, setSelected] = useState("annual");
  const [busy, setBusy]         = useState(false);
  // Why the store isn't serving prices. Shown to test accounts only — without it
  // an empty paywall is indistinguishable from a missing key, a missing native
  // module, or products Google hasn't finished propagating.
  const [diag, setDiag] = useState(null);

  // Live store prices when we can get them
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cur = await Store.getOfferings();
      if (cancelled) return;
      setOffering(cur);
      setDiag({
        sdk: Store.isAvailable() ? "available" : "UNAVAILABLE",
        reason: Store.unavailableReason() || "-",
        packages: cur?.availablePackages?.length ?? 0,
        offering: cur?.identifier || "none",
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const priceFor = useCallback((planKey) => {
    const pkgs = offering?.availablePackages || [];
    const wanted = planKey === "annual" ? "ANNUAL" : "MONTHLY";
    const pkg =
      pkgs.find((p) => p?.product?.identifier === PLANS[planKey].id) ||
      pkgs.find((p) => String(p?.packageType || "").toUpperCase() === wanted);
    return pkg?.product?.priceString || PLANS[planKey].price;
  }, [offering]);

  // How much the annual plan saves, worked out from the prices the store is
  // actually charging rather than from the fallback figures in PRICING.
  //
  // The badge used to read straight off PRICING, so the moment a price changed
  // in Play or App Store Connect and nobody remembered to edit the app, it went
  // on cheerfully advertising the old discount next to the new prices. Deriving
  // it from the same packages that render the prices means the two can never
  // disagree. When the store hasn't answered, PLANS supplies the fallback.
  const savingTag = useCallback((planKey) => {
    if (planKey !== "annual") return PLANS[planKey].savingTag;

    const pkgs = offering?.availablePackages || [];
    const amountOf = (wanted, id) => {
      const pkg =
        pkgs.find((p) => p?.product?.identifier === id) ||
        pkgs.find((p) => String(p?.packageType || "").toUpperCase() === wanted);
      const n = Number(pkg?.product?.price);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const monthly = amountOf("MONTHLY", PLANS.monthly.id);
    const annual  = amountOf("ANNUAL",  PLANS.annual.id);
    if (monthly == null || annual == null) return PLANS.annual.savingTag;

    const pct = Math.round((1 - annual / (monthly * 12)) * 100);
    return pct > 0 ? `Save ${pct}%` : null;
  }, [offering]);

  const onSubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const res = await purchase(selected);
      if (res?.ok) {
        Alert.alert(
          res.simulated ? "Premium enabled (test)" : "You're all set",
          res.simulated
            ? "Simulated subscription active on this test account."
            : "Thanks for subscribing — bank sync is on."
        );
        router.back();
      } else if (!res?.cancelled) {
        Alert.alert("Not available yet", res?.error || "Something went wrong. Please try again.");
      }
    } finally { setBusy(false); }
  }, [purchase, selected, router]);

  const onRestore = useCallback(async () => {
    setBusy(true);
    try {
      const res = await restorePurchases();
      if (res?.ok) { Alert.alert("Purchases restored", "Your subscription is active again."); router.back(); }
      else Alert.alert("Nothing to restore", res?.error || "No previous purchases were found.");
    } finally { setBusy(false); }
  }, [restorePurchases, router]);

  const statusLine =
    isSubscribed ? "You're on Premium."
    : trialExpired ? "Your free trial has ended."
    : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left in your free trial.`;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.md }}>
          <View style={[w.badge, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="link" size={28} color={colors.accent} />
          </View>
          <Text style={[w.title, { color: colors.textPrimary }]}>Connect your bank</Text>
          <Text style={[w.sub, { color: colors.textSecondary }]}>
            Tend Premium keeps your envelopes accurate automatically.
          </Text>
          <Text style={[w.status, { color: colors.accent }]}>{statusLine}</Text>
        </View>

        {/* ── What you get ── */}
        <View style={[w.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {BENEFITS.map((b, i) => (
            <View
              key={b.text}
              style={[w.benefit, i < BENEFITS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            >
              <Ionicons name={b.icon} size={19} color={colors.accent} />
              <Text style={[w.benefitText, { color: colors.textPrimary }]}>{b.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Plans ── */}
        <View style={{ gap: spacing.sm }}>
          {["annual", "monthly"].map((key) => {
            const isSel = selected === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelected(key)}
                activeOpacity={0.85}
                style={[
                  w.plan,
                  { backgroundColor: colors.card, borderColor: isSel ? colors.accent : colors.border },
                  isSel && { borderWidth: 2 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={[w.planLabel, { color: colors.textPrimary }]}>{PLANS[key].label}</Text>
                    {savingTag(key) && (
                      <View style={[w.tag, { backgroundColor: colors.accentSoft }]}>
                        <Text style={[w.tagText, { color: colors.accent }]}>{savingTag(key)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[w.planPrice, { color: colors.textSecondary }]}>
                    {priceFor(key)} {PLANS[key].period}
                  </Text>
                </View>
                <Ionicons
                  name={isSel ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={isSel ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Actions ── */}
        <View style={{ gap: spacing.sm }}>
          <TouchableOpacity
            style={[w.cta, { backgroundColor: colors.accent }, busy && { opacity: 0.7 }]}
            onPress={onSubscribe}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={w.ctaText}>Subscribe — {priceFor(selected)}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onRestore} disabled={busy} style={w.link} activeOpacity={0.7}>
            <Text style={[w.linkText, { color: colors.textSecondary }]}>Restore purchases</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={w.link} activeOpacity={0.7}>
            <Text style={[w.linkText, { color: colors.textMuted }]}>Not now</Text>
          </TouchableOpacity>
        </View>

        {/* ── Small print (store requirement) ── */}
        <View style={{ gap: spacing.xs, alignItems: "center" }}>
          {isTester && diag && (
            <Text style={[w.fine, { color: colors.warning, textAlign: "center" }]}>
              {`store: ${diag.sdk} · offering: ${diag.offering} · packages: ${diag.packages}`}
              {diag.reason !== "-" ? `\n${diag.reason}` : ""}
            </Text>
          )}
          {!storeAvailable && (
            <Text style={[w.fine, { color: colors.textMuted }]}>
              Payments become available once Tend is published to the App Store and Google Play.
            </Text>
          )}
          <Text style={[w.fine, { color: colors.textMuted }]}>
            Subscriptions renew automatically until cancelled. Manage or cancel any time in your
            App Store or Google Play account settings.
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
              <Text style={[w.fine, { color: colors.accent }]}>Terms of service</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
              <Text style={[w.fine, { color: colors.accent }]}>Privacy policy</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const w = StyleSheet.create({
  badge: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  title: { fontSize: typography.xl, fontWeight: typography.heavy, textAlign: "center" },
  sub:   { fontSize: typography.md, textAlign: "center", lineHeight: 21 },
  status:{ fontSize: typography.sm, fontWeight: typography.semibold, marginTop: 2 },
  card:  { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  benefit: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  benefitText: { fontSize: typography.sm, flex: 1, lineHeight: 20 },
  plan: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  planLabel: { fontSize: typography.md, fontWeight: typography.semibold },
  planPrice: { fontSize: typography.sm, marginTop: 2 },
  tag:     { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagText: { fontSize: typography.xs, fontWeight: typography.bold },
  cta: {
    borderRadius: radius.lg, paddingVertical: spacing.md,
    alignItems: "center", justifyContent: "center", minHeight: 52,
  },
  ctaText: { color: "#fff", fontSize: typography.md, fontWeight: typography.bold },
  link:     { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { fontSize: typography.sm, fontWeight: typography.medium },
  fine:     { fontSize: typography.xs, textAlign: "center", lineHeight: 17 },
});
