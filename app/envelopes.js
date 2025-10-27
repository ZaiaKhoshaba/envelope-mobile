// app/envelopes.js
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from "react-native";
import { useBudget } from "../context/BudgetContext";

export default function EnvelopesScreen() {
  const { state, allocateToEnvelope, editEnvelope, deleteEnvelope } = useBudget();

  const [editingId, setEditingId] = useState(null);
  const [editTarget, setEditTarget] = useState("");
  const [editFreq, setEditFreq] = useState("monthly");
  const [editDate, setEditDate] = useState(""); // YYYY-MM-DD
  const [editName, setEditName] = useState("");

  const envelopes = state.envelopes;

  const onOpenEdit = (env) => {
    setEditingId(env.id);
    setEditTarget(env.target ? String(env.target) : "");
    setEditFreq(env.freq || "monthly");
    setEditDate(env.targetDate ? env.targetDate.slice(0, 10) : "");
    setEditName(env.name || "");
  };
  const onCloseEdit = () => {
    setEditingId(null);
    setEditTarget("");
    setEditFreq("monthly");
    setEditDate("");
    setEditName("");
  };

  const onSaveEdit = () => {
    const updates = {};
    if (editName.trim()) updates.name = editName.trim();
    updates.target = Number(editTarget) || 0;
    updates.freq = editFreq;

    if (editDate.trim()) {
      const d = new Date(editDate.trim());
      if (Number.isNaN(d.getTime())) {
        Alert.alert("Target Date", "Please enter a valid date in YYYY-MM-DD format.");
        return;
      }
      updates.targetDate = d.toISOString();
    } else {
      updates.targetDate = null;
    }

    editEnvelope(editingId, updates);
    onCloseEdit();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Envelopes</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {envelopes.length === 0 && <Text style={styles.empty}>No envelopes yet.</Text>}

        {envelopes.map((e) => (
          <View key={e.id} style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.name}>{e.name}</Text>
              <Text style={styles.balance}>${e.amount.toFixed(2)}</Text>
            </View>

            {/* Frequency + Days Left */}
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                {e.type}/{e.rollover ? "rollover" : "no-rollover"} • {e.freq || "monthly"}
              </Text>
              {e.targetDate && (
                <Text style={styles.daysLeftText}>{daysLeftText(e.targetDate)}</Text>
              )}
            </View>

            {/* Progress bar (only if target > 0) */}
            {e.target > 0 && (
              <View style={styles.progressBox}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: progressPct(e.amount, e.target) + "%" }]} />
                </View>
                <Text style={styles.progressLabel}>
                  ${e.amount.toFixed(2)} / ${e.target.toFixed(2)} {e.targetDate ? `• due ${fmtDate(e.targetDate)}` : ""}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.btn} onPress={() => onOpenEdit(e)}>
                <Text style={styles.btnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={() =>
                  Alert.alert("Delete Envelope", `Delete "${e.name}"? Remaining funds will return to Unallocated.`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteEnvelope(e.id) },
                  ])
                }
              >
                <Text style={styles.btnText}>Delete</Text>
              </TouchableOpacity>
            </View>

            {/* Quick allocate from Unallocated -> Envelope */}
            <QuickAllocate envId={e.id} />
          </View>
        ))}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editingId} transparent animationType="fade" onRequestClose={onCloseEdit}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Edit Envelope</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor="#6B7280"
            />

            <Text style={styles.label}>Target Budget (optional)</Text>
            <TextInput
              style={styles.input}
              value={editTarget}
              onChangeText={setEditTarget}
              keyboardType="decimal-pad"
              placeholder="e.g. 400"
              placeholderTextColor="#6B7280"
            />

            <Text style={styles.label}>Frequency</Text>
            <Row>
              {["weekly", "fortnightly", "monthly"].map((f) => (
                <Chip key={f} active={editFreq === f} onPress={() => setEditFreq(f)}>
                  {f}
                </Chip>
              ))}
            </Row>

            <Text style={styles.label}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editDate}
              onChangeText={setEditDate}
              placeholder="e.g. 2025-06-20"
              placeholderTextColor="#6B7280"
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={onSaveEdit}>
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={onCloseEdit}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* Small components */
function QuickAllocate({ envId }) {
  const { allocateToEnvelope, unallocated } = useBudget();
  const [amt, setAmt] = useState("");

  return (
    <View style={styles.qaRow}>
      <Text style={styles.qaHint}>Unallocated: ${unallocated.toFixed(2)}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1, paddingVertical: 8 }]}
          value={amt}
          onChangeText={setAmt}
          keyboardType="decimal-pad"
          placeholder="Amount"
          placeholderTextColor="#6B7280"
        />
        <TouchableOpacity
          style={[styles.btn, { paddingVertical: 10 }]}
          onPress={() => {
            const n = Number(amt) || 0;
            if (n <= 0) return;
            allocateToEnvelope(envId, n);
            setAmt("");
          }}
        >
          <Text style={styles.btnText}>Allocate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ children }) {
  return <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>{children}</View>;
}

function Chip({ active, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
        },
        active
          ? { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "#2563EB" }
          : { backgroundColor: "#151821", borderColor: "#23283A" },
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "700", textTransform: "capitalize" }}>{children}</Text>
    </TouchableOpacity>
  );
}

/* Utils */
function progressPct(amount, target) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((amount / target) * 100)));
}

function daysLeftText(targetDateISO) {
  if (!targetDateISO) return "";
  const targetTs = new Date(targetDateISO).getTime();
  if (Number.isNaN(targetTs)) return "";
  const diffDays = Math.max(0, Math.ceil((targetTs - Date.now()) / (1000 * 60 * 60 * 24)));
  return `${diffDays} days left`;
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "";
  }
}

/* Styles */
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

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#fff", fontWeight: "800", fontSize: 16 },
  balance: { color: "#4FD1C5", fontWeight: "800", fontSize: 16 },

  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meta: { color: "#9BA3B4", fontSize: 12 },
  daysLeftText: { color: "#9BA3B4", fontSize: 12 },

  progressBox: { marginTop: 10 },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: "#23283A", overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#2563EB" },
  progressLabel: { color: "#9BA3B4", fontSize: 12, marginTop: 6 },

  actions: { marginTop: 12, flexDirection: "row", gap: 10 },
  btn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  btnDanger: { backgroundColor: "#991B1B", borderColor: "#7F1D1D" },
  btnSecondary: { backgroundColor: "#2A2F40", borderColor: "#23283A" },
  btnText: { color: "#fff", fontWeight: "800" },

  qaRow: { marginTop: 10 },
  qaHint: { color: "#9BA3B4", fontSize: 12, marginBottom: 6 },

  /* Modal */
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#151821", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#23283A" },
  sheetTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  label: { color: "#9BA3B4", fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#0E1017",
    color: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23283A",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
