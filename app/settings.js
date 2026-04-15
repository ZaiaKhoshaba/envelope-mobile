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
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";
import { usePurchase, TRIAL_DAYS } from "../context/PurchaseContext";
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
  const { state, resetAll, setIncomeSchedule, simulateRandomSpend } = useBudget();
  const { logout, user } = useAuth();
  const { isSubscribed, daysRemaining, purchase } = usePurchase();
  const s = makeStyles(colors);

  const cycle    = state?.cycle ?? "monthly";
  const schedule = state?.incomeSchedule ?? {};

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

  const cycleOptions     = ["weekly", "fortnightly", "monthly"];
  const frequencyOptions = ["weekly", "fortnightly", "monthly"];

  const handleCycleChange = () => {
    Alert.alert(
      "Budget cycle",
      "How often do you want to reset your budget?",
      cycleOptions.map(opt => ({
        text: opt.charAt(0).toUpperCase() + opt.slice(1),
        onPress: () => {},
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
  };

  const handleFrequencyChange = () => {
    Alert.alert(
      "Pay frequency",
      "How often do you get paid?",
      frequencyOptions.map(opt => ({
        text: opt.charAt(0).toUpperCase() + opt.slice(1),
        onPress: () => setIncomeSchedule({ frequency: opt }),
      })).concat([{ text: "Cancel", style: "cancel" }])
    );
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
          onPress: () => {
            logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const freqLabel = schedule.frequency
    ? schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)
    : "Not set";

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

        {/* ── Subscription ── */}
        <Section title="Subscription" colors={colors}>
          {isSubscribed ? (
            <SettingRow
              label="Status"
              colors={colors}
              last
              right={
                <View style={[act.pill, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                  <Text style={[act.pillText, { color: colors.success }]}>Active</Text>
                </View>
              }
            />
          ) : (
            <>
              <SettingRow
                label="Free trial"
                subtitle={
                  daysRemaining > 0
                    ? `${daysRemaining} of ${TRIAL_DAYS} days remaining`
                    : "Your trial has ended"
                }
                colors={colors}
                right={
                  <View style={[
                    act.pill,
                    {
                      backgroundColor: daysRemaining > 7 ? colors.accentSoft  : colors.warningBg,
                      borderColor:     daysRemaining > 7 ? colors.accent       : colors.warning,
                    },
                  ]}>
                    <Text style={[
                      act.pillText,
                      { color: daysRemaining > 7 ? colors.accent : colors.warning },
                    ]}>
                      {daysRemaining > 0 ? `${daysRemaining}d left` : "Expired"}
                    </Text>
                  </View>
                }
              />
              <SettingRow
                label="Subscribe"
                subtitle="$4.99/month or $29.99/year — unlock the full app"
                colors={colors}
                last
                onPress={async () => {
                  const result = await purchase("annual");
                  if (!result.ok) Alert.alert("Not available yet", result.error);
                }}
                right={<Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
              />
            </>
          )}
        </Section>

        {/* ── Budget cycle ── */}
        <Section title="Budget cycle" colors={colors}>
          <ChevronRow
            label="Cycle frequency"
            subtitle="How often your budget period resets"
            value={cycle ? cycle.charAt(0).toUpperCase() + cycle.slice(1) : "Monthly"}
            onPress={handleCycleChange}
            colors={colors}
          />
          <SettingRow
            label="End cycle now"
            subtitle="Resets non-rollover envelopes to zero"
            colors={colors}
            last
            onPress={() => {
              Alert.alert(
                "End cycle",
                "Non-rollover envelopes will be zeroed and funds returned to unallocated. Continue?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "End cycle",
                    onPress: () => router.push("/cycle"),
                  },
                ]
              );
            }}
            right={
              <View style={[act.pill, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
                <Text style={[act.pillText, { color: colors.warning }]}>Run now</Text>
              </View>
            }
          />
        </Section>

        {/* ── Income schedule ── */}
        <Section title="Income schedule" colors={colors}>
          <ChevronRow
            label="Pay frequency"
            subtitle="Used for automatic envelope allocation"
            value={freqLabel}
            onPress={handleFrequencyChange}
            colors={colors}
          />
          <ChevronRow
            label="Income schedule"
            subtitle="Set your pay dates and amounts"
            onPress={() => router.push("/income-schedule")}
            colors={colors}
            last
          />
        </Section>

        {/* ── Bank connection ── */}
        <Section title="Bank connection" colors={colors}>
          <SettingRow
            label="Connected bank"
            subtitle="Fiskl demo account"
            colors={colors}
            right={
              <View style={[act.pill, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                <Text style={[act.pillText, { color: colors.success }]}>Connected</Text>
              </View>
            }
          />
          <ChevronRow
            label="Manage connection"
            subtitle="Reconnect or change your bank"
            onPress={() => router.push("/bank-connect")}
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
            <SettingRow
              label="Disable developer mode"
              colors={colors}
              last
              onPress={disableDevMode}
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