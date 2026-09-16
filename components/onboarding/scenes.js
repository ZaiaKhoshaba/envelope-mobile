// components/onboarding/scenes.js
// ─────────────────────────────────────────────────────────────────────────────
// The animated illustration under each slide of the "How Tend works" guide,
// plus the small building blocks they share. Movement is transforms and
// opacity on the native driver; only the count-ups and row tints run in JS.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { useTheme, spacing, radius, typography } from "../../theme";
import {
  Bill, billShade, FlapInside, FlapOutside, EnvelopeBack, EnvelopeFront, EnvelopeShadow,
  BILL_W, BILL_H, ENV_W, ENV_H, ENV_GAP, ENV_TOP, ROW_W, HOVER, PILE, PILE_W, PILE_H, SLOTS,
} from "./art";

// ── Helpers ───────────────────────────────────────────────────────────────────

const OUT = Easing.out(Easing.quad);
const IN_OUT = Easing.inOut(Easing.quad);

// Drives `value` through 1, 2, 3… with its own duration and easing per leg, so
// one value can play a multi-step keyframe animation through interpolate().
// (The native driver can't ease inside interpolate(), so the easing lives here.)
function legs(value, spec, delay = 0) {
  const steps = spec.map(([duration, easing], i) =>
    Animated.timing(value, { toValue: i + 1, duration, easing, useNativeDriver: true })
  );
  return Animated.sequence(delay > 0 ? [Animated.delay(delay), ...steps] : steps);
}
const lerp = (v, out) => v.interpolate({ inputRange: out.map((_, i) => i), outputRange: out });
const lerpDeg = (v, out) =>
  v.interpolate({ inputRange: out.map((_, i) => i), outputRange: out.map((d) => `${d}deg`) });
const run = (anim) => new Promise((resolve) => anim.start(({ finished }) => resolve(finished)));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const money = (n) => "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}

// ── Shared pieces ─────────────────────────────────────────────────────────────

// Grows in from half size with a small overshoot.
export function PopIn({ delay = 0, duration = 460, style, onLayout, children }) {
  const v = useRef(new Animated.Value(0)).current;
  const look = useMemo(() => ({
    opacity: lerp(v, [0, 1, 1]),
    transform: [{ scale: lerp(v, [0.5, 1.08, 1]) }],
  }), [v]);
  useEffect(() => {
    const a = legs(v, [[duration * 0.6, OUT], [duration * 0.4, OUT]], delay);
    a.start();
    return () => a.stop();
  }, []);
  return <Animated.View onLayout={onLayout} style={[style, look]}>{children}</Animated.View>;
}

// Fades in while rising a few pixels.
export function RiseIn({ delay = 0, distance = 10, duration = 420, style, onLayout, children }) {
  const v = useRef(new Animated.Value(0)).current;
  const look = useMemo(() => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  }), [v, distance]);
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1, duration, delay, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, []);
  return <Animated.View onLayout={onLayout} style={[style, look]}>{children}</Animated.View>;
}

// A dollar amount that counts up from $0 with a little pop.
export function CountUp({ to, prefix = "", duration = 600, style }) {
  const [shown, setShown] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  const scale = useMemo(() => pop.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }), [pop]);
  useEffect(() => {
    let off = false;
    const v = new Animated.Value(0);
    v.addListener(({ value }) => { if (!off) setShown(value); });
    Animated.timing(v, {
      toValue: to, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => { if (!off) setShown(to); });
    Animated.timing(pop, { toValue: 1, duration: 320, easing: OUT, useNativeDriver: true }).start();
    return () => { off = true; v.stopAnimation(); v.removeAllListeners(); };
  }, [to]);
  return (
    <Animated.Text style={[style, { transform: [{ scale }] }]}>
      {prefix}{money(shown)}
    </Animated.Text>
  );
}

// The 👋 on the welcome slide: waves twice, rests, and repeats.
export function WavingHand({ delay = 0, style }) {
  const v = useRef(new Animated.Value(0)).current;
  const rotate = useMemo(() => lerpDeg(v, [0, 16, -9, 16, -5, 11, 0, 0]), [v]);
  useEffect(() => {
    let loop = null;
    const t = setTimeout(() => {
      loop = Animated.loop(legs(v, [
        [196, IN_OUT], [196, IN_OUT], [196, IN_OUT], [196, IN_OUT],
        [196, IN_OUT], [252, IN_OUT], [1568, Easing.linear],
      ]));
      loop.start();
    }, delay);
    return () => { clearTimeout(t); if (loop) loop.stop(); };
  }, []);
  return <Animated.Text style={[style, st.hand, { transform: [{ rotate }] }]}>👋</Animated.Text>;
}

// ── Slide 1: a pile of money under the welcome text ───────────────────────────

export function WelcomeScene({ base = 0, hidePile = false, onPileLayout }) {
  const { isDark } = useTheme();
  const shade = billShade(isDark);
  const bills = useMemo(() => PILE.map(([, , r]) => {
    const v = new Animated.Value(0);
    return {
      v,
      opacity: lerp(v, [0, 1, 1]),
      transform: [{ translateY: lerp(v, [-150, 4, 0]) }, { rotate: lerpDeg(v, [r - 28, r + 2, r]) }],
    };
  }), []);

  // Bills drop in one at a time, building the pile from the bottom up.
  useEffect(() => {
    const drop = Animated.parallel(bills.map((b, i) =>
      legs(b.v, [[403, Easing.bezier(0.5, 0, 0.9, 0.5)], [157, OUT]], base + 300 + i * 70)
    ));
    drop.start();
    return () => drop.stop();
  }, []);

  return (
    <View style={st.pile} onLayout={(e) => onPileLayout?.(e.nativeEvent.layout)}>
      {PILE.map(([x, y], i) => (
        <Animated.View
          key={i}
          style={[st.bill, { left: x, top: y, opacity: hidePile ? 0 : bills[i].opacity, transform: bills[i].transform }]}
        >
          <Bill shade={shade} />
        </Animated.View>
      ))}
    </View>
  );
}

// ── The whoosh from slide 1 to slide 2 ────────────────────────────────────────
// Rendered by the onboarding screen above both slides while they slide past.

const FLIGHT_LEGS = [
  [127, Easing.bezier(0.3, 0, 0.5, 1)],    // crouch, like being scooped up
  [245, Easing.bezier(0.3, 0.6, 0.4, 1)],  // tossed up, dragged back by the old slide
  [353, Easing.bezier(0.5, 0, 0.3, 1)],    // whoosh across, overshooting
  [255, Easing.bezier(0.3, 0, 0.3, 1)],    // settle above its envelope
];

// Works out each pile bill's journey. `pile` and `row` are where the pile and
// the envelope row sit within the stage.
export function planFlight(pile, row) {
  // Left-most bills go to the left envelope, and so on, so paths don't tangle.
  const dest = [];
  PILE.map((p, i) => ({ i, x: p[0] }))
    .sort((a, b) => a.x - b.x)
    .forEach((o, n) => { dest[o.i] = { k: Math.floor(n / SLOTS.length), j: n % SLOTS.length }; });
  const rowLeft = row.x + (row.width - ROW_W) / 2;

  const bills = PILE.map(([bx, by, r0], i) => {
    const { k, j } = dest[i];
    const [sx, sy, r1] = SLOTS[j];
    const left = pile.x + bx;
    const top = pile.y + by;
    const tx = rowLeft + k * (ENV_W + ENV_GAP) + sx;
    const ty = row.y + ENV_TOP + sy + HOVER;
    return {
      bit: k * SLOTS.length + j, left, top, r0, r1,
      dx: tx - (left + BILL_W / 2), dy: ty - (top + BILL_H / 2),
      lift: -(90 + (i % 3) * 14),
      delay: (PILE.length - 1 - i) * 45,   // top of the pile leaves first
    };
  });
  return { bills, streaks: { x: pile.x + PILE_W / 2, y: pile.y + 30 } };
}

export function MoneyFlight({ plan, arrivedMask, onArrive }) {
  const { colors, isDark } = useTheme();
  const shade = billShade(isDark);
  const bills = useMemo(() => plan.bills.map((b) => {
    const v = new Animated.Value(0);
    return {
      ...b, v,
      style: {
        left: b.left,
        top: b.top,
        transform: [
          { translateX: lerp(v, [0, -4, b.dx * 0.15 - 34, b.dx + 22, b.dx]) },
          { translateY: lerp(v, [0, 7, b.dy * 0.3 + b.lift, b.dy - 20, b.dy]) },
          { rotate: lerpDeg(v, [b.r0, b.r0 - 5, b.r0 + 22, b.r1 - 16, b.r1]) },
          { scaleX: lerp(v, [1, 1.07, 0.96, 0.84, 0.8]) },
          { scaleY: lerp(v, [1, 0.92, 0.96, 0.84, 0.8]) },
        ],
      },
    };
  }), [plan]);

  // A few speed lines trailing the money.
  const streaks = useMemo(() => [[-120, -40], [-80, -95], [-10, -60], [-50, -135]].map(([ox, oy], n) => {
    const v = new Animated.Value(0);
    return {
      n, v,
      style: {
        left: plan.streaks.x + ox,
        top: plan.streaks.y + oy,
        opacity: lerp(v, [0, 0.55, 0]),
        transform: [{ translateX: lerp(v, [0, 40, 130]) }, { scaleX: lerp(v, [0.001, 1, 0.1]) }],
      },
    };
  }), [plan]);

  useEffect(() => {
    const flights = bills.map((b) => legs(b.v, FLIGHT_LEGS, b.delay));
    flights.forEach((a, n) => a.start(({ finished }) => { if (finished) onArrive(bills[n].bit); }));
    const lines = Animated.parallel(streaks.map((s) => legs(s.v, [[216, OUT], [264, OUT]], 420 + s.n * 70)));
    lines.start();
    return () => { flights.forEach((a) => a.stop()); lines.stop(); };
  }, [bills]);

  return (
    <View style={[StyleSheet.absoluteFill, st.noTouch]}>
      {streaks.map((s) => (
        <Animated.View key={`streak-${s.n}`} style={[st.streak, { backgroundColor: colors.accent }, s.style]} />
      ))}
      {bills.filter((b) => !(arrivedMask & (1 << b.bit))).map((b) => (
        <Animated.View key={b.bit} style={[st.bill, b.style]}>
          <Bill shade={shade} />
        </Animated.View>
      ))}
    </View>
  );
}

// ── Slide 2: envelopes open and the money slides in ──────────────────────────

const ENVELOPES = [
  { name: "Rent", amount: 1450 },
  { name: "Groceries", amount: 380 },
  { name: "Savings", amount: 600 },
];
export const ALL_ARRIVED = (1 << (ENVELOPES.length * SLOTS.length)) - 1;

// mode "whoosh": the bills fly in from slide 1 (arrivedMask says which have
//   reached their envelope so far).
// mode "direct": arriving any other way (Back, or replaying), the bills float
//   down from above instead.
export function EnvelopeScene({ mode = "direct", arrivedMask = 0, base = 0, onRowLayout }) {
  const { colors, isDark } = useTheme();
  const shade = billShade(isDark);
  const alive = useAlive();
  const [arrival] = useState(mode);   // how it arrived is fixed when it appears
  const [landed, setLanded] = useState(arrival === "whoosh" ? 0 : ALL_ARRIVED);
  const [counted, setCounted] = useState(() => ENVELOPES.map(() => false));
  const started = useRef(false);
  const showing = useRef(0);

  const env = useMemo(() => ENVELOPES.map(() => {
    const shut = new Animated.Value(1);
    const open = new Animated.Value(0);
    const pop = new Animated.Value(0);
    const squash = new Animated.Value(1);
    return {
      shut, open, pop, squash,
      bodyTransform: [
        { scale: lerp(pop, [1, 1.045, 1]) },
        { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1.03, 1] }) },
        { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
      openTransform: [{ scaleY: lerp(open, [0.001, 1.14, 1]) }],
      shutTransform: [{ scaleY: shut }],
      bills: SLOTS.map(([, , r]) => {
        const drop = new Animated.Value(0);
        const enter = new Animated.Value(arrival === "whoosh" ? 1 : 0);
        return {
          drop, enter,
          opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: "clamp" }),
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { translateY: lerp(drop, [HOVER, 5, 0]) },
            { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: [`${r - 20}deg`, `${r}deg`] }) },
            { scaleX: lerp(drop, [0.8, 0.82, 0.8]) },
            { scaleY: lerp(drop, [0.8, 0.76, 0.8]) },
          ],
        };
      }),
    };
  }), []);

  // Each envelope in turn: flap flips open, its bills drop in, its amount counts up.
  const openAll = () => {
    if (started.current) return;
    started.current = true;
    env.forEach(async (e, k) => {
      await sleep(k * 170);
      if (!alive.current) return;
      await run(Animated.timing(e.shut, {
        toValue: 0.001, duration: 170, easing: Easing.bezier(0.55, 0, 1, 0.45), useNativeDriver: true,
      }));
      if (!alive.current) return;
      legs(e.open, [[208, OUT], [112, IN_OUT]]).start();
      legs(e.pop, [[136, OUT], [204, OUT]]).start();
      await sleep(60);
      if (!alive.current) return;
      await Promise.all(e.bills.map((b, n) =>
        run(legs(b.drop, [[308, Easing.bezier(0.5, 0, 0.9, 0.6)], [132, OUT]], n * 85)).then((ok) => {
          if (!ok || !alive.current) return;
          e.squash.setValue(0);
          Animated.timing(e.squash, { toValue: 1, duration: 240, easing: OUT, useNativeDriver: true }).start();
        })
      ));
      if (alive.current) setCounted((c) => c.map((done, i) => done || i === k));
    });
  };

  useEffect(() => {
    if (arrival !== "direct") return undefined;
    let off = false;
    const floatIn = Animated.parallel(env.flatMap((e, k) => e.bills.map((b, j) =>
      Animated.timing(b.enter, {
        toValue: 1, duration: 480, delay: base + 350 + (k * SLOTS.length + j) * 60,
        easing: Easing.bezier(0.2, 0.8, 0.3, 1.2), useNativeDriver: true,
      })
    )));
    floatIn.start(({ finished }) => {
      if (finished && !off) setTimeout(() => { if (!off) openAll(); }, 120);
    });
    return () => { off = true; floatIn.stop(); };
  }, []);

  useEffect(() => {
    if (arrival !== "whoosh" || arrivedMask !== ALL_ARRIVED) return undefined;
    setLanded(ALL_ARRIVED);
    const t = setTimeout(() => { if (alive.current) openAll(); }, 90);
    return () => clearTimeout(t);
  }, [arrivedMask]);

  // Safety net: if the flying money never reaches us, show it and open the
  // envelopes anyway. Whatever goes wrong, nobody is left staring at three
  // sealed envelopes.
  useEffect(() => {
    if (arrival !== "whoosh") return undefined;
    const t = setTimeout(() => {
      if (!alive.current || started.current || showing.current) return;
      setLanded(ALL_ARRIVED);
      setTimeout(() => { if (alive.current) openAll(); }, 120);
    }, 2600);
    return () => clearTimeout(t);
  }, []);

  const visible = landed | arrivedMask;
  showing.current = visible;

  return (
    <View style={st.envRow} onLayout={(ev) => onRowLayout?.(ev.nativeEvent.layout)}>
      {ENVELOPES.map((item, k) => {
        const e = env[k];
        return (
          <View key={item.name} style={st.envCol}>
            <Animated.View style={[st.env, { transform: e.bodyTransform }]}>
              <View style={st.envShadow}><EnvelopeShadow isDark={isDark} /></View>
              <Animated.View style={[st.flapOpen, { transform: e.openTransform }]}><FlapInside /></Animated.View>
              <View style={st.layer}><EnvelopeBack /></View>
              <View style={st.layer}>
                {SLOTS.map(([sx, sy], j) => (
                  visible & (1 << (k * SLOTS.length + j)) ? (
                    <Animated.View
                      key={j}
                      style={[st.bill, {
                        left: sx - BILL_W / 2, top: sy - BILL_H / 2,
                        opacity: e.bills[j].opacity, transform: e.bills[j].transform,
                      }]}
                    >
                      <Bill shade={shade} />
                    </Animated.View>
                  ) : null
                ))}
              </View>
              <View style={st.layer}><EnvelopeFront /></View>
              <Animated.View style={[st.flapClosed, { transform: e.shutTransform }]}><FlapOutside /></Animated.View>
            </Animated.View>
            <Text style={[st.envLabel, { color: colors.textPrimary }]}>{item.name}</Text>
            {counted[k]
              ? <CountUp to={item.amount} style={[st.envAmt, { color: colors.textSecondary }]} />
              : <Text style={[st.envAmt, { opacity: 0 }]}>{money(0)}</Text>}
          </View>
        );
      })}
    </View>
  );
}

// ── Slide 3: the three envelope types ────────────────────────────────────────

const TYPES = [
  { icon: "🔒", title: "Fixed", bg: "fixedBg", tint: "textPrimary",
    body: "Rent, mortgage, insurance, subscriptions — must always be filled" },
  { icon: "🎯", title: "Flexible", bg: "flexibleBg", tint: "flexible",
    body: "Dining, entertainment, travel — spend freely within your limit" },
  { icon: "📈", title: "Savings", bg: "successBg", tint: "success",
    body: "Holiday, emergency fund, car — grows with a fixed contribution each pay" },
];

export function TypesScene({ base = 0 }) {
  const { colors } = useTheme();
  return (
    <View style={st.rows}>
      {TYPES.map((t, n) => (
        <RiseIn
          key={t.title}
          delay={base + 250 + n * 110}
          distance={16}
          style={[st.row, { backgroundColor: colors[t.bg], borderColor: colors.border }]}
        >
          <PopIn delay={base + 420 + n * 110} duration={520}>
            <Text style={st.rowIcon}>{t.icon}</Text>
          </PopIn>
          <View style={st.rowText}>
            <Text style={[st.rowTitle, { color: colors[t.tint] }]}>{t.title}</Text>
            <Text style={[st.rowBody, { color: colors.textSecondary }]}>{t.body}</Text>
          </View>
        </RiseIn>
      ))}
    </View>
  );
}

// ── Slide 4: payday splits itself across the envelopes ───────────────────────

const SPLIT = [
  { icon: "🏠", title: "Mortgage — 67%", body: "Gets 67% of every pay automatically", amount: 1005, share: 0.67 },
  { icon: "🚗", title: "Car — 16%", body: "Gets its proportional share each pay", amount: 240, share: 0.16 },
  { icon: "🏖", title: "Holiday — 16%", body: "Building up steadily towards its target", amount: 240, share: 0.16 },
];
const CHIP_PAD = 8;

// A small bill flying from the pay chip into a row's badge.
function MiniFlight({ from, to, shade, onDone }) {
  const v = useRef(new Animated.Value(0)).current;
  const look = useMemo(() => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return {
      left: from.x - BILL_W / 2,
      top: from.y - BILL_H / 2,
      opacity: lerp(v, [1, 1, 1, 0]),
      transform: [
        { translateX: lerp(v, [0, dx * 0.5 + 40, dx, dx]) },
        { translateY: lerp(v, [0, dy * 0.5 - 30, dy, dy]) },
        { rotate: lerpDeg(v, [0, -12, 10, 10]) },
        { scale: lerp(v, [0.5, 0.5, 0.3, 0.2]) },
      ],
    };
  }, []);
  useEffect(() => {
    const a = legs(v, [
      [310, Easing.bezier(0.4, 0, 0.3, 1)], [248, Easing.bezier(0.4, 0, 0.3, 1)], [62, Easing.linear],
    ]);
    a.start(({ finished }) => { if (finished) onDone(); });
    return () => a.stop();
  }, []);
  return <Animated.View style={[st.bill, look, st.noTouch]}><Bill shade={shade} /></Animated.View>;
}

export function AllocationScene({ base = 0, scrollRef }) {
  const { colors, isDark } = useTheme();
  const shade = billShade(isDark);
  const geo = useRef({ chip: null, list: null, rows: [], badges: [] }).current;
  const anim = useMemo(() => SPLIT.map((a) => {
    const bar = new Animated.Value(0);
    const pulse = new Animated.Value(0);
    return {
      bar, pulse,
      barTransform: [{ scaleX: bar.interpolate({ inputRange: [0, 1], outputRange: [0.001, a.share] }) }],
      rowTransform: [{ scale: lerp(pulse, [1, 1.025, 1]) }],
    };
  }), []);
  const [paid, setPaid] = useState(() => SPLIT.map(() => false));
  const [flights, setFlights] = useState([]);

  const settle = (k) => {
    setFlights((f) => f.filter((x) => x.k !== k));
    setPaid((p) => p.map((done, i) => done || i === k));
    Animated.timing(anim[k].bar, {
      toValue: 1, duration: 600, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true,
    }).start();
    legs(anim[k].pulse, [[112, OUT], [208, OUT]]).start();
  };

  useEffect(() => {
    let off = false;
    (async () => {
      await sleep(base + 950);
      if (off) return;
      // On shorter screens the last row sits below the fold, so bring it into view first.
      scrollRef?.current?.scrollToEnd({ animated: true });
      await sleep(550);
      for (let k = 0; k < SPLIT.length; k++) {
        if (off) return;
        const row = geo.rows[k];
        const badge = geo.badges[k];
        if (geo.chip && geo.list && row && badge) {
          const from = { x: geo.chip.x + CHIP_PAD + 20, y: geo.chip.y + geo.chip.height / 2 };
          const to = {
            x: geo.list.x + row.x + badge.x + badge.width / 2,
            y: geo.list.y + row.y + badge.y + badge.height / 2,
          };
          setFlights((f) => [...f, { k, from, to }]);
        } else {
          settle(k);
        }
        await sleep(300);
      }
    })();
    return () => { off = true; };
  }, []);

  return (
    <View style={st.scene}>
      <PopIn
        delay={base + 220}
        onLayout={(e) => { geo.chip = e.nativeEvent.layout; }}
        style={[st.payChip, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Bill shade={shade} width={40} height={24} />
        <Text style={[st.payText, { color: colors.textSecondary }]}>
          Pay arrives · <Text style={{ color: colors.textPrimary, fontWeight: typography.bold }}>$1,500</Text>
        </Text>
      </PopIn>

      <View style={st.rows} onLayout={(e) => { geo.list = e.nativeEvent.layout; }}>
        {SPLIT.map((a, k) => (
          <RiseIn
            key={a.title}
            delay={base + 320 + k * 110}
            distance={16}
            onLayout={(e) => { geo.rows[k] = e.nativeEvent.layout; }}
          >
            <Animated.View
              style={[st.row, { backgroundColor: colors.accentSoft, borderColor: colors.border, transform: anim[k].rowTransform }]}
            >
              <Text style={st.rowIcon}>{a.icon}</Text>
              <View style={st.rowText}>
                <Text style={[st.rowTitle, { color: colors.textPrimary }]}>{a.title}</Text>
                <Text style={[st.rowBody, { color: colors.textSecondary }]}>{a.body}</Text>
                <View style={[st.track, { backgroundColor: colors.border }]}>
                  <Animated.View style={[st.fill, { backgroundColor: colors.accent, transform: anim[k].barTransform }]} />
                </View>
              </View>
              <View style={st.badgeBox} onLayout={(e) => { geo.badges[k] = e.nativeEvent.layout; }}>
                {paid[k]
                  ? <CountUp to={a.amount} prefix="+" duration={500} style={[st.badge, { color: colors.accent }]} />
                  : <Text style={[st.badge, { color: colors.accent, opacity: 0.35 }]}>+{money(0)}</Text>}
              </View>
            </Animated.View>
          </RiseIn>
        ))}
      </View>

      <View style={[StyleSheet.absoluteFill, st.noTouch]}>
        {flights.map((f) => (
          <MiniFlight key={f.k} from={f.from} to={f.to} shade={shade} onDone={() => settle(f.k)} />
        ))}
      </View>
    </View>
  );
}

// ── Slide 5: forecasts fill up, one falls short ──────────────────────────────

function StatusIcon({ show, icon }) {
  if (!show) return <Text style={[st.rowIcon, { opacity: 0 }]}>{icon}</Text>;
  return <PopIn duration={480}><Text style={st.rowIcon}>{icon}</Text></PopIn>;
}

export function ForecastScene({ base = 0 }) {
  const { colors } = useTheme();
  const a = useMemo(() => {
    const goodBar = new Animated.Value(0);
    const shortBar = new Animated.Value(0);
    const gap = new Animated.Value(0);
    const shake = new Animated.Value(0);
    return {
      goodBar, shortBar, gap, shake,
      goodTone: new Animated.Value(0),    // JS-driven: colours can't use the native driver
      shortTone: new Animated.Value(0),
      goodFill: [{ scaleX: goodBar.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }],
      shortFill: [{ scaleX: shortBar.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }],
      gapOpacity: lerp(gap, [0, 1, 0.35, 1, 0.35, 1]),
      shakeTransform: [{ translateX: lerp(shake, [0, -6, 5, -3, 2, 0]) }],
    };
  }, []);
  const [good, setGood] = useState(false);
  const [short, setShort] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      await sleep(base + 800);
      if (off) return;
      Animated.timing(a.goodBar, {
        toValue: 1, duration: 900, easing: Easing.bezier(0.3, 0, 0.2, 1), useNativeDriver: true,
      }).start();
      const slowFill = run(Animated.timing(a.shortBar, {
        toValue: 0.86, duration: 1100, easing: Easing.bezier(0.3, 0, 0.1, 1), useNativeDriver: true,
      }));
      await sleep(900);
      if (off) return;
      setGood(true);
      Animated.timing(a.goodTone, { toValue: 1, duration: 350, useNativeDriver: false }).start();
      await slowFill;
      await sleep(150);
      if (off) return;
      setShort(true);
      Animated.timing(a.shortTone, { toValue: 1, duration: 350, useNativeDriver: false }).start();
      legs(a.gap, [[280, IN_OUT], [280, IN_OUT], [280, IN_OUT], [280, IN_OUT], [280, IN_OUT]]).start();
      legs(a.shake, [[84, IN_OUT], [84, IN_OUT], [84, IN_OUT], [84, IN_OUT], [84, IN_OUT]], 120).start();
    })();
    return () => { off = true; };
  }, []);

  const tone = (value, bg, border) => ({
    backgroundColor: value.interpolate({ inputRange: [0, 1], outputRange: [colors.card, bg] }),
    borderColor: value.interpolate({ inputRange: [0, 1], outputRange: [colors.border, border] }),
  });

  return (
    <View style={st.rows}>
      <RiseIn delay={base + 250} distance={16}>
        <Animated.View style={[st.row, tone(a.goodTone, colors.successBg, colors.success)]}>
          <StatusIcon show={good} icon="✅" />
          <View style={st.rowText}>
            <Text style={[st.rowTitle, { color: good ? colors.success : colors.textPrimary }]}>
              {good ? "Groceries — on track" : "Groceries"}
            </Text>
            <Text style={[st.rowBody, { color: colors.textSecondary }]}>
              Projected income will cover this by the due date
            </Text>
            <View style={[st.track, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[st.fill, { backgroundColor: good ? colors.success : colors.accent, transform: a.goodFill }]}
              />
            </View>
          </View>
        </Animated.View>
      </RiseIn>

      <RiseIn delay={base + 360} distance={16}>
        <Animated.View style={{ transform: a.shakeTransform }}>
          <Animated.View style={[st.row, tone(a.shortTone, colors.dangerBg, colors.danger)]}>
            <StatusIcon show={short} icon="⚠️" />
            <View style={st.rowText}>
              <Text style={[st.rowTitle, { color: short ? colors.danger : colors.textPrimary }]}>
                {short ? "Mortgage — $135 short" : "Mortgage"}
              </Text>
              <Text style={[st.rowBody, { color: colors.textSecondary }]}>
                Not enough pays left before the due date
              </Text>
              <View style={[st.track, { backgroundColor: colors.border }]}>
                <Animated.View style={[st.fill, { backgroundColor: colors.accent, transform: a.shortFill }]} />
                <Animated.View style={[st.gap, { backgroundColor: colors.danger, opacity: a.gapOpacity }]} />
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </RiseIn>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  hand: { transformOrigin: "70% 85%" },
  bill: { position: "absolute", width: BILL_W, height: BILL_H },
  noTouch: { pointerEvents: "none" },
  streak: { position: "absolute", width: 72, height: 3, borderRadius: 2, transformOrigin: "0% 50%" },
  pile: { width: PILE_W, height: PILE_H, marginTop: 6 },

  envRow: { flexDirection: "row", gap: ENV_GAP, justifyContent: "center", paddingTop: ENV_TOP },
  envCol: { width: ENV_W, alignItems: "center" },
  env: { width: ENV_W, height: ENV_H, transformOrigin: "50% 100%" },
  layer: { position: "absolute", left: 0, top: 0, width: ENV_W, height: ENV_H },
  envShadow: { position: "absolute", left: 4, top: 60 },
  flapOpen: { position: "absolute", left: 0, top: -40, width: ENV_W, height: 40, transformOrigin: "50% 100%" },
  flapClosed: { position: "absolute", left: 0, top: 0, width: ENV_W, height: 46, transformOrigin: "50% 0%" },
  envLabel: { marginTop: 14, fontSize: typography.sm, fontWeight: typography.bold },
  envAmt: { marginTop: 2, fontSize: typography.sm, fontVariant: ["tabular-nums"] },

  scene: { width: "100%", alignItems: "center", gap: spacing.sm },
  rows: { width: "100%", gap: spacing.sm, marginTop: spacing.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg,
  },
  rowIcon: { fontSize: 24 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: typography.md, fontWeight: typography.bold, marginBottom: 2 },
  rowBody: { fontSize: typography.sm },

  payChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingLeft: CHIP_PAD, paddingRight: 14, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1,
  },
  payText: { fontSize: typography.sm },
  badgeBox: { minWidth: 58, alignItems: "flex-end", marginLeft: spacing.xs },
  badge: { fontSize: typography.sm, fontWeight: typography.bold, fontVariant: ["tabular-nums"] },
  track: { height: 5, borderRadius: 3, marginTop: spacing.sm, overflow: "hidden" },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 3, transformOrigin: "0% 50%" },
  gap: { position: "absolute", top: 0, bottom: 0, right: 0, width: "14%" },
});
