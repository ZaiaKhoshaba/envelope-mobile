// app/add-spend.js
// Manual spend entry for free users (no bank connectivity).
// After recording the spend it immediately opens the SpendChooserModal
// so the user can allocate it to an envelope in one seamless step.

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
import * as Haptics from "expo-haptics";
import { fmt } from "../lib/format";

export default function AddSpendScreen() {
  const router = useRouter();
  const { addSpend, setPendingSpend, total } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [amountText, setAmountText] = useState("");
  const [merchant,   setMerchant]   = useState("");

  const parsedAmount = Number(amountText.replace(/[^0-9.]/g, "")) || 0;
  const isValid      = parsedAmount > 0;

  const onSubmit = () => {
    if (!isValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.");
      return;
    }

    if (parsedAmount > total) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Exceeds balance",
        `You only have $${fmt(total)} available. Are you sure you want to record this spend?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Record anyway", onPress: () => record() },
        ]
      );
      return;
    }

    record();
  };

  const record = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { ok, tx } = addSpend(parsedAmount, merchant);
    if (!ok) return;

    // Immediately queue it for allocation — the SpendChooserModal will
    // appear on the home screen as soon as we navigate there.
    setPendingSpend(tx);
    router.replace("/");
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

          {/* ── Balance context ── */}
          <View style={[s.card, bal.wrap]}>
            <Text style={[bal.label, { color: colors.textSecondary }]}>
              Total balance
            </Text>
            <Text style={[bal.value, { color: total <= 0 ? colors.danger : colors.textPrimary }]}>
              ${fmt(total)}
            </Text>
            <Text style={[bal.hint, { color: colors.textMuted }]}>
              After recording, choose which envelope covers this spend
            </Text>
          </View>

          {/* ── Amount field ── */}
          <View style={field.wrap}>
            <Text style={[field.label, { color: colors.textPrimary }]}>Amount spent</Text>
            <View style={[
              amount.inputWrap,
              {
                backgroundColor: colors.cardAlt,
                borderColor: isValid ? colors.danger : colors.border,
              },
            ]}>
              <Text style={[amount.symbol, { color: isValid ? colors.danger : colors.textMuted }]}>
                $
              </Text>
              <TextInput
                style={[amount.input, { color: colors.textPrimary }]}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={setAmountText}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                autoFocus
              />
              {isValid && (
                <Text style={[amount.preview, { color: colors.danger }]}>
                  −${fmt(parsedAmount)}
                </Text>
              )}
            </View>
          </View>

          {/* ── Quick amount shortcuts ── */}
          <View style={quick.row}>
            {[20, 50, 100, 200].map(amt => (
              <TouchableOpacity
                key={amt}
                style={[quick.chip, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAmountText(String(amt));
                }}
                activeOpacity={0.75}
              >
                <Text style={[quick.chipText, { color: colors.textSecondary }]}>
                  ${amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Merchant field ── */}
          <View style={field.wrap}>
            <Text style={[field.label, { color: colors.textPrimary }]}>
              Where did you spend it?{" "}
              <Text style={{ color: colors.textMuted, fontWeight: typography.regular }}>
                (optional)
              </Text>
            </Text>
            <TextInput
              style={[s.input, { marginTop: spacing.xs }]}
              placeholder="e.g. Woolworths, Shell, Netflix"
              placeholderTextColor={colors.textMuted}
              value={merchant}
              onChangeText={setMerchant}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />
          </View>

          {/* ── Actions ── */}
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <TouchableOpacity
              style={[
                s.primaryBtn,
                { backgroundColor: isValid ? colors.danger : colors.border },
                !isValid && { opacity: 0.45 },
              ]}
              onPress={onSubmit}
              disabled={!isValid}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>
                {isValid ? `Record $${fmt(parsedAmount)} spend` : "Record spend"}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const scroll = StyleSheet.create({
  content: {
    padding:       spacing.lg,
    paddingBottom: 60,
    gap:           spacing.lg,
  },
});

const bal = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap:        spacing.xs,
  },
  label: {
    fontSize:      typography.xs,
    fontWeight:    typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  value: {
    fontSize:   typography.hero,
    fontWeight: typography.heavy,
  },
  hint: {
    fontSize:  typography.sm,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});

const field = StyleSheet.create({
  wrap:  { gap: spacing.xs },
  label: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
  },
});

const amount = StyleSheet.create({
  inputWrap: {
    flexDirection:    "row",
    alignItems:       "center",
    borderRadius:     radius.md,
    borderWidth:      1.5,
    paddingHorizontal: spacing.lg,
    height:           58,
    gap:              spacing.sm,
    marginTop:        spacing.xs,
  },
  symbol: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
  },
  input: {
    flex:       1,
    fontSize:   typography.xxl,
    fontWeight: typography.heavy,
  },
  preview: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
});

const quick = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap:           spacing.sm,
  },
  chip: {
    flex:           1,
    height:         38,
    borderRadius:   radius.pill,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
});
