import type { TextStyle, ViewStyle } from 'react-native'

export const darkTheme = {
  // ---------------------------------------------------------------------------
  // Design system canonical color tokens (Lexicon — see .cursor/rules/desing.md)
  // ---------------------------------------------------------------------------
  bg: '#0A0A0F',
  bgElevated: '#13131A',
  bgSubtle: '#1A1A22',

  textPrimary: '#F0F0F5',
  textSecondary: '#A8A8B0',
  textMuted: '#7A7A82',
  textInverse: '#0A0A0F',

  primary: '#6B5BFF',
  primaryDim: 'rgba(107, 91, 255, 0.15)',

  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#38BDF8',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',

  // ---------------------------------------------------------------------------
  // Deprecated aliases. These keys are kept for backward compatibility while
  // the codebase migrates to the design-system canonical names. Their values
  // have been updated to match the design system. Do NOT delete these until
  // grep finds zero usages across mobile/src.
  // ---------------------------------------------------------------------------
  /** @deprecated use `textPrimary` */
  text: '#F0F0F5',
  /** @deprecated use `textMuted` */
  muted: '#7A7A82',
  /** @deprecated use `bgElevated` */
  surface: '#13131A',
  /** @deprecated use `bgSubtle` */
  surface2: '#1A1A22',
  /** @deprecated legacy gradient companion to `primary`; not in design system */
  primary2: '#7b81f5',

  // ---------------------------------------------------------------------------
  // Legacy decorative / surface tokens (no design-system equivalent yet).
  // ---------------------------------------------------------------------------
  /** Matches web --header-bg */
  headerBg: 'rgba(11, 14, 20, 0.92)',
  /** Subtle radial accents (web :root gradients) */
  glowPurple: 'rgba(124, 58, 237, 0.22)',
  glowGreen: 'rgba(34, 197, 94, 0.16)',

  // ---------------------------------------------------------------------------
  // Learn screen / glass UI palette. Spec defers these to GlassUi helpers; keep
  // as-is for visual continuity on the Learn surface.
  // ---------------------------------------------------------------------------
  learnScreenBg: '#10131a',
  learnGlass: 'rgba(29, 32, 38, 0.75)',
  learnGlassBorder: 'rgba(70, 69, 84, 0.4)',
  learnHeadline: '#bdc2ff',
  learnAccent: '#bdc2ff',
  learnAccentStrong: '#7c87f3',
  learnOnSurface: '#e1e2eb',
  learnOnSurfaceVariant: '#c7c4d7',
  learnTertiary: '#ccbeff',
  learnSearchBg: '#0b0e14',
  learnPillIdle: '#272a31',
  learnPillActiveBg: '#bdc2ff',
  learnPillActiveText: '#332664',
  learnOutline: '#464554',
  learnViewToggleBg: '#0b0e14',
  learnGlowBlob1: 'rgba(189, 194, 255, 0.08)',
  learnGlowBlob2: 'rgba(204, 190, 255, 0.07)',
}

// =============================================================================
// TODO(design-system-light-mode): The following tokens use placeholder values
// derived from existing dark-mode equivalents. They have not been tuned for
// light mode contrast and accessibility. Address before shipping any UI that
// uses lightTheme + new tokens.
// =============================================================================
export const lightTheme: typeof darkTheme = {
  bg: '#f5f5fb',
  bgElevated: '#ffffff',
  bgSubtle: '#f3f4ff',

  textPrimary: '#0b1220',
  textSecondary: 'rgba(11, 18, 32, 0.65)',
  textMuted: 'rgba(11, 18, 32, 0.55)',
  textInverse: '#F0F0F5',

  primary: '#6366f1',
  primaryDim: 'rgba(99, 102, 241, 0.15)',

  success: '#16a34a',
  warning: '#F59E0B',
  danger: '#ef4444',
  info: '#0EA5E9',

  border: 'rgba(11,18,32,0.12)',
  borderStrong: 'rgba(11, 18, 32, 0.2)',
  borderSubtle: 'rgba(11, 18, 32, 0.06)',

  /** @deprecated use `textPrimary` */
  text: '#0b1220',
  /** @deprecated use `textMuted` */
  muted: 'rgba(11,18,32,0.68)',
  /** @deprecated use `bgElevated` */
  surface: '#ffffff',
  /** @deprecated use `bgSubtle` */
  surface2: '#f3f4ff',
  /** @deprecated legacy gradient companion to `primary`; not in design system */
  primary2: '#7b81f5',

  headerBg: 'rgba(245, 245, 251, 0.92)',
  glowPurple: 'rgba(124, 58, 237, 0.1)',
  glowGreen: 'rgba(99, 102, 241, 0.08)',

  learnScreenBg: '#f4f4fc',
  learnGlass: 'rgba(255, 255, 255, 0.92)',
  learnGlassBorder: 'rgba(11, 18, 32, 0.1)',
  learnHeadline: '#4f46e5',
  learnAccent: '#6366f1',
  learnAccentStrong: '#4f46e5',
  learnOnSurface: '#0b1220',
  learnOnSurfaceVariant: 'rgba(11, 18, 32, 0.65)',
  learnTertiary: '#7c3aed',
  learnSearchBg: '#ffffff',
  learnPillIdle: '#e8e9f4',
  learnPillActiveBg: '#6366f1',
  learnPillActiveText: '#ffffff',
  learnOutline: 'rgba(11, 18, 32, 0.25)',
  learnViewToggleBg: '#eef0f8',
  learnGlowBlob1: 'rgba(99, 102, 241, 0.12)',
  learnGlowBlob2: 'rgba(124, 58, 237, 0.08)',
}

export type AppTheme = typeof darkTheme

// =============================================================================
// Spacing — 4px base unit. See design-system Spacing section.
// =============================================================================
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const

// =============================================================================
// Radius — see design-system Radius section.
// =============================================================================
export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
} as const

// =============================================================================
// Typography — fontFamily is supplied at consumer sites via useGlassFonts().
// See design-system Typography section.
// =============================================================================
export const typography = {
  display: { fontSize: 48, fontWeight: '700', lineHeight: 56 } as TextStyle,
  hero: { fontSize: 36, fontWeight: '700', lineHeight: 44 } as TextStyle,
  title: { fontSize: 24, fontWeight: '700', lineHeight: 32 } as TextStyle,
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 24 } as TextStyle,
  subheading: { fontSize: 16, fontWeight: '600', lineHeight: 22 } as TextStyle,
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 } as TextStyle,
  bodyEmphasis: { fontSize: 15, fontWeight: '600', lineHeight: 22 } as TextStyle,
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18 } as TextStyle,
  caption: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  } as TextStyle,
  micro: { fontSize: 11, fontWeight: '400', lineHeight: 14 } as TextStyle,
} as const

// =============================================================================
// Shadow — keep subtle on iOS. See design-system Shadows section.
// =============================================================================
export const shadow = {
  none: {} as ViewStyle,
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  } as ViewStyle,
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 16,
  } as ViewStyle,
} as const
