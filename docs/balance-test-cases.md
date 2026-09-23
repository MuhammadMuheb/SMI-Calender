# Balance Calculation Test Cases

## Test 1: Fresh cycle — no requests made

**Setup:** Staff member at start of a new 4-week cycle, no requests submitted.

**Expected:**
- regularDaysAllowed: 6
- regularDaysUsed: 0
- regularDaysRemaining: 6
- autoSundayConsumed: depends on whether first Sunday falls in this cycle

**How to verify:** Login as staff1 (3333). Check balance cards on dashboard. Should show 6 days off remaining (minus any auto-Sundays in current cycle).

---

## Test 2: Auto-Sunday consumes one regular day

**Setup:** First Sunday of current month exists. Staff member has made no manual requests.

**Expected:**
- regularDaysUsed: 1 (the auto-Sunday)
- regularDaysRemaining: 5
- autoSundayConsumed: true

**How to verify:** Login as any staff user. The auto-Sunday notice should appear on the dashboard. Balance should show 5 remaining (not 6) because the first Sunday consumed one.

---

## Test 3: Submit 2 regular day-off requests + auto-Sunday

**Setup:** Staff member with auto-Sunday already consumed. Submit 2 additional regular day-off requests (both approved).

**Expected:**
- regularDaysUsed: 3 (1 auto-Sunday + 2 manual)
- regularDaysRemaining: 3
- vacationDaysUsed: 0 (unchanged)

**How to verify:** Login as staff1. Submit 2 day-off requests for future dates. Note that requests start as "pending" — balance only changes when approved. For testing, login as manager and approve both, then check staff balance.

---

## Test 4: Vacation accrual for a user employed 6 months

**Setup:** Staff member created 6 months ago. VACATION_ACCRUAL_PER_MONTH = 2.

**Expected:**
- vacationDaysTotal: 12 (6 months × 2 days)
- If 3 vacation days have been used: vacationDaysRemaining: 9

**How to verify:** staff1 was created 2025-01-15. Calculate months between then and now. Multiply by 2 to get expected accrual. Check vacation balance card.

---

## Test 5: Cannot exceed regular day-off balance

**Setup:** Staff member has used all 6 regular days off in the current cycle (1 auto-Sunday + 5 manual approved requests).

**Expected:**
- regularDaysRemaining: 0
- Attempting to submit another regular_day_off request returns error: "No regular days off remaining in this cycle"
- Staff CAN still submit paid_vacation requests (different balance)

**How to verify:** This would require approving enough requests to exhaust the balance. In the current mock system, requests start as "pending" and only approved requests count. Use manager to approve 5 requests, then try submitting a 6th as staff — should get the error.

---

## Business Rule Summary

| Rule | Value |
| ---- | ----- |
| Regular days off per 4-week cycle | 6 |
| Cycle length | 28 days |
| Vacation accrual per month | 2 days |
| First Sunday of month | Auto-off, consumes 1 regular day |
| Vacation balance | Cumulative (rolls over) |
| Regular day balance | Resets each cycle |
