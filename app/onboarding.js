// app/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
// 6-step onboarding flow shown once after registration:
//   Step 1 — Welcome
//   Step 2 — How envelopes work
//   Step 3 — Fixed vs Flexible
//   Step 4 — Payday automatic allocation
//   Step 5 — Forecasting shortfalls
//   Step 6 — Connect your bank (or skip)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme, spacing, radius, typography } from "../theme";
import { usePurchase, PLANS } from "../context/PurchaseContext";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Money animation constants ─────────────────────────────────────────────────

// Starting positions of the 5 bills (relative to the 200×160 animation canvas)
const BILL_STARTS = [
  { x:  10, y:  10 },
  { x: 140, y:   5 },
  { x:  60, y: 110 },
  { x: 155, y:  90 },
  { x:  85, y:  30 },
];

// The 3 envelope targets on the "how" slide
const ENV_TARGETS = [
  { x: 14,  y: 60, label: "🏠 Rent",       color: "#2563EB" },
  { x: 74,  y: 60, label: "🛒 Groceries",  color: "#16a34a" },
  { x: 134, y: 60, label: "✈️ Holiday",    color: "#9333ea" },
];

// Bill assignment: bill i flies to ENV_TARGETS[billToEnv[i]]
const BILL_TO_ENV = [0, 1, 2, 0, 1];

// ── WelcomeIllustration — floating bills ─────────────────────────────────────

function WelcomeIllustration({ colors }) {
  const floats = useRef(BILL_STARTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = floats.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 900 + i * 150, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 900 + i * 150, useNativeDriver: true }),
        ])
      )
    );
    Animated.stagger(180, anims).start();
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={anim.canvas}>
      {/* Central "bank" circle */}
      <View style={[anim.bank, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
        <Text style={anim.bankEmoji}>🏦</Text>
      </View>
      {/* Floating bills */}
      {BILL_STARTS.map((pos, i) => (
        <Animated.Text
          key={i}
          style={[
            anim.bill,
            {
              left: pos.x,
              top:  pos.y,
              transform: [{ translateY: floats[i].interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
            },
          ]}
        >
          💵
        </Animated.Text>
      ))}
    </View>
  );
}

// ── HowIllustration — bills fly into envelopes ───────────────────────────────

function HowIllustration({ colors }) {
  const progresses = useRef(BILL_STARTS.map(() => new Animated.Value(0))).current;
  const envScales  = useRef(ENV_TARGETS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Envelopes pop in first
    const envAnim = Animated.stagger(120,
      envScales.map(s => Animated.spring(s, { toValue: 1, tension: 180, friction: 8, useNativeDriver: true }))
    );
    // Then bills fly in with a delay
    const flyAnims = Animated.stagger(160,
      progresses.map(p => Animated.timing(p, { toValue: 1, duration: 500, useNativeDriver: true }))
    );
    Animated.sequence([envAnim, Animated.delay(200), flyAnims]).start();
  }, []);

  return (
    <View style={anim.canvas}>
      {/* Envelopes */}
      {ENV_TARGETS.map((env, i) => (
        <Animated.View
          key={i}
          style={[
            anim.envelope,
            { left: env.x, top: env.y, borderColor: env.color, backgroundColor: colors.card },
            { transform: [{ scale: envScales[i] }] },
          ]}
        >
          <Text style={[anim.envLabel, { color: env.color }]}>{env.label}</Text>
        </Animated.View>
      ))}
      {/* Flying bills */}
      {BILL_STARTS.map((start, i) => {
        const target = ENV_TARGETS[BILL_TO_ENV[i]];
        // Destination: centre of the envelope
        const destX = target.x + 25;
        const destY = target.y + 14;
        return (
          <Animated.Text
            key={i}
            style={[
              anim.bill,
              {
                left: progresses[i].interpolate({ inputRange: [0, 1], outputRange: [start.x, destX] }),
                top:  progresses[i].interpolate({ inputRange: [0, 1], outputRange: [start.y, destY] }),
                opacity: progresses[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              },
            ]}
          >
            💵
          </Animated.Text>
        );
      })}
    </View>
  );
}

// ── TypesIllustration — three filled envelopes slide in ──────────────────────

const TYPE_ENVS = [
  { label: "🔒 Fixed",    sub: "Rent, bills",   color: "#2563EB", bgKey: "fixedBg" },
  { label: "🎯 Flexible", sub: "Dining, fun",   color: "#f59e0b", bgKey: "flexibleBg" },
  { label: "📈 Savings",  sub: "Holiday, fund", color: "#16a34a", bgKey: "successBg" },
];

function TypesIllustration({ colors }) {
  const slides = useRef(TYPE_ENVS.map(() => new Animated.Value(-60))).current;

  useEffect(() => {
    Animated.stagger(140,
      slides.map(s => Animated.spring(s, { toValue: 0, tension: 160, friction: 9, useNativeDriver: true }))
    ).start();
  }, []);

  return (
    <View style={{ width: "100%", gap: spacing.sm }}>
      {TYPE_ENVS.map((e, i) => (
        <Animated.View
          key={i}
          style={[
            typeEnv.row,
            {
              backgroundColor: colors[e.bgKey] || colors.cardAlt,
              borderColor:     e.color,
              transform: [{ translateX: slides[i] }],
            },
          ]}
        >
          <Text style={typeEnv.icon}>{e.label.split(" ")[0]}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[typeEnv.label, { color: e.color }]}>{e.label.split(" ").slice(1).join(" ")}</Text>
            <Text style={[typeEnv.sub, { color: colors.textSecondary }]}>{e.sub}</Text>
          </View>
          <Text style={[typeEnv.money, { color: e.color }]}>💵💵</Text>
        </Animated.View>
      ))}
    </View>
  );
}

// ── Slide content ─────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: "welcome",
    emoji: "👋",
    title: "Welcome to Tend",
    body: "Tend is a real-time budgeting app built around one idea: every dollar you have should have a job.\n\nInstead of guessing where your money went, you'll always know exactly where it is.",
    cta: "Show me how",
  },
  {
    key: "how",
    emoji: "✉️",
    title: "The envelope system",
    body: "Think of your bank balance divided into labelled envelopes — one for rent, one for groceries, one for savings.\n\nWhen you spend money, you draw it down from the right envelope. No spreadsheets. No surprises.",
    cta: "Got it",
  },
  {
    key: "types",
    emoji: "🗂",
    title: "Three types of envelope",
    body: "Each envelope has a type that controls how it behaves when you get paid.",
    cta: "Makes sense",
  },
  {
    key: "allocation",
    emoji: "⚡",
    title: "Payday, handled automatically",
    body: "When you log income, Tend works out exactly how much of each pay belongs to each fixed envelope — based on its share of your total commitments.\n\nNo manual maths. The moment money arrives, it's already spoken for.",
    cta: "Smart!",
  },
  {
    key: "forecast",
    emoji: "🔭",
    title: "See shortfalls before they hit",
    body: "Tend projects your income between now and each envelope's due date. If a fixed commitment won't be fully funded in time, you'll see a warning — with the exact shortfall — while there's still time to act.\n\nNo nasty surprises at the end of the month.",
    cta: "Good to know",
  },
  {
    key: "pricing",
    emoji: "🏦",
    title: "Choose your plan",
    body: "Tend is free to use. Connect your bank to unlock automatic transaction sync.",
    cta: "Start free trial",
  },
];

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ count, current, colors }) {
  return (
    <View style={dots.row}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dots.dot,
            {
              backgroundColor: i === current ? colors.accent : colors.border,
              width: i === current ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const { continueForFree, purchase } = usePurchase();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const goTo = (nextStep) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(nextStep), 120);
  };

  const handleCta = async () => {
    if (isLast) {
      // "Start free trial" — trial begins automatically, just proceed
      router.replace("/pin-setup");
    } else {
      goTo(step + 1);
    }
  };

  const handleSkip = async () => {
    await continueForFree();
    router.replace("/pin-setup");
  };

  const handleSubscribe = async (planKey) => {
    await purchase(planKey);
    router.replace("/pin-setup");
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>

      {/* Skip button top-right (not on last two steps) */}
      {step < SLIDES.length - 1 && (
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[s.skipText, { color: colors.textMuted }]}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.slideWrap, { opacity: fadeAnim }]}>

          {/* Illustration — animated for first 3 slides, static emoji otherwise */}
          {slide.key === "welcome" && <WelcomeIllustration colors={colors} />}
          {slide.key === "how"     && <HowIllustration     colors={colors} />}
          {slide.key === "types"   && <TypesIllustration   colors={colors} />}
          {slide.key !== "welcome" && slide.key !== "how" && slide.key !== "types" && (
            <View style={[s.emojiWrap, { backgroundColor: colors.accentSoft }]}>
              <Text style={s.emoji}>{slide.emoji}</Text>
            </View>
          )}

          {/* Step dots */}
          <StepDots count={SLIDES.length} current={step} colors={colors} />

          {/* Text */}
          <Text style={[s.title, { color: colors.textPrimary }]}>{slide.title}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>{slide.body}</Text>

          {/* Feature highlights — allocation slide */}
          {slide.key === "allocation" && (
            <View style={s.highlightsWrap}>
              <View style={[s.highlight, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🏠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Mortgage — 67%</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Gets 67% of every pay automatically
                  </Text>
                </View>
                <Text style={[s.highlightBadge, { color: colors.accent }]}>+$1,005</Text>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🚗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Car — 16%</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Gets its proportional share each pay
                  </Text>
                </View>
                <Text style={[s.highlightBadge, { color: colors.accent }]}>+$240</Text>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🏖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Holiday — 16%</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Building up steadily towards its target
                  </Text>
                </View>
                <Text style={[s.highlightBadge, { color: colors.accent }]}>+$240</Text>
              </View>
            </View>
          )}

          {/* Pricing slide */}
          {slide.key === "pricing" && (
            <View style={s.highlightsWrap}>
              {/* Free tier */}
              <View style={[s.highlight, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Free — always</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Envelopes, budgeting, income allocation, forecasts
                  </Text>
                </View>
              </View>
              {/* Premium tier */}
              <View style={[s.highlight, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                <Text style={s.highlightIcon}>🏦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.accent }]}>
                    Premium — {PLANS.monthly.price}/mo
                  </Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Automatic bank sync, one-tap transaction allocation, spend notifications
                  </Text>
                </View>
              </View>
              {/* Trial note */}
              <Text style={{ color: colors.textMuted, fontSize: typography.xs, textAlign: "center", marginTop: spacing.xs }}>
                30-day free trial included — no card required to start.
              </Text>
              {/* Subscribe button */}
              <TouchableOpacity
                style={[s.ctaBtn, { backgroundColor: colors.accent, marginTop: spacing.sm }]}
                onPress={() => handleSubscribe("monthly")}
                activeOpacity={0.85}
              >
                <Text style={s.ctaBtnText}>Subscribe — {PLANS.monthly.price}/mo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.backBtn, { borderColor: colors.border, alignSelf: "stretch", marginTop: spacing.xs }]}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={[s.backBtnText, { color: colors.textSecondary, textAlign: "center" }]}>
                  Continue free (no bank sync)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Feature highlights — forecast slide */}
          {slide.key === "forecast" && (
            <View style={s.highlightsWrap}>
              <View style={[s.highlight, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                <Text style={s.highlightIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.success }]}>Groceries — on track</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Projected income will cover this by the due date
                  </Text>
                </View>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={s.highlightIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.danger }]}>Mortgage — $135 short</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Not enough pays left before the due date
                  </Text>
                </View>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Bottom actions — hidden on pricing slide (it has inline buttons) ── */}
      {slide.key !== "pricing" && (
        <View style={[s.footer, { borderTopColor: colors.border }]}>
          <View style={s.footerRow}>
            {step > 0 && (
              <TouchableOpacity
                style={[s.backBtn, { borderColor: colors.border }]}
                onPress={() => goTo(step - 1)}
                activeOpacity={0.7}
              >
                <Text style={[s.backBtnText, { color: colors.textSecondary }]}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.ctaBtn, { backgroundColor: colors.accent, flex: 1 }]}
              onPress={handleCta}
              activeOpacity={0.85}
            >
              <Text style={s.ctaBtnText}>{slide.cta}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },

  skipBtn: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  skipText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    paddingTop: 60,
  },

  slideWrap: {
    alignItems: "center",
    gap: spacing.lg,
  },

  emojiWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 48,
  },

  title: {
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  body: {
    fontSize: typography.md,
    lineHeight: 24,
    textAlign: "center",
  },

  // Feature highlights
  highlightsWrap: {
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  highlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  highlightIcon: {
    fontSize: 24,
  },
  highlightTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    marginBottom: 2,
  },
  highlightBody: {
    fontSize: typography.sm,
  },
  highlightBadge: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    alignSelf: "center",
    marginLeft: spacing.xs,
  },

  // Footer
  footer: {
    flexDirection: "column",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
  },
  footerRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  backBtn: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
  ctaBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

const dots = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});

// ── Animation styles ──────────────────────────────────────────────────────────

const anim = StyleSheet.create({
  canvas: {
    width: 200,
    height: 160,
    position: "relative",
    alignSelf: "center",
  },
  bank: {
    position: "absolute",
    left: 65,
    top: 40,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  bankEmoji: { fontSize: 32 },
  bill: {
    position: "absolute",
    fontSize: 26,
  },
  envelope: {
    position: "absolute",
    width: 62,
    height: 36,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  envLabel: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
});

const typeEnv = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  icon: { fontSize: 22 },
  label: { fontSize: typography.md, fontWeight: typography.bold },
  sub:   { fontSize: typography.sm, marginTop: 1 },
  money: { fontSize: 18, letterSpacing: -4 },
});