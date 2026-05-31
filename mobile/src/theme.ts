// File: mobile/src/theme.ts
export const colors = {
  primary: '#1B5E3B',
  primaryLight: '#2E7D4F',
  accent: '#E8A020',
  accentLight: '#FFF8EE',
  bg: '#F7F5F0',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  verified: '#1565C0',
  danger: '#C0392B',
  success: '#2E7D4F',
};

export const typography = {
  display: { fontSize: 36, fontWeight: '700' as const, fontFamily: 'PlusJakartaSans-Bold' },
  heading: { fontSize: 22, fontWeight: '600' as const, fontFamily: 'PlusJakartaSans-SemiBold' },
  subheading: { fontSize: 16, fontWeight: '600' as const, fontFamily: 'PlusJakartaSans-SemiBold' },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 24,
    fontFamily: 'PlusJakartaSans-Regular',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
    fontFamily: 'PlusJakartaSans-Medium',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};
