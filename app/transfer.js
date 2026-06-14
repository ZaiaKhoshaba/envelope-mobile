// app/transfer.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";
import { fmt } from "../lib/format";

// ── Projection helpers (mirrors index.js logic) ───────────────────────────────

const DOW_MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

function getEnvelopeDueDate(env) {
  const { targetFrequency, targetDate } = env;
  if (!targetFrequency || !targetDate) return null;
  const now = new Date();
  if (targetFrequency === "weekly") {
    const jsDay = DOW_MAP[targetDate];
    if (jsDay === undefined) return null;
    const d = new Date(now);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== jsDay);
    return d;
  }
  const dom = Number(targetDate);
  if (!dom || dom < 1 || dom > 31) return null;
  let d = new Date(now.getFullYear(), now.getMonth(), dom);
  if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, dom);
  return d;
}

function projectedIncomeBeforeDate(incomeSchedule, dueDate) {
  if (!incomeSchedule?.amount || !dueDate) return 0;
  const { amount, frequency, dayOfMonth, anchorDate } = incomeSchedule;
  const now = new Date();
  let count = 0;
  if (frequency === "weekly" || frequency === "fortnightly") {
    const interval = frequency === "weekly" ? 7 : 14;
    let base = anchorDate ? new Date(anchorDate) : new Date();
    if (isNaN(base.getTime())) base = new Date();
    while (base <= now) base = new Date(base.getTime() + interval * 86400000);
    while (base < dueDate) { count++; base = new Date(base.getTime() + interval * 86400000); }
  } else {
    const dom = Number(dayOfMonth) || 1;
    let d = new Date(now.getFullYear(), now.getMonth(), dom);
    if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, dom);
    while (d < dueDate) { count++; d = new Date(d.getFullYear(), d.getMonth() + 1, dom); }
  }
  return count * amount;
}

function getProportionalAnalysis(envelopes, incomeSchedule) {
  const fixedEnvs = envelopes.filter(e => e.type === "fixed" && Number(e.target) > 0);
  if (!fixedEnvs.length) return [];
  const totalTarget = fixedEnvs.reduce((sum, e) => sum + Number(e.target), 0);
  return fixedEnvs.map(env => {
    const proportion     = Number(env.target) / totalTarget;
    const dueDate        = getEnvelopeDueDate(env);
    const projectedTotal = incomeSchedule?.amount && dueDate
      ? projectedIncomeBeforeDate(incomeSchedule, dueDate) : 0;
    const proportionalIncome = projectedTotal * proportion;
    const totalAvailable     = Number(env.amount || 0) + proportionalIncome;
    const shortfall          = Math.max(0, Number(env.target) - totalAvailable);
    // Safe to transfer = how much can leave without causing a future shortfall
    const safeToTransfer     = Math.min(
      Number(env.amount || 0),
      Math.max(0, totalAvailable - Number(env.target))
    );
    return { env, proportion, proportionalIncome, totalAvailable, shortfall, safeToTransfer, isForecastShort: shortfall > 0.005 };
  });
}

// ── Envelope picker ───────────────────────────────────────────────────────────

function EnvelopePicker({ label, hint, selected, envelopes, onSelect, colors, analysis }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={pick.wrap}>
      <View style={pick.labelRow}>
        <Text style={[pick.label, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[pick.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>

      {/* Selected display / trigger */}
      <TouchableOpacity
        style={[pick.trigger, { backgroundColor: colors.cardAlt, borderColor: selected ? colors.accent : colors.border }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        {selected ? (
          <View style={{ flex: 1 }}>
            <Text style={[pick.selectedName, { color: colors.textPrimary }]} numberOfLines={1}>
              {selected.emoji ? `${selected.emoji}  ` : ""}{selected.name}
            </Text>
            <Text style={[pick.selectedMeta, { color: colors.textMuted }]}>
              Balance: ${fmt(Number(selected.amount))}
              {selected.target > 0 ? `  ·  Target: $${fmt(Number(selected.target))}` : ""}
            </Text>
          </View>
        ) : (
          <Text style={[pick.placeholder, { color: colors.textMuted }]}>Select an envelope…</Text>
        )}
        <Text style={[pick.chevron, { color: colors.textMuted }]}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {/* Dropdown list */}
      {open && (
        <View style={[pick.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {envelopes.length === 0 ? (
            <Text style={[pick.emptyText, { color: colors.textMuted }]}>No envelopes available</Text>
          ) : (
            envelopes.map((env, i) => {
              const item      = analysis?.find(a => a.env.id === env.id);
              const surplus   = item ? Math.max(0, Number(env.amount) - Number(env.target)) : null;
              const shortfall = item ? Math.max(0, Number(env.target) - Number(env.amount))  : null;
              return (
                <TouchableOpacity
                  key={env.id}
                  style={[
                    pick.option,
                    i < envelopes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    selected?.id === env.id && { backgroundColor: colors.accentSoft },
                  ]}
                  onPress={() => { onSelect(env); setOpen(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[pick.optionName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {env.emoji ? `${env.emoji}  ` : ""}{env.name}
                    </Text>
                    <Text style={[pick.optionMeta, { color: colors.textSecondary }]}>
                      ${fmt(Number(env.amount))} balance
                      {surplus   > 0.005 ? `  ·  +$${fmt(surplus)} surplus`   : ""}
                      {shortfall > 0.005 ? `  ·  $${fmt(shortfall)} short`     : ""}
                    </Text>
                  </View>
                  {selected?.id === env.id && (
                    <Text style={{ color: colors.accent, fontWeight: "700" }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TransferScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams();
  const { state, transferBetweenEnvelopes } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const envelopes      = state.envelopes;
  const incomeSchedule = state.incomeSchedule;
  const analysis       = getProportionalAnalysis(envelopes, incomeSchedule);

  const preselectedFrom = params.fromId
    ? envelopes.find(e => e.id === params.fromId) ?? null
    : null;

  const [from,       setFrom]       = useState(preselectedFrom);
  const [to,         setTo]         = useState(null);
  const [amountText, setAmountText] = useState("");

  const parsedAmount  = Number(amountText.replace(/[^0-9.]/g, "")) || 0;
  const maxAmount     = from ? Number(from.amount) : 0;
  const isSameEnvelope = from && to && from.id === to.id;
  const isValid       = from && to && !isSameEnvelope && parsedAmount > 0 && parsedAmount <= maxAmount;

  // Forecast data for the selected source envelope
  const fromAnalysis  = analysis.find(a => a.env.id === from?.id);
  const isForecastShort = fromAnalysis?.isForecastShort ?? false;
  const safeToTransfer  = fromAnalysis?.safeToTransfer  ?? maxAmount;

  // Forecast shortfall for destination
  const toAnalysis    = analysis.find(a => a.env.id === to?.id);
  const toShortfall   = toAnalysis
    ? Math.max(0, Number(to.target) - Number(to.amount))
    : to?.target > 0
      ? Math.max(0, Number(to.target) - Number(to.amount))
      : null;

  const handleTransfer = () => {
    if (!isValid) return;
    const result = transferBetweenEnvelopes(from.id, to.id, parsedAmount);
    if (!result.ok) {
      Alert.alert("Transfer failed", result.message);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Transfer complete ✓",
      `$${fmt(parsedAmount)} moved from ${from.name} to ${to.name}.`,
      [{ text: "Done", onPress: () => router.back() }]
    );
  };

  // Smart suggestion: min of safeToTransfer and toShortfall (if both exist)
  const suggestedAmount = from && to && toShortfall > 0
    ? Math.min(safeToTransfer, toShortfall)
    : safeToTransfer;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Tip banner — neutral, clearly informational ── */}
        <View style={[tip.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
          <Text style={tip.icon}>💡</Text>
          <Text style={[tip.text, { color: colors.textSecondary }]}>
            Move funds between envelopes — useful when one is ahead of schedule and another needs topping up.
          </Text>
        </View>

        {/* ── Transfer from ── */}
        <EnvelopePicker
          label="Transfer from"
          hint="envelope with surplus"
          selected={from}
          envelopes={envelopes}
          onSelect={setFrom}
          colors={colors}
          analysis={analysis}
        />

        {/* Source status indicator — only red if forecast shortfall */}
        {from && (
          isForecastShort ? (
            <View style={[status.wrap, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
              <Text style={[status.text, { color: colors.danger }]}>
                ⚠️  {from.name} is forecast to be short — transferring from here may worsen its shortfall.
              </Text>
            </View>
          ) : safeToTransfer > 0.005 ? (
            <View style={[status.wrap, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
              <Text style={[status.text, { color: colors.success }]}>
                ✓  Safe to transfer up to ${fmt(safeToTransfer)} without causing a shortfall on {from.name}.
              </Text>
            </View>
          ) : (
            <View style={[status.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
              <Text style={[status.text, { color: colors.textSecondary }]}>
                All of {from.name}'s balance is earmarked — nothing safe to transfer right now.
              </Text>
            </View>
          )
        )}

        {/* ── Transfer to ── */}
        <EnvelopePicker
          label="Transfer to"
          hint="envelope with shortfall"
          selected={to}
          envelopes={envelopes}
          onSelect={setTo}
          colors={colors}
          analysis={analysis}
        />

        {/* Destination shortfall indicator */}
        {to && !isSameEnvelope && toShortfall > 0.005 && (
          <View style={[status.wrap, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Text style={[status.text, { color: colors.danger }]}>
              🔴  {to.name} needs ${fmt(toShortfall)} to reach its target.
            </Text>
          </View>
        )}

        {/* Same-envelope warning */}
        {isSameEnvelope && (
          <View style={[status.wrap, { backgroundColor: colors.warningBg ?? colors.cardAlt, borderColor: colors.warning }]}>
            <Text style={[status.text, { color: colors.warning }]}>
              ⚠️  You've selected the same envelope for both source and destination. Please choose a different destination.
            </Text>
          </View>
        )}

        {/* ── Amount ── */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontSize: typography.md, fontWeight: typography.semibold, color: colors.textPrimary }}>
              Amount
            </Text>
            {from && suggestedAmount > 0.005 && (
              <TouchableOpacity
                onPress={() => setAmountText(suggestedAmount.toFixed(2))}
                activeOpacity={0.75}
              >
                <Text style={{ fontSize: typography.xs, color: colors.accent, fontWeight: typography.semibold }}>
                  {to && toShortfall > 0 ? `Use suggested ($${fmt(suggestedAmount)})` : `Use max ($${fmt(safeToTransfer)})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[amt.inputWrap, {
            backgroundColor: colors.cardAlt,
            borderColor: parsedAmount > maxAmount ? colors.danger
                       : parsedAmount > safeToTransfer && !isForecastShort ? colors.warning
                       : isValid ? colors.accent : colors.border,
          }]}>
            <Text style={[amt.symbol, { color: parsedAmount > 0 ? colors.accent : colors.textMuted }]}>$</Text>
            <TextInput
              style={[amt.input, { color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={amountText}
              onChangeText={setAmountText}
              returnKeyType="done"
            />
          </View>

          {/* Amount warnings */}
          {parsedAmount > maxAmount && (
            <Text style={{ fontSize: typography.xs, color: colors.danger }}>
              Exceeds available balance of ${fmt(maxAmount)}
            </Text>
          )}
          {parsedAmount > safeToTransfer && parsedAmount <= maxAmount && !isForecastShort && (
            <Text style={{ fontSize: typography.xs, color: colors.warning }}>
              ⚠️  Transferring more than ${fmt(safeToTransfer)} may leave {from?.name} short before its due date.
            </Text>
          )}
        </View>

        {/* ── Preview ── */}
        {isValid && (
          <View style={[prev.wrap, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[prev.text, { color: colors.accent }]}>
              Moving{" "}
              <Text style={{ fontWeight: typography.heavy }}>${fmt(parsedAmount)}</Text>
              {" "}from{" "}
              <Text style={{ fontWeight: typography.heavy }}>{from.name}</Text>
              {" "}→{" "}
              <Text style={{ fontWeight: typography.heavy }}>{to.name}</Text>
            </Text>
            {toShortfall > 0 && (
              <Text style={[prev.sub, { color: colors.accent }]}>
                {parsedAmount >= toShortfall
                  ? `✓ This fully covers ${to.name}'s shortfall`
                  : `${to.name} will still be $${fmt(toShortfall - parsedAmount)} short after transfer`}
              </Text>
            )}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <TouchableOpacity style={[s.secondaryBtn, { flex: 1 }]} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtn, { flex: 2, opacity: isValid ? 1 : 0.4 }]}
            onPress={handleTransfer}
            disabled={!isValid}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>
              {isValid ? `Transfer $${fmt(parsedAmount)}` : "Transfer"}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tip = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: { fontSize: 16, marginTop: 1 },
  text: { flex: 1, fontSize: typography.sm, lineHeight: 20 },
});

const status = StyleSheet.create({
  wrap: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  text: { fontSize: typography.sm, fontWeight: typography.medium, lineHeight: 18 },
});

const pick = StyleSheet.create({
  wrap:     { gap: spacing.xs },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label:    { fontSize: typography.md, fontWeight: typography.semibold },
  hint:     { fontSize: typography.xs },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
    minHeight: 54,
  },
  placeholder:  { flex: 1, fontSize: typography.sm },
  selectedName: { fontSize: typography.md, fontWeight: typography.semibold },
  selectedMeta: { fontSize: typography.xs, marginTop: 2 },
  chevron:      { fontSize: 12 },
  dropdown: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: -spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  optionName:  { fontSize: typography.sm, fontWeight: typography.semibold },
  optionMeta:  { fontSize: typography.xs, marginTop: 2 },
  emptyText:   { padding: spacing.md, fontSize: typography.sm, textAlign: "center" },
});

const amt = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    height: 58,
    gap: spacing.sm,
  },
  symbol: { fontSize: typography.xl,  fontWeight: typography.heavy },
  input:  { flex: 1, fontSize: typography.xxl, fontWeight: typography.heavy },
});

const prev = StyleSheet.create({
  wrap: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: 4 },
  text: { fontSize: typography.sm, lineHeight: 20 },
  sub:  { fontSize: typography.xs },
});
