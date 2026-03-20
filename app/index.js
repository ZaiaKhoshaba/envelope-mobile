// app/index.js
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { total, allocated, unallocated, simulateRandomSpend, resetAll } =
  useBudget();

  const { isAuthenticated, loading, logout } = useAuth();

  // ---------------------------------------------
  // LOGIN GUARD — redirect if not authenticated
  // ---------------------------------------------
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // While checking authentication, don't render the screen
  if (loading || !isAuthenticated) {
    return null;
  }

  // ---------------------------------------------
  // Normal Home UI
  // ---------------------------------------------
  const onMockSpend = () => {
  const result = simulateRandomSpend();
  if (result.ok) {
    // Go to transactions so you can allocate the spend straight away
    router.push("/transactions");
  }
};


  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>Envelope Budget (Mobile Prototype)</Text>

      {/* Totals Row */}
      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Total</Text>
          <Text style={styles.value}>${total.toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Allocated</Text>
          <Text style={styles.value}>${allocated.toFixed(2)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Unallocated</Text>
          <Text style={styles.valueAccent}>${unallocated.toFixed(2)}</Text>
        </View>
      </View>

      {/* Stacked Blue Buttons */}
      <View style={styles.actionsCol}>
        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/add-income")}
        >
          <Text style={styles.buttonText}>Add Income</Text>
        </TouchableOpacity>

        <TouchableOpacity
         style={styles.blueButton}
         onPress={() => router.push("/income-schedule")}
        >
         <Text style={styles.buttonText}>Income Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/new-envelope")}
        >
          <Text style={styles.buttonText}>Add Envelope</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/envelopes")}
        >
          <Text style={styles.buttonText}>Envelopes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/bank-connect")}
        >
          <Text style={styles.buttonText}>Bank Connect</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/transactions")}
        >
          <Text style={styles.buttonText}>Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.blueButton}
          onPress={() => router.push("/cycle")}
        >
          <Text style={styles.buttonText}>Cycle</Text>
        </TouchableOpacity>

        {true && (
          <TouchableOpacity
            style={[styles.blueButton, { backgroundColor: "#4FD1C5" }]}
            onPress={onMockSpend}
          >
            <Text style={styles.buttonText}>Mock Spend</Text>
          </TouchableOpacity>
        )}

        {true && (
         <TouchableOpacity
            style={[styles.blueButton, { backgroundColor: "#6B7280" }]}
            onPress={resetAll}
          >
             <Text style={styles.buttonText}>Reset Demo Data</Text>
           </TouchableOpacity>
        )}


        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.blueButton, { backgroundColor: "#EF4444" }]}
          onPress={onLogout}
        >
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 14,
  },
  row: { flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    backgroundColor: "#151821",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#23283A",
  },
  label: { color: "#9BA3B4", fontSize: 12, marginBottom: 6 },
  value: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  valueAccent: { color: "#4FD1C5", fontSize: 18, fontWeight: "800" },
  actionsCol: { marginTop: 20, gap: 10 },
  blueButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
});
