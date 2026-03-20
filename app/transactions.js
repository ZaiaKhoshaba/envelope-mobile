// app/transactions.js
import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList } from "react-native";
import { useBudget } from "../context/BudgetContext";

export default function TransactionsScreen() {
  const { state, allocateOutstanding, unallocated } = useBudget();
  const [chooserForTx, setChooserForTx] = useState(null);

  const txs = useMemo(
  () =>
    Array.isArray(state.transactions)
      ? [...state.transactions].sort((a, b) => {
          const aTime = new Date(a.postedAt || a.createdAt || 0).getTime();
          const bTime = new Date(b.postedAt || b.createdAt || 0).getTime();
          return bTime - aTime; // latest first
        })
      : [],
  [state.transactions]
);


  const openChooser = useCallback((tx) => setChooserForTx(tx), []);
  const closeChooser = useCallback(() => setChooserForTx(null), []);

  const pickSource = useCallback((sourceId) => {
    if (!chooserForTx) return;
    allocateOutstanding(chooserForTx.id, sourceId);
    closeChooser();
  }, [chooserForTx, allocateOutstanding, closeChooser]);

  const envelopesSorted = useMemo(
    () => [...state.envelopes].sort((a, b) => b.amount - a.amount),
    [state.envelopes]
  );

  /** ------- helpers for row rendering ------- */
  const getPresentation = (t) => {
    const isIncome = t.kind === "income";
    const isSpend = t.kind === "spend";

    let displaySign = "-";
    if (isIncome) displaySign = "+";
    else if (!isSpend) displaySign = (Number(t.amount) || 0) >= 0 ? "+" : "-";

    const amountAbs = Math.abs(Number(t.amount) || 0).toFixed(2);
    const amountText = `${displaySign}$${amountAbs}`;
    const amountStyle = displaySign === "+" ? styles.pos : styles.neg;

    const already = (t.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
    const remaining = Math.max(0, Number(((Math.abs(t.amount) || 0) - already).toFixed(2)));
    const isAllocated = !!t.allocated;

    const title =
      t.merchant ||
      t.description ||
      (t.kind === "income" ? "Income" : t.meta?.reason || "Transaction");

    return { isIncome, isSpend, amountText, amountStyle, remaining, isAllocated, title };
  };

  /** ------- FlatList bits ------- */
  const keyExtractor = useCallback((t, idx) => {
    // Prefer backend id; otherwise a stable composite + idx (idx ensures uniqueness even if duped)
    const k =
      t?.id ??
      `${t?.postedAt ?? t?.createdAt ?? ""}|${t?.description ?? ""}|${t?.amount ?? ""}`;
    return String(k) + `#${idx}`;
  }, []);

  const renderItem = useCallback(({ item: t, index }) => {
    const { isIncome, isSpend, amountText, amountStyle, remaining, isAllocated, title } = getPresentation(t);

    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <Text style={styles.merchant}>{title}</Text>
          <View style={styles.amountBox}>
            <Text style={[styles.amount, amountStyle]}>{amountText}</Text>
          </View>
        </View>

        <View style={styles.rowMid}>
          <StatusPill imported={!!t.imported} isIncome={isIncome} isSpend={isSpend} allocated={isAllocated} />
          {isSpend && !t.imported && !isAllocated && remaining > 0 && (
            <Text style={styles.remaining}>Remaining: ${remaining.toFixed(2)}</Text>
          )}
        </View>

        {t.allocations && t.allocations.length > 0 && (
          <View style={styles.allocsBox}>
            {t.allocations.map((a, idx2) => {
              const label =
                a.sourceId === "unallocated"
                  ? "Unallocated"
                  : state.envelopes.find((e) => e.id === a.sourceId)?.name || "Envelope";
              return (
                <Text style={styles.allocLine} key={`${t.id ?? "tx"}_a_${String(a.sourceId)}_${idx2}`}>
                  • {label}: ${Number(a.used).toFixed(2)}
                </Text>
              );
            })}
          </View>
        )}

        {isSpend && !t.imported && !isAllocated && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.allocateBtn} onPress={() => openChooser(t)}>
              <Text style={styles.allocateBtnText}>Allocate</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [openChooser, state.envelopes]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transactions</Text>

      <FlatList
        data={txs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
        contentContainerStyle={{ paddingBottom: 40 }}
        initialNumToRender={20}
        windowSize={10}
        removeClippedSubviews
      />

      {/* Source chooser for outstanding spends */}
      <Modal visible={!!chooserForTx} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Pick a source</Text>
            {chooserForTx && (
              <Text style={styles.sheetSub}>
                {chooserForTx.merchant || chooserForTx.description || "Spend"} • $
                {Math.abs(chooserForTx.amount).toFixed(2)}
              </Text>
            )}

            <ScrollView style={{ maxHeight: 340, marginTop: 12 }}>
              <TouchableOpacity style={styles.sourceRow} onPress={() => pickSource("unallocated")}>
                <View>
                  <Text style={styles.sourceName}>Unallocated</Text>
                  <Text style={styles.sourceMeta}>Available: ${unallocated.toFixed(2)}</Text>
                </View>
                <Text style={styles.useText}>Use</Text>
              </TouchableOpacity>

              {envelopesSorted.map((e) => (
                <TouchableOpacity key={e.id} style={styles.sourceRow} onPress={() => pickSource(e.id)}>
                  <View>
                    <Text style={styles.sourceName}>{e.name}</Text>
                    <Text style={styles.sourceMeta}>
                      ${e.amount.toFixed(2)} • {e.type}/{e.rollover ? "rollover" : "no-rollover"}
                    </Text>
                  </View>
                  <Text style={styles.useText}>Use</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.cancelBtn} onPress={closeChooser}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusPill({ imported, isIncome, isSpend, allocated }) {
  if (isIncome) {
    return (
      <View style={[styles.pill, styles.pillIncome]}>
        <Text style={styles.pillIncomeText}>Income</Text>
      </View>
    );
  }
  if (imported) {
    return (
      <View style={[styles.pill, styles.pillImported]}>
        <Text style={styles.pillImportedText}>Imported</Text>
      </View>
    );
  }
  if (isSpend) {
    return (
      <View style={[styles.pill, allocated ? styles.pillAllocated : styles.pillOutstanding]}>
        <Text style={allocated ? styles.pillAllocatedText : styles.pillOutstandingText}>
          {allocated ? "Allocated" : "Outstanding"}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillImported]}>
      <Text style={styles.pillImportedText}>Imported</Text>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  empty: { color: "#9BA3B4", textAlign: "center", marginTop: 20 },

  card: {
    backgroundColor: "#151821",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#23283A",
    marginBottom: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  merchant: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 16, flexWrap: "wrap" },
  amountBox: { minWidth: 110, alignItems: "flex-end" },
  amount: { fontWeight: "800", fontSize: 16, textAlign: "right" },
  pos: { color: "#22c55e" },
  neg: { color: "#fb7b7b" },

  rowMid: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 10 },
  remaining: { color: "#9BA3B4", fontSize: 12 },

  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillAllocated: { backgroundColor: "rgba(79,209,197,0.15)", borderWidth: 1, borderColor: "#4FD1C5" },
  pillOutstanding: { backgroundColor: "rgba(251,146,60,0.15)", borderWidth: 1, borderColor: "#fb923c" },
  pillImported: { backgroundColor: "rgba(148,163,184,0.18)", borderWidth: 1, borderColor: "#94A3B8" },
  pillIncome: { backgroundColor: "rgba(34,197,94,0.15)", borderWidth: 1, borderColor: "#22c55e" },

  pillAllocatedText: { color: "#4FD1C5", fontWeight: "800", fontSize: 12 },
  pillOutstandingText: { color: "#fb923c", fontWeight: "800", fontSize: 12 },
  pillImportedText: { color: "#94A3B8", fontWeight: "800", fontSize: 12 },
  pillIncomeText: { color: "#22c55e", fontWeight: "800", fontSize: 12 },

  allocsBox: { marginTop: 8 },
  allocLine: { color: "#9BA3B4", fontSize: 12, marginTop: 2 },

  actions: { marginTop: 12, flexDirection: "row", gap: 10 },
  allocateBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  allocateBtnText: { color: "#fff", fontWeight: "800" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#151821", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#23283A" },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  sheetSub: { color: "#9BA3B4", marginTop: 6 },

  sourceRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#23283A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sourceMeta: { color: "#9BA3B4", marginTop: 2, fontSize: 12 },
  useText: { color: "#4FD1C5", fontWeight: "800" },
  cancelBtn: { backgroundColor: "#2A2F40", borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  cancelText: { color: "#fff", fontWeight: "700" },
});
