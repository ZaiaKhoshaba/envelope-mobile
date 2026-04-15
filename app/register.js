// app/register.js
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

export default function RegisterScreen() {
  const { register, loading, isAuthenticated, error, setError } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [name, setName]           = useState("");
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
    if (password.length < 8) {
      setError?.("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const res = await register(email.trim(), password, name.trim());
    setSubmitting(false);
    if (res.ok) {
      // ── Route to onboarding instead of straight to home ──
      router.replace("/onboarding");
    }
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
            <View style={[s.logoWrap, { backgroundColor: colors.accent }]}>
              <Text style={s.logoLetter}>E</Text>
            </View>
            <Text style={[s.appName, { color: colors.textPrimary }]}>Envelopes</Text>
            <Text style={[s.tagline, { color: colors.textSecondary }]}>
              Set up takes less than 2 minutes.
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <Text style={[s.formTitle, { color: colors.textPrimary }]}>Create your account</Text>
            <Text style={[s.formSubtitle, { color: colors.textSecondary }]}>
              Step 1 of 4 — Account details
            </Text>

            {/* Progress dots */}
            <View style={s.progressRow}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    { backgroundColor: i === 0 ? colors.accent : colors.border },
                    i === 0 && { width: 20 },
                  ]}
                />
              ))}
            </View>

            {/* Error */}
            {error ? (
              <View style={[s.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* Name */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>
                Your name <Text style={{ color: colors.textMuted }}>(optional)</Text>
              </Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textMuted}
                autoComplete="name"
                value={name}
                onChangeText={t => { setName(t); clearErr(); }}
                returnKeyType="next"
              />
            </View>

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
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
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

              {/* Password strength hint */}
              {password.length > 0 && (
                <View style={s.strengthRow}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        s.strengthBar,
                        {
                          backgroundColor:
                            password.length >= (i + 1) * 2
                              ? password.length < 6 ? colors.danger
                              : password.length < 10 ? colors.warning
                              : colors.success
                              : colors.border,
                        },
                      ]}
                    />
                  ))}
                  <Text style={[s.strengthLabel, {
                    color: password.length < 6 ? colors.danger
                         : password.length < 10 ? colors.warning
                         : colors.success,
                  }]}>
                    {password.length < 6 ? "Too short"
                     : password.length < 10 ? "OK"
                     : "Strong"}
                  </Text>
                </View>
              )}
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
                <Text style={s.primaryBtnText}>Continue →</Text>
              )}
            </TouchableOpacity>

            {/* Switch to login */}
            <View style={s.switchRow}>
              <Text style={[s.switchText, { color: colors.textSecondary }]}>
                Already have an account?{"  "}
              </Text>
              <Link href="/login" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={[s.linkText, { color: colors.accent }]}>Sign in</Text>
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

  brandBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoLetter: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  appName: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: typography.sm,
    marginTop: spacing.xs,
  },

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
    fontSize: typography.sm,
    marginTop: -spacing.sm,
  },

  // Progress dots
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },

  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },

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

  // Password strength
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    minWidth: 52,
    textAlign: "right",
  },

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