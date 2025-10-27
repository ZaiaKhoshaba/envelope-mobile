// app/bank-connect.js
import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useBudget } from "../context/BudgetContext";

// If you have EXPO_PUBLIC_BANK_BACKEND_URL, it will use that; otherwise fallback to your LAN.
const BACKEND_URL = process.env.EXPO_PUBLIC_BANK_BACKEND_URL ?? "http://192.168.0.170:4000";

export default function BankConnectScreen() {
  const [busy, setBusy] = useState(false);
  const { importBankTransactions } = useBudget();

  // Expo deep link that the backend used when building the hosted link
  const redirectUri = useMemo(() => Linking.createURL("/bank/callback"), []);

  const onConnectPress = async () => {
    try {
      setBusy(true);
      const resp = await fetch(`${BACKEND_URL}/basiq/connect/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientTag: "demo-user",
          email: "demo@example.com",
          redirectUri,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");

      if (!data.connectUrl) {
        Alert.alert("Connected", "Fallback mode: user linked. Tap “Import Latest” to pull transactions.");
        return;
      }

      const res = await WebBrowser.openAuthSessionAsync(data.connectUrl, redirectUri);
      if (res.type === "success" || res.type === "dismiss") {
        Alert.alert("Connect", "If you completed the flow, tap “Import Latest”.");
      }
    } catch (err) {
      Alert.alert("Connect Error", String(err));
    } finally {
      setBusy(false);
    }
  };

  const onImportLatest = async () => {
    try {
      setBusy(true);
      const resp = await fetch(`${BACKEND_URL}/basiq/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientTag: "demo-user", limit: 100 }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || "Import failed");

      // Keep only recent ones (e.g., last 7 days) to avoid historical back-fill affecting the UI
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleaned = (json.txs || [])
        .map((t) => ({
          id: String(t.id),
          amount: Number(t.amount) || 0,
          description: t.description || "Unknown",
          postedAt: t.postedAt || null,
        }))
        .filter((t) => {
          const ts = t.postedAt ? Date.parse(t.postedAt) : Date.now();
          return ts >= sevenDaysAgo;
        });

      // ✅ Push into context so they show in the Transactions screen
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
      <Text style={styles.title}>Bank Connect (Basiq)</Text>
      <Text style={styles.subtitle}>Redirect URI: {redirectUri}</Text>

      <TouchableOpacity style={[styles.btn, busy && styles.btnDisabled]} onPress={onConnectPress} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect Bank</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btnSecondary, busy && styles.btnDisabled]} onPress={onImportLatest} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Import Latest</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  subtitle: { color: "#9BA3B4", textAlign: "center", marginBottom: 20 },
  btn: {
    backgroundColor: "#1e3a8a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnSecondary: {
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabled: { opacity: 0.6 },
});
