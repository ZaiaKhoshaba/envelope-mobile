// app/bank/callback.js
// Deep-link landing page after Fiskil's consent flow redirects back to tend://bank/callback
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../context/AuthContext";

const BACKEND_URL = process.env.EXPO_PUBLIC_BANK_BACKEND_URL ?? "https://envelope-bank-backend.onrender.com";
const CONNECTED_KEY = "@bank_connected";

export default function BankCallback() {
  const [status, setStatus] = useState("processing"); // "processing" | "success" | "error"
  const params    = useLocalSearchParams();
  const router    = useRouter();
  const { token } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        // The consent callback may include a code or error param from the bank
        const error = params?.error;
        if (error) throw new Error(String(error));

        // Persist connection locally
        await AsyncStorage.setItem(CONNECTED_KEY, "1");

        // Notify the backend (fiskilEndUserId stored from connect/start step)
        if (token) {
          await fetch(`${BACKEND_URL}/fiskil/connect/complete`, {
            method:  "POST",
            headers: {
              "Content-Type":  "application/json",
              Authorization:   `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          }).catch(() => {}); // non-fatal — backend already has it from connect/start
        }

        setStatus("success");
        // Give the user a moment to read the confirmation, then navigate back
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(tabs)/bank-connect");
          }
        }, 1500);
      } catch (e) {
        console.warn("Bank callback error:", e.message);
        setStatus("error");
        setTimeout(() => {
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/bank-connect");
        }, 2500);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      {status === "processing" && (
        <>
          <ActivityIndicator size="large" color="#2563EB" style={{ marginBottom: 16 }} />
          <Text style={styles.title}>Finishing connection…</Text>
        </>
      )}
      {status === "success" && (
        <>
          <Text style={styles.check}>✓</Text>
          <Text style={styles.title}>Bank connected</Text>
          <Text style={styles.sub}>Tap "Import latest transactions" to bring in your spending.</Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text style={styles.title}>Connection incomplete</Text>
          <Text style={styles.sub}>Something went wrong. Please try again from the bank screen.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E0F13",
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  check: {
    fontSize: 48,
    color: "#22c55e",
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  sub: {
    color: "#9BA3B4",
    textAlign: "center",
    lineHeight: 22,
  },
});
