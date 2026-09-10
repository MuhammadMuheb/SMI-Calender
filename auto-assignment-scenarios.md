# Auto-Assignment Engine — Example Scenarios

## Scenario 1: Normal cycle — staff with unused days

**Setup:**
- 4 active staff members
- 28-day cycle
- Each has 6 regular days off allowed
- 1 auto-Sunday consumed (5 remaining)
- Staff1 has manually requested 3 days → 2 remaining
- Staff2 has manually requested 0 days → 5 remaining
- Staff3 has manually requested 5 days → 0 remaining
- Staff4 has manually requested 1 day → 4 remaining

**Expected auto-assignment:**
- Staff1: 2 days auto-assigned (mid-week dates preferred)
- Staff2: 5 days auto-assigned (spread across cycle, avoid clustering)
- Staff3: 0 days (already fully used)
- Staff4: 4 days auto-assigned

**Expected fairness behavior:**
- Tuesday/Wednesday/Thursday dates picked first
- No two consecutive auto-assigned days for the same person
- Staffing minimums never broken

---

## Scenario 2: Tight staffing — cannot place all days

**Setup:**
- 2 active staff members (minimal team)
- Staffing rule: Guide — minimum 1 on all days (hard_block)
- Both staff are Guides
- Staff1 has 4 remaining days
- Staff2 has 3 remaining days
- Total: 7 days to place, but on each day at least 1 Guide must be on duty

**Expected result:**
- On any given day, only 1 of the 2 can be off (minimum 1 Guide required)
- Engine alternates between staff: Staff1 gets a day, then Staff2, etc.
- If 7 total days can't all fit without breaking minimum, some remain unfilled
- Warning: "StaffX: could not place N remaining days without breaking staffing"

**Expected assignments:**
- ~7 days placed if cycle has enough workdays for alternation
- Warning shown if any days couldn't be placed

---

## Scenario 3: Hidden role affects placement

**Setup:**
- 3 staff members
- Staff1: Guide + Check-in (hidden role)
- Staff2: Guide only
- Staff3: Coordinator
- Staffing rules: Guide min 2, Check-in min 1 (hard_block)
- Staff1 has 3 remaining days

**Expected behavior:**
- When auto-assigning Staff1's days, the engine checks BOTH Guide and Check-in coverage
- If Staff1 is assigned off on a day, Check-in coverage drops to 0 → hard block
- Engine will NOT assign Staff1 off on days where they're the only Check-in person
- Staff1's auto-assignments only go to days where someone else covers Check-in
- If no such days exist, warning shown

**Key verification:**
- Hidden role "Check-in" is included in staffing calculation even though it's not visible to managers
- The engine respects hard_block enforcement on hidden roles

---

## How to test

1. Login as admin (admin / 1111)
2. Go to Admin Panel → Auto-Assignment
3. Click "Preview Auto-Assignment"
4. Check per-staff breakdown matches expected remaining days
5. Check that no warnings appear unless staffing would break
6. Click "Re-run Preview" to see different random jitter results
7. Click "Apply" to commit the assignments
8. Switch to Calendar tab to verify auto-assigned days appear
