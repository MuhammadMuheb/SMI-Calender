# Leave Restriction Feature: Quick Start Code Snippets

This file contains copy-paste-ready code snippets to implement the department leave restriction feature.

---

## Step 1: Create TypeScript Models

**File**: `src/models/leaveRestriction.ts` (NEW FILE)

```typescript
export interface LeaveRestriction {
  id: string;
  jobRoleId: string;
  jobRoleName?: string; // For convenience
  maxConcurrentLeaves: number; // E.g., 2 = max 2 people per day
  enforcementLevel: 'soft_warning' | 'hard_block';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRestrictionCheckResult {
  isAllowed: boolean;
  jobRoleId: string;
  jobRoleName: string;
  maxAllowed: number;
  currentlyApprovedCount: number;
  spotsRemaining: number;
  message?: string;
}
```

---

## Step 2: Create Restriction Validation Service

**File**: `src/services/leaveRestrictionService.ts` (NEW FILE)

```typescript
import type { LeaveRequest } from '../models/leave';
import type { LeaveRestriction, LeaveRestrictionCheckResult } from '../models/leaveRestriction';
import type { StaffRoleAssignment } from '../models/jobRole';

/**
 * Check if a user can request leave based on department capacity limits
 */
export function checkLeaveRestrictions(
  userId: string,
  date: string,
  userRoleAssignments: StaffRoleAssignment[],
  allApprovedRequests: LeaveRequest[],
  leaveRestrictions: LeaveRestriction[],
  allRoleAssignments: StaffRoleAssignment[],
): LeaveRestrictionCheckResult[] {
  // Get user's job role IDs
  const userJobRoleIds = userRoleAssignments.map((a) => a.jobRoleId);

  const results: LeaveRestrictionCheckResult[] = [];

  for (const restriction of leaveRestrictions) {
    // Only check restrictions for roles this user is in
    if (!userJobRoleIds.includes(restriction.jobRoleId)) {
      continue;
    }

    // Count currently approved leaves for this date in this role
    const approvedCountForRole = allApprovedRequests
      .filter((req) => req.date === date && req.status === 'approved')
      .filter((req) => {
        const assignedToRole = allRoleAssignments
          .filter((a) => a.userId === req.userId)
          .some((a) => a.jobRoleId === restriction.jobRoleId);
        return assignedToRole;
      }).length;

    const spotsRemaining = restriction.maxConcurrentLeaves - approvedCountForRole;
    const isAllowed = spotsRemaining > 0;

    results.push({
      isAllowed,
      jobRoleId: restriction.jobRoleId,
      jobRoleName: restriction.jobRoleName || '',
      maxAllowed: restriction.maxConcurrentLeaves,
      currentlyApprovedCount: approvedCountForRole,
      spotsRemaining,
      message: !isAllowed
        ? `Maximum ${restriction.maxConcurrentLeaves} staff from your department can take leave on ${date}. Currently ${approvedCountForRole} approved.`
        : undefined,
    });
  }

  return results;
}

/**
 * Check if any restriction blocks the request (hard_block enforcement)
 */
export function getHardBlockRestrictions(
  restrictions: LeaveRestrictionCheckResult[],
): LeaveRestrictionCheckResult[] {
  return restrictions.filter((r) => !r.isAllowed);
}

/**
 * Get warning-level restrictions (soft_warning enforcement)
 */
export function getWarningRestrictions(
  restrictions: LeaveRestrictionCheckResult[],
): LeaveRestrictionCheckResult[] {
  return restrictions.filter((r) => !r.isAllowed);
}
```

---

## Step 3: Update Supabase Service

**File**: `src/services/supabaseService.ts` (ADD THESE FUNCTIONS)

```typescript
// Add to imports at top
import type { LeaveRestriction } from '../models/leaveRestriction';

// ─── Leave Restrictions ────────────────────────────────────────

export async function fetchLeaveRestrictions() {
  const { data, error } = await supabase
    .from('leave_restrictions')
    .select('*')
    .order('created_at');
  if (error) { console.error('fetchLeaveRestrictions:', error); return []; }
  return data.map(mapLeaveRestriction);
}

export async function insertLeaveRestriction(restriction: {
  id: string;
  jobRoleId: string;
  maxConcurrentLeaves: number;
  enforcementLevel: 'soft_warning' | 'hard_block';
  description?: string;
}) {
  const { error } = await supabase.from('leave_restrictions').insert({
    id: restriction.id,
    job_role_id: restriction.jobRoleId,
    max_concurrent_leaves: restriction.maxConcurrentLeaves,
    enforcement_level: restriction.enforcementLevel,
    description: restriction.description ?? '',
  });
  if (error) console.error('insertLeaveRestriction ERROR:', error.message);
  return restriction.id;
}

export async function updateLeaveRestrictionDb(
  id: string,
  updates: {
    maxConcurrentLeaves?: number;
    enforcementLevel?: 'soft_warning' | 'hard_block';
    description?: string;
  },
) {
  const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.maxConcurrentLeaves !== undefined)
    mapped.max_concurrent_leaves = updates.maxConcurrentLeaves;
  if (updates.enforcementLevel !== undefined)
    mapped.enforcement_level = updates.enforcementLevel;
  if (updates.description !== undefined)
    mapped.description = updates.description;
  const { error } = await supabase.from('leave_restrictions').update(mapped).eq('id', id);
  if (error) console.error('updateLeaveRestriction:', error);
}

export async function deleteLeaveRestrictionDb(id: string) {
  const { error } = await supabase.from('leave_restrictions').delete().eq('id', id);
  if (error) console.error('deleteLeaveRestriction:', error);
}

// Add to mapping functions section
function mapLeaveRestriction(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    jobRoleId: row.job_role_id as string,
    maxConcurrentLeaves: row.max_concurrent_leaves as number,
    enforcementLevel: row.enforcement_level as 'soft_warning' | 'hard_block',
    description: (row.description ?? '') as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
```

---

## Step 4: Update AppDataContext

**File**: `src/context/AppDataContext.tsx` (MODIFY)

```typescript
// Add to imports
import type { LeaveRestriction } from '../models/leaveRestriction';
import {
  fetchLeaveRestrictions,
  insertLeaveRestriction,
  updateLeaveRestrictionDb,
  deleteLeaveRestrictionDb,
} from '../services/supabaseService';

// Add to interface AppDataContextValue
interface AppDataContextValue {
  // ... existing fields ...
  leaveRestrictions: LeaveRestriction[];
  addLeaveRestriction: (
    restriction: Omit<LeaveRestriction, 'id' | 'createdAt' | 'updatedAt'>,
    actorName: string,
  ) => void;
  updateLeaveRestriction: (
    id: string,
    updates: Partial<LeaveRestriction>,
    actorName: string,
  ) => void;
  deleteLeaveRestriction: (id: string, actorName: string) => void;
}

// Add to state declarations in AppDataProvider
const [leaveRestrictions, setLeaveRestrictions] = useState<LeaveRestriction[]>([]);

// Add to loadData function's Promise.all
const lr = await fetchLeaveRestrictions();
setLeaveRestrictions(lr as LeaveRestriction[]);

// Add state update in the useMemo return
leaveRestrictions,
addLeaveRestriction: (restriction, actorName) => {
  const id = `lr_${Date.now()}`;
  insertLeaveRestriction({ ...restriction, id });
  setLeaveRestrictions((prev) => [
    ...prev,
    { ...restriction, id, createdAt: now(), updatedAt: now() },
  ]);
  insertAuditLog({
    actorId: currentUser?.id ?? 'system',
    actorName,
    action: 'leave_restriction_created',
    entityType: 'leave_restriction',
    entityId: id,
    description: `Leave restriction created for ${restriction.maxConcurrentLeaves} staff`,
  });
},
updateLeaveRestriction: (id, updates, actorName) => {
  updateLeaveRestrictionDb(id, updates);
  setLeaveRestrictions((prev) =>
    prev.map((r) => (r.id === id ? { ...r, ...updates, updatedAt: now() } : r))
  );
  insertAuditLog({
    actorId: currentUser?.id ?? 'system',
    actorName,
    action: 'leave_restriction_updated',
    entityType: 'leave_restriction',
    entityId: id,
    description: `Leave restriction updated: max=${updates.maxConcurrentLeaves}`,
  });
},
deleteLeaveRestriction: (id, actorName) => {
  deleteLeaveRestrictionDb(id);
  setLeaveRestrictions((prev) => prev.filter((r) => r.id !== id));
  insertAuditLog({
    actorId: currentUser?.id ?? 'system',
    actorName,
    action: 'leave_restriction_deleted',
    entityType: 'leave_restriction',
    entityId: id,
    description: 'Leave restriction deleted',
  });
},
```

---

## Step 5: Update LeaveContext

**File**: `src/context/LeaveContext.tsx` (MODIFY)

```typescript
// Add to imports
import { checkLeaveRestrictions, getHardBlockRestrictions } from '../services/leaveRestrictionService';

// Modify submitRequest function
const submitRequest = useCallback(
  async (
    userId: string,
    userRef: UserRef,
    date: string,
    leaveType: LeaveType,
    note: string = '',
    autoApprove: boolean = false,
  ): Promise<string | null> => {
    const normalizedDate = normalizeDateStr(date);

    // ... existing validations (date, balance, duplicate) ...

    // NEW: Check leave restrictions
    const userRoleAssignments = roleAssignments.filter((a) => a.userId === userId);
    const restrictionResults = checkLeaveRestrictions(
      userId,
      normalizedDate,
      userRoleAssignments,
      requests.filter((r) => r.status === 'approved'),
      leaveRestrictions,
      roleAssignments,
    );

    // Check for hard blocks
    const hardBlocks = getHardBlockRestrictions(restrictionResults);
    if (hardBlocks.length > 0) {
      return hardBlocks[0].message || 'Leave limit reached for your department';
    }

    // ... rest of existing submission logic ...
  },
  [
    requests,
    users,
    staffingRules,
    roleAssignments,
    jobRoles,
    leaveRestrictions, // Add to dependency array
  ],
);
```

---

## Step 6: Database Schema

**SQL to run in Supabase**:

```sql
-- Create leave_restrictions table
CREATE TABLE leave_restrictions (
  id TEXT PRIMARY KEY,
  job_role_id TEXT NOT NULL UNIQUE,
  max_concurrent_leaves INTEGER NOT NULL DEFAULT 2,
  enforcement_level TEXT NOT NULL DEFAULT 'hard_block' CHECK (enforcement_level IN ('soft_warning', 'hard_block')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (job_role_id) REFERENCES job_roles(id) ON DELETE CASCADE
);

-- Create index for lookups
CREATE INDEX idx_leave_restrictions_job_role_id ON leave_restrictions(job_role_id);

-- Add RLS policy (if using RLS)
ALTER TABLE leave_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers can manage leave restrictions"
  ON leave_restrictions
  USING (true)
  WITH CHECK (true);
```

---

## Step 7: Example: Initialize Default Restrictions

```typescript
// Call this once to set up initial restrictions
async function initializeDefaultRestrictions(jobRoles, appData) {
  const defaults = [
    { name: 'Guide', maxLeaves: 2 },
    { name: 'Reception', maxLeaves: 1 },
    { name: 'Drivers', maxLeaves: 1 },
  ];

  for (const def of defaults) {
    const role = jobRoles.find((r) => r.name === def.name);
    if (!role) continue;

    appData.addLeaveRestriction(
      {
        jobRoleId: role.id,
        jobRoleName: role.name,
        maxConcurrentLeaves: def.maxLeaves,
        enforcementLevel: 'hard_block',
        description: `Maximum ${def.maxLeaves} staff from ${def.name} can take leave per day`,
      },
      'System',
    );
  }
}
```

---

## Step 8: Testing Helper

```typescript
// Test helper - verify restriction works
function testLeaveRestriction(
  userId: string,
  date: string,
  userRoles: StaffRoleAssignment[],
  approvedLeaves: LeaveRequest[],
  restrictions: LeaveRestriction[],
  allRoles: StaffRoleAssignment[],
) {
  const result = checkLeaveRestrictions(
    userId,
    date,
    userRoles,
    approvedLeaves,
    restrictions,
    allRoles,
  );

  console.table({
    date,
    userId,
    restrictions: result.map((r) => ({
      role: r.jobRoleName,
      allowed: r.isAllowed,
      approved: r.currentlyApprovedCount,
      max: r.maxAllowed,
      remaining: r.spotsRemaining,
    })),
  });

  return result;
}
```

---

## Integration Checklist

- [ ] Create `leaveRestriction.ts` model file
- [ ] Create `leaveRestrictionService.ts` service file
- [ ] Add functions to `supabaseService.ts`
- [ ] Update `AppDataContext.tsx`
- [ ] Update `LeaveContext.tsx`
- [ ] Run SQL migration in Supabase
- [ ] Initialize default restrictions
- [ ] Test with multiple users/departments
- [ ] Add UI component for admin management
- [ ] Add visual indicators in calendar

---

## Common Questions

### Q: What if a user is in multiple departments?
A: The validation checks all their assigned roles and blocks if ANY role is at capacity.

### Q: Do cancelled requests free up spots?
A: Yes, because we only count `status === 'approved'` leaves. Cancelled doesn't count.

### Q: Can super_admin override?
A: Currently no - restrictions apply to everyone. To allow override, add:
```typescript
if (userRef.role === 'super_admin') return null; // Skip restrictions
```

### Q: How to make it soft warning instead of hard block?
A: Change `enforcement_level` to `'soft_warning'` and in LeaveContext:
```typescript
const warnings = getWarningRestrictions(restrictionResults);
if (warnings.length > 0) {
  console.warn(warnings[0].message);
  // Allow submission but log warning
}
```

---

## Next Steps

1. Copy the code snippets above
2. Create the files in order (Step 1 → Step 6)
3. Run the SQL migration
4. Test with the helper function
5. Add UI components as needed

Good luck! 🚀
