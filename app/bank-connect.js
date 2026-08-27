// app/bank-connect.js
import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useBudget } from "../context/BudgetContext";
import { usePurchase } from "../context/PurchaseContext";
import { useAuth } from "../context/AuthContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";

const BACKEND_URL = process.env.EXPO_PUBLIC_BANK_BACKEND_URL ?? "https://envelope-bank-backend.onrender.com";
const CONNECTED_KEY = "@bank_connected";

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({ number, title, body, done, colors }) {
  return (
    <View style={[step.wrap, { borderColor: colors.border }]}>
      <View style={[step.badge, { backgroundColor: done ? colors.successBg : colors.accentSoft }]}>
        {done
          ? <Ionicons name="checkmark" size={16} color={colors.success} />
          : <Text style={[step.num, { color: colors.accent }]}>{number}</Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[step.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[step.body, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BankConnectScreen() {
  const [busy, setBusy]           = useState(false);
  const [connected, setConnected] = useState(false);
  const [checking, setChecking]   = useState(true);
  const { importBankTransactions, setBankBalance } = useBudget();
  const { hasBankAccess }          = usePurchase();
  const { token }                  = useAuth();
  const { colors }                 = useTheme();
  const s                          = makeStyles(colors);

  const authHeaders = useMemo(() => ({
    "Content-Type":  "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const redirectUri = useMemo(() => Linking.createURL("/bank/callback"), []);

  // Pull the live total balance (summed across all connected accounts) and make
  // it the app's top-line total, superseding any manual entry.
  const refreshBalance = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/fiskil/balance`, { headers: authHeaders });
      if (r.ok) {
        const j = await r.json();
        if (typeof j.balance === "number") setBankBalance(j.balance);
      }
    } catch { /* keep last known balance */ }
  }, [authHeaders, setBankBalance]);

  // Check backend for live connection status on mount
  useEffect(() => {
    if (!hasBankAccess || !token) { setChecking(false); return; }
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/fiskil/status`, { headers: authHeaders });
        if (r.ok) {
          const j = await r.json();
          // Trust the backend's explicit answer — it checks the live CDR consent.
          setConnected(!!j.connected);
          if (j.connected) {
            await AsyncStorage.setItem(CONNECTED_KEY, "1");
            refreshBalance();
          } else {
            await AsyncStorage.removeItem(CONNECTED_KEY);
            setBankBalance(null);
          }
        }
      } catch {
        // Offline or backend sleeping — use cached value
        const cached = await AsyncStorage.getItem(CONNECTED_KEY);
        setConnected(cached === "1");
      } finally {
        setChecking(false);
      }
    })();
  }, [hasBankAccess, token]);

  // ── Premium gate ────────────────────────────────────────────────────────────
  if (!hasBankAccess) {
    return (
      <SafeAreaView style={s.screen}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, alignItems: "center", paddingTop: 60 }}>
          <View style={[{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl }]}>
            <Ionicons name="lock-closed" size={32} color={colors.accent} />
          </View>
          <Text style={{ fontSize: typography.xl, fontWeight: typography.heavy, color: colors.textPrimary, textAlign: "center", marginBottom: spacing.sm }}>
            Premium feature
          </Text>
          <Text style={{ fontSize: typography.md, color: colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: spacing.xl }}>
            Bank connectivity is available on the Premium plan. Upgrade to automatically sync your transactions and allocate spends with one tap.
          </Text>
          <View style={[{ width: "100%", borderRadius: radius.lg, borderWidth: 1, backgroundColor: colors.card, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.xl }]}>
            {["Real-time bank account sync", "Spend notifications & one-tap allocation", "Automatic income allocation"].map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: i < 2 ? spacing.sm : 0 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                <Text style={{ fontSize: typography.sm, color: colors.textPrimary, flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: "center" }}>
            Go to <Text style={{ fontWeight: typography.bold, color: colors.accent }}>Settings → Subscription</Text> to upgrade.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const onConnect = useCallback(async () => {
    try {
      setBusy(true);

      // Ask backend to create (or reuse) a Fiskil end-user and open an auth session
      const r = await fetch(`${BACKEND_URL}/fiskil/connect/start`, {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ redirectUri }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Connection failed");

      const { url, fiskilEndUserId } = j;
      if (!url) throw new Error("No consent URL returned from server");

      // Open the consent page in a browser that SURVIVES app-switching. CommBank
      // (and many CDR banks) make you jump to their app for an approval code, which
      // closes openAuthSessionAsync. openBrowserAsync + showInRecents keeps it alive,
      // so you can switch to the bank app and back. Completion is handled by the
      // deep-link callback (app/bank/callback.js) and the status poll below.
      await WebBrowser.openBrowserAsync(url, { showInRecents: true });

      // Don't trust the browser result — leaving to read an SMS code can return
      // "dismiss" even mid-flow. Verify the REAL consent status with the backend,
      // polling a few times since the consent can take a moment to register.
      let isConnected = false;
      for (let i = 0; i < 5; i++) {
        try {
          const sr = await fetch(`${BACKEND_URL}/fiskil/status`, { headers: authHeaders });
          if (sr.ok && (await sr.json()).connected) { isConnected = true; break; }
        } catch { /* backend cold-starting — retry */ }
        await new Promise((res) => setTimeout(res, 2000));
      }

      if (isConnected) {
        if (fiskilEndUserId) {
          await fetch(`${BACKEND_URL}/fiskil/connect/complete`, {
            method:  "POST",
            headers: authHeaders,
            body:    JSON.stringify({ fiskilEndUserId }),
          }).catch(() => {});
        }
        setConnected(true);
        await AsyncStorage.setItem(CONNECTED_KEY, "1");
        await refreshBalance();
        Alert.alert("Bank connected", "Your bank account has been linked successfully.");
      } else {
        setConnected(false);
        await AsyncStorage.removeItem(CONNECTED_KEY);
        Alert.alert(
          "Not connected yet",
          "The bank authorization wasn't completed. In the bank's window, finish every step — including entering the SMS code — without switching to another app, then try again."
        );
      }
    } catch (e) {
      Alert.alert("Connection failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }, [authHeaders, redirectUri, refreshBalance]);

  const onImport = useCallback(async () => {
    try {
      setBusy(true);
      const r = await fetch(`${BACKEND_URL}/fiskil/transactions`, {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({ limit: 100 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(j)}`);

      const sevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cleaned = (j.txs || []).filter(t => {
        const ts = t.postedAt ? Date.parse(t.postedAt) : Date.now();
        return ts >= sevenDays;
      });

      importBankTransactions(cleaned);
      await refreshBalance();
      Alert.alert(
        "Import complete",
        `${cleaned.length} transaction${cleaned.length !== 1 ? "s" : ""} imported from the last 7 days.`
      );
    } catch (e) {
      Alert.alert("Import failed", e.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }, [authHeaders, importBankTransactions, refreshBalance]);

  const onDisconnect = useCallback(() => {
    Alert.alert(
      "Disconnect bank",
      "Your transaction history will remain. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setConnected(false);
            await AsyncStorage.removeItem(CONNECTED_KEY);
            setBankBalance(null); // revert the top-line total to manual mode
          },
        },
      ]
    );
  }, [setBankBalance]);

  if (checking) {
    return (
      <SafeAreaView style={[s.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header illustration ── */}
        <View style={[hero.wrap, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="business" size={40} color={colors.accent} />
          <Text style={[hero.title, { color: colors.textPrimary }]}>Connect your bank</Text>
          <Text style={[hero.body, { color: colors.textSecondary }]}>
            Link your bank account so your transactions appear automatically — no manual entry needed.
          </Text>
        </View>

        {/* ── How it works ── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[s.sectionTitle, { marginBottom: spacing.xs }]}>How it works</Text>
          <StepRow
            number="1"
            title="Connect your bank"
            body="Securely link your account via open banking. We never store your credentials."
            done={connected}
            colors={colors}
          />
          <StepRow
            number="2"
            title="Transactions sync"
            body="Your spending appears in real time. Tap each transaction to draw from the right envelope."
            done={false}
            colors={colors}
          />
          <StepRow
            number="3"
            title="Budget stays accurate"
            body="Your envelope balances update automatically as you spend."
            done={false}
            colors={colors}
          />
        </View>

        {/* ── Status card ── */}
        <View style={[s.card, statusSt.wrap, { borderColor: connected ? colors.success : colors.border }]}>
          <View style={[statusSt.dot, { backgroundColor: connected ? colors.success : colors.textMuted }]} />
          <View style={{ flex: 1 }}>
            <Text style={[statusSt.label, { color: colors.textPrimary }]}>
              {connected ? "Bank connected" : "No bank linked"}
            </Text>
            <Text style={[statusSt.sub, { color: colors.textSecondary }]}>
              {connected ? "Open banking via Fiskil" : "Tap below to get started"}
            </Text>
          </View>
          {connected && (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          )}
        </View>

        {/* ── Actions ── */}
        <View style={{ gap: spacing.sm }}>
          {!connected && (
            <TouchableOpacity
              style={[s.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={onConnect}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>Connect bank account</Text>
              }
            </TouchableOpacity>
          )}

          {connected && (
            <TouchableOpacity
              style={[s.primaryBtn, busy && { opacity: 0.6 }]}
              onPress={onImport}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.primaryBtnText}>Import latest transactions</Text>
              }
            </TouchableOpacity>
          )}

          {connected && (
            <TouchableOpacity
              style={[s.secondaryBtn, { borderColor: colors.danger }]}
              onPress={onDisconnect}
              activeOpacity={0.8}
            >
              <Text style={[s.secondaryBtnText, { color: colors.danger }]}>Disconnect bank</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Privacy note ── */}
        <View style={[privacy.wrap, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} style={{ marginTop: 1 }} />
          <Text style={[privacy.text, { color: colors.textMuted }]}>
            Your credentials are never stored. Bank access uses open banking standards and can be revoked at any time.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const hero = StyleSheet.create({
  wrap: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  title: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    textAlign: "center",
  },
  body: {
    fontSize: typography.md,
    textAlign: "center",
    lineHeight: 22,
  },
});

const step = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  num: {
    fontSize: typography.sm,
    fontWeight: typography.heavy,
  },
  title: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    marginBottom: 2,
  },
  body: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
});

const statusSt = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
  },
  sub: {
    fontSize: typography.sm,
    marginTop: 1,
  },
});

const privacy = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  text: {
    flex: 1,
    fontSize: typography.xs,
    lineHeight: 17,
  },
});
