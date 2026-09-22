export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
