// app/envelopes.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import * as Haptics from "expo-haptics";

// ── Envelope card ─────────────────────────────────────────────────────────────

function EnvelopeCard({ env, onAllocate, onEdit, onDelete, colors }) {
  const [inputVal, setInputVal] = useState("");
  const isFixed   = env.type === "fixed";
  const accentCol = isFixed ? colors.fixed     : colors.flexible;
  const accentBg  = isFixed ? colors.fixedBg   : colors.flexibleBg;

  const handleAllocate = () => {
    const n = parseFloat(inputVal);
    if (isNaN(n) || n <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid amount", "Please enter a positive number.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAllocate(env.id, n);
    setInputVal("");
  };

  return (
    <View style={[card.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>

      {/* Top row: name + amount */}
      <View style={card.topRow}>
        <View style={{ flex: 1 }}>
          <View style={card.pills}>
            <View style={[card.pill, { backgroundColor: accentBg }]}>
              <Text style={[card.pillText, { color: accentCol }]}>
                {isFixed ? "Fixed" : "Flexible"}
              </Text>
            </View>
            {env.rollover && (
              <View style={[card.pill, { backgroundColor: colors.successBg }]}>
                <Text style={[card.pillText, { color: colors.success }]}>Rolls over</Text>
              </View>
            )}
          </View>
          <Text style={[card.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {env.name}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={[card.amountLabel, { color: colors.textSecondary }]}>Balance</Text>
          <Text style={[card.amount, { color: env.amount <= 0 ? colors.danger : colors.textPrimary }]}>
            ${env.amount.toFixed(2)}
          </Text>
          {env.target > 0 && (
            <Text style={[card.targetLabel, { color: colors.textMuted }]}>
              of ${Number(env.target).toFixed(2)} target
            </Text>
          )}
        </View>
      </View>

      {/* Progress bar — shows % of target reached, or full bar if no target set */}
      <View style={[card.track, { backgroundColor: colors.cardAlt }]}>
        <View
          style={[
            card.fill,
            {
              width: env.target > 0
                ? `${Math.min((env.amount / env.target) * 100, 100)}%`
                : env.amount > 0 ? "100%" : "0%",
              backgroundColor: env.amount <= 0 ? colors.danger : accentCol,
              opacity: 0.75,
            },
          ]}
        />
      </View>

      {/* Allocate row */}
      <View style={card.allocateRow}>
        <TextInput
          style={[card.input, {
            backgroundColor: colors.cardAlt,
            borderColor: colors.border,
            color: colors.textPrimary,
            flex: 1,
          }]}
          placeholder="Allocate $"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={inputVal}
          onChangeText={setInputVal}
          returnKeyType="done"
          onSubmitEditing={handleAllocate}
        />
        <TouchableOpacity
          style={[card.allocateBtn, { backgroundColor: colors.accent }]}
          onPress={handleAllocate}
          activeOpacity={0.8}
        >
          <Text style={card.allocateBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Action row */}
      <View style={card.actionRow}>
        <TouchableOpacity
          style={[card.actionBtn, { borderColor: colors.border, backgroundColor: colors.cardAlt }]}
          onPress={() => onEdit(env)}
          activeOpacity={0.75}
        >
          <Text style={[card.actionBtnText, { color: colors.textPrimary }]}>✏️  Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[card.actionBtn, { borderColor: colors.danger, backgroundColor: colors.dangerBg }]}
          onPress={() => onDelete(env.id, env.name)}
          activeOpacity={0.75}
        >
          <Text style={[card.actionBtnText, { color: colors.danger }]}>🗑  Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ name, onCancel, onConfirm, colors }) {
  return (
    <Modal transparent animationType="fade" visible>
      <View style={[del.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[del.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[del.title, { color: colors.textPrimary }]}>Delete envelope?</Text>
          <Text style={[del.body, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: typography.bold, color: colors.textPrimary }}>{name}</Text>
            {" "}will be removed and its balance returned to unallocated.
          </Text>
          <View style={del.btnRow}>
            <TouchableOpacity
              style={[del.btn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[del.btnText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[del.btn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[del.btnText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Envelopes() {
  const router = useRouter();
  const { colors } = useTheme();

  // ✅ Correct context values
  const { state, allocateToEnvelope, deleteEnvelope, total, allocated, unallocated } = useBudget();
  const s = makeStyles(colors);

  const [filter, setFilter]     = useState("all");
  const [delState, setDelState] = useState({ open: false, id: "", name: "" });

  const envelopes = state?.envelopes ?? [];

  const filtered = envelopes.filter(e => {
    if (filter === "fixed")    return e.type === "fixed";
    if (filter === "flexible") return e.type === "flexible";
    return true;
  });

  // ✅ Uses unallocated directly from context — no manual recalculation
  const handleAllocate = (envId, amount) => {
    if (amount > unallocated) {
      Alert.alert(
        "Not enough unallocated",
        `You only have $${unallocated.toFixed(2)} free to allocate.`
      );
      return;
    }
    allocateToEnvelope(envId, amount);
  };

  const handleEdit = (env) => {
    router.push({ pathname: "/edit-envelope", params: { id: env.id } });
  };

  const handleDeleteConfirm = (id, name) => {
    setDelState({ open: true, id, name });
  };

  const doDelete = () => {
    deleteEnvelope(delState.id);
    setDelState({ open: false, id: "", name: "" });
  };

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Summary strip: Allocated / Unallocated / Total ── */}
      <View style={[summ.strip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Allocated</Text>
          <Text style={[summ.val, { color: colors.textPrimary }]}>
            ${(allocated ?? 0).toFixed(2)}
          </Text>
        </View>

        <View style={[summ.divider, { backgroundColor: colors.border }]} />

        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Unallocated</Text>
          <Text style={[summ.val, { color: unallocated <= 0 ? colors.danger : colors.success }]}>
            ${(unallocated ?? 0).toFixed(2)}
          </Text>
        </View>

        <View style={[summ.divider, { backgroundColor: colors.border }]} />

        <View style={summ.col}>
          <Text style={[summ.label, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[summ.val, { color: colors.textPrimary }]}>
            ${(total ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* ── Filter tabs + New button ── */}
      <View style={[filt.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {["all", "fixed", "flexible"].map(f => (
          <TouchableOpacity
            key={f}
            style={[
              filt.tab,
              filter === f && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
            ]}
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

        <TouchableOpacity
          style={[filt.addBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/new-envelope")}
          activeOpacity={0.8}
        >
          <Text style={filt.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* ── Envelope list ── */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={empty.wrap}>
            <Text style={empty.icon}>✉️</Text>
            <Text style={[empty.title, { color: colors.textPrimary }]}>No envelopes yet</Text>
            <Text style={[empty.body, { color: colors.textSecondary }]}>
              Create your first envelope to start organising your money.
            </Text>
            <TouchableOpacity
              style={[s.primaryBtn, { marginTop: spacing.lg, paddingHorizontal: spacing.xl }]}
              onPress={() => router.push("/new-envelope")}
              activeOpacity={0.8}
            >
              <Text style={s.primaryBtnText}>Create envelope</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtered.map(env => (
            <EnvelopeCard
              key={env.id}
              env={env}
              colors={colors}
              onAllocate={handleAllocate}
              onEdit={handleEdit}
              onDelete={handleDeleteConfirm}
            />
          ))
        )}
      </ScrollView>

      {/* ── Delete confirm modal ── */}
      {delState.open && (
        <DeleteModal
          name={delState.name}
          colors={colors}
          onCancel={() => setDelState({ open: false, id: "", name: "" })}
          onConfirm={doDelete}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  pills: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pillText: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  name: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
  },
  amountLabel: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  amount: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  targetLabel: {
    fontSize: typography.xs,
    marginTop: 2,
  },
  track: {
    height: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  allocateRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.md,
  },
  allocateBtn: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  allocateBtnText: {
    color: "#fff",
    fontWeight: typography.bold,
    fontSize: typography.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
});

const summ = StyleSheet.create({
  strip: {
    flexDirection: "row",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  col: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  val: {
    fontSize: typography.lg,
    fontWeight: typography.heavy,
  },
  divider: {
    width: 1,
    marginVertical: spacing.xs,
  },
});

const filt = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    height: 48,
    gap: spacing.sm,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: typography.sm,
  },
  addBtn: {
    marginLeft: "auto",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  addBtnText: {
    color: "#fff",
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});

const del = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  box: {
    width: "100%",
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  body: {
    fontSize: typography.md,
    lineHeight: 22,
  },
  btnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
});

const empty = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
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
