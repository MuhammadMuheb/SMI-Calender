# Monthly Leave Tracking: Complete Breakdown Guide

## How Monthly Leave is Tracked

### 1. VACATION DAYS ACCUMULATION

**Where it's stored:**
- Database field: `vacationOverride` (optional manual adjustment)
- Calculated from: `user.createdAt` (hire date)
- Formula: `(Today - Hire Date) ÷ 12 months × 2 days/month`

**Example:**
```
User: Raza
Hire Date: May 21, 2026
Today: September 21, 2026
Months Employed: 4 months
Vacation Days Accrued: 4 × 2 = 8 days
```

### 2. VACATION DAYS USAGE

**Where it's stored:**
- Collection: `leaveRequests` in Firestore
- Filter: `leaveType === 'paid_vacation' && status === 'approved'`
- Counted: ALL-TIME (never resets)

**Example:**
```
User: Raza
Total Accrued: 8 days
Approved Vacation Requests: [May 28, June 15, July 3] = 3 days used
Remaining: 8 - 3 = 5 days
```

---

## Where to View Monthly Leave Details

### For Staff Members

#### 1. **Request History → Balance Tab**
**Path:** Staff Dashboard → Request History → Balance tab
**What it shows:**
- Total vacation days accrued
- Vacation days already used
- Vacation days remaining
- Breakdown with circular progress rings

```
┌─────────────────────────────────┐
│ Vacation Balance                │
│ 5 of 8 days                     │
│ "Accrues and rolls over"        │
│                                 │
│ [Circular Progress Ring]        │
│ ░░░░▓▓▓ (5/8)                  │
└─────────────────────────────────┘
```

**Access:** Click staff profile → "Balance" tab

---

### For Managers

#### 1. **Manager Dashboard → Vacation Balance Card**
**Path:** Manager Dashboard (main view)
**What it shows:**
- My (manager's) vacation balance breakdown:
  - Days taken (used)
  - Days booked (pending)
  - Days remaining
- Visual: Stacked bar chart with three segments

```
Vacation Balance
Never expires

[■ taken(3)] [■ booked(1)] [■ remaining(4)]
             8 days total
```

#### 2. **Admin Panel → Vacation Adjustments**
**Path:** Admin Panel → "Vacation Adjustments"
**What it shows (for ALL staff):**
- Each active staff member card
- Quick display: "X of Y accrued" vacation days
- Detailed breakdown when expanded:
  - Regular Days Off: remaining/allowed, cycles reset, used count
  - Vacation Balance: remaining/total, never expires, used count
- Option to adjust/override vacation totals

**Example card:**
```
┌─────────────────────────────────┐
│ Raza                            │
│         5 of 8 accrued          │
│                                 │
│ ▼ [expand]                      │
│                                 │
│ Regular Days Off:               │
│ 4 / 6  (resets each cycle)      │
│ 2 used                          │
│                                 │
│ Vacation Balance:               │
│ 5 / 8  (accrued, never expires) │
│ 3 used                          │
│                                 │
│ [Adjust Allowances]             │
└─────────────────────────────────┘
```

---

## Complete Leave Balance Breakdown

### What Each Metric Means

```typescript
LeaveBalance {
  // REGULAR DAYS (per cycle, resets)
  regularDaysAllowed: 6,        // Allowed per cycle (default)
  regularDaysUsed: 2,           // Used so far in THIS cycle
  regularDaysRemaining: 4,      // Left to use in THIS cycle
  
  // VACATION (all-time, never resets)
  vacationDaysTotal: 8,         // Total accrued since hire
  vacationDaysUsed: 3,          // Total used all-time
  vacationDaysRemaining: 5,     // Total available to use
  
  // TIMESTAMP
  cycleStart: "2026-09-15",     // Current cycle start
  cycleEnd: "2026-09-28",       // Current cycle end
}
```

---

## Admin Controls for Leave Adjustments

### Vacation Adjustments Page

**Location:** Admin Panel → Vacation Adjustments

**What admins can do:**

1. **View all staff vacation balances** (quick overview)
2. **Expand any staff member** to see detailed breakdown
3. **Adjust vacation total** (override automatic calculation)
   - Example: "Set vacation to 14 days" (instead of auto-calculated 8)
4. **Adjust regular days allowance** (change from default 6)
   - Example: "Set regular days to 4 per cycle"
5. **Provide reason** for adjustment (required, logged in audit trail)
6. **Confirm adjustment** - logged in audit trail for compliance

**Adjustment Modal:**
```
Current vacation total: 8 days
Current day-off allowance: 6 per cycle

[Vacation Total] [14]
[Day-Off Allowance] [6]
[Reason] [Hired with 2 weeks initial vacation]

[Cancel] [Confirm Adjustment]
```

---

## How to Find Specific Information

### Question: "How many vacation days has Raza taken?"

**Step 1:** Go to Admin Panel → Vacation Adjustments
**Step 2:** Find "Raza" in the list
**Step 3:** Click to expand
**Step 4:** Look at "Vacation Balance" section:
```
Vacation Balance: 5 / 8 (accrued, never expires)
[3 used]  ← This is the answer
```

### Question: "What's the breakdown of Raza's vacation requests?"

**Step 1:** Go to Staff Management (admin view of user)
**Step 2:** Click on Raza → View leave requests
**Step 3:** Filter by "approved" and "paid_vacation"
**Step 4:** Count the dates to see which specific days were taken

### Question: "Has Raza used all their vacation or do they have days left?"

**Step 1:** Go to Vacation Adjustments
**Step 2:** Find Raza
**Step 3:** Check the card:
```
5 of 8 accrued  ← 5 remaining, 8 total
```

---

## How Leave Balance is Calculated

### Vacation Days Accrual Calculation

```typescript
// In LeaveContext.tsx - getVacationAccrual()
function getVacationAccrual(userId: string, users: User[]): number {
  const user = users.find((u) => u.id === userId);
  
  // If admin has set a manual override:
  if (user.vacationOverride != null && user.vacationOverride >= 0) {
    const since = user.vacationOverrideAt ? new Date(user.vacationOverrideAt) : now;
    return user.vacationOverride + monthsBetween(since, now) * 2;
  }
  
  // Otherwise, calculate from hire date:
  return monthsBetween(new Date(user.createdAt), now) * 2;
}

// Returns: Total vacation days available to use (all-time)
```

### Vacation Days Used Calculation

```typescript
// In balanceService.ts - countVacationDaysUsed()
function countVacationDaysUsed(approvedRequests: LeaveRequest[]): number {
  return approvedRequests.filter(
    (r) => r.status === 'approved' && r.leaveType === 'paid_vacation'
  ).length;
}

// Returns: Total vacation days already used (all-time, never resets)
```

### Vacation Days Remaining Calculation

```typescript
// In balanceService.ts - computeBalance()
{
  vacationDaysTotal: totalVacationAccrued,      // From getVacationAccrual()
  vacationDaysUsed: vacationUsed,               // From countVacationDaysUsed()
  vacationDaysRemaining: totalVacationAccrued - vacationUsed,  // Available to use
}
```

---

## Key Points to Remember

✅ **Vacation is monthly accrual**
- Accrues: `2 days per month` since hire date
- Example: 5-month employee = 10 vacation days total
- Rolls over: Never expires

✅ **Regular days are per-cycle**
- Resets: Each cycle (typically 2 weeks)
- Default: 6 days per cycle
- Does NOT roll over to next cycle

✅ **Admin overrides are tracked**
- Can set manual vacation total
- Can set manual regular days allowance
- All changes logged in audit trail
- Reason required for compliance

✅ **Used days are all-time for vacation**
- Never resets
- Once used, it counts against the total forever
- Regular days reset each cycle, so used count also resets

---

## Data Integrity Checks

**Automatic Validations:**
1. ✓ Deleted users don't affect team vacation counts
2. ✓ Only approved leaves count toward usage
3. ✓ Vacation never shows negative remaining
4. ✓ Regular days calculated within current cycle only
5. ✓ Admin adjustments logged with reason + timestamp

**Audit Trail:**
- Every vacation adjustment → logged as "balance_adjusted"
- Include: old value → new value, reason, admin name, timestamp
- Location: Admin Panel → Audit Log

---

## Summary

| Aspect | Vacation | Regular Days |
|--------|----------|--------------|
| **Accrual** | 2 days/month | 6 per cycle |
| **Reset** | Never (rolls over) | Each cycle |
| **Viewed** | Vacation Adjustments, Balance Tab | Same locations |
| **Admin Edit** | Vacation Adjustments page | Same page |
| **Tracked** | All-time total | Per-cycle only |
| **Expires** | Never | Resets each cycle |

**To view complete breakdown:** Admin Panel → Vacation Adjustments → Expand any staff member
