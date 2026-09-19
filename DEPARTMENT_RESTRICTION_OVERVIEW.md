# Department-wise Leave Restriction Feature - Complete Overview

## 🎯 Executive Summary

**Can we implement department-wise leave restrictions?** ✅ **YES, absolutely.**

This document summarizes:
1. ✅ Confirmation that the feature is feasible
2. 📊 How to audit current departments and members
3. 🏗️ Where leave requests are handled in the codebase
4. 🚀 Step-by-step implementation guide

---

## 📚 Documentation Provided

I've created 4 comprehensive documents for you:

| Document | Purpose | Audience |
|----------|---------|----------|
| **`LEAVE_RESTRICTION_IMPLEMENTATION.md`** | Complete architecture, design, and 5-phase implementation plan | Technical leads, architects |
| **`IMPLEMENTATION_QUICK_START.md`** | Copy-paste code snippets ready to use | Developers implementing the feature |
| **`AUDIT_AND_IMPLEMENTATION_SUMMARY.md`** | Summary with roadmap and next steps | Project managers, decision makers |
| **`DEPARTMENT_RESTRICTION_OVERVIEW.md`** | This file - quick reference | Everyone |

---

## 🎬 Getting Started in 3 Steps

### Step 1: Run the Audit (5 minutes)

**Option A: Via UI Component** (Easiest)
```jsx
import { DepartmentAuditPanel } from './src/components/DepartmentAuditPanel';

// Add to Settings page:
<DepartmentAuditPanel />
// Click "Generate Audit Report" - instant results
```

**Option B: Via Utility Function** (For developers)
```typescript
import { auditAllDepartments, printAuditToConsole } from './src/utils/departmentAudit';

const { jobRoles, users, roleAssignments } = useAppData();
const summary = auditAllDepartments(jobRoles, users, roleAssignments);
printAuditToConsole(summary); // Formatted output in console
```

**What you'll see:**
```
✓ Total departments: 6
✓ Departments with members: 4
⚠️ Empty departments: 2
✓ Total staff: 9
✓ Cross-functional staff: 2
```

### Step 2: Review the Implementation Guide (20 minutes)

Read: `LEAVE_RESTRICTION_IMPLEMENTATION.md`
- Understand the architecture
- See the database schema
- Review the validation flow

### Step 3: Choose Your Implementation Path (Depends on your timeline)

**Fast Path (1-2 weeks)**
- Implement basic hard-block restriction
- No UI admin panel
- Use defaults

**Full Path (2-3 weeks)**
- Complete implementation with UI
- Admin management panel
- Soft warnings + hard blocks

---

## 🏗️ How Leave Requests Are Handled

### Current Validation Flow

When a user submits a leave request:

```
User submits request
        ↓
1. Validate date (must be future date)
2. Check no duplicate for same day
3. Check balance (days remaining)
4. Check minimum staffing rules
5. ← INSERT NEW: Check department limits
6. Save to database
7. Log audit entry
        ↓
Success or Error
```

### Key Files

| File | Role | Key Function |
|------|------|--------------|
| `src/context/LeaveContext.tsx` | Main orchestration | `submitRequest()` - line ~71 |
| `src/services/staffingCheckOnSubmit.ts` | Pre-submission validation | Similar to what we need |
| `src/services/firestoreService.ts` | Database operations | `insertLeaveRequest()` |
| `src/models/leave.ts` | Data structure | `LeaveRequest` interface |

### Integration Point

You'll add the restriction check in `LeaveContext.submitRequest()` right after the balance check:

```typescript
// NEW CODE INSERTION POINT (in submitRequest around line 99):
const restrictionCheck = checkLeaveRestrictions(
  userId,
  date,
  userRoleAssignments,
  approvedRequests,
  leaveRestrictions,
  roleAssignments,
);

if (!restrictionCheck.isAllowed) {
  return restrictionCheck.message; // "Cannot request - 2 guides already off"
}
```

---

## 🔍 Auditing Your Departments

### What the Audit Shows

```
Department          | Members | Status      | Details
─────────────────────────────────────────────────────
Guide Team          | 3       | ✓ ACTIVE    | All primary
Reception          | 2       | ✓ ACTIVE    | 1 primary
Drivers            | 1       | ⚠️ LOW      | Single point of failure
Admin              | 0       | ⚠️ EMPTY    | No one assigned
IT Support         | 3       | ✓ ACTIVE    | 1 cross-functional
Archive            | 0       | ⚠️ EMPTY    | No one assigned
```

### How to Use Audit Results

1. **Empty departments** - Consider if they're needed
2. **Single-member departments** - May need max=0 restrictions
3. **Cross-functional staff** - May want to restrict more carefully
4. **Full departments** - Can set higher limits

---

## 💾 Database Schema

### New Table: `leave_restrictions`

```sql
CREATE TABLE leave_restrictions (
  id TEXT PRIMARY KEY,
  job_role_id TEXT NOT NULL UNIQUE,
  max_concurrent_leaves INT DEFAULT 2,  -- e.g., "max 2 guides per day"
  enforcement_level TEXT DEFAULT 'hard_block',  -- 'hard_block' or 'soft_warning'
  description TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Example Data

```
job_role_id  | max_concurrent_leaves | enforcement_level
─────────────────────────────────────────────────────
guide_001    | 2                     | hard_block
reception_01 | 1                     | hard_block
drivers_001  | 1                     | soft_warning
admin_001    | 0                     | hard_block (disabled)
```

---

## 🚀 Implementation Timeline

### Phase 1: Audit & Understanding (Day 1)
- [ ] Run the audit
- [ ] Document current state
- [ ] Answer key questions

### Phase 2: Database & Models (Days 2-3)
- [ ] Create SQL table
- [ ] Create TypeScript models
- [ ] Create service functions

### Phase 3: Core Logic (Days 4-5)
- [ ] Create validation service
- [ ] Integrate into LeaveContext
- [ ] Test with multiple scenarios

### Phase 4: Admin UI (Days 6-7)
- [ ] Create management panel
- [ ] Add settings interface
- [ ] Test all scenarios

### Phase 5: Testing & Polish (Days 8+)
- [ ] User acceptance testing
- [ ] Edge case testing
- [ ] Documentation

---

## ❓ Key Questions to Answer First

Before starting implementation, clarify:

1. **Limits per department?**
   - Guides: max 2?
   - Reception: max 1?
   - Drivers: max 1?

2. **Enforcement type?**
   - Hard block (prevent submission)?
   - Soft warning (warn but allow)?
   - Both (depending on department)?

3. **Special cases?**
   - Do auto-assigned Sundays count?
   - Do sick days count?
   - Can super_admin bypass?

4. **Role scope?**
   - Count only primary role?
   - Count all assigned roles?

5. **Cancellations?**
   - Do cancelled requests free spots?
   - (Currently: yes, only approved count)

---

## 📊 Code Locations Quick Reference

```
Leave Request Flow:
  src/components/LeaveRequestForm.tsx
              ↓
  src/context/LeaveContext.tsx (submitRequest)
              ↓
  ← NEW: leaveRestrictionService.ts (checkLeaveRestrictions)
              ↓
  src/services/firestoreService.ts (insertLeaveRequest)
              ↓
  Firestore Database

Audit Flow:
  src/components/DepartmentAuditPanel.tsx (UI)
              ↓
  src/utils/departmentAudit.ts (Logic)
              ↓
  src/context/AppDataContext.tsx (Data)
              ↓
  Supabase: job_roles + staff_role_assignments + users
```

---

## 🛠️ What I've Created For You

### 1. Utility Functions
**File**: `src/utils/departmentAudit.ts`
- `auditAllDepartments()` - Generate full audit
- `exportAuditToCSV()` - Export results
- `findEmptyDepartments()` - Find unused roles
- `findUnderstaffedDepartments()` - Find risky departments
- `findCrossFunctionalStaff()` - Find multi-role users

### 2. UI Component
**File**: `src/components/DepartmentAuditPanel.tsx`
- One-click audit generation
- Summary statistics with alerts
- Detailed department table
- CSV export button
- Ready to add to Settings page

### 3. Implementation Guides
**Files**:
- `LEAVE_RESTRICTION_IMPLEMENTATION.md` (Full architecture)
- `IMPLEMENTATION_QUICK_START.md` (Code snippets)
- `AUDIT_AND_IMPLEMENTATION_SUMMARY.md` (Roadmap)

---

## 📋 FCFS (First-Come-First-Served) Behavior

The system automatically implements FCFS because:

1. **Only approved leaves count**: We check `status === 'approved'`
2. **First submitted get approved first**: Managers/admins approve in order
3. **Once limit hit**: New requests get error message
4. **After cancellation**: Spots open up immediately

Example:
```
Day: 2026-09-20, Department: Guides (limit: 2)

10:00 AM - Guide A submits → Approved ✓ (1/2 spots used)
10:05 AM - Guide B submits → Approved ✓ (2/2 spots used)
10:10 AM - Guide C submits → Error ✗ (limit reached)
10:15 AM - Guide A cancels → Spots available (1/2 used)
10:20 AM - Guide C resubmits → Approved ✓ (2/2 spots used)
```

---

## ✨ Next Steps

### TODAY
1. Read this overview (5 min)
2. Run the audit (5 min)
3. Read `LEAVE_RESTRICTION_IMPLEMENTATION.md` (20 min)

### THIS WEEK
1. Answer the 5 key questions
2. Get stakeholder approval on limits
3. Plan your implementation timeline

### IMPLEMENTATION
1. Start with `IMPLEMENTATION_QUICK_START.md`
2. Follow the step-by-step code snippets
3. Test with the helper functions
4. Deploy to production

---

## 🎓 Learning Resources

- **Validation pattern**: See `staffingCheckOnSubmit.ts` - similar approach
- **State management**: See `AppDataContext.tsx` - how to add new state
- **Database integration**: See `supabaseService.ts` - how to add service functions
- **Context patterns**: See `LeaveContext.tsx` - how to integrate validation

---

## 💬 FAQ

**Q: Will this break existing features?**
A: No - it's just an additional validation step. Existing code is unaffected.

**Q: Can it be disabled per department?**
A: Yes - set `maxConcurrentLeaves: 0` to effectively disable a department.

**Q: What if limits are too strict?**
A: Easy to adjust - just update the database values. No code changes needed.

**Q: Can managers override?**
A: Currently no - restrictions apply to everyone. Can add exceptions if needed.

**Q: Is it performant?**
A: Yes - O(n) check against approved leaves for that date. Very fast.

---

## 🎯 Success Criteria

After implementation, you should be able to:

- ✅ Set maximum concurrent leave limits per department
- ✅ Prevent submissions that exceed limits (FCFS)
- ✅ Show available spots in calendar
- ✅ Admin can configure limits
- ✅ Audit shows real-time capacity
- ✅ No false positives or data corruption
- ✅ Super-admins can override if needed
- ✅ Cancelled requests immediately free spots

---

## 📞 Support

For questions on:
- **Architecture**: See `LEAVE_RESTRICTION_IMPLEMENTATION.md` section 4-5
- **Code details**: See `IMPLEMENTATION_QUICK_START.md`
- **Database schema**: See `LEAVE_RESTRICTION_IMPLEMENTATION.md` section 4.1
- **Audit usage**: See `departmentAudit.ts` docstrings
- **Current flow**: This document section "How Leave Requests Are Handled"

---

**You're ready to implement! Start with the audit, then follow `IMPLEMENTATION_QUICK_START.md`.** 🚀
