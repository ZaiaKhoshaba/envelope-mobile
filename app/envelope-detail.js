// app/envelope-detail.js
// Tapping an envelope on the Envelopes tab opens this detail view.
// Supports left/right swipe to navigate between envelopes.

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";
import { fmt } from "../lib/format";
import EnvelopeInsights from "../components/EnvelopeInsights";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Transaction row ───────────────────────────────────────────────────────────

function TxRow({ t, envId, colors }) {
  const isIncome = t.kind === "income";

  const used = (t.allocations || [])
    .filter(a => a.sourceId === envId)
    .reduce((s, a) => s + (a.used || 0), 0);

  const displayAmount = isIncome ? `+$${fmt(used)}` : `-$${fmt(used)}`;
  const amountColor   = isIncome ? colors.success : colors.danger;
  const title         = t.merchant || t.description || (isIncome ? "Income" : "Spend");
  const dateStr       = formatDate(t.postedAt || t.createdAt);

  return (
    <View style={[txrow.wrap, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[txrow.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        {dateStr ? <Text style={[txrow.date, { color: colors.textMuted }]}>{dateStr}</Text> : null}
      </View>
      <Text style={[txrow.amount, { color: amountColor }]}>{displayAmount}</Text>
    </View>
  );
}

// ── Single envelope page content ──────────────────────────────────────────────

function EnvelopeContent({ env, state, deleteEnvelope, hasBankAccess, colors, s, router }) {
  const [activeTab, setActiveTab] = useState("transactions");

  const isFixed   = env.type === "fixed";
  const isSavings = env.type === "savings";
  const accentCol = isSavings ? colors.success   : isFixed ? colors.fixed     : colors.flexible;
  const accentBg  = isSavings ? colors.successBg : isFixed ? colors.fixedBg   : colors.flexibleBg;

  const balance    = Number(env.amount     || 0);
  const target     = Number(env.target     || 0);
  const goalAmount = Number(env.goalAmount || 0);

  const progressTarget = isSavings ? goalAmount : target;
  const progress = progressTarget > 0 ? Math.min(1, balance / progressTarget) : null;
  const surplus  = !isSavings && target > 0 ? balance - target : null;

  const contribLabel = isSavings
    ? env.contributionPct  > 0 ? `${env.contributionPct}% per pay`
    : env.contributionAmount > 0 ? `$${fmt(env.contributionAmount)} per pay`
    : null
    : null;

  const envTxs = useMemo(() => {
    const relevant = state.transactions.filter(t =>
      (t.allocations || []).some(a => a.sourceId === env.id)
    );
    return [...relevant].sort((a, b) => {
      const at = new Date(a.postedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.postedAt || b.createdAt || 0).getTime();
      return bt - at;
    });
  }, [state.transactions, env.id]);

  const totalSpent = useMemo(() =>
    envTxs
      .filter(t => t.kind === "spend")
      .reduce((sum, t) =>
        sum + (t.allocations || [])
          .filter(a => a.sourceId === env.id)
          .reduce((s, a) => s + (a.used || 0), 0),
        0),
  [envTxs, env.id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      "Delete envelope?",
      `${env.name} will be removed and its $${fmt(balance)} balance returned to unallocated.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteEnvelope(env.id);
            router.back();
          },
        },
      ]
    );
  }, [env, balance, deleteEnvelope, router]);

  const handleMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(env.name, undefined, [
      { text: "Edit envelope", onPress: () => router.push({ pathname: "/edit-envelope", params: { id: env.id } }) },
      { text: "Delete envelope", style: "destructive", onPress: handleDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [env, router, handleDelete]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
      // Keep vertical scroll from interfering with horizontal paging
      scrollEventThrottle={16}
    >

      {/* ── Header card ── */}
      <View style={[hdr.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* Emoji + name */}
        <View style={hdr.nameRow}>
          {env.emoji ? (
            <Text style={hdr.emoji}>{env.emoji}</Text>
          ) : (
            <View style={[hdr.emojiPlaceholder, { backgroundColor: accentBg }]}>
              <Text style={{ fontSize: 22 }}>✉️</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[hdr.name, { color: colors.textPrimary }]}>{env.name}</Text>
            <View style={hdr.pills}>
              <View style={[hdr.pill, { backgroundColor: accentBg }]}>
                <Text style={[hdr.pillText, { color: accentCol }]}>
                  {isSavings ? "Savings" : isFixed ? "Fixed" : "Flexible"}
                </Text>
              </View>
              {env.rollover && !isSavings && (
                <View style={[hdr.pill, { backgroundColor: colors.cardAlt, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[hdr.pillText, { color: colors.textSecondary }]}>Rolls over</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleMenu} activeOpacity={0.7} style={hdr.menuBtn}>
            <Text style={[hdr.menuDots, { color: colors.textSecondary }]}>⋯</Text>
          </TouchableOpacity>
        </View>

        {/* Notes */}
        {env.notes ? (
          <Text style={[hdr.notes, { color: colors.textSecondary }]}>{env.notes}</Text>
        ) : null}

        {/* Balance */}
        <View>
          <Text style={[hdr.balLabel, { color: colors.textSecondary }]}>
            {isSavings ? "SAVED" : "BALANCE"}
          </Text>
          <Text style={[hdr.balValue, { color: isSavings ? colors.success : colors.textPrimary }]}>
            ${fmt(balance)}
          </Text>
        </View>

        {/* Savings info */}
        {isSavings && (contribLabel || goalAmount > 0) && (
          <View style={[hdr.savingsInfo, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
            {contribLabel && (
              <View style={hdr.savingsRow}>
                <Text style={[hdr.savingsKey, { color: colors.success }]}>Contribution</Text>
                <Text style={[hdr.savingsVal, { color: colors.success }]}>+{contribLabel}</Text>
              </View>
            )}
            {goalAmount > 0 && (
              <View style={hdr.savingsRow}>
                <Text style={[hdr.savingsKey, { color: colors.success }]}>Goal</Text>
                <Text style={[hdr.savingsVal, { color: colors.success }]}>
                  ${fmt(balance)} of ${fmt(goalAmount)} ({Math.round((balance / goalAmount) * 100)}%)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Progress bar */}
        {progress !== null && (
          <View style={{ gap: spacing.xs }}>
            <View style={[hdr.track, { backgroundColor: colors.cardAlt }]}>
              <View style={[
                hdr.fill,
                { width: `${progress * 100}%`, backgroundColor: progress >= 1 ? colors.success : accentCol },
              ]} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: typography.xs, color: colors.textMuted }}>
                {Math.round(progress * 100)}% of ${fmt(progressTarget)} {isSavings ? "goal" : "target"}
              </Text>
              {surplus !== null && surplus > 0.005 && (
                <Text style={{ fontSize: typography.xs, color: colors.success, fontWeight: typography.semibold }}>
                  +${fmt(surplus)} ahead
                </Text>
              )}
              {surplus !== null && surplus < -0.005 && (
                <Text style={{ fontSize: typography.xs, color: colors.warning, fontWeight: typography.semibold }}>
                  ${fmt(Math.abs(surplus))} to go
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Spend summary */}
        {totalSpent > 0 && (
          <View style={[hdr.spendSummary, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
            <Text style={{ fontSize: typography.sm, color: colors.textSecondary }}>
              💸  ${fmt(totalSpent)} spent from this envelope
            </Text>
          </View>
        )}
      </View>

      {/* ── Quick actions ── */}
      <View style={qa.row}>
        <TouchableOpacity
          style={[qa.btn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/edit-envelope", params: { id: env.id } }); }}
          activeOpacity={0.8}
        >
          <Text style={qa.icon}>✏️</Text>
          <Text style={[qa.label, { color: colors.textPrimary }]}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[qa.btn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: "/transfer", params: { fromId: env.id } }); }}
          activeOpacity={0.8}
        >
          <Text style={qa.icon}>⇄</Text>
          <Text style={[qa.label, { color: colors.accent }]}>Transfer</Text>
        </TouchableOpacity>

        {hasBankAccess ? (
          <TouchableOpacity
            style={[qa.btn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/transactions"); }}
            activeOpacity={0.8}
          >
            <Text style={qa.icon}>🧾</Text>
            <Text style={[qa.label, { color: colors.textPrimary }]}>History</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[qa.btn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-spend"); }}
            activeOpacity={0.8}
          >
            <Text style={qa.icon}>💸</Text>
            <Text style={[qa.label, { color: colors.danger }]}>Spend</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={[tabs.row, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
        {["transactions", "insights"].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[tabs.btn, activeTab === tab && { backgroundColor: colors.accent }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
            activeOpacity={0.8}
          >
            <Text style={[tabs.label, { color: activeTab === tab ? "#fff" : colors.textSecondary }]}>
              {tab === "transactions" ? "Transactions" : "Insights"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Transactions tab ── */}
      {activeTab === "transactions" && (
        <View>
          {envTxs.length === 0 ? (
            <View style={[empty.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={empty.icon}>🧾</Text>
              <Text style={[empty.text, { color: colors.textSecondary }]}>
                No transactions yet.{"\n"}Spends allocated to this envelope will appear here.
              </Text>
            </View>
          ) : (
            <View style={[txlist.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {envTxs.map((t, i) => (
                <TxRow key={t.id ?? i} t={t} envId={env.id} colors={colors} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Insights tab ── */}
      {activeTab === "insights" && (
        <EnvelopeInsights env={env} transactions={state.transactions} />
      )}

    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function EnvelopeDetailScreen() {
  const router = useRouter();
  const { id }  = useLocalSearchParams();
  const { state, deleteEnvelope } = useBudget();
  const { hasBankAccess } = usePurchase();
  const { colors } = useTheme();
  const s = makeStyles(colors);
  // Reactive to the current window size — a one-time Dimensions.get() snapshot
  // goes stale on web when the viewport size at first load differs from the
  // actual rendered size, causing every page in this pager to be sized wrong
  // and clipped at both edges.
  const { width: SCREEN_W } = useWindowDimensions();

  const envelopes = state.envelopes;
  const initialIndex = Math.max(0, envelopes.findIndex(e => e.id === id));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const scrollRef = useRef(null);

  // Snap to the correct starting envelope without an animation flash
  useEffect(() => {
    if (scrollRef.current && initialIndex > 0) {
      // Small timeout ensures the layout is complete before scrolling
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
      }, 0);
      return () => clearTimeout(t);
    }
  }, []);

  if (envelopes.length === 0) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>No envelopes found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleMomentumScrollEnd = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== currentIndex) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(idx);
    }
  };

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Dot indicator (only when >1 envelope) ── */}
      {envelopes.length > 1 && (
        <View style={swipe.dotsRow}>
          {envelopes.map((_, i) => (
            <View
              key={i}
              style={[
                swipe.dot,
                { backgroundColor: i === currentIndex ? colors.accent : colors.border },
                i === currentIndex && swipe.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── Horizontal pager ── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        directionalLockEnabled
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {envelopes.map(env => (
          <View key={env.id} style={{ width: SCREEN_W, flex: 1 }}>
            <EnvelopeContent
              env={env}
              state={state}
              deleteEnvelope={deleteEnvelope}
              hasBankAccess={hasBankAccess}
              colors={colors}
              s={s}
              router={router}
            />
          </View>
        ))}
      </ScrollView>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const swipe = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
  },
});

const hdr = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  menuBtn: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuDots: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24,
  },
  emoji: {
    fontSize: 40,
  },
  emojiPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  pills: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: 4,
    flexWrap: "wrap",
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
  notes: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  balLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  balValue: {
    fontSize: typography.hero,
    fontWeight: typography.heavy,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  spendSummary: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  savingsInfo: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  savingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savingsKey: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  savingsVal: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

const qa = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  icon: { fontSize: 22 },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
});

const txrow = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  date: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.md,
    fontWeight: typography.heavy,
    minWidth: 72,
    textAlign: "right",
  },
});

const txlist = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
});

const empty = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  icon: { fontSize: 36 },
  text: {
    fontSize: typography.sm,
    textAlign: "center",
    lineHeight: 20,
  },
});

const tabs = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});
