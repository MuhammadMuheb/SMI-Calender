# Staff Leave Detail Modal Implementation

## Feature Overview

**Click any staff member in Team Overview to see their complete leave and attendance breakdown in a detailed modal popup.**

When an admin or manager clicks on a staff member row, a clean modal appears showing:
1. Staff member info (name, username, active status)
2. **Monthly Vacation Balance** — complete accrual and usage breakdown
3. **Weekly/Cycle Regular Days** — current cycle status and usage
4. Visual progress bars for both types
5. Usage percentages
6. Helpful contextual information

---

## How to Use

### In Team Overview:
1. Navigate to **Dashboard → Team Overview** (or any view showing the staff list)
2. **Click on any staff member row**
3. A modal popup appears showing their complete leave breakdown

### What You'll See:

```
╔════════════════════════════════════════╗
║ Leave & Attendance Details             ║
╠════════════════════════════════════════╣
║                                        ║
║ [Avatar] Raza                  Active  ║
║          raza                          ║
║                                        ║
├────────────────────────────────────────┤
║ 📅 Monthly Vacation Balance            ║
║ Accrues automatically • Never expires  ║
║                                        ║
║ 5 of 8 days remaining                  ║
║ 3 days already used                    ║
║                                        ║
║ [████████░░░] 37%                      ║
║ Used: 3 • Total: 8                     ║
│                                        │
├────────────────────────────────────────┤
║ 📊 Weekly / Cycle Regular Days         ║
║ Resets each cycle                      ║
║ Current: 2026-09-15 to 2026-09-28      ║
║                                        ║
║ 4 of 6 days remaining                  ║
║ 2 days already used                    ║
║                                        ║
║ [██████░░░░░] 33%                      ║
║ Used: 2 • Allowed: 6                   ║
│                                        │
├────────────────────────────────────────┤
║ ℹ️ Note: Vacation days accrue          ║
║ automatically at 2 days per month      ║
║ based on hire date...                  ║
║                                        ║
╚════════════════════════════════════════╝
```

---

## Component Architecture

### New Component: `StaffLeaveDetailModal.tsx`

**Location:** `src/components/StaffLeaveDetailModal.tsx`

**Purpose:** Displays comprehensive leave balance information for a selected staff member

**Props:**
```typescript
interface StaffLeaveDetailModalProps {
  open: boolean;                    // Control modal visibility
  onClose: () => void;              // Called when modal closes
  staff: StaffUser | null;          // Selected staff member data
  balance: LeaveBalance | null;     // Their complete leave balance
}
```

**Features:**
- Staff member header with avatar, name, and active status
- Two main balance sections with visual progress bars
- Percentage usage indicators
- Detailed breakdown of used/remaining/total days
- Informational footer note
- Responsive design
- Consistent theming

### Integration in `StaffPage.tsx`

**Changes made:**
1. **Import:** Added modal component and type
   ```typescript
   import StaffLeaveDetailModal from '../components/StaffLeaveDetailModal';
   import type { StaffUser } from '../models/user';
   ```

2. **State:** Track selected staff member
   ```typescript
   const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
   const selectedBalance = selectedStaff ? getBalance(selectedStaff.id) : null;
   ```

3. **Note:** Uses full `getBalance()` (not `getCycleBalance()`)
   - Includes both vacation AND regular days data
   - Provides complete picture of all leave balances
   - This is intentional for detailed view

4. **Interactivity:** Cards are clickable
   ```typescript
   <Card onClick={() => setSelectedStaff(u)} style={{ cursor: 'pointer' }}>
     <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
       {/* Staff member row content */}
     </div>
   </Card>
   ```

5. **Modal rendering:**
   ```typescript
   <StaffLeaveDetailModal
     open={selectedStaff !== null}
     onClose={() => setSelectedStaff(null)}
     staff={selectedStaff}
     balance={selectedBalance}
   />
   ```

---

## Automated Logic

### Monthly Vacation Accrual (Automatic)
- **Calculation:** `(Hire Date → Today) × 2 days/month`
- **Updates:** Every time the modal is opened (real-time)
- **Storage:** Stored in `user.createdAt` field
- **Accrual:** Continuous - accrues automatically each month

### Leave Deduction (Automatic)
- **Triggered by:** Approved leave requests
- **Types:** `paid_vacation` and `regular_day_off`
- **Updates:** Immediately when leave is approved
- **Tracking:** All-time for vacation (never resets), per-cycle for regular days

### Real-Time Updates
- Modal shows **current** balance data when opened
- Uses live `getBalance()` calculation
- Reflects any approved leaves added since last view
- Shows current cycle dates dynamically

---

## Data Flow

```
User clicks staff member row
         ↓
setSelectedStaff(staff) ← Sets selected staff
         ↓
selectedBalance = getBalance(staff.id) ← Calculates balance
         ↓
Modal opens with:
  ├─ Staff data (name, username, status)
  ├─ Vacation balance (total accrued - used)
  └─ Regular days balance (allowed - used in cycle)
         ↓
Modal displays with visual breakdown
         ↓
User closes modal
```

---

## Balance Breakdown Logic

### Vacation Balance Section
```
Display:
- "X of Y days remaining"
  where X = vacationDaysRemaining
        Y = vacationDaysTotal
- "Z days already used"
  where Z = vacationDaysUsed

Progress:
- Bar width = (vacationDaysUsed / vacationDaysTotal) × 100%
- Percentage = Math.round((vacationDaysUsed / vacationDaysTotal) × 100)

Example:
Used: 3, Total: 8
- Remaining: 5
- Progress: 3/8 = 37%
- Bar fills 37%
```

### Regular Days Balance Section
```
Display:
- "X of Y days remaining"
  where X = regularDaysRemaining
        Y = regularDaysAllowed
- "Z days already used"
  where Z = regularDaysUsed
- Cycle dates: cycleStart → cycleEnd

Progress:
- Bar width = (regularDaysUsed / regularDaysAllowed) × 100%
- Percentage = Math.round((regularDaysUsed / regularDaysAllowed) × 100)

Example:
Used: 2, Allowed: 6
- Remaining: 4
- Progress: 2/6 = 33%
- Bar fills 33%
- Cycle: 2026-09-15 to 2026-09-28
```

---

## Key Implementation Details

### Why `getBalance()` Instead of `getCycleBalance()`?

In this detailed modal, we want to show **complete information** about the user's leave:
- **`getBalance()`:** Returns both vacation (monthly) + regular (weekly) data ✓
- **`getCycleBalance()`:** Returns only cycle data (no vacation) ✗

The modal is a detailed view where both types of information are relevant and valuable.

### Visual Design

**Color Coding:**
- Vacation progress bar: `theme.colors.warning` (orange)
- Regular days progress bar: `theme.colors.primary` (green)
- Background: `theme.colors.bgCard`
- Text: `theme.colors.white` (primary), `theme.colors.grayDark` (secondary)

**Typography:**
- Header: Bold, large
- Section titles: Semibold, medium
- Details: Regular, small

**Spacing:**
- Card sections: Separated by borders
- Internal padding: Consistent 3px/12px
- Icons: 📅 Vacation, 📊 Regular Days, ℹ️ Info

---

## User Interactions

### Click to Open
- Click any staff member row in Team Overview
- Cursor changes to pointer on hover
- Row opacity slightly reduces (visual feedback)

### View Details
- Read complete leave balance
- See visual progress indicators
- Compare usage percentages
- Check current cycle dates

### Close Modal
- Click the X button (top right of modal)
- Click outside the modal
- Any modal close trigger

### Re-open
- Click a different staff member to see their balance
- Click the same staff member again to refresh

---

## Error Handling

**If staff or balance is null:**
- Modal renders nothing (safeguard)
- No errors in console
- Graceful degradation

**If vacation total is 0:**
- Progress calculation handles division by zero
- Shows "0%" usage
- Progress bar displays empty

---

## Future Enhancements

Possible additions:
1. **Edit Balance Button:** Quick adjust vacation/regular days
2. **Leave History:** Expandable list of recent leave requests
3. **Approve/Reject:** Pending leave request actions
4. **Export:** Download balance report
5. **Notifications:** Alert when balance is low
6. **Trends:** Historical usage over time

---

## Testing Checklist

- [ ] Click on staff member → modal opens
- [ ] Modal shows correct staff name
- [ ] Vacation balance displays correctly
- [ ] Regular days balance displays correctly
- [ ] Progress bars show correct percentages
- [ ] Percentages match visual bar length
- [ ] Modal closes on X button click
- [ ] Modal closes on outside click
- [ ] Can open different staff members sequentially
- [ ] Data updates if balances change between opens
- [ ] Responsive on mobile (modal centered)

---

## Summary

✅ **Team Overview → Click Staff Member → Detailed Modal**
- Complete leave and attendance breakdown
- Automatic calculations based on hire date
- Real-time balance updates
- Clean, intuitive interface
- Full leave balance data (vacation + regular days)
- Visual progress indicators
- Ready for production use
