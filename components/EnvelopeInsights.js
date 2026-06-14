// components/EnvelopeInsights.js
// Per-envelope Insights tab: line chart + avg spend/day vs budget/day + month-over-month

import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import Svg, {
  Polyline,
  Polygon,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useTheme, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";

// ── Chart constants ────────────────────────────────────────────────────────────

const CHART_H      = 180;
const PAD_LEFT     = 38;
const PAD_RIGHT    = 12;
const PAD_TOP      = 12;
const PAD_BOTTOM   = 24;

// ── Range options ──────────────────────────────────────────────────────────────

const RANGES = [
  { key: "30d",  label: "30d",  days: 30  },
  { key: "3m",   label: "3m",   days: 90  },
  { key: "6m",   label: "6m",   days: 180 },
  { key: "all",  label: "All",  days: null },
];

// ── Data helpers ───────────────────────────────────────────────────────────────

function spendInPeriod(transactions, envId, from, to) {
  return transactions
    .filter(t => {
      if (t.kind !== "spend") return false;
      if (!(t.allocations || []).some(a => a.sourceId === envId)) return false;
      const d = new Date(t.postedAt || t.createdAt);
      return d >= from && d <= to;
    })
    .reduce((sum, t) =>
      sum + (t.allocations || [])
        .filter(a => a.sourceId === envId)
        .reduce((s, a) => s + (a.used || 0), 0),
      0
    );
}

function buildDailyBuckets(transactions, envId, startDate, endDate) {
  const buckets = {};
  transactions.forEach(t => {
    if (t.kind !== "spend") return;
    if (!(t.allocations || []).some(a => a.sourceId === envId)) return;
    const d = new Date(t.postedAt || t.createdAt);
    if (d < startDate || d > endDate) return;
    const key = d.toISOString().slice(0, 10);
    const amt = (t.allocations || [])
      .filter(a => a.sourceId === envId)
      .reduce((s, a) => s + (a.used || 0), 0);
    buckets[key] = (buckets[key] || 0) + amt;
  });
  return buckets;
}

function buildCumulativePoints(buckets, startDate, endDate, cw) {
  const totalDays = Math.max(
    1,
    Math.round((endDate - startDate) / 86_400_000)
  );
  const points = [];
  let cumulative = 0;
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startDate.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    cumulative += buckets[key] || 0;
    points.push({ i, totalDays, cumulative });
  }
  return points;
}

function toSvgPoints(cumulativePoints, maxVal, cw) {
  const plotW = cw - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  return cumulativePoints.map(({ i, totalDays, cumulative }) => ({
    x: PAD_LEFT + (i / totalDays) * plotW,
    y: PAD_TOP  + (1 - (maxVal > 0 ? cumulative / maxVal : 0)) * plotH,
    cumulative,
  }));
}

function polylineStr(pts) {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function fillPolygonStr(pts, cw) {
  if (!pts.length) return "";
  const bottom = (CHART_H - PAD_BOTTOM).toFixed(1);
  const first  = `${pts[0].x.toFixed(1)},${bottom}`;
  const last   = `${pts[pts.length - 1].x.toFixed(1)},${bottom}`;
  return `${first} ${polylineStr(pts)} ${last}`;
}

// ── Y-axis tick values ─────────────────────────────────────────────────────────

function yTicks(maxVal) {
  if (maxVal <= 0) return [];
  // 3 ticks: 0, half, max
  return [0, 0.5, 1].map(pct => ({
    pct,
    label: pct === 0 ? "$0" : `$${Math.round(pct * maxVal)}`,
    y: PAD_TOP + (1 - pct) * (CHART_H - PAD_TOP - PAD_BOTTOM),
  }));
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function EnvelopeInsights({ env, transactions }) {
  const { colors }    = useTheme();
  const [range, setRange] = useState("30d");
  const screenW = Dimensions.get("window").width;
  // Chart width = screen - outer padding both sides - card padding both sides - border*2
  const [cw, setCw] = useState(screenW - spacing.lg * 2 - spacing.lg * 2 - 2);

  const rangeConfig = RANGES.find(r => r.key === range);

  const data = useMemo(() => {
    const now      = new Date();
    const endDate  = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Start date
    const startDate = new Date(now);
    if (rangeConfig.days) {
      startDate.setDate(startDate.getDate() - rangeConfig.days + 1);
    } else {
      // All time: earliest transaction for this envelope
      const allDates = transactions
        .filter(t => (t.allocations || []).some(a => a.sourceId === env.id))
        .map(t => new Date(t.postedAt || t.createdAt).getTime())
        .filter(Boolean);
      const earliest = allDates.length ? Math.min(...allDates) : now.getTime();
      startDate.setTime(earliest);
    }
    startDate.setHours(0, 0, 0, 0);

    const target = Number(env.target || 0);

    // Build chart data
    const buckets    = buildDailyBuckets(transactions, env.id, startDate, endDate);
    const cumPts     = buildCumulativePoints(buckets, startDate, endDate, cw);
    const totalSpent = cumPts[cumPts.length - 1]?.cumulative ?? 0;
    const maxVal     = Math.max(totalSpent, target, 0.01);
    const svgPts     = toSvgPoints(cumPts, maxVal, cw);

    // Projected line (only if target is set)
    const plotW  = cw - PAD_LEFT - PAD_RIGHT;
    const plotH  = CHART_H - PAD_TOP - PAD_BOTTOM;
    const projPts = target > 0
      ? [
          { x: PAD_LEFT,           y: PAD_TOP + plotH },  // (start, 0)
          { x: PAD_LEFT + plotW,   y: PAD_TOP         },  // (end, target)
        ]
      : [];

    // ── Stats ──────────────────────────────────────────────────────────────────
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const thisMonthSpend = spendInPeriod(transactions, env.id, thisMonthStart, endDate);
    const lastMonthSpend = spendInPeriod(transactions, env.id, lastMonthStart, lastMonthEnd);

    const momDiff = thisMonthSpend - lastMonthSpend;
    const momPct  = lastMonthSpend > 0 ? (momDiff / lastMonthSpend) * 100 : null;

    const daysElapsed   = Math.max(1, Math.floor((now - thisMonthStart) / 86_400_000) + 1);
    const daysInMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const avgSpendPerDay = thisMonthSpend / daysElapsed;
    const budgetPerDay   = target > 0 ? target / daysInMonth : null;

    const overUnder = budgetPerDay !== null
      ? avgSpendPerDay - budgetPerDay
      : null;

    return {
      svgPts,
      projPts,
      maxVal,
      totalSpent,
      hasData: totalSpent > 0.005,
      thisMonthSpend,
      lastMonthSpend,
      momDiff,
      momPct,
      avgSpendPerDay,
      budgetPerDay,
      overUnder,
      target,
    };
  }, [env, transactions, range, cw]);

  const ticks = yTicks(data.maxVal);

  return (
    <View style={{ gap: spacing.lg }}>

      {/* ── Range selector ── */}
      <View style={[st.rangeRow, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[st.rangeBtn, range === r.key && { backgroundColor: colors.accent }]}
            onPress={() => setRange(r.key)}
            activeOpacity={0.8}
          >
            <Text style={[st.rangeTxt, { color: range === r.key ? "#fff" : colors.textSecondary }]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Chart card ── */}
      <View
        style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onLayout={e => setCw(Math.max(100, e.nativeEvent.layout.width - spacing.lg * 2 - 2))}
      >
        <Text style={[st.cardTitle, { color: colors.textSecondary }]}>
          CUMULATIVE SPEND
        </Text>

        {!data.hasData ? (
          <View style={st.emptyChart}>
            <Text style={{ color: colors.textMuted, fontSize: typography.sm, textAlign: "center" }}>
              No spend recorded in this period
            </Text>
          </View>
        ) : (
          <Svg width={cw} height={CHART_H}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0"   stopColor={colors.accent} stopOpacity="0.25" />
                <Stop offset="1"   stopColor={colors.accent} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            {ticks.map(tick => (
              <Line
                key={tick.pct}
                x1={PAD_LEFT} y1={tick.y}
                x2={cw - PAD_RIGHT} y2={tick.y}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            ))}

            {/* Y-axis labels */}
            {ticks.map(tick => (
              <SvgText
                key={`lbl-${tick.pct}`}
                x={PAD_LEFT - 4}
                y={tick.y + 4}
                textAnchor="end"
                fontSize={9}
                fill={colors.textMuted}
              >
                {tick.label}
              </SvgText>
            ))}

            {/* Projected / budget-pace dashed line */}
            {data.projPts.length === 2 && (
              <Line
                x1={data.projPts[0].x} y1={data.projPts[0].y}
                x2={data.projPts[1].x} y2={data.projPts[1].y}
                stroke={colors.warning}
                strokeWidth={1.5}
                strokeDasharray="6,4"
              />
            )}

            {/* Fill under actual line */}
            {data.svgPts.length > 1 && (
              <Polygon
                points={fillPolygonStr(data.svgPts, cw)}
                fill="url(#fill)"
              />
            )}

            {/* Actual spend line */}
            {data.svgPts.length > 1 && (
              <Polyline
                points={polylineStr(data.svgPts)}
                fill="none"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* End dot */}
            {data.svgPts.length > 0 && (() => {
              const last = data.svgPts[data.svgPts.length - 1];
              return (
                <Circle
                  cx={last.x} cy={last.y}
                  r={4}
                  fill={colors.accent}
                  stroke={colors.card}
                  strokeWidth={2}
                />
              );
            })()}
          </Svg>
        )}

        {/* Legend */}
        <View style={st.legend}>
          <View style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={[st.legendTxt, { color: colors.textSecondary }]}>Actual spend</Text>
          </View>
          {data.target > 0 && (
            <View style={st.legendItem}>
              <View style={[st.legendDash, { borderColor: colors.warning }]} />
              <Text style={[st.legendTxt, { color: colors.textSecondary }]}>Budget pace</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Stat cards row ── */}
      <View style={{ flexDirection: "row", gap: spacing.md }}>

        {/* Avg spend/day vs budget/day */}
        <View style={[st.card, st.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.cardTitle, { color: colors.textSecondary }]}>AVG / DAY</Text>
          <Text style={[st.statBig, { color: colors.textPrimary }]}>
            ${fmt(data.avgSpendPerDay)}
          </Text>

          {data.budgetPerDay !== null && (
            <>
              <View style={[st.statDivider, { backgroundColor: colors.border }]} />
              <Text style={[st.cardTitle, { color: colors.textSecondary }]}>BUDGET / DAY</Text>
              <Text style={[st.statMid, {
                color: data.overUnder > 0.005 ? colors.danger : colors.success,
              }]}>
                ${fmt(data.budgetPerDay)}
              </Text>
              {data.overUnder !== null && (
                <Text style={[st.statSub, {
                  color: data.overUnder > 0.005 ? colors.danger : colors.success,
                }]}>
                  {data.overUnder > 0.005
                    ? `↑ $${fmt(data.overUnder)}/day over`
                    : `↓ $${fmt(Math.abs(data.overUnder))}/day under`}
                </Text>
              )}
            </>
          )}
          {data.budgetPerDay === null && (
            <Text style={[st.statSub, { color: colors.textMuted }]}>
              Set a target to compare
            </Text>
          )}
        </View>

        {/* Month-over-month */}
        <View style={[st.card, st.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[st.cardTitle, { color: colors.textSecondary }]}>THIS MONTH</Text>
          <Text style={[st.statBig, { color: colors.textPrimary }]}>
            ${fmt(data.thisMonthSpend)}
          </Text>

          {data.lastMonthSpend > 0.005 ? (
            <>
              <View style={[st.statDivider, { backgroundColor: colors.border }]} />
              <Text style={[st.cardTitle, { color: colors.textSecondary }]}>VS LAST MONTH</Text>
              <Text style={[st.statMid, {
                color: data.momDiff > 0.005 ? colors.danger : colors.success,
              }]}>
                {data.momDiff > 0.005 ? "+" : data.momDiff < -0.005 ? "-" : ""}
                ${fmt(Math.abs(data.momDiff))}
              </Text>
              {data.momPct !== null && (
                <Text style={[st.statSub, {
                  color: data.momDiff > 0.005 ? colors.danger : colors.success,
                }]}>
                  {data.momDiff > 0.005 ? "↑" : "↓"}{" "}
                  {Math.abs(Math.round(data.momPct))}% vs last month
                </Text>
              )}
            </>
          ) : (
            <>
              <View style={[st.statDivider, { backgroundColor: colors.border }]} />
              <Text style={[st.statSub, { color: colors.textMuted, marginTop: spacing.xs }]}>
                No spend last month
              </Text>
            </>
          )}
        </View>
      </View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.xs,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  emptyChart: {
    height: CHART_H,
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 16,
    height: 0,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  legendTxt: {
    fontSize: typography.xs,
  },
  rangeRow: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  rangeTxt: {
    fontSize: typography.xs,
    fontWeight: "700",
  },
  statBig: {
    fontSize: typography.xl,
    fontWeight: "800",
  },
  statMid: {
    fontSize: typography.lg,
    fontWeight: "700",
  },
  statSub: {
    fontSize: typography.xs,
    fontWeight: "600",
  },
  statDivider: {
    height: 1,
    marginVertical: spacing.xs,
  },
});
