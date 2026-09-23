# Firebase Firestore Audit & Fix Report

**Date:** September 21, 2026  
**Status:** CRITICAL ISSUES IDENTIFIED  
**Priority:** HIGH - Permission and Data Integrity Issues

---

## Executive Summary

Comprehensive audit of SMI-Calendar Firestore implementation revealed **4 critical categories of issues**:

1. **Collection Name Mismatches** (HIGH) - Rules file vs. Code inconsistencies
2. **Document ID Format Issues** (CRITICAL) - User document lookups fail in multiple locations
3. **Missing Cascading Deletions** (CRITICAL) - Orphaned records left when users deleted
4. **Security Rules Gaps** (MEDIUM) - Missing collections in rules, unused collections defined

---

## PART 1: Collection Name Mismatches

### Issue: Firestore Security Rules vs. Application Code

**Root Cause:** Security rules define collections with underscores (snake_case), but application code uses camelCase.

**Collections with Mismatches:**

| Collection | Rules File | Code | Status |
|------------|-----------|------|--------|
| Role Assignments | `role_assignments` | `roleAssignments` | MISMATCH |
| Staffing Rules | `staffing_rules` | `staffingRules` | MISMATCH |
| Special Days | `special_days` | `specialDays` | MISMATCH |
| Check-ins | `check_ins` | `checkIns` | MISMATCH |

**Collections Missing from Rules:**

| Collection | Code | Rules | Impact |
|------------|------|-------|--------|
| `holidays` | Used in code | NOT defined | Operations silently fail |
| `notificationSettings` | Used in code | NOT defined | Settings updates fail |

**Collections Defined but Unused:**

| Collection | Rules | Code | Impact |
|------------|-------|------|--------|
| `swaps` | Defined | IN-MEMORY only (mock) | Rules are wasted |
| `vacation_adjustments` | Defined | NOT used | Dead collection |

### Files Affected:

- `firestore.rules` - Lines 58-73 (collection definitions)
- `src/services/firestoreRoleService.ts` - Line 84 (`roleAssignments`)
- `src/services/firestoreStaffingService.ts` - Line 11 (`staffingRules`)
- `src/services/firestoreSettingsService.ts` - Lines 13, 41 (`specialDays`, `notificationSettings`)
- `src/services/firestoreCheckInsService.ts` - Multiple references to `checkIns`
- `src/components/CheckInButton.tsx` - Multiple references to `checkIns`

### Error Manifestation:

When code tries to write to `roleAssignments` but rules only allow `role_assignments`, Firestore silently blocks the operation, causing:
- "Missing or insufficient permissions" errors
- Silent write failures (no exception thrown on client)
- Cascading consistency issues

---

## PART 2: Document ID Format Issues

### Issue 1: User Document ID Inconsistency

**Problem:** User documents can be stored with two different ID formats:
- `username` (e.g., "john_doe")
- `usr_username` (e.g., "usr_john_doe")

**Current Handling:**
- `insertUser()` - Uses `username.toLowerCase()` as document ID
- `deleteUserDb()` - Handles BOTH formats with fallback logic (lines 116-128)
- `updateUserDb()` - Only uses `username.toLowerCase()`
- `LanguageContext.tsx` - Uses `userId` directly (WRONG)

**Files with Potential Issues:**

1. **src/context/LanguageContext.tsx** (CRITICAL)
   ```
   Line: doc(db, 'users', userId)
   Problem: userId is NOT the document ID, username is
   Impact: Language preference updates fail silently
   ```

2. **src/services/firestoreUserService.ts** (PARTIALLY FIXED)
   ```
   deleteUserDb() - Has fallback logic ✓
   updateUserDb() - No fallback logic ✗
   insertUser() - No fallback logic ✗
   ```

3. **src/utils/devSeeding.ts**
   ```
   Uses username.toLowerCase() ✓
   ```

### Issue 2: No Fallback in Query Operations

The codebase has NO fallback logic when querying role assignments or other collections by userId. If a user ID format is inconsistent, queries will silently fail.

---

## PART 3: Missing Cascading Deletions (CRITICAL)

### Current Deletion Flow

When `deleteUserDb(userId)` is called:

1. ✓ Deletes user document from `users` collection
2. ✗ Does NOT delete role assignments
3. ✗ Does NOT delete leave requests  
4. ✗ Does NOT delete check-ins
5. ✗ Does NOT delete tour assignments
6. ✗ Does NOT delete task assignments

### Orphaned Records Left Behind

After user deletion, these collections still contain references to the deleted user:

| Collection | Linked Via | Records Left | Impact |
|------------|------------|--------------|--------|
| `roleAssignments` | `userId` field | All assignments for that user | Breaks role queries |
| `leave_requests` | `userId` field | All leave requests for that user | Breaks leave balance calc |
| `checkIns` | `userId` field | All check-ins for that user | Audit trail corruption |
| `tour_assignments` | `userId` field | All assignments for that user | Schedule inconsistency |
| `task_assignments` (tasks collection) | `assignedTo` field | All task assignments | Orphaned tasks |

### File with Issue:

**src/context/AppDataContext.tsx** (Lines 259-304)
- `deleteUser()` function only calls `deleteUserDb(id)`
- Does NOT query and delete dependent records
- Does NOT include transaction logic for atomic operations

### Firestore Rules Allow Cascading Deletes

Looking at rules (lines 62-64), `roleAssignments` (should be `role_assignments`) can be deleted by any authenticated user. The capability exists—the code just doesn't use it.

---

## PART 4: Security Rules Gaps

### Rules Defined but Collections Missing in Code:

1. **vacation_adjustments** (line 71)
   - Not used anywhere in codebase
   - No fetching, creating, or updating functions

2. **swaps** (line 48)
   - Rules defined but code uses in-memory storage
   - Firestore rules are wasted

### Collections Used in Code but Missing from Rules:

1. **holidays** - Fetched in code (firestoreSettingsService.ts) but NO rules match
2. **notificationSettings** - Used in code but NO rules match
3. **jobRoles** - Referenced in AppDataContext but NO explicit rule for it

### Impact:

- Reads/writes to these collections will fail with "Missing or insufficient permissions"
- No audit trail of changes
- No proper access control

### Specific Missing Rules:

```rules
// MISSING: 
match /holidays/{holidayId} {
  allow read, create, update, delete: if request.auth != null;
}

// MISSING:
match /notificationSettings/{settingId} {
  allow read, create, update, delete: if request.auth != null;
}

// MISSING (not explicitly defined):
match /jobRoles/{roleId} {
  allow read, create, update, delete: if request.auth != null;
}
```

---

## PART 5: Detailed Issue Map

### High Severity Issues:

| ID | Issue | Location | Impact | Fix |
|----|-------|----------|--------|-----|
| H1 | Collection name mismatch: `roleAssignments` | firestoreRoleService.ts:84 | Permission denied on writes | Change to `role_assignments` |
| H2 | Collection name mismatch: `staffingRules` | firestoreStaffingService.ts:11 | Permission denied on writes | Change to `staffing_rules` |
| H3 | Collection name mismatch: `specialDays` | firestoreSettingsService.ts:13 | Permission denied on writes | Change to `special_days` |
| H4 | Collection name mismatch: `checkIns` | firestoreCheckInsService.ts | Permission denied on writes | Change to `check_ins` |
| H5 | Missing cascading delete of role assignments | AppDataContext.tsx:270 | Orphaned records | Implement batch delete |
| H6 | Missing cascading delete of leave requests | AppDataContext.tsx:270 | Orphaned records | Implement batch delete |
| H7 | Wrong document ID format in LanguageContext | LanguageContext.tsx | Silent update failures | Query user by username first |

### Medium Severity Issues:

| ID | Issue | Location | Impact | Fix |
|----|-------|----------|--------|-----|
| M1 | Missing rules for `holidays` | firestore.rules | Reads fail silently | Add rule block |
| M2 | Missing rules for `notificationSettings` | firestore.rules | Updates fail silently | Add rule block |
| M3 | Missing rules for `jobRoles` | firestore.rules | May fail on some ops | Add rule block |
| M4 | Unused `swaps` collection in rules | firestore.rules | Maintenance confusion | Remove or document |
| M5 | Unused `vacation_adjustments` collection | firestore.rules | Maintenance confusion | Remove or document |

### Low Severity Issues:

| ID | Issue | Location | Impact | Fix |
|----|-------|----------|--------|-----|
| L1 | updateUserDb lacks fallback logic | firestoreUserService.ts:88 | May fail on legacy docs | Add fallback |
| L2 | insertUser lacks fallback logic | firestoreUserService.ts:49 | May fail on legacy docs | Add fallback |

---

## PART 6: Affected User Workflows

### Scenario 1: Deleting a User
**Current State:** BROKEN
1. User clicks "Delete" on StaffManagement page
2. `deleteUser()` called in AppDataContext
3. User document deleted from Firestore
4. ❌ Role assignments remain (orphaned)
5. ❌ Leave requests remain (orphaned)
6. ❌ Check-ins remain (audit trail corrupted)
7. **Result:** Database inconsistency

### Scenario 2: Updating Role Assignments
**Current State:** BROKEN
1. Admin assigns user to a job role
2. Code calls `insertRoleAssignment()` → writes to `roleAssignments` collection
3. ❌ Firestore rules block write (expects `role_assignments`)
4. **Result:** Permission denied error

### Scenario 3: Updating User Language Preference
**Current State:** BROKEN
1. User changes language in settings
2. `setLang()` called in LanguageContext
3. Code tries to update `doc(db, 'users', userId)`
4. ❌ Document ID is wrong (should be username)
5. **Result:** Silent failure, preference not saved

---

## PART 7: Test Cases That Would Fail

```
Test: Delete user and verify no orphaned records
Status: FAIL (orphaned records remain)

Test: Assign role to user
Status: FAIL (permission denied)

Test: Save user language preference
Status: FAIL (wrong document ID)

Test: Update special day  
Status: FAIL (wrong collection name)

Test: View staffing rules
Status: FAIL (wrong collection name)

Test: Save notification settings
Status: FAIL (collection not in rules)
```

---

## PART 8: Recommendations

### Immediate Actions (CRITICAL):

1. **Fix Collection Names** - Standardize on snake_case across all files
2. **Add Cascading Delete Logic** - Delete dependent records atomically
3. **Fix LanguageContext** - Query user by username before update
4. **Update Firestore Rules** - Add missing collections, fix mismatches

### Follow-Up Actions (HIGH):

5. **Add Fallback Logic** - All user queries should handle both ID formats
6. **Comprehensive Testing** - Test all user CRUD operations
7. **Document Operations** - Create Firebase Operations Guide

### Nice-to-Have:

8. Remove unused collections from rules (`swaps`, `vacation_adjustments`)
9. Implement Firestore transaction layer for consistency
10. Add field-level validation in Cloud Functions

---

## PART 9: Files Requiring Changes

### Priority 1 - Rules & Service Fixes:

1. `firestore.rules` - Fix collection names and add missing collections
2. `src/services/firestoreRoleService.ts` - Change `roleAssignments` → `role_assignments`
3. `src/services/firestoreStaffingService.ts` - Change `staffingRules` → `staffing_rules`
4. `src/services/firestoreSettingsService.ts` - Change `specialDays` → `special_days`
5. `src/services/firestoreCheckInsService.ts` - Change `checkIns` → `check_ins`
6. `src/components/CheckInButton.tsx` - Change `checkIns` → `check_ins`

### Priority 2 - Deletion Logic:

7. `src/services/firestoreUserService.ts` - Add cascading delete function
8. `src/context/AppDataContext.tsx` - Update deleteUser to use cascading delete

### Priority 3 - Document ID Fixes:

9. `src/context/LanguageContext.tsx` - Fix document ID lookup
10. `src/services/firestoreUserService.ts` - Add fallback logic to updateUserDb

---

## Implementation Progress Tracking

- [ ] Step 1: Update firestore.rules
- [ ] Step 2: Fix collection names in all services
- [ ] Step 3: Add cascading delete logic
- [ ] Step 4: Fix LanguageContext document lookup
- [ ] Step 5: Add fallback logic for user queries
- [ ] Step 6: Test all affected workflows
- [ ] Step 7: Deploy and verify in production

---

## Next Steps

See `FIREBASE_FIX_IMPLEMENTATION.md` for detailed code changes and testing procedures.
