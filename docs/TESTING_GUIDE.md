# Local Testing Guide - Calendar Data & Deletion Workflows

**STATUS:** ✅ Code compiled successfully
**IMPORTANT:** These changes are NOT pushed to staging yet. Complete all local tests before pushing.

---

## Overview

This testing guide covers two critical workflows that have been implemented locally:

1. **Calendar Data Ingestion** - Exact data from August & September PDFs
2. **Interactive User Deletion** - Confirmation modal with dual-delete modes

---

## Part 1: Testing Calendar Data Ingestion

### What Was Added
- **13 Staff Members** extracted directly from calendar PDFs
- **1 Job Role** (Guide) - no roles explicitly shown in PDFs
- **~140 Schedule Entries** spanning August, September, and early October
- **Reza/Raza Resolution** - Unified as "Reza" (same person, spelling variation)

### Where to Find the Data

```typescript
// src/utils/calendarDataIngestion.ts

export const CALENDAR_USERS = [/* 13 staff members */];
export const CALENDAR_JOB_ROLES = [/* 1 Guide role */];
export const AUGUST_SCHEDULES = [/* August 1-30 */];
export const SEPTEMBER_SCHEDULES = [/* Sept 1-30 + Oct 1-4 */];
```

### Local Testing Steps

#### Step 1: Start Dev Server
```bash
npm run dev
```
Server runs at: http://localhost:5173

#### Step 2: Seed Test Users (if needed)
Open browser console and run:
```javascript
// Seed basic test users (existing)
await seedTestUsers()
```

#### Step 3: Ingest Calendar Data
Open browser console and run:
```javascript
// Ingest all 13 staff members, job roles, and ~140 schedules
await ingestAllCalendarData()
```

**Expected Output:**
```
════════════════════════════════════════════════════════════════
INGESTING CALENDAR USERS FROM PDFs
════════════════════════════════════════════════════════════════
✓ Created: Desiree (desiree)
✓ Created: Nabeel (nabeel)
✓ Created: Umer (umer)
...
Users ingested: 13 created, 0 failed

[Job Roles Ingested]
Roles ingested: 1 created, 0 failed

[Schedules Ingested]
Schedules ingested: ~140 created, 0 failed
════════════════════════════════════════════════════════════════
✓ INGESTION COMPLETE
Total created: ~154
Total failed: 0
════════════════════════════════════════════════════════════════
```

#### Step 4: Verify Data Integrity
Open browser console and run:
```javascript
// Verify all data was ingested correctly
await verifyCalendarData()
```

**Expected Results:**
- ✓ All 13 users are active
- ✓ All schedules have date and staff fields
- ✓ All scheduled staff exist in users collection
- ✓ No orphaned schedules

#### Step 5: Verify Expected Counts
```javascript
// Verify exact counts from PDFs
await verifyExpectedCounts(
  13,    // Expected users
  1,     // Expected job roles
  90,    // Expected August schedules
  50+    // Expected September schedules
)
```

---

## Part 2: Testing Interactive User Deletion

### What Was Added
- **DeleteUserConfirmationModal.tsx** - New UI component with two clear options
- **deleteUserWithDataHandling()** - Service function for both hard & soft delete
- **Enhanced deletion in StaffManagement.tsx** - Integrated modal & new flow

### Deletion Modes Explained

#### 🗑️ Hard Delete (Permanent)
- Removes user account completely
- Deletes ALL associated data:
  - Leave requests
  - Role assignments
  - Check-ins
  - Tour assignments
  - Task assignments
- Cannot be undone
- Suitable for: Completely removing test/dummy users

#### 📦 Soft Delete (Archive)
- Marks user as `isActive = false`
- Retains all historical data
- Data hidden from all active queries/views
- Can be reviewed for compliance/auditing
- Suitable for: Keeping records but deactivating account

### Local Testing Steps

#### Step 1: Navigate to Staff Management
1. Log in as admin (username: `admin`, PIN: `1111`)
2. Go to Admin → Staff Management
3. You should see the 13 calendar users listed

#### Step 2: Test Soft Delete (Archive)
1. Click on a test user (e.g., "Rihab")
2. Click Actions menu (⋮) → Delete
3. **Confirmation Modal Should Appear** with two options:
   - 📦 Archive Account (selected by default)
   - 🗑️ Permanently Delete Everything
4. Click "Archive Account" button
5. **Verify Results:**
   - User disappears from main list (filtered out)
   - Check console for `[Data Integrity]` logs
   - Navigate away and back - user should still be gone

#### Step 3: Test Hard Delete
1. Click on another test user (e.g., "HB")
2. Click Actions menu (⋮) → Delete
3. Modal appears - click on "Permanently Delete Everything" radio option
4. Click "Delete Permanently" button
5. **Verify Results:**
   - User removed from list
   - Check console for cleanup logs:
     ```
     [AGGRESSIVE PURGE] Deleted X total: Y leave requests, Z role assignments...
     ```
   - Navigate away and back - user should not reappear

#### Step 4: Verify Data Filtering
After deletion, verify deleted users don't appear anywhere:

```javascript
// Check if deleted user is still in database (shouldn't be visible)
// Via Data Integrity verification
await verifyCalendarData()
```

Expected: No orphaned schedules or references to deleted users.

#### Step 5: Test Error Handling
Try edge cases:
- Delete a user with many schedules
- Refresh page mid-deletion (should handle gracefully)
- Check browser console for any error messages
- Verify audit logs were created

---

## Part 3: Full End-to-End Testing

### Scenario: Complete Calendar Setup

1. **Start Fresh**
   ```javascript
   // In console
   await seedTestUsers()          // Basic admin/staff
   await ingestAllCalendarData()  // Calendar from PDFs
   ```

2. **Verify Complete System**
   - Navigate to Calendar Page
   - Check that August/September schedules are visible
   - Verify staff names appear correctly
   - Check green dots/indicators for staffing

3. **Test Staff List Views**
   - Go to Manager Dashboard
   - Verify only staff are shown (no admins)
   - Check that scheduled staff for today are visible

4. **Test Deletion + Re-verify**
   - Delete a staff member using Soft Delete
   - Verify they no longer appear in any views
   - Re-run `verifyCalendarData()` - should pass

---

## Part 4: Checklist Before Pushing to Staging

### ✅ Data Ingestion
- [ ] `await ingestAllCalendarData()` runs without errors
- [ ] All 13 staff created successfully
- [ ] All ~140 schedules created successfully
- [ ] `await verifyCalendarData()` passes all checks
- [ ] No orphaned schedules detected

### ✅ User Deletion - Soft Mode
- [ ] Confirmation modal appears with two options
- [ ] Archive Account option is selectable
- [ ] User disappears from list after archive
- [ ] No errors in console during deletion
- [ ] User data still in database but filtered

### ✅ User Deletion - Hard Mode
- [ ] Permanently Delete option is selectable
- [ ] User completely removed after hard delete
- [ ] Console shows cleanup counts
- [ ] No errors during cascade delete
- [ ] All user records verified deleted

### ✅ Global Data Integrity
- [ ] Deleted users don't appear in:
  - [ ] Staff lists
  - [ ] Calendar views
  - [ ] Dashboard staffing counts
  - [ ] Request queues
- [ ] Active users still visible in all areas

### ✅ Audit Trails
- [ ] `user_deleted_hard` action logged for hard deletes
- [ ] `user_deleted_soft` action logged for soft deletes
- [ ] Audit log shows actor name, timestamp, details

### ✅ Browser Compatibility
- [ ] Works in Chrome/Edge
- [ ] Modal displays correctly
- [ ] All buttons clickable
- [ ] Console shows helpful debug info

### ✅ Error Handling
- [ ] Network errors handled gracefully
- [ ] Partial deletions don't corrupt state
- [ ] Error messages are user-friendly
- [ ] Can retry failed operations

---

## Commands Quick Reference

```javascript
// Data Ingestion
await seedTestUsers()                    // Basic test users
await ingestAllCalendarData()            // Calendar data from PDFs
await verifyCalendarData()               // Verify data integrity
await verifyExpectedCounts(13, 1, 90, 50) // Verify exact counts

// Manual Testing
// Use Admin → Staff Management UI to test deletion flows
```

---

## Troubleshooting

### "Permission Denied" Errors
- Ensure logged in as admin (super_admin role)
- Check Firebase security rules allow operations

### Data Not Showing
- Verify data was ingested: `await verifyCalendarData()`
- Check browser DevTools Network tab for API errors
- Refresh page to reload from database

### Deletion Failing
- Check console for detailed error messages
- Verify user exists: search in Staff Management
- Try soft delete first (simpler operation)

### Modal Not Appearing
- Hard refresh page (Ctrl+F5)
- Check that `DeleteUserConfirmationModal.tsx` is imported
- Verify no console errors preventing component render

---

## Next Steps

Once all testing is complete and verified:

1. Report testing results back to user
2. Get confirmation to push to staging
3. Create commit: `feat: Add PDF calendar data + enhanced deletion workflow`
4. Push to staging branch
5. Monitor staging deployment logs

---

## Important Notes

⚠️ **DO NOT PUSH YET**
- All changes are local only
- No commits have been made to git
- Staging branch is unchanged
- Production is unaffected

✅ **Ready to Push When:**
- All checklist items verified
- No console errors
- Deletion modal works on both modes
- Data integrity verified
- User confirms ready

---

Last Updated: 2026-09-21
Status: Local Testing Ready ✅
