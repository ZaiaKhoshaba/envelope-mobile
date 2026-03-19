// app/bank-connect.js
import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as Linking from "expo-linking";

// Use env if present; otherwise fall back to your LAN IP backend
const BACKEND_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL ?? "http://192.168.0.170:4000";

export default function BankConnectScreen() {
  const [busy, setBusy] = useState(false);

  // Just for display so you can see what Redirect URI Expo is using
  const redirectUri = useMemo(() => Linking.createURL("/bank/callback"), []);

  // --- Utilities -------------------------------------------------------------
  const showErr = (prefix, err, extra = "") => {
    const msg = typeof err === "string" ? err : (err?.message || String(err));
    Alert.alert(prefix, `${msg}${extra ? `\n${extra}` : ""}`);
  };

  // --- Ping backend (diagnostic) --------------------------------------------
  const onPing = async () => {
    try {
      const url = `${BACKEND_URL}/diag`;
      const res = await fetch(url);
      const json = await res.json();
      Alert.alert("Ping OK", JSON.stringify(json));
    } catch (e) {
      showErr("Ping failed", e, `\nBACKEND_URL=${BACKEND_URL}`);
    }
  };

  // --- Connect (Fiskil) ------------------------------------------------------
  // For now this just confirms backend can start the flow (or is in fallback).
  const onConnectPress = async () => {
    try {
      setBusy(true);
      const url = `${BACKEND_URL}/fiskil/connect/start`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${url} -> ${JSON.stringify(data)}`);

      // If your backend returns a hosted-link url later, open it in web browser.
      // For now we just notify.
      Alert.alert(
        "Connect",
        data?.connectUrl
          ? "Hosted link created; when live we’ll open it automatically."
          : "Sandbox/fallback mode: your end user is set. Tap “Import Latest”."
      );
    } catch (e) {
      showErr("Connect Error", e, `\nBACKEND_URL=${BACKEND_URL}`);
    } finally {
      setBusy(false);
    }
  };

  // --- Import latest transactions -------------------------------------------
  const onImportPress = async () => {
    try {
      setBusy(true);
      const url = `${BACKEND_URL}/fiskil/transactions`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }), // adjust as you like
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`${res.status} ${url} -> ${JSON.stringify(data)}`);

      const n = Array.isArray(data?.txs) ? data.txs.length : 0;
      Alert.alert("Import", `Imported ${n} transaction(s). Check Transactions.`);
    } catch (e) {
      showErr("Import Error", e, `\nBACKEND_URL=${BACKEND_URL}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bank Connect (Fiskil)</Text>
      <Text style={styles.subtitle}>Redirect URI: {redirectUri}</Text>

      <TouchableOpacity
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={onConnectPress}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Connect Bank</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnSecondary, busy && styles.btnDisabled]}
        onPress={onImportPress}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Import Latest</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnGhost, busy && styles.btnDisabled]}
        onPress={onPing}
        disabled={busy}
      >
        <Text style={styles.btnGhostText}>Ping Backend</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  subtitle: { color: "#9BA3B4", textAlign: "center", marginBottom: 18 },
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
    marginBottom: 10,
  },
  btnGhost: {
    paddingVertical: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnGhostText: { color: "#9BA3B4", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
});
