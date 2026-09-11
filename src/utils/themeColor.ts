/**
 * Blends a theme color token (a `var(--sm-*)` reference) with transparency,
 * replacing the old `hexColor + 'NN'` (RRGGBBAA) convention now that theme
 * tokens resolve through CSS variables instead of being literal hex strings.
 *
 * `hexAlpha` is the same two-digit hex alpha suffix used before (e.g. '20',
 * '40'), so every call site only needed `alpha(x, 'NN')` in place of
 * `x + 'NN'` — the resulting opacity is identical.
 */
export function alpha(cssVarColor: string, hexAlpha: string): string {
  const pct = (parseInt(hexAlpha, 16) / 255) * 100;
  return `color-mix(in srgb, ${cssVarColor} ${pct}%, transparent)`;
}
