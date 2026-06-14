// app/cycle.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";

const CYCLE_OPTIONS = [
  {
    key: "weekly",
    label: "Weekly",
    desc: "Reset every 7 days — great for tight budget control",
    icon: "📅",
  },
  {
    key: "fortnightly",
    label: "Fortnightly",
    desc: "Reset every 14 days — suits fortnightly pay cycles",
    icon: "🗓",
  },
  {
    key: "monthly",
    label: "Monthly",
    desc: "Reset once a month — a steadier overview of spending",
    icon: "📆",
  },
];

export default function CycleScreen() {
  const router  = useRouter();
  const { colors } = useTheme();
  const { state, dispatch } = useBudget();
  const s = makeStyles(colors);

  const currentCycle = state?.cycle ?? "monthly";
  const [selected, setSelected] = useState(currentCycle);

  const envelopes = state?.envelopes ?? [];
  const willReset   = envelopes.filter(e => !e.rollover);
  const willRollover = envelopes.filter(e => e.rollover);

  const totalResetting = willReset.reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const handleSaveCycle = () => {
    dispatch({ type: "LOAD_STATE", payload: { ...state, cycle: selected } });
    Alert.alert("Saved", `Budget cycle set to ${selected}.`);
  };

  const handleEndCycle = () => {
    if (willReset.length === 0) {
      Alert.alert(
        "Nothing to reset",
        "All your envelopes are set to roll over. Nothing will change."
      );
      return;
    }

    Alert.alert(
      "End cycle?",
      `${willReset.length} envelope${willReset.length > 1 ? "s" : ""} will be zeroed and $${fmt(totalResetting)} returned to unallocated.\n\n${willRollover.length} envelope${willRollover.length > 1 ? "s" : ""} will keep their balance.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End cycle",
          style: "destructive",
          onPress: () => {
            // Zero out non-rollover envelopes
            const updated = envelopes.map(e =>
              e.rollover ? e : { ...e, amount: 0 }
            );
            dispatch({ type: "SET_ENVELOPES", envelopes: updated });
            Alert.alert(
              "Cycle ended ✓",
              `$${fmt(totalResetting)} returned to unallocated.`,
              [{ text: "Done", onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Cycle selector ── */}
        <Text style={[s.sectionTitle, { marginBottom: spacing.xs }]}>Budget cycle</Text>
        <Text style={[cyc.subtitle, { color: colors.textSecondary }]}>
          How often do you want to reset your non-rollover envelopes?
        </Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {CYCLE_OPTIONS.map(opt => {
            const active = selected === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  cyc.option,
                  {
                    backgroundColor: active ? colors.accentSoft : colors.card,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setSelected(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={cyc.optionIcon}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[cyc.optionLabel, { color: active ? colors.accent : colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={[cyc.optionDesc, { color: colors.textSecondary }]}>
                    {opt.desc}
                  </Text>
                </View>
                <View style={[
                  cyc.radio,
                  {
                    borderColor: active ? colors.accent : colors.border,
                    backgroundColor: active ? colors.accent : "transparent",
                  },
                ]}>
                  {active && <View style={cyc.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {selected !== currentCycle && (
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleSaveCycle}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Save cycle preference</Text>
          </TouchableOpacity>
        )}

        {/* ── End cycle section ── */}
        <View style={[cyc.divider, { backgroundColor: colors.border }]} />

        <Text style={[s.sectionTitle, { marginBottom: spacing.xs }]}>End current cycle</Text>
        <Text style={[cyc.subtitle, { color: colors.textSecondary }]}>
          Running this will zero out non-rollover envelopes and return their balances to unallocated.
        </Text>

        {/* Preview: what will reset */}
        {envelopes.length > 0 ? (
          <View style={{ gap: spacing.sm }}>

            {willReset.length > 0 && (
              <View style={[cyc.previewCard, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[cyc.previewTitle, { color: colors.danger }]}>
                  Will reset to $0 ({willReset.length})
                </Text>
                {willReset.map(e => (
                  <View key={e.id} style={cyc.previewRow}>
                    <Text style={[cyc.previewName, { color: colors.textPrimary }]}>{e.name}</Text>
                    <Text style={[cyc.previewAmount, { color: colors.danger }]}>
                      -${fmt(e.amount ?? 0)}
                    </Text>
                  </View>
                ))}
                <View style={[cyc.previewSummary, { borderTopColor: colors.danger }]}>
                  <Text style={[cyc.previewName, { color: colors.textPrimary, fontWeight: typography.bold }]}>
                    Returned to unallocated
                  </Text>
                  <Text style={[cyc.previewAmount, { color: colors.success, fontWeight: typography.bold }]}>
                    +${fmt(totalResetting)}
                  </Text>
                </View>
              </View>
            )}

            {willRollover.length > 0 && (
              <View style={[cyc.previewCard, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                <Text style={[cyc.previewTitle, { color: colors.success }]}>
                  Will keep balance ({willRollover.length})
                </Text>
                {willRollover.map(e => (
                  <View key={e.id} style={cyc.previewRow}>
                    <Text style={[cyc.previewName, { color: colors.textPrimary }]}>{e.name}</Text>
                    <Text style={[cyc.previewAmount, { color: colors.success }]}>
                      ${fmt(e.amount ?? 0)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

          </View>
        ) : (
          <View style={[cyc.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[cyc.emptyText, { color: colors.textSecondary }]}>
              No envelopes yet. Create some envelopes first.
            </Text>
          </View>
        )}

        {/* End cycle button */}
        <TouchableOpacity
          style={[s.dangerBtn, envelopes.length === 0 && { opacity: 0.4 }]}
          onPress={handleEndCycle}
          disabled={envelopes.length === 0}
          activeOpacity={0.85}
        >
          <Text style={s.dangerBtnText}>
            End {currentCycle} cycle
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const cyc = StyleSheet.create({
  subtitle: {
    fontSize: typography.sm,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  optionIcon: { fontSize: 24 },
  optionLabel: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: typography.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  previewCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewTitle: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewName: {
    fontSize: typography.sm,
  },
  previewAmount: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  previewSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    fontSize: typography.sm,
    textAlign: "center",
  },
});