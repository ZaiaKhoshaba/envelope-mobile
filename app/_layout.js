// app/_layout.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { BudgetProvider, useBudget } from "../context/BudgetContext";
import { PurchaseProvider, usePurchase } from "../context/PurchaseContext";
import { ThemeProvider, useTheme, spacing, radius, typography } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePushNotifications } from "../lib/notifications";
import { useIdleReminder } from "../lib/idleNotifications";
import PinPad from "../components/PinPad";
import { fmt } from "../lib/format";

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
          `That source only covered $${fmt(remainingBefore - still)}.\nYou still need $${fmt(still)}. Choose another source.`,
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
              Remaining to allocate: ${fmt(ps.remaining)}
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
                  Available: ${fmt(unallocated)}
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
                    ${fmt(e.amount)} • {e.type === "fixed" ? "Fixed" : e.type === "savings" ? "Savings" : "Flexible"} •{" "}
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

// ── PIN lock modal ────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;

function PinLockModal() {
  const { isLocked, verifyPin, unlock, logout } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();

  const [current,     setCurrent]     = useState("");
  const [errMsg,      setErrMsg]      = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Biometric unlock (Face ID / fingerprint) ────────────────────────────────
  const tryBiometrics = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Tend",
        cancelLabel:   "Use PIN",
        disableDeviceFallback: true, // PIN pad below is our fallback
      });
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        unlock();
        setCurrent("");
      }
    } catch {
      // Fall through to PIN entry
    }
  }, [unlock]);

  useEffect(() => {
    if (!isLocked) return;
    let cancelled = false;
    (async () => {
      try {
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (cancelled) return;
        const available = hasHardware && enrolled;
        setBioAvailable(available);
        if (available) tryBiometrics(); // prompt immediately on lock
      } catch {
        if (!cancelled) setBioAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLocked, tryBiometrics]);

  const shake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40,  useNativeDriver: true }),
    ]).start();
  };

  const handleKey = async (key) => {
    if (key === "del") {
      setCurrent(v => v.slice(0, -1));
      setErrMsg("");
      return;
    }
    const next = current + key;
    if (next.length > PIN_LENGTH) return;
    setCurrent(next);
    setErrMsg("");

    if (next.length === PIN_LENGTH) {
      setTimeout(async () => {
        const ok = await verifyPin(next);
        if (ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          unlock();
          setCurrent("");
        } else {
          shake();
          setCurrent("");
          setErrMsg("Incorrect PIN");
        }
      }, 120);
    }
  };

  if (!isLocked) return null;

  const dots = Array.from({ length: PIN_LENGTH }).map((_, i) => ({
    filled: i < current.length,
  }));

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={[lock.backdrop, { backgroundColor: colors.bg }]}>
        <View style={lock.inner}>

          <View style={[lock.iconWrap, { backgroundColor: colors.accentSoft }]}>
            <Text style={lock.icon}>🔐</Text>
          </View>

          <Text style={[lock.title, { color: colors.textPrimary }]}>Enter your PIN</Text>
          <Text style={[lock.subtitle, { color: colors.textSecondary }]}>
            App was in background for a while
          </Text>

          <Animated.View style={[lock.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {dots.map((d, i) => (
              <View
                key={i}
                style={[
                  lock.dot,
                  {
                    backgroundColor: d.filled ? colors.accent : "transparent",
                    borderColor: d.filled ? colors.accent : colors.border,
                  },
                ]}
              />
            ))}
          </Animated.View>

          {!!errMsg && (
            <Text style={[lock.errText, { color: colors.danger }]}>{errMsg}</Text>
          )}

          <PinPad onKey={handleKey} colors={colors} />

          {bioAvailable && (
            <TouchableOpacity
              style={[lock.bioBtn, { borderColor: colors.accent }]}
              onPress={tryBiometrics}
              activeOpacity={0.7}
            >
              <Ionicons name="finger-print" size={18} color={colors.accent} />
              <Text style={[lock.bioText, { color: colors.accent }]}>
                Use Face ID / fingerprint
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[lock.logoutBtn, { borderColor: colors.border }]}
            onPress={() => {
              Alert.alert(
                "Log out",
                "You'll need to sign in again to access the app.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Log out",
                    style: "destructive",
                    onPress: async () => {
                      await logout();
                      router.replace("/login");
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={[lock.logoutText, { color: colors.textMuted }]}>Log out</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ── Inner layout ──────────────────────────────────────────────────────────────

function InnerLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  usePushNotifications();
  useIdleReminder();

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
            height:          64 + insets.bottom,
            paddingBottom:   10 + insets.bottom,
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

        {/* Hidden from tab bar — no chrome at all on auth/onboarding screens */}
        <Tabs.Screen name="login"           options={{ href: null, tabBarStyle: { display: "none" }, headerShown: false }} />
        <Tabs.Screen name="register"        options={{ href: null, tabBarStyle: { display: "none" }, headerShown: false }} />
        <Tabs.Screen name="onboarding"      options={{ href: null, tabBarStyle: { display: "none" }, headerShown: false }} />

        {/* Hidden from tab bar — standard chrome */}
        <Tabs.Screen name="add-income"      options={{ href: null, title: "Add Income" }} />
        <Tabs.Screen name="add-spend"       options={{ href: null, title: "Add Spend" }} />
        <Tabs.Screen name="bank-connect"    options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="cycle"           options={{ href: null, title: "Budget Cycle" }} />
        <Tabs.Screen name="edit-envelope"     options={{ href: null, title: "Edit Envelope" }} />
        <Tabs.Screen name="envelope-detail"  options={{ href: null, title: "Envelope" }} />
        <Tabs.Screen name="income-schedule" options={{ href: null, title: "Income Schedule" }} />
        <Tabs.Screen name="modal"           options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="new-envelope"    options={{ href: null, title: "New Envelope" }} />
        <Tabs.Screen name="transfer"        options={{ href: null, title: "Transfer Funds" }} />
        <Tabs.Screen name="pin-setup"       options={{ href: null, title: "Set Up PIN", tabBarStyle: { display: "none" } }} />
        <Tabs.Screen name="profile"         options={{ href: null, title: "Your account" }} />
        <Tabs.Screen name="data-consent"    options={{ href: null, title: "Data & consent" }} />
        <Tabs.Screen name="bank/callback"   options={{ href: null, headerShown: false }} />
      </Tabs>

      <SpendChooserModal />
      <PinLockModal />
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

// ── Lock modal styles ─────────────────────────────────────────────────────────

const lock = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    width: "100%",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.md,
    textAlign: "center",
    marginTop: -spacing.md,
  },
  dotsRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  errText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginTop: -spacing.sm,
  },
  bioBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  bioText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  logoutBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },
});

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