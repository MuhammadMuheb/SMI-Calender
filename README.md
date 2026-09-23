# Show Me Italy — Staff Calendar

A mobile-first PWA for Show Me Italy / Premium Tours staff: day-off and vacation requests, the team calendar, check-ins, daily tasks, and an admin console.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run lint
```

Firebase web config falls back to the `smi-calender` project defaults. Copy `.env.example` to `.env.local` and configure the server-only Firebase credentials for local PIN login. Untouched `your_…` frontend placeholders are ignored. Production credentials belong in Vercel environment variables; never prefix private credentials with `VITE_`.

## Tech stack

- React 19, TypeScript, Vite
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Radix, lucide icons, Geist) — see [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- Firebase Firestore with protected rules and live listeners; server-verified PIN login using private credential records and Firebase Auth custom tokens
- Web push via `api/send-push.js` (Vercel serverless function)

## Project structure

```
src/
├── app/                 App root, providers, AppDataContext (shared reference data)
├── components/
│   ├── ui/              shadcn/ui primitives (generated — edit sparingly)
│   ├── shared/          App-level building blocks: PageHeader, StatCard, EmptyState, ResponsiveDialog…
│   ├── layout/          AppShell, sidebar, mobile tab bar, navigation config
│   └── theme/           Light / dark / system theme provider and toggle
├── features/            One folder per product area
│   ├── auth/            Login, AuthContext, PIN authentication
│   ├── leave/           Leave requests: context, request form, approval queue, balances
│   ├── calendar/        Team calendar and day detail
│   ├── dashboard/       Role dashboards (super admin, manager, staff, spectator)
│   ├── attendance/      Check-in/out, geolocation, attendance summaries
│   ├── tasks/           Daily task board
│   ├── staff/           Team overview
│   ├── notifications/   In-app notifications + web push
│   ├── swaps/           Day swaps
│   ├── settings/        User settings
│   └── admin/           Admin console pages and services
├── services/            Shared domain logic (balances, staffing) and firestore/ data access
├── models/              Domain types
├── utils/  hooks/  lib/  config/  i18n/  data/
docs/                    All project documentation and historical reports
scripts/                 Admin/maintenance scripts (scripts/legacy = one-off migrations)
api/                     Vercel serverless functions
functions/               Firebase Cloud Functions
```

Imports use the `@/` alias for `src/`.

## Roles

| Role | Can |
| --- | --- |
| Staff | See balances, request time off, see the calendar, check in, do tasks |
| Manager | Everything staff can, plus approve staff requests and see the team overview |
| Super admin | Everything, plus people, staffing rules, auto-assignment, audit log and admin tools; decides managers' requests |
| Spectator | Read-only dashboard and calendar |

## Business rules

| Rule | Value |
| --- | --- |
| Regular days off per cycle | 6 per 4-week cycle |
| Vacation accrual | 2 days per month, rolls over |
| First Sunday of the month | Automatically off, uses 1 regular day |

## Deployment

Deployed on Vercel (`vercel.json`). Firestore rules and indexes deploy with `firebase deploy --only firestore`.

See [the security and workflow rollout record](docs/SECURITY_AND_WORKFLOW_FIXES.md) for the coordinated Functions, rules, credential migration and Vercel deployment procedure.
