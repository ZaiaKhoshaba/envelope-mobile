// app/transactions.js
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  SafeAreaView,
} from "react-native";
import { useBudget } from "../context/BudgetContext";
import { usePurchase } from "../context/PurchaseContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { fmt } from "../lib/format";

// A bank transaction counts as history only if it happened before the bank was
// connected. Everything since is live spending the user is meant to allocate.
function isHistoricalTx(t, bankConnectedAt) {
  if (!t.imported) return false;                    // typed in by hand — never "imported"
  if (typeof t.historical === "boolean") return t.historical; // stamped at import — authoritative
  // Fallback for transactions imported before the flag existed.
  if (!bankConnectedAt) return false;
  const when = t.postedAt || t.createdAt;
  if (!when) return false;
  const at = Date.parse(when);
  const connected = Date.parse(bankConnectedAt);
  if (Number.isNaN(at) || Number.isNaN(connected)) return false;
  return at < connected;
}

// ── Status pill ───────────────────────────────────────────────────────────────

function StatusPill({ historical, isIncome, isSpend, allocated, colors }) {
  let bg, border, textColor, label;

  if (isIncome) {
    bg = colors.successBg; border = colors.success; textColor = colors.success; label = "Income";
  } else if (historical) {
    // Spending from before the bank was connected — history, not a to-do.
    bg = colors.cardAlt; border = colors.border; textColor = colors.textSecondary; label = "Imported";
  } else if (isSpend && allocated) {
    bg = colors.accentSoft; border = colors.accent; textColor = colors.accent; label = "Allocated";
  } else if (isSpend && !allocated) {
    bg = colors.warningBg; border = colors.warning; textColor = colors.warning; label = "Outstanding";
  } else {
    bg = colors.cardAlt; border = colors.border; textColor = colors.textSecondary; label = "Transaction";
  }

  return (
    <View style={[pill.wrap, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[pill.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ── Transaction card ──────────────────────────────────────────────────────────

function TxCard({ t, onAllocate, envelopes, colors, bankConnectedAt }) {
  const isIncome = t.kind === "income";
  const isSpend  = t.kind === "spend";

  // "Imported" is only for spending that predates the bank connection. Anything
  // that happened after you connected is live spending waiting to be allocated.
  const isHistorical = isHistoricalTx(t, bankConnectedAt);

  const displaySign = isIncome ? "+" : "-";
  const amountAbs   = fmt(Math.abs(Number(t.amount) || 0));
  const amountText  = `${displaySign}$${amountAbs}`;
  const amountColor = isIncome ? colors.success : colors.danger;

  const already    = (t.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
  const remaining  = Math.max(0, Number(((Math.abs(t.amount) || 0) - already).toFixed(2)));
  const isAllocated = !!t.allocated;

  const title = t.merchant || t.description || (isIncome ? "Income" : "Transaction");

  const date = t.postedAt || t.createdAt;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <View style={[txcard.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>

      {/* Top row: merchant + amount */}
      <View style={txcard.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[txcard.merchant, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
          {dateStr ? (
            <Text style={[txcard.date, { color: colors.textMuted }]}>{dateStr}</Text>
          ) : null}
        </View>
        <Text style={[txcard.amount, { color: amountColor }]}>{amountText}</Text>
      </View>

      {/* Status pill + remaining */}
      <View style={txcard.midRow}>
        <StatusPill
          historical={isHistorical}
          isIncome={isIncome}
          isSpend={isSpend}
          allocated={isAllocated}
          colors={colors}
        />
        {isSpend && !isAllocated && remaining > 0 && (
          <Text style={[txcard.remaining, { color: colors.textSecondary }]}>
            Unallocated: ${fmt(remaining)}
          </Text>
        )}
      </View>

      {/* Allocation breakdown */}
      {t.allocations && t.allocations.length > 0 && (
        <View style={[txcard.allocBox, { borderTopColor: colors.border }]}>
          {t.allocations.map((a, i) => {
            const label = a.sourceId === "unallocated"
              ? "Unallocated"
              : envelopes.find(e => e.id === a.sourceId)?.name || "Envelope";
            return (
              <Text
                key={`${t.id}_a_${a.sourceId}_${i}`}
                style={[txcard.allocLine, { color: colors.textSecondary }]}
              >
                • {label}: ${fmt(Number(a.used))}
              </Text>
            );
          })}
        </View>
      )}

      {/* Allocate button for outstanding spends — including ones from the bank */}
      {isSpend && !isHistorical && !isAllocated && (
        <TouchableOpacity
          style={[txcard.allocBtn, { backgroundColor: colors.accent }]}
          onPress={() => onAllocate(t)}
          activeOpacity={0.8}
        >
          <Text style={txcard.allocBtnText}>Allocate to envelope →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const { state, allocateOutstanding, unallocated, importBankTransactions, bankConnectedAt } = useBudget();
  const { hasBankAccess } = usePurchase();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [chooserForTx, setChooserForTx] = useState(null);
  const [importing, setImporting]       = useState(false);
  const [filter, setFilter]             = useState("all"); // all | income | spend | outstanding

  const txs = useMemo(() => {
    const list = Array.isArray(state.transactions) ? [...state.transactions] : [];
    list.sort((a, b) => {
      const at = new Date(a.postedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.postedAt || b.createdAt || 0).getTime();
      return bt - at;
    });
    if (filter === "income")      return list.filter(t => t.kind === "income");
    if (filter === "spend")       return list.filter(t => t.kind === "spend");
    if (filter === "outstanding") {
      return list.filter(
        t => t.kind === "spend" && !t.allocated && !isHistoricalTx(t, bankConnectedAt)
      );
    }
    return list;
  }, [state.transactions, filter, bankConnectedAt]);

  const envelopesSorted = useMemo(
    () => [...state.envelopes].sort((a, b) => b.amount - a.amount),
    [state.envelopes]
  );

  // Anything unallocated that isn't pre-connection history still needs sorting,
  // whether it was typed in by hand or came from the bank.
  const outstandingCount = useMemo(
    () => state.transactions.filter(
      t => t.kind === "spend" && !t.allocated && !isHistoricalTx(t, bankConnectedAt)
    ).length,
    [state.transactions, bankConnectedAt]
  );

  const openChooser  = useCallback(tx => setChooserForTx(tx), []);
  const closeChooser = useCallback(() => setChooserForTx(null), []);

  const pickSource = useCallback(sourceId => {
    if (!chooserForTx) return;
    allocateOutstanding(chooserForTx.id, sourceId);
    closeChooser();
  }, [chooserForTx, allocateOutstanding, closeChooser]);

  const handleImport = async () => {
    setImporting(true);
    await importBankTransactions();
    setImporting(false);
  };

  const keyExtractor = useCallback((t, idx) => {
    const k = t?.id ?? `${t?.postedAt ?? ""}|${t?.amount ?? ""}`;
    return String(k) + `#${idx}`;
  }, []);

  const renderItem = useCallback(({ item: t }) => (
    <TxCard
      t={t}
      onAllocate={openChooser}
      envelopes={state.envelopes}
      colors={colors}
      bankConnectedAt={bankConnectedAt}
    />
  ), [openChooser, state.envelopes, colors, bankConnectedAt]);

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Outstanding banner ── */}
      {outstandingCount > 0 && (
        <View style={[banner.wrap, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning }]}>
          <Text style={[banner.text, { color: colors.warning }]}>
            ⚠️  {outstandingCount} spend{outstandingCount > 1 ? "s" : ""} need allocating
          </Text>
        </View>
      )}

      {/* ── Filter tabs + Import button ── */}
      <View style={[filt.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {["all", "income", "spend", "outstanding"].map(f => (
          <TouchableOpacity
            key={f}
            style={[filt.tab, filter === f && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <Text style={[filt.tabText, {
              color:      filter === f ? colors.accent : colors.textSecondary,
              fontWeight: filter === f ? typography.bold : typography.regular,
            }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Import button — premium only ── */}
      {hasBankAccess && (
        <TouchableOpacity
          style={[imp.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleImport}
          activeOpacity={0.8}
          disabled={importing}
        >
          <Text style={[imp.text, { color: importing ? colors.textMuted : colors.accent }]}>
            {importing ? "Importing…" : "🏦  Import bank transactions"}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Transaction list ── */}
      <FlatList
        data={txs}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={empty.wrap}>
            <Text style={empty.icon}>🧾</Text>
            <Text style={[empty.title, { color: colors.textPrimary }]}>No transactions yet</Text>
            <Text style={[empty.body, { color: colors.textSecondary }]}>
              {hasBankAccess
                ? "Import from your bank to see transactions here."
                : "Use Add Income and Add Spend on the home screen to record your transactions."}
            </Text>
          </View>
        }
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        initialNumToRender={20}
        windowSize={10}
        removeClippedSubviews
      />

      {/* ── Source chooser modal ── */}
      <Modal visible={!!chooserForTx} transparent animationType="slide">
        <View style={[chooser.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[chooser.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <View style={[chooser.handle, { backgroundColor: colors.border }]} />

            <Text style={[chooser.title, { color: colors.textPrimary }]}>
              Allocate to envelope
            </Text>
            {chooserForTx && (
              <View style={[chooser.chip, { backgroundColor: colors.dangerBg }]}>
                <Text style={[chooser.chipText, { color: colors.danger }]}>
                  {chooserForTx.merchant || "Spend"} — ${fmt(Math.abs(chooserForTx.amount))}
                </Text>
              </View>
            )}

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>

              {/* Unallocated row */}
              <TouchableOpacity
                style={[chooser.row, { borderBottomColor: colors.border }]}
                onPress={() => pickSource("unallocated")}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[chooser.sourceName, { color: colors.textPrimary }]}>
                    Unallocated funds
                  </Text>
                  <Text style={[chooser.sourceMeta, { color: colors.textSecondary }]}>
                    Available: ${fmt(unallocated)}
                  </Text>
                </View>
                <View style={[chooser.usePill, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[chooser.useText, { color: colors.accent }]}>Use</Text>
                </View>
              </TouchableOpacity>

              {/* Envelope rows */}
              {envelopesSorted.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[chooser.row, { borderBottomColor: colors.border }]}
                  onPress={() => pickSource(e.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[chooser.sourceName, { color: colors.textPrimary }]}>{e.name}</Text>
                    <Text style={[chooser.sourceMeta, { color: colors.textSecondary }]}>
                      ${fmt(e.amount)} • {e.type === "fixed" ? "Fixed" : e.type === "savings" ? "Savings" : "Flexible"} •{" "}
                      {e.rollover ? "Rolls over" : "Resets"}
                    </Text>
                  </View>
                  <View style={[chooser.usePill, { backgroundColor: colors.accentSoft }]}>
                    <Text style={[chooser.useText, { color: colors.accent }]}>Use</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[chooser.cancelBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
              onPress={closeChooser}
              activeOpacity={0.8}
            >
              <Text style={[chooser.cancelText, { color: colors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pill = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});

const txcard = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  merchant: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    flex: 1,
  },
  date: {
    fontSize: typography.xs,
    marginTop: 3,
  },
  amount: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
    minWidth: 80,
    textAlign: "right",
  },
  midRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  remaining: {
    fontSize: typography.xs,
  },
  allocBox: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: 3,
  },
  allocLine: {
    fontSize: typography.sm,
  },
  allocBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  allocBtnText: {
    color: "#fff",
    fontWeight: typography.bold,
    fontSize: typography.sm,
  },
});

const banner = StyleSheet.create({
  wrap: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  text: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});

const filt = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.xs,
  },
});

const imp = StyleSheet.create({
  btn: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  text: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});

const empty = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  icon: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  body: {
    fontSize: typography.md,
    textAlign: "center",
    lineHeight: 22,
  },
});

const chooser = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: spacing.xl,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    marginBottom: spacing.sm,
  },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
  },
  chipText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  sourceName: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  sourceMeta: {
    fontSize: typography.sm,
    marginTop: 2,
  },
  usePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  useText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
  cancelBtn: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});