// app/index.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";

// ── Small reusable components ─────────────────────────────────────────────────

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

function EnvelopePreviewRow({ env, colors }) {
  const pct = env.target > 0 ? Math.min(env.amount / env.target, 1) : 0;
  const isFixed = env.type === "fixed";
  const pillBg  = isFixed ? colors.fixedBg   : colors.flexibleBg;
  const pillTxt = isFixed ? colors.fixed      : colors.flexible;

  return (
    <View style={[styles.envRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        {/* Name + type pill */}
        <View style={styles.envTop}>
          <Text style={[styles.envName, { color: colors.textPrimary }]} numberOfLines={1}>
            {env.name}
          </Text>
          <View style={[styles.pill, { backgroundColor: pillBg }]}>
            <Text style={[styles.pillText, { color: pillTxt }]}>
              {isFixed ? "Fixed" : "Flexible"}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.track, { backgroundColor: colors.cardAlt }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(pct * 100)}%`,
                backgroundColor: isFixed ? colors.fixed : colors.flexible,
                opacity: isFixed ? 0.85 : 1,
              },
            ]}
          />
        </View>
      </View>

      {/* Amount */}
      <Text style={[styles.envAmount, { color: colors.textPrimary }]}>
        ${env.amount.toFixed(2)}
      </Text>
    </View>
  );
}

// ── Setup checklist ───────────────────────────────────────────────────────────
// 3 steps that adapt based on whether the user has bank access or not.
// Disappears once all steps are complete. Derived from state — no storage needed.

function SetupChecklist({ state, router, colors, hasBankAccess }) {
  // Step 1 detection
  const hasBankSynced = hasBankAccess && state.transactions.some(t => t.imported);
  const hasIncome     = state.transactions.some(t => t.kind === "income");
  const step1Done     = hasBankAccess ? hasBankSynced : hasIncome;

  // Step 2: any envelope created
  const hasEnvelope   = state.envelopes.length > 0;

  // Step 3: any envelope has funds allocated to it
  const hasAllocated  = state.envelopes.some(e => Number(e.amount) > 0);

  if (step1Done && hasEnvelope && hasAllocated) return null;

  const doneCount = [step1Done, hasEnvelope, hasAllocated].filter(Boolean).length;

  const steps = [
    hasBankAccess
      ? {
          label:   "Connect your bank",
          sub:     "Sync your transactions automatically",
          done:    step1Done,
          onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/bank-connect"); },
        }
      : {
          label:   "Add your income",
          sub:     "Tell the app how much you get paid",
          done:    step1Done,
          onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-income"); },
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
      {/* Header */}
      <View style={setup.header}>
        <View>
          <Text style={[setup.title, { color: colors.textPrimary }]}>Get started</Text>
          <Text style={[setup.sub, { color: colors.textSecondary }]}>
            {doneCount} of 3 steps complete
          </Text>
        </View>
        <View style={[setup.badge, { backgroundColor: colors.accentSoft }]}>
          <Text style={[setup.badgeText, { color: colors.accent }]}>{doneCount}/3</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[setup.track, { backgroundColor: colors.cardAlt }]}>
        <View style={[setup.fill, { width: `${(doneCount / 3) * 100}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Steps */}
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
              color:           step.done ? colors.textSecondary : colors.textPrimary,
              textDecorationLine: step.done ? "line-through" : "none",
            }]}>
              {step.label}
            </Text>
            {!step.done && (
              <Text style={[setup.stepSub, { color: colors.textSecondary }]}>{step.sub}</Text>
            )}
          </View>
          {!step.done && (
            <Text style={{ color: colors.textMuted, fontSize: 18 }}>›</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Home() {
  const router  = useRouter();
  const { colors, isDark, toggle } = useTheme();
  const { total, allocated, unallocated, state } = useBudget();
  const { isAuthenticated, loading, user } = useAuth();
  const { daysRemaining, isSubscribed, hasBankAccess } = usePurchase();

  // Login guard
  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const envelopes  = state?.envelopes ?? [];
  const fixedEnvs  = envelopes.filter(e => e.type === "fixed").slice(0, 3);
  const flexEnvs   = envelopes.filter(e => e.type === "flexible").slice(0, 3);
  const previewEnvs = [...fixedEnvs, ...flexEnvs];

  const allocatedPct = total > 0 ? Math.round((allocated / total) * 100) : 0;
  const firstName    = user?.name ? user.name.split(" ")[0] : null;

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={[s.screen]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Good {getTimeOfDay()}{firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>
              Envelopes
            </Text>
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
        <SetupChecklist state={state} router={router} colors={colors} hasBankAccess={hasBankAccess} />

        {/* ── Trial banner (shows when ≤ 7 days left, not yet subscribed) ── */}
        {!isSubscribed && daysRemaining <= 7 && daysRemaining > 0 && (
          <TouchableOpacity
            style={[styles.trialBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}
            onPress={() => router.push("/settings")}
            activeOpacity={0.8}
          >
            <Text style={[styles.trialText, { color: colors.warning }]}>
              ⏳ {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left in your free trial
            </Text>
            <Text style={[styles.trialCta, { color: colors.warning }]}>Subscribe →</Text>
          </TouchableOpacity>
        )}

        {/* ── Balance hero card ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.accent }]}>
          <Text style={styles.heroLabel}>Total balance</Text>
          <Text style={styles.heroValue}>${total.toFixed(2)}</Text>

          {/* Allocation bar */}
          <View style={styles.heroBarTrack}>
            <View style={[styles.heroBarFill, { width: `${allocatedPct}%` }]} />
          </View>
          <View style={styles.heroBarLabels}>
            <Text style={styles.heroBarText}>Allocated {allocatedPct}%</Text>
            <Text style={styles.heroBarText}>Free {100 - allocatedPct}%</Text>
          </View>
        </View>

        {/* ── Summary row ── */}
        <View style={[s.cardRow, { marginTop: spacing.md }]}>
          <SummaryCard
            label="Allocated"
            value={`$${allocated.toFixed(2)}`}
          />
          <SummaryCard
            label="Unallocated"
            value={`$${unallocated.toFixed(2)}`}
            valueColor={unallocated < 0 ? colors.danger : colors.success}
          />
        </View>

        {/* ── Quick actions ── */}
        <Text style={[s.sectionTitle, { marginTop: spacing.xl }]}>Quick actions</Text>
        <View style={styles.qaGrid}>
          {hasBankAccess ? (
            <QuickActionBtn
              icon="🏦"
              label="Sync bank"
              onPress={() => router.push("/bank-connect")}
            />
          ) : (
            <QuickActionBtn
              icon="💰"
              label="Add income"
              onPress={() => router.push("/add-income")}
            />
          )}
          <QuickActionBtn
            icon="✉️"
            label="New envelope"
            onPress={() => router.push("/new-envelope")}
          />
          <QuickActionBtn
            icon="📅"
            label="Pay schedule"
            onPress={() => router.push("/income-schedule")}
          />
          <QuickActionBtn
            icon="🔄"
            label="Cycle"
            onPress={() => router.push("/cycle")}
          />
          <QuickActionBtn
            icon="🧾"
            label="Transactions"
            onPress={() => router.push("/transactions")}
          />
          {!hasBankAccess && (
            <QuickActionBtn
              icon="🔒"
              label="Bank connect"
              onPress={() => router.push("/bank-connect")}
            />
          )}
        </View>

        {/* ── Envelope preview ── */}
        {previewEnvs.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>
                Envelopes
              </Text>
              <TouchableOpacity onPress={() => router.push("/envelopes")}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.card, { padding: 0, overflow: "hidden", marginTop: spacing.md }]}>
              {previewEnvs.map((env, i) => (
                <EnvelopePreviewRow
                  key={env.id}
                  env={env}
                  colors={colors}
                />
              ))}
            </View>
          </>
        )}


      </ScrollView>
    </SafeAreaView>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// ── Static styles (colours injected inline above) ─────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.8,
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

  // Setup checklist
  setupCard: {},

  // Trial banner
  trialBanner: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
    borderRadius:   radius.lg,
    borderWidth:    1,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    marginBottom:   spacing.md,
  },
  trialText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
  trialCta: {
    fontSize:   typography.sm,
    fontWeight: typography.bold,
  },

  // Hero card
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.sm,
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
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: radius.pill,
  },
  heroBarLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroBarText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },

  // Quick actions
  qaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  qaBtn: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  qaIcon: {
    fontSize: 26,
  },
  qaLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    textAlign: "center",
  },

  // Section row
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },

  // Envelope preview
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
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  envAmount: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    minWidth: 70,
    textAlign: "right",
  },
});

const setup = StyleSheet.create({
  card: {
    borderRadius:  radius.xl,
    borderWidth:   1,
    padding:       spacing.lg,
    marginBottom:  spacing.lg,
    gap:           spacing.md,
  },
  header: {
    flexDirection:  "row",
    justifyContent: "space-between",
    alignItems:     "center",
  },
  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
  },
  sub: {
    fontSize:  typography.xs,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.pill,
  },
  badgeText: {
    fontSize:   typography.sm,
    fontWeight: typography.bold,
  },
  track: {
    height:       4,
    borderRadius: radius.pill,
    overflow:     "hidden",
  },
  fill: {
    height:       "100%",
    borderRadius: radius.pill,
  },
  step: {
    flexDirection: "row",
    alignItems:    "center",
    paddingVertical: spacing.sm,
    gap:           spacing.md,
  },
  circle: {
    width:          28,
    height:         28,
    borderRadius:   14,
    borderWidth:    1.5,
    alignItems:     "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
  stepSub: {
    fontSize:  typography.xs,
    marginTop: 2,
  },
});