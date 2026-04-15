// app/edit-envelope.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  SafeAreaView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

const FREQUENCIES = ["weekly", "fortnightly", "monthly"];

function SegmentedControl({ options, value, onChange, colors, labelFn }) {
  return (
    <View style={[seg.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[seg.item, active && { backgroundColor: colors.accent }]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[seg.text, { color: active ? "#fff" : colors.textSecondary }]}>
              {labelFn ? labelFn(opt) : opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({ label, hint, children }) {
  const { colors } = useTheme();
  return (
    <View style={field.wrap}>
      <View style={field.labelRow}>
        <Text style={[field.label, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[field.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export default function EditEnvelope() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { state, editEnvelope } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const env = state.envelopes.find(e => e.id === id);

  const [name, setName]                     = useState(env?.name ?? "");
  const [type, setType]                     = useState(env?.type ?? "fixed");
  const [targetBudget, setTargetBudget]     = useState(env?.target ? String(env.target) : "");
  const [targetFrequency, setTargetFrequency] = useState(env?.targetFrequency ?? "monthly");
  const [targetDate, setTargetDate]         = useState(env?.targetDate ?? "1");
  const [rollover, setRollover]             = useState(env?.rollover ?? true);

  useEffect(() => {
    if (!env) {
      Alert.alert("Not found", "This envelope no longer exists.");
      router.back();
    }
  }, []);

  if (!env) return null;

  const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter an envelope name.");
      return;
    }
    const targetNum = Number(targetBudget || 0);
    if (isNaN(targetNum)) {
      Alert.alert("Invalid target", "Target budget must be a number.");
      return;
    }
    const dateNum = Number(targetDate || 1);
    if (isNaN(dateNum) || dateNum < 1 || dateNum > 31) {
      Alert.alert("Invalid date", "Target date must be between 1 and 31.");
      return;
    }

    editEnvelope(id, {
      name: name.trim(),
      type,
      rollover,
      target: targetNum,
      targetFrequency,
      targetDate: String(dateNum),
    });

    router.back();
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Current balance info banner */}
        <View style={[bal.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[bal.label, { color: colors.textSecondary }]}>Current balance</Text>
          <Text style={[bal.value, { color: colors.textPrimary }]}>
            ${(env.amount ?? 0).toFixed(2)}
          </Text>
          <Text style={[bal.note, { color: colors.textMuted }]}>
            Balance is not affected by editing
          </Text>
        </View>

        {/* ── Type selector ── */}
        <View style={[typeCard.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[typeCard.half, type === "fixed" && { backgroundColor: colors.accent }]}
            onPress={() => setType("fixed")}
            activeOpacity={0.85}
          >
            <Text style={typeCard.icon}>🔒</Text>
            <Text style={[typeCard.label, { color: type === "fixed" ? "#FFFFFF" : colors.textPrimary }]}>
              Fixed
            </Text>
            <Text style={[typeCard.desc, { color: type === "fixed" ? "rgba(255,255,255,0.65)" : colors.textMuted }]}>
              Must-pay bills{"\n"}& commitments
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[typeCard.half, type === "flexible" && { backgroundColor: colors.accent }]}
            onPress={() => setType("flexible")}
            activeOpacity={0.85}
          >
            <Text style={typeCard.icon}>🎯</Text>
            <Text style={[typeCard.label, { color: type === "flexible" ? "#fff" : colors.textPrimary }]}>
              Flexible
            </Text>
            <Text style={[typeCard.desc, { color: type === "flexible" ? "rgba(255,255,255,0.65)" : colors.textMuted }]}>
              Variable spending{"\n"}& savings goals
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Name ── */}
        <Field label="Envelope name">
          <TextInput
            style={[s.input, { marginTop: spacing.xs }]}
            placeholder="Name your envelope"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />
        </Field>

        {/* ── Target budget ── */}
        <Field label="Target budget" hint="per period — optional">
          <TextInput
            style={[s.input, { marginTop: spacing.xs }]}
            placeholder="e.g. 1500.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={targetBudget}
            onChangeText={setTargetBudget}
            returnKeyType="done"
          />
        </Field>

        {/* ── Target frequency ── */}
        <Field label="Budget frequency">
          <View style={{ marginTop: spacing.xs }}>
            <SegmentedControl
              options={FREQUENCIES}
              value={targetFrequency}
              onChange={setTargetFrequency}
              colors={colors}
              labelFn={capitalize}
            />
          </View>
        </Field>

        {/* ── Target date ── */}
        <Field label="Due date" hint="day of month (1–31)">
          <TextInput
            style={[s.input, { marginTop: spacing.xs }]}
            placeholder="e.g. 22 for the 22nd"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={String(targetDate)}
            onChangeText={setTargetDate}
            returnKeyType="done"
          />
        </Field>

        {/* ── Rollover toggle ── */}
        <View style={[roll.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[roll.label, { color: colors.textPrimary }]}>Roll over unused funds</Text>
            <Text style={[roll.sub, { color: colors.textSecondary }]}>
              {rollover
                ? "Leftover balance carries into the next cycle"
                : "Balance resets to $0 at end of each cycle"}
            </Text>
          </View>
          <Switch
            value={rollover}
            onValueChange={setRollover}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#fff"
          />
        </View>

        {/* ── Actions ── */}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <TouchableOpacity
            style={[s.secondaryBtn, { flex: 1 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={s.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.primaryBtn, { flex: 2 }]}
            onPress={onSave}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Save changes</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const typeCard = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    gap: 1,
  },
  half: {
    flex: 1,
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.xs,
  },
  icon: { fontSize: 28 },
  label: { fontSize: typography.lg, fontWeight: typography.heavy },
  desc: { fontSize: typography.xs, textAlign: "center", lineHeight: 16 },
});

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
    textTransform: "capitalize",
  },
});

const field = StyleSheet.create({
  wrap: { gap: 0 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  label: { fontSize: typography.md, fontWeight: typography.semibold },
  hint: { fontSize: typography.xs },
});

const roll = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  label: { fontSize: typography.md, fontWeight: typography.semibold, marginBottom: 2 },
  sub: { fontSize: typography.sm, lineHeight: 18 },
});

const bal = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.xs,
  },
  label: { fontSize: typography.xs, fontWeight: typography.medium, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: typography.xxl, fontWeight: typography.heavy },
  note: { fontSize: typography.xs },
});