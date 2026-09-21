# User Activity Status & Leave Balance Logic

## 1. ACTIVE STATUS vs LOGIN ACTIVITY

### What "Active" Means
In the database, **`isActive` is simply an account state flag**, NOT a login activity indicator:

```typescript
// User Model - Line 14 in models/user.ts
isActive: boolean;  // ✓ Account is not deleted (soft delete flag)
                    // ✗ NOT tracking actual login/app usage
```

### The Two Separate Concepts

| Concept | Field | Tracks | Meaning |
|---------|-------|--------|---------|
| **Account Status** | `isActive` | Account state | User is not deleted/archived |
| **Login Activity** | *(not tracked)* | Actual usage | Whether user logged in or used app |

### Why Users Show as "Active" Without Login

Users appear as "Active" in Team Overview if:
- ✅ `isActive = true` in database (account exists and isn't deleted)
- ✅ NOT deleted/archived by admin
- **The app does NOT track or require actual login activity**

**This is by design** - the system treats all non-deleted users as active staff members who:
- Can have shifts/schedules assigned
- Can submit leave requests
- Accrue vacation days automatically
- Are visible in the staff roster

### Where Login Activity Would Go

Currently, **there is NO login/activity tracking** in the system. If needed, you would need:
- `lastLoginAt` timestamp on user
- `lastActivityAt` timestamp on user
- An activity log collection
- Middleware to track each page visit/action

---

## 2. LEAVE BALANCE & VACATION CALCULATIONS

### How Vacation Days Are Assigned

Vacation days are **automatically accrued based on employment duration**, not based on login activity:

```typescript
// balanceService.ts - computeBalance() function
// Calculates: totalVacationAccrued - vacationDaysUsed = vacationDaysRemaining
```

### Vacation Accrual Formula

```
Vacation Days = (Months Employed × 2 days/month) + Optional Override
```

**Constants:**
- `VACATION_ACCRUAL_PER_MONTH = 2` days
- Example: Employee hired 4 months ago gets 8 vacation days (4 × 2)

**With Override:**
```typescript
// If admin sets vacationOverride (manual adjustment):
if (user.vacationOverride != null) {
  return user.vacationOverride + (monthsSince(vacationOverrideAt) × 2)
}
// Otherwise, use months since created:
return monthsBetween(createdAt, today) × 2
```

### Why Raza Shows "8" Vacation Days

**Example:**
- User "Raza" hired 4 months ago
- Calculation: 4 months × 2 days/month = **8 vacation days**
- This is the TOTAL accrued, NOT used from login activity

### Why Desiree Shows "10" Vacation Days

**Example:**
- User "Desiree" hired 5 months ago  
- Calculation: 5 months × 2 days/month = **10 vacation days**
- Plus any approved vacation leave requests are deducted
- `vacationDaysRemaining = 10 - (days already taken)`

### Leave Balance Breakdown

```typescript
// What each metric represents:

{
  regularDaysAllowed: 6,        // Per-cycle allowance (default per cycle)
  regularDaysUsed: 2,           // Days already taken this cycle
  regularDaysRemaining: 4,      // Days left to use

  vacationDaysTotal: 10,        // Total accrued (4.5 months × 2)
  vacationDaysUsed: 0,          // Vacation days already used (all-time)
  vacationDaysRemaining: 10,    // Vacation days left to use
}
```

---

## 3. HOW INITIAL BALANCES ARE ASSIGNED

### At User Creation

When a new user is created:
1. Account created with `isActive: true`
2. `createdAt` timestamp recorded
3. Vacation accrual calculated automatically:
   ```
   monthsBetween(createdAt, today) × 2 = vacation days
   ```
4. Regular days: 6 per cycle (from `REGULAR_DAYS_OFF_PER_CYCLE`)
5. Override fields optional (for manual adjustments)

### Example: New Employee on Day 1

```
User: "Sarah"
createdAt: 2026-09-21
Today: 2026-09-21

Months employed: 0
Vacation days accrued: 0 × 2 = 0 days
Regular days allowed: 6 (per cycle)
Status: Active (isActive: true)
```

After 2 months:
```
Today: 2026-11-21
Months employed: 2
Vacation days accrued: 2 × 2 = 4 days
```

---

## 4. KEY DIFFERENCES CLARIFIED

### "Active" Status
- **Definition**: Account exists and not deleted
- **Indicator**: `isActive: true` in database
- **When it changes**: Only when admin deletes/archives user
- **Does NOT mean**: User logged in or used the app
- **Does NOT track**: Login timestamps, page visits, actions

### Leave Balance
- **Definition**: Automatic accrual based on employment duration
- **Calculation**: `(createdAt → today) × 2 days/month`
- **Does NOT require**: Any login or app usage
- **Does NOT mean**: All days were spent; just the allowance
- **Can be overridden**: Admin can manually set `vacationOverride`

### Attendance Percentage
- **Calculation**: `(check-in days in 30-day window / expected work days) × 100%`
- **Does NOT track**: Actual login to app
- **Tracks**: Physical check-in records (separate system)
- **Expected work days**: Total days minus approved leave

---

## 5. WHAT THIS MEANS FOR YOUR SYSTEM

✅ **Users are "Active" immediately upon creation**
- They can be assigned shifts
- They can submit leave requests
- Their vacation accrues automatically
- This is correct behavior for a staff management system

⚠️ **No Login/Activity Tracking Currently**
- System doesn't distinguish between users who log in vs don't
- All non-deleted users are treated equally
- Vacation and leave balances are automatic, not earned by usage

🔧 **If You Need Login Tracking**
- Add `lastLoginAt` timestamp
- Add activity logging middleware
- Track page visits, form submissions, etc.
- This would be a new feature, not a bug

---

## 6. AUDIT TRAIL

When a user is deleted:
1. `isActive: false` (marked as deleted)
2. Deletion recorded in Audit Log with timestamp
3. Their leave requests filtered out of calculations
4. No longer appears in active staff views
5. Historical records preserved for compliance

**The system correctly isolates deleted user data** — they don't affect current balances or metrics.

---

**Summary**: Users show as "Active" because they're not deleted. Their vacation counts come from automatic monthly accrual based on hire date, not from app usage. This is standard leave management logic.
