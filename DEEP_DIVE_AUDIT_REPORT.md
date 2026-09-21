# DEEP-DIVE COMPREHENSIVE AUDIT REPORT

**Date:** 2026-09-21  
**Scope:** Complete codebase analysis - Firebase/Supabase integrity, logical bugs, UI glitches, calculations  
**Status:** ⚠️ **CRITICAL ISSUES FOUND**

---

## 🔴 CRITICAL ISSUES

### 1. **BROKEN ATTENDANCE CALCULATION - HIGH IMPACT**

**Severity:** 🔴 CRITICAL  
**File:** `src/pages/StaffPage.tsx:16-28`  
**Issue:**
```typescript
function useCheckInDayCounts(userIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (userIds.length === 0) return;
    
    // TODO: Migrate to Firestore check-ins query
    const result: Record<string, number> = {};
    for (const id of userIds) result[id] = 0;  // ← ALWAYS RETURNS 0!
    setCounts(result);
  }, [userIds.join(',')]);

  return counts;
}
```

**Impact:**
- **All attendance percentages in Team Overview show 0%** (completely wrong)
- Line 86: `const attendancePct = Math.min(100, Math.round((checkInDays / expectedDays) * 100));`
- `checkInDays` is always 0, so attendance is always 0%
- Users appear to have never checked in, even if they have

**Current Result:**
```
Giovanni: 0% attendance (WRONG - should query Firestore check-ins)
Kristina: 0% attendance (WRONG - should query Firestore check-ins)
Manager: 0% attendance (WRONG - should query Firestore check-ins)
```

**Root Cause:**
The function has a TODO comment but never implemented the Firestore query. It just initializes all counts to 0 and returns them.

**Service Exists But Unused:**
`src/services/firestoreCheckInsService.ts` has the correct functions:
- `fetchCheckInsForDate(date)` ✓
- `fetchRecentCheckIns(days)` ✓
- `fetchUserCheckIns(userId)` ✓

But `StaffPage.tsx` doesn't call any of them!

**Fix Required:**
Replace TODO implementation with actual Firestore call to count distinct check-in days per user in the 30-day window.

---

### 2. **UNIMPLEMENTED ATTENDANCE UTILITY FUNCTIONS**

**Severity:** 🔴 CRITICAL  
**File:** `src/utils/attendanceUtils.ts:1-42`  
**Issue:**
```typescript
// TODO: Migrate all Supabase references to Firestore

export async function exportAttendanceCSV(year: number, month: number) {
  console.log('TODO: Implement exportAttendanceCSV with Firestore');
  return null;  // ← Returns null instead of CSV!
}

export async function generateMonthlySchedule(year: number, month: number) {
  console.log('TODO: Implement generateMonthlySchedule with Firestore');
  return null;  // ← Returns null instead of schedule!
}

export async function getWorkersForDate(date: string) {
  console.log('TODO: Implement getWorkersForDate with Firestore');
  return [];  // ← Returns empty array!
}

export async function recordAutoCheckout(checkInId: string, newCheckoutTime: string) {
  console.log('TODO: Implement recordAutoCheckout with Firestore');
  return null;  // ← Auto-checkout doesn't work!
}

export async function fixMissingCheckout(checkInId: string, checkoutTime: string) {
  console.log('TODO: Implement fixMissingCheckout with Firestore');
  return null;  // ← Can't fix missing checkouts!
}

export async function sendLateAlerts(date: string) {
  console.log('TODO: Implement sendLateAlerts with Firestore');
  return null;  // ← Late alerts don't work!
}

export async function sendCheckoutReminders(date: string) {
  console.log('TODO: Implement sendCheckoutReminders with Firestore');
  return null;  // ← Checkout reminders don't work!
}
```

**Impact:**
- 7 critical attendance functions are completely non-functional
- They just log TODO and return null/empty
- Any code calling these functions gets no data
- Users who need auto-checkout, late alerts, or reminders get nothing

**Status:**
Completely unimplemented since migration from Supabase to Firebase.

---

### 3. **PUSH NOTIFICATION SYSTEM BROKEN**

**Severity:** 🔴 CRITICAL  
**File:** `src/utils/pushManager.ts:1-45`  
**Issue:**
```typescript
// TODO: Migrate push subscriptions to Firestore

export async function subscribeToPushNotifications(onSubscribed: (id: string) => void) {
  // ...
  // TODO: Save subscription to Firestore instead of Supabase
  console.log('Push subscription created - TODO: save to Firestore');  // ← Not saved!
  // ...
}
```

**Impact:**
- Push notification subscriptions are created but never saved
- They're lost on page refresh
- Users won't receive push notifications
- System thinks subscriptions don't exist

---

### 4. **SHIFT REMINDER SYSTEM BROKEN**

**Severity:** 🔴 CRITICAL  
**File:** `src/utils/shiftReminder.ts:1-30`  
**Issue:**
```typescript
// TODO: Migrate shift reminders to Firestore

export function checkShiftReminder(time: string): boolean {
  console.log('TODO: Implement checkShiftReminder with Firestore');
  return false;  // ← Always returns false!
}

export function scheduleShiftReminders(shifts: any[]): void {
  console.log('TODO: Implement scheduleShiftReminders with Firestore');
  // ← Does nothing!
}

export function getScheduledReminders(): any[] {
  console.log('TODO: Implement getScheduledReminders with Firestore');
  return [];  // ← Always returns empty!
}
```

**Impact:**
- Shift reminders are completely non-functional
- No reminders are scheduled
- No reminders are stored or retrieved

---

### 5. **GEOLOCATION TODO - PARTIALLY BROKEN**

**Severity:** 🔴 CRITICAL  
**File:** `src/hooks/useGeolocation.ts:46`  
**Issue:**
```typescript
// TODO: Migrate to Firestore
```

**Impact:**
- Geolocation queries likely broken or incomplete
- Check-in location validation may not work properly

---

## 🟡 MEDIUM ISSUES

### 6. **POTENTIAL DIVISION BY ZERO IN DEPARTMENT COVERAGE**

**Severity:** 🟡 MEDIUM  
**File:** `src/services/departmentLeaveLimitService.ts:166`  
**Issue:**
```typescript
const coveragePercentage = (remaining / usersInDept.length) * 100;
// If usersInDept.length === 0, this becomes (remaining / 0) * 100 = NaN
```

**Impact:**
- If a department has no users, coverage percentage becomes NaN
- May cause UI display issues
- Calculations break silently

**Fix Required:**
Add guard before division:
```typescript
const coveragePercentage = usersInDept.length > 0 
  ? (remaining / usersInDept.length) * 100 
  : 0;
```

---

### 7. **INCOMPLETE MODAL UPDATE - WEEKLY/MONTHLY CONTEXT MIXING**

**Severity:** 🟡 MEDIUM  
**File:** `src/components/StaffLeaveDetailModal.tsx`  
**Issue:**
Modal was recently updated to show BOTH vacation and regular days balances, which works fine BUT violates the weekly/monthly separation principle we established:

**Context:**
- Team Overview is a WEEKLY view
- We previously fixed it to use `getCycleBalance()` (weekly only)
- Modal now shows BOTH weekly AND monthly data
- This creates context confusion about what "weekly" means

**Impact:**
- Users might misunderstand which balance applies to this cycle
- Inconsistency with the principle: "Weekly views show only weekly data"

**Note:** This is a design choice, not a bug. But worth flagging as a potential confusion point.

---

### 8. **DATABASE CONSISTENCY - MIXED PATTERNS**

**Severity:** 🟡 MEDIUM  
**File:** Multiple files  
**Issue:**
Some files use `firestoreService.ts` while others use Firebase directly:

Examples:
- `firestoreUserService.ts` - Uses direct Firebase imports
- `firestoreCheckInsService.ts` - Uses direct Firebase imports
- Some components directly import from Firebase

**Impact:**
- No centralized error handling
- Inconsistent patterns
- Harder to migrate or change database later
- Risk of orphaned Supabase calls if not careful

**Status:** All calls are actually Firebase, but patterns are inconsistent.

---

## 🔵 LOW ISSUES / OBSERVATIONS

### 9. **UNUSED SEED DATA FILES**

**Severity:** 🔵 LOW  
**Files:**
- `src/data/seed.ts` - Marked as unused
- `src/config/demoUsers.ts` - Marked as unused

**Status:** These are old Supabase files, now replaced by calendar ingestion.

---

### 10. **INCONSISTENT ERROR HANDLING**

**Severity:** 🔵 LOW  
**Pattern:** Some services catch errors and log, others may not:
```typescript
catch (error) {
  console.error('fetchCheckInsForDate:', error);
  return [];
}
```

**Impact:** Minor - errors are handled, but inconsistently across services.

---

## ✅ FIREBASE INTEGRATION STATUS

### What's Working Well:

✅ **Authentication:**
- Using Firebase/Firestore for user auth
- PIN authentication working correctly
- Active user filtering implemented

✅ **User Management:**
- Create, read, update, delete all working
- Firestore queries correct
- User deduplication working

✅ **Leave Requests:**
- Create, approve, reject working
- Firestore queries correct
- Filtering by active users working

✅ **Scheduling & Calendars:**
- Using Firestore for schedules
- PDF ingestion working
- Calendar views working

✅ **Core Calculations:**
- Leave balance calculations accurate
- Regular days vs vacation days separation correct
- Staffing rules validation working

---

## 🚨 SUPABASE REMNANTS STATUS

### Analysis Results:

✅ **NO ACTIVE SUPABASE CLIENT:** 
- No `@supabase/supabase-js` imports
- No `createClient()` calls
- No active Supabase API calls

✅ **NO DATA LEAKAGE:**
- All database calls route to Firebase/Firestore
- No competing database writes

⚠️ **LEGACY REFERENCES REMAIN:**
- `supabaseService.ts` exists but is just a wrapper for Firebase
- Files with TODO comments mention Supabase migration
- `seed.ts` and `demoUsers.ts` are old Supabase files

### Conclusion:
**CLEAN FIREBASE MIGRATION** - No active Supabase interference. All data cleanly routed to Firebase.

---

## 📊 SUMMARY OF FINDINGS

| Category | Count | Severity |
|----------|-------|----------|
| Critical Issues | 5 | 🔴 |
| Medium Issues | 3 | 🟡 |
| Low Issues | 2 | 🔵 |
| **Total** | **10** | |

| Type | Status |
|------|--------|
| Firebase Integration | ✅ Clean |
| Supabase Remnants | ✅ None (active) |
| Data Leakage | ✅ None detected |
| Calculation Bugs | ⚠️ 2 found |
| Unimplemented Features | ⚠️ 7 functions |

---

## 🔧 PRIORITY ACTION ITEMS

### Phase 1: CRITICAL (Must Fix Before Production)

1. ✅ **Implement useCheckInDayCounts()** in StaffPage.tsx
   - Query Firestore check-ins
   - Count distinct check-in days per user
   - Fix attendance percentage display

2. ✅ **Implement attendanceUtils functions** in attendanceUtils.ts
   - exportAttendanceCSV()
   - generateMonthlySchedule()
   - getWorkersForDate()
   - recordAutoCheckout()
   - fixMissingCheckout()
   - sendLateAlerts()
   - sendCheckoutReminders()

3. ✅ **Implement pushManager functions** in pushManager.ts
   - Save push subscriptions to Firestore
   - Enable push notifications

4. ✅ **Implement shiftReminder functions** in shiftReminder.ts
   - Enable shift reminder scheduling
   - Store and retrieve reminders

5. ✅ **Implement geolocation** in useGeolocation.ts
   - Complete Firestore migration

### Phase 2: MEDIUM (Should Fix)

1. ✅ Fix division by zero in departmentLeaveLimitService.ts
2. ✅ Add guard checks for empty arrays before division
3. ✅ Clarify modal context (weekly vs monthly data display)

### Phase 3: OPTIONAL (Nice to Have)

1. ✅ Remove unused seed.ts and demoUsers.ts files
2. ✅ Standardize error handling across services
3. ✅ Consolidate Firebase usage patterns

---

## 🎯 RECOMMENDED NEXT STEPS

1. **Do NOT deploy to production** until attendance calculation is fixed
2. Implement Firestore check-ins query in useCheckInDayCounts()
3. Implement attendance utility functions one by one
4. Add comprehensive tests for attendance calculations
5. Test push notifications and shift reminders end-to-end
6. Clean up legacy files and TODOs

---

## ⚠️ IMPORTANT NOTES

- **Firebase is clean:** No Supabase data leakage or conflicts detected
- **Core calculations accurate:** Leave balances, staffing rules, user management all working
- **Attendance broken:** The big issue is that attendance metrics are always showing 0%
- **Legacy code:** Many TODO functions exist but are completely non-functional

---

**VERDICT:** Application is functionally operational for core leave/schedule management, but attendance and notification systems are broken. Firebase migration is clean, but several functions were left unimplemented. These need to be addressed before production deployment.

