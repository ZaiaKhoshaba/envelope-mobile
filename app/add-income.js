// app/add-income.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBudget, buildProportionalPlans } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";
import { schedulePaydayReminders } from "../lib/paydayNotifications";

export default function AddIncomeScreen() {
  const router = useRouter();
  const { prefill } = useLocalSearchParams();
  const { addIncome, unallocated, state } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  // Pre-fill from payday notification tap (prefill = pay amount from schedule)
  const [amountText, setAmountText] = useState(prefill ? String(prefill) : "");
  const [note, setNote]             = useState("");

  const parsedAmount = Number(amountText.replace(/[^0-9.]/g, "")) || 0;
  const isValid      = parsedAmount > 0;

  // Proportional allocation preview — updates live as user types
  const allocationPlans = isValid
    ? buildProportionalPlans(parsedAmount, state.envelopes)
    : [];

  const onSubmit = () => {
    if (!isValid) {
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.");
      return;
    }
    addIncome(parsedAmount, note.trim());

    // Reschedule payday reminders so the next one is queued
    if (state.incomeSchedule?.frequency) {
      schedulePaydayReminders(state.incomeSchedule);
    }

    Alert.alert(
      "Income added",
      `$${fmt(parsedAmount)} added to your unallocated balance.`,
      [
        { text: "Done", style: "cancel", onPress: () => router.back() },
        { text: "Allocate now", onPress: () => router.replace("/envelopes") },
      ]
    );
    setAmountText("");
    setNote("");
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={scroll.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Current unallocated balance ── */}
          <View style={[s.card, bal.wrap]}>
            <Text style={[bal.label, { color: colors.textSecondary }]}>
              Ready to allocate
            </Text>
            <Text style={[bal.value, { color: colors.textPrimary }]}>
              ${fmt(unallocated)}
            </Text>
            <Text style={[bal.hint, { color: colors.textMuted }]}>
              Enter your current bank balance to start — then assign every dollar to an envelope
            </Text>
          </View>

          {/* ── Amount field ── */}
          <View style={field.wrap}>
            <Text style={[field.label, { color: colors.textPrimary }]}>Amount</Text>
            <View style={[amount.inputWrap, { backgroundColor: colors.cardAlt, borderColor: isValid ? colors.accent : colors.border }]}>
              <Text style={[amount.symbol, { color: isValid ? colors.accent : colors.textMuted }]}>$</Text>
              <TextInput
                style={[amount.input, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
              />
              {isValid && (
                <Text style={[amount.preview, { color: colors.success }]}>
                  +${fmt(parsedAmount)}
                </Text>
              )}
            </View>
          </View>

          {/* ── Note field ── */}
          <View style={field.wrap}>
            <Text style={[field.label, { color: colors.textPrimary }]}>
              Note{" "}
              <Text style={{ color: colors.textMuted, fontWeight: typography.regular }}>
                (optional)
              </Text>
            </Text>
            <TextInput
              style={[s.input, { marginTop: spacing.xs }]}
              placeholder="e.g. Salary, Freelance, Refund"
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          </View>

          {/* ── Allocation preview ── */}
          {allocationPlans.length > 0 && (
            <View style={[alloc.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[alloc.heading, { color: colors.textPrimary }]}>
                💼 How this will be allocated
              </Text>
              <Text style={[alloc.sub, { color: colors.textSecondary }]}>
                Fixed envelopes fill proportionally · Savings receive their contribution on top.
              </Text>
              {allocationPlans.map(p => {
                const env = state.envelopes.find(e => e.id === p.envId);
                if (!env) return null;
                const isSavings = env.type === "savings";
                return (
                  <View key={p.envId} style={[alloc.row, { borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[alloc.envName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {env.emoji ? `${env.emoji}  ` : ""}{env.name}
                      </Text>
                      {isSavings && (
                        <Text style={[alloc.pct, { color: colors.textMuted }]}>Savings contribution</Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[alloc.amount, { color: isSavings ? colors.success : colors.accent }]}>
                        +${fmt(p.allocation)}
                      </Text>
                      {!isSavings && (
                        <Text style={[alloc.pct, { color: colors.textMuted }]}>
                          {(p.proportion * 100).toFixed(1)}%
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
              {/* Remainder to unallocated */}
              {(() => {
                const totalAllocated = allocationPlans.reduce((s, p) => s + p.allocation, 0);
                const remainder = parsedAmount - totalAllocated;
                if (remainder < 0.01) return null;
                return (
                  <View style={[alloc.row, { borderTopColor: colors.border }]}>
                    <Text style={[alloc.envName, { color: colors.textSecondary }]}>
                      Unallocated (flexible spending)
                    </Text>
                    <Text style={[alloc.amount, { color: colors.success }]}>
                      +${fmt(remainder)}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {/* ── Quick amount shortcuts ── */}
          <View style={quick.row}>
            {[500, 1000, 2000, 5000].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[quick.chip, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                onPress={() => setAmountText(String(amt))}
                activeOpacity={0.75}
              >
                <Text style={[quick.chipText, { color: colors.textSecondary }]}>
                  ${amt >= 1000 ? `${amt / 1000}k` : amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Actions ── */}
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <TouchableOpacity
              style={[s.primaryBtn, !isValid && { opacity: 0.45 }]}
              onPress={onSubmit}
              disabled={!isValid}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>
                {isValid ? `Add $${fmt(parsedAmount)}` : "Add income"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={s.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const scroll = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
    gap: spacing.lg,
  },
});

const bal = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  value: {
    fontSize: typography.hero,
    fontWeight: typography.heavy,
  },
  hint: {
    fontSize: typography.sm,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});

const field = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
});

const amount = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    height: 58,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  symbol: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  input: {
    flex: 1,
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
  },
  preview: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});

const alloc = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  heading: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    padding: spacing.md,
    paddingBottom: spacing.xs,
  },
  sub: {
    fontSize: typography.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  envName: { fontSize: typography.sm, fontWeight: typography.medium, flex: 1 },
  amount:  { fontSize: typography.sm, fontWeight: typography.bold },
  pct:     { fontSize: typography.xs },
});

const quick = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});
