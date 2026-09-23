# Security and workflow fixes

Production rollout completed on September 23, 2026. Protected Firestore rules, retired legacy Functions, the attendance scheduler, credential migration and the Vercel deployment are live at https://smi-calender.vercel.app.

## Production rollout record

- Configured Firebase server credentials in Vercel and verified production API connectivity.
- Deployed the eight retired callable handlers and a HTTP 410 response for the legacy `migrateData` endpoint. Deleted `dailyReminderScheduler`; enabled `attendanceScheduler` every 30 minutes in Europe/Rome.
- Backed up the prior rules and deployed the protected rules before migrating data.
- Atomically merged 14 user documents into 12 canonical users, stored 12 private credential records, removed public PIN fields and updated 135 related documents. The follow-up dry-run reports zero related documents to update and one record per username.
- Nabeel's duplicate records contained conflicting PINs. Restored the administrator credential specified by the owner, backed up the previous credential and recorded the correction in the audit log. Cleared the administrator's failed-login lockout from attempts before migration.
- Corrected the mismatched VAPID public key using the existing private key, and configured the matching `VITE_VAPID_PUBLIC_KEY` in Preview and Production. Private keys were not rotated. Push readiness now verifies the key pair; the browser replaces subscriptions made with an older key when enabling push.
- Promoted the verified preview to production. Production API checks passed for admin/staff login and Firebase token exchange, protected profile reads, denied public credential reads, role changes, sick/planned leave, swap acceptance, shift confirmation and audited attendance correction.
- Operational verification used temporary accounts and records, which were removed afterward. Audit entries were retained. Backups and verification artifacts remain ignored locally; credentials were not committed.
- Fresh Chrome sessions signed in successfully as both administrator and staff, rendered their dashboards and reported no uncaught JavaScript errors. The enabled Cloud Scheduler job was triggered once and its completed attempt reported no error.

Actual device notification delivery still requires testing on a browser/device with notification permission. Translation coverage still includes English fallbacks for untranslated copy.

## Implemented

| Issue | Change |
| --- | --- |
| 1–2 | Server verifies PINs, rate-limits login and issues Firebase custom tokens. PIN hashes live in a server-only collection. Anonymous access is denied. Current protected profiles determine permissions; browser-stored roles are ignored. User provisioning and PIN changes run on the server. |
| 3 | Migration merges username/UID duplicates, preserves canonical IDs and rewrites legacy references. |
| 4 | Migration reduces the existing Guide minimum from two to one only when exactly one active Guide is assigned. |
| 5 | Sick leave bypasses staffing checks. Planned leave uses configured hard-block rules, including server-side enforcement. No role alone is not a reason to block a request. |
| 6 | Live Firestore swap proposals and server transactions. Acceptance transfers the approved day off to the recipient, cancels the original and prevents repeated acceptance. A proposal screen is included. |
| 7 | Removed automatic production restores of roles, assignments and schedules. Browser credential seeding is disabled. |
| 8 | Scheduled attendance job saves automatic checkout, sends deduplicated in-app late/checkout alerts and daily absence summaries. Manual missing-checkout repairs persist. |
| 9 | Administrator attendance corrections with reason/audit trail; live shift-response board; location creation/editing including coordinates, radius, roles and active status. |
| 10 | Push API initializes Firebase from server environment variables or a JSON environment value. Firebase Admin and web-push are runtime dependencies. Calls require authenticated authorization. Readiness validates the VAPID pair and exposes only its public key. |
| 11 | Live changes trigger refreshes of users, roles, assignments, staffing rules, settings and calendar reference data. |
| 12 | Role/rule/settings failures propagate; those screens update only after successful writes. Deleting roles also removes their assignments and rules. |
| 13 | Existing assignments can become primary; the prior primary is demoted atomically. |
| 14 | English/Italian language selector and translation lookup are connected to navigation, headings, metrics and common form labels. Untranslated wording still falls back to English. |
| 15 | Super-admin leave override screen with a required reason and server authorization. |
| 16 | User deletion clears both current and older snake_case task assignments and propagates cleanup failures. Self-deletion is rejected before cleanup. |
| 17 | Calendar attendance counts use live check-in documents and unique people instead of zero placeholders. |
| 18 | Server decisions use the real requester/type/date in audit entries; migration repairs the malformed historical rejection when source data exists. |
| 19 | Pages and SDKs are split into separate chunks. The app entry is approximately 54 KB; the largest SDK chunk is below 500 KB. |
| 20 | Manifest references existing PNG/SVG icons. |
| 21 | Local Firebase placeholders have been filled from the project's configuration; server credentials remain outside Git and browser bundles. Production/Preview VAPID configuration is verified; local push delivery still requires local VAPID configuration. |
| 22 | Removed explicit-any warnings from the flagged database adapters/validation utilities. Fast-refresh exemptions name intentional mixed component/helper exports. Lint runs with zero warnings. |

## Attendance policy

The scheduler runs every 30 minutes in Europe/Rome and respects daylight saving and overnight shifts. It uses the primary role's shift, otherwise the first assigned role, otherwise 09:00–18:00. A late arrival is more than 15 minutes after shift start. Checkout reminders start at shift end. Two hours after shift end, an open record is closed at the scheduled end (never before arrival). Corrections require an administrator and a reason.

The scheduled Firebase function runs independently of an open browser. The authenticated manager monitor can also trigger the same idempotent operation. The protected Vercel endpoint can be used by an external scheduler with CRON_SECRET; Vercel's own frequent cron is not required.

## Verification

- Production frontend build and Functions TypeScript build.
- ESLint with zero warnings.
- Thirteen server regression tests: credentials, login limits, authorization, staffing/sick leave, swaps, attendance, Rome/DST handling and push key validation.
- Nine Firestore emulator permission tests and one emulator migration test, including dry-run, canonical references, credential preservation, backups and repeated application.
- Local HTTP checks: application loads, Firebase initializes using the supplied environment, and unauthenticated mutations return 401.
- Production migration applied with a local backup; follow-up dry-run is clean. Live workflow checks and fixture cleanup are recorded above.

Commands:

```powershell
npm ci
npm run build
npm run lint -- --max-warnings 0
npm test
npm run test:rules
npm --prefix functions ci
npm --prefix functions run build
npm run migrate:security
```

The Firestore emulator requires Java 21 on PATH. On this workstation it is installed at C:\Program Files\Java\jdk-21.

## Coordinated production rollout

Do not apply only the frontend or only the migration. The old browser login reads public PINs, so the switch requires a brief maintenance window.

1. Configure the Vercel project with FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (escaped newlines supported), or FIREBASE_SERVICE_ACCOUNT containing the complete JSON object. Configure matching VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and build-time VITE_VAPID_PUBLIC_KEY for push delivery. No private value may use a VITE_ prefix.
2. Build a preview with the new API and frontend. Prepare a Firebase CLI login authorized to deploy Rules and Functions.
3. During the maintenance window, deploy Functions to disable legacy callables and the legacy migrateData HTTP endpoint, and activate attendanceScheduler. Remove the old dailyReminderScheduler if deployment reports it as obsolete; its behavior is covered by the new job. On slower development machines, set FUNCTIONS_DISCOVERY_TIMEOUT=60 if Firebase's default source-discovery timeout is exceeded.
4. Deploy firestore.rules before migrating, so anonymous clients cannot change profiles or read newly migrated data.
5. Run `npm run migrate:security -- --apply`. It saves an ignored local backup, checks that source documents have not changed, and commits the migration atomically. It aborts if the operation would exceed its safe transaction size. Run the dry-run again afterward.
6. Promote the prepared Vercel deployment. Verify a staff login, an administrator login, a role change, sick leave, planned leave, swap acceptance, shift response and attendance correction. Existing browser sessions must sign in again.

The workspace is now linked to the Vercel project. The owner authenticated Firebase CLI for Functions deployment; the supplied service account has Firestore and Rules access. The original missing production environment/migration blockers have been resolved. Vercel environment changes require a new deployment to take effect. Sensitive Vercel variables may be blank when downloaded with `vercel env pull`; use the deployed readiness endpoint to check push configuration instead of treating those blanks as missing production values.

Keep .private-backups out of deployments. It contains the original private database data. Do not restore its plaintext user records into a publicly readable collection.

References: [Firebase custom authentication](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [Firestore emulator rules testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [Vercel environment variables](https://vercel.com/docs/environment-variables).
