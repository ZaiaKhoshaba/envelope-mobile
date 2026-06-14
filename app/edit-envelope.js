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
  Modal,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";

const FREQUENCIES   = ["weekly", "fortnightly", "monthly"];
const DAYS_OF_WEEK  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMOJI_OPTIONS = [
  "✉️","💰","🆘","✈️","🏠","🏡","⚡","🛡️","🚗","🍽️","🎬","🛒",
  "👗","🏋️","📱","🎓","💊","🔧","🐾","☕","🎁","📺","🎵","🏥",
  "📚","💍","💼","🌮","🍕","🎯","🎮","🧴","🍫","🌿","🧘","🏊",
  "🎨","🎸","💅","🐶","🏦","🛍️","🚌","🎤","🖥️","🍺","🎪","🌴",
];

// ── Segmented control ─────────────────────────────────────────────────────────
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

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, hintRequired, children }) {
  const { colors } = useTheme();
  return (
    <View style={field.wrap}>
      <View style={field.labelRow}>
        <Text style={[field.label, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? (
          <Text style={[field.hint, { color: hintRequired ? colors.accent : colors.textMuted }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function EditEnvelope() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { state, editEnvelope } = useBudget();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const env = state.envelopes.find(e => e.id === id);

  // ── Form state (initialised from existing envelope) ─────────────────────────
  const [name,              setName]              = useState(env?.name            ?? "");
  const [type,              setType]              = useState(env?.type            ?? "fixed");
  const [emoji,             setEmoji]             = useState(env?.emoji           || "✉️");
  const [notes,             setNotes]             = useState(env?.notes           ?? "");
  const [targetBudget,      setTargetBudget]      = useState(env?.target          ? String(env.target) : "");
  const [targetFrequency,   setTargetFrequency]   = useState(env?.targetFrequency ?? "monthly");
  const [targetDate,        setTargetDate]        = useState(env?.targetDate      ?? "1");
  const [rollover,          setRollover]          = useState(env?.rollover        ?? false);
  const [emojiPickerOpen,   setEmojiPickerOpen]   = useState(false);
  // Savings-specific
  const [contributionMode,  setContributionMode]  = useState(
    (env?.contributionPct > 0) ? "pct" : "fixed"
  );
  const [contributionValue, setContributionValue] = useState(
    env?.type === "savings"
      ? String(env?.contributionPct > 0 ? env.contributionPct : (env?.contributionAmount || ""))
      : ""
  );
  const [goalAmount,        setGoalAmount]        = useState(
    env?.goalAmount ? String(env.goalAmount) : ""
  );

  useEffect(() => {
    if (!env) {
      Alert.alert("Not found", "This envelope no longer exists.");
      router.back();
    }
  }, []);

  if (!env) return null;

  const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

  // ── Frequency change — reset due date format ──────────────────────────────
  const handleFrequencyChange = (freq) => {
    setTargetFrequency(freq);
    if (freq === "weekly" && !DAYS_OF_WEEK.includes(targetDate)) {
      setTargetDate("Mon");
    } else if (freq !== "weekly" && DAYS_OF_WEEK.includes(targetDate)) {
      setTargetDate("1");
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSave = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter an envelope name.");
      return;
    }

    if (type === "savings") {
      const contribNum = Number(contributionValue || 0);
      if (!contributionValue || contribNum <= 0) {
        Alert.alert("Contribution required", "Enter how much to contribute to savings each pay.");
        return;
      }
      const goalNum = Number(goalAmount || 0);
      editEnvelope(id, {
        name: name.trim(),
        emoji,
        notes: notes.trim() || null,
        type: "savings",
        rollover: true,
        target: 0,
        targetFrequency: null,
        targetDate: null,
        contributionAmount: contributionMode === "fixed" ? contribNum : 0,
        contributionPct:    contributionMode === "pct"   ? contribNum : 0,
        goalAmount:         goalNum > 0 ? goalNum : null,
      });
      router.back();
      return;
    }

    const targetNum = Number(targetBudget || 0);
    if (isNaN(targetNum)) {
      Alert.alert("Invalid target", "Target budget must be a number.");
      return;
    }
    if (type === "fixed") {
      if (!targetBudget || targetNum <= 0) {
        Alert.alert("Budget required", "Fixed envelopes need a target budget — this is a committed expense.");
        return;
      }
      if (targetFrequency === "weekly") {
        if (!DAYS_OF_WEEK.includes(targetDate)) {
          Alert.alert("Due day required", "Please select which day of the week this expense is due.");
          return;
        }
      } else {
        const dateNum = Number(targetDate || 0);
        if (isNaN(dateNum) || dateNum < 1 || dateNum > 31) {
          Alert.alert("Due date required", "Fixed envelopes need a due date (1–31).");
          return;
        }
      }
    }

    const resolvedDate =
      targetFrequency === "weekly"
        ? targetDate
        : type === "fixed"
          ? String(Number(targetDate))
          : (targetDate && Number(targetDate) >= 1 ? String(Number(targetDate)) : null);

    editEnvelope(id, {
      name: name.trim(),
      emoji,
      notes: notes.trim() || null,
      type,
      rollover,
      target: targetNum,
      targetFrequency: (type === "fixed" || targetBudget) ? targetFrequency : null,
      targetDate: resolvedDate,
      contributionAmount: 0,
      contributionPct: 0,
      goalAmount: null,
    });
    router.back();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Current balance banner ── */}
        <View style={[bal.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[bal.label, { color: colors.textSecondary }]}>Current balance</Text>
          <Text style={[bal.value, { color: colors.textPrimary }]}>
            ${fmt(env.amount ?? 0)}
          </Text>
          <Text style={[bal.note, { color: colors.textMuted }]}>
            Balance is not affected by editing
          </Text>
        </View>

        {/* ── Envelope type selector ── */}
        <View style={[typeCard.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[typeCard.third, type === "fixed" && { backgroundColor: colors.accent }]}
            onPress={() => setType("fixed")}
            activeOpacity={0.85}
          >
            <Text style={typeCard.icon}>🔒</Text>
            <Text style={[typeCard.label, { color: type === "fixed" ? "#fff" : colors.textPrimary }]}>Fixed</Text>
            <Text style={[typeCard.desc, { color: type === "fixed" ? "rgba(255,255,255,0.65)" : colors.textMuted }]}>
              Bills &{"\n"}commitments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[typeCard.third, type === "flexible" && { backgroundColor: colors.accent }]}
            onPress={() => setType("flexible")}
            activeOpacity={0.85}
          >
            <Text style={typeCard.icon}>🎯</Text>
            <Text style={[typeCard.label, { color: type === "flexible" ? "#fff" : colors.textPrimary }]}>Flexible</Text>
            <Text style={[typeCard.desc, { color: type === "flexible" ? "rgba(255,255,255,0.65)" : colors.textMuted }]}>
              Variable{"\n"}spending
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[typeCard.third, type === "savings" && { backgroundColor: colors.accent }]}
            onPress={() => setType("savings")}
            activeOpacity={0.85}
          >
            <Text style={typeCard.icon}>📈</Text>
            <Text style={[typeCard.label, { color: type === "savings" ? "#fff" : colors.textPrimary }]}>Savings</Text>
            <Text style={[typeCard.desc, { color: type === "savings" ? "rgba(255,255,255,0.65)" : colors.textMuted }]}>
              Grows every{"\n"}pay day
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Envelope name + emoji ── */}
        <Field
          label="Envelope name"
          hint={type === "fixed" ? "e.g. Rent, Insurance, Subscriptions" : "e.g. Dining out, Entertainment, Travel"}
        >
          <View style={[emojiField.row, { marginTop: spacing.xs }]}>
            {/* Emoji button */}
            <TouchableOpacity
              style={[emojiField.emojiBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={() => setEmojiPickerOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={emojiField.emojiText}>{emoji}</Text>
              <View style={[emojiField.badge, { backgroundColor: colors.accent }]}>
                <Text style={emojiField.badgeText}>✎</Text>
              </View>
            </TouchableOpacity>
            {/* Name input */}
            <TextInput
              style={[s.input, emojiField.nameInput, { flex: 1 }]}
              placeholder="Name your envelope"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
          </View>
        </Field>

        {/* ── Notes ── */}
        <Field label="Notes" hint="optional — what this envelope covers">
          <TextInput
            style={[s.input, { marginTop: spacing.xs, height: 72, paddingTop: spacing.sm, textAlignVertical: "top" }]}
            placeholder="e.g. What does this envelope cover?"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit
          />
        </Field>

        {/* ── Savings fields ── */}
        {type === "savings" && (
          <>
            <Field label="Contribution per pay" hint="required" hintRequired>
              <View style={{ marginTop: spacing.xs, gap: spacing.sm }}>
                <SegmentedControl
                  options={["fixed", "pct"]}
                  value={contributionMode}
                  onChange={setContributionMode}
                  colors={colors}
                  labelFn={o => o === "fixed" ? "Fixed $" : "% of income"}
                />
                <View style={[amt.inputWrap, { backgroundColor: colors.cardAlt, borderColor: contributionValue ? colors.accent : colors.border }]}>
                  <Text style={[amt.symbol, { color: contributionValue ? colors.accent : colors.textMuted }]}>
                    {contributionMode === "fixed" ? "$" : "%"}
                  </Text>
                  <TextInput
                    style={[amt.input, { color: colors.textPrimary }]}
                    placeholder={contributionMode === "fixed" ? "e.g. 200.00" : "e.g. 10"}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    value={contributionValue}
                    onChangeText={setContributionValue}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </Field>

            <Field label="Savings goal" hint="optional — shows progress">
              <View style={[amt.inputWrap, { marginTop: spacing.xs, backgroundColor: colors.cardAlt, borderColor: goalAmount ? colors.accent : colors.border }]}>
                <Text style={[amt.symbol, { color: goalAmount ? colors.accent : colors.textMuted }]}>$</Text>
                <TextInput
                  style={[amt.input, { color: colors.textPrimary }]}
                  placeholder="e.g. 10,000 — or leave blank"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={goalAmount}
                  onChangeText={setGoalAmount}
                  returnKeyType="done"
                />
              </View>
            </Field>
          </>
        )}

        {/* ── Target budget (fixed / flexible only) ── */}
        {type !== "savings" && (
          <Field
            label={type === "fixed" ? "Target budget" : "Spending cap"}
            hint={type === "fixed" ? "required" : "optional"}
            hintRequired={type === "fixed"}
          >
            <TextInput
              style={[s.input, { marginTop: spacing.xs }]}
              placeholder={type === "fixed" ? "e.g. 1500.00" : "e.g. 300.00 — or leave blank"}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={targetBudget}
              onChangeText={setTargetBudget}
              returnKeyType="done"
            />
          </Field>
        )}

        {/* ── Budget frequency (fixed / flexible only) ── */}
        {type !== "savings" && (
          <Field label="Budget frequency" hint={type === "flexible" ? "optional" : null}>
            <View style={{ marginTop: spacing.xs }}>
              <SegmentedControl
                options={FREQUENCIES}
                value={targetFrequency}
                onChange={handleFrequencyChange}
                colors={colors}
                labelFn={capitalize}
              />
            </View>
          </Field>
        )}

        {/* ── Due day (weekly) ── */}
        {type !== "savings" && targetFrequency === "weekly" && (
          <Field
            label="Due day"
            hint={type === "fixed" ? "required" : "optional"}
            hintRequired={type === "fixed"}
          >
            <View style={[dayPicker.row, { marginTop: spacing.xs }]}>
              {DAYS_OF_WEEK.map(day => {
                const active = targetDate === day;
                return (
                  <TouchableOpacity
                    key={day}
                    style={[dayPicker.btn, {
                      backgroundColor: active ? colors.accent : colors.cardAlt,
                      borderColor:     active ? colors.accent : colors.border,
                    }]}
                    onPress={() => setTargetDate(day)}
                    activeOpacity={0.75}
                  >
                    <Text style={[dayPicker.text, { color: active ? "#fff" : colors.textSecondary }]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>
        )}

        {/* ── Due date (monthly / fortnightly) ── */}
        {type !== "savings" && targetFrequency !== "weekly" && (
          <Field
            label="Due date"
            hint={type === "fixed" ? "day of month (1–31) · required" : "day of month (1–31) · optional"}
            hintRequired={type === "fixed"}
          >
            <TextInput
              style={[s.input, { marginTop: spacing.xs }]}
              placeholder="e.g. 1 for the 1st, 22 for the 22nd"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={String(targetDate)}
              onChangeText={setTargetDate}
              returnKeyType="done"
            />
          </Field>
        )}

        {/* ── Rollover (fixed / flexible only — savings always rolls over) ── */}
        {type !== "savings" && (
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
        )}

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

      {/* ── Emoji picker modal ── */}
      <Modal
        visible={emojiPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEmojiPickerOpen(false)}
      >
        <TouchableOpacity
          style={emojiModal.backdrop}
          activeOpacity={1}
          onPress={() => setEmojiPickerOpen(false)}
        />
        <View style={[emojiModal.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[emojiModal.handle, { backgroundColor: colors.border }]} />
          <Text style={[emojiModal.title, { color: colors.textPrimary }]}>Choose an icon</Text>
          <FlatList
            data={EMOJI_OPTIONS}
            keyExtractor={item => item}
            numColumns={8}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  emojiModal.cell,
                  emoji === item && { backgroundColor: colors.accentSoft, borderRadius: radius.md },
                ]}
                onPress={() => { setEmoji(item); setEmojiPickerOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={emojiModal.cellEmoji}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: spacing.lg }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
  note:  { fontSize: typography.xs },
});

const typeCard = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    gap: 1,
  },
  third: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.xs,
  },
  icon:  { fontSize: 24 },
  label: { fontSize: typography.md, fontWeight: typography.heavy },
  desc:  { fontSize: 10, textAlign: "center", lineHeight: 14 },
});

const amt = StyleSheet.create({
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    height: 50,
    gap: spacing.sm,
  },
  symbol: { fontSize: typography.lg, fontWeight: typography.heavy },
  input:  { flex: 1, fontSize: typography.lg, fontWeight: typography.semibold },
});

const emojiField = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  emojiBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  emojiText: { fontSize: 24 },
  nameInput: { height: 50 },
  badge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    color: "#fff",
    lineHeight: 12,
  },
});

const emojiModal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing.xl,
    paddingBottom: 40,
    maxHeight: "55%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
    marginBottom: spacing.lg,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellEmoji: { fontSize: 28 },
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
  hint:  { fontSize: typography.xs },
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
  sub:   { fontSize: typography.sm, lineHeight: 18 },
});

const dayPicker = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.xs },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontSize: typography.xs, fontWeight: typography.bold },
});
