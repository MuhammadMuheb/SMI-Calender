/** Marker appended to move requests so the original day off can be traced. */
const MOVE_FROM_TOKEN = /\s*\|\s*move_from:\S+/g;

/**
 * Staff note ready for display: drops internal markers (`| move_from:<id>`) and
 * the legacy emoji prefix older move requests were saved with.
 */
export function displayStaffNote(note: string | null | undefined): string {
  if (!note) return '';
  return note
    .replace(MOVE_FROM_TOKEN, '')
    .replace(/^📋\s*MOVE REQUEST:\s*/u, 'Move request: ')
    .trim();
}
