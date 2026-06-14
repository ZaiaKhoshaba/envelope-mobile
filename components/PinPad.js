// components/PinPad.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { spacing, radius, typography } from "../theme";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "del"],
];

export default function PinPad({ onKey, colors }) {
  const press = (key) => {
    if (!key) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onKey(key);
  };

  return (
    <View style={pad.grid}>
      {KEYS.map((row, ri) => (
        <View key={ri} style={pad.row}>
          {row.map((key, ki) => {
            if (key === "") {
              return <View key={ki} style={pad.keyPlaceholder} />;
            }
            return (
              <TouchableOpacity
                key={ki}
                style={[pad.key, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                onPress={() => press(key)}
                activeOpacity={0.65}
              >
                {key === "del" ? (
                  <Ionicons name="backspace-outline" size={22} color={colors.textSecondary} />
                ) : (
                  <Text style={[pad.keyText, { color: colors.textPrimary }]}>{key}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const pad = StyleSheet.create({
  grid: {
    gap: spacing.md,
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPlaceholder: {
    width: 80,
    height: 80,
  },
  keyText: {
    fontSize: typography.xxl,
    fontWeight: typography.medium,
  },
});
