// app/profile.js
// Who you are and what you're on — opened from the avatar on the Home header.
// Identity lives here, not in Settings.

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { usePurchase } from "../context/PurchaseContext";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

function initialsOf(user) {
  const source = user?.firstName || user?.name || user?.email || "?";
  const parts = String(source).trim().split(/[\s@._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? parts[1][0] : "";
  return (first + second).toUpperCase();
}

function DetailRow({ label, value, colors, last }) {
  return (
    <View style={[d.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[d.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[d.value, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const { isSubscribed, isFreeUser, trialExpired, daysRemaining } = usePurchase();
  const { bankAccountCount, bankBalance } = useBudget();
  const s = makeStyles(colors);

  const planLabel =
    isSubscribed ? "Premium"
    : trialExpired && isFreeUser ? "Free"
    : trialExpired ? "Trial expired"
    : `Free trial — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`;

  const bankLabel =
    bankBalance == null
      ? "No bank connected"
      : `${bankAccountCount || 1} account${(bankAccountCount || 1) !== 1 ? "s" : ""} linked`;

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Log out",
      "Your data stays saved. You'll need to log in again to access it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => { await logout(); router.replace("/login"); },
        },
      ]
    );
  }, [logout, router]);

  const displayName = user?.firstName || user?.name || "Your account";

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Identity ── */}
        <View style={{ alignItems: "center", gap: spacing.sm, paddingTop: spacing.md }}>
          <View style={[p.avatar, { backgroundColor: colors.accent }]}>
            <Text style={p.avatarText}>{initialsOf(user)}</Text>
          </View>
          <Text style={[p.name, { color: colors.textPrimary }]}>{displayName}</Text>
          <Text style={[p.email, { color: colors.textSecondary }]}>{user?.email ?? "—"}</Text>
        </View>

        {/* ── At a glance ── */}
        <View style={[p.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DetailRow label="Plan"          value={planLabel} colors={colors} />
          <DetailRow label="Bank"          value={bankLabel} colors={colors} />
          <DetailRow label="Signed in as"  value={user?.email ?? "—"} colors={colors} last />
        </View>

        {/* ── Actions ── */}
        <View style={{ gap: spacing.sm }}>
          <TouchableOpacity
            style={[p.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
            <Text style={[p.btnText, { color: colors.textPrimary }]}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[p.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={[p.btnText, { color: colors.danger }]}>Log out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const p = StyleSheet.create({
  avatar: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name:  { fontSize: typography.xl, fontWeight: typography.heavy },
  email: { fontSize: typography.sm },
  card:  { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
  },
  btnText: { fontSize: typography.md, fontWeight: typography.semibold },
});

const d = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
    minHeight: 52,
  },
  label: { fontSize: typography.sm },
  value: { fontSize: typography.md, fontWeight: typography.medium, flexShrink: 1, textAlign: "right" },
});
