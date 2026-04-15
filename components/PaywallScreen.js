// components/PaywallScreen.js
//
// Full-screen paywall shown when the free trial has expired.
// Rendered directly by _layout.js — not a route.

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
} from "react-native";
import { useTheme, spacing, radius, typography } from "../theme";
import { usePurchase, PLANS } from "../context/PurchaseContext";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "expo-router";

const FREE_FEATURES = [
  "Unlimited Fixed & Flexible envelopes",
  "Manual income & spend tracking",
  "Budget cycle management",
];

const PAID_FEATURES = [
  "Everything in free, plus:",
  "Real-time bank account sync",
  "Spend notifications & one-tap allocation",
  "Automatic income allocation across envelopes",
];

export default function PaywallScreen() {
  const { colors, isDark } = useTheme();
  const { purchase, restorePurchases, continueForFree } = usePurchase();
  const { logout } = useAuth();
  const router = useRouter();

  const [selectedPlan, setSelectedPlan] = useState("annual"); // annual pre-selected
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const result = await purchase(selectedPlan);
    setLoading(false);

    if (!result.ok) {
      Alert.alert("Not available yet", result.error, [{ text: "OK" }]);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const result = await restorePurchases();
    setLoading(false);

    if (!result.ok) {
      Alert.alert("Not available yet", result.error, [{ text: "OK" }]);
    } else {
      Alert.alert("Restored", "Your subscription has been restored.");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "You can log back in at any time — your data will still be here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[pw.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={pw.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Icon ── */}
        <View style={[pw.iconWrap, { backgroundColor: colors.accentSoft }]}>
          <Text style={pw.icon}>✉️</Text>
        </View>

        {/* ── Headline ── */}
        <Text style={[pw.title, { color: colors.textPrimary }]}>
          Continue with Envelopes
        </Text>
        <Text style={[pw.subtitle, { color: colors.textSecondary }]}>
          Your free trial has ended. Subscribe to keep budgeting.
        </Text>

        {/* ── Feature comparison ── */}
        <View style={pw.compareRow}>
          {/* Free column */}
          <View style={[pw.compareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[pw.compareHeading, { color: colors.textSecondary }]}>FREE</Text>
            {FREE_FEATURES.map((f, i) => (
              <View key={i} style={pw.featureRow}>
                <Text style={[pw.checkMark, { color: colors.success }]}>✓</Text>
                <Text style={[pw.featureText, { color: colors.textPrimary }]}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Paid column */}
          <View style={[pw.compareCard, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[pw.compareHeading, { color: colors.accent }]}>PREMIUM</Text>
            {PAID_FEATURES.map((f, i) => (
              <View key={i} style={pw.featureRow}>
                <Text style={[pw.checkMark, { color: colors.accent }]}>✓</Text>
                <Text style={[pw.featureText, { color: colors.textPrimary }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Plan selector ── */}
        <Text style={[pw.planHeading, { color: colors.textSecondary }]}>
          CHOOSE A PLAN
        </Text>
        <View style={pw.planRow}>
          {Object.entries(PLANS).map(([key, plan]) => {
            const selected = selectedPlan === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  pw.planCard,
                  {
                    backgroundColor: selected ? colors.accent : colors.card,
                    borderColor:     selected ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setSelectedPlan(key)}
                activeOpacity={0.8}
              >
                {plan.savingTag && (
                  <View style={[pw.savingBadge, { backgroundColor: selected ? "rgba(255,255,255,0.25)" : colors.accentSoft }]}>
                    <Text style={[pw.savingText, { color: selected ? "#fff" : colors.accent }]}>
                      {plan.savingTag}
                    </Text>
                  </View>
                )}
                <Text style={[pw.planLabel, { color: selected ? "#fff" : colors.textSecondary }]}>
                  {plan.label}
                </Text>
                <Text style={[pw.planPrice, { color: selected ? "#fff" : colors.textPrimary }]}>
                  {plan.price}
                </Text>
                <Text style={[pw.planPeriod, { color: selected ? "rgba(255,255,255,0.75)" : colors.textSecondary }]}>
                  {plan.period}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Subscribe button ── */}
        <TouchableOpacity
          style={[pw.cta, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
          onPress={handleSubscribe}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={pw.ctaText}>
            {loading ? "Processing…" : `Subscribe ${PLANS[selectedPlan].price} ${PLANS[selectedPlan].period}`}
          </Text>
        </TouchableOpacity>

        {/* ── Restore ── */}
        <TouchableOpacity onPress={handleRestore} activeOpacity={0.7} style={pw.restoreBtn}>
          <Text style={[pw.restoreText, { color: colors.textSecondary }]}>
            Restore previous purchase
          </Text>
        </TouchableOpacity>

        {/* ── Continue for free ── */}
        <TouchableOpacity
          onPress={continueForFree}
          activeOpacity={0.7}
          style={[pw.freeBtn, { borderColor: colors.border }]}
        >
          <Text style={[pw.freeBtnText, { color: colors.textSecondary }]}>
            Continue for free
          </Text>
          <Text style={[pw.freeBtnSub, { color: colors.textMuted }]}>
            Manual budgeting only · no bank sync
          </Text>
        </TouchableOpacity>

        {/* ── Log out ── */}
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={pw.logoutBtn}>
          <Text style={[pw.logoutText, { color: colors.textMuted }]}>
            Log out
          </Text>
        </TouchableOpacity>

        {/* ── Legal ── */}
        <Text style={[pw.legal, { color: colors.textMuted }]}>
          Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store / Google Play account settings.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const pw = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    alignItems: "center",
    padding: spacing.xl,
    paddingBottom: 48,
  },

  // Icon
  iconWrap: {
    width:         80,
    height:        80,
    borderRadius:  radius.xl,
    alignItems:    "center",
    justifyContent:"center",
    marginBottom:  spacing.xl,
    marginTop:     spacing.lg,
  },
  icon: {
    fontSize: 38,
  },

  // Headline
  title: {
    fontSize:     typography.xxl,
    fontWeight:   typography.heavy,
    textAlign:    "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize:     typography.md,
    textAlign:    "center",
    lineHeight:   22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  // Feature comparison
  compareRow: {
    flexDirection: "row",
    gap:           spacing.md,
    width:         "100%",
    marginBottom:  spacing.xl,
  },
  compareCard: {
    flex:         1,
    borderRadius: radius.lg,
    borderWidth:  1,
    padding:      spacing.md,
    gap:          spacing.sm,
  },
  compareHeading: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    letterSpacing: 0.8,
    marginBottom:  spacing.xs,
  },
  featureRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           spacing.xs,
  },
  checkMark: {
    fontSize:   13,
    fontWeight: typography.bold,
    marginTop:  1,
  },
  featureText: {
    fontSize:   typography.xs,
    flex:       1,
    lineHeight: 18,
  },

  // Plan heading
  planHeading: {
    fontSize:     typography.xs,
    fontWeight:   typography.semibold,
    letterSpacing: 0.8,
    alignSelf:    "flex-start",
    marginBottom: spacing.sm,
  },

  // Plan cards
  planRow: {
    flexDirection: "row",
    gap:           spacing.md,
    width:         "100%",
    marginBottom:  spacing.xl,
  },
  planCard: {
    flex:          1,
    borderRadius:  radius.lg,
    borderWidth:   2,
    padding:       spacing.lg,
    alignItems:    "center",
    gap:           spacing.xs,
  },
  savingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderRadius:      radius.pill,
    marginBottom:      spacing.xs,
  },
  savingText: {
    fontSize:   typography.xs,
    fontWeight: typography.bold,
  },
  planLabel: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planPrice: {
    fontSize:   typography.xxl,
    fontWeight: typography.heavy,
  },
  planPeriod: {
    fontSize: typography.xs,
  },

  // CTA
  cta: {
    width:           "100%",
    paddingVertical: 16,
    borderRadius:    radius.lg,
    alignItems:      "center",
    marginBottom:    spacing.lg,
  },
  ctaText: {
    color:      "#FFFFFF",
    fontSize:   typography.md,
    fontWeight: typography.bold,
  },

  // Restore
  restoreBtn: {
    paddingVertical: spacing.sm,
    marginBottom:    spacing.sm,
  },
  restoreText: {
    fontSize:  typography.sm,
    textDecorationLine: "underline",
  },

  // Continue for free
  freeBtn: {
    width:           "100%",
    paddingVertical: 14,
    borderRadius:    radius.lg,
    borderWidth:     1,
    alignItems:      "center",
    marginBottom:    spacing.sm,
    gap:             2,
  },
  freeBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
  freeBtnSub: {
    fontSize: typography.xs,
  },

  // Logout
  logoutBtn: {
    paddingVertical: spacing.sm,
    marginBottom:    spacing.xl,
  },
  logoutText: {
    fontSize: typography.sm,
  },

  // Legal
  legal: {
    fontSize:   typography.xs,
    textAlign:  "center",
    lineHeight: 17,
    paddingHorizontal: spacing.md,
  },
});
