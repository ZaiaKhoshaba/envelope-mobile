// app/income-schedule.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";

export default function IncomeScheduleScreen() {
  const router = useRouter();
  const { state, setIncomeSchedule } = useBudget();

  const existing = state.incomeSchedule || {};

  const [amount, setAmount] = useState(
    existing.amount != null ? String(existing.amount) : ""
  );
  const [frequency, setFrequency] = useState(
    existing.frequency || "fortnightly"
  );
  const [dayOfWeek, setDayOfWeek] = useState(
    existing.dayOfWeek != null ? existing.dayOfWeek : 1 // 1 = Mon
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    existing.dayOfMonth != null ? String(existing.dayOfMonth) : "1"
  );
  const [anchorDate, setAnchorDate] = useState(
    existing.anchorDate ? isoToYmd(existing.anchorDate) : ""
  );

  // If state changes under us (unlikely, but safe), sync once
  useEffect(() => {
    if (existing.amount != null) setAmount(String(existing.amount));
    if (existing.frequency) setFrequency(existing.frequency);
    if (existing.dayOfWeek != null) setDayOfWeek(existing.dayOfWeek);
    if (existing.dayOfMonth != null)
      setDayOfMonth(String(existing.dayOfMonth));
    if (existing.anchorDate) setAnchorDate(isoToYmd(existing.anchorDate));
  }, []); // run once

  const days = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
  ];

  const onSave = () => {
    const amt = Number(amount || 0);
    if (!amt || Number.isNaN(amt)) {
      Alert.alert("Income", "Please enter a valid income amount.");
      return;
    }

    let dayOfMonthNumber = null;
    if (frequency === "monthly") {
      const n = parseInt(dayOfMonth, 10);
      if (!n || n < 1 || n > 31) {
        Alert.alert(
          "Day of Month",
          "Please enter a valid day of month between 1 and 31."
        );
        return;
      }
      dayOfMonthNumber = n;
    }

    let anchorISO = null;
    if (anchorDate.trim()) {
      const d = new Date(anchorDate.trim());
      if (Number.isNaN(d.getTime())) {
        Alert.alert(
          "First Pay Date",
          "Please enter a valid date in YYYY-MM-DD format."
        );
        return;
      }
      anchorISO = d.toISOString();
    }

    setIncomeSchedule({
      amount: amt,
      frequency,
      dayOfWeek: frequency === "monthly" ? null : dayOfWeek,
      dayOfMonth: frequency === "monthly" ? dayOfMonthNumber : null,
      anchorDate: anchorISO,
    });

    Alert.alert("Saved", "Your income schedule has been updated.", [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  };

  const summaryText = buildSummary({
    amount,
    frequency,
    dayOfWeek,
    dayOfMonth,
    anchorDate,
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Income Schedule</Text>

      {/* Amount */}
      <Text style={styles.label}>Pay Amount</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="e.g. 3456.78"
        placeholderTextColor="#6B7280"
      />

      {/* Frequency */}
      <Text style={styles.label}>How often are you paid?</Text>
      <View style={styles.row}>
        {["weekly", "fortnightly", "monthly"].map((f) => (
          <Chip
            key={f}
            active={frequency === f}
            onPress={() => setFrequency(f)}
          >
            {f}
          </Chip>
        ))}
      </View>

      {/* Day selector */}
      {frequency === "monthly" ? (
        <>
          <Text style={styles.label}>Day of month</Text>
          <TextInput
            style={styles.input}
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
            keyboardType="number-pad"
            placeholder="1–31"
            placeholderTextColor="#6B7280"
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>Day of week</Text>
          <View style={styles.row}>
            {days.map((d) => (
              <Chip
                key={d.value}
                active={dayOfWeek === d.value}
                onPress={() => setDayOfWeek(d.value)}
              >
                {d.label}
              </Chip>
            ))}
          </View>
        </>
      )}

      {/* Anchor date */}
      <Text style={styles.label}>First pay date (anchor)</Text>
      <TextInput
        style={styles.input}
        value={anchorDate}
        onChangeText={setAnchorDate}
        placeholder="e.g. 2025-12-01"
        placeholderTextColor="#6B7280"
      />

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>This means:</Text>
        <Text style={styles.summaryText}>{summaryText}</Text>
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
        <Text style={styles.saveBtnText}>Save Income Schedule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* Helpers */

function buildSummary({ amount, frequency, dayOfWeek, dayOfMonth, anchorDate }) {
  const amt = Number(amount || 0);
  if (!amt) {
    return "Enter your pay amount and schedule details above.";
  }

  const freqLabel =
    frequency === "weekly"
      ? "every week"
      : frequency === "fortnightly"
      ? "every fortnight"
      : "every month";

  let dayPart = "";
  if (frequency === "monthly") {
    dayPart = dayOfMonth ? `on day ${dayOfMonth} of the month` : "";
  } else {
    const label =
      dayOfWeek === 1
        ? "Monday"
        : dayOfWeek === 2
        ? "Tuesday"
        : dayOfWeek === 3
        ? "Wednesday"
        : dayOfWeek === 4
        ? "Thursday"
        : dayOfWeek === 5
        ? "Friday"
        : dayOfWeek === 6
        ? "Saturday"
        : dayOfWeek === 7
        ? "Sunday"
        : "";
    dayPart = label ? `on ${label}` : "";
  }

  let anchorPart = "";
  if (anchorDate) {
    anchorPart = `starting from ${anchorDate}`;
  }

  return `You get $${amt.toFixed(2)} ${freqLabel} ${dayPart}${
    anchorPart ? `, ${anchorPart}` : ""
  }.`;
}

function isoToYmd(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/* Chip component */

function Chip({ active, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "#2563EB" }
          : { backgroundColor: "#151821", borderColor: "#23283A" },
      ]}
    >
      <Text style={styles.chipText}>{children}</Text>
    </TouchableOpacity>
  );
}

/* Styles */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    color: "#9BA3B4",
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0E1017",
    color: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23283A",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    color: "#fff",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  summaryBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#151821",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23283A",
  },
  summaryTitle: {
    color: "#9BA3B4",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});
