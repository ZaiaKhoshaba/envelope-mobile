// tests/budgetMath.test.mjs
// Run with: npm test  (node --test tests/)
// Pure-function tests for the money maths — no React Native required.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  round2,
  newId,
  buildProportionalPlans,
  computeTotals,
  getEnvelopeDueDate,
  projectedIncomeBeforeDate,
  findRuleMatch,
  ruleKeyFromMerchant,
} from "../lib/budgetMath.js";

/* ── round2 ─────────────────────────────────────────────────────────────────── */

describe("round2", () => {
  test("rounds to cents", () => {
    assert.equal(round2(10.005), 10.01);
    assert.equal(round2(10.004), 10.0);
    assert.equal(round2(0.1 + 0.2), 0.3); // classic float drift
  });

  test("handles junk input", () => {
    assert.equal(round2(null), 0);
    assert.equal(round2(undefined), 0);
    assert.equal(round2("abc"), 0);
  });
});

/* ── newId ──────────────────────────────────────────────────────────────────── */

describe("newId", () => {
  test("no collisions in a tight loop", () => {
    const ids = new Set();
    for (let i = 0; i < 5000; i++) ids.add(newId("tx"));
    assert.equal(ids.size, 5000);
  });
});

/* ── buildProportionalPlans ─────────────────────────────────────────────────── */

describe("buildProportionalPlans", () => {
  const envs = [
    { id: "rent",    type: "fixed",    target: 1500, amount: 0 },
    { id: "car",     type: "fixed",    target: 500,  amount: 0 },
    { id: "food",    type: "flexible", target: 400,  amount: 0 },
    { id: "holiday", type: "savings",  contributionAmount: 100, amount: 0 },
  ];

  test("fixed envelopes split income by target share", () => {
    const plans = buildProportionalPlans(1000, envs);
    const rent = plans.find(p => p.envId === "rent");
    const car  = plans.find(p => p.envId === "car");
    assert.equal(rent.allocation, 750); // 1500/2000 of $1000
    assert.equal(car.allocation, 250);  // 500/2000 of $1000
  });

  test("fixed allocation is capped at remaining need", () => {
    const nearlyFull = [{ id: "rent", type: "fixed", target: 100, amount: 90 }];
    const plans = buildProportionalPlans(1000, nearlyFull);
    assert.equal(plans[0].allocation, 10); // only needs $10 more
  });

  test("savings get flat contribution", () => {
    const plans = buildProportionalPlans(1000, envs);
    const hol = plans.find(p => p.envId === "holiday");
    assert.equal(hol.allocation, 100);
    assert.equal(hol.isSavings, true);
  });

  test("savings percentage contribution", () => {
    const pctEnv = [{ id: "s", type: "savings", contributionPct: 10, amount: 0 }];
    const plans = buildProportionalPlans(2000, pctEnv);
    assert.equal(plans[0].allocation, 200);
  });

  test("flexible envelopes receive the remainder (stage 3)", () => {
    // Income 3000: fixed need 2000 total → rent 1500, car 500 (capped at need).
    // Savings takes 100. Remainder 400 flows to food (target 400).
    const plans = buildProportionalPlans(3000, envs);
    const food = plans.find(p => p.envId === "food");
    assert.ok(food, "flexible envelope should be funded");
    assert.equal(food.allocation, 400);
  });

  test("flexible gets nothing when fixed+savings consume all income", () => {
    const plans = buildProportionalPlans(1000, envs); // fixed soak up 1000
    const food = plans.find(p => p.envId === "food");
    assert.equal(food, undefined);
  });

  test("zero / negative income yields no plans", () => {
    assert.deepEqual(buildProportionalPlans(0, envs), []);
    assert.deepEqual(buildProportionalPlans(-50, envs), []);
  });
});

/* ── computeTotals ──────────────────────────────────────────────────────────── */

describe("computeTotals", () => {
  test("basic income minus allocated spends", () => {
    const txs = [
      { kind: "income", amount: 2000 },
      { kind: "spend",  amount: -300, allocated: true },
      { kind: "spend",  amount: -100, allocated: false }, // pending — not deducted
    ];
    const envs = [{ amount: 500 }];
    const t = computeTotals(envs, txs);
    assert.equal(t.total, 1700);
    assert.equal(t.allocated, 500);
    assert.equal(t.unallocated, 1200);
    assert.equal(t.overallocated, 0);
  });

  test("overallocation is surfaced, not hidden", () => {
    const txs  = [{ kind: "income", amount: 1000 }];
    const envs = [{ amount: 1400 }]; // budgeted more than exists
    const t = computeTotals(envs, txs);
    assert.equal(t.unallocated, -400);   // NOT clamped to 0
    assert.equal(t.overallocated, 400);  // surfaced for the UI banner
  });

  test("empty state", () => {
    const t = computeTotals([], []);
    assert.equal(t.total, 0);
    assert.equal(t.unallocated, 0);
    assert.equal(t.overallocated, 0);
  });
});

/* ── getEnvelopeDueDate ─────────────────────────────────────────────────────── */

describe("getEnvelopeDueDate", () => {
  const now = new Date(2026, 0, 15); // 15 Jan 2026 (Thursday)

  test("monthly: this month if still ahead", () => {
    const d = getEnvelopeDueDate({ targetFrequency: "monthly", targetDate: "20" }, now);
    assert.equal(d.getMonth(), 0);
    assert.equal(d.getDate(), 20);
  });

  test("monthly: rolls to next month when day has passed", () => {
    const d = getEnvelopeDueDate({ targetFrequency: "monthly", targetDate: "10" }, now);
    assert.equal(d.getMonth(), 1); // February
    assert.equal(d.getDate(), 10);
  });

  test("weekly: next occurrence of the day", () => {
    const d = getEnvelopeDueDate({ targetFrequency: "weekly", targetDate: "Mon" }, now);
    assert.equal(d.getDay(), 1);
    assert.ok(d > now);
  });

  test("yearly: due month ahead this year", () => {
    const d = getEnvelopeDueDate(
      { targetFrequency: "yearly", targetDate: "6", targetDay: "15" }, now);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 5); // June
    assert.equal(d.getDate(), 15);
  });

  test("yearly: rolls a full year when month has passed", () => {
    const nowJul = new Date(2026, 6, 1);
    const d = getEnvelopeDueDate(
      { targetFrequency: "yearly", targetDate: "3", targetDay: "1" }, nowJul);
    assert.equal(d.getFullYear(), 2027);
    assert.equal(d.getMonth(), 2); // March
  });

  test("quarterly: advances by 3-month periods", () => {
    const nowMay = new Date(2026, 4, 10);
    const d = getEnvelopeDueDate(
      { targetFrequency: "quarterly", targetDate: "1", targetDay: "1" }, nowMay);
    // Jan 1 passed → Apr 1 passed → Jul 1
    assert.equal(d.getMonth(), 6);
    assert.equal(d.getDate(), 1);
  });

  test("invalid input returns null", () => {
    assert.equal(getEnvelopeDueDate({ targetFrequency: "monthly", targetDate: "" }, now), null);
    assert.equal(getEnvelopeDueDate({ targetFrequency: "yearly", targetDate: "13" }, now), null);
    assert.equal(getEnvelopeDueDate({ targetFrequency: "weekly", targetDate: "Xyz" }, now), null);
  });
});

/* ── projectedIncomeBeforeDate ──────────────────────────────────────────────── */

describe("projectedIncomeBeforeDate", () => {
  const now = new Date(2026, 0, 1); // 1 Jan 2026

  test("counts monthly pays before due date", () => {
    const schedule = { amount: 1000, frequency: "monthly", dayOfMonth: 15 };
    const due = new Date(2026, 3, 1); // 1 Apr → pays on 15 Jan, 15 Feb, 15 Mar
    assert.equal(projectedIncomeBeforeDate(schedule, due, now), 3000);
  });

  test("counts weekly pays before due date", () => {
    const schedule = {
      amount: 500, frequency: "weekly",
      anchorDate: new Date(2025, 11, 29).toISOString(), // Mon 29 Dec 2025
    };
    const due = new Date(2026, 0, 29); // 4 weekly pays: 5, 12, 19, 26 Jan
    assert.equal(projectedIncomeBeforeDate(schedule, due, now), 2000);
  });

  test("no schedule → zero", () => {
    assert.equal(projectedIncomeBeforeDate(null, new Date(), now), 0);
    assert.equal(projectedIncomeBeforeDate({ amount: 0 }, new Date(), now), 0);
  });
});

/* ── categorisation rules ───────────────────────────────────────────────────── */

describe("rules", () => {
  const rules = [
    { id: "r1", match: "woolworths", envelopeId: "groceries" },
    { id: "r2", match: "shell",      envelopeId: "fuel" },
  ];

  test("case-insensitive substring match", () => {
    assert.equal(findRuleMatch(rules, "WOOLWORTHS METRO 2041").envelopeId, "groceries");
    assert.equal(findRuleMatch(rules, "Shell Coles Express").envelopeId, "fuel");
  });

  test("no match returns null", () => {
    assert.equal(findRuleMatch(rules, "Bunnings"), null);
    assert.equal(findRuleMatch(rules, ""), null);
    assert.equal(findRuleMatch([], "Woolworths"), null);
  });

  test("ruleKeyFromMerchant strips store numbers and lowercases", () => {
    assert.equal(ruleKeyFromMerchant("Woolworths 2041"), "woolworths");
    assert.equal(ruleKeyFromMerchant("  BP Connect  "), "bp connect");
  });
});
