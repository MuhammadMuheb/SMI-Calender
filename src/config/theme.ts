/**
 * Show Me Italy — Design Tokens
 * Single source of truth for the entire color palette and spacing.
 *
 * Every value is a CSS custom property reference, not a literal hex string —
 * the actual dark/light values are defined in src/index.css against `:root`
 * and `:root[data-theme="light"]`. This lets the whole app (every component
 * already reads these via `theme.colors.X`) repaint instantly when the theme
 * toggle flips the `data-theme` attribute, with no React re-render needed.
 */

export const theme = {
  colors: {
    bg: 'var(--sm-bg)',
    bgCard: 'var(--sm-bg-card)',
    bgElevated: 'var(--sm-bg-elevated)',
    primary: 'var(--sm-primary)',
    primaryLight: 'var(--sm-primary-light)',
    primaryDark: 'var(--sm-primary-dark)',
    secondary: 'var(--sm-secondary)',
    secondaryLight: 'var(--sm-secondary-light)',
    white: 'var(--sm-white)',
    gray: 'var(--sm-gray)',
    grayDark: 'var(--sm-gray-dark)',
    grayDarker: 'var(--sm-gray-darker)',
    border: 'var(--sm-border)',
    success: 'var(--sm-success)',
    danger: 'var(--sm-danger)',
    warning: 'var(--sm-warning)',
  },
} as const;

export type ThemeColors = typeof theme.colors;
