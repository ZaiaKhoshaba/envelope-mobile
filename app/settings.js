// app/settings.js
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
} from "react-native";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

const DEV_UNLOCK_TAPS = 5;

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, colors }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[sec.title, { color: colors.textSecondary }]}>{title.toUpperCase()}</Text>
      <View style={[sec.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── Row types ─────────────────────────────────────────────────────────────────

function SettingRow({ label, subtitle, right, onPress, colors, last }) {
  const content = (
    <View style={[row.wrap, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[row.label, { color: colors.textPrimary }]}>{label}</Text>
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

function ChevronRow({ label, subtitle, value, onPress, colors, last }) {
  return (
    <SettingRow
      label={label}
      subtitle={subtitle}
      colors={colors}
      last={last}
      onPress={onPress}
      right={
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {value ? (
            <Text style={[row.value, { color: colors.textSecondary }]}>{value}</Text>
          ) : null}
          <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
        </View>
      }
    />
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Settings() {
  const router = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const { resetAll, simulateRandomSpend } = useBudget();
  const { logout, user, pinEnabled, disablePin } = useAuth();
  const { devForceFree, toggleDevForceFree } = usePurchase();
  const s = makeStyles(colors);


  // ── Developer mode (5-tap unlock on version row) ──
  const [devTapCount, setDevTapCount] = useState(0);
  const [devModeOn,   setDevModeOn]   = useState(false);

  const handleVersionTap = useCallback(() => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= DEV_UNLOCK_TAPS && !devModeOn) {
      setDevModeOn(true);
      setDevTapCount(0);
      Alert.alert("Developer mode enabled", "You now have access to testing tools.");
    } else if (!devModeOn && next >= 2) {
      const remaining = DEV_UNLOCK_TAPS - next;
      if (remaining > 0) Alert.alert("", `${remaining} more tap${remaining !== 1 ? "s" : ""} to enable developer mode.`);
    }
  }, [devTapCount, devModeOn]);

  const disableDevMode = () => {
    setDevModeOn(false);
    setDevTapCount(0);
    Alert.alert("Developer mode disabled");
  };

  const handleResetAll = () => {
    Alert.alert(
      "Reset all data",
      "This will permanently delete all envelopes, transactions, and settings. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset everything",
          style: "destructive",
          onPress: async () => {
            await resetAll();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Your data will be saved locally. You'll need to log in again to access it.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Appearance ── */}
        <Section title="Appearance" colors={colors}>
          <ToggleRow
            label="Dark mode"
            subtitle={isDark ? "Currently using dark theme" : "Currently using light theme"}
            value={isDark}
            onValueChange={toggle}
            colors={colors}
            last
          />
        </Section>

        {/* ── Support ── */}
        <Section title="Support" colors={colors}>
          <ChevronRow
            label="Contact us"
            subtitle="Send feedback or report an issue"
            onPress={() =>
              Linking.openURL(
                "mailto:tend.budget.app@outlook.com?subject=Tend%20App%20Feedback"
              )
            }
            colors={colors}
            last
          />
        </Section>

        {/* ── About ── */}
        <Section title="About" colors={colors}>
          <SettingRow
            label="Signed in as"
            subtitle={user?.email ?? "—"}
            colors={colors}
          />
          <ChevronRow
            label="How it works"
            subtitle="Replay the onboarding guide"
            onPress={() => router.push("/onboarding")}
            colors={colors}
          />
          <SettingRow
            label="Version"
            subtitle="Tap multiple times to unlock developer options"
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

        {/* ── Developer tools (hidden until 5-tap unlock) ── */}
        {devModeOn && (
          <Section title="Developer tools" colors={colors}>
            <SettingRow
              label="Mock spend"
              subtitle="Simulate a random transaction for testing"
              colors={colors}
              onPress={() => {
                const result = simulateRandomSpend?.();
                if (result?.ok) {
                  Alert.alert("Mock spend created", "Check the Transactions tab.");
                } else {
                  Alert.alert("No envelopes", "Add envelopes with funds before simulating a spend.");
                }
              }}
              right={<Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
            />
            <SettingRow
              label="Add test income"
              subtitle="Add mock income to unallocated balance"
              colors={colors}
              onPress={() => router.push("/add-income")}
              right={<Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
            />
            <ChevronRow
              label="Cycle manager"
              subtitle="Manually trigger end of budget cycle"
              onPress={() => router.push("/cycle")}
              colors={colors}
            />
            <ToggleRow
              label="Simulate free user"
              subtitle="Hides bank sync, shows Add Income + Add Spend"
              value={devForceFree}
              onValueChange={toggleDevForceFree}
              colors={colors}
            />
            <SettingRow
              label="Disable developer mode"
              colors={colors}
              last
              onPress={disableDevMode}
              right={<Text style={{ color: colors.danger, fontSize: 18 }}>›</Text>}
            />
          </Section>
        )}

        {/* ── Security ── */}
        <Section title="Security" colors={colors}>
          <ChevronRow
            label={pinEnabled ? "Change PIN" : "Set up PIN"}
            subtitle={
              pinEnabled
                ? "Update your 4-digit quick-access PIN"
                : "Lock the app with a 4-digit PIN after 5 minutes of inactivity"
            }
            onPress={() => router.push("/pin-setup")}
            colors={colors}
            last={!pinEnabled}
          />
          {pinEnabled && (
            <SettingRow
              label="Remove PIN"
              subtitle="Disable PIN lock entirely"
              colors={colors}
              last
              onPress={() => {
                Alert.alert(
                  "Remove PIN",
                  "PIN lock will be disabled. You can set it up again at any time.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove PIN",
                      style: "destructive",
                      onPress: () => disablePin(),
                    },
                  ]
                );
              }}
              right={<Text style={{ color: colors.danger, fontSize: 18 }}>›</Text>}
            />
          )}
        </Section>

        {/* ── Account ── */}
        <Section title="Account" colors={colors}>
          <SettingRow
            label="Log out"
            colors={colors}
            onPress={handleLogout}
            right={<Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
          />
          <SettingRow
            label="Reset all data"
            subtitle="Permanently deletes all envelopes and transactions"
            colors={colors}
            last
            onPress={handleResetAll}
            right={<Text style={{ color: colors.danger, fontSize: 18 }}>›</Text>}
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

const act = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
});