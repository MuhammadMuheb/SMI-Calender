# Show Me Italy — Staff Calendar

A mobile-first staff scheduling and calendar management PWA for **Show Me Italy** / **Premium Tours** (Rome).

## Quick Start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Demo Credentials

| Username | PIN  | Role        | Name             |
|----------|------|-------------|------------------|
| admin    | 1111 | Super Admin | Nabeel Ahmed     |
| manager  | 2222 | Manager     | Marco Rossi      |
| staff1   | 3333 | Staff       | Lucia Bianchi    |
| staff2   | 4444 | Staff       | Andrea Conti     |
| staff3   | 5555 | Staff       | Elena Marino     |
| staff4   | 6666 | Staff       | Giuseppe Ferrara |

Click **"Show demo credentials"** on the login page to auto-fill.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** (dev server + build)
- **Tailwind CSS v4** (via @tailwindcss/vite plugin)
- **DM Sans** font (Google Fonts)
- **PWA** manifest + mobile meta tags

### Why Vite over Next.js

This is a staff-facing SPA/PWA — no SEO needed, no server-side rendering, simpler Vercel deployment, and faster dev experience.

## Project Structure

```
src/
├── components/
│   ├── ui/           # Button, Card, Badge, Modal, FormInput, CalendarTile, Icons
│   ├── layout/       # AppShell, TopBar, BottomNav
│   └── guards/       # RoleGuard
├── config/           # theme.ts, roles.ts, demoUsers.ts
├── context/          # AuthContext, LeaveContext, AppDataContext, SwapContext, NotificationContext
├── models/           # TypeScript interfaces for all entities + schema.sql
├── services/         # Business logic (leave, balance, staffing, audit, calendar, auto-assign, notification)
├── hooks/            # useCalendarData
├── utils/            # dateUtils (timezone-safe)
├── data/             # Seed data
└── pages/
    ├── dashboards/   # SuperAdmin, Manager, Staff dashboards
    ├── admin/        # 8 admin screens
    └── ...           # Login, Calendar, Requests, Notifications, Swaps
```

## Features by Role

### Staff
- View personal day-off and vacation balances
- Request time off (day off or paid vacation)
- View request history with status filters
- Cancel pending requests
- View calendar with day detail (see who is off)
- Propose day swaps with same-role colleagues
- Accept/decline incoming swap requests
- Receive in-app notifications

### Manager
- Everything staff can do
- Request own days off (requires super admin approval)
- Approve/reject staff requests with staffing impact preview
- View request queue with status filters
- Generate tomorrow absence summary

### Super Admin
- Everything manager can do
- Admin Panel: User Management, Role Management (hidden roles), Staffing Rules, Special Days, Vacation Adjustments, Notification Settings, Auto-Assignment, Audit Log
- Direct-assign days off (instant approve)
- Override manager decisions

## Business Rules

| Rule | Value |
|------|-------|
| Regular days off per 4-week cycle | 6 |
| Cycle length | 28 days |
| Vacation accrual per month | 2 days |
| First Sunday of month | Auto-off, consumes 1 regular day |
| Vacation balance | Cumulative (rolls over) |
| Default reminder time | 14:00 |

## Design Tokens

| Token | Value |
|-------|-------|
| Background | #000000 |
| Primary Green | #138A52 |
| Secondary Red | #B30000 |
| White | #F5F5F5 |
| Soft Gray | #BDBDBD |
| Font | DM Sans |

## Deployment

```bash
npm run build
npx vercel
```

## Current Status

**Frontend-only with in-memory data.** All state lost on refresh. Session in sessionStorage.

### Needs backend integration:
- Real auth (JWT, PIN hashing)
- Database (see src/models/schema.sql)
- Server-side role enforcement
- Persistent data
- Push/email notifications
- Automated daily reminder timer
