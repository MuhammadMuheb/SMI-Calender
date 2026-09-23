# Department-wise Leave Restriction: Summary & Next Steps

## ✅ CONFIRMATION

**Yes, we can fully implement department-wise leave restrictions with maximum concurrent leave limits and FCFS (first-come, first-served) locking.**

---

## 📋 WHAT WAS CREATED FOR YOU

### 1. **Comprehensive Implementation Guide**
   - **File**: `LEAVE_RESTRICTION_IMPLEMENTATION.md`
   - **Contents**:
     - Complete architecture for the feature
     - Database schema (new `leave_restrictions` table)
     - TypeScript models and service layer
     - Integration points in existing code
     - 5-phase implementation plan
     - Testing checklist
     - Key questions to clarify with stakeholders

### 2. **Department Audit Utility**
   - **File**: `src/utils/departmentAudit.ts`
   - **Purpose**: Generate comprehensive reports of all fields/departments
   - **Features**:
     - List all departments with member counts
     - Identify empty departments (0 members) ⚠️
     - Identify understaffed departments (1 member)
     - Find cross-functional staff (assigned to multiple departments)
     - Export to CSV
     - Print formatted console output
   - **Usage**:
     ```typescript
     import { auditAllDepartments, printAuditToConsole } from './utils/departmentAudit';
     
     const { jobRoles, users, roleAssignments } = useAppData();
     const summary = auditAllDepartments(jobRoles, users, roleAssignments);
     printAuditToConsole(summary);
     ```

### 3. **Department Audit UI Component**
   - **File**: `src/components/DepartmentAuditPanel.tsx`
   - **Purpose**: Visual interface to run and view department audit
   - **Features**:
     - One-click audit generation
     - Summary statistics with alerts
     - Empty department warnings
     - Understaffed department warnings
     - Cross-functional staff listing
     - Detailed table view of all departments and members
     - CSV export button
   - **Integration**: Add to Settings → Department Audit page

---

## 🏗️ WHERE LEAVE REQUESTS ARE CURRENTLY HANDLED

### File Structure

```
src/
├── models/
│   └── leave.ts                    ← LeaveRequest interface
├── services/
│   ├── leaveService.ts             ← Basic leave request CRUD (placeholder)
│   ├── firestoreService.ts         ← Firestore operations (actual DB)
│   └── staffingCheckOnSubmit.ts    ← Pre-submission validation
├── context/
│   └── LeaveContext.tsx            ← Main state management & submission logic
└── components/
    ├── LeaveRequestForm.tsx        ← User submission UI
    └── LeaveCalendar.tsx          ← Leave calendar visualization
```

### Request Submission Flow

```
User clicks "Request Leave" in Calendar
          ↓
LeaveRequestForm Component
          ↓
LeaveContext.submitRequest()
          ↓
Validation Pipeline:
  1. Date validation (ISO format, future date)
  2. Duplicate check (user already requested for this date)
  3. First Sunday check (auto-assigned, cannot request)
  4. Balance check (regular days off or vacation days remaining)
  5. Staffing minimum check (minimum required staff for role)
  
⚠️ INSERTION POINT FOR NEW RESTRICTION:
  6. ← Department Leave Limit Check (NEW FEATURE)
  
  7. Insert to Firestore
  8. Update local state
  9. Audit log entry
          ↓
Success or Error Message returned to user
```

### Key Code Locations

| File | Function | Purpose |
|------|----------|---------|
| `src/context/LeaveContext.tsx` | `submitRequest()` (line ~71) | Main submission entry point |
| `src/services/staffingCheckOnSubmit.ts` | `checkStaffingBeforeSubmit()` | Staffing validation (similar pattern to what we need) |
| `src/services/firestoreService.ts` | `insertLeaveRequest()` | Database insert |
| `src/models/leave.ts` | `LeaveRequest` interface | Data structure |

---

## 🔍 HOW TO RUN THE AUDIT

### Option 1: UI Component (Easiest)
1. Add `DepartmentAuditPanel` to a settings page
2. Click "Generate Audit Report"
3. View results immediately in table
4. Download as CSV if needed

### Option 2: Browser Console
```javascript
// In browser console (after app loads):
import { auditAllDepartments, printAuditToConsole } from './src/utils/departmentAudit';

const appData = useAppData(); // or get from React DevTools
const summary = auditAllDepartments(
  appData.jobRoles,
  appData.users,
  appData.roleAssignments
);

printAuditToConsole(summary);
// Output will show:
// - Department summary (total, with members, empty)
// - Each department with member list
// - Primary vs secondary role assignments
```

### Option 3: SQL Query (Direct Database)
```sql
SELECT 
  jr.id AS department_id,
  jr.name AS department_name,
  COUNT(DISTINCT sra.user_id) AS total_members,
  ARRAY_AGG(u.display_name) FILTER (WHERE sra.is_primary = true) AS primary_members,
  ARRAY_AGG(u.display_name) FILTER (WHERE sra.is_primary = false) AS secondary_members,
  CASE WHEN COUNT(DISTINCT sra.user_id) = 0 THEN 'EMPTY ⚠️' ELSE 'ACTIVE ✓' END AS status
FROM job_roles jr
LEFT JOIN staff_role_assignments sra ON jr.id = sra.job_role_id
LEFT JOIN users u ON sra.user_id = u.id
WHERE jr.is_hidden = false
GROUP BY jr.id, jr.name
ORDER BY COUNT(DISTINCT sra.user_id) DESC, jr.name;
```

---

## 📊 AUDIT OUTPUT EXAMPLE

The audit will show something like:

```
╔════════════════════════════════════════════════╗
║       DEPARTMENT AUDIT SUMMARY                 ║
╠════════════════════════════════════════════════╣
║ Total Departments:         6                   ║
║ Departments with Members:  4                   ║
║ Empty Departments:         2 ⚠️               ║
║ Total Staff Assignments:  14                   ║
║ Unique Staff Members:      9                   ║
╚════════════════════════════════════════════════╝

DEPARTMENTS WITH ISSUES:
- Guide Team: 3 members ✓
- Reception: 2 members ✓
- Drivers: 1 member ⚠️ (UNDERSTAFFED)
- Admin: 0 members ⚠️ (EMPTY)
- Archive: 0 members ⚠️ (EMPTY)
- IT Support: 3 members (includes 1 cross-functional)
```

---

## 🎯 IMPLEMENTATION ROADMAP

### Phase 1: Audit (Do This First!)
- [ ] Run the audit to see current field configuration
- [ ] Identify which fields have capacity issues
- [ ] Document current state in a spreadsheet

### Phase 2: Design & Requirements
- [ ] Answer key questions:
  - Hard block or soft warning?
  - Count only primary roles or all roles?
  - Apply to all leave types?
- [ ] Define max concurrent limits per field
- [ ] Decide on enforcement level

### Phase 3: Database Setup
- [ ] Create `leave_restrictions` table in Supabase
- [ ] Set initial max limits for each field
- [ ] Add migration scripts

### Phase 4: Backend Implementation
- [ ] Create `leaveRestrictionService.ts`
- [ ] Add service functions to `supabaseService.ts`
- [ ] Add state to `AppDataContext.tsx`
- [ ] Integrate check into `LeaveContext.submitRequest()`

### Phase 5: Frontend Implementation
- [ ] Update calendar to show department capacity
- [ ] Add visual indicators (red/yellow/green)
- [ ] Create admin panel to configure limits
- [ ] Add tooltips showing "X spots remaining"

### Phase 6: Testing & Refinement
- [ ] Test FCFS scenario (multiple concurrent requests)
- [ ] Test with users in multiple departments
- [ ] Test override scenarios
- [ ] Test UI indicators

---

## ❓ CRITICAL QUESTIONS BEFORE BUILDING

Before implementing, clarify with stakeholders:

1. **Enforcement Strategy**
   - [ ] Hard block: Prevent submission if at capacity
   - [ ] Soft warning: Warn but allow submission
   - [ ] Combination: Warning for most users, block for certain roles

2. **Role Scope**
   - [ ] Count only primary roles?
   - [ ] Count all assigned roles (primary + secondary)?
   - [ ] Different counts for primary vs secondary?

3. **Leave Type Coverage**
   - [ ] Apply to all leave types (vacation + day off)?
   - [ ] Only to specific types?
   - [ ] Exclude sick days or auto-assigned days?

4. **Special Cases**
   - [ ] Should first Sundays (auto-assigned) count toward limit?
   - [ ] Should super_admin overrides bypass the limit?
   - [ ] Should cancelled leaves free up the spot?

5. **Default Limits**
   - [ ] What's the default max per department?
   - [ ] Different limits for different departments?
   - [ ] Example: Guides (max 2), Reception (max 1), Drivers (max 1)?

---

## 📁 FILES CREATED/MODIFIED

### New Files Created
- ✅ `LEAVE_RESTRICTION_IMPLEMENTATION.md` - Full implementation guide
- ✅ `src/utils/departmentAudit.ts` - Audit utility functions
- ✅ `src/components/DepartmentAuditPanel.tsx` - Audit UI component
- ✅ `AUDIT_AND_IMPLEMENTATION_SUMMARY.md` - This file

### Existing Files to Modify (When Ready)
- `src/models/leaveRestriction.ts` (create new)
- `src/services/leaveRestrictionService.ts` (create new)
- `src/services/supabaseService.ts` (add restriction functions)
- `src/context/AppDataContext.tsx` (add state)
- `src/context/LeaveContext.tsx` (add check in submitRequest)
- `src/components/LeaveCalendar.tsx` (add visual indicators)

---

## 🚀 NEXT STEPS

### Immediate (Today)
1. ✅ Review `LEAVE_RESTRICTION_IMPLEMENTATION.md`
2. ✅ Run the audit to see current state
3. ✅ Document current field configuration

### Short Term (This Week)
1. Answer the critical questions above
2. Design the specific limits for each field
3. Decide on enforcement strategy
4. Create requirements document

### Medium Term (Next Sprint)
1. Start Phase 3: Database setup
2. Implement backend validation
3. Add UI indicators

---

## 💡 KEY INSIGHTS FROM THE ANALYSIS

1. **System is Ready**: The codebase already has validation patterns (staffing checks) that we can follow for leave restrictions.

2. **Two-Tier Assignment**: The system uses `staff_role_assignments` (primary + secondary) which allows for complex scenarios like "Guide (primary) + Driver (secondary)".

3. **FCFS is Built-In**: Since we'll check approved leaves for that date, the system naturally implements FCFS - first requests submitted and approved will count toward the limit.

4. **Backward Compatible**: Adding restrictions won't break existing functionality - it's just another validation step in the pipeline.

5. **Audit-Ready**: The audit utility can be run at any time to track department staffing and identify gaps.

---

## 📞 SUPPORT

If you have questions about:
- **Implementation details**: See `LEAVE_RESTRICTION_IMPLEMENTATION.md`
- **Audit usage**: Run `DepartmentAuditPanel` or check `departmentAudit.ts` docs
- **Leave request flow**: Check the diagram in this file
- **Database schema**: See section 2 of the implementation guide

---

## ✨ Summary

You now have:
1. ✅ **Confirmation**: Yes, it's possible
2. ✅ **Audit tools**: Run anytime to see current state
3. ✅ **Implementation guide**: Ready to build
4. ✅ **Code locations**: Know where to make changes
5. ✅ **Design patterns**: Follow existing validation patterns

**Ready to proceed with implementation?** Start with Phase 1 (running the audit) to understand your current department configuration!
