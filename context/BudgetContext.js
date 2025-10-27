// context/BudgetContext.js
import React, { createContext, useContext, useMemo, useReducer } from "react";

export const TARGET_FREQS = ["weekly", "fortnightly", "monthly"];

/**
 * Envelope shape
 * {
 *   id, name, amount, type: 'fixed'|'flexible', rollover: boolean,
 *   target: number, freq: 'weekly'|'fortnightly'|'monthly',
 *   targetDate?: ISO string (e.g. "2025-07-20")
 * }
 */

const initialState = {
  unallocated: 0,
  cycle: "monthly",
  envelopes: [
    {
      id: "e1",
      name: "Groceries",
      amount: 150,
      type: "flexible",
      rollover: true,
      target: 400,
      freq: "monthly",
      targetDate: null,
    },
    {
      id: "e2",
      name: "Rent/Mortgage",
      amount: 1200,
      type: "fixed",
      rollover: true,
      target: 2400,
      freq: "monthly",
      targetDate: null,
    },
  ],
  transactions: [],
  pendingSpend: null,
};

/* Action types */
const ADD_INCOME = "ADD_INCOME";
const ADD_ENVELOPE = "ADD_ENVELOPE";
const EDIT_ENVELOPE = "EDIT_ENVELOPE";
const DELETE_ENVELOPE = "DELETE_ENVELOPE";
const END_CYCLE = "END_CYCLE";
const ALLOCATE_TO_ENVELOPE = "ALLOCATE_TO_ENVELOPE";

const START_PENDING_SPEND = "START_PENDING_SPEND";
const COMMIT_SPEND_PART = "COMMIT_SPEND_PART";
const CANCEL_PENDING_SPEND = "CANCEL_PENDING_SPEND";

const ALLOCATE_OUTSTANDING = "ALLOCATE_OUTSTANDING";
const IMPORT_BANK_SPENDS = "IMPORT_BANK_SPENDS";
const IMPORT_BANK_TXS = "IMPORT_BANK_TXS";

/* Helpers */
function nextCycleDateISO(dateISO, freq) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return null;
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function reducer(state, action) {
  switch (action.type) {
    /* -------- Income -------- */
    case ADD_INCOME: {
      const amt = Number(action.amount) || 0;
      if (amt <= 0) return state;
      const now = Date.now();
      return {
        ...state,
        unallocated: Number((state.unallocated + amt).toFixed(2)),
        transactions: [
          { id: "inc_" + now, kind: "income", amount: amt, ts: now },
          ...state.transactions,
        ],
      };
    }

    /* -------- Import (read-only history) -------- */
    case IMPORT_BANK_TXS: {
      const incoming = Array.isArray(action.payload) ? action.payload : [];
      const existingIds = new Set(state.transactions.map((t) => t.id));

      const mapped = incoming
        .filter((t) => t && t.id && !existingIds.has(String(t.id)))
        .map((t) => ({
          id: String(t.id),
          kind: "spend",
          amount: Number(t.amount) || 0,
          merchant: t.description || "Unknown",
          ts: t.postedAt ? Date.parse(t.postedAt) || Date.now() : Date.now(),
          imported: true,
          allocated: true, // history shouldn't prompt allocation
          allocations: [],
          source: "bank",
        }));

      if (mapped.length === 0) return state;
      return { ...state, transactions: [...mapped, ...state.transactions] };
    }

    /* -------- Envelopes CRUD -------- */
    case ADD_ENVELOPE: {
      const {
        name,
        amount = 0,
        type = "flexible",
        rollover = true,
        target = 0,
        freq = "monthly",
        targetDate = null,
      } = action.payload;

      const newEnv = {
        id: "env_" + Date.now(),
        name: String(name || "").trim(),
        amount: Number(amount) || 0,
        type,
        rollover,
        target: Number(target) || 0,
        freq,
        targetDate, // new
      };

      return {
        ...state,
        envelopes: [newEnv, ...state.envelopes],
        transactions: [
          {
            id: "adj_" + Date.now(),
            kind: "adjust",
            amount: newEnv.amount,
            ts: Date.now(),
            meta: { reason: "create-envelope", envelopeId: newEnv.id, name: newEnv.name },
          },
          ...state.transactions,
        ],
      };
    }

    case EDIT_ENVELOPE: {
      const { id, updates } = action.payload;
      return {
        ...state,
        envelopes: state.envelopes.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      };
    }

    case DELETE_ENVELOPE: {
      const { id } = action.payload;
      const env = state.envelopes.find((e) => e.id === id);
      if (!env) return state;
      const refund = Number(env.amount) || 0;
      return {
        ...state,
        envelopes: state.envelopes.filter((e) => e.id !== id),
        unallocated: Number((state.unallocated + refund).toFixed(2)),
        transactions: [
          {
            id: "adj_" + Date.now(),
            kind: "adjust",
            amount: refund,
            ts: Date.now(),
            meta: { reason: "delete-envelope", envelopeId: id, name: env.name },
          },
          ...state.transactions,
        ],
      };
    }

    /* -------- Cycle rollover -------- */
    case END_CYCLE: {
      let refund = 0;
      const envelopes = state.envelopes.map((e) => {
        if (!e.rollover) {
          refund += Number(e.amount) || 0;
          return { ...e, amount: 0 };
        }
        return {
          ...e,
          targetDate: nextCycleDateISO(e.targetDate, e.freq), // move due date forward
        };
      });
      return {
        ...state,
        envelopes,
        unallocated: Number((state.unallocated + refund).toFixed(2)),
      };
    }

    /* -------- Allocate from Unallocated -> Envelope -------- */
    case ALLOCATE_TO_ENVELOPE: {
      const { envelopeId, amount } = action.payload;
      const amt = Math.max(0, Number(amount) || 0);
      if (amt <= 0) return state;
      const use = Math.min(state.unallocated, amt);
      if (use <= 0) return state;

      const envelopes = state.envelopes.map((e) =>
        e.id === envelopeId ? { ...e, amount: Number((e.amount + use).toFixed(2)) } : e
      );

      return {
        ...state,
        envelopes,
        unallocated: Number((state.unallocated - use).toFixed(2)),
        transactions: [
          {
            id: "adj_" + Date.now(),
            kind: "adjust",
            amount: use,
            ts: Date.now(),
            meta: { reason: "allocate", toEnvelopeId: envelopeId },
          },
          ...state.transactions,
        ],
      };
    }

    /* -------- Live pending spend (popup) -------- */
    case START_PENDING_SPEND: {
      const { amount, merchant, reuseId } = action.payload;

      if (reuseId) {
        const tx = state.transactions.find((t) => t.id === reuseId && t.kind === "spend");
        if (!tx) return state;
        const already = (tx.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
        const remaining = Math.max(0, Number((tx.amount - already).toFixed(2)));
        return {
          ...state,
          pendingSpend: {
            id: reuseId,
            merchant: tx.merchant || merchant || "Unknown",
            amount: tx.amount,
            remaining,
            ts: tx.ts,
          },
        };
      }

      const now = Date.now();
      const spendId = "spend_" + now;
      return {
        ...state,
        pendingSpend: { id: spendId, merchant, amount, remaining: amount, ts: now },
        transactions: [
          { id: spendId, kind: "spend", amount, merchant, ts: now, allocated: false, allocations: [] },
          ...state.transactions,
        ],
      };
    }

    case COMMIT_SPEND_PART: {
      const ps = state.pendingSpend;
      if (!ps) return state;

      let envelopes = [...state.envelopes];
      let unalloc = state.unallocated;
      let remaining = ps.remaining;
      let usedNow = 0;

      if (action.sourceId === "unallocated") {
        usedNow = Math.min(unalloc, remaining);
        unalloc = Number((unalloc - usedNow).toFixed(2));
        remaining = Number((remaining - usedNow).toFixed(2));
      } else {
        envelopes = envelopes.map((e) => {
          if (e.id !== action.sourceId) return e;
          usedNow = Math.min(e.amount, remaining);
          return { ...e, amount: Number((e.amount - usedNow).toFixed(2)) };
        });
        remaining = Number((remaining - usedNow).toFixed(2));
      }

      const fully = remaining <= 0;

      return {
        ...state,
        envelopes,
        unallocated: unalloc,
        pendingSpend: fully ? null : { ...ps, remaining },
        transactions: state.transactions.map((t) =>
          t.id === ps.id
            ? {
                ...t,
                allocated: fully ? true : false,
                allocations: [...(t.allocations || []), { sourceId: action.sourceId, used: usedNow }],
              }
            : t
        ),
      };
    }

    case CANCEL_PENDING_SPEND:
      return { ...state, pendingSpend: null };

    /* -------- Allocate outstanding from Ledger (no duplicates) -------- */
    case ALLOCATE_OUTSTANDING: {
      const { txId, sourceId } = action.payload;
      const tx = state.transactions.find((t) => t.id === txId && t.kind === "spend");
      if (!tx) return state;

      const already = (tx.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
      let remaining = Math.max(0, Number((tx.amount - already).toFixed(2)));
      if (remaining <= 0) return state;

      let envelopes = [...state.envelopes];
      let unalloc = state.unallocated;
      let used = 0;

      if (sourceId === "unallocated") {
        used = Math.min(unalloc, remaining);
        unalloc = Number((unalloc - used).toFixed(2));
      } else {
        envelopes = envelopes.map((e) => {
          if (e.id !== sourceId) return e;
          used = Math.min(e.amount, remaining);
          return { ...e, amount: Number((e.amount - used).toFixed(2)) };
        });
      }

      remaining = Number((remaining - used).toFixed(2));

      return {
        ...state,
        envelopes,
        unallocated: unalloc,
        transactions: state.transactions.map((t) =>
          t.id === txId
            ? {
                ...t,
                allocations: [...(t.allocations || []), { sourceId, used }],
                allocated: remaining <= 0,
              }
            : t
        ),
      };
    }

    /* (legacy) Not used now, but kept in case you still call it somewhere */
    case IMPORT_BANK_SPENDS:
      return state;

    default:
      return state;
  }
}

/* Context + Provider */
const Ctx = createContext(null);

export function BudgetProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const derived = useMemo(() => {
    const allocated = state.envelopes.reduce((s, e) => s + (e.amount || 0), 0);
    const total = Number((allocated + state.unallocated).toFixed(2));
    return { allocated, total };
  }, [state.envelopes, state.unallocated]);

  // Actions
  const addIncome = (amount, meta) => dispatch({ type: ADD_INCOME, amount, meta });
  const addEnvelope = (
    name,
    amount,
    type = "flexible",
    rollover = true,
    target = 0,
    freq = "monthly",
    targetDate = null
  ) => dispatch({ type: ADD_ENVELOPE, payload: { name, amount, type, rollover, target, freq, targetDate } });
  const editEnvelope = (id, updates) => dispatch({ type: EDIT_ENVELOPE, payload: { id, updates } });
  const deleteEnvelope = (id) => dispatch({ type: DELETE_ENVELOPE, payload: { id } });
  const allocateToEnvelope = (envelopeId, amount) =>
    dispatch({ type: ALLOCATE_TO_ENVELOPE, payload: { envelopeId, amount } });
  const endCycle = () => dispatch({ type: END_CYCLE });

  // New or reopen chooser for an existing tx
  const startPendingSpend = (arg1, merchant) => {
    if (typeof arg1 === "object" && arg1?.txId) {
      const tx = state.transactions.find((t) => t.id === arg1.txId && t.kind === "spend");
      if (!tx) return;
      const already = (tx.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
      const remaining = Math.max(0, Number((tx.amount - already).toFixed(2)));
      dispatch({
        type: START_PENDING_SPEND,
        payload: { amount: remaining, merchant: tx.merchant, reuseId: tx.id },
      });
    } else {
      const amount = Number(arg1) || 0;
      if (amount <= 0) return;
      dispatch({ type: START_PENDING_SPEND, payload: { amount, merchant: merchant || "Unknown" } });
    }
  };

  const commitSpendPart = (sourceId) => dispatch({ type: COMMIT_SPEND_PART, sourceId });
  const cancelSpend = () => dispatch({ type: CANCEL_PENDING_SPEND });
  const allocateOutstanding = (txId, sourceId) =>
    dispatch({ type: ALLOCATE_OUTSTANDING, payload: { txId, sourceId } });

  const importBankTransactions = (txs) => dispatch({ type: IMPORT_BANK_TXS, payload: txs });

  // DEV helper
  const simulateRandomSpend = () => {
    const amount = Number((Math.random() * 60 + 5).toFixed(2));
    const merchant = ["Coles", "Amazon", "Uber Eats", "Shell", "Kmart", "Netflix"][Math.floor(Math.random() * 6)];
    startPendingSpend(amount, merchant);
    return { ok: true, message: `New spend of $${amount} at ${merchant} — awaiting allocation.` };
  };

  const value = useMemo(
    () => ({
      state,
      total: derived.total,
      allocated: derived.allocated,
      unallocated: state.unallocated,
      addIncome,
      addEnvelope,
      editEnvelope,
      deleteEnvelope,
      allocateToEnvelope,
      endCycle,
      startPendingSpend,
      commitSpendPart,
      cancelSpend,
      allocateOutstanding,
      importBankTransactions,
      simulateRandomSpend,
    }),
    [state, derived]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBudget() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBudget must be used within a BudgetProvider");
  return v;
}

export const BudgetContext = Ctx;
