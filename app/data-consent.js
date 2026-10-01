// app/data-consent.js
// The consumer's view of what they've shared and how to withdraw it.
// The CDR Rules require consumers to be able to see their consents, withdraw
// them, and ask for their data to be deleted — this screen is that dashboard.

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useBudget } from "../context/BudgetContext";
import { useTheme, makeStyles, spacing, radius, typography } from "../theme";
import { CDR_URL, OAIC_URL, AFCA_URL, SUPPORT_EMAIL } from "../lib/legal";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BANK_BACKEND_URL || "https://envelope-bank-backend.onrender.com";

const HANDLED = [
  { icon: "business-outline",  title: "Account balances",   body: "Read on demand to show your total balance. Never stored on our servers." },
  { icon: "receipt-outline",   title: "Transactions",       body: "Read on demand so you can sort spending into envelopes. Never stored on our servers." },
  { icon: "phone-portrait-outline", title: "Your envelopes", body: "Your budget lives on your device and syncs to your account so you don't lose it." },
  { icon: "close-circle-outline", title: "Never sold or shared", body: "Your financial data is never sold, rented, or given to advertisers or data brokers." },
];

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DataConsent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { disconnectBank, bankBalance } = useBudget();
  const s = makeStyles(colors);

  const [consents, setConsents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const r = await fetch(`${BACKEND_URL}/fiskil/consents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const j = await r.json();
        setConsents(Array.isArray(j.consents) ? j.consents : []);
      }
    } catch { /* offline — show what we know */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const withdrawAll = useCallback(() => {
    Alert.alert(
      "Withdraw consent",
      // What this said before: "Transactions already sorted into envelopes stay
      // in your budget." They don't — withdrawing deletes every imported
      // transaction from the device, sorted or not, which is the right
      // behaviour for CDR data and the opposite of what people were told
      // before they tapped a destructive button. The envelope balances do stay,
      // because those are stored separately.
      "Tend will stop accessing your bank data immediately and your banks will be disconnected. Every transaction imported from your bank is deleted from this device. The money you've already put into envelopes stays where it is.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw consent",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await disconnectBank();
              await load();
              Alert.alert(
                "Consent withdrawn",
                "Your banks are disconnected, data sharing has stopped, and the transactions imported from your bank have been deleted from this device."
              );
            } finally { setBusy(false); }
          },
        },
      ]
    );
  }, [disconnectBank, load]);

  const active = consents.filter(c => String(c.status || "").toLowerCase() !== "revoked");
  const hasSharing = active.length > 0 || bankBalance != null;

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── What Tend does with your data ── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[c.h, { color: colors.textPrimary }]}>What Tend does with your data</Text>
          <View style={[c.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {HANDLED.map((item, i) => (
              <View
                key={item.title}
                style={[c.item, i < HANDLED.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              >
                <Ionicons name={item.icon} size={20} color={colors.accent} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[c.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[c.itemBody, { color: colors.textSecondary }]}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Active consents ── */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[c.h, { color: colors.textPrimary }]}>Your data sharing</Text>

          {loading ? (
            <View style={[c.card, { backgroundColor: colors.card, borderColor: colors.border, padding: spacing.lg, alignItems: "center" }]}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : !hasSharing ? (
            <View style={[c.card, { backgroundColor: colors.card, borderColor: colors.border, padding: spacing.lg }]}>
              <Text style={[c.itemBody, { color: colors.textSecondary }]}>
                You're not sharing any bank data right now. Connect a bank from Settings to import transactions automatically.
              </Text>
            </View>
          ) : (
            <View style={[c.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {active.length === 0 ? (
                <View style={c.item}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[c.itemTitle, { color: colors.textPrimary }]}>Bank connected</Text>
                    <Text style={[c.itemBody, { color: colors.textSecondary }]}>Shared through Fiskil under Australia's Consumer Data Right.</Text>
                  </View>
                </View>
              ) : active.map((cs, i) => (
                <View
                  key={cs.arrangementId || i}
                  style={[c.item, i < active.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[c.itemTitle, { color: colors.textPrimary }]}>
                      Bank data sharing{cs.status ? ` — ${cs.status}` : ""}
                    </Text>
                    <Text style={[c.itemBody, { color: colors.textSecondary }]}>
                      {fmtDate(cs.createdAt) ? `Shared since ${fmtDate(cs.createdAt)}. ` : ""}
                      {fmtDate(cs.expiresAt) ? `Expires ${fmtDate(cs.expiresAt)}.` : "Active until you withdraw it."}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={[c.note, { color: colors.textMuted }]}>
            Consent is granted with your bank through Fiskil, our accredited data recipient. Tend never sees your banking login.
          </Text>
        </View>

        {/* ── Controls ── */}
        <View style={{ gap: spacing.sm }}>
          {hasSharing && (
            <TouchableOpacity
              style={[c.btn, { borderColor: colors.border, backgroundColor: colors.card }, busy && { opacity: 0.6 }]}
              onPress={withdrawAll}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color={colors.danger} />
                : <>
                    <Ionicons name="hand-left-outline" size={18} color={colors.danger} />
                    <Text style={[c.btnText, { color: colors.danger }]}>Withdraw consent and disconnect</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[c.btn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => router.push("/settings")}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            <Text style={[c.btnText, { color: colors.textSecondary }]}>Delete my account and data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[c.btn, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => Linking.openURL(CDR_URL)}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} />
            <Text style={[c.btnText, { color: colors.textSecondary }]}>Read our CDR policy</Text>
          </TouchableOpacity>
        </View>

        {/* ── If something goes wrong ──
            The CDR Rules require a consumer to be told how to complain and
            where to escalate if our answer doesn't satisfy them. Burying that
            in a policy document nobody opens doesn't meet the spirit of it, so
            it sits on the same screen as the consents themselves. */}
        <View style={{ gap: spacing.sm }}>
          <Text style={[c.h, { color: colors.textPrimary }]}>If something goes wrong</Text>
          <View style={[c.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[c.item, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[c.itemTitle, { color: colors.textPrimary }]}>Tell us first</Text>
                <Text style={[c.itemBody, { color: colors.textSecondary }]}>
                  Email {SUPPORT_EMAIL}. We'll acknowledge within 2 business days and give you an answer within 30 days.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[c.item, { borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={() => Linking.openURL(OAIC_URL)} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[c.itemTitle, { color: colors.textPrimary }]}>Office of the Australian Information Commissioner</Text>
                <Text style={[c.itemBody, { color: colors.textSecondary }]}>
                  If our answer doesn't satisfy you. oaic.gov.au or 1300 363 992.
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={c.item} onPress={() => Linking.openURL(AFCA_URL)} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={20} color={colors.accent} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={[c.itemTitle, { color: colors.textPrimary }]}>Australian Financial Complaints Authority</Text>
                <Text style={[c.itemBody, { color: colors.textSecondary }]}>
                  Free, independent dispute resolution. afca.org.au.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const c = StyleSheet.create({
  h: { fontSize: typography.md, fontWeight: typography.semibold },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  item: {
    flexDirection: "row", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  itemTitle: { fontSize: typography.md, fontWeight: typography.medium },
  itemBody:  { fontSize: typography.sm, marginTop: 2, lineHeight: 19 },
  note: { fontSize: typography.xs, lineHeight: 17, paddingHorizontal: spacing.xs },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1,
  },
  btnText: { fontSize: typography.md, fontWeight: typography.semibold },
});
