# Department-Based Leave Limits - Implementation Setup

## 📋 Overview

This document outlines the **Department-Based Leave Limits** feature that restricts the maximum number of staff from taking leave on the same day per field/department.

**Status**: Infrastructure & Models Created ✅ | Ready for Integration

---

## 🏗️ What's Been Created

### 1. **DepartmentLeaveLimit Model** ✅
**File**: `src/models/departmentLeaveLimit.ts`

```typescript
interface DepartmentLeaveLimit {
  id: string;
  jobRoleId: string;         // Links to JobRole (department/field)
  jobRoleName?: string;      // Display name
  maxLeavePerDay: number;    // e.g., 2 (max 2 people can be off)
  enforcementLevel: 'HARD' | 'SOFT';  // HARD=block, SOFT=warn
  createdAt: string;
  updatedAt: string;
}
```

### 2. **Validation Service** ✅
**File**: `src/services/departmentLeaveLimitService.ts`

Provides three core functions:

#### `validateLeaveRequestAgainstDepartmentLimits()`
- Checks if a leave request exceeds department capacity
- Returns: `{ allowed, reason, currentLeaveCount, maxAllowed, spotsAvailable }`
- **Logic**: First-come, first-served (counts approved leaves)

#### `getDepartmentCoverageForDate()`
- Shows coverage status for all departments on a specific date
- Returns: available members, on-leave count, utilization %

#### `checkDepartmentCoverageWarning()`
- Warns if department falls below minimum coverage (e.g., < 50% remaining)
- Helps prevent over-staffing requests

---

## 📊 Current Departments/Fields (from Audit)

Run this in browser console to see current structure:

```javascript
import { auditAllDepartments } from './utils/departmentAudit';
import { useAppData } from './context/AppDataContext';

// Get from AppDataContext
const { jobRoles, users, roleAssignments } = useAppData();
const report = auditAllDepartments(jobRoles, users, roleAssignments);
console.table(report.departments);
```

Expected fields include:
- **Guide** - Tour guides
- **Check-in** - Customer check-in staff
- **Coordinator** - Operational coordinators
- (Other configured job roles)

---

## 🔄 Leave Request Flow with Limits

```
1. User submits leave request
   ↓
2. System validates:
   - Get user's primary role/department
   - Find configured limit for that department
   - Count approved leaves on that date in that department
   ↓
3. Check against limit:
   ✅ ALLOWED: Spots available (count < max)
   ❌ BLOCKED: At capacity (count >= max)
        Message: "Department has reached maximum leave capacity for DATE"
   ⚠️ WARNING: (If SOFT enforcement) Show warning but allow
   ↓
4. If allowed: Request submitted → Pending manager approval
   If blocked: Request rejected before submission
```

---

## 📍 Where Leave Requests Are Handled

| Component | File | Function |
|-----------|------|----------|
| **Client Submit** | `services/supabaseService.ts` | `insertLeaveRequest()` |
| **Client Approve** | `services/leaveService.ts` | `approveLeaveRequest()` |
| **Backend Submit** | Cloud Function | `submitLeaveRequest` |
| **Backend Approve** | Cloud Function | `decideLeaveRequest` |

**Integration Point**: Validation should be called in `insertLeaveRequest()` BEFORE submitting to backend.

---

## 🛠️ Next Steps to Complete Implementation

### Phase 1: Backend Setup (Database)
```sql
-- Supabase SQL (to be executed)
CREATE TABLE department_leave_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_id UUID NOT NULL REFERENCES job_roles(id),
  max_leave_per_day INT NOT NULL DEFAULT 2,
  enforcement_level TEXT NOT NULL DEFAULT 'HARD',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX idx_dept_limits_role ON department_leave_limits(job_role_id);
```

### Phase 2: Service Integration
```typescript
// In supabaseService.ts, wrap insertLeaveRequest():
import { validateLeaveRequestAgainstDepartmentLimits } from './departmentLeaveLimitService';

export async function insertLeaveRequest(data: {
  // ... existing params
}) {
  // 1. Validate against department limits
  const validation = validateLeaveRequestAgainstDepartmentLimits(
    data.userId,
    data.date,
    roleAssignments,  // Get from AppData
    leaveRequests,    // Get from AppData
    departmentLimits  // Fetch from Supabase
  );

  if (!validation.allowed) {
    throw new Error(validation.reason);
  }

  // 2. Proceed with normal submission
  // ... existing code
}
```

### Phase 3: UI Updates
Add validation feedback when user selects a date:
- Show red warning if date is locked
- Disable submit button
- Display: "2/2 people already approved for leave on this date"
- Suggest alternative dates

### Phase 4: Admin Panel
Create settings page to manage limits:
- List all departments
- Show current member count
- Set max leave per day
- Choose HARD (block) vs SOFT (warn)

---

## 🎯 Design Decisions

### Why Primary Role Only?
- Staff may have multiple roles, but only primary is "home department"
- Reduces complexity and prevents loopholes

### Why First-Come, First-Served?
- Fair, transparent, encourages early planning
- No need for complex approval logic

### Why Two Enforcement Levels?

**HARD** (Block):
- ✅ Prevents scheduling conflicts
- ❌ Rigid, may frustrate staff

**SOFT** (Warn):
- ✅ Flexible, allows exceptions with awareness
- ⚠️ Managers may ignore warnings

**Recommendation**: Start with HARD, adjust based on feedback

### Why Different Limits Per Department?
- Tour guides might allow 2 off, office staff might allow 5
- Some departments are more critical than others

---

## 📈 Example Scenarios

### Scenario 1: Guide Department (max = 2)
```
Date: 2026-09-20

Approved Leaves:
- Desiree: OFF ✓
- Nabeel: OFF ✓
← Limit Reached (2/2)

New Request from Michael:
→ BLOCKED: "Department at capacity"
```

### Scenario 2: Coordinator Department (max = 5)
```
Date: 2026-09-20

Approved Leaves:
- Alice: OFF
- Bob: OFF
- Charlie: OFF
← 3/5 Used (60% capacity)

New Request from Diana:
→ ALLOWED: "1 spots available in Coordinator department"
```

---

## 🔍 Monitoring & Reporting

Once implemented, can generate:
- **Daily Coverage Report**: Who's off per department
- **Capacity Alerts**: Departments at/over capacity
- **Trend Analysis**: Which days are most requested
- **Staff Planning**: Suggest ideal leave distribution

---

## 🚀 Implementation Timeline

| Phase | Task | Est. Time |
|-------|------|-----------|
| 1 | DB setup + migration | 30 min |
| 2 | Service integration | 45 min |
| 3 | UI updates | 1 hour |
| 4 | Admin panel | 1 hour |
| 5 | Testing + refinement | 1 hour |

**Total**: ~4 hours for complete implementation

---

## ✅ Quality Checklist

- [ ] All departments have limits configured
- [ ] Validation tested with various scenarios
- [ ] UI shows clear feedback when locked
- [ ] Managers can override limits if needed
- [ ] Reports show coverage status
- [ ] Staff can see available dates when limit hit
- [ ] Admin can adjust limits without downtime

---

## 📝 Notes

- **No Data Migration**: This is a new feature, existing leaves unaffected
- **Backward Compatible**: Works with existing leave request system
- **Flexible**: Limits can be disabled (set high) per department
- **Audit Trail**: Use existing audit tables for approval tracking
