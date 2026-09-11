/**
 * Supabase Auth requires passwords of 6+ characters; staff PINs are 4-6
 * digits. This deterministically expands a PIN into a valid Auth password
 * without changing what the user types or sees — they still only ever enter
 * their plain PIN.
 *
 * Used by both the client (login, PIN change) and the one-time/ongoing user
 * migration script (scripts/migrate-users-to-auth.mjs) — keep them in sync
 * if this ever changes.
 */
export function toAuthPassword(pin: string): string {
  return `smi_pin_${pin}`;
}
