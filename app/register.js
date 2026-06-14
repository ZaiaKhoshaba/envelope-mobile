// app/register.js
import React, { useState } from "react";
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
import { Linking } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme, spacing, radius, typography } from "../theme";

// Update this once your GitHub Pages privacy policy is live
const PRIVACY_POLICY_URL = "https://zaiakhoshaba.github.io/tend-privacy-policy/";

const GENDERS = ["Male", "Female"];

export default function RegisterScreen() {
  const { register, loading, error, setError } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [firstName,   setFirstName]   = useState("");
  const [surname,     setSurname]     = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [dob,         setDob]         = useState("");   // DD/MM/YYYY
  const [gender,      setGender]      = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);

  // No redirect effect here — onSubmit handles navigation to /onboarding after
  // a successful registration. Having both an effect and onSubmit navigate at the
  // same time causes a race condition / crash.

  const formatDob = (text) => {
    // Auto-insert slashes: 12/05/1990
    const digits = text.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const validateDob = (val) => {
    if (!val) return true; // optional
    const parts = val.split("/");
    if (parts.length !== 3) return false;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    return true;
  };

  const onSubmit = async () => {
    const fn = firstName.trim();
    const sn = surname.trim();
    const em = email.trim();

    if (!fn)  { setError?.("First name is required."); return; }
    if (!sn)  { setError?.("Surname is required."); return; }
    if (!em)  { setError?.("Email is required."); return; }
    if (!password) { setError?.("Password is required."); return; }
    if (password.length < 8) { setError?.("Password must be at least 8 characters."); return; }
    if (!dob)               { setError?.("Date of birth is required."); return; }
    if (!validateDob(dob)) { setError?.("Enter a valid date of birth (DD/MM/YYYY)."); return; }
    if (!gender)           { setError?.("Please select your gender."); return; }

    setSubmitting(true);
    const res = await register(em, password, fn, sn, dob, gender);
    setSubmitting(false);
    if (res.ok) {
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
              <Text style={s.logoLetter}>T</Text>
            </View>
            <Text style={[s.appName, { color: colors.textPrimary }]}>Tend</Text>
            <Text style={[s.tagline, { color: colors.textSecondary }]}>
              Tend to your money.
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={[s.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>

            <Text style={[s.formTitle, { color: colors.textPrimary }]}>Create your account</Text>
            <Text style={[s.formSubtitle, { color: colors.textSecondary }]}>
              Takes less than 2 minutes.
            </Text>

            {/* Error */}
            {error ? (
              <View style={[s.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
                <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* Name row */}
            <View style={s.nameRow}>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>First name</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="e.g. Alex"
                  placeholderTextColor={colors.textMuted}
                  autoComplete="given-name"
                  value={firstName}
                  onChangeText={t => { setFirstName(t); clearErr(); }}
                  returnKeyType="next"
                />
              </View>
              <View style={[s.fieldWrap, { flex: 1 }]}>
                <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Surname</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="e.g. Smith"
                  placeholderTextColor={colors.textMuted}
                  autoComplete="family-name"
                  value={surname}
                  onChangeText={t => { setSurname(t); clearErr(); }}
                  returnKeyType="next"
                />
              </View>
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
                  returnKeyType="next"
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

              {password.length > 0 && (
                <View style={s.strengthRow}>
                  {[...Array(4)].map((_, i) => (
                    <View
                      key={i}
                      style={[s.strengthBar, {
                        backgroundColor:
                          password.length >= (i + 1) * 2
                            ? password.length < 6  ? colors.danger
                            : password.length < 10 ? colors.warning
                            : colors.success
                            : colors.border,
                      }]}
                    />
                  ))}
                  <Text style={[s.strengthLabel, {
                    color: password.length < 6  ? colors.danger
                         : password.length < 10 ? colors.warning
                         : colors.success,
                  }]}>
                    {password.length < 6 ? "Too short" : password.length < 10 ? "OK" : "Strong"}
                  </Text>
                </View>
              )}
            </View>

            {/* Date of birth */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Date of birth</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.cardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={dob}
                onChangeText={t => { setDob(formatDob(t)); clearErr(); }}
                maxLength={10}
                returnKeyType="next"
              />
            </View>

            {/* Gender */}
            <View style={s.fieldWrap}>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Gender</Text>
              <View style={s.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      s.genderPill,
                      { borderColor: gender === g ? colors.accent : colors.border,
                        backgroundColor: gender === g ? colors.accentSoft : colors.cardAlt },
                    ]}
                    onPress={() => setGender(prev => prev === g ? "" : g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.genderText, { color: gender === g ? colors.accent : colors.textSecondary }]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
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
                <Text style={s.primaryBtnText}>Create account →</Text>
              )}
            </TouchableOpacity>

            {submitting && (
              <Text style={[s.connectingText, { color: colors.textMuted }]}>
                Connecting to server — this can take up to 30 seconds on first use…
              </Text>
            )}

            {/* Privacy policy consent */}
            <Text style={[s.legalText, { color: colors.textMuted }]}>
              By creating an account you agree to our{" "}
              <Text
                style={{ color: colors.accent }}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>

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

  errorBanner: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
  },

  nameRow: {
    flexDirection: "row",
    gap: spacing.sm,
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

  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  genderPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  genderText: {
    fontSize: typography.sm,
    fontWeight: typography.medium,
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
  connectingText: {
    fontSize: typography.xs,
    textAlign: "center",
    marginTop: -spacing.xs,
  },

  legalText: {
    fontSize: typography.xs,
    textAlign: "center",
    lineHeight: 18,
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
