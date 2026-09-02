// theme/index.js
// ─────────────────────────────────────────────
// Single source of truth for all design tokens.
// Import this in every screen:
//   import { useTheme } from '../theme';
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

// ── Colour palettes ───────────────────────────────────────────────────────────

const light = {
  // Backgrounds
  bg:           '#F5F6FA',   // page background
  card:         '#FFFFFF',   // card / surface
  cardAlt:      '#F0F1F7',   // subtle alternate card (e.g. list rows)
  border:       '#E4E7EF',   // dividers and card outlines

  // Text
  textPrimary:  '#0D0F14',
  textSecondary:'#6B7280',
  textMuted:    '#9CA3AF',

  // Brand — Deep Indigo, matching the app icon
  accent:       '#4338CA',   // primary indigo
  accentSoft:   '#EEF0FE',   // indigo tint background

  // Envelope types  (Black = fixed, White = flexible — your original naming)
  fixed:        '#0D0F14',   // "black envelope" label colour
  fixedBg:      '#F0F1F7',
  flexible:     '#4338CA',   // "white envelope" label colour
  flexibleBg:   '#EEF0FE',

  // Status
  success:      '#10B981',
  successBg:    '#ECFDF5',
  warning:      '#F59E0B',
  warningBg:    '#FFFBEB',
  danger:       '#EF4444',
  dangerBg:     '#FEF2F2',

  // Misc
  overlay:      'rgba(0,0,0,0.35)',
  shadow:       '#000',
};

const dark = {
  bg:           '#0E0F13',
  card:         '#151821',
  cardAlt:      '#1C2030',
  border:       '#23283A',

  textPrimary:  '#F1F5F9',
  textSecondary:'#9BA3B4',
  textMuted:    '#6B7280',

  accent:       '#818CF8',   // lighter indigo, for contrast on dark
  accentSoft:   '#252150',

  fixed:        '#E2E8F0',
  fixedBg:      '#1C2030',
  flexible:     '#A5B4FC',
  flexibleBg:   '#252150',

  success:      '#10B981',
  successBg:    '#064E3B',
  warning:      '#F59E0B',
  warningBg:    '#451A03',
  danger:       '#EF4444',
  dangerBg:     '#450A0A',

  overlay:      'rgba(0,0,0,0.6)',
  shadow:       '#000',
};

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
  // Sizes
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   22,
  xxl:  28,
  hero: 36,

  // Weights (React Native uses string weights)
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '800',
};

// ── Spacing & radius ──────────────────────────────────────────────────────────

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  pill:99,
};

// ── Theme context ─────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true); // default: dark

  const toggle = () => setIsDark(prev => !prev);
  const colors = isDark ? dark : light;

  return (
    <ThemeContext.Provider value={{ colors, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

// ── Shared style helpers ──────────────────────────────────────────────────────
// Call makeStyles(colors) inside a component to get pre-built style objects.

export function makeStyles(colors) {
  return {
    // Page wrapper
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },

    // Standard card
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Row of cards with equal flex
    cardRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },

    // Label above a value
    label: {
      fontSize: typography.xs,
      fontWeight: typography.medium,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },

    // Primary large number
    bigValue: {
      fontSize: typography.xxl,
      fontWeight: typography.heavy,
      color: colors.textPrimary,
    },

    // Medium value
    medValue: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.textPrimary,
    },

    // Section heading
    sectionTitle: {
      fontSize: typography.md,
      fontWeight: typography.bold,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },

    // Primary button (full width)
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 15,
      alignItems: 'center',
    },

    primaryBtnText: {
      color: '#FFFFFF',
      fontSize: typography.md,
      fontWeight: typography.bold,
    },

    // Ghost / secondary button
    secondaryBtn: {
      backgroundColor: colors.cardAlt,
      borderRadius: radius.md,
      paddingVertical: 15,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },

    secondaryBtnText: {
      color: colors.textPrimary,
      fontSize: typography.md,
      fontWeight: typography.semibold,
    },

    // Danger button
    dangerBtn: {
      backgroundColor: colors.dangerBg,
      borderRadius: radius.md,
      paddingVertical: 15,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
    },

    dangerBtnText: {
      color: colors.danger,
      fontSize: typography.md,
      fontWeight: typography.bold,
    },

    // Text input
    input: {
      backgroundColor: colors.cardAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.md,
      color: colors.textPrimary,
    },

    // Pill badge
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },

    // Horizontal divider
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.md,
    },
  };
}