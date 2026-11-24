# Work arrangements

Staff open **Work arrangements** from the navigation or dashboard. Managers review staff requests; only super admins decide manager requests. Super admins also manage **Policies & eligibility**, available from Admin tools. Requests never debit leave balances.

## Scheduling behavior

- On-site, WFH, remote and hybrid support single days, morning/afternoon, date ranges, weekly recurrence, temporary periods and permanent schedules. Finite periods are limited to one year; permanent schedules have no end date.
- Hybrid has a weekly baseline. Flexible hybrid uses **Dated change** requests to select different days for a particular week. The original pattern resumes afterward. The same mechanism handles exceptions and temporary changes without rewriting the original approval.
- Morning and afternoon use an explicit boundary within the working day. Overnight shifts are supported for full-day arrangements. Dates and working hours use IANA timezones, including DST.
- Approved leave (including sick leave), recurring public holidays, special days and the existing monthly Sunday off supersede work arrangements. Non-working weekdays are configurable; the initial seven-day week preserves the tour business's existing weekend operation.
- Overlapping pending/approved requests are rejected, including physical overlaps across timezones and overnight dates. Dated changes may overlap their approved parent, but not other changes. Pending requests reserve WFH allowance. Half days count as 0.5 days.
- Office minimums are checked against the whole week; approved absences reduce available working days. Mandatory office days and country restrictions apply on submission and approval. Permanent patterns are projected through existing schedule boundaries plus a full annual cycle for validation.
- Approved schedules are immutable. To modify them, submit or assign a dated change. Pending requests can be modified and then approved separately. Version checks reject stale decisions. Cancel/revoke takes effect immediately, preserves prior dates and closes any open attendance segment tied to that arrangement. Cancel dependent changes before closing their parent.

## Attendance and reporting

All check-in/out writes pass through `/api/attendance`. The server supplies timestamps, employee identity, mode, working date, timezone and expected shift times. It validates approved mode, optional working-hour enforcement and location policy. Office GPS uses the existing geofence and capped 100 m accuracy allowance. Off-site GPS is optional coordinate recording, not proof of country or address.

Switching to a newly effective mode closes the old attendance segment and opens another in one transaction. Duplicate check-ins are prevented with the same per-user lock used by arrangement mutations. Admin corrections remain available with reasons, overlap checks and audit entries. Existing history is retained; breaks are deducted once per working day across multiple segments.

The calendar shows distinct mode icons, hybrid markers in day details, employee/department/mode filters, and time-off precedence. Requests, reasons and personal locations remain separate from sanitized team schedules. Departments are optional employee policy metadata; an unset department appears as Unassigned. Daily tasks display the selected day's work arrangement without changing task ownership or completion behavior.

The arrangement attendance report compares scheduled and recorded modes, closed hours, late arrivals, missed check-ins and automatically closed sessions, with CSV export. Historical approved arrangements and recorded attendance retain their own timezone; historical fallback schedules use current policy/role defaults.

The existing 30-minute Firebase attendance scheduler handles missing check-ins, tomorrow's arrangement reminders, late arrivals and checkout recovery. Notifications are deduplicated, written transactionally in-app, and queued for push. Push retries are bounded; browsers must have a valid subscription and granted permission. Firebase delegates push delivery to Vercel, where existing VAPID keys remain stored. A dedicated `WORK_PUSH_SECRET` permits only the push relay operation, not general attendance jobs.

## Storage and access

| Collection | Purpose | Browser access |
| --- | --- | --- |
| `work_arrangements` | Requests and approval state | Own records; staff records for managers; all for admins. Writes denied. |
| `work_calendar` | Sanitized schedule projection | Active members read; writes denied. |
| `work_arrangement_history` | Immutable before/after decisions | Authorized history API only. |
| `work_policies/global` | Versioned global defaults and employee overrides | API only; admin writes. |
| `work_locks` | Per-employee concurrency control | Server only. |
| `schema_migrations/20261124_work_arrangements` | Idempotent migration marker | Server only. |

Existing notifications and audit collections are reused. The APIs verify Firebase sessions and read the current active user role; submitted identity/role/status fields cannot confer access. Policy changes are audited and use compare-and-set versions. Existing approvals are not silently rewritten by new policy limits; attendance location validation uses the current policy.

## Deployment

1. Run the checks below and build a Vercel production candidate with `--skip-domain`.
2. Configure `WORK_PUSH_SECRET` in Vercel production and the same secret in Firebase Functions environment; set Functions `WORK_PUSH_URL=https://smi-calender.vercel.app/api/attendance-cron?action=push`. Never commit these values.
3. Run `npm run migrate:work` to preview, then `npm run migrate:work -- --apply`. The migration adds a default approval-required policy and migration/audit markers only. It does not convert historical ad-hoc WFH into permanent approvals or modify existing attendance/leave.
4. Deploy `functions:attendanceScheduler`, then the Firestore rules, then promote the Vercel candidate. Rules require current clients to use the API for check-ins, so coordinate rules and promotion closely. Older open clients should reload.
5. Verify the live authenticated list/status APIs, frontend assets, rules and scheduler revision. Preserve archived work records and migration markers if rolling back; do not restore direct browser attendance writes.

The scheduler uses Node 22: Node 20 reached its Cloud Functions decommission date in October 2026 ([Google runtime schedule](https://docs.cloud.google.com/functions/docs/runtime-support)). Other retired Functions are not part of this release.

## Verification

```powershell
npm test
npm run test:rules
npm run lint -- --max-warnings 0
npm run build
npm --prefix functions run build
```

Rules tests require Java 21. They use a `demo-` project and explicitly refuse production connections. Work tests cover concurrency, authorization, stale decisions, recurrence/overlap, holidays/leave, remote countries, quotas, DST, overnight shifts, half-day switching, revocation, geofences and reminder deduplication.

For browser verification, install Playwright with `npm install --prefix .qa.local playwright`. Start Auth and Firestore emulators for `demo-smi-calendar`. Start Vite with `FIREBASE_PROJECT_ID` and `VITE_FIREBASE_PROJECT_ID` set to `demo-smi-calendar`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and `VITE_USE_EMULATORS=true`. Run Vite on port 5178, then run `node scripts/verify-work-browser.mjs` with the same server environment. This script clears only the demo emulator and verifies staff/manager/admin flows at 390, 768 and 1440 px using installed Edge.

Physical-device GPS accuracy, permission prompts, keyboard/safe-area behavior and actual device push delivery require hardware verification; desktop viewport tests cannot establish those outcomes.
