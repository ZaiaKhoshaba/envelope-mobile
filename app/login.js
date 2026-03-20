// app/login.js
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login, loading, user, isAuthenticated, error, setError } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, send them to the main screen (index)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/"); // home screen
    }
  }, [isAuthenticated, router]);

  const onSubmit = async () => {
    if (!email || !password) {
      setError?.("Please enter email and password");
      return;
    }
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) {
      router.replace("/"); // go to main screen
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Log in</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError(null);
        }}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError(null);
        }}
      />

      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={submitting || loading}>
        {submitting || loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Log in</Text>
        )}
      </TouchableOpacity>

      <View style={{ marginTop: 16 }}>
        <Text style={styles.switchText}>
          Don't have an account?{" "}
          <Link href="/register" style={styles.linkText}>
            Create one
          </Link>
        </Text>
      </View>

      {isAuthenticated && user && (
        <Text style={styles.meta}>Logged in as {user.email}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E0F13",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 24,
  },
  error: {
    color: "#f97373",
    marginBottom: 12,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#151821",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23283A",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  switchText: {
    color: "#9BA3B4",
    textAlign: "center",
  },
  linkText: {
    color: "#4FD1C5",
    fontWeight: "700",
  },
  meta: {
    color: "#64748b",
    marginTop: 20,
    textAlign: "center",
    fontSize: 12,
  },
});
