// app/index.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  RefreshControl,
  AppState,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useBudget, buildProportionalPlans } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";
import { getEnvelopeDueDate, projectedIncomeBeforeDate } from "../lib/budgetMath";
import { fmt } from "../lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function timeAgo(ts) {
  if (!ts) return "just now";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * For each fixed envelope, calculate its proportional shortfall based on
 * projected income before its due date, split proportionally across all
 * fixed commitments. Due-date and forecasting maths live in lib/budgetMath.js.
 *
 * Returns an array of analysis objects — one per fixed envelope with a target.
 */

function getProportionalAnalysis(envelopes, incomeSchedule) {
  const fixedEnvs = envelopes.filter(e => e.type === "fixed" && Number(e.target) > 0);
  if (!fixedEnvs.length) return [];
  const totalTarget = fixedEnvs.reduce((sum, e) => sum + Number(e.target), 0);

  return fixedEnvs.map(env => {
    const proportion     = Number(env.target) / totalTarget;
    const dueDate        = getEnvelopeDueDate(env);
    const projectedTotal = incomeSchedule?.amount && dueDate
      ? projectedIncomeBeforeDate(incomeSchedule, dueDate)
      : 0;
    const proportionalIncome = projectedTotal * proportion;
    const totalAvailable     = Number(env.amount || 0) + proportionalIncome;
    const shortfall          = Math.max(0, Number(env.target) - totalAvailable);
    return { env, proportion, projectedTotal, proportionalIncome, shortfall, isUnderfunded: shortfall > 0.005 };
  });
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, valueColor, flex = 1 }) {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  return (
    <View style={[s.card, { flex, minHeight: 80 }]}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.bigValue, { fontSize: typography.xl, color: valueColor ?? colors.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}

// ── Quick action button ───────────────────────────────────────────────────────

function QuickActionBtn({ label, icon, onPress, color }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.qaBtn, { backgroundColor: color ?? colors.card, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      activeOpacity={0.75}
    >
      <Text style={styles.qaIcon}>{icon}</Text>
      <Text style={[styles.qaLabel, { color: colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Envelope preview row ──────────────────────────────────────────────────────

function EnvelopePreviewRow({ env, colors, analysis }) {
  const isFixed   = env.type === "fixed";
  const isSavings = env.type === "savings";
  const pct       = isSavings
    ? (env.goalAmount > 0 ? Math.min(Number(env.amount) / Number(env.goalAmount), 1) : env.amount > 0 ? 0.35 : 0)
    : env.target > 0 ? Math.min(env.amount / env.target, 1) : 0;
  const item        = analysis?.find(a => a.env.id === env.id);
  const underfunded = item?.isUnderfunded ?? false;
  const pillBg    = isSavings ? colors.successBg : isFixed ? colors.fixedBg  : colors.flexibleBg;
  const pillTxt   = isSavings ? colors.success   : isFixed ? colors.fixed    : colors.flexible;
  const fillColor = isSavings ? colors.success   : isFixed ? colors.fixed    : colors.flexible;

  return (
    <View style={[styles.envRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        {/* Name + type pill + warning */}
        <View style={styles.envTop}>
          <Text style={[styles.envName, { color: colors.textPrimary }]} numberOfLines={1}>
            {env.emoji ? `${env.emoji}  ` : ""}{env.name}
          </Text>
          {underfunded && (
            <Text style={styles.warnIcon}>⚠️</Text>
          )}
          <View style={[styles.pill, { backgroundColor: pillBg }]}>
            <Text style={[styles.pillText, { color: pillTxt }]}>
              {isSavings ? "Savings" : isFixed ? "Fixed" : "Flexible"}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.track, { backgroundColor: colors.cardAlt }]}>
          <View
            style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: fillColor }]}
          />
        </View>

        {/* Balance vs target */}
        {env.target > 0 && (
          <Text style={[styles.envTargetText, { color: colors.textMuted }]}>
            ${fmt(env.amount)} of ${fmt(Number(env.target))}
          </Text>
        )}
      </View>

      {/* Balance */}
      <Text style={[styles.envAmount, { color: colors.textPrimary }]}>
        ${fmt(env.amount)}
      </Text>
    </View>
  );
}

// ── Overallocated warning ─────────────────────────────────────────────────────
// Shown when envelopes hold more money than actually exists — the single most
// important signal in envelope budgeting. Never hide this.

function OverallocatedWarning({ amount, onPress, colors }) {
  if (!amount || amount <= 0) return null;
  return (
    <TouchableOpacity
      style={[nudge.wrap, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={nudge.icon}>🚨</Text>
      <View style={{ flex: 1 }}>
        <Text style={[nudge.title, { color: colors.danger }]}>
          Budgeted ${fmt(amount)} more than you have
        </Text>
        <Text style={[nudge.sub, { color: colors.danger }]}>
          Your envelopes hold money that isn't in your balance. Move funds out or add income.
        </Text>
      </View>
      <Text style={[nudge.arrow, { color: colors.danger }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── Unallocated nudge ─────────────────────────────────────────────────────────

function UnallocatedNudge({ amount, onPress, colors }) {
  if (amount <= 0) return null;
  return (
    <TouchableOpacity
      style={[nudge.wrap, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={nudge.icon}>💡</Text>
      <View style={{ flex: 1 }}>
        <Text style={[nudge.title, { color: colors.accent }]}>
          ${fmt(amount)} sitting idle
        </Text>
        <Text style={[nudge.sub, { color: colors.accent }]}>
          Assign it to an envelope so every dollar has a job
        </Text>
      </View>
      <Text style={[nudge.arrow, { color: colors.accent }]}>›</Text>
    </TouchableOpacity>
  );
}

// ── Underfunded warning ───────────────────────────────────────────────────────

function UnderfundedWarning({ analysis, onPress, colors }) {
  const [expanded, setExpanded] = React.useState(false);
  const underfunded = (analysis || []).filter(a => a.isUnderfunded);
  if (underfunded.length === 0) return null;

  const totalShortfall = underfunded.reduce((sum, a) => sum + a.shortfall, 0);

  return (
    <View style={[warn.wrap, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
      {/* Header — taps through to envelopes page */}
      <TouchableOpacity style={warn.headerRow} onPress={onPress} activeOpacity={0.8}>
        <Text style={warn.icon}>🔴</Text>
        <View style={{ flex: 1 }}>
          <Text style={[warn.title, { color: colors.danger }]}>
            {underfunded.length} fixed envelope{underfunded.length !== 1 ? "s" : ""} need{underfunded.length === 1 ? "s" : ""} funding
          </Text>
          <Text style={[warn.totalShortfall, { color: colors.danger }]}>
            Total shortfall: ${fmt(totalShortfall)}
          </Text>
        </View>
        <Text style={[warn.arrow, { color: colors.danger }]}>›</Text>
      </TouchableOpacity>

      {/* Expand / collapse */}
      {expanded ? (
        <View style={warn.list}>
          {underfunded.map(({ env, shortfall }) => (
            <Text key={env.id} style={[warn.item, { color: colors.danger }]}>
              {env.emoji ? `${env.emoji} ` : ""}{env.name} — short ${fmt(shortfall)}
            </Text>
          ))}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(false); }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[warn.more, { color: colors.danger }]}>Show less ▲</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={{ paddingHorizontal: spacing.xs, paddingBottom: spacing.xs }}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded(true); }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[warn.more, { color: colors.danger }]}>
            Tap to see all {underfunded.length} ▼
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Allocation plan card ──────────────────────────────────────────────────────
// Shows users exactly how each pay will be split and whether income covers all
// fixed commitments — so they never have to guess where their money is going.

function AllocationPlanCard({ analysis, incomeSchedule, colors }) {
  if (!analysis?.length || !incomeSchedule?.amount) return null;

  const payAmount   = incomeSchedule.amount;
  const totalTarget = analysis.reduce((s, a) => s + Number(a.env.target), 0);
  const totalProjected = analysis.reduce((s, a) => s + a.projectedTotal, 0) / analysis.length; // avg
  const hasShortfall = analysis.some(a => a.isUnderfunded);

  // Per-pay allocation for each envelope
  const plans = buildProportionalPlans(payAmount, analysis.map(a => a.env));

  return (
    <View style={[plan.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={plan.header}>
        <Text style={[plan.title, { color: colors.textPrimary }]}>💼 Allocation plan</Text>
        <Text style={[plan.sub, { color: colors.textSecondary }]}>
          How each ${fmt(payAmount)} pay is split
        </Text>
      </View>

      {/* Per-envelope rows */}
      {plans.map(p => {
        const item = analysis.find(a => a.env.id === p.envId);
        if (!item) return null;
        const { env, proportion } = item;
        return (
          <View key={env.id} style={[plan.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[plan.envName, { color: colors.textPrimary }]} numberOfLines={1}>
                {env.emoji ? `${env.emoji}  ` : ""}{env.name}
              </Text>
              <Text style={[plan.envMeta, { color: colors.textMuted }]}>
                {(proportion * 100).toFixed(1)}% of fixed commitments
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[plan.alloc, { color: colors.accent }]}>
                +${fmt(p.allocation)}/pay
              </Text>
              <Text style={[plan.envMeta, { color: colors.textMuted }]}>
                of ${fmt(Number(env.target))} target
              </Text>
            </View>
          </View>
        );
      })}

      {/* Summary footer — only show the positive case; shortfall is surfaced by UnderfundedWarning above */}
      {!hasShortfall && (
        <View style={[plan.footer, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Text style={[plan.footerText, { color: colors.accent }]}>
            ✓  Your scheduled income covers all fixed commitments.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Setup checklist ───────────────────────────────────────────────────────────

function SetupChecklist({ state, router, colors }) {
  const hasIncome        = state.transactions.some(t => t.kind === "income");
  const step1Done        = hasIncome;
  const hasSchedule      = !!(state.incomeSchedule?.amount && state.incomeSchedule?.frequency);
  const hasEnvelope      = state.envelopes.length > 0;
  const hasAllocated     = state.envelopes.some(e => Number(e.amount) > 0);
  const TOTAL_STEPS      = 4;

  if (step1Done && hasSchedule && hasEnvelope && hasAllocated) return null;

  const doneCount = [step1Done, hasSchedule, hasEnvelope, hasAllocated].filter(Boolean).length;

  const steps = [
    {
      label:   "Enter your bank balance",
      sub:     "Add what's currently in your bank so every dollar is ready to allocate",
      done:    step1Done,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-income"); },
    },
    {
      label:   "Set up income schedule",
      sub:     "Tell us when and how often you get paid",
      done:    hasSchedule,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/income-schedule"); },
    },
    {
      label:   "Set up an envelope",
      sub:     "Create a bucket for your money to live in",
      done:    hasEnvelope,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/new-envelope"); },
    },
    {
      label:   "Allocate your funds",
      sub:     "Move money into your envelopes",
      done:    hasAllocated,
      onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/envelopes"); },
    },
  ];

  return (
    <View style={[setup.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={setup.header}>
        <View>
          <Text style={[setup.title, { color: colors.textPrimary }]}>Get started</Text>
          <Text style={[setup.sub, { color: colors.textSecondary }]}>{doneCount} of {TOTAL_STEPS} steps complete</Text>
        </View>
        <View style={[setup.badge, { backgroundColor: colors.accentSoft }]}>
          <Text style={[setup.badgeText, { color: colors.accent }]}>{doneCount}/{TOTAL_STEPS}</Text>
        </View>
      </View>

      <View style={[setup.track, { backgroundColor: colors.cardAlt }]}>
        <View style={[setup.fill, { width: `${(doneCount / TOTAL_STEPS) * 100}%`, backgroundColor: colors.accent }]} />
      </View>

      {steps.map((step, i) => (
        <TouchableOpacity
          key={i}
          style={[
            setup.step,
            i < steps.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            step.done && { opacity: 0.5 },
          ]}
          onPress={step.done ? null : step.onPress}
          activeOpacity={step.done ? 1 : 0.7}
        >
          <View style={[
            setup.circle,
            { borderColor: step.done ? colors.success : colors.border,
              backgroundColor: step.done ? colors.successBg : "transparent" },
          ]}>
            {step.done
              ? <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}>✓</Text>
              : <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>{i + 1}</Text>
            }
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[setup.stepLabel, {
              color: step.done ? colors.textSecondary : colors.textPrimary,
              textDecorationLine: step.done ? "line-through" : "none",
            }]}>
              {step.label}
            </Text>
            {!step.done && (
              <Text style={[setup.stepSub, { color: colors.textSecondary }]}>{step.sub}</Text>
            )}
          </View>
          {!step.done && <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Home() {
  const router  = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const { total, allocated, unallocated, overallocated, state, bankBalance, lastBalanceSync, refreshBankBalance } = useBudget();
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated]);

  // Keep the bank balance fresh: pull-to-refresh, on screen focus, and when the
  // app returns to the foreground (e.g. after a "transactions synced" alert).
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBankBalance();
    setRefreshing(false);
  }, [refreshBankBalance]);

  useFocusEffect(
    useCallback(() => {
      if (bankBalance != null) refreshBankBalance();
    }, [bankBalance, refreshBankBalance])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active" && bankBalance != null) refreshBankBalance();
    });
    return () => sub.remove();
  }, [bankBalance, refreshBankBalance]);

  if (loading || !isAuthenticated) return null;

  const envelopes   = state?.envelopes ?? [];
  const fixedEnvs   = envelopes.filter(e => e.type === "fixed").slice(0, 2);
  const flexEnvs    = envelopes.filter(e => e.type === "flexible").slice(0, 2);
  const savingsEnvs = envelopes.filter(e => e.type === "savings").slice(0, 2);
  const previewEnvs = [...fixedEnvs, ...flexEnvs, ...savingsEnvs];

  const allocatedPct = total > 0 ? Math.round((allocated / total) * 100) : 0;

  // Use firstName field if available (new accounts), fall back to splitting display name
  const firstName = user?.firstName || (user?.name ? user.name.split(" ")[0] : null);

  // Proportional analysis — computed once, shared by warning + preview rows + plan card
  const analysis = getProportionalAnalysis(envelopes, state.incomeSchedule);

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.screen]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} />
        }
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Good {getTimeOfDay()}{firstName ? `, ${firstName}` : ""} 👋
            </Text>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>Tend</Text>
          </View>
          <TouchableOpacity
            style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={toggle}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Setup checklist ── */}
        <SetupChecklist state={state} router={router} colors={colors} />

        {/* ── Balance hero card ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.accent }]}>
          <Text style={styles.heroLabel}>Total balance</Text>
          <Text style={styles.heroValue}>${fmt(total)}</Text>
          {bankBalance != null && (
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: typography.xs, marginTop: 4, marginBottom: 2 }}>
              {refreshing ? "Updating…" : `Synced ${timeAgo(lastBalanceSync)} · pull down to refresh`}
            </Text>
          )}
          <View style={styles.heroBarTrack}>
            <View style={[styles.heroBarFill, { width: `${allocatedPct}%` }]} />
          </View>
          <View style={styles.heroBarLabels}>
            <Text style={styles.heroBarText}>Allocated {allocatedPct}%</Text>
            <Text style={styles.heroBarText}>Free {100 - allocatedPct}%</Text>
          </View>
        </View>

        {/* ── Summary row ── */}
        <View style={s.cardRow}>
          <SummaryCard
            label="Allocated"
            value={`$${fmt(allocated)}`}
            valueColor={colors.accent}
          />
          <SummaryCard
            label="Unallocated"
            value={`$${fmt(unallocated)}`}
            valueColor={
              unallocated < 0   ? colors.danger   // overspent → red
            : unallocated === 0 ? colors.success  // fully assigned → green ✓
            :                     colors.warning  // idle money → amber, needs action
            }
          />
        </View>

        {/* ── Overallocated warning — never hidden ── */}
        <OverallocatedWarning
          amount={overallocated}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/envelopes"); }}
          colors={colors}
        />

        {/* ── Unallocated nudge ── */}
        <UnallocatedNudge
          amount={unallocated}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/envelopes"); }}
          colors={colors}
        />

        {/* ── Underfunded fixed envelopes warning ── */}
        <UnderfundedWarning
          analysis={analysis}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/envelopes"); }}
          colors={colors}
        />

        {/* ── Allocation plan card ── */}
        <AllocationPlanCard
          analysis={analysis}
          incomeSchedule={state.incomeSchedule}
          colors={colors}
        />

        {/* ── Quick actions ── */}
        <View>
          <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: spacing.md }]}>Quick actions</Text>
          <View style={styles.qaGrid}>
            <QuickActionBtn icon="💰" label="Add income" onPress={() => router.push("/add-income")} />
            <QuickActionBtn icon="💸" label="Add spend"  onPress={() => router.push("/add-spend")} />
            <QuickActionBtn   icon="✉️" label="New envelope" onPress={() => router.push("/new-envelope")} />
            <QuickActionBtn   icon="📅" label="Pay schedule" onPress={() => router.push("/income-schedule")} />
            <QuickActionBtn   icon="🔄" label="Cycle"        onPress={() => router.push("/cycle")} />
            <QuickActionBtn   icon="🧾" label="Transactions" onPress={() => router.push("/transactions")} />
          </View>
        </View>

        {/* ── Envelope preview ── */}
        {previewEnvs.length > 0 && (
          <View>
            <View style={styles.sectionRow}>
              <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Envelopes</Text>
              <TouchableOpacity onPress={() => router.push("/envelopes")}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>See all →</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.card, { padding: 0, overflow: "hidden", marginTop: spacing.sm }]}>
              {previewEnvs.map(env => (
                <EnvelopePreviewRow key={env.id} env={env} colors={colors} analysis={analysis} />
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
  appName: {
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
    marginTop: 2,
  },
  themeToggle: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: typography.sm,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  heroValue: {
    color: "#fff",
    fontSize: typography.hero,
    fontWeight: typography.heavy,
    marginBottom: spacing.lg,
  },
  heroBarTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: radius.pill,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  heroBarFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: radius.pill,
  },
  heroBarLabels: { flexDirection: "row", justifyContent: "space-between" },
  heroBarText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },

  qaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  qaBtn: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  qaIcon:  { fontSize: 26 },
  qaLabel: { fontSize: typography.xs, fontWeight: typography.semibold, textAlign: "center" },

  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  seeAll: { fontSize: typography.sm, fontWeight: typography.semibold },

  envRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  envTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  envName: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    flex: 1,
  },
  warnIcon: { fontSize: 13 },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: { fontSize: typography.xs, fontWeight: typography.bold },
  track: { height: 4, borderRadius: radius.pill, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: radius.pill },
  envTargetText: { fontSize: typography.xs, marginTop: 4 },
  envAmount: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    minWidth: 70,
    textAlign: "right",
  },
});

const nudge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon:  { fontSize: 20 },
  title: { fontSize: typography.sm, fontWeight: typography.bold },
  sub:   { fontSize: typography.xs, marginTop: 2, opacity: 0.85 },
  arrow: { fontSize: 20, fontWeight: typography.bold },
});

const warn = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  icon:  { fontSize: 14 },
  title: { fontSize: typography.sm, fontWeight: typography.bold, flex: 1 },
  arrow: { fontSize: 18, fontWeight: typography.bold },
  list:          { gap: 4, paddingLeft: spacing.xs },
  item:          { fontSize: typography.xs, opacity: 0.9 },
  totalShortfall:{ fontSize: typography.xs, fontWeight: typography.bold, marginTop: 2, opacity: 0.85 },
  more:          { fontSize: typography.xs, fontWeight: typography.bold, marginTop: 2, textDecorationLine: "underline" },
});

const plan = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  header: {
    padding: spacing.lg,
    gap: 2,
  },
  title: { fontSize: typography.md, fontWeight: typography.heavy },
  sub:   { fontSize: typography.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  envName: { fontSize: typography.sm, fontWeight: typography.semibold },
  envMeta: { fontSize: typography.xs, marginTop: 1 },
  alloc:   { fontSize: typography.sm, fontWeight: typography.bold },
  footer: {
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  footerText: { fontSize: typography.xs, fontWeight: typography.medium, lineHeight: 18 },
});

const setup = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:  { fontSize: typography.lg, fontWeight: typography.heavy },
  sub:    { fontSize: typography.xs, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: typography.sm, fontWeight: typography.bold },
  track: { height: 4, borderRadius: radius.pill, overflow: "hidden" },
  fill:  { height: "100%", borderRadius: radius.pill },
  step: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontSize: typography.sm, fontWeight: typography.semibold },
  stepSub:   { fontSize: typography.xs, marginTop: 2 },
});
