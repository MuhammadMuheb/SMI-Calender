# Leave Balance Calculator Fix: Separating Weekly vs Monthly Logic

## The Problem

**Vacation days (8, 10) were appearing in the Team Overview weekly view**, mixing two completely different calculation contexts:

1. **Weekly/Cycle-Based Regular Days** (should appear in weekly views)
   - Resets each cycle
   - Example: 6 days allowed per cycle
   - Calculation: `regularDaysUsed / regularDaysAllowed`

2. **Monthly Vacation Accrual** (should ONLY appear in monthly/leave request views)
   - Accrues continuously based on months employed
   - Example: 4 months × 2 days/month = 8 vacation days (all-time running total)
   - Calculation: `(hire_date → today) × 2 days/month`

### Root Cause

The `getBalance()` function in LeaveContext was returning a single `LeaveBalance` object containing **BOTH** regular days AND vacation days:

```typescript
// ❌ BEFORE: Mixed both concepts
const bal = getBalance(userId);
// Returns:
{
  regularDaysAllowed: 6,        // ✓ Cycle-based
  regularDaysRemaining: 4,      // ✓ Cycle-based
  vacationDaysRemaining: 8,     // ✗ Monthly accrual - SHOULD NOT BE HERE
}
```

StaffPage.tsx (Team Overview) was then displaying `vacationDaysRemaining` on a **weekly view**, which is incorrect:

```typescript
// ❌ WRONG: Weekly view showing monthly vacation numbers
<div className="text-center">
  <p className="text-sm font-bold">{bal?.vacationDaysRemaining}</p> {/* 8 or 10! */}
  <p className="text-[8px]">vacation</p>
</div>
```

---

## The Solution

**Separate concerns: Create two distinct balance functions**

### 1. `getBalance()` - For Monthly/Leave Management Views
**Returns: Both cycle-based regular days AND monthly vacation accrual**
- Used in: VacationAdjustment, RequestHistory, leave approval modals
- Shows: Complete balance picture for leave requests
- Includes vacation data that accrues monthly

```typescript
// ✓ AFTER: Full balance for leave management
const bal = getBalance(userId);
// Returns BOTH vacation and regular days
{
  regularDaysAllowed: 6,
  regularDaysRemaining: 4,
  vacationDaysRemaining: 8,    // ✓ Included for leave requests
}
```

### 2. `getCycleBalance()` - For Weekly/Team Views
**Returns: ONLY cycle-based data, NO vacation**
- Used in: Team Overview, weekly dashboards
- Shows: Current cycle status ONLY
- Excludes vacation (passes 0 for vacationAccrual)

```typescript
// ✓ AFTER: Cycle-only balance for weekly view
const bal = getCycleBalance(userId);
// Returns ONLY cycle-based data
{
  regularDaysAllowed: 6,
  regularDaysRemaining: 4,
  vacationDaysRemaining: 0,    // ✓ Zero - not applicable in weekly view
}
```

### Implementation in LeaveContext.tsx

```typescript
// Existing function - returns full balance (both regular + vacation)
const getBalance = useCallback((userId: string): LeaveBalance => {
  const cycle = getCycleForDate(today);
  return computeBalance(
    userId, cycle.start, cycle.end,
    approvedRequests,
    getVacationAccrual(userId, users),  // ✓ Includes vacation
    getRegularOverride(userId, users),
  );
}, [requests, users]);

// NEW function - returns cycle-only balance (regular days only)
const getCycleBalance = useCallback((userId: string): LeaveBalance => {
  const cycle = getCycleForDate(today);
  return computeBalance(
    userId, cycle.start, cycle.end,
    approvedRequests,
    0,  // ✓ NO vacation data for weekly views
    getRegularOverride(userId, users),
  );
}, [requests, users]);
```

### Implementation in StaffPage.tsx

```typescript
// ❌ BEFORE
const { getBalance } = useLeave();
const bal = getBalance(u.id);
// Shows vacation numbers in weekly view

// ✓ AFTER
const { getCycleBalance } = useLeave();
const bal = getCycleBalance(u.id);
// Shows ONLY cycle-based regular days
```

---

## Changes Made

### Files Modified

1. **src/context/LeaveContext.tsx**
   - Added `getCycleBalance()` function (line ~367)
   - Exported from LeaveContextValue interface
   - Included in useMemo provider value

2. **src/pages/StaffPage.tsx**
   - Changed import: `getBalance` → `getCycleBalance`
   - Removed vacation day display from Team Overview cards
   - Now shows ONLY cycle-based regular days and attendance

---

## What This Fixes

✅ **Team Overview (Weekly View)**
- No longer shows vacation numbers (8, 10 days)
- Shows only cycle-based regular days
- Shows only attendance percentage (check-in based)

✅ **Leave Request Workflows (Monthly Views)**
- Unaffected - still use `getBalance()`
- Still show full vacation accrual
- Still show regular day balances

✅ **Data Integrity**
- Weekly views now show only weekly data
- Monthly views show monthly data
- No mixing of calculation contexts

---

## Key Principles

1. **Separation of Concerns**
   - Weekly views use cycle-only calculation
   - Monthly/leave views use full calculation
   - Each function returns appropriate data for its context

2. **No Breaking Changes**
   - Existing code using `getBalance()` continues to work
   - New `getCycleBalance()` is opt-in
   - Legacy code gradually migrates to correct function

3. **Data Accuracy**
   - Vacation balance = `(createdAt → today) × 2 days/month`
   - Regular balance = `allowed - used` within current cycle
   - These are completely separate calculations

---

## Summary

**Before**: Weekly view showed monthly vacation numbers → CONFUSING
**After**: Weekly view shows only cycle data → CORRECT
**Before**: Two calculation concepts mixed in one object → UNCLEAR
**After**: Two separate functions for two separate contexts → CLEAN

The fix ensures vacation accrual (monthly, based on hire date) never leaks into weekly views, while keeping full balance available for leave management workflows that need it.
