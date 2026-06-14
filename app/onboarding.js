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
import React, { useState, useRef } from "react";
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
import { usePurchase } from "../context/PurchaseContext";

const { width: SCREEN_W } = Dimensions.get("window");

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
    key: "ready",
    emoji: "🚀",
    title: "You're all set",
    body: "Start by entering your current bank balance, then assign every dollar to an envelope.\n\nTend works best when every dollar has a job — so let's get started.",
    cta: "Let's go",
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
  const { continueForFree } = usePurchase();
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

  const handleCta = () => {
    if (isLast) {
      router.replace("/pin-setup");
    } else {
      goTo(step + 1);
    }
  };

  const handleSkip = async () => {
    // Skipping bank connect = free tier. continueForFree() persists this choice
    // so the user stays on the free plan after app restarts too.
    await continueForFree();
    router.replace("/pin-setup");
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>

      {/* Skip button top-right (not on last step) */}
      {!isLast && (
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

          {/* Emoji illustration */}
          <View style={[s.emojiWrap, { backgroundColor: colors.accentSoft }]}>
            <Text style={s.emoji}>{slide.emoji}</Text>
          </View>

          {/* Step dots */}
          <StepDots count={SLIDES.length} current={step} colors={colors} />

          {/* Text */}
          <Text style={[s.title, { color: colors.textPrimary }]}>{slide.title}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>{slide.body}</Text>

          {/* Feature highlights — types slide */}
          {slide.key === "types" && (
            <View style={s.highlightsWrap}>
              <View style={[s.highlight, { backgroundColor: colors.fixedBg, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Fixed</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Rent, mortgage, insurance, subscriptions — must always be filled
                  </Text>
                </View>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.flexibleBg, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.flexible }]}>Flexible</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Dining, entertainment, travel — spend freely within your limit
                  </Text>
                </View>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.successBg, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>📈</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.success }]}>Savings</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Holiday, emergency fund, car — grows with a fixed contribution each pay
                  </Text>
                </View>
              </View>
            </View>
          )}

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

      {/* ── Bottom actions ── */}
      <View style={[s.footer, { borderTopColor: colors.border }]}>

        {/* Row: Back + Primary CTA */}
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