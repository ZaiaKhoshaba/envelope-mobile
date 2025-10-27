// app/bank/callback.js
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";

export default function BankCallback() {
  useEffect(() => {
    // you could parse params here in a real flow
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bank Connected</Text>
      <Text style={styles.sub}>You can close this screen and tap "Import Latest".</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16, justifyContent: "center", alignItems: "center" },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  sub: { color: "#9BA3B4" },
});
