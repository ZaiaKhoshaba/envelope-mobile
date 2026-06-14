// app/pin-setup.js
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../context/AuthContext";
import { useTheme, spacing, radius, typography } from "../theme";
import PinPad from "../components/PinPad";

const PIN_LENGTH = 4;

export default function PinSetupScreen() {
  const router  = useRouter();
  const { enablePin } = useAuth();
  const { colors } = useTheme();

  const [stage,   setStage]   = useState("enter");  // "enter" | "confirm"
  const [first,   setFirst]   = useState("");
  const [current, setCurrent] = useState("");
  const [errMsg,  setErrMsg]  = useState("");

  const shakeAnim = useRef(new Animated.Value(0)).current;

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

  const handleKey = (key) => {
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
      setTimeout(() => advance(next), 120);
    }
  };

  const advance = async (pin) => {
    if (stage === "enter") {
      setFirst(pin);
      setCurrent("");
      setStage("confirm");
    } else {
      if (pin !== first) {
        shake();
        setCurrent("");
        setErrMsg("PINs don't match — try again");
        return;
      }
      await enablePin(pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
    }
  };

  const dots = Array.from({ length: PIN_LENGTH }).map((_, i) => ({
    filled: i < current.length,
  }));

  const title    = stage === "enter" ? "Set your PIN" : "Confirm your PIN";
  const subtitle = stage === "enter"
    ? "Choose a 4-digit PIN for quick access"
    : "Enter your PIN again to confirm";

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>

      <TouchableOpacity style={s.skip} onPress={() => router.replace("/")} activeOpacity={0.7}>
        <Text style={[s.skipText, { color: colors.textMuted }]}>Skip</Text>
      </TouchableOpacity>

      <View style={s.inner}>

        {/* Icon */}
        <View style={[s.iconWrap, { backgroundColor: colors.accentSoft }]}>
          <Text style={s.icon}>🔐</Text>
        </View>

        <Text style={[s.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

        {/* PIN dots */}
        <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {dots.map((d, i) => (
            <View
              key={i}
              style={[
                s.dot,
                {
                  backgroundColor: d.filled ? colors.accent : "transparent",
                  borderColor: d.filled ? colors.accent : colors.border,
                },
              ]}
            />
          ))}
        </Animated.View>

        {/* Error message */}
        {!!errMsg && (
          <Text style={[s.errText, { color: colors.danger }]}>{errMsg}</Text>
        )}

        {/* Numpad */}
        <PinPad onKey={handleKey} colors={colors} />

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1 },
  inner:  {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  skip: {
    position: "absolute",
    top: spacing.xl,
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  skipText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
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
});
