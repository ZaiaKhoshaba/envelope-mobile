// app/transactions.js
import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
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

function StatusPill({ historical, isIncome, isSpend, allocated, isTransfer, colors }) {
  let bg, border, textColor, label;

  if (isTransfer) {
    // Money moved between the user's own accounts — not spending, not income.
    bg = colors.accentSoft; border = colors.accent; textColor = colors.accent; label = "Transfer";
  } else if (isIncome) {
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

function TxCard({
  t, onAllocate, envelopes, colors, bankConnectedAt,
  selectMode, isSelected, onToggleSelect, onEnterSelect, onAccountedFor,
}) {
  // A transfer between the user's own accounts. Only the outgoing leg is shown
  // — the matching incoming leg is filtered out of the list, so the same $20
  // isn't presented twice.
  const isTransfer = !!t.transfer || t.kind === "transfer";
  const isIncome = !isTransfer && t.kind === "income";
  const isSpend  = !isTransfer && t.kind === "spend";

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

  const title = isTransfer
    ? `Moved to your other account`
    : t.merchant || t.description || (isIncome ? "Income" : "Transaction");

  const date = t.postedAt || t.createdAt;
  const dateStr = date
    ? new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "";

  // Only unsorted, non-historical spending can be bulk-selected. Income,
  // transfers and already-sorted rows have nothing to allocate.
  const selectable = isSpend && !isAllocated && !isHistorical;

  // Always the same component type. Swapping View <-> TouchableOpacity as rows
  // enter and leave selection forces every row to unmount and remount, which
  // with removeClippedSubviews is a known source of Android instability.
  // Interactivity is switched with `disabled` instead.
  const interactive = selectMode || selectable;
  const wrapperProps = selectMode
    ? { activeOpacity: 0.7, onPress: () => selectable && onToggleSelect?.(t.id) }
    : { activeOpacity: 1, onLongPress: selectable ? () => onEnterSelect?.(t.id) : undefined, delayLongPress: 300 };

  return (
    <TouchableOpacity
      disabled={!interactive}
      {...wrapperProps}
      style={[
        txcard.wrap,
        {
          backgroundColor: colors.card,
          borderColor: selectMode && isSelected ? colors.accent : colors.border,
          borderWidth:  selectMode && isSelected ? 2 : 1,
          opacity: selectMode && !selectable ? 0.45 : 1,
        },
      ]}
    >

      {/* Top row: merchant + amount */}
      <View style={txcard.topRow}>
        {selectMode && (
          <View
            style={{
              width: 22, height: 22, borderRadius: 6, marginRight: spacing.md, marginTop: 2,
              borderWidth: 2,
              borderColor: isSelected ? colors.accent : colors.border,
              backgroundColor: isSelected ? colors.accent : "transparent",
              alignItems: "center", justifyContent: "center",
            }}
          >
            {isSelected && <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>✓</Text>}
          </View>
        )}
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
          isTransfer={isTransfer}
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

      {/* A transfer isn't spending, so it is never drawn OUT of an envelope.
          Moving money to savings is a decision to set it aside — in envelope
          terms that means putting it IN. */}
      {isTransfer && !selectMode && !isAllocated && (
        <>
          <Text style={[txcard.remaining, { color: colors.textMuted, marginTop: spacing.xs }]}>
            Between your own accounts — your total hasn't changed.
          </Text>
          <TouchableOpacity
            style={[txcard.allocBtn, { backgroundColor: colors.accent }]}
            onPress={() => onAllocate(t)}
            activeOpacity={0.8}
          >
            <Text style={txcard.allocBtnText}>Put into an envelope →</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Allocate button for outstanding spends — including ones from the bank */}
      {isSpend && !isHistorical && !isAllocated && !selectMode && (
        <>
          <TouchableOpacity
            style={[txcard.allocBtn, { backgroundColor: colors.accent }]}
            onPress={() => onAllocate(t)}
            activeOpacity={0.8}
          >
            <Text style={txcard.allocBtnText}>Allocate to envelope →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAccountedFor?.(t.id)}
            activeOpacity={0.7}
            style={{ alignSelf: "center", paddingVertical: spacing.sm }}
          >
            <Text style={{ color: colors.textMuted, fontSize: typography.xs, fontWeight: typography.semibold }}>
              Already accounted for
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Long-press is invisible on its own, so say it once, on the first
          sortable row, when there is more than one thing to sort. */}
      {selectable && !selectMode && (
        <Text style={[txcard.date, { color: colors.textMuted, marginTop: spacing.xs }]}>
          Hold to select several
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const {
    state, allocateOutstanding, allocateMany, fundEnvelopeFromTransfer, markAccountedFor,
    unallocated, importBankTransactions, bankConnectedAt,
  } = useBudget();
  const { hasBankAccess } = usePurchase();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [chooserForTx, setChooserForTx] = useState(null);
  const [importing, setImporting]       = useState(false);
  const [filter, setFilter]             = useState("all"); // all | income | spend | outstanding

  const txs = useMemo(() => {
    // Hide the incoming half of a matched transfer — both legs describe the
    // same movement, and showing them separately implies money was both spent
    // and earned when neither happened.
    const list = (Array.isArray(state.transactions) ? state.transactions : [])
      .filter(t => !(t.transfer && t.transferRole === "in"));
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

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(() => new Set());

  const outstandingIds = useMemo(
    () => state.transactions
      .filter(t => t.kind === "spend" && !t.allocated && !isHistoricalTx(t, bankConnectedAt))
      .map(t => String(t.id)),
    [state.transactions, bankConnectedAt]
  );

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
      return next;
    });
  }, []);

  const enterSelect = useCallback((id) => {
    setSelectMode(true);
    setSelected(new Set(id ? [String(id)] : []));
  }, []);

  // From the banner: start with everything that needs sorting already ticked,
  // since "sort them all into one envelope" is the common case.
  const selectAllOutstanding = useCallback(() => {
    setSelectMode(true);
    setSelected(new Set(outstandingIds));
  }, [outstandingIds]);

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const t of state.transactions) {
      if (!selected.has(String(t.id))) continue;
      const used = (t.allocations || []).reduce((s, a) => s + (a.used || 0), 0);
      sum += Math.max(0, Math.abs(Number(t.amount) || 0) - used);
    }
    return Math.round(sum * 100) / 100;
  }, [selected, state.transactions]);

  // Inline confirmation instead of Alert. Calling Alert.alert() while the
  // picker Modal is still closing crashes Android: the Modal is its own window,
  // and opening a dialog against a window mid-dismissal throws
  // BadTokenException and kills the app. That is exactly what bulk allocate did
  // — single allocation never showed an Alert, which is why it never crashed.
  // A toast lives inside the screen, so there is no second window to race.
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message, ok = true) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, ok });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const accountForOne = useCallback((id) => {
    const res = markAccountedFor([id]);
    if (res?.message) showToast(res.message, !!res.ok);
  }, [markAccountedFor, showToast]);

  const openChooser  = useCallback(tx => setChooserForTx(tx), []);
  const closeChooser = useCallback(() => setChooserForTx(null), []);

  const pickSource = useCallback(sourceId => {
    // In selection mode the chooser applies to the whole selection.
    if (selectMode && selected.size > 0) {
      const res = allocateMany([...selected], sourceId);
      closeChooser();
      exitSelect();
      if (res?.message) showToast(res.message, !!res.ok);
      return;
    }
    if (!chooserForTx) return;

    // A transfer funds an envelope; a spend draws one down. Same gesture,
    // opposite direction — getting this backwards would take money out of an
    // envelope for cash the user never actually spent.
    const isTransfer = !!chooserForTx.transfer || chooserForTx.kind === "transfer";
    if (isTransfer) {
      if (sourceId === "unallocated") { closeChooser(); return; } // already unallocated
      const res = fundEnvelopeFromTransfer(chooserForTx.id, sourceId);
      closeChooser();
      if (res?.message) showToast(res.message, !!res.ok);
      return;
    }

    allocateOutstanding(chooserForTx.id, sourceId);
    closeChooser();
  }, [selectMode, selected, allocateMany, allocateOutstanding, fundEnvelopeFromTransfer, chooserForTx, closeChooser, exitSelect, showToast]);

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
      selectMode={selectMode}
      isSelected={selected.has(String(t.id))}
      onToggleSelect={toggleSelect}
      onEnterSelect={enterSelect}
      onAccountedFor={accountForOne}
    />
  ), [openChooser, state.envelopes, colors, bankConnectedAt, selectMode, selected, toggleSelect, enterSelect, accountForOne]);

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Outstanding banner ──
          Doubles as the way into bulk selection. It already appears exactly when
          there is something to sort, which makes it a far better entry point
          than a hidden long-press. */}
      {outstandingCount > 0 && !selectMode && (
        <TouchableOpacity
          style={[banner.wrap, { backgroundColor: colors.warningBg, borderBottomColor: colors.warning, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
          onPress={outstandingCount > 1 ? selectAllOutstanding : undefined}
          activeOpacity={outstandingCount > 1 ? 0.7 : 1}
        >
          <Text style={[banner.text, { color: colors.warning, flex: 1 }]}>
            ⚠️  {outstandingCount} spend{outstandingCount > 1 ? "s" : ""} need allocating
          </Text>
          {outstandingCount > 1 && (
            <Text style={[banner.text, { color: colors.warning, fontWeight: typography.bold, textDecorationLine: "underline" }]}>
              Sort all
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Selection header ── */}
      {selectMode && (
        <View style={[banner.wrap, { backgroundColor: colors.accentSoft, borderBottomColor: colors.accent, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
          <TouchableOpacity onPress={exitSelect} activeOpacity={0.7}>
            <Text style={[banner.text, { color: colors.accent, fontWeight: typography.bold }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[banner.text, { color: colors.accent }]}>
            {selected.size} selected
          </Text>
          <TouchableOpacity
            onPress={() => setSelected(new Set(selected.size === outstandingIds.length ? [] : outstandingIds))}
            activeOpacity={0.7}
          >
            <Text style={[banner.text, { color: colors.accent, fontWeight: typography.bold }]}>
              {selected.size === outstandingIds.length ? "None" : "All"}
            </Text>
          </TouchableOpacity>
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

      {/* ── Inline confirmation (replaces Alert — see showToast) ── */}
      {toast && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", left: spacing.lg, right: spacing.lg,
            bottom: selectMode ? 96 : spacing.lg,
            backgroundColor: toast.ok ? colors.accent : colors.danger,
            borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
            shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
            elevation: 6,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: typography.sm, fontWeight: typography.semibold, textAlign: "center" }}>
            {toast.message}
          </Text>
        </View>
      )}

      {/* ── Bulk action bar ── */}
      {selectMode && (
        <View style={[bulk.bar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          {/* For spending that was already taken out of the balance you divided
              into envelopes — files it as history without touching any envelope,
              instead of the draw-out-and-put-back round trip. */}
          <TouchableOpacity
            style={{ alignItems: "center", paddingVertical: spacing.sm, marginBottom: spacing.xs, opacity: selected.size ? 1 : 0.4 }}
            onPress={() => {
              if (!selected.size) return;
              const res = markAccountedFor([...selected]);
              exitSelect();
              if (res?.message) showToast(res.message, !!res.ok);
            }}
            disabled={!selected.size}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.textSecondary, fontSize: typography.sm, fontWeight: typography.semibold }}>
              Already accounted for — don't touch my envelopes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[bulk.btn, {
              backgroundColor: selected.size ? colors.accent : colors.cardAlt,
              borderColor: selected.size ? colors.accent : colors.border,
            }]}
            onPress={() => selected.size && setChooserForTx({ bulk: true })}
            activeOpacity={selected.size ? 0.85 : 1}
            disabled={!selected.size}
          >
            <Text style={[bulk.btnText, { color: selected.size ? "#FFFFFF" : colors.textMuted }]}>
              {selected.size
                ? `Allocate ${selected.size} — $${fmt(selectedTotal)}`
                : "Select transactions to allocate"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Source chooser modal ── */}
      <Modal visible={!!chooserForTx} transparent animationType="slide">
        <View style={[chooser.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[chooser.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <View style={[chooser.handle, { backgroundColor: colors.border }]} />

            <Text style={[chooser.title, { color: colors.textPrimary }]}>
              {chooserForTx?.bulk
                ? `Allocate ${selected.size} transaction${selected.size !== 1 ? "s" : ""}`
                : chooserForTx?.transfer || chooserForTx?.kind === "transfer"
                  ? "Put into an envelope"
                  : "Allocate to envelope"}
            </Text>
            {chooserForTx?.bulk ? (
              <View style={[chooser.chip, { backgroundColor: colors.accentSoft }]}>
                <Text style={[chooser.chipText, { color: colors.accent }]}>
                  {selected.size} selected — ${fmt(selectedTotal)}
                </Text>
              </View>
            ) : chooserForTx ? (
              <View style={[chooser.chip, { backgroundColor: colors.dangerBg }]}>
                <Text style={[chooser.chipText, { color: colors.danger }]}>
                  {chooserForTx.merchant || "Spend"} — ${fmt(Math.abs(chooserForTx.amount))}
                </Text>
              </View>
            ) : null}

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
// Bulk action bar — sits above the tab bar while selecting.
const bulk = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});
