// app/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
// 4-step onboarding flow shown once after registration:
//   Step 1 — Welcome
//   Step 2 — How envelopes work
//   Step 3 — Fixed vs Flexible
//   Step 4 — Connect your bank (or skip)
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

const { width: SCREEN_W } = Dimensions.get("window");

// ── Slide content ─────────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: "welcome",
    emoji: "👋",
    title: "Welcome to Envelopes",
    body: "Envelopes is a real-time budgeting app built around one idea: every dollar you have should have a job.\n\nInstead of guessing where your money went, you'll always know exactly where it is.",
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
    title: "Fixed & Flexible",
    body: "Fixed envelopes are for known, recurring costs — rent, insurance, subscriptions. These must always be filled.\n\nFlexible envelopes are for variable spending — dining out, entertainment, travel. These give you freedom within a limit.",
    cta: "Makes sense",
  },
  {
    key: "bank",
    emoji: "🏦",
    title: "Connect your bank",
    body: "When you connect your bank, every transaction appears in real time. The app will ask you which envelope to draw it from — keeping your budget accurate automatically.\n\nYou can do this now or set it up later.",
    cta: "Connect bank",
    secondaryCta: "I'll do this later",
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
      router.replace("/bank-connect");
    } else {
      goTo(step + 1);
    }
  };

  const handleSkip = () => {
    router.replace("/");
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

          {/* Feature highlights on step 3 (types) */}
          {slide.key === "types" && (
            <View style={s.highlightsWrap}>
              <View style={[s.highlight, { backgroundColor: colors.fixedBg, borderColor: colors.border }]}>
                <Text style={[s.highlightIcon]}>🔒</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Fixed</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Rent, mortgage, insurance, subscriptions
                  </Text>
                </View>
              </View>
              <View style={[s.highlight, { backgroundColor: colors.flexibleBg, borderColor: colors.border }]}>
                <Text style={s.highlightIcon}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.highlightTitle, { color: colors.flexible }]}>Flexible</Text>
                  <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
                    Dining, entertainment, travel, shopping
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

        {/* Secondary CTA on its own row (last step only) */}
        {isLast && slide.secondaryCta && (
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: colors.border }]}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={[s.secondaryBtnText, { color: colors.textSecondary }]}>
              {slide.secondaryCta}
            </Text>
          </TouchableOpacity>
        )}

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
  secondaryBtn: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: typography.md,
    fontWeight: typography.medium,
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