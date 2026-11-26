# Executive category

Executive is a job category, with staff access permissions. Its `jobRoles.leavePolicy = executive` setting applies to every assigned member, including when Executive is a secondary category.

- Monday–Friday working week; every Saturday and Sunday is automatically off. Weekends are displayed without creating leave records or deducting vacation.
- No additional monthly regular days off or automatic weekday assignments. Weekday absences use vacation or sick leave. Existing public holidays and company closure days still apply.
- At least one Executive must remain available Monday–Friday. WFH and Hybrid count as available. Planned leave is checked at submission and approval, including admin assignment; sickness follows existing staff rules.
- WFH and Hybrid are eligible through the existing approval workflow. Vacation uses the same staff accrual, carryover, and adjustment rules; vacation ranges exclude scheduled weekends.
- The category does not grant manager/admin permissions.

Run `node --env-file=.env scripts/migrate-executive.mjs` to review the data changes, then add `--apply`. The transaction creates Maria and Emmanuelle only if missing, preserves existing credentials and balances, assigns the category, adds five weekday coverage rules, and records a migration/audit marker. Repeats do nothing. Newly generated login PINs are saved only in ignored `.private-backups/executive-login.local.json`.

Deploy both Vercel and Firebase `functions:attendanceScheduler`, because the scheduler shares the category schedule resolver. No Firestore rule changes are required.
