// context/BudgetContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { fmt } from "../lib/format";
import {
  round2,
  newId,
  buildProportionalPlans,
  computeTotals,
  findRuleMatch,
  ruleKeyFromMerchant,
} from "../lib/budgetMath";

// Re-export so screens can keep importing from the context module
export { buildProportionalPlans };

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

const BudgetContext = createContext(null);

/* -----------------------------------------------------------
   DEFAULT STATE — includes incomeSchedule + categorisation rules
----------------------------------------------------------- */
const defaultState = {
  envelopes: [],
  transactions: [],
  total: 0,
  allocated: 0,
  unallocated: 0,
  overallocated: 0,
  bankBalance: null, // null = manual mode; a number = live bank balance supersedes the manual total
  lastBalanceSync: null, // timestamp (ms) of the last successful bank-balance fetch
  bankAccountCount: 0,   // how many bank accounts are feeding that balance
  // When the bank was first connected. Spending from before this is history the
  // user was never going to allocate; spending after it is live and needs sorting.
  bankConnectedAt: null,
  balanceAsOf: null,      // when the BANK last updated the balance (from Fiskil as_of)
  cycle: null,

  // Income schedule for smart auto-allocation
  incomeSchedule: {
    amount: null,
    frequency: null, // "weekly" | "fortnightly" | "monthly"
    dayOfWeek: null, // 1–7 (Mon–Sun) if weekly/fortnightly
    dayOfMonth: null, // 1–31 if monthly
    anchorDate: null, // ISO string
  },

  // Merchant → envelope categorisation rules, learned from user allocations
  // Shape: { id, match, envelopeId }
  rules: [],

  // Spend waiting to be assigned to an envelope (drives SpendChooserModal)
  // Shape: { id, merchant, amount, remaining, postedAt } | null
  pendingSpend: null,
};

/* -----------------------------------------------------------
   REDUCER
----------------------------------------------------------- */
function reducer(state, action) {
  switch (action.type) {
    case "LOAD_STATE": {
      const incoming = action.payload || {};

      const envelopes = Array.isArray(incoming.envelopes)
        ? incoming.envelopes.map((env) => ({
            ...env,
            type: env.type || "fixed",
            amount: Number(env.amount || 0),
            target: env.target != null ? Number(env.target) : 0,
            targetFrequency: env.targetFrequency || env.freq || "monthly",
            targetDate:
              env.targetDate !== undefined && env.targetDate !== null
                ? String(env.targetDate)
                : "",
            contributionAmount: Number(env.contributionAmount || 0),
            contributionPct:    Number(env.contributionPct    || 0),
            goalAmount:         env.goalAmount != null ? Number(env.goalAmount) : null,
          }))
        : state.envelopes;

      const transactions = Array.isArray(incoming.transactions)
        ? incoming.transactions
        : state.transactions;

      const rules = Array.isArray(incoming.rules) ? incoming.rules : state.rules;

      return {
        ...state,
        ...incoming,
        envelopes,
        transactions,
        rules,
      };
    }

    case "ADD_ENVELOPE": {
      const e = action.envelope || {};
      const normalised = {
        id: e.id,
        name: e.name || "",
        emoji: e.emoji || "",
        notes: e.notes || null,
        amount: Number(e.amount || 0),
        type: e.type || "fixed",
        rollover: !!e.rollover,
        target:
          e.target != null
            ? Number(e.target)
            : e.targetBudget != null
            ? Number(e.targetBudget)
            : 0,
        targetFrequency: e.targetFrequency || e.freq || "monthly",
        targetDate: e.targetDate
          ? String(e.targetDate)
          : e.date
          ? String(e.date)
          : "",
        contributionAmount: Number(e.contributionAmount || 0),
        contributionPct:    Number(e.contributionPct    || 0),
        goalAmount:         e.goalAmount != null ? Number(e.goalAmount) : null,
      };
      return {
        ...state,
        envelopes: [...state.envelopes, normalised],
      };
    }

    case "UPDATE_ENVELOPE":
      return {
        ...state,
        envelopes: state.envelopes.map((e) =>
          e.id === action.id
            ? {
                ...e,
                ...action.updates,
                target:
                  action.updates.target != null
                    ? Number(action.updates.target)
                    : e.target,
                amount:
                  action.updates.amount != null
                    ? Number(action.updates.amount)
                    : e.amount,
                targetDate:
                  action.updates.targetDate !== undefined
                    ? action.updates.targetDate
                    : e.targetDate,
                targetFrequency:
                  action.updates.targetFrequency !== undefined
                    ? action.updates.targetFrequency
                    : e.targetFrequency,
                contributionAmount: action.updates.contributionAmount != null ? Number(action.updates.contributionAmount) : e.contributionAmount,
                contributionPct:    action.updates.contributionPct    != null ? Number(action.updates.contributionPct)    : e.contributionPct,
                goalAmount:         action.updates.goalAmount !== undefined
                  ? (action.updates.goalAmount != null ? Number(action.updates.goalAmount) : null)
                  : e.goalAmount,
              }
            : e
        ),
      };

    case "DELETE_ENVELOPE":
      return {
        ...state,
        envelopes: state.envelopes.filter((e) => e.id !== action.id),
        // Rules pointing at a deleted envelope are useless — drop them too
        rules: state.rules.filter((r) => r.envelopeId !== action.id),
      };

    case "ADD_TRANSACTION":
      return { ...state, transactions: [...state.transactions, action.tx] };

    case "SET_TRANSACTIONS":
      return { ...state, transactions: action.transactions };

    case "SET_INCOME_SCHEDULE":
      return {
        ...state,
        incomeSchedule: { ...state.incomeSchedule, ...action.payload },
      };

    case "SET_ENVELOPES":
      return { ...state, envelopes: action.envelopes };

    case "ALLOCATE":
      return {
        ...state,
        envelopes: action.envelopes,
        transactions: action.transactions,
      };

    case "SET_TOTALS":
      return {
        ...state,
        total: action.total,
        allocated: action.allocated,
        unallocated: action.unallocated,
        overallocated: action.overallocated,
      };

    case "SET_BANK_BALANCE":
      return {
        ...state,
        bankBalance:      action.bankBalance,
        lastBalanceSync:  action.lastBalanceSync ?? null,
        bankAccountCount: action.bankAccountCount ?? 0,
        // Stamped once, on the first successful connection; cleared on disconnect.
        bankConnectedAt:  action.bankBalance == null
          ? null
          : (state.bankConnectedAt || new Date().toISOString()),
        balanceAsOf:      action.balanceAsOf ?? null,
      };

    case "SET_BANK_CONNECTED_AT":
      // Stamped by the first import after a connection, so the boundary between
      // "history" and "needs allocating" does not depend on a balance arriving.
      return { ...state, bankConnectedAt: action.at || null };

    case "CLEAR_BANK_DATA":
      // Drop bank-imported transactions and revert the top line to manual mode.
      return {
        ...state,
        transactions: (state.transactions || []).filter((t) => !t.imported),
        bankBalance: null,
        lastBalanceSync: null,
        bankAccountCount: 0,
        bankConnectedAt: null,
        balanceAsOf: null,
      };

    // ── Categorisation rules ────────────────────────────────────────────────

    case "ADD_RULE": {
      const rule = action.rule;
      if (!rule?.match || !rule?.envelopeId) return state;
      // Upsert by match key — one rule per merchant
      const others = state.rules.filter((r) => r.match !== rule.match);
      return { ...state, rules: [...others, rule] };
    }

    case "REMOVE_RULE":
      return { ...state, rules: state.rules.filter((r) => r.id !== action.id) };

    // ── Pending spend (drives SpendChooserModal) ────────────────────────────

    case "SET_PENDING_SPEND":
      return { ...state, pendingSpend: action.pendingSpend };

    case "CLEAR_PENDING_SPEND":
      return { ...state, pendingSpend: null };

    // Partial allocation from one source; clears pendingSpend when remaining hits 0
    case "COMMIT_SPEND_PART":
      return {
        ...state,
        envelopes:    action.envelopes,
        transactions: action.transactions,
        pendingSpend: action.pendingSpend, // null when fully allocated
      };

    // Adopt a cloud copy while KEEPING this device's imported (CDR) transactions —
    // they are deliberately never synced, so a remote load must not wipe them.
    case "ADOPT_REMOTE": {
      const incoming    = action.payload || {};
      const incomingTxs = Array.isArray(incoming.transactions) ? incoming.transactions : [];
      const ids         = new Set(incomingTxs.map((t) => String(t.id)));
      const keptLocal   = state.transactions.filter(
        (t) => t.imported && !ids.has(String(t.id))
      );
      const mergedTxs = [...incomingTxs, ...keptLocal].sort((a, b) => {
        const ad = new Date(a.postedAt || 0).getTime();
        const bd = new Date(b.postedAt || 0).getTime();
        return bd - ad;
      });
      return reducer(state, {
        type: "LOAD_STATE",
        payload: { ...incoming, transactions: mergedTxs },
      });
    }

    case "RESET_ALL":
      return {
        ...defaultState,
        envelopes: [],
        transactions: [],
        rules: [],
        incomeSchedule: { ...defaultState.incomeSchedule },
        pendingSpend: null,
      };

    default:
      return state;
  }
}

/* -----------------------------------------------------------
   HELPER: proportional auto-allocation (see lib/budgetMath.js)
----------------------------------------------------------- */
function autoAllocateIncome({ incomeAmount, envelopes }) {
  if (!incomeAmount || incomeAmount <= 0) {
    return { envelopes, shortfall: 0 };
  }

  const plans = buildProportionalPlans(incomeAmount, envelopes);
  if (plans.length === 0) return { envelopes, shortfall: 0 };

  const updatedEnvelopes = envelopes.map(env => {
    const plan = plans.find(p => p.envId === env.id);
    if (!plan) return env;
    return { ...env, amount: round2((Number(env.amount) || 0) + plan.allocation) };
  });

  // shortfall = total still needed across all fixed envelopes after this pay
  const shortfall = updatedEnvelopes
    .filter(e => e.type === "fixed" && Number(e.target) > 0)
    .reduce((sum, e) => sum + Math.max(0, Number(e.target) - Number(e.amount)), 0);

  return { envelopes: updatedEnvelopes, shortfall: round2(shortfall) };
}

// The slice of state that gets persisted locally.
// pendingSpend is deliberately excluded (a stale modal shouldn't reappear
// on another device or after a restart).
function pickPersisted(state) {
  return {
    envelopes:      state.envelopes,
    transactions:   state.transactions,
    incomeSchedule: state.incomeSchedule,
    rules:          state.rules,
    cycle:          state.cycle,
  };
}

// The slice that syncs to the cloud. Bank-imported transactions are
// CDR-derived data and Tend's compliance posture (Fiskil ISQ Q4, ISP §5.1)
// is that CDR data is NEVER stored on Tend servers — it lives only on the
// user's own device. Envelope balances still sync, so budgets stay correct
// across devices; only the imported transaction records stay device-local.
function pickCloudPersisted(stateLike) {
  const base = pickPersisted(stateLike);
  return {
    ...base,
    transactions: (base.transactions || []).filter((t) => !t.imported),
  };
}

// Normalise any transaction-ish object (backend, webhook, or legacy shape)
function normalizeTx(t) {
  const amount = Number(t.amount || 0);
  return {
    id:          String(t.id || newId("bank")),
    kind:        t.kind || (amount >= 0 ? "income" : "spend"),
    amount,
    merchant:    t.merchant || t.counterparty || t.description || "Bank Transaction",
    description: t.description || t.narrative || t.merchant || "",
    imported:    true,
    postedAt:    t.postedAt || t.date || new Date().toISOString(),
    allocations: Array.isArray(t.allocations) ? t.allocations : [],
    allocated:   !!t.allocated,
  };
}

/* -----------------------------------------------------------
   PROVIDER
----------------------------------------------------------- */
export function BudgetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const { user, token } = useAuth();

  const tokenRef     = useRef(token);
  const hydratingRef = useRef(false);
  const stampRef     = useRef(null);   // ISO stamp of the latest local change
  const localTimer   = useRef(null);
  const remoteTimer  = useRef(null);

  useEffect(() => { tokenRef.current = token; }, [token]);

  /* -----------------------------------------------------------
     CLOUD SYNC — push (debounced)
  ----------------------------------------------------------- */
  const pushBudget = useCallback(async (blob, stamp) => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const r = await fetch(`${BACKEND_URL}/budget`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body:    JSON.stringify({ budget: blob, updatedAt: stamp }),
      });
      if (r.status === 401) return; // token expired — sync resumes after next login
      const j = await r.json().catch(() => null);
      if (j?.ok && j.stored === false && j.budget) {
        // Another device holds a newer copy — adopt it (keeps local CDR txs)
        hydratingRef.current = true;
        dispatch({ type: "ADOPT_REMOTE", payload: j.budget });
        stampRef.current = j.updatedAt || stampRef.current;
        setTimeout(() => { hydratingRef.current = false; }, 0);
      }
    } catch {
      // Offline / backend asleep — the local copy is safe; next change retries
    }
  }, []);

  /* -----------------------------------------------------------
     LOAD — local first, then reconcile with the cloud copy.
     Last write wins by timestamp.
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!user?.id) {
      dispatch({ type: "RESET_ALL" });
      return;
    }
    let cancelled = false;
    (async () => {
      hydratingRef.current = true;
      dispatch({ type: "RESET_ALL" }); // never bleed data across accounts

      let local = null;
      try {
        const saved = await AsyncStorage.getItem(`budgetState_${user.id}`);
        if (saved) local = JSON.parse(saved);
      } catch (e) {
        console.log("State load error:", e);
      }
      if (local && !cancelled) {
        dispatch({ type: "LOAD_STATE", payload: local });
        stampRef.current = local._updatedAt || null;
      }

      // Reconcile with the cloud copy
      try {
        const t = tokenRef.current;
        if (t) {
          const r = await fetch(`${BACKEND_URL}/budget`, {
            headers: { Authorization: `Bearer ${t}` },
          });
          if (r.ok) {
            const j = await r.json().catch(() => null);
            const remoteStamp = j?.updatedAt || null;
            const localStamp  = local?._updatedAt || null;

            if (j?.budget && (!localStamp || (remoteStamp && remoteStamp > localStamp))) {
              // Cloud copy is newer (or this is a fresh install) — adopt it,
              // preserving any device-local imported (CDR) transactions
              if (!cancelled) {
                dispatch({ type: "ADOPT_REMOTE", payload: j.budget });
                stampRef.current = remoteStamp;
              }
            } else if (local && localStamp && (!remoteStamp || localStamp > remoteStamp)) {
              // Local copy is newer — push it up (manual data only, no CDR)
              pushBudget(pickCloudPersisted(local), localStamp);
            }
          }
        }
      } catch {
        // Offline — local copy already loaded
      }

      if (!cancelled) hydratingRef.current = false;
    })();
    return () => { cancelled = true; };
  }, [user?.id, pushBudget]);

  /* -----------------------------------------------------------
     PERSIST — local write (short debounce) + cloud push (longer)
  ----------------------------------------------------------- */
  useEffect(() => {
    if (!user?.id || hydratingRef.current) return;

    const stamp = new Date().toISOString();
    stampRef.current = stamp;
    const blob = { ...pickPersisted(state), _updatedAt: stamp };

    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      AsyncStorage.setItem(`budgetState_${user.id}`, JSON.stringify(blob)).catch(() => {});
    }, 300);

    clearTimeout(remoteTimer.current);
    remoteTimer.current = setTimeout(() => {
      pushBudget(pickCloudPersisted(state), stamp);
    }, 3000);

    return () => {};
  }, [state, user?.id, pushBudget]);

  /* -----------------------------------------------------------
     COMPUTE TOTALS
  ----------------------------------------------------------- */
  const recomputeTotals = useCallback(() => {
    const t = computeTotals(state.envelopes, state.transactions, state.bankBalance);
    dispatch({ type: "SET_TOTALS", ...t });
  }, [state.envelopes, state.transactions, state.bankBalance]);

  useEffect(() => {
    recomputeTotals();
  }, [state.envelopes, state.transactions, state.bankBalance, recomputeTotals]);

  // Set (or clear) the live bank balance. Passing null reverts to manual mode.
  const setBankBalance = useCallback((amount, accountCount, asOf) => {
    dispatch({
      type:             "SET_BANK_BALANCE",
      bankBalance:      amount == null ? null : Number(amount),
      lastBalanceSync:  amount == null ? null : Date.now(),
      bankAccountCount: amount == null ? 0 : Number(accountCount || 0),
      // When the BANK last updated the figure. lastBalanceSync is only when we
      // asked; showing that as the age makes stale CDR data look current.
      balanceAsOf:      amount == null ? null : (asOf || null),
    });
  }, []);

  // Pull the latest total balance from the backend (summed across all connected
  // accounts) and update the top line. Safe to call on focus / foreground / pull.
  const refreshBankBalance = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const r = await fetch(`${BACKEND_URL}/fiskil/balance`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.ok) {
        const j = await r.json();
        if (typeof j.balance === "number") setBankBalance(j.balance, j.accountCount, j.asOf);
      }
    } catch { /* keep last known balance */ }
  }, [setBankBalance]);

  // Fully disconnect all linked banks: revoke every consent at Fiskil, then drop
  // bank-imported transactions locally and revert to manual mode.
  const disconnectBank = useCallback(async () => {
    const t = tokenRef.current;
    if (t) {
      try {
        await fetch(`${BACKEND_URL}/fiskil/disconnect`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${t}` },
        });
      } catch { /* best-effort — still clear locally */ }
    }
    dispatch({ type: "CLEAR_BANK_DATA" });
  }, []);

  /* -----------------------------------------------------------
     HELPERS
  ----------------------------------------------------------- */

  const setIncomeSchedule = useCallback((scheduleUpdates) => {
    dispatch({ type: "SET_INCOME_SCHEDULE", payload: scheduleUpdates });
  }, []);

  const addIncome = useCallback(
    (amountArg, descriptionArg, dateArg) => {
      const amount = round2(amountArg);
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid income amount" };
      }

      const postedAt = dateArg || new Date().toISOString();

      const tx = {
        id: newId("inc"),
        kind: "income",
        amount,
        imported: false,
        description: descriptionArg || "Income",
        postedAt,
        allocations: [],
      };

      const newTransactions = [...state.transactions, tx];

      const { envelopes: updatedEnvelopes, shortfall } = autoAllocateIncome({
        incomeAmount: amount,
        envelopes: state.envelopes,
      });

      dispatch({
        type: "ALLOCATE",
        envelopes: updatedEnvelopes,
        transactions: newTransactions,
      });

      return { ok: true, tx, shortfall };
    },
    [state.transactions, state.envelopes]
  );

  const allocateOutstanding = useCallback(
    (txId, sourceId) => {
      const tx = state.transactions.find((t) => t.id === txId);
      if (!tx) return;

      const amountAbs = Math.abs(Number(tx.amount) || 0);
      const existing = (tx.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
      const remaining = round2(amountAbs - existing);
      if (remaining <= 0) return;

      const envelopesCopy = [...state.envelopes];
      const transactionsCopy = state.transactions.map((t) =>
        t.id === txId ? { ...t, allocations: [...(t.allocations || [])] } : t
      );
      const txCopy = transactionsCopy.find((t) => t.id === txId);

      if (sourceId === "unallocated") {
        txCopy.allocations.push({ sourceId: "unallocated", used: remaining });
      } else {
        const env = envelopesCopy.find((e) => e.id === sourceId);
        if (env) {
          env.amount = round2(Math.max(0, (Number(env.amount) || 0) - remaining));
          txCopy.allocations.push({ sourceId: env.id, used: remaining });
        }
      }

      txCopy.allocated = true;

      dispatch({
        type: "ALLOCATE",
        envelopes: envelopesCopy,
        transactions: transactionsCopy,
      });
    },
    [state.envelopes, state.transactions]
  );

  const allocateToEnvelope = useCallback(
    (envelopeId, amountArg) => {
      const amount = round2(amountArg);
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid amount" };
      }

      const envelopes = state.envelopes.map((env) => {
        if (env.id !== envelopeId) return env;
        return { ...env, amount: round2((Number(env.amount) || 0) + amount) };
      });

      dispatch({ type: "SET_ENVELOPES", envelopes });
      return { ok: true };
    },
    [state.envelopes]
  );

  const deleteEnvelope = useCallback((id) => {
    dispatch({ type: "DELETE_ENVELOPE", id });
  }, []);

  const reorderEnvelopes = useCallback((newOrder) => {
    dispatch({ type: "SET_ENVELOPES", envelopes: newOrder });
  }, []);

  // editEnvelope(id, updates) — matches envelopes.js usage
  const editEnvelope = useCallback((id, updates) => {
    dispatch({ type: "UPDATE_ENVELOPE", id, updates });
  }, []);

  const addEnvelope = useCallback((envelope) => {
    dispatch({ type: "ADD_ENVELOPE", envelope });
  }, []);

  // transferBetweenEnvelopes — move funds from one envelope to another
  const transferBetweenEnvelopes = useCallback((fromId, toId, amount) => {
    const amt = round2(amount);
    if (!amt || amt <= 0) return { ok: false, message: "Invalid amount" };
    if (fromId === toId) return { ok: false, message: "Cannot transfer to the same envelope" };

    const from = state.envelopes.find(e => e.id === fromId);
    const to   = state.envelopes.find(e => e.id === toId);
    if (!from || !to) return { ok: false, message: "Envelope not found" };
    if (Number(from.amount) < amt) return { ok: false, message: "Insufficient balance" };

    const updated = state.envelopes.map(e => {
      if (e.id === fromId) return { ...e, amount: round2(Number(e.amount) - amt) };
      if (e.id === toId)   return { ...e, amount: round2(Number(e.amount) + amt) };
      return e;
    });

    dispatch({ type: "SET_ENVELOPES", envelopes: updated });
    return { ok: true };
  }, [state.envelopes]);

  const addSpend = useCallback(
    (amountArg, merchantArg, dateArg) => {
      const amount = Math.abs(round2(amountArg));
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid spend amount" };
      }

      const tx = {
        id:          newId("spend"),
        kind:        "spend",
        amount:      -amount,           // stored as negative
        merchant:    merchantArg?.trim() || "Manual spend",
        description: merchantArg?.trim() || "Manual spend",
        imported:    false,
        postedAt:    dateArg || new Date().toISOString(),
        allocations: [],
        allocated:   false,
      };

      dispatch({ type: "ADD_TRANSACTION", tx });
      return { ok: true, tx };
    },
    [dispatch]
  );

  // Dev-only helper for demoing the spend-allocation flow
  const simulateRandomSpend = useCallback(() => {
    if (!__DEV__) return { ok: false, message: "Not available." };
    if (state.envelopes.length === 0) {
      return { ok: false, message: "No envelopes available." };
    }

    const pick = state.envelopes[Math.floor(Math.random() * state.envelopes.length)];
    const spendAmt = round2(Math.random() * 40 + 5);

    const tx = {
      id: newId("mock"),
      merchant: "Random Spend",
      amount: -spendAmt,
      kind: "spend",
      imported: false,
      postedAt: new Date().toISOString(),
      allocations: [],
      allocated: false,
    };

    dispatch({ type: "ADD_TRANSACTION", tx });

    return {
      ok: true,
      tx,
      message: `Spent $${fmt(spendAmt)} at ${pick.name}`,
    };
  }, [state.envelopes]);

  /* -----------------------------------------------------------
     CATEGORISATION RULES
  ----------------------------------------------------------- */

  const addRule = useCallback((match, envelopeId) => {
    const key = ruleKeyFromMerchant(match);
    if (!key || key.length < 3 || !envelopeId) return;
    dispatch({ type: "ADD_RULE", rule: { id: newId("rule"), match: key, envelopeId } });
  }, []);

  const removeRule = useCallback((id) => {
    dispatch({ type: "REMOVE_RULE", id });
  }, []);

  /* -----------------------------------------------------------
     PENDING SPEND — drives SpendChooserModal
  ----------------------------------------------------------- */

  /**
   * Mark a spend transaction as "pending allocation".
   * Builds the pendingSpend descriptor from any transaction-like object.
   * Safe to call with a transaction that may not yet be in state.transactions
   * (e.g. it arrived via a push notification before a sync).
   */
  const setPendingSpend = useCallback((tx) => {
    const amount    = Math.abs(Number(tx.amount || 0));
    const alreadyUsed = (tx.allocations || []).reduce((s, a) => s + (Number(a.used) || 0), 0);
    const remaining = round2(amount - alreadyUsed);

    if (remaining <= 0) return; // Already fully allocated — nothing to show

    dispatch({
      type: "SET_PENDING_SPEND",
      pendingSpend: {
        id:       tx.id,
        merchant: tx.merchant || tx.description || "Unknown merchant",
        amount,
        remaining,
        postedAt: tx.postedAt || new Date().toISOString(),
      },
    });
  }, []);

  /** Dismiss the modal without recording any allocation. */
  const cancelSpend = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING_SPEND" });
  }, []);

  /**
   * Allocate as much of the pending spend as possible from `sourceId`.
   *  - sourceId === "unallocated" → draws from unallocated pool (no envelope deducted)
   *  - otherwise → deducts from the matching envelope, capped at its balance
   * Clears pendingSpend when remaining hits zero.
   * When a spend is fully covered by a single envelope, a categorisation rule
   * is learned so future imports from that merchant allocate automatically.
   * If the transaction is not yet in state.transactions it is inserted automatically.
   */
  const commitSpendPart = useCallback((sourceId) => {
    const ps = state.pendingSpend;
    if (!ps || ps.remaining <= 0) return;

    // How much this source can cover
    let available;
    if (sourceId === "unallocated") {
      available = state.unallocated;
    } else {
      const env = state.envelopes.find(e => e.id === sourceId);
      available = env ? Number(env.amount || 0) : 0;
    }

    const used = round2(Math.min(ps.remaining, Math.max(0, available)));
    if (used <= 0) return; // Source is empty — nothing to do

    const newRemaining = round2(ps.remaining - used);

    // Deduct from envelope (unallocated is derived so no direct state change needed)
    const envelopesCopy =
      sourceId === "unallocated"
        ? state.envelopes
        : state.envelopes.map(e =>
            e.id === sourceId
              ? { ...e, amount: round2(Math.max(0, Number(e.amount || 0) - used)) }
              : e
          );

    // Update (or create) the transaction record
    const txExists = state.transactions.find(t => t.id === ps.id);
    let transactionsCopy;
    let finalAllocations;

    if (txExists) {
      finalAllocations = [...(txExists.allocations || []), { sourceId, used }];
      transactionsCopy = state.transactions.map(t => {
        if (t.id !== ps.id) return t;
        return {
          ...t,
          allocations: finalAllocations,
          allocated:   newRemaining <= 0,
        };
      });
    } else {
      // Transaction arrived via push notification before a sync — insert it now
      finalAllocations = [{ sourceId, used }];
      const newTx = {
        id:          ps.id,
        kind:        "spend",
        amount:      -ps.amount,
        merchant:    ps.merchant,
        description: ps.merchant,
        imported:    true,
        postedAt:    ps.postedAt,
        allocations: finalAllocations,
        allocated:   newRemaining <= 0,
      };
      transactionsCopy = [...state.transactions, newTx];
    }

    dispatch({
      type:         "COMMIT_SPEND_PART",
      envelopes:    envelopesCopy,
      transactions: transactionsCopy,
      pendingSpend: newRemaining > 0 ? { ...ps, remaining: newRemaining } : null,
    });

    // ── Learn a categorisation rule ─────────────────────────────────────────
    // Fully covered from ONE envelope → remember merchant → envelope.
    if (
      newRemaining <= 0 &&
      sourceId !== "unallocated" &&
      finalAllocations.every(a => a.sourceId === sourceId)
    ) {
      const key = ruleKeyFromMerchant(ps.merchant);
      const generic = ["manual spend", "unknown merchant", "bank transaction", "random spend"];
      if (key && key.length >= 3 && !generic.includes(key)) {
        dispatch({ type: "ADD_RULE", rule: { id: newId("rule"), match: key, envelopeId: sourceId } });
      }
    }
  }, [state]);

  /* -----------------------------------------------------------
     BANK IMPORT
     - accepts a pre-fetched list (bank-connect.js fetches with JWT)
     - otherwise fetches from the backend itself, authenticated
     - applies categorisation rules: spends whose merchant matches a
       rule are auto-allocated when the envelope can fully cover them
  ----------------------------------------------------------- */
  const importBankTransactions = useCallback(async (prefetched) => {
    try {
      let importedTxs = [];

      if (Array.isArray(prefetched) && prefetched.length > 0) {
        importedTxs = prefetched.map(normalizeTx);
      } else {
        const t = tokenRef.current;
        if (t) {
          try {
            const r = await fetch(`${BACKEND_URL}/fiskil/transactions`, {
              method:  "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
              body:    JSON.stringify({ limit: 100 }),
            });
            const j = await r.json().catch(() => ({}));
            if (r.ok && Array.isArray(j.txs)) {
              importedTxs = j.txs.map(normalizeTx);
            }
          } catch {
            // backend unreachable — fall through
          }
        }
      }

      if (importedTxs.length === 0) {
        return { ok: true, imported: 0, message: "No new transactions found." };
      }

      // Dedupe against existing transactions
      const existing = Array.isArray(state.transactions) ? state.transactions : [];
      const existingIds = new Set(existing.map((t) => String(t.id)));
      const fresh = importedTxs.filter((t) => !existingIds.has(String(t.id)));

      if (fresh.length === 0) {
        return { ok: true, imported: 0, message: "Already up to date." };
      }

      // Everything that already existed when the bank was connected is history.
      // Nobody wants to open the app and be handed a backlog of forty past
      // purchases to sort — only spending that happens AFTER connecting needs
      // allocating. The verdict is stamped onto each transaction here rather
      // than worked out when rendering, so it survives reloads, disconnects
      // and a missing balance sync.
      const firstConnection = !state.bankConnectedAt;
      const connectedAt     = state.bankConnectedAt || new Date().toISOString();
      const connectedMs     = Date.parse(connectedAt);
      if (firstConnection) {
        dispatch({ type: "SET_BANK_CONNECTED_AT", at: connectedAt });
      }

      // Apply categorisation rules to unallocated spends
      let envelopes = state.envelopes;
      let autoCount = 0;
      const processed = fresh.map(raw => {
        const postedMs = Date.parse(raw.postedAt || raw.createdAt || "");
        const historical =
          firstConnection ||
          (Number.isFinite(postedMs) && Number.isFinite(connectedMs) && postedMs <= connectedMs);

        const tx = { ...raw, historical };

        // Past spending is a record, not a to-do: never auto-allocate it, or it
        // would drain envelopes for money that was spent before the user began.
        if (historical || tx.kind !== "spend" || tx.allocated) return tx;
        const rule = findRuleMatch(state.rules, tx.merchant);
        if (!rule) return tx;
        const env = envelopes.find(e => e.id === rule.envelopeId);
        const amt = Math.abs(tx.amount);
        if (!env || Number(env.amount) < amt) return tx; // can't fully cover — leave for the user
        envelopes = envelopes.map(e =>
          e.id === env.id ? { ...e, amount: round2(Number(e.amount) - amt) } : e
        );
        autoCount++;
        return {
          ...tx,
          allocations: [{ sourceId: env.id, used: amt }],
          allocated:   true,
          autoAllocated: true,
        };
      });

      // Merge + sort newest first
      const merged = [...processed, ...existing];
      merged.sort((a, b) => {
        const ad = new Date(a.postedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.postedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });

      dispatch({ type: "ALLOCATE", envelopes, transactions: merged });

      const needsAllocating = processed.filter(
        (t) => t.kind === "spend" && !t.historical && !t.allocated
      ).length;
      const asHistory = processed.filter((t) => t.historical).length;

      return {
        ok: true,
        imported: fresh.length,
        autoAllocated: autoCount,
        needsAllocating,
        historical: asHistory,
        message: asHistory && !needsAllocating
          ? `Imported ${asHistory} past transaction(s) as history — nothing to allocate.`
          : `Imported ${fresh.length} transaction(s)${
              asHistory ? ` — ${asHistory} logged as history` : ""
            }${autoCount ? `, ${autoCount} auto-allocated` : ""}.`,
      };
    } catch (e) {
      console.log("importBankTransactions error:", e);
      return { ok: false, imported: 0, message: String(e?.message || e) };
    }
  }, [state.transactions, state.envelopes, state.rules]);

  const resetAll = useCallback(async () => {
    try {
      if (user?.id) {
        await AsyncStorage.removeItem(`budgetState_${user.id}`);
      }
    } catch (e) {
      console.log("Reset storage error:", e);
    }
    // Wipe the cloud copy too — reset means reset everywhere
    try {
      const t = tokenRef.current;
      if (t) {
        await fetch(`${BACKEND_URL}/budget`, {
          method:  "DELETE",
          headers: { Authorization: `Bearer ${t}` },
        });
      }
    } catch {}
    // Reset means reset everywhere — also revoke any connected banks at Fiskil
    try {
      const t = tokenRef.current;
      if (t) {
        await fetch(`${BACKEND_URL}/fiskil/disconnect`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${t}` },
        });
      }
    } catch {}
    dispatch({ type: "RESET_ALL" });
  }, [user?.id]);

  /* -----------------------------------------------------------
     CONTEXT VALUE
  ----------------------------------------------------------- */
  const value = useMemo(
    () => ({
      state,
      dispatch,

      addEnvelope,
      addIncome,
      addSpend,
      allocateToEnvelope,
      allocateOutstanding,
      deleteEnvelope,
      reorderEnvelopes,
      editEnvelope,
      setIncomeSchedule,
      transferBetweenEnvelopes,
      resetAll,

      total: state.total,
      allocated: state.allocated,
      unallocated: state.unallocated,
      overallocated: state.overallocated,
      bankBalance: state.bankBalance,
      lastBalanceSync: state.lastBalanceSync,
      bankAccountCount: state.bankAccountCount,
      bankConnectedAt: state.bankConnectedAt,
      balanceAsOf: state.balanceAsOf,
      setBankBalance,
      refreshBankBalance,
      disconnectBank,

      rules: state.rules,
      addRule,
      removeRule,

      simulateRandomSpend,
      importBankTransactions,

      // Pending spend (SpendChooserModal)
      setPendingSpend,
      commitSpendPart,
      cancelSpend,
    }),
    [
      state,
      setBankBalance,
      refreshBankBalance,
      disconnectBank,
      addEnvelope,
      addIncome,
      addSpend,
      allocateToEnvelope,
      allocateOutstanding,
      deleteEnvelope,
      reorderEnvelopes,
      editEnvelope,
      setIncomeSchedule,
      transferBetweenEnvelopes,
      resetAll,
      addRule,
      removeRule,
      simulateRandomSpend,
      importBankTransactions,
      setPendingSpend,
      commitSpendPart,
      cancelSpend,
    ]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget must be used inside BudgetProvider");
  return ctx;
}
