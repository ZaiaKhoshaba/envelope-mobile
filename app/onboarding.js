// app/onboarding.js
// ─────────────────────────────────────────────────────────────────────────────
// "How Tend works" — the animated guide.
//   First run (straight after registration): six slides ending on "Choose
//   your plan", then PIN setup.
//   Replay (Settings → How Tend works, opened with ?replay=1): the same slides
//   without "Choose your plan"; it returns to wherever it was opened from.
//
// Slides move sideways like pages. Between the first two, the pile of money on
// "Welcome to Tend" whooshes across into the envelopes on "The envelope
// system": the screen notes where the pile and the envelopes sit, flies the
// bills across in a layer above both slides, and hands each bill to its
// envelope as it arrives. The drawings and each slide's animation live in
// components/onboarding/.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Animated,
  Easing,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useTheme, spacing, radius, typography } from "../theme";
import { usePurchase, PLANS, TRIAL_DAYS } from "../context/PurchaseContext";
import {
  PopIn,
  RiseIn,
  WavingHand,
  WelcomeScene,
  EnvelopeScene,
  TypesScene,
  AllocationScene,
  ForecastScene,
  MoneyFlight,
  planFlight,
} from "../components/onboarding/scenes";

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

// ── One slide ─────────────────────────────────────────────────────────────────
// The illustration circle, step dots, title and text, then the slide's own
// animated scene. `onGeo` reports where things were laid out so the money can
// be flown from one slide to the next.

function Slide({ slide, index, count, colors, base, onGeo, renderScene }) {
  const scrollRef = useRef(null);
  return (
    <ScrollView
      ref={scrollRef}
      style={s.fill}
      contentContainerStyle={s.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.slideWrap} onLayout={(e) => onGeo("wrap", e.nativeEvent.layout)}>
        <PopIn delay={base} style={[s.emojiWrap, { backgroundColor: colors.accentSoft }]}>
          {slide.key === "welcome"
            ? <WavingHand delay={base + 500} style={s.emoji} />
            : <Text style={s.emoji}>{slide.emoji}</Text>}
        </PopIn>

        <StepDots count={count} current={index} colors={colors} />

        <RiseIn delay={base + 80}>
          <Text style={[s.title, { color: colors.textPrimary }]}>{slide.title}</Text>
        </RiseIn>
        <RiseIn delay={base + 170}>
          <Text style={[s.body, { color: colors.textSecondary }]}>{slide.body}</Text>
        </RiseIn>

        <View style={s.extra} onLayout={(e) => onGeo("extra", e.nativeEvent.layout)}>
          {renderScene(scrollRef)}
        </View>
      </View>
    </ScrollView>
  );
}

// ── Plan choice (first run only) ──────────────────────────────────────────────

function PricingPanel({ colors, base, onSubscribe, onContinueFree }) {
  const items = [
    <View key="free" style={[s.highlight, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={s.highlightIcon}>✅</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.highlightTitle, { color: colors.textPrimary }]}>Free — always</Text>
        <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
          Envelopes, budgeting, income allocation, forecasts
        </Text>
      </View>
    </View>,
    <View key="premium" style={[s.highlight, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      <Text style={s.highlightIcon}>🏦</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.highlightTitle, { color: colors.accent }]}>
          Premium — {PLANS.monthly.price}/mo
        </Text>
        <Text style={[s.highlightBody, { color: colors.textSecondary }]}>
          Automatic bank sync, one-tap transaction allocation, spend notifications
        </Text>
      </View>
    </View>,
    <Text key="trial" style={{ color: colors.textMuted, fontSize: typography.xs, textAlign: "center", marginTop: spacing.xs }}>
      30-day free trial included — no card required to start.
    </Text>,
    <TouchableOpacity
      key="subscribe"
      style={[s.ctaBtn, { backgroundColor: colors.accent, marginTop: spacing.sm }]}
      onPress={onSubscribe}
      activeOpacity={0.85}
    >
      <Text style={s.ctaBtnText}>Subscribe — {PLANS.monthly.price}/mo</Text>
    </TouchableOpacity>,
    <TouchableOpacity
      key="free-continue"
      style={[s.backBtn, { borderColor: colors.border, alignSelf: "stretch", marginTop: spacing.xs }]}
      onPress={onContinueFree}
      activeOpacity={0.7}
    >
      <Text style={[s.backBtnText, { color: colors.textSecondary, textAlign: "center" }]}>
        Continue free (no bank sync)
      </Text>
    </TouchableOpacity>,
  ];
  return (
    <View style={s.highlightsWrap}>
      {items.map((item, i) => (
        <RiseIn key={item.key} delay={base + 250 + i * 110} distance={16}>{item}</RiseIn>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { continueForFree, purchase } = usePurchase();

  // Replaying the guide from Settings is not the same as signing up. Someone
  // re-reading it already has an account, has already chosen a plan, and may
  // already have a PIN (which Settings can change on its own). Sending them to
  // PIN setup at the end — as every exit here used to — is both confusing and
  // pointless, so a replay simply returns to where it was opened from and the
  // pricing pitch is left out entirely.
  const { replay } = useLocalSearchParams();
  const isReplay = replay === "1" || replay === "true";

  const slides = useMemo(
    () => (isReplay ? SLIDES.filter((sl) => sl.key !== "pricing") : SLIDES),
    [isReplay]
  );
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  // How the current slide arrived. `id` changes on every move, so each visit
  // mounts fresh and plays its animation again; `from` is the slide sliding
  // out, and `pager` drives the sideways motion of both.
  const [nav, setNav] = useState(() => ({
    id: 0, from: null, fromId: null, dir: 1, whoosh: false, pager: new Animated.Value(1),
  }));
  const navRef = useRef(nav);
  navRef.current = nav;

  // The whoosh: where the pile and the envelopes were laid out, the flight
  // itself, and which bills have reached their envelope so far.
  const geo = useRef({});
  const flownFor = useRef(null);
  const pendingWhoosh = useRef(null);
  const [flight, setFlight] = useState(null);
  const [arrived, setArrived] = useState(0);

  const safeStep = Math.min(step, slides.length - 1);
  const slide = slides[safeStep];
  const isLast = safeStep === slides.length - 1;

  // Where the guide sends you when it's finished.
  const finish = useCallback(() => {
    if (isReplay) {
      if (router.canGoBack()) router.back();
      else router.replace("/settings");
      return;
    }
    // First run: PIN setup is the final step of signing up.
    router.replace("/pin-setup");
  }, [isReplay, router]);

  const goTo = useCallback((next, { reset = false } = {}) => {
    const prev = stepRef.current;
    const n = navRef.current;
    if (!reset) {
      if (next < 0 || next >= slidesRef.current.length || next === prev) return;
      if (n.from != null) return; // still sliding
    }
    const whoosh = !reset && prev === 0 && next === 1;
    // Note which two slides the money flies between. Both have to report where
    // they were laid out before the flight can be planned, and that can land
    // after the slide transition has already finished and tidied itself away —
    // so the flight keeps its own note rather than reading it back from `nav`.
    pendingWhoosh.current = whoosh
      ? { id: n.id + 1, fromKey: `welcome-${n.id}`, toKey: `how-${n.id + 1}` }
      : null;
    stepRef.current = next;
    setFlight(null);
    setNav(
      reset
        ? { id: n.id + 1, from: null, fromId: null, dir: 1, whoosh: false, pager: new Animated.Value(1) }
        : {
            id: n.id + 1,
            from: prev,
            fromId: n.id,
            dir: next > prev ? 1 : -1,
            whoosh,
            pager: new Animated.Value(0),
          }
    );
    setStep(next);
  }, []);

  // Slide the outgoing and incoming slides across together.
  useEffect(() => {
    if (nav.from == null) return undefined;
    const id = nav.id;
    const across = Animated.timing(nav.pager, {
      toValue: 1,
      duration: 540,
      delay: nav.whoosh ? 150 : 0,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
      useNativeDriver: true,
    });
    // Only drop the outgoing slide when the slide really finished. A stopped
    // animation (React re-running this effect in development) must not whip it
    // away the moment it starts.
    across.start(({ finished }) => {
      if (finished) setNav((x) => (x.id === id ? { ...x, from: null, fromId: null } : x));
    });
    return () => across.stop();
  }, [nav.id]);

  // The guide stays mounted between visits, so opening it again starts from the top.
  const seenFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seenFocus.current) goTo(0, { reset: true });
      seenFocus.current = true;
    }, [goTo])
  );

  // Once both the pile (slide 1) and the envelopes (slide 2) have been laid
  // out, plan the flight between them.
  const tryWhoosh = useCallback(() => {
    const p = pendingWhoosh.current;
    if (!p || flownFor.current === p.id) return;
    const a = geo.current[p.fromKey];
    const b = geo.current[p.toKey];
    if (!a?.wrap || !a?.extra || !a?.inner || !b?.wrap || !b?.extra || !b?.inner) return;
    flownFor.current = p.id;
    const pile = { x: a.wrap.x + a.extra.x + a.inner.x, y: a.wrap.y + a.extra.y + a.inner.y };
    const row = {
      x: b.wrap.x + b.extra.x + b.inner.x,
      y: b.wrap.y + b.extra.y + b.inner.y,
      width: b.inner.width,
    };
    setArrived(0);
    setFlight({ id: p.id, fromKey: p.fromKey, toKey: p.toKey, plan: planFlight(pile, row) });
  }, []);

  const reportGeo = useCallback((key, part, layout) => {
    const g = geo.current[key] || (geo.current[key] = {});
    g[part] = layout;
    tryWhoosh();
  }, [tryWhoosh]);

  const handleCta = () => {
    if (isLast) {
      // "Start free trial" — trial begins automatically, just proceed
      finish();
    } else {
      goTo(safeStep + 1);
    }
  };

  const handleSkip = async () => {
    // Only a brand-new account chooses the free plan by skipping. Skipping a
    // replay must leave whatever plan the person already has alone.
    if (!isReplay) await continueForFree();
    finish();
  };

  const handleSubscribe = async (planKey) => {
    const res = await purchase(planKey);
    if (res?.ok) {
      finish();
      return;
    }
    // Payments aren't live yet — say so plainly, and offer the trial, which
    // already unlocks everything including bank sync.
    Alert.alert(
      "Not available yet",
      res?.error || "Something went wrong. Please try again.",
      [
        { text: "Back", style: "cancel" },
        { text: `Start ${TRIAL_DAYS}-day free trial`, onPress: finish },
      ]
    );
  };

  const renderScene = (sl, visitId, scrollRef, report) => {
    const base = visitId === 0 ? 150 : 300;
    switch (sl.key) {
      case "welcome":
        return (
          <WelcomeScene
            base={base}
            hidePile={!!flight && flight.fromKey === `welcome-${visitId}`}
            onPileLayout={(l) => report("inner", l)}
          />
        );
      case "how":
        return (
          <EnvelopeScene
            base={base}
            mode={nav.whoosh && nav.id === visitId ? "whoosh" : "direct"}
            arrivedMask={flight && flight.toKey === `how-${visitId}` ? arrived : 0}
            onRowLayout={(l) => report("inner", l)}
          />
        );
      case "types":
        return <TypesScene base={base} />;
      case "allocation":
        return <AllocationScene base={base} scrollRef={scrollRef} />;
      case "forecast":
        return <ForecastScene base={base} />;
      case "pricing":
        return (
          <PricingPanel
            colors={colors}
            base={base}
            onSubscribe={() => handleSubscribe("monthly")}
            onContinueFree={handleSkip}
          />
        );
      default:
        return null;
    }
  };

  const renderSlide = (index, visitId) => {
    const sl = slides[index];
    if (!sl) return null;
    const key = `${sl.key}-${visitId}`;
    const report = (part, layout) => reportGeo(key, part, layout);
    return (
      <Slide
        slide={sl}
        index={index}
        count={slides.length}
        colors={colors}
        base={visitId === 0 ? 150 : 300}
        onGeo={report}
        renderScene={(scrollRef) => renderScene(sl, visitId, scrollRef, report)}
      />
    );
  };

  const motion = useMemo(() => ({
    leaving: nav.pager.interpolate({ inputRange: [0, 1], outputRange: [0, -nav.dir * width] }),
    entering: nav.pager.interpolate({ inputRange: [0, 1], outputRange: [nav.dir * width, 0] }),
  }), [nav.pager, nav.dir, width]);

  const leaving = nav.from != null ? slides[nav.from] : null;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>

      <View style={s.stage}>
        {leaving && (
          <Animated.View
            key={`${leaving.key}-${nav.fromId}`}
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: motion.leaving }] }]}
          >
            {renderSlide(nav.from, nav.fromId)}
          </Animated.View>
        )}
        <Animated.View
          key={`${slide.key}-${nav.id}`}
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: motion.entering }] }]}
        >
          {renderSlide(safeStep, nav.id)}
        </Animated.View>
        {flight && (
          <MoneyFlight
            key={`flight-${flight.id}`}
            plan={flight.plan}
            arrivedMask={arrived}
            onArrive={(bit) => setArrived((m) => m | (1 << bit))}
          />
        )}
      </View>

      {/* Skip button top-right (not on the last step) */}
      {!isLast && (
        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[s.skipText, { color: colors.textMuted }]}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Back on the pricing slide too — it has its own inline buttons, so it
          was the one slide with no way to return and re-read the previous one. */}
      {slide.key === "pricing" && safeStep > 0 && (
        <View style={[s.footer, { borderTopColor: colors.border, paddingTop: spacing.sm }]}>
          <TouchableOpacity
            style={[s.backBtn, { borderColor: colors.border, alignSelf: "flex-start" }]}
            onPress={() => goTo(safeStep - 1)}
            activeOpacity={0.7}
          >
            <Text style={[s.backBtnText, { color: colors.textSecondary }]}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Bottom actions — hidden on pricing slide (it has inline buttons) ── */}
      {slide.key !== "pricing" && (
        <View style={[s.footer, { borderTopColor: colors.border }]}>
          <View style={s.footerRow}>
            {safeStep > 0 && (
              <TouchableOpacity
                style={[s.backBtn, { borderColor: colors.border }]}
                onPress={() => goTo(safeStep - 1)}
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
  fill: { flex: 1 },
  stage: { flex: 1, overflow: "hidden" },

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

  extra: {
    width: "100%",
    alignItems: "center",
  },

  // Plan choice
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
