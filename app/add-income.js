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
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

export default function AddIncomeScreen() {
  const router = useRouter();
  const { addIncome, unallocated } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [amountText, setAmountText] = useState("");
  const [note, setNote]             = useState("");

  const parsedAmount = Number(amountText.replace(/[^0-9.]/g, "")) || 0;
  const isValid      = parsedAmount > 0;

  const onSubmit = () => {
    if (!isValid) {
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.");
      return;
    }
    addIncome(parsedAmount, note.trim());
    Alert.alert(
      "Income added",
      `$${parsedAmount.toFixed(2)} added to your unallocated balance.`,
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
              Current unallocated
            </Text>
            <Text style={[bal.value, { color: colors.textPrimary }]}>
              ${unallocated.toFixed(2)}
            </Text>
            <Text style={[bal.hint, { color: colors.textMuted }]}>
              After adding income, allocate funds to your envelopes
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
                  +${parsedAmount.toFixed(2)}
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
                {isValid ? `Add $${parsedAmount.toFixed(2)}` : "Add income"}
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
