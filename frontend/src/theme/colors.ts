export const colors = {
  primary: {
    50: '#FEF2F2',
    100: '#FDE3E3',
    200: '#FBC8C8',
    300: '#F7A0A0',
    400: '#EF5350',
    500: '#C0110E',
    600: '#A30E0C',
    700: '#860B09',
    800: '#6B0908',
    900: '#4A0605',
  },
  accent: {
    50: '#FFFDF0',
    100: '#FFF9D6',
    200: '#FFF0A3',
    300: '#F5D44A',
    400: '#E6C32E',
    500: '#D4AF1A',
  },
  dark: '#0B0909',
  surface: '#FFFFFF',
  muted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
} as const

// Recharts color tokens
export const chartColors = {
  primary: colors.primary[500],
  secondary: colors.accent[300],
  grid: colors.border,
  text: colors.muted,
} as const
