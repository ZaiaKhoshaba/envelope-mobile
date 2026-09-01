// app/settings.js
// Settings is for things you change. Who you are lives on the Profile screen
// (the avatar on Home); testing tools are limited to accounts in TEST_ACCOUNTS.

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";
import { usePurchase, PLANS } from "../context/PurchaseContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

const DEV_UNLOCK_TAPS = 5;

// Public pages — update these if the URLs change.
const PRIVACY_URL = "https://zaiakhoshaba.github.io/tend-privacy-policy/";
const SUPPORT_EMAIL = "tend.budget.app@outlook.com";

function timeAgo(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, colors }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      {title ? (
        <Text style={[sec.title, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
      ) : null}
      <View style={[sec.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── Row types ─────────────────────────────────────────────────────────────────

function SettingRow({ label, subtitle, right, onPress, colors, last, danger }) {
  const content = (
    <View style={[row.wrap, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[row.label, { color: danger ? colors.danger : colors.textPrimary }]}>{label}</Text>
        {subtitle ? (
          <Text style={[row.subtitle, { color: colors.textSecondary }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

function ToggleRow({ label, subtitle, value, onValueChange, colors, last }) {
  return (
    <SettingRow
      label={label}
      subtitle={subtitle}
      colors={colors}
      last={last}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
      }
    />
  );
}

function ChevronRow({ label, subtitle, value, onPress, colors, last, danger }) {
  return (
    <SettingRow
      label={label}
      subtitle={subtitle}
      colors={colors}
      last={last}
      onPress={onPress}
      danger={danger}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {value ? (
            <Text style={[row.value, { color: colors.textSecondary }]}>{value}</Text>
          ) : null}
          <Text style={{ color: danger ? colors.danger : colors.textMuted, fontSize: 18 }}>›</Text>
        </View>
      }
    />
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Settings() {
  const router = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const { resetAll, bankBalance, bankAccountCount, lastBalanceSync } = useBudget();
  const { logout, deleteAccount, pinEnabled, disablePin } = useAuth();
  const {
    isSubscribed, isFreeUser, trialExpired, daysRemaining,
    restorePurchases, isTester, setTestSubscription,
    devForceFree, toggleDevForceFree,
  } = usePurchase();
  const s = makeStyles(colors);

  // ── Developer mode (test accounts only, 5-tap unlock) ──
  const [devTapCount, setDevTapCount] = useState(0);
  const [devModeOn,   setDevModeOn]   = useState(false);

  const handleVersionTap = useCallback(() => {
    if (!isTester) return; // real customers just tap a version row
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= DEV_UNLOCK_TAPS && !devModeOn) {
      setDevModeOn(true);
      setDevTapCount(0);
      Alert.alert("Developer mode enabled", "You now have access to testing tools.");
    }
  }, [devTapCount, devModeOn, isTester]);

  // ── Plan ──
  const planStatus =
    isSubscribed ? "Premium — active"
    : trialExpired && isFreeUser ? "Free — bank sync is off"
    : trialExpired ? "Trial expired"
    : `Free trial — ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`;

  const planSubtitle = isSubscribed
    ? "Bank sync, spend alerts and one-tap allocation are on."
    : trialExpired
      ? `Subscribe to turn bank sync back on — ${PLANS.monthly.price}/mo or ${PLANS.annual.price}/yr.`
      : "Everything is unlocked during your trial, including bank sync.";

  const openPlans = useCallback(() => {
    if (isSubscribed) {
      Alert.alert(
        "Premium",
        "Your subscription is active.\n\nTo change or cancel it, use your App Store or Google Play subscription settings."
      );
      return;
    }
    router.push("/paywall");
  }, [isSubscribed, router]);

  const handleRestore = useCallback(async () => {
    const res = await restorePurchases();
    if (res?.ok) Alert.alert("Purchases restored", "Your subscription is active again.");
    else         Alert.alert("Nothing to restore", res?.error || "No previous purchases were found.");
  }, [restorePurchases]);

  // ── Bank ──
  const bankSubtitle =
    bankBalance == null
      ? "Not connected — link a bank to import transactions automatically"
      : `${bankAccountCount || 1} account${(bankAccountCount || 1) !== 1 ? "s" : ""} linked${timeAgo(lastBalanceSync) ? ` · synced ${timeAgo(lastBalanceSync)}` : ""}`;

  // ── Danger zone ──
  const handleResetAll = useCallback(() => {
    Alert.alert(
      "Reset all data",
      "This permanently deletes your envelopes, transactions and settings, and disconnects any linked bank. Your account stays open. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset everything",
          style: "destructive",
          onPress: async () => { await resetAll(); router.replace("/login"); },
        },
      ]
    );
  }, [resetAll, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and everything we hold for you, and withdraws any bank data sharing. It can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "There's no way to recover your account or budget after this.",
              [
                { text: "Keep my account", style: "cancel" },
                {
                  text: "Delete permanently",
                  style: "destructive",
                  onPress: async () => {
                    const res = await deleteAccount();
                    if (res?.ok) {
                      Alert.alert("Account deleted", "Your account and data have been removed.");
                      router.replace("/login");
                    } else {
                      Alert.alert("Couldn't delete account", res?.error || "Please try again.");
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount, router]);

  const handleLogout = useCallback(() => {
    Alert.alert("Log out", "Your data stays saved. You'll need to log in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  }, [logout, router]);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Plan ── */}
        <Section title="Plan" colors={colors}>
          <ChevronRow
            label={planStatus}
            subtitle={planSubtitle}
            onPress={openPlans}
            colors={colors}
          />
          <ChevronRow
            label="Restore purchases"
            subtitle="Already subscribed on another device?"
            onPress={handleRestore}
            colors={colors}
            last
          />
        </Section>

        {/* ── Bank ── */}
        <Section title="Bank" colors={colors}>
          <ChevronRow
            label="Bank accounts"
            subtitle={bankSubtitle}
            onPress={() => router.push("/bank-connect")}
            colors={colors}
            last
          />
        </Section>

        {/* ── Privacy & security ── */}
        <Section title="Privacy & security" colors={colors}>
          <ChevronRow
            label={pinEnabled ? "Change PIN" : "Set up PIN"}
            subtitle={pinEnabled
              ? "Locks the app after 5 minutes of inactivity"
              : "Lock the app with a 4-digit PIN"}
            onPress={() => router.push("/pin-setup")}
            colors={colors}
          />
          {pinEnabled && (
            <SettingRow
              label="Remove PIN"
              subtitle="Turn off PIN lock"
              colors={colors}
              onPress={() => {
                Alert.alert("Remove PIN", "PIN lock will be turned off. You can set it up again any time.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove PIN", style: "destructive", onPress: () => disablePin() },
                ]);
              }}
              right={<Text style={{ color: colors.danger, fontSize: 18 }}>›</Text>}
            />
          )}
          <ChevronRow
            label="Data & consent"
            subtitle="See what you're sharing, and withdraw it any time"
            onPress={() => router.push("/data-consent")}
            colors={colors}
            last
          />
        </Section>

        {/* ── Help ── */}
        <Section title="Help" colors={colors}>
          <ChevronRow
            label="How Tend works"
            subtitle="Replay the guide"
            onPress={() => router.push("/onboarding")}
            colors={colors}
          />
          <ChevronRow
            label="Contact support"
            subtitle="Send feedback or report a problem"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Tend%20App%20Feedback`)}
            colors={colors}
          />
          <ChevronRow
            label="Privacy policy"
            subtitle="How your data is handled"
            onPress={() => Linking.openURL(PRIVACY_URL)}
            colors={colors}
            last
          />
        </Section>

        {/* ── Appearance + version (no heading — housekeeping) ── */}
        <Section colors={colors}>
          <ToggleRow
            label="Dark mode"
            value={isDark}
            onValueChange={toggle}
            colors={colors}
          />
          <SettingRow
            label="Version"
            colors={colors}
            last
            onPress={handleVersionTap}
            right={
              <Text style={[row.value, { color: colors.textMuted }]}>
                1.0.0{devModeOn ? " 🛠" : ""}
              </Text>
            }
          />
        </Section>

        {/* ── Developer tools (test accounts only) ── */}
        {devModeOn && isTester && (
          <Section title="Developer tools" colors={colors}>
            <ToggleRow
              label="Simulate Premium subscriber"
              subtitle="Flip this account between paid and unpaid"
              value={isSubscribed}
              onValueChange={(v) => setTestSubscription(v)}
              colors={colors}
            />
            <ToggleRow
              label="Simulate free user"
              subtitle="Hides bank sync to preview the free experience"
              value={devForceFree}
              onValueChange={toggleDevForceFree}
              colors={colors}
            />
            <ChevronRow
              label="Cycle manager"
              subtitle="Manually trigger end of budget cycle"
              onPress={() => router.push("/cycle")}
              colors={colors}
            />
            <SettingRow
              label="Turn off developer mode"
              colors={colors}
              last
              onPress={() => { setDevModeOn(false); setDevTapCount(0); }}
              right={<Text style={{ color: colors.danger, fontSize: 18 }}>›</Text>}
            />
          </Section>
        )}

        {/* ── Account ── */}
        <Section title="Account" colors={colors}>
          <SettingRow
            label="Log out"
            colors={colors}
            onPress={handleLogout}
            right={<Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
          />
          <ChevronRow
            label="Reset all data"
            subtitle="Clears your budget but keeps your account"
            onPress={handleResetAll}
            colors={colors}
            danger
          />
          <ChevronRow
            label="Delete account"
            subtitle="Permanently removes your account and all your data"
            onPress={handleDeleteAccount}
            colors={colors}
            danger
            last
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sec = StyleSheet.create({
  title: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 56,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  subtitle: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  value: {
    fontSize: typography.sm,
  },
});
