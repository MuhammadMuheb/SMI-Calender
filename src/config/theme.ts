/**
 * Show Me Italy — Design Tokens
 * Single source of truth for the entire color palette and spacing.
 * Components consume these via Tailwind CSS custom properties.
 */

export const theme = {
  colors: {
    bg: '#000000',
    bgCard: '#0A0A0A',
    bgElevated: '#111111',
    primary: '#138A52',
    primaryLight: '#1AAE6A',
    primaryDark: '#0E6B3F',
    secondary: '#B30000',
    secondaryLight: '#D41A1A',
    white: '#F5F5F5',
    gray: '#BDBDBD',
    grayDark: '#666666',
    grayDarker: '#333333',
    border: '#1E1E1E',
    success: '#138A52',
    danger: '#B30000',
    warning: '#E6A800',
  },
} as const;

export type ThemeColors = typeof theme.colors;
