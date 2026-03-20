// app/bank-connect.js
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as Linking from "expo-linking";
import { useBudget } from "../context/BudgetContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BANK_BACKEND_URL ?? "http://192.168.0.170:4000";
const END_USER_ID = "353iNGH5lbSBAbGQJcIfhAY5iCQ"; // your sandbox user id (can be made editable later)

export default function BankConnectScreen() {
  const [busy, setBusy] = useState(false);
  const { importBankTransactions } = useBudget();

  const redirectUri = useMemo(() => Linking.createURL("/bank/callback"), []);

  const onConnect = async () => {
    try {
      setBusy(true);
      const r = await fetch(`${BACKEND_URL}/fiskil/connect/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endUserId: END_USER_ID, redirectUri }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "connect failed");
      Alert.alert("Connected", `End user: ${j.endUserId}`);
    } catch (e) {
      Alert.alert("Connect Error", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    try {
      setBusy(true);
      const r = await fetch(`${BACKEND_URL}/fiskil/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endUserId: END_USER_ID, limit: 100 }),
      });
      const j = await r.json();
      if (!r.ok) {
        // Show more context to help us debug quickly
        throw new Error(`${r.status} ${BACKEND_URL}/fiskil/transactions -> ${JSON.stringify(j)}`);
      }

      // Keep only very recent (optional)
      const sevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleaned = (j.txs || []).filter(t => {
        const ts = t.postedAt ? Date.parse(t.postedAt) : Date.now();
        return ts >= sevenDays;
      });

      importBankTransactions(cleaned);
      Alert.alert("Import", `Imported ${cleaned.length} transaction(s). Check Transactions.`);
    } catch (e) {
      Alert.alert("Import Error", String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bank Connect (Fiskil)</Text>
      <Text style={styles.subtitle}>Redirect URI: {redirectUri}</Text>

      <TouchableOpacity disabled={busy} onPress={onConnect} style={[styles.btn, busy && styles.btnDisabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect Bank</Text>}
      </TouchableOpacity>

      <TouchableOpacity disabled={busy} onPress={onImport} style={[styles.btnSecondary, busy && styles.btnDisabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Import Latest</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  subtitle: { color: "#9BA3B4", textAlign: "center", marginBottom: 16 },
  btn: { backgroundColor: "#1e3a8a", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  btnSecondary: { backgroundColor: "#111827", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
