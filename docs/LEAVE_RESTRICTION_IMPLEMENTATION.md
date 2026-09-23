# Department-wise Leave Restriction Implementation Guide

## Executive Summary

✅ **YES, we can implement department-wise leave restrictions.** This is fully achievable within the current architecture.

---

## 1. CURRENT LEAVE REQUEST HANDLING

### Primary Files
- **Service**: `src/services/leaveService.ts` - Basic leave request logic
- **Context**: `src/context/LeaveContext.tsx` - Main leave state management & submission
- **Firestore Service**: `src/services/firestoreService.ts` - Database operations
- **Validation**: `src/services/staffingCheckOnSubmit.ts` - Pre-submission validation (existing)
- **Model**: `src/models/leave.ts` - LeaveRequest interface

### Current Validation Flow
When a user submits a leave request:

```
LeaveContext.submitRequest()
  ↓
1. Check date validity & future date
2. Check if user already has request for this date
3. Check if it's first Sunday (auto-assigned)
4. Calculate leave balance (regular/vacation days remaining)
5. Check minimum staffing rules via `checkStaffingBeforeSubmit()`
  ├─ Gets user's job role assignments
  ├─ Checks if leave would cause shortage for those roles
  └─ Returns error if minimum staffing not met
6. Submit to Firestore
```

**⚠️ CURRENT GAP**: No maximum limit check per department/field.

---

## 2. DATA MODEL: FIELDS/DEPARTMENTS

### Current Structure in Database

The system uses **Job Roles** as fields/departments:

#### Table: `job_roles`
```sql
- id (string, PK)
- name (string) — e.g., "Guide", "Receptionist", "Driver"
- color (string) — UI display color
- is_hidden (boolean) — whether this role is shown in UI
- shift_start (string) — start time
- shift_end (string) — end time
- created_at (timestamp)
- updated_at (timestamp)
```

#### Table: `staff_role_assignments`
```sql
- id (string, PK)
- user_id (string, FK to users)
- job_role_id (string, FK to job_roles)
- is_primary (boolean) — whether this is user's primary role
- assigned_at (timestamp)
```

#### Table: `users`
```sql
- id (string, PK)
- username (string)
- display_name (string)
- pin_hash (string)
- role (enum: staff | manager | super_admin)
- is_active (boolean)
- job_role (string[]) — array like ["Guide", "Receptionist"] (deprecated, moving to staff_role_assignments)
- ...other fields
```

---

## 3. HOW TO AUDIT CURRENT FIELDS/DEPARTMENTS

### Data Access Points

#### Via UI
1. Go to **Settings → Manage Job Roles**
2. You'll see all configured fields with member counts

#### Via Code - Run this query
```typescript
// In your browser console after app loads, with AppDataContext:
import { useAppData } from './context/AppDataContext';

const { jobRoles, roleAssignments, users } = useAppData();

// Count members per role
const roleStats = jobRoles.map(role => {
  const memberIds = new Set(
    roleAssignments
      .filter(a => a.jobRoleId === role.id)
      .map(a => a.userId)
  );
  const members = users.filter(u => memberIds.has(u.id));
  return {
    roleId: role.id,
    roleName: role.name,
    totalMembers: memberIds.size,
    members: members.map(m => ({ id: m.id, name: m.displayName })),
    isEmpty: memberIds.size === 0,
  };
});

console.table(roleStats);
```

#### SQL Query (Direct Database Access)
```sql
SELECT 
  jr.id,
  jr.name AS field_name,
  COUNT(DISTINCT sra.user_id) AS total_members,
  ARRAY_AGG(u.display_name) AS member_names,
  CASE WHEN COUNT(DISTINCT sra.user_id) = 0 THEN 'EMPTY' ELSE 'HAS_MEMBERS' END AS status
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name
ORDER BY jr.name;
```

---

## 4. IMPLEMENTATION STRATEGY

### Proposed Solution: "Department Leave Cap"

#### 4.1 New Data Model

Add a new `leave_restrictions` table:

```sql
CREATE TABLE leave_restrictions (
  id TEXT PRIMARY KEY,
  job_role_id TEXT NOT NULL UNIQUE,
  max_concurrent_leaves INT NOT NULL DEFAULT 1,
  enforcement_level ENUM ('soft_warning', 'hard_block') NOT NULL DEFAULT 'hard_block',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (job_role_id) REFERENCES job_roles(id)
);
```

**Example Data**:
```
job_role_id: "guide_001"
max_concurrent_leaves: 2      ← Max 2 guides can take leave same day
enforcement_level: "hard_block" ← Automatically prevent 3rd person
```

#### 4.2 TypeScript Models

Create `src/models/leaveRestriction.ts`:

```typescript
export interface LeaveRestriction {
  id: string;
  jobRoleId: string;
  maxConcurrentLeaves: number;
  enforcementLevel: 'soft_warning' | 'hard_block';
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRestrictionStatus {
  jobRoleId: string;
  jobRoleName: string;
  maxAllowed: number;
  currentlyApproved: number; // count of approved leaves for this date
  spotsRemaining: number;
  canRequest: boolean;
  reason?: string;
}
```

#### 4.3 Service Layer

Create `src/services/leaveRestrictionService.ts`:

```typescript
import type { LeaveRequest } from '../models/leave';
import type { LeaveRestriction, LeaveRestrictionStatus } from '../models/leaveRestriction';
import type { StaffRoleAssignment } from '../models/jobRole';

export function checkLeaveRestrictionForDate(
  userId: string,
  date: string,
  userRoleAssignments: StaffRoleAssignment[], // all roles for this user
  approvedRequests: LeaveRequest[],  // all approved leaves
  leaveRestrictions: LeaveRestriction[],
  roleAssignments: StaffRoleAssignment[], // all role assignments in system
): LeaveRestrictionStatus[] {
  
  // Find all job roles user is assigned to
  const userJobRoleIds = userRoleAssignments.map(a => a.jobRoleId);
  
  const statuses: LeaveRestrictionStatus[] = [];
  
  for (const restriction of leaveRestrictions) {
    if (!userJobRoleIds.includes(restriction.jobRoleId)) {
      continue; // User not in this role, skip
    }
    
    // Count how many users in this job role already have approved leave on this date
    const leaveCountForRole = approvedRequests
      .filter(r => r.date === date && r.status === 'approved')
      .filter(r => {
        const userHasRole = roleAssignments
          .filter(a => a.userId === r.userId)
          .some(a => a.jobRoleId === restriction.jobRoleId);
        return userHasRole;
      })
      .length;
    
    const spotsRemaining = restriction.maxConcurrentLeaves - leaveCountForRole;
    const canRequest = spotsRemaining > 0;
    
    statuses.push({
      jobRoleId: restriction.jobRoleId,
      jobRoleName: '', // will be filled by caller
      maxAllowed: restriction.maxConcurrentLeaves,
      currentlyApproved: leaveCountForRole,
      spotsRemaining,
      canRequest,
      reason: !canRequest 
        ? `Maximum ${restriction.maxConcurrentLeaves} staff can take leave from this department on ${date}` 
        : undefined,
    });
  }
  
  return statuses;
}
```

#### 4.4 Integration into LeaveContext

Modify `src/context/LeaveContext.tsx`:

```typescript
import { checkLeaveRestrictionForDate } from '../services/leaveRestrictionService';

export function LeaveProvider({ children }: { children: ReactNode }) {
  const { users, staffingRules, roleAssignments, jobRoles, leaveRestrictions } = useAppData();
  // ... existing code ...
  
  const submitRequest = useCallback(async (
    userId: string, userRef: UserRef, date: string, leaveType: LeaveType, note: string = '', autoApprove: boolean = false,
  ): Promise<string | null> => {
    // ... existing validation (date, balance, etc.) ...
    
    // NEW: Check leave restrictions
    const userRoleAssignments = roleAssignments.filter(a => a.userId === userId);
    const restrictionStatuses = checkLeaveRestrictionForDate(
      userId,
      date,
      userRoleAssignments,
      requests.filter(r => r.status === 'approved'),
      leaveRestrictions,
      roleAssignments,
    );
    
    const blockedRestrictions = restrictionStatuses.filter(s => !s.canRequest && s.reason);
    if (blockedRestrictions.length > 0) {
      return blockedRestrictions[0].reason; // Return first restriction error
    }
    
    // Continue with existing submission logic...
  }, [requests, users, staffingRules, roleAssignments, jobRoles, leaveRestrictions]);
}
```

#### 4.5 UI Features

**Option A: Pre-submission Warning (Soft Block)**
```typescript
// Show available spots before user submits
const restrictionStatus = checkLeaveRestrictionForDate(...);

if (restrictionStatus.spotsRemaining <= 1) {
  showWarning(`Only ${restrictionStatus.spotsRemaining} spot(s) remaining for this date in ${jobRoleName}`);
}
```

**Option B: Hide/Disable Leave Option (Hard Block)**
```typescript
// In date picker component
const isDateLocked = restrictionStatuses.some(s => !s.canRequest);

<CalendarDay 
  date={date}
  disabled={isDateLocked}
  tooltip={isDateLocked ? "Leave limit reached for your department" : undefined}
/>
```

**Option C: Admin Management Panel**
```typescript
// Create UI at Settings → Leave Restrictions
// Show for each job role:
// - Max concurrent leaves (input field)
// - Current count on selected date (read-only)
// - Enforcement level (dropdown: soft_warning / hard_block)
```

---

## 5. IMPLEMENTATION PHASES

### Phase 1: Database & Backend (1-2 hours)
1. ✅ Create `leave_restrictions` table in Supabase
2. ✅ Create `leaveRestrictionService.ts`
3. ✅ Add service functions to `supabaseService.ts`
4. ✅ Add `leaveRestrictions` state to `AppDataContext`

### Phase 2: Leave Submission Logic (1-2 hours)
1. ✅ Integrate restriction check into `LeaveContext.submitRequest()`
2. ✅ Return clear error messages
3. ✅ Test with FCFS scenario (first 2 succeed, 3rd fails)

### Phase 3: UI - Staff Side (2-3 hours)
1. ✅ Show warning in calendar when spots are limited
2. ✅ Disable/dim dates when at capacity
3. ✅ Show "X spots remaining" tooltip

### Phase 4: UI - Admin Side (2-3 hours)
1. ✅ Settings page to configure max limits per role
2. ✅ View current leave count for any date
3. ✅ Set enforcement level (warning vs. hard block)

### Phase 5: Testing & Edge Cases (2 hours)
1. ✅ Test FCFS behavior (multiple concurrent submissions)
2. ✅ Test with primary + secondary roles
3. ✅ Test special days & auto-assigned Sundays
4. ✅ Test override by super_admin (should always work)

---

## 6. KEY QUESTIONS TO CLARIFY

Before implementation, please confirm:

1. **Enforcement Model**: 
   - Hard block (prevent submission)? OR
   - Soft warning (show warning, allow override by manager)?

2. **Role Scope**:
   - Count only users' primary role? OR
   - Count all assigned roles?

3. **Leave Types**:
   - Apply to all leave types (vacation + day_off)? OR
   - Only specific types?

4. **Special Cases**:
   - Should `auto_sunday` (first Sunday) bypass the limit?
   - Should super_admin overrides bypass the limit?
   - Should approved-then-cancelled still count toward limit?

5. **Default Limits**:
   - What should the default max be per department?
   - Different limits for different departments?

---

## 7. CURRENT LEAVE REQUEST FLOW DIAGRAM

```
User submits leave request
         ↓
LeaveContext.submitRequest()
         ↓
├─ Validate date (ISO format, future date)
├─ Check duplicate (same user, same date)
├─ Check first Sunday (auto-assigned, skip)
├─ Calculate balance
│  ├─ Get user's cycle dates
│  ├─ Count approved leaves in cycle
│  └─ Check if days remaining > 0
├─ Check minimum staffing rules
│  ├─ Get user's job roles
│  ├─ Simulate leave for those roles
│  └─ Return error if shortage
│
├─ [NEW] Check leave restrictions ← INSERTION POINT
│  ├─ Get user's job roles
│  ├─ Count currently approved leaves for date
│  └─ Return error if at max capacity
│
├─ Insert to Firestore
├─ Update local state
└─ Log audit entry
         ↓
Success ✓ or Error ✗
```

---

## 8. FILES TO CREATE/MODIFY

| File | Action | Purpose |
|------|--------|---------|
| `src/models/leaveRestriction.ts` | Create | New data types |
| `src/services/leaveRestrictionService.ts` | Create | Validation logic |
| `src/services/supabaseService.ts` | Modify | Add fetch/update/insert functions |
| `src/context/AppDataContext.tsx` | Modify | Add leaveRestrictions state |
| `src/context/LeaveContext.tsx` | Modify | Add restriction check in submitRequest |
| `src/components/LeaveRestrictionAdmin.tsx` | Create | Admin UI for config |
| `src/components/LeaveCalendarWithLocks.tsx` | Create/Modify | Calendar with lock indicators |

---

## 9. TESTING CHECKLIST

- [ ] User A requests leave for date X → Success (1/2 spots used)
- [ ] User B (same department) requests same date → Success (2/2 spots used)
- [ ] User C (same department) requests same date → Error with clear message
- [ ] User D (different department) requests same date → Success (no restriction)
- [ ] After User A cancels → User C can now request
- [ ] Manager override allows 3rd person despite limit
- [ ] Super admin can always bypass restrictions
- [ ] Restriction counts only APPROVED leaves, not pending
- [ ] UI shows "2/2 spots filled" or "1 spot remaining"

---

## 10. AUDIT QUERY TEMPLATE

To see your current department setup, run this in your admin panel:

```typescript
async function auditDepartments() {
  const { jobRoles, users, roleAssignments } = useAppData();
  
  const report = jobRoles.map(role => {
    const assignedUsers = roleAssignments
      .filter(a => a.jobRoleId === role.id)
      .map(a => users.find(u => u.id === a.userId))
      .filter(Boolean);
    
    return {
      department: role.name,
      totalMembers: assignedUsers.length,
      members: assignedUsers.map(u => u.displayName),
      hasMembers: assignedUsers.length > 0,
      status: assignedUsers.length === 0 ? 'EMPTY ⚠️' : 'ACTIVE ✓',
    };
  });
  
  return report;
}
```

---

## Conclusion

✅ **Implementation is feasible and straightforward.**

The system already has:
- Role-based staffing checks ✓
- Leave request validation pipeline ✓
- Context-based state management ✓
- Firestore/Supabase integration ✓

What's missing:
- Maximum concurrent leave limit per department
- UI indicators for department capacity

Would you like me to proceed with **Phase 1** (database setup) or do you have questions about the approach?
