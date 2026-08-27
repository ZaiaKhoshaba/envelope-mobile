// lib/budgetMath.js
// Pure budget/money maths — no React, no React Native imports.
// Everything here is unit-testable with plain Node (see tests/budgetMath.test.mjs).

/** Round to cents. Use this for EVERY balance mutation so floats never drift. */
export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Collision-safe ID: prefix + timestamp + random suffix. */
export function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* -----------------------------------------------------------
   Proportional payday allocation
   Stage 1 — fixed envelopes: income is split by target share,
             capped at each envelope's remaining need.
   Stage 2 — savings envelopes: flat or % contribution on top.
   Stage 3 — flexible envelopes with a target: whatever income
             remains after stages 1–2 tops them up proportionally,
             capped at their target. (Previously flexible envelopes
             were never auto-funded at all.)
----------------------------------------------------------- */
export function buildProportionalPlans(incomeAmount, envelopes) {
  const income = Number(incomeAmount) || 0;
  if (income <= 0) return [];

  // ── Stage 1: fixed envelopes ────────────────────────────────────────────────
  const fixedEnvs   = envelopes.filter(e => e.type === "fixed" && Number(e.target) > 0);
  const totalTarget = fixedEnvs.reduce((sum, e) => sum + Number(e.target), 0);

  const fixedPlans = totalTarget
    ? fixedEnvs.map(env => {
        const proportion = Number(env.target) / totalTarget;
        const gross      = income * proportion;
        const stillNeeds = Math.max(0, Number(env.target) - Number(env.amount || 0));
        const allocation = round2(Math.min(gross, stillNeeds));
        return { envId: env.id, proportion, gross, allocation, isSavings: false };
      }).filter(p => p.allocation > 0.004)
    : [];

  // ── Stage 2: savings envelopes ──────────────────────────────────────────────
  const savingsEnvs  = envelopes.filter(e => e.type === "savings");
  const savingsPlans = savingsEnvs.map(env => {
    const pct = Number(env.contributionPct    || 0);
    const amt = Number(env.contributionAmount || 0);
    let allocation = 0;
    if (pct > 0)      allocation = round2(income * (pct / 100));
    else if (amt > 0) allocation = round2(amt);
    return { envId: env.id, proportion: pct / 100, gross: allocation, allocation, isSavings: true };
  }).filter(p => p.allocation > 0.004);

  // ── Stage 3: flexible envelopes get the remainder ───────────────────────────
  const committed = [...fixedPlans, ...savingsPlans]
    .reduce((s, p) => s + p.allocation, 0);
  let remaining = round2(income - committed);

  const flexPlans = [];
  if (remaining > 0.004) {
    const flexEnvs = envelopes.filter(e =>
      (e.type === "flexible" || (!e.type && e.type !== "fixed")) &&
      e.type !== "fixed" && e.type !== "savings" &&
      Number(e.target) > 0
    );
    const flexTarget = flexEnvs.reduce((s, e) => s + Number(e.target), 0);
    if (flexTarget > 0) {
      for (const env of flexEnvs) {
        const proportion = Number(env.target) / flexTarget;
        const gross      = remaining * proportion;
        const stillNeeds = Math.max(0, Number(env.target) - Number(env.amount || 0));
        const allocation = round2(Math.min(gross, stillNeeds));
        if (allocation > 0.004) {
          flexPlans.push({ envId: env.id, proportion, gross, allocation, isSavings: false, isFlexible: true });
        }
      }
    }
  }

  return [...fixedPlans, ...savingsPlans, ...flexPlans];
}

/* -----------------------------------------------------------
   Totals
   NOTE: unallocated is deliberately NOT clamped at zero.
   A negative value means the user has budgeted money they don't
   have (overallocation) — the UI must surface that, not hide it.
----------------------------------------------------------- */
export function computeTotals(envelopes, transactions, bankBalance = null) {
  const totalIncome = (transactions || []).reduce((sum, t) => {
    if (t.kind === "income") return sum + (Number(t.amount) || 0);
    return sum;
  }, 0);

  // Only deduct spends that have been allocated — unallocated spends don't
  // affect the total until the user assigns them to an envelope.
  const allocatedSpendTotal = (transactions || []).reduce((sum, t) => {
    if (t.kind === "spend" && t.allocated) {
      return sum + Math.abs(Number(t.amount) || 0);
    }
    return sum;
  }, 0);

  const envelopeSum = (envelopes || []).reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  // When a bank is connected, the live balance (summed across all connected
  // accounts) is the source of truth for the top line and supersedes the manual
  // income ledger. Otherwise fall back to income − allocated spends (manual mode).
  const ledgerTotal   = round2(totalIncome - allocatedSpendTotal);
  const total         = bankBalance != null ? round2(bankBalance) : ledgerTotal;
  const allocated     = round2(envelopeSum);
  const unallocated   = round2(total - envelopeSum);
  const overallocated = unallocated < -0.004 ? round2(-unallocated) : 0;

  return { total, allocated, unallocated, overallocated };
}

/* -----------------------------------------------------------
   Envelope due dates & income forecasting
----------------------------------------------------------- */
const DOW_MAP = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

const LONG_PERIOD_MONTHS = { quarterly: 3, "half-yearly": 6, yearly: 12 };

export function getEnvelopeDueDate(env, now = new Date()) {
  const { targetFrequency, targetDate } = env;
  if (!targetFrequency || !targetDate) return null;

  if (targetFrequency === "weekly") {
    const jsDay = DOW_MAP[targetDate];
    if (jsDay === undefined) return null;
    const d = new Date(now);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== jsDay);
    return d;
  }

  // Quarterly / half-yearly / yearly: targetDate = month (1–12), targetDay = day (1–31)
  const periodMonths = LONG_PERIOD_MONTHS[targetFrequency];
  if (periodMonths) {
    const dueMonth = Number(targetDate);
    const dueDay   = Number(env.targetDay || 1);
    if (!dueMonth || dueMonth < 1 || dueMonth > 12) return null;
    let d = new Date(now.getFullYear(), dueMonth - 1, dueDay);
    while (d <= now) d = new Date(d.getFullYear(), d.getMonth() + periodMonths, dueDay);
    return d;
  }

  // Monthly / fortnightly: targetDate is day of month
  const dom = Number(targetDate);
  if (!dom || dom < 1 || dom > 31) return null;
  let d = new Date(now.getFullYear(), now.getMonth(), dom);
  if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, dom);
  return d;
}

export function projectedIncomeBeforeDate(incomeSchedule, dueDate, now = new Date()) {
  if (!incomeSchedule?.amount || !dueDate) return 0;
  const { amount, frequency, dayOfMonth, anchorDate } = incomeSchedule;
  let count = 0;
  if (frequency === "weekly" || frequency === "fortnightly") {
    const interval = frequency === "weekly" ? 7 : 14;
    let base = anchorDate ? new Date(anchorDate) : new Date(now);
    if (isNaN(base.getTime())) base = new Date(now);
    while (base <= now) base = new Date(base.getTime() + interval * 86400000);
    while (base < dueDate) { count++; base = new Date(base.getTime() + interval * 86400000); }
  } else {
    const dom = Number(dayOfMonth) || 1;
    let d = new Date(now.getFullYear(), now.getMonth(), dom);
    if (d <= now) d = new Date(d.getFullYear(), d.getMonth() + 1, dom);
    while (d < dueDate) { count++; d = new Date(d.getFullYear(), d.getMonth() + 1, dom); }
  }
  return count * amount;
}

/* -----------------------------------------------------------
   Categorisation rules
   A rule maps a merchant substring to an envelope:
     { id, match: "woolworths", envelopeId: "e_123" }
   Matching is case-insensitive substring in either direction so
   "Woolworths Metro 2041" still matches a rule learned from
   "Woolworths".
----------------------------------------------------------- */
export function findRuleMatch(rules, merchant) {
  const m = String(merchant || "").trim().toLowerCase();
  if (!m) return null;
  return (rules || []).find(r => {
    const match = String(r.match || "").toLowerCase();
    return match && (m.includes(match) || match.includes(m));
  }) || null;
}

/** Normalise a merchant string into a rule match key (strips store numbers etc.). */
export function ruleKeyFromMerchant(merchant) {
  return String(merchant || "")
    .trim()
    .toLowerCase()
    .replace(/\s+\d+$/, "")     // trailing store numbers: "woolworths 2041"
    .replace(/\s{2,}/g, " ")
    .slice(0, 40);
}
