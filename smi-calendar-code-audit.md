# SMI Calendar — Technical Code Review & Audit

**Scope:** Full source tree (React 18 + TypeScript + Vite PWA, Supabase backend, Vercel serverless push function) — 126 files reviewed, including all contexts, services, pages, components, models, SQL schema/seed files, and supporting scripts.

**Bottom line up front:** The application's UI and business-logic layer is fairly complete and thoughtfully structured (contexts per domain, services separated from components, a real auto-assignment algorithm, i18n scaffolding, PWA/push infrastructure). But there is **no real backend security** behind any of it — every Supabase table is wide open to anyone with the public anon key, "login" is a client-side lookup with no real session, and a file containing real staff names with a shared plaintext PIN (`0000`) is committed to the repository. These need to be treated as an active incident, not a backlog item, if this has ever been deployed with real data. Below that, there are several concrete state-management and business-logic bugs that will cause data loss, incorrect balances, and confusing UI behavior even once the security issues are fixed.

---

## 1. Critical security issues (fix before anything else)

These were verified by reading `supabase-schema.sql`, `supabase-real-data.sql`, `src/lib/supabase.ts`, `src/context/AuthContext.tsx`, `src/services/supabaseService.ts`, `src/components/guards/RoleGuard.tsx`, and `api/send-push.js`.

### 1.1 Every database table allows full anonymous read/write
`supabase-schema.sql` and `supabase-notifications-migration.sql` enable Row Level Security on every table, then immediately add:
```sql
CREATE POLICY "Allow all for anon" ON <table> FOR ALL USING (true) WITH CHECK (true);
```
on `users`, `leave_requests`, `audit_log`, `notifications`, `job_roles`, `staffing_rules`, `holidays`, `special_days`, `notification_settings`, and `day_swaps`. Since the browser only ever holds the public anon key (`src/lib/supabase.ts`), this policy is equivalent to no RLS at all. Anyone with that key — which ships in the client bundle by design — can open devtools and run, with no login:

```js
await supabase.from('users').select('*')                                   // dumps every username + PIN + role
await supabase.from('users').update({ role: 'super_admin' }).eq('id', 'usr_x')  // privilege escalation
await supabase.from('audit_log').delete().neq('id', '')                    // wipe the audit trail
```

`RoleGuard.tsx` is honestly labeled in its own comments as a UI-only guard with no server-side backing — that comment is accurate, and the consequence is that role-based access control does not exist at the data layer at all.

**Fix:** Replace every `USING (true) WITH CHECK (true)` policy with policies scoped to an authenticated identity. This requires moving off client-side-only "auth" first (see 1.3) — RLS can't scope to a role Postgres has no way to verify.

### 1.2 Real staff credentials, including the super-admin PIN, are committed to the repo
`supabase-real-data.sql` is explicitly the production cutover script and inserts the real staff roster with real first names and PIN `'0000'` for every account, including the super-admin user. The same data (real names, PIN `0000`) is duplicated in `supabase-schema.sql`'s seed block and again in `src/data/seed.ts` (labeled "Real staff list — used for login dropdown only," though this particular file is dead code — see 4.6). Combined with 1.1, anyone with repo access or the anon key can read every real PIN directly, or simply log in as the super-admin using `0000` straight from the file.

**Fix (do this regardless of anything else in this report):**
- Rotate every real user's PIN now.
- Remove `supabase-real-data.sql` and the seed block in `supabase-schema.sql` from the repository and from git history (a `git filter-repo`/BFG pass, not just a new commit).
- Stop storing PINs as plaintext under a misleading `pin_hash` column name — `authenticateUser` in `supabaseService.ts` does a literal `.eq('pin_hash', pin)` equality check, not a hash comparison. Hash PINs server-side (bcrypt/argon2) before this goes anywhere near real users again.

### 1.3 "Login" is a client-side query with a forgeable session
Authentication is: query the `users` table from the browser for a row matching username + plaintext PIN + `is_active`; if found, store the row as JSON in `localStorage` under `smi_session` (`AuthContext.tsx`). There is no Supabase Auth session, no server-issued token, nothing tying that `localStorage` blob to a verified credential. Because the object is trusted blindly and the `users` table is world-readable/writable (1.1), a user can skip login entirely:
```js
localStorage.setItem('smi_session', JSON.stringify({ id: 'usr_x', role: 'super_admin', ... }));
location.reload();
```
This grants full super-admin UI access with zero credentials, since `RoleGuard` only checks `user.role` from this forgeable object.

**Fix:** This needs real backend authentication — Supabase Auth (or a server endpoint issuing a signed/verifiable session token) — before any client-side role check means anything. This is the prerequisite for 1.1 as well.

### 1.4 Push endpoint is unauthenticated and can message any user
`api/send-push.js` accepts `{ userId, title, body, tag }` directly from the request body with wildcard CORS, no auth check, and no rate limiting. Anyone who finds the endpoint (visible in the client bundle) can push arbitrary notifications to any known user indefinitely:
```
curl -X POST https://<deploy>/api/send-push -d '{"userId":"usr_x","title":"anything","body":"anything"}'
```
**Fix:** Require a server-verified auth token (not a client-supplied `userId`) and restrict who can notify whom, checked server-side.

### 1.5 Smaller gaps worth closing while you're in there
- `.gitignore` never excludes `.env*` — no leak found today (VAPID keys are read from `process.env` correctly, not hardcoded), but the guard rail is missing before the first local `.env` file is ever created.
- Input validation (`src/models/validation.ts`) is real but optional — `supabaseService.ts`'s insert/update functions perform no validation of their own, so anything that writes through them directly (or through the open anon key, per 1.1) bypasses it entirely. The admin "add user" PIN field also doesn't call the shared `isValidPin`, so a non-numeric or over-length PIN can be created that login's own digit-stripping can never match.
- `audit_log` writes (`insertAuditLog`) are real and wired into user/role changes, but inherit the "allow all" policy, so entries can be forged or deleted — it isn't currently tamper-evident. There's also a second, unused in-memory audit implementation (`src/services/auditService.ts`, explicitly marked `PLACEHOLDER`) that should be deleted to avoid confusion.
- `src/config/demoUsers.ts` and `src/data/seed.ts` are dead code (nothing imports `authenticateDemoUser`) that still ship real employee names in the client bundle — delete them or replace with genuinely fake names.

**What's already fine, for the record:** no SQL-injection surface (everything goes through the Supabase query builder), no `dangerouslySetInnerHTML`/raw `innerHTML` anywhere, the service worker doesn't cache anything sensitive, and the VAPID private key is correctly kept server-side.

---

## 2. What's working vs. what's broken or incomplete

### Working
- Core calendar/leave-request flow (submit → pending → approve/decline) is implemented end-to-end and persists to Supabase.
- The auto-assignment algorithm exists and runs a real round-robin with staffing-rule checks, not a stub.
- PWA install prompt, service worker, and web push subscription flow are functionally wired up.
- Geolocation distance/radius math (Haversine) and permission-denied handling are correct.
- Vacation/regular-day overrides set by admins in `VacationAdjustment.tsx` do genuinely feed into balance calculations (this contradicts `RELEASE_CHECKLIST.md`'s own "Known Issue #4," which appears to be stale documentation — worth removing that line).

### Broken or incomplete
- **Job-role assignment/removal never persists.** `assignRole`/`removeRoleAssignment` in `AppDataContext.tsx` only update local React state — there is no corresponding insert/delete against the `staff_role_assignments` table anywhere in the codebase. Every assignment made in `UserManagement.tsx` is silently discarded on the next data refresh, and "removed" assignments reappear.
- **The entire day-swap feature is in-memory only.** `SwapContext.tsx` is explicitly labeled `IN-MEMORY STORE (MOCK)` — no table, no persistence. A refresh or tab close during a pending swap erases it, and even an "accepted" swap never actually changes anyone's schedule in `leave_requests`.
- **Auto-Sunday/auto-assigned leave types are never produced.** `autoAssignService.ts` always writes `leaveType: 'regular_day_off'`, even though `'auto_sunday'`/`'auto_assigned'` exist in the type system and `balanceService.ts` checks for them. The result: the documented "First Sunday of this month is auto-assigned off" dashboard banner never appears, and `balance-test-cases.md`'s Test 2 (`autoSundayConsumed: true`) can never pass.
- **The i18n system is entirely dead code.** `LanguageContext.tsx`/`translations.ts` have complete English/Italian dictionaries and a working `t()` translator, but no component in the app calls `useLang()` — every page hardcodes English, and Settings has no language toggle despite translation keys existing for one.
- **Reminder/notification helpers are unused.** `src/utils/shiftReminder.ts`'s four exports are never imported anywhere, and it queries a column (`users.push_subscription`) that doesn't exist in the real schema (the real table is `push_subscriptions`) — confirming it was never actually exercised. This matches the release checklist's own "Known Issue #6: No automated daily reminder timer."
- **Schema/code mismatch:** the app reads and writes `users.job_role`, `vacation_override`, `vacation_override_at`, `regular_override`, and `push_subscription`, none of which are defined by any shipped SQL file. Running `supabase-schema.sql` exactly as instructed produces a database where the admin vacation-adjustment screen and login itself hit "column does not exist," and every user silently falls back to the "Office" job role for break-time payroll calculations.

---

## 3. Bugs, state-management issues, and layout flaws

### 3.1 In-place array mutation of shared context state (sorting "jumps")
`src/pages/TaskBoard.tsx`:
```js
const filtered = useMemo(() => {
  let t = tasks;                                  // same reference as TaskContext's state array
  if (viewMode === 'my') t = t.filter(...);        // only reassigns in "my" mode
  return t.sort((a, b) => { ... });                // sorts the ORIGINAL array in "team" mode
}, [tasks, viewMode, user.id]);
```
When `viewMode === 'team'`, `t` is the literal `tasks` array from `TaskContext`, and `.sort()` mutates it in place, bypassing `setTasks`. This silently reorders shared state outside React's update cycle — other components reading the same context can see inconsistent ordering, and this is exactly the kind of bug that produces visible list "jumping" for reasons unrelated to any real data change.
**Fix:** `let t = viewMode === 'my' ? tasks.filter(...) : [...tasks];` — never sort the array a `useState`/context owns.

### 3.2 Optimistic writes with no rollback or error surfacing
Across `AppDataContext.tsx` (`addUser`, `updateUser`, `deleteUser`, `addJobRole`, staffing rules, special days) and `TaskContext.tsx` (`moveTask`, `completeTask`, etc.), the pattern is: update local state immediately, then fire the Supabase write, whose failure path is only `console.error` — never surfaced to the UI, never rolled back. A user can keep working against local state that silently never made it to the database, and only discover this on the next reload when the change has vanished with no explanation. `loadData()`'s own top-level `catch` in `AppDataContext` has the same problem — there's no `error` field in the context for any screen to check, so a failed fetch just renders as "no data" with no retry affordance.
**Fix:** Make the Supabase write functions return `{ ok, error }`, only commit the optimistic state update (or roll it back) based on that result, and add a visible error/retry path.

### 3.3 Double-submit race on leave requests
`LeaveContext.submitRequest` closes over a `requests` snapshot from the render that created it, and `RequestFormModal`'s submit button has no `isSubmitting` guard against a second click while the first submission is in flight. A quick double-tap (common on mobile) can pass the "duplicate date" and balance checks twice before either write completes, inserting two rows for the same user/date.
**Fix:** Add a submitting-ref guard in the modal, and — since client-side checks can never fully close this race — add a partial unique index in Postgres on `(user_id, date) WHERE status != 'cancelled'`.

### 3.4 Stale modal state on reopen
Two related bugs from misusing `useState`'s lazy initializer as a mount-only "on open" hook:
- `TomorrowDutyModal.tsx` computes its staff selection and default shift times once, at first mount, not each time it opens — if a day-off request is approved/cancelled after the modal's first mount, reopening it shows stale selections, and the "sent" flag is never reset, so the Notify button is permanently disabled after first use.
- `CreateTaskModal.tsx`'s date field is only re-synced to the current selected date on close (`resetForm`), not on open — navigating to a different day and immediately opening "New Task" can silently create a task for the wrong date.
**Fix:** Replace the stray `useState(initializer)` pattern with `useEffect(() => { if (open) { /* recompute */ } }, [open, ...])` in both cases.

### 3.5 Fragile ID-recovery timeout
`UserManagement.tsx` creates a user via a `void` `addUser` that doesn't return the new row's id, then re-queries Supabase by username after a hardcoded 500ms `setTimeout` to discover the id so it can assign job roles. On a slow connection this window is easily missed, silently leaving a newly created user with no role assignments and no error shown.
**Fix:** Have `addUser` return the created id directly and await it, removing the timeout guess (this also becomes moot once 3.2/the missing role-assignment persistence in §2 is fixed).

### 3.6 Effect-ordering race between Auth and Notification contexts
`NotificationContext` reads `smi_session` from `localStorage` directly in its own mount effect (to avoid a circular dependency on `AuthContext`) rather than receiving the user id as a prop. On a brand-new login, React can fire this effect before `AuthContext`'s effect has written the session, permanently leaving the notification context's user id `null` for that session and silently skipping push subscription with no retry.
**Fix:** Pass `userId` into `NotificationProvider` as a prop, the same way `LanguageProvider` already does.

### 3.7 Unstable geolocation dependency causes repeated GPS re-subscription
Every dashboard passes `user.jobRole ?? ['Office']` into `useGeolocation`, creating a new array literal on every render whenever `jobRole` is falsy (the common case). Because this array flows into `useCallback`/`useEffect` dependencies inside the hook, any unrelated re-render (a notification arriving, a modal closing) tears down and restarts the GPS watch, visibly re-flashing "Detecting your location..." and burning battery.
**Fix:** Memoize the array at the call site (`useMemo(() => user.jobRole ?? ['Office'], [user.jobRole])`).

### 3.8 Timezone inconsistency between two admin views of the same data
`CheckInBoard.tsx` filters check-ins using explicit UTC day boundaries (`${date}T00:00:00+00:00`), while `AttendanceSummary.tsx` correctly buckets by local calendar day. For a business operating in Italy (CET/CEST), a check-in shortly after local midnight can be attributed to different calendar days on these two screens, and the project's own `dateUtils.ts` explicitly documents avoiding this exact UTC pitfall elsewhere.
**Fix:** Build `CheckInBoard`'s day boundaries from local midnight, matching the convention already used in `AttendanceSummary.tsx`.

### 3.9 `window.location.reload()` used as a refresh mechanism
`VacationAdjustment.tsx` forces a full page reload 1.5s after a successful save instead of refreshing the relevant context data — a strong signal that other parts of `AppDataContext` aren't kept in sync with direct writes, and a jarring UX (loses navigation position, in-progress state elsewhere in the app).
**Fix:** Trigger the existing context refetch instead of reloading the page.

### 3.10 Accessibility gaps affecting every modal and form in the app
The shared `Modal.tsx` primitive (used by every modal in the app) has no focus trap, no Escape-to-close, and no dialog ARIA attributes. The shared `FormInput.tsx` primitive renders `<label>` and `<input>` as unassociated siblings (no `htmlFor`/`id`), so screen readers won't announce labels and clicking a label doesn't focus its input. Because these are shared primitives, fixing them once fixes every consumer.

### 3.11 Minor/lower-severity items
- `Notification.requestPermission()` is called directly in a component's render body (`NotificationPanel.tsx`) rather than in a `useEffect`, which is unpredictable under React 18 Strict Mode.
- Calendar staffing-level indicators are color-only (green/amber/red bar with no text/icon), a problem for color-vision-deficient users.
- Duplicate, identical warning strings can accumulate in the auto-assignment preview when a day can't be placed across multiple rounds — should be deduplicated by `(user, day)` before display.

---

## 4. Architecture, best practices, and business-logic correctness

### 4.1 Three incompatible definitions of "the current cycle" are wired into different screens
`cycleScheduler.ts` (fixed 28-day blocks from a Jan 2026 epoch), `cycleUtils.ts` (calendar-month-anchored, variable 4/5-week length), and `AutoAssignment.tsx`'s admin screen (plain calendar month) each define cycle boundaries differently. `CycleManager.tsx` drives automatic notifications and auto-assignment using `cycleScheduler`'s windows, while the actual balance check on submission (`LeaveContext`) uses `cycleUtils`'s windows. For most dates these ranges disagree, so automatic notifications and auto-assigned days can land in a period that has nothing to do with the cycle the user's quota was actually computed against.
**Fix:** Pick one definition (the calendar-month-anchored `cycleUtils.ts` is the more developed one — it already threads through the balance/UI layer) and delete the other two.

### 4.2 The 5-week/7-day rule is computed and then thrown away
`cycleUtils.generateCycles()` correctly computes a per-cycle `quota` (6 days for a 4-week cycle, 7 for a 5-week cycle), but `LeaveContext.getCycleForDate` only extracts `{start, end}` and discards `quota`; `computeBalance` and the auto-assign engine both hard-code `6` regardless of cycle length. In any 5-week cycle, staff are under-allowed a day the system's own logic says they should get.
**Fix:** Thread `cycle.quota` through to `computeBalance` and `autoAssignService.quotaFor` instead of the hardcoded constant.

### 4.3 No server-side enforcement of any business rule
Balance checks and staffing "hard block" checks are computed only in the client, against a possibly-stale in-memory snapshot, and `approve()` performs no balance or staffing check at all — the only gate is a disabled attribute on a button in `RequestDetailModal.tsx`. Two managers approving concurrently, or any client bypassing the UI, can produce staffing violations or over-allocated balances with nothing in the database to stop it. This is the same root cause as the RLS issue in §1.1: there is currently no trust boundary between "what the UI shows" and "what the database allows."
**Fix:** Enforce balance/staffing rules in a Postgres trigger or function that runs inside the same transaction as an approval, not just in the client.

### 4.4 Auto-assignment "first Sunday" placement only considers one calendar month
`autoAssignService.getFirstSunday` derives year/month solely from the cycle's start date and checks only that month's first Sunday — correct only when a cycle is fully contained in one calendar month, which is essentially never true for `cycleScheduler`'s 28-day windows (once §4.1 is fixed to use calendar-month-anchored cycles, this issue becomes largely moot, but is worth knowing about in the interim).

### 4.5 A rebalance-on-approval routine identifies "system-assigned" days by matching the substring "Auto" in free-text notes
`LeaveContext.approve()` cancels a user's excess approved days once they cross a hardcoded threshold, choosing which day to cancel by checking whether `staffNote`/`approverNote` contains the substring `"Auto"` — not by checking `leaveType`. A staff member who happens to write a note like "Auto insurance renewal appointment" on a manual request risks having that request silently auto-cancelled. This, plus the missing `auto_sunday`/`auto_assigned` tagging in §2, means the whole auto-vs-manual distinction in the codebase currently rests on string matching text a user typed, rather than a structured field.
**Fix:** Once `leaveType` is correctly tagged (see §2), match on that field instead of note text, and compute the threshold from real cycle boundaries and per-user overrides rather than a hardcoded constant against a plain calendar month.

### 4.6 Dead code and duplicated implementations that should be removed
- `src/config/demoUsers.ts` / `src/data/seed.ts` — unused, and still expose real names (see §1.5).
- `src/services/auditService.ts` — an unused, explicitly-`PLACEHOLDER` in-memory audit log that duplicates the real, Supabase-backed `insertAuditLog`.
- `src/utils/shiftReminder.ts` and `cycleScheduler.checkCycleActions` — fully implemented but never invoked from anywhere in the app.
- `apply_spectator.sh` — a 1,440-line, 60KB one-off patch script (heredocs that overwrite ~10 source files to add a "spectator" role) committed at the repo root. Read in full — it contains no secrets or network calls, but it's a generated-patch artifact that should be archived or deleted now that the feature has presumably landed, rather than left in the working tree where it reads like a build script.

### 4.7 Minor data-modeling/performance notes
- `cycleScheduler.getCycleInfo` computes day offsets via raw millisecond division (`Math.floor(diffMs / 86400000)`), which drifts by a day around DST transitions in Italy, and uses JS's negative-remainder `%` for `dayInCycle`, which can produce a negative result instead of wrapping — `cycleUtils.ts` avoids this by doing date-field arithmetic instead, and is the pattern to standardize on.
- `AttendanceMonitor`'s late/checkout alert polling runs per logged-in manager session with no server-side dedupe, so push volume scales linearly with how many admins/managers happen to be logged in simultaneously rather than being sent once.
- The auto-assignment round-robin is bounded (capped at `MAX_ROUNDS = 10`, not an infinite loop) but re-scans a flat array on every candidate check; fine at current staff counts, worth indexing by `(user, date)` if the roster grows materially.

---

## 5. Recommended priority order

1. **Immediately:** rotate all real user PINs; remove `supabase-real-data.sql` and seeded credentials from the repo and git history; treat any prior deployment as compromised.
2. **Before any further real-data use:** implement real authentication (Supabase Auth or a signed server session) and replace every `USING (true) WITH CHECK (true)` RLS policy with policies scoped to the authenticated identity; add server-side auth to `api/send-push.js`.
3. **Next:** fix the two silent-data-loss bugs (job-role assignment never persists; day-swap feature is memory-only), and add error surfacing to the optimistic-update pattern in `AppDataContext`/`TaskContext` so failed writes are visible instead of silently vanishing on reload.
4. **Then:** consolidate the three cycle definitions into one, restore the 5-week/7-day quota rule, and tag auto-assigned days with their real `leaveType` instead of matching on note text.
5. **Ongoing:** the modal-state, geolocation-dependency, timezone, and accessibility fixes in §3 are all small, isolated changes safe to make incrementally alongside the above.
