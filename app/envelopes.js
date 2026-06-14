// app/envelopes.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";
import { fmt } from "../lib/format";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Envelope card ─────────────────────────────────────────────────────────────

function EnvelopeCard({ env, onAllocate, onDetail, colors, sortMode, isFirst, isLast, onMoveUp, onMoveDown }) {
  const [inputVal, setInputVal] = useState("");
  const isFixed   = env.type === "fixed";
  const isSavings = env.type === "savings";
  const accentCol = isSavings ? colors.success   : isFixed ? colors.fixed     : colors.flexible;
  const accentBg  = isSavings ? colors.successBg : isFixed ? colors.fixedBg   : colors.flexibleBg;

  // Surplus = how much ahead of target (positive = ahead, negative = short)
  const surplus = env.target > 0 ? Number(env.amount) - Number(env.target) : null;

  // Savings: contribution label
  const contribLabel = isSavings
    ? (env.contributionPct > 0
        ? `${env.contributionPct}% per pay`
        : env.contributionAmount > 0
          ? `$${fmt(env.contributionAmount)} per pay`
          : null)
    : null;

  // Savings: goal progress
  const goalAmount = isSavings && env.goalAmount > 0 ? Number(env.goalAmount) : null;
  const goalPct    = goalAmount ? Math.min((Number(env.amount) / goalAmount) * 100, 100) : null;

  const handleAllocate = () => {
    const n = parseFloat(inputVal);
    if (isNaN(n) || n <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid amount", "Please enter a positive number.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAllocate(env.id, n);
    setInputVal("");
  };

  return (
    <View style={[card.wrap, { backgroundColor: colors.card, borderColor: sortMode ? colors.accent : colors.border }]}>

      {/* Sort mode controls */}
      {sortMode && (
        <View style={card.sortRow}>
          <View style={{ flex: 1 }}>
            <Text style={[card.sortName, { color: colors.textPrimary }]} numberOfLines={1}>
              {env.emoji ? `${env.emoji}  ` : ""}{env.name}
            </Text>
          </View>
          <View style={card.sortBtns}>
            <TouchableOpacity
              onPress={isFirst ? undefined : onMoveUp}
              activeOpacity={isFirst ? 1 : 0.6}
              style={[card.sortBtn, { backgroundColor: colors.cardAlt, opacity: isFirst ? 0.3 : 1 }]}
            >
              <Text style={[card.sortBtnText, { color: colors.textPrimary }]}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={isLast ? undefined : onMoveDown}
              activeOpacity={isLast ? 1 : 0.6}
              style={[card.sortBtn, { backgroundColor: colors.cardAlt, opacity: isLast ? 0.3 : 1 }]}
            >
              <Text style={[card.sortBtnText, { color: colors.textPrimary }]}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top row: name + amount — tappable to open detail */}
      {!sortMode && <TouchableOpacity
        style={card.topRow}
        onPress={() => onDetail(env)}
        activeOpacity={0.75}
      >
        <View style={{ flex: 1 }}>
          <View style={card.pills}>
            <View style={[card.pill, { backgroundColor: accentBg }]}>
              <Text style={[card.pillText, { color: accentCol }]}>
                {isSavings ? "Savings" : isFixed ? "Fixed" : "Flexible"}
              </Text>
            </View>
            {env.rollover && !isSavings && (
              <View style={[card.pill, { backgroundColor: colors.successBg }]}>
                <Text style={[card.pillText, { color: colors.success }]}>Rolls over</Text>
              </View>
            )}
            {surplus !== null && surplus > 0.005 && (
              <View style={[card.pill, { backgroundColor: colors.successBg }]}>
                <Text style={[card.pillText, { color: colors.success }]}>+${fmt(surplus)} ahead</Text>
              </View>
            )}
          </View>
          <Text style={[card.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {env.emoji ? `${env.emoji}  ` : ""}{env.name}
          </Text>
          {env.notes ? (
            <Text style={[card.notes, { color: colors.textMuted }]} numberOfLines={2}>
              {env.notes}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={[card.amountLabel, { color: colors.textSecondary }]}>
            {isSavings ? "Saved" : "Balance"}
          </Text>
          <Text style={[card.amount, { color: isSavings ? colors.success : env.amount <= 0 ? colors.danger : colors.textPrimary }]}>
            ${fmt(env.amount)}
          </Text>
          {isSavings && goalAmount ? (
            <Text style={[card.targetLabel, { color: colors.textMuted }]}>
              of ${fmt(goalAmount)} goal
            </Text>
          ) : !isSavings && env.target > 0 ? (
            <Text style={[card.targetLabel, { color: colors.textMuted }]}>
              of ${fmt(Number(env.target))} target
            </Text>
          ) : null}
          {isSavings && contribLabel ? (
            <Text style={[card.targetLabel, { color: colors.success }]}>
              +{contribLabel}
            </Text>
          ) : null}
          <Text style={[card.detailHint, { color: colors.textMuted }]}>Details ›</Text>
        </View>
      </TouchableOpacity>}

      {/* Progress bar + allocate (hidden in sort mode) */}
      {!sortMode && <>
        <View style={[card.track, { backgroundColor: colors.cardAlt }]}>
          <View
            style={[
              card.fill,
              {
                width: isSavings
                  ? goalPct !== null
                    ? `${goalPct}%`
                    : env.amount > 0 ? "35%" : "0%"
                  : env.target > 0
                    ? `${Math.min((env.amount / env.target) * 100, 100)}%`
                    : env.amount > 0 ? "100%" : "0%",
                backgroundColor: isSavings ? colors.success : env.amount <= 0 ? colors.danger : accentCol,
                opacity: 0.75,
              },
            ]}
          />
        </View>

        <View style={card.allocateRow}>
          <TextInput
            style={[card.input, {
              backgroundColor: colors.cardAlt,
              borderColor: colors.border,
              color: colors.textPrimary,
              flex: 1,
            }]}
            placeholder="Allocate $"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={inputVal}
            onChangeText={setInputVal}
            returnKeyType="done"
            onSubmitEditing={handleAllocate}
          />
          <TouchableOpacity
            style={[card.allocateBtn, { backgroundColor: colors.accent }]}
            onPress={handleAllocate}
            activeOpacity={0.8}
          >
            <Text style={card.allocateBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </>}

    </View>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Envelopes() {
  const router = useRouter();
  const { colors } = useTheme();

  const { state, allocateToEnvelope, reorderEnvelopes, total, allocated, unallocated } = useBudget();
  const s = makeStyles(colors);

  const [filter, setFilter] = useState("all");
  const [sortMode, setSortMode] = useState(false);

  const envelopes = state?.envelopes ?? [];

  const filtered = envelopes.filter(e => {
    if (filter === "fixed")    return e.type === "fixed";
    if (filter === "flexible") return e.type === "flexible";
    if (filter === "savings")  return e.type === "savings";
    return true;
  });

  const toggleSortMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!sortMode && filter !== "all") setFilter("all");
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSortMode(v => !v);
  };

  const moveEnvelope = (index, direction) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= envelopes.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = [...envelopes];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    reorderEnvelopes(next);
  };

  // ✅ Uses unallocated directly from context — no manual recalculation
  const handleAllocate = (envId, amount) => {
    if (amount > unallocated) {
      Alert.alert(
        "Not enough unallocated",
        `You only have $${fmt(unallocated)} free to allocate.`
      );
      return;
    }
    allocateToEnvelope(envId, amount);
  };

  const handleDetail = (env) => {
    if (sortMode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/envelope-detail", params: { id: env.id } });
  };

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Summary strip: Allocated / Unallocated / Total ── */}
      <View style={[summ.strip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Allocated</Text>
          <Text style={[summ.val, { color: colors.textPrimary }]}>
            ${fmt(allocated ?? 0)}
          </Text>
        </View>

        <View style={[summ.divider, { backgroundColor: colors.border }]} />

        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Unallocated</Text>
          <Text style={[summ.val, {
            color: unallocated < 0   ? colors.danger
                 : unallocated === 0 ? colors.success
                 :                     colors.warning,
          }]}>
            ${fmt(unallocated ?? 0)}
          </Text>
        </View>

        <View style={[summ.divider, { backgroundColor: colors.border }]} />

        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[summ.val, { color: colors.textPrimary }]}>
            ${fmt(total ?? 0)}
          </Text>
        </View>
      </View>

      {/* ── Filter tabs + New / Reorder button ── */}
      <View style={[filt.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {["all", "fixed", "flexible", "savings"].map(f => (
          <TouchableOpacity
            key={f}
            style={[
              filt.tab,
              filter === f && !sortMode && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}
            onPress={() => { if (!sortMode) setFilter(f); }}
            activeOpacity={0.8}
          >
            <Text style={[filt.tabText, {
              color:      filter === f && !sortMode ? colors.accent : colors.textSecondary,
              fontWeight: filter === f && !sortMode ? typography.bold : typography.regular,
            }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}

        {sortMode ? (
          <TouchableOpacity
            style={[filt.addBtn, { backgroundColor: colors.success, marginLeft: "auto" }]}
            onPress={toggleSortMode}
            activeOpacity={0.8}
          >
            <Text style={filt.addBtnText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <>
            {envelopes.length > 1 && (
              <TouchableOpacity
                style={[filt.reorderBtn, { borderColor: colors.border }]}
                onPress={toggleSortMode}
                activeOpacity={0.8}
              >
                <Text style={[filt.reorderBtnText, { color: colors.textSecondary }]}>⇅</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[filt.addBtn, { backgroundColor: colors.accent }]}
              onPress={() => router.push("/new-envelope")}
              activeOpacity={0.8}
            >
              <Text style={filt.addBtnText}>+ New</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Envelope list ── */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {(sortMode ? envelopes : filtered).length === 0 ? (
          <View style={empty.wrap}>
            <Text style={empty.icon}>✉️</Text>
            <Text style={[empty.title, { color: colors.textPrimary }]}>No envelopes yet</Text>
            <Text style={[empty.body, { color: colors.textSecondary }]}>
              Create your first envelope to start organising your money.
            </Text>
            <TouchableOpacity
              style={[s.primaryBtn, { marginTop: spacing.lg, paddingHorizontal: spacing.xl }]}
              onPress={() => router.push("/new-envelope")}
              activeOpacity={0.8}
            >
              <Text style={s.primaryBtnText}>Create envelope</Text>
            </TouchableOpacity>
          </View>
        ) : (
          (sortMode ? envelopes : filtered).map((env, idx, arr) => (
            <EnvelopeCard
              key={env.id}
              env={env}
              colors={colors}
              onAllocate={handleAllocate}
              onDetail={handleDetail}
              sortMode={sortMode}
              isFirst={idx === 0}
              isLast={idx === arr.length - 1}
              onMoveUp={() => moveEnvelope(idx, -1)}
              onMoveDown={() => moveEnvelope(idx, 1)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sortName: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  sortBtns: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sortBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sortBtnText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  pills: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
  },
  notes: {
    fontSize: typography.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  amountLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  amount: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  targetLabel: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  detailHint: {
    fontSize: typography.xs,
    marginTop: 6,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  allocateRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.md,
  },
  allocateBtn: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  allocateBtnText: {
    color: "#fff",
    fontWeight: typography.bold,
    fontSize: typography.md,
  },
});

const summ = StyleSheet.create({
  strip: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  col: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  val: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
  },
  divider: {
    width: 1,
    marginVertical: spacing.xs,
  },
});

const filt = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    height: 48,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.sm,
  },
  addBtn: {
    marginLeft: "auto",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  addBtnText: {
    color: "#fff",
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  reorderBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});


const empty = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  body: {
    fontSize: typography.md,
    textAlign: "center",
    lineHeight: 22,
  },
});
