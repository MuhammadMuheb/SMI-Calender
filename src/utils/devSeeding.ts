/** Test accounts must be created by a server-side emulator fixture. */
export async function seedTestUsers(): Promise<never> {
  throw new Error('Browser credential seeding is disabled. Use the Firebase emulator fixtures.');
}
