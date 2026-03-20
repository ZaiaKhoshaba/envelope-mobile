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

    case "RESET_ALL":
      return {
        ...defaultState,
        envelopes: [],
        transactions: [],
        incomeSchedule: { ...defaultState.incomeSchedule },
      };

    default:
      return state;
  }
}

/* -----------------------------------------------------------
   HELPER: approx # of pays left between now & target
----------------------------------------------------------- */
function countPaysRemaining(nowISO, targetISO, incomeSchedule) {
  const now = new Date(nowISO);
  const target = new Date(targetISO);
  if (Number.isNaN(now.getTime()) || Number.isNaN(target.getTime())) return 1;
  if (target <= now) return 1;

  const diffDays = Math.ceil(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const freq = incomeSchedule?.frequency;
  if (freq === "weekly") return Math.max(1, Math.ceil(diffDays / 7));
  if (freq === "fortnightly") return Math.max(1, Math.ceil(diffDays / 14));
  if (freq === "monthly") return Math.max(1, Math.ceil(diffDays / 30));
  return 1;
}

/* -----------------------------------------------------------
   HELPER: auto-allocate this income across targeted envelopes
----------------------------------------------------------- */
function autoAllocateIncome({ incomeAmount, nowISO, envelopes, incomeSchedule }) {
  if (!incomeAmount || incomeAmount <= 0) {
    return { envelopes, plans: [], shortfall: 0 };
  }

  const now = nowISO || new Date().toISOString();

  const plans = [];
  for (const env of envelopes) {
    const target = Number(env.target || 0);
    if (!target) continue;

    const current = Number(env.amount || 0);
    const remainingNeeded = Math.max(0, target - current);
    if (remainingNeeded <= 0) continue;

    let paysRemaining = 1;
    if (env.targetDate) {
      paysRemaining = countPaysRemaining(now, env.targetDate, incomeSchedule);
    }

    const allocThisPay = remainingNeeded / paysRemaining;
    if (allocThisPay > 0) {
      plans.push({ envId: env.id, amount: allocThisPay });
    }
  }

  if (plans.length === 0) {
    return { envelopes, plans: [], shortfall: 0 };
  }

  const plannedTotal = plans.reduce((sum, p) => sum + p.amount, 0);

  let scale = 1;
  let shortfall = 0;
  if (plannedTotal > incomeAmount) {
    scale = incomeAmount / plannedTotal;
    shortfall = plannedTotal - incomeAmount;
  }

  const allocationsById = new Map();
  for (const p of plans) {
    const amt = p.amount * scale;
    allocationsById.set(p.envId, (allocationsById.get(p.envId) || 0) + amt);
  }

  const updatedEnvelopes = envelopes.map((env) => {
    const extra = allocationsById.get(env.id) || 0;
    if (!extra) return env;
    return { ...env, amount: (Number(env.amount) || 0) + extra };
  });

  return { envelopes: updatedEnvelopes, plans, shortfall };
}

/* -----------------------------------------------------------
   PROVIDER
----------------------------------------------------------- */
export function BudgetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultState);

  // Load saved state on startup
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("budgetState");
        if (saved) {
          dispatch({ type: "LOAD_STATE", payload: JSON.parse(saved) });
        }
      } catch (e) {
        console.log("State load error:", e);
      }
    })();
  }, []);

  // Persist on every state change
  useEffect(() => {
    AsyncStorage.setItem("budgetState", JSON.stringify(state));
  }, [state]);

  /* -----------------------------------------------------------
     COMPUTE TOTALS
  ----------------------------------------------------------- */
  const recomputeTotals = useCallback(() => {
    const totalIncome = state.transactions.reduce((sum, t) => {
      if (t.kind === "income") return sum + (Number(t.amount) || 0);
      return sum;
    }, 0);

    const envelopeSum = state.envelopes.reduce(
      (sum, e) => sum + (Number(e.amount) || 0),
      0
    );

    const total = totalIncome;
    const allocated = envelopeSum;
    const unallocated = Math.max(0, totalIncome - envelopeSum);

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
        nowISO: postedAt,
        envelopes: state.envelopes,
        incomeSchedule: state.incomeSchedule,
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

  // editEnvelope(id, updates) — matches envelopes.js usage
  const editEnvelope = useCallback((id, updates) => {
    dispatch({ type: "UPDATE_ENVELOPE", id, updates });
  }, []);

  const addEnvelope = useCallback((envelope) => {
    dispatch({ type: "ADD_ENVELOPE", envelope });
  }, []);

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
      message: `Spent $${spendAmt.toFixed(2)} at ${pick.name}`,
    };
  }, [state.envelopes]);

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
      await AsyncStorage.removeItem("budgetState");
    } catch (e) {
      console.log("Reset storage error:", e);
    }
    dispatch({ type: "RESET_ALL" });
  }, []);

  /* -----------------------------------------------------------
     CONTEXT VALUE
  ----------------------------------------------------------- */
  const value = useMemo(
    () => ({
      state,
      dispatch,

      addEnvelope,
      addIncome,
      allocateToEnvelope,
      allocateOutstanding,
      deleteEnvelope,
      editEnvelope,
      setIncomeSchedule,
      resetAll,

      total: state.total,
      allocated: state.allocated,
      unallocated: state.unallocated,

      simulateRandomSpend,
      importBankTransactions,
    }),
    [
      state,
      addEnvelope,
      addIncome,
      allocateToEnvelope,
      allocateOutstanding,
      deleteEnvelope,
      editEnvelope,
      setIncomeSchedule,
      resetAll,
      simulateRandomSpend,
      importBankTransactions,
    ]
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const ctx = useContext(BudgetContext);
  if (!ctx) throw new Error("useBudget must be used inside BudgetProvider");
  return ctx;
}
