// app/login.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useTheme, spacing, radius, typography } from "../theme";

export default function LoginScreen() {
  const { login, loading, isAuthenticated, error, setError } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated]);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError?.("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) router.replace("/");
  };

  const clearErr = () => { if (error) setError?.(null); };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Brand block ── */}
          <View style={s.brandBlock}>
            {/* Logo mark — envelope icon built from shapes */}
            <View style={[s.logoWrap, { backgroundColor: colors.accent }]}>
              <View style={[s.logoFlap, { borderBottomColor: colors.accent }]} />
              <View style={[s.logoBody, { borderColor: "rgba(255,255,255,0.35)" }]} />
              <Text style={s.logoLetter}>E</Text>
            </View>

            <Text style={[s.appName, { color: colors.textPrimary }]}>Envelopes</Text>
            <Text style={[s.tagline, { color: colors.textSecondary }]}>
              Your money, organised.
            </Text>
          </View>

          {/* ── Form block ── */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <Text style={[s.formTitle, { color: colors.textPrimary }]}>Welcome back</Text>
            <Text style={[s.formSubtitle, { color: colors.textSecondary }]}>
              Sign in to your account
            </Text>

            {/* Error */}
            {error ? (
              <View style={[s.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={t => { setEmail(t); clearErr(); }}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Password</Text>
              <View style={s.passRow}>
                <TextInput
                  style={[s.input, s.passInput, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  autoComplete="password"
                  value={password}
                  onChangeText={t => { setPassword(t); clearErr(); }}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
                <TouchableOpacity
                  style={[s.showBtn, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
                  onPress={() => setShowPass(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {showPass ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.accent }, (submitting || loading) && { opacity: 0.7 }]}
              onPress={onSubmit}
              disabled={submitting || loading}
              activeOpacity={0.85}
            >
              {submitting || loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Switch to register */}
            <View style={s.switchRow}>
              <Text style={[s.switchText, { color: colors.textSecondary }]}>
                Don't have an account?{"  "}
              </Text>
              <Link href="/register" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={[s.linkText, { color: colors.accent }]}>Create one</Text>
                </TouchableOpacity>
              </Link>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
    paddingBottom: 40,
  },

  // Brand
  brandBlock: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    position: "relative",
    overflow: "hidden",
  },
  logoFlap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    borderBottomWidth: 20,
    borderLeftWidth: 36,
    borderRightWidth: 36,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(255,255,255,0.2)",
  },
  logoBody: {
    position: "absolute",
    inset: 0,
    borderWidth: 2,
    borderRadius: radius.xl,
  },
  logoLetter: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    zIndex: 1,
  },
  appName: {
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.md,
    marginTop: spacing.xs,
  },

  // Form card
  formCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  formTitle: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
  },
  formSubtitle: {
    fontSize: typography.md,
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },

  // Error
  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },

  // Fields
  fieldWrap: { gap: spacing.xs },
  fieldLabel: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
  },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: typography.md,
  },
  passRow: { flexDirection: "row", gap: spacing.sm },
  passInput: { flex: 1 },
  showBtn: {
    width: 60,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // Buttons
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: typography.md,
    fontWeight: typography.bold,
  },

  // Switch row
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: spacing.xs,
  },
  switchText: { fontSize: typography.sm },
  linkText: { fontSize: typography.sm, fontWeight: typography.bold },
});