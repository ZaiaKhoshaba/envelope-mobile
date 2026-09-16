// components/onboarding/art.js
// ─────────────────────────────────────────────────────────────────────────────
// Drawings for the "How Tend works" guide: a sticker-style dollar bill and an
// off-white envelope. The envelope is drawn as separate layers (back, front,
// and both sides of the flap) so the flap can flip open and bills can slide in
// between the back and the front.
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo } from "react";
import Svg, {
  Rect, Ellipse, Circle, Path, Text as SvgText, Defs, RadialGradient, Stop,
} from "react-native-svg";

export const BILL_W = 80;
export const BILL_H = 48;
export const ENV_W = 96;
export const ENV_H = 68;
export const ENV_GAP = 16;
export const ENV_TOP = 92;   // headroom above the envelopes for the waiting bills
export const ROW_W = ENV_W * 3 + ENV_GAP * 2;
export const HOVER = -66;    // how far above its slot a bill waits before dropping in

// Where each bill sits in the welcome pile: [left, top, rotation°].
export const PILE = [
  [8, 78, -7], [62, 82, 4], [116, 79, -3], [164, 74, 8],
  [32, 52, 9], [88, 48, -5], [140, 52, 5],
  [58, 24, -11], [112, 20, 6],
];
export const PILE_W = 250;
export const PILE_H = 130;

// Where a bill ends up inside an envelope: [centre x, centre y, rotation°].
export const SLOTS = [[34, 10, -13], [49, 4, 3], [63, 11, 14]];

// One neutral off-white paper for every envelope; the labels tell them apart.
const PAPER = {
  base: "#ECECE9", light: "#F6F6F3", inside: "#CFCFCA",
  flapIn: "#F8F8F5", dot: "#D3D3CD", line: "#C6C6C0",
};
const INK = "#2E7A38";

export const billShade = (isDark) => (isDark ? "rgba(0,0,0,0.38)" : "rgba(30,60,35,0.22)");

export const Bill = memo(function Bill({ shade, width = BILL_W, height = BILL_H }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 80 48">
      <Rect x={3} y={6} width={75} height={40} rx={10} fill={shade} />
      <Rect x={1} y={1} width={75} height={41} rx={10} fill="#FFFFFF" />
      <Rect x={5} y={5} width={67} height={33} rx={6.5} fill="#A9DF8D" stroke={INK} strokeWidth={2.4} />
      <Rect x={9.5} y={9.5} width={58} height={24} rx={3.5} fill="none" stroke={INK} strokeWidth={1.1} opacity={0.45} />
      <Ellipse cx={19.5} cy={21.5} rx={4.6} ry={6.2} fill="#88CB6C" />
      <Ellipse cx={57.5} cy={21.5} rx={4.6} ry={6.2} fill="#88CB6C" />
      <Circle cx={38.5} cy={21.5} r={9.6} fill="#D8F4C6" stroke={INK} strokeWidth={2} />
      <SvgText x={38.5} y={26.3} textAnchor="middle" fontSize={13.5} fontWeight="800" fill={INK}>$</SvgText>
      <Path d="M8.6 7.6 H22" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
    </Svg>
  );
});

const FLAP = "M1 40 L42 4.5 Q48 -0.5 54 4.5 L95 40 Z";

// Polka dots lining the inside of the flap, kept within its triangle.
const FLAP_DOTS = [];
for (let y = 3.5; y < 40; y += 7) {
  for (let x = 3.5; x < ENV_W; x += 7) {
    const halfWidth = ((y - 1) / 39) * 47;
    if (Math.abs(x - 48) < halfWidth - 1.5) FLAP_DOTS.push([x, y]);
  }
}

// The flap once it's open: pointing up, showing its dotted lining.
export const FlapInside = memo(function FlapInside() {
  return (
    <Svg width={ENV_W} height={40} viewBox="0 0 96 40">
      <Path d={FLAP} fill={PAPER.flapIn} stroke={PAPER.line} strokeWidth={1} strokeLinejoin="round" />
      {FLAP_DOTS.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.35} fill={PAPER.dot} />
      ))}
    </Svg>
  );
});

// The flap while closed: pointing down over the front.
export const FlapOutside = memo(function FlapOutside() {
  return (
    <Svg width={ENV_W} height={46} viewBox="0 0 96 46">
      <Path
        d="M0.5 3.5 Q0.5 0.5 4 0.5 H92 Q95.5 0.5 95.5 3.5 L54.5 41 Q48 46 41.5 41 Z"
        fill={PAPER.light} stroke={PAPER.line} strokeWidth={1} strokeLinejoin="round"
      />
    </Svg>
  );
});

// The inside back wall, seen through the open mouth.
export const EnvelopeBack = memo(function EnvelopeBack() {
  return (
    <Svg width={ENV_W} height={ENV_H} viewBox="0 0 96 68">
      <Rect width={96} height={68} rx={6} fill={PAPER.inside} />
      <Path d="M3 0 H93 L48 30 Z" fill="#000000" opacity={0.07} />
    </Svg>
  );
});

// The front pocket: side flaps with a V-shaped mouth, and the bottom flap.
export const EnvelopeFront = memo(function EnvelopeFront() {
  return (
    <Svg width={ENV_W} height={ENV_H} viewBox="0 0 96 68">
      <Path
        d="M0 5 Q0 1.5 3.2 3.4 L45.5 36.6 Q48 38.4 50.5 36.6 L92.8 3.4 Q96 1.5 96 5 V62 Q96 68 90 68 H6 Q0 68 0 62 Z"
        fill={PAPER.base} stroke={PAPER.line} strokeWidth={1}
      />
      <Path
        d="M0.5 65 L40.5 37.8 Q48 33 55.5 37.8 L95.5 65 Q95 68 90 68 H6 Q1 68 0.5 65 Z"
        fill={PAPER.light} stroke={PAPER.line} strokeWidth={1} strokeLinejoin="round"
      />
    </Svg>
  );
});

export const EnvelopeShadow = memo(function EnvelopeShadow({ isDark }) {
  const tint = isDark ? "#000000" : "#282D5A";
  return (
    <Svg width={88} height={16} viewBox="0 0 88 16">
      <Defs>
        <RadialGradient id="tendEnvShadow" cx="50%" cy="50%" rx="50%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={tint} stopOpacity={isDark ? 0.6 : 0.24} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={44} cy={8} rx={44} ry={8} fill="url(#tendEnvShadow)" />
    </Svg>
  );
});
