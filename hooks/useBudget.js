import { useState, useMemo } from "react";

const initial = [
  { id: "e1", name: "Mortgage", type: "fixed", amount: 1300, rollover: true },
  { id: "e2", name: "Vehicle Expense", type: "fixed", amount: 200, rollover: false },
  { id: "e3", name: "Subscriptions", type: "fixed", amount: 75, rollover: false },
  { id: "e4", name: "Groceries", type: "flexible", amount: 300, rollover: true },
  { id: "e5", name: "Entertainment", type: "flexible", amount: 100, rollover: false },
];

let _singleton;

export function useBudget() {
  if (_singleton) return _singleton;

  const [bankBalance, setBankBalance] = useState(3050.37);
  const [envelopes, setEnvelopes] = useState(initial);

  const allocatedTotal = useMemo(
    () => envelopes.reduce((s, e) => s + e.amount, 0),
    [envelopes]
  );
  const unallocated = Math.max(0, +(bankBalance - allocatedTotal).toFixed(2));

  function allocate(id, amt) {
    if (isNaN(amt) || amt <= 0) return;
    setEnvelopes(prev =>
      prev.map(e => (e.id === id ? { ...e, amount: +(e.amount + amt).toFixed(2) } : e))
    );
  }

  function editEnvelope(id) {
    console.log("Edit envelope", id);
  }

  function deleteEnvelope(id) {
    setEnvelopes(prev => prev.filter(e => e.id !== id));
  }

  _singleton = { bankBalance, setBankBalance, envelopes, allocate, editEnvelope, deleteEnvelope, allocatedTotal, unallocated };
  return _singleton;
}
