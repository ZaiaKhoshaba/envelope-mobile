// app/_layout.js
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AuthProvider } from "../context/AuthContext";
import { BudgetProvider, useBudget } from "../context/BudgetContext";
import { PurchaseProvider, usePurchase } from "../context/PurchaseContext";
import { ThemeProvider, useTheme, spacing, radius, typography } from "../theme";
import { usePushNotifications } from "../lib/notifications";
import PaywallScreen from "../components/PaywallScreen";

// ── Spend Chooser Modal ───────────────────────────────────────────────────────

function SpendChooserModal() {
  const { state, commitSpendPart, cancelSpend, unallocated } = useBudget();
  const { colors } = useTheme();
  const ps = state.pendingSpend;

  if (!ps) return null;

  const envs = [...state.envelopes].sort((a, b) => b.amount - a.amount);

  const handleSelect = (sourceId, available) => {
    const remainingBefore = ps.remaining;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commitSpendPart(sourceId);
    if (available < remainingBefore) {
      const still = Number((remainingBefore - available).toFixed(2));
      if (still > 0) {
        Alert.alert(
          "Shortfall",
          `That source only covered $${(remainingBefore - still).toFixed(2)}.\nYou still need $${still.toFixed(2)}. Choose another source.`,
          [{ text: "OK" }]
        );
      }
    }
  };

  return (
    <Modal transparent animationType="slide" visible>
      <View style={[modal.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[modal.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[modal.handle, { backgroundColor: colors.border }]} />

          <Text style={[modal.title, { color: colors.textPrimary }]}>Cover this spend</Text>
          <Text style={[modal.subtitle, { color: colors.textSecondary }]}>{ps.merchant}</Text>

          <View style={[modal.chip, { backgroundColor: colors.accentSoft }]}>
            <Text style={[modal.chipText, { color: colors.accent }]}>
              Remaining to allocate: ${ps.remaining.toFixed(2)}
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[modal.row, { borderBottomColor: colors.border }]}
              onPress={() => handleSelect("unallocated", unallocated)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={[modal.envName, { color: colors.textPrimary }]}>Unallocated funds</Text>
                <Text style={[modal.envMeta, { color: colors.textSecondary }]}>
                  Available: ${unallocated.toFixed(2)}
                </Text>
              </View>
              <View style={[modal.usePill, { backgroundColor: colors.accentSoft }]}>
                <Text style={[modal.useText, { color: colors.accent }]}>Use</Text>
              </View>
            </TouchableOpacity>

            {envs.map(e => (
              <TouchableOpacity
                key={e.id}
                style={[modal.row, { borderBottomColor: colors.border }]}
                onPress={() => handleSelect(e.id, e.amount)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[modal.envName, { color: colors.textPrimary }]}>{e.name}</Text>
                  <Text style={[modal.envMeta, { color: colors.textSecondary }]}>
                    ${e.amount.toFixed(2)} • {e.type === "fixed" ? "Fixed" : "Flexible"} •{" "}
                    {e.rollover ? "Rolls over" : "Resets"}
                  </Text>
                </View>
                <View style={[modal.usePill, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[modal.useText, { color: colors.accent }]}>Use</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[modal.cancelBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
            onPress={cancelSpend}
            activeOpacity={0.8}
          >
            <Text style={[modal.cancelText, { color: colors.danger }]}>Cancel spend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Inner layout ──────────────────────────────────────────────────────────────

function InnerLayout() {
  const { colors, isDark } = useTheme();
  const { isActive, isLoading } = usePurchase();

  usePushNotifications();

  // Show nothing while we're checking the trial/subscription status
  if (isLoading) return null;

  // Trial expired and not subscribed — replace the whole app with the paywall
  if (!isActive) return <PaywallScreen />;

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Tabs
        screenOptions={({ route }) => ({
          headerStyle:       { backgroundColor: colors.card },
          headerTintColor:   colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: {
            fontWeight: typography.bold,
            fontSize:   typography.lg,
          },
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor:  colors.border,
            borderTopWidth:  1,
            height:          64,
            paddingBottom:   10,
            paddingTop:      8,
          },
          tabBarActiveTintColor:   colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize:   typography.xs,
            fontWeight: typography.semibold,
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="envelopes"
          options={{
            title: "Envelopes",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "mail" : "mail-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Transactions",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "receipt" : "receipt-outline"} size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
            ),
          }}
        />

        {/* Hidden from tab bar */}
        <Tabs.Screen name="add-income"      options={{ href: null }} />
        <Tabs.Screen name="bank-connect"    options={{ href: null }} />
        <Tabs.Screen name="bank"            options={{ href: null }} />
        <Tabs.Screen name="cycle"           options={{ href: null }} />
        <Tabs.Screen name="edit-envelope"   options={{ href: null }} />
        <Tabs.Screen name="income-schedule" options={{ href: null }} />
        <Tabs.Screen name="login"           options={{ href: null }} />
        <Tabs.Screen name="modal"           options={{ href: null }} />
        <Tabs.Screen name="new-envelope"    options={{ href: null }} />
        <Tabs.Screen name="register"        options={{ href: null }} />
        <Tabs.Screen name="onboarding"      options={{ href: null }} />
        <Tabs.Screen name="bank/callback"   options={{ href: null }} />
      </Tabs>

      <SpendChooserModal />
    </>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function Layout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PurchaseProvider>
          <BudgetProvider>
            <InnerLayout />
          </BudgetProvider>
        </PurchaseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// ── Modal styles ──────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth:          1,
    borderBottomWidth:    0,
    padding:              spacing.xl,
    paddingBottom:        36,
  },
  handle: {
    width:        40,
    height:       4,
    borderRadius: 2,
    alignSelf:    "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize:     typography.xl,
    fontWeight:   typography.heavy,
    marginBottom: 4,
  },
  subtitle: {
    fontSize:     typography.md,
    marginBottom: spacing.lg,
  },
  chip: {
    alignSelf:     "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:  radius.pill,
    marginBottom:  spacing.lg,
  },
  chipText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
  },
  row: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  envName: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
  },
  envMeta: {
    fontSize:  typography.sm,
    marginTop: 2,
  },
  usePill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.pill,
  },
  useText: {
    fontSize:   typography.sm,
    fontWeight: typography.bold,
  },
  cancelBtn: {
    marginTop:     spacing.lg,
    borderRadius:  radius.md,
    paddingVertical: 14,
    alignItems:    "center",
    borderWidth:   1,
  },
  cancelText: {
    fontSize:   typography.md,
    fontWeight: typography.bold,
  },
});