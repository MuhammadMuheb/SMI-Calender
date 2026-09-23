# Role Test Checklist — Show Me Italy Staff Calendar

## Demo Credentials

| Username | PIN  | Role        | Name              |
| -------- | ---- | ----------- | ----------------- |
| admin    | 1111 | Super Admin | Nabeel Ahmed      |
| manager  | 2222 | Manager     | Marco Rossi       |
| staff1   | 3333 | Staff       | Lucia Bianchi     |
| staff2   | 4444 | Staff       | Andrea Conti      |
| staff3   | 5555 | Staff       | Elena Marino      |
| staff4   | 6666 | Staff       | Giuseppe Ferrara  |

---

## Test 1 — Invalid Login

1. Enter username: `wrong`
2. Enter PIN: `9999`
3. Click Sign In
4. **Expected**: Red error message "Invalid username or PIN"
5. **Expected**: User stays on login page

## Test 2 — Missing Fields

1. Leave username empty, click Sign In → error "Enter your username"
2. Enter username, leave PIN empty, click Sign In → error "Enter a valid 4+ digit PIN"
3. Enter username, enter 2-digit PIN, click Sign In → error "Enter a valid 4+ digit PIN"

## Test 3 — Staff Login (staff1 / 3333)

1. Login as staff1 / 3333
2. **Expected**: Redirected to Staff Dashboard
3. **Expected**: Welcome message shows "Lucia Bianchi"
4. **Expected**: Bottom nav shows 3 tabs: Home, Calendar, Settings
5. **Expected**: NO "Staff" tab visible in bottom nav
6. **Expected**: Settings page shows name, "STAFF" badge in gray

## Test 4 — Manager Login (manager / 2222)

1. Login as manager / 2222
2. **Expected**: Redirected to Manager Dashboard
3. **Expected**: Manager badge visible
4. **Expected**: Bottom nav shows 4 tabs: Home, Calendar, Staff, Settings
5. **Expected**: Staff tab loads staff list page
6. **Expected**: Settings page shows "MANAGER" badge in green

## Test 5 — Super Admin Login (admin / 1111)

1. Login as admin / 1111
2. **Expected**: Redirected to Super Admin Dashboard
3. **Expected**: Shield icon + "SUPER ADMIN" red badge visible
4. **Expected**: Bottom nav shows 4 tabs: Home, Calendar, Staff, Settings
5. **Expected**: All pages accessible
6. **Expected**: Settings page shows "SUPER ADMIN" badge in red

## Test 6 — Logout

1. Login as any user
2. Click logout button in top right (red door icon)
3. **Expected**: Returned to login page
4. **Expected**: Session cleared

## Test 7 — Session Persistence

1. Login as any user
2. Refresh the page (Cmd+R)
3. **Expected**: User remains logged in, not kicked to login page
4. Close tab and reopen → **Expected**: Session cleared (sessionStorage)

## Test 8 — Role Guard (Staff cannot access Staff page)

1. Login as staff1
2. Bottom nav should NOT show Staff tab
3. If somehow navigated to Staff tab → Unauthorized view should appear

## Test 9 — Demo Credentials Panel

1. On login page, click "Show demo credentials"
2. **Expected**: 4 demo users shown with username/PIN and role badges
3. Click on any user row
4. **Expected**: Username and PIN fields auto-fill
5. Click Sign In → login succeeds

## Test 10 — Enter Key Login

1. Enter valid credentials
2. Press Enter key instead of clicking Sign In
3. **Expected**: Login succeeds
