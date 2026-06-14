// app/income-schedule.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";
import { schedulePaydayReminders } from "../lib/paydayNotifications";

const FREQUENCIES = ["weekly", "fortnightly", "monthly"];
const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToYmd(iso) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch { return ""; }
}

function getNextPayDates(frequency, dayOfWeek, dayOfMonth, anchorDate, count = 3) {
  const dates = [];
  try {
    const now = new Date();

    if (frequency === "weekly" || frequency === "fortnightly") {
      const interval = frequency === "weekly" ? 7 : 14;
      let base;

      if (anchorDate) {
        // Anchor provided — it already falls on the right day, just step forward
        base = new Date(anchorDate);
        if (isNaN(base.getTime())) base = new Date();
        while (base <= now) base = new Date(base.getTime() + interval * 86400000);
      } else {
        // No anchor — find the next occurrence of the selected weekday.
        // dayOfWeek values: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
        // JS getDay():      0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        const jsTarget = dayOfWeek === 7 ? 0 : dayOfWeek;
        base = new Date(now);
        base.setHours(0, 0, 0, 0);
        // Walk forward day-by-day until we land on the target weekday
        do {
          base = new Date(base.getTime() + 86400000);
        } while (base.getDay() !== jsTarget);
      }

      for (let i = 0; i < count; i++) {
        dates.push(new Date(base));
        base = new Date(base.getTime() + interval * 86400000);
      }
    } else {
      // Monthly — day-of-month based, unaffected by this bug
      let d = new Date(now.getFullYear(), now.getMonth(), Number(dayOfMonth) || 1);
      if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, Number(dayOfMonth) || 1);
      for (let i = 0; i < count; i++) {
        dates.push(new Date(d));
        d = new Date(d.getFullYear(), d.getMonth() + 1, Number(dayOfMonth) || 1);
      }
    }
  } catch { /* skip */ }
  return dates;
}

function formatDate(d) {
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// ── Segmented control ─────────────────────────────────────────────────────────

function SegmentedControl({ options, value, onChange, colors, labelFn }) {
  return (
    <View style={[seg.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={String(opt)}
            style={[seg.item, active && { backgroundColor: colors.accent }]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[seg.text, { color: active ? "#fff" : colors.textSecondary }]}>
              {labelFn ? labelFn(opt) : String(opt)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function IncomeScheduleScreen() {
  const router = useRouter();
  const { state, setIncomeSchedule } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const existing = state.incomeSchedule || {};

  const [amount, setAmount]           = useState(existing.amount != null ? String(existing.amount) : "");
  const [frequency, setFrequency]     = useState(existing.frequency || "fortnightly");
  const [dayOfWeek, setDayOfWeek]     = useState(existing.dayOfWeek ?? 5); // default Friday
  const [dayOfMonth, setDayOfMonth]   = useState(existing.dayOfMonth != null ? String(existing.dayOfMonth) : "1");
  const [anchorDate, setAnchorDate]   = useState(existing.anchorDate ? isoToYmd(existing.anchorDate) : "");

  const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

  // ── Next pay dates preview ──────────────────────────────────────────────────
  const nextDates = useMemo(() => {
    return getNextPayDates(frequency, dayOfWeek, dayOfMonth, anchorDate || null, 3);
  }, [frequency, dayOfWeek, dayOfMonth, anchorDate]);

  const summaryText = useMemo(() => {
    const amt = Number(amount || 0);
    if (!amt) return null;
    const freqLabel = frequency === "weekly" ? "every week"
      : frequency === "fortnightly" ? "every fortnight"
      : "every month";
    const dayLabel = frequency === "monthly"
      ? `on day ${dayOfMonth} of the month`
      : DAYS.find(d => d.value === dayOfWeek)?.label
        ? `on ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][dayOfWeek - 1]}s`
        : "";
    return `You receive $${fmt(amt)} ${freqLabel}${dayLabel ? ` ${dayLabel}` : ""}.`;
  }, [amount, frequency, dayOfWeek, dayOfMonth]);

  const onSave = () => {
    const amt = Number(amount || 0);
    if (!amt || isNaN(amt)) {
      Alert.alert("Pay amount", "Please enter a valid income amount.");
      return;
    }
    if (frequency === "monthly") {
      const n = parseInt(dayOfMonth, 10);
      if (!n || n < 1 || n > 31) {
        Alert.alert("Day of month", "Please enter a valid day between 1 and 31.");
        return;
      }
    }
    let anchorISO = null;
    if (anchorDate.trim()) {
      const d = new Date(anchorDate.trim());
      if (isNaN(d.getTime())) {
        Alert.alert("First pay date", "Please use YYYY-MM-DD format, e.g. 2025-12-06");
        return;
      }
      anchorISO = d.toISOString();
    }

    const newSchedule = {
      amount: amt,
      frequency,
      dayOfWeek: frequency === "monthly" ? null : dayOfWeek,
      dayOfMonth: frequency === "monthly" ? parseInt(dayOfMonth, 10) : null,
      anchorDate: anchorISO,
    };

    setIncomeSchedule(newSchedule);

    // Schedule payday reminders for the next few pay dates
    schedulePaydayReminders(newSchedule);

    Alert.alert("Saved ✓", "Your income schedule has been updated.", [
      { text: "Done", onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Pay amount ── */}
        <View style={inc.fieldWrap}>
          <Text style={[inc.label, { color: colors.textPrimary }]}>Pay amount</Text>
          <Text style={[inc.hint, { color: colors.textSecondary }]}>
            Your take-home pay per period
          </Text>
          <View style={[inc.amountWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[inc.dollarSign, { color: colors.textSecondary }]}>$</Text>
            <TextInput
              style={[inc.amountInput, { color: colors.textPrimary }]}
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* ── Frequency ── */}
        <View style={inc.fieldWrap}>
          <Text style={[inc.label, { color: colors.textPrimary }]}>Pay frequency</Text>
          <SegmentedControl
            options={FREQUENCIES}
            value={frequency}
            onChange={setFrequency}
            colors={colors}
            labelFn={capitalize}
          />
        </View>

        {/* ── Day selector ── */}
        {frequency === "monthly" ? (
          <View style={inc.fieldWrap}>
            <Text style={[inc.label, { color: colors.textPrimary }]}>Day of month</Text>
            <Text style={[inc.hint, { color: colors.textSecondary }]}>Which day do you get paid?</Text>
            <TextInput
              style={[s.input, { marginTop: spacing.xs }]}
              value={dayOfMonth}
              onChangeText={setDayOfMonth}
              keyboardType="number-pad"
              placeholder="e.g. 15"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
            />
          </View>
        ) : (
          <View style={inc.fieldWrap}>
            <Text style={[inc.label, { color: colors.textPrimary }]}>Pay day</Text>
            <Text style={[inc.hint, { color: colors.textSecondary }]}>Which day of the week?</Text>
            <View style={{ marginTop: spacing.xs }}>
              <SegmentedControl
                options={DAYS.map(d => d.value)}
                value={dayOfWeek}
                onChange={setDayOfWeek}
                colors={colors}
                labelFn={v => DAYS.find(d => d.value === v)?.label ?? ""}
              />
            </View>
          </View>
        )}

        {/* ── Anchor date ── */}
        <View style={inc.fieldWrap}>
          <Text style={[inc.label, { color: colors.textPrimary }]}>First pay date</Text>
          <Text style={[inc.hint, { color: colors.textSecondary }]}>
            Optional — helps calculate future pay dates accurately
          </Text>
          <TextInput
            style={[s.input, { marginTop: spacing.xs }]}
            value={anchorDate}
            onChangeText={setAnchorDate}
            placeholder="YYYY-MM-DD  e.g. 2026-05-09"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
        </View>

        {/* ── Summary sentence ── */}
        {summaryText && (
          <View style={[inc.summaryBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[inc.summaryText, { color: colors.accent }]}>{summaryText}</Text>
          </View>
        )}

        {/* ── Next pay dates preview ── */}
        {amount ? (
          <View style={inc.fieldWrap}>
            <Text style={[inc.label, { color: colors.textPrimary }]}>Next pay dates</Text>
            <View style={[inc.datesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {nextDates.map((d, i) => (
                <View
                  key={i}
                  style={[
                    inc.dateRow,
                    i < nextDates.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                >
                  <View style={[inc.dateBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[inc.dateBadgeText, { color: colors.accent }]}>{i + 1}</Text>
                  </View>
                  <Text style={[inc.dateText, { color: colors.textPrimary }]}>{formatDate(d)}</Text>
                  <Text style={[inc.dateAmount, { color: colors.success }]}>
                    +${fmt(Number(amount || 0))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Save ── */}
        <TouchableOpacity
          style={s.primaryBtn}
          onPress={onSave}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>Save income schedule</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const seg = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
    padding: 3,
    gap: 3,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  text: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});

const inc = StyleSheet.create({
  fieldWrap: { gap: spacing.xs },
  label: { fontSize: typography.md, fontWeight: typography.semibold },
  hint: { fontSize: typography.sm },

  amountWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 58,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dollarSign: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  amountInput: {
    flex: 1,
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
  },

  summaryBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  summaryText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    lineHeight: 20,
  },

  datesCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  dateBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadgeText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  dateText: {
    flex: 1,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  dateAmount: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});