// context/BudgetContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { fmt } from "../lib/format";

const BudgetContext = createContext(null);

/* -----------------------------------------------------------
   DEFAULT STATE — includes incomeSchedule
----------------------------------------------------------- */
const defaultState = {
  envelopes: [],
  transactions: [],
  total: 0,
  allocated: 0,
  unallocated: 0,
  cycle: null,

  // Income schedule for future smart auto-allocation
  incomeSchedule: {
    amount: null,
    frequency: null, // "weekly" | "fortnightly" | "monthly"
    dayOfWeek: null, // 1–7 (Mon–Sun) if weekly/fortnightly
    dayOfMonth: null, // 1–31 if monthly
    anchorDate: null, // ISO string
  },

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

      return {
        ...state,
        ...incoming,
        envelopes,
        transactions,
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
      };

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

    case "RESET_ALL":
      return {
        ...defaultState,
        envelopes: [],
        transactions: [],
        incomeSchedule: { ...defaultState.incomeSchedule },
        pendingSpend: null,
      };

    default:
      return state;
  }
}

/* -----------------------------------------------------------
   HELPER: proportional auto-allocation
   Every pay is split across fixed envelopes by:
     envelope.target / totalFixedTarget
   Each envelope is capped at its own target (won't over-fill).
   Any surplus beyond targets stays as unallocated funds.
----------------------------------------------------------- */
export function buildProportionalPlans(incomeAmount, envelopes) {
  // ── Fixed envelopes: proportional fill to target (capped at remaining need) ─
  const fixedEnvs   = envelopes.filter(e => e.type === "fixed" && Number(e.target) > 0);
  const totalTarget = fixedEnvs.reduce((sum, e) => sum + Number(e.target), 0);

  const fixedPlans = (totalTarget && incomeAmount)
    ? fixedEnvs.map(env => {
        const proportion = Number(env.target) / totalTarget;
        const gross      = incomeAmount * proportion;
        const stillNeeds = Math.max(0, Number(env.target) - Number(env.amount || 0));
        const allocation = Math.min(gross, stillNeeds);
        return { envId: env.id, proportion, gross, allocation, isSavings: false };
      }).filter(p => p.allocation > 0.004)
    : [];

  // ── Savings envelopes: flat contribution added on top of existing balance ──
  const savingsEnvs  = envelopes.filter(e => e.type === "savings");
  const savingsPlans = incomeAmount
    ? savingsEnvs.map(env => {
        const pct = Number(env.contributionPct    || 0);
        const amt = Number(env.contributionAmount || 0);
        let allocation = 0;
        if (pct > 0)      allocation = Math.round(incomeAmount * (pct / 100) * 100) / 100;
        else if (amt > 0) allocation = amt;
        return { envId: env.id, proportion: pct / 100, gross: allocation, allocation, isSavings: true };
      }).filter(p => p.allocation > 0.004)
    : [];

  return [...fixedPlans, ...savingsPlans];
}

function autoAllocateIncome({ incomeAmount, envelopes }) {
  if (!incomeAmount || incomeAmount <= 0) {
    return { envelopes, shortfall: 0 };
  }

  const plans = buildProportionalPlans(incomeAmount, envelopes);
  if (plans.length === 0) return { envelopes, shortfall: 0 };

  const updatedEnvelopes = envelopes.map(env => {
    const plan = plans.find(p => p.envId === env.id);
    if (!plan) return env;
    return { ...env, amount: Math.round(((Number(env.amount) || 0) + plan.allocation) * 100) / 100 };
  });

  // shortfall = total still needed across all fixed envelopes after this pay
  const shortfall = updatedEnvelopes
    .filter(e => e.type === "fixed" && Number(e.target) > 0)
    .reduce((sum, e) => sum + Math.max(0, Number(e.target) - Number(e.amount)), 0);

  return { envelopes: updatedEnvelopes, shortfall: Math.round(shortfall * 100) / 100 };
}

/* -----------------------------------------------------------
   PROVIDER
----------------------------------------------------------- */
export function BudgetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const { user } = useAuth();

  // Load the correct user's budget whenever they log in or switch accounts.
  // Resets to empty first so stale data never bleeds across accounts.
  useEffect(() => {
    if (!user?.id) {
      dispatch({ type: "RESET_ALL" });
      return;
    }
    (async () => {
      try {
        dispatch({ type: "RESET_ALL" }); // clear any previous user's data immediately
        const saved = await AsyncStorage.getItem(`budgetState_${user.id}`);
        if (saved) {
          dispatch({ type: "LOAD_STATE", payload: JSON.parse(saved) });
        }
      } catch (e) {
        console.log("State load error:", e);
      }
    })();
  }, [user?.id]);

  // Persist on every state change — only when a user is logged in
  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.setItem(`budgetState_${user.id}`, JSON.stringify(state));
  }, [state, user?.id]);

  /* -----------------------------------------------------------
     COMPUTE TOTALS
  ----------------------------------------------------------- */
  const recomputeTotals = useCallback(() => {
    const totalIncome = state.transactions.reduce((sum, t) => {
      if (t.kind === "income") return sum + (Number(t.amount) || 0);
      return sum;
    }, 0);

    // Only deduct spends that have been allocated — unallocated spends don't
    // affect the total until the user assigns them to an envelope, so that
    // allocating a spend reduces total AND envelope by the same amount,
    // leaving unallocated unchanged (the correct real-world behaviour).
    const allocatedSpendTotal = state.transactions.reduce((sum, t) => {
      if (t.kind === "spend" && t.allocated) {
        return sum + Math.abs(Number(t.amount) || 0);
      }
      return sum;
    }, 0);

    const envelopeSum = state.envelopes.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    const total       = Math.max(0, totalIncome - allocatedSpendTotal);
    const allocated   = envelopeSum;
    const unallocated = Math.max(0, total - envelopeSum);

    dispatch({
      type: "SET_TOTALS",
      total,
      allocated,
      unallocated,
    });
  }, [state.envelopes, state.transactions]);

  useEffect(() => {
    recomputeTotals();
  }, [state.envelopes, state.transactions, recomputeTotals]);

  /* -----------------------------------------------------------
     HELPERS
  ----------------------------------------------------------- */

  const setIncomeSchedule = useCallback((scheduleUpdates) => {
    dispatch({ type: "SET_INCOME_SCHEDULE", payload: scheduleUpdates });
  }, []);

  const addIncome = useCallback(
    (amountArg, descriptionArg, dateArg) => {
      const amount = Number(amountArg || 0);
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid income amount" };
      }

      const postedAt = dateArg || new Date().toISOString();

      const tx = {
        id: `inc_${Date.now()}`,
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
        type: "LOAD_STATE",
        payload: {
          ...state,
          transactions: newTransactions,
          envelopes: updatedEnvelopes,
        },
      });

      return { ok: true, tx, shortfall };
    },
    [state]
  );

  const allocateOutstanding = useCallback(
    (txId, sourceId) => {
      const tx = state.transactions.find((t) => t.id === txId);
      if (!tx) return;

      const amountAbs = Math.abs(Number(tx.amount) || 0);
      const existing = (tx.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
      const remaining = amountAbs - existing;
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
          env.amount = Math.max(0, (Number(env.amount) || 0) - remaining);
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
      const amount = Number(amountArg || 0);
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid amount" };
      }

      const envelopes = state.envelopes.map((env) => {
        if (env.id !== envelopeId) return env;
        return { ...env, amount: (Number(env.amount) || 0) + amount };
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
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!amt || amt <= 0) return { ok: false, message: "Invalid amount" };
    if (fromId === toId) return { ok: false, message: "Cannot transfer to the same envelope" };

    const from = state.envelopes.find(e => e.id === fromId);
    const to   = state.envelopes.find(e => e.id === toId);
    if (!from || !to) return { ok: false, message: "Envelope not found" };
    if (Number(from.amount) < amt) return { ok: false, message: "Insufficient balance" };

    const updated = state.envelopes.map(e => {
      if (e.id === fromId) return { ...e, amount: Math.round((Number(e.amount) - amt) * 100) / 100 };
      if (e.id === toId)   return { ...e, amount: Math.round((Number(e.amount) + amt) * 100) / 100 };
      return e;
    });

    dispatch({ type: "SET_ENVELOPES", envelopes: updated });
    return { ok: true };
  }, [state.envelopes]);

  const addSpend = useCallback(
    (amountArg, merchantArg, dateArg) => {
      const amount = Math.abs(Number(amountArg || 0));
      if (!amount || Number.isNaN(amount)) {
        return { ok: false, message: "Invalid spend amount" };
      }

      const tx = {
        id:          `spend_${Date.now()}`,
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

  const simulateRandomSpend = useCallback(() => {
    if (state.envelopes.length === 0) {
      return { ok: false, message: "No envelopes available." };
    }

    const pick = state.envelopes[Math.floor(Math.random() * state.envelopes.length)];
    const spendAmt = Math.random() * 40 + 5;

    const tx = {
      id: `mock_${Date.now()}`,
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
    const remaining = Number((amount - alreadyUsed).toFixed(2));

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

    const used         = Math.min(ps.remaining, Math.max(0, available));
    if (used <= 0) return; // Source is empty — nothing to do

    const newRemaining = Number((ps.remaining - used).toFixed(2));

    // Deduct from envelope (unallocated is derived so no direct state change needed)
    const envelopesCopy =
      sourceId === "unallocated"
        ? state.envelopes
        : state.envelopes.map(e =>
            e.id === sourceId
              ? { ...e, amount: Math.max(0, Number(e.amount || 0) - used) }
              : e
          );

    // Update (or create) the transaction record
    const txExists = state.transactions.find(t => t.id === ps.id);
    let transactionsCopy;

    if (txExists) {
      transactionsCopy = state.transactions.map(t => {
        if (t.id !== ps.id) return t;
        return {
          ...t,
          allocations: [...(t.allocations || []), { sourceId, used }],
          allocated:   newRemaining <= 0,
        };
      });
    } else {
      // Transaction arrived via push notification before a sync — insert it now
      const newTx = {
        id:          ps.id,
        kind:        "spend",
        amount:      -ps.amount,
        merchant:    ps.merchant,
        description: ps.merchant,
        imported:    true,
        postedAt:    ps.postedAt,
        allocations: [{ sourceId, used }],
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
  }, [state]);

  /* -----------------------------------------------------------
     ✅ FIXED: importBankTransactions writes into state.transactions
     - uses EXPO_PUBLIC_BANK_BACKEND_URL if present
     - otherwise imports 40 mock txs
     - merges + dedupes + sorts newest first
  ----------------------------------------------------------- */
  const importBankTransactions = useCallback(async () => {
    try {
      const base = process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "";

      let importedTxs = [];

      // Try real backend if env var exists
      if (base) {
        const candidatePaths = [
          "/import/latest",
          "/import-latest",
          "/transactions/import/latest",
        ];

        for (const p of candidatePaths) {
          try {
            const r = await fetch(`${base}${p}`, { method: "POST" });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) continue;

            const list = Array.isArray(j.transactions)
              ? j.transactions
              : Array.isArray(j.data)
              ? j.data
              : [];

            importedTxs = list.map((t) => ({
              id: t.id || `bank_${Date.now()}_${Math.random()}`,
              kind: t.kind || (Number(t.amount) >= 0 ? "income" : "spend"),
              amount: Number(t.amount || 0),
              merchant: t.merchant || t.counterparty || "Bank Transaction",
              description: t.description || t.narrative || "",
              imported: true,
              postedAt: t.postedAt || t.date || new Date().toISOString(),
              allocations: Array.isArray(t.allocations) ? t.allocations : [],
              allocated: !!t.allocated,
            }));

            break;
          } catch (e) {
            // try next path
          }
        }
      }

      // Fallback to mock import if backend isn't set or returns 0
      if (!importedTxs || importedTxs.length === 0) {
        const merchants = [
          "Woolworths",
          "Coles",
          "BP",
          "Shell",
          "Chemist Warehouse",
          "Uber",
          "Bunnings",
          "Kmart",
          "Target",
          "Aldi",
          "McDonald's",
          "7-Eleven",
        ];

        importedTxs = Array.from({ length: 40 }).map((_, i) => {
          const amt = Number((Math.random() * 180 + 5).toFixed(2));
          const daysAgo = Math.floor(Math.random() * 30);
          const postedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
          return {
            id: `mock_bank_${Date.now()}_${i}`,
            kind: "spend",
            amount: -amt,
            merchant: merchants[Math.floor(Math.random() * merchants.length)],
            description: "Imported (mock)",
            imported: true,
            postedAt,
            allocations: [],
            allocated: false,
          };
        });
      }

      // Merge (dedupe by id) + sort newest first
      const existing = Array.isArray(state.transactions) ? state.transactions : [];
      const existingIds = new Set(existing.map((t) => String(t.id)));

      const merged = [
        ...importedTxs.filter((t) => !existingIds.has(String(t.id))),
        ...existing,
      ];

      merged.sort((a, b) => {
        const ad = new Date(a.postedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.postedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });

      dispatch({ type: "SET_TRANSACTIONS", transactions: merged });

      return {
        ok: true,
        imported: importedTxs.length,
        message: `Imported ${importedTxs.length} transaction(s).`,
      };
    } catch (e) {
      console.log("importBankTransactions error:", e);
      return { ok: false, imported: 0, message: String(e?.message || e) };
    }
  }, [state.transactions]);

  const resetAll = useCallback(async () => {
    try {
      if (user?.id) {
        await AsyncStorage.removeItem(`budgetState_${user.id}`);
      }
    } catch (e) {
      console.log("Reset storage error:", e);
    }
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

      simulateRandomSpend,
      importBankTransactions,

      // Pending spend (SpendChooserModal)
      setPendingSpend,
      commitSpendPart,
      cancelSpend,
    }),
    [
      state,
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
