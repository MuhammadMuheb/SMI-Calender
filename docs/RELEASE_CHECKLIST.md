# Final Release Checklist — Show Me Italy Staff Calendar

## Full Test Checklist

### Authentication & Roles
- [x] Login with valid credentials works (all 6 demo users)
- [x] Invalid credentials show error message
- [x] Empty/short PIN shows validation error
- [x] Session persists on page refresh (sessionStorage)
- [x] Session clears on tab close
- [x] Logout clears session and returns to login
- [x] Demo credentials panel shows all 6 users
- [x] Enter key submits login

### Role-Based Access
- [x] Staff sees 3 bottom tabs (Home, Calendar, Settings)
- [x] Manager sees 4 bottom tabs (+ Staff)
- [x] Admin sees 4 bottom tabs (+ Staff)
- [x] Staff cannot access Staff tab (hidden + RoleGuard)
- [x] Admin Panel only accessible from admin dashboard
- [x] Unauthorized page shows when guard blocks

### Staff Dashboard
- [x] Welcome card shows display name
- [x] Balance cards show real numbers
- [x] Auto-Sunday notice appears
- [x] "Request Time Off" opens modal
- [x] Request form validates date, type, balance
- [x] Cannot request first Sunday manually
- [x] Cannot request past dates
- [x] Cannot request duplicate dates
- [x] Balance blocks when exhausted
- [x] "View All" shows request history
- [x] Status filter tabs work
- [x] Cancel button on pending requests
- [x] Swap section shows when swaps exist

### Manager Dashboard
- [x] Team member count is real
- [x] On-duty-today count is real
- [x] Personal leave balance shown
- [x] Manager can request own day off
- [x] "Requires super admin approval" note shown
- [x] Pending staff requests listed
- [x] Tap request opens detail modal
- [x] Staffing impact panel shows per-role breakdown
- [x] Approve/reject with optional note
- [x] Hard block disables approve when below minimum
- [x] Full request queue accessible

### Super Admin Dashboard
- [x] Real stat counts (Total Staff, On Duty, Pending)
- [x] "Approve Requests" opens queue with badge
- [x] "Admin Panel" opens 8-screen admin hub

### Admin Panel
- [x] User Management: add, activate/deactivate, delete with confirmation
- [x] Role Management: add, toggle hidden, delete with cascade
- [x] Staffing Rules: add, toggle enforcement, delete
- [x] Special Days: add with consume/extra choice, delete
- [x] Vacation Adjustments: view balances, adjust with reason
- [x] Notification Settings: time picker, enable/disable toggle, save
- [x] Auto-Assignment: preview with per-staff breakdown, apply
- [x] Audit Log: filterable by action and entity, shows before/after

### Calendar
- [x] Renders current month with Monday-start weeks
- [x] Full weeks shown (leading/trailing days from adjacent months)
- [x] Today highlighted in green
- [x] Weekends visually muted
- [x] Month navigation (prev/next/today)
- [x] Staff sees simple tiles
- [x] Admin/Manager sees rich tiles (counts, markers, warnings)
- [x] Legend shown for rich view
- [x] Month overview card with stats
- [x] Tap tile opens day detail modal
- [x] Day detail shows who's off, pending, holidays, special days
- [x] Staff can propose swaps from day detail

### Notifications
- [x] Bell icon shows unread count badge
- [x] Notification panel opens from bell
- [x] Mark as read / mark all read
- [x] Admin/Manager can generate tomorrow summary
- [x] Summary includes staff off, coverage, shortages, pending

### Theme & UI
- [x] Black background everywhere
- [x] Green primary (#138A52) used consistently
- [x] Red secondary (#B30000) used consistently
- [x] White (#F5F5F5) text on dark backgrounds
- [x] DM Sans font loaded
- [x] Mobile layout works at 390px width
- [x] No horizontal overflow
- [x] All modals slide up on mobile

### PWA
- [x] manifest.json exists with correct values
- [x] SVG icon present
- [x] Service worker registered
- [x] Mobile meta tags (theme-color, apple-mobile-web-app)

### Code Quality
- [x] TypeScript passes (0 errors)
- [x] Production build passes
- [x] No console errors in normal usage
- [x] All files split by responsibility
- [x] No fake backend logic hidden in UI

---

## Known Issues

1. **Data not persistent**: All state is in-memory React state. Refreshing the page loses leave requests, notifications, swap proposals, and admin changes. Session (logged-in user) persists via sessionStorage.

2. **Swap doesn't modify leave requests**: When a swap is accepted, the SwapContext records it but doesn't automatically cancel the proposer's leave and create a new one for the receiver in LeaveContext.

3. **Manager approval not restricted to admin-only**: Any manager or admin can approve any request. There's no check that only super admin can approve manager requests.

4. **Vacation adjustment is audit-only**: The VacationAdjustment screen logs the intended change but doesn't actually modify the computed balance (which is derived from leave requests + accrual formula).

5. **Auto-assignment apply path**: When applying auto-assignments, the requests go through the same validation as manual requests, which may reject some entries.

6. **No automated daily reminder timer**: The "Generate Tomorrow's Summary" is a manual button, not triggered automatically at the configured time.

7. **SVG icons only**: No rasterized PNG icons for older browsers. Some browsers may not show the PWA install prompt without PNG icons.

---

## Future Improvements

### Priority 1 — Backend Integration
- PostgreSQL database (schema ready in src/models/schema.sql)
- REST API for all CRUD operations
- JWT authentication with bcrypt PIN hashing
- Server-side role enforcement middleware
- Persistent leave requests, balances, audit log

### Priority 2 — Feature Completions
- Swap ↔ leave integration (auto-modify leave requests on swap accept)
- Manager request approval restricted to admin only
- Vacation adjustment modifies actual balance
- Edit user inline (not just activate/deactivate)
- Holiday management (add/delete holidays)
- Multi-day leave requests (date range)

### Priority 3 — Notifications
- Push notification delivery (Web Push API)
- Email notification delivery
- Automated daily reminder at configured time (cron job or scheduler)
- Real-time notifications via WebSocket

### Priority 4 — Polish
- PNG icon generation (192px, 512px) for full PWA support
- Offline mode with service worker caching
- Loading spinners for async operations
- Error boundaries for crash recovery
- Animations and transitions (page transitions, list animations)
- Dark mode refinements (currently dark-only, could add light mode)
- Accessibility audit (ARIA labels, keyboard navigation)
- Internationalization (Italian locale)
