# 🚨 CRITICAL: Database Migration Status Audit

**Generated**: 2026-09-19  
**Status**: ⚠️ **INCOMPLETE - HYBRID SETUP (Supabase + Firebase)**

---

## ⚠️ EXECUTIVE SUMMARY

**Your system is currently running in HYBRID mode - NOT fully migrated to Firebase.**

The migration script (`migrate-supabase-to-firestore.mjs`) **was created and committed but has been deleted or lost from the codebase.**

### Current State:
- ✅ Some data on Firebase (Firestore)
- ⚠️ Critical data still on Supabase
- ❌ Migration incomplete - **NOT ALL DATA A-Z MOVED**

---

## 📊 DATA LOCATION BREAKDOWN

### **STILL ON SUPABASE** (From `supabaseService.ts`):

| Data | Service | Status | Notes |
|------|---------|--------|-------|
| Users | `fetchUsers()` | ⚠️ SUPABASE | 16+ users |
| Job Roles (Fields) | `fetchJobRoles()` | ⚠️ SUPABASE | Department config |
| Staff Role Assignments | `fetchRoleAssignments()` | ⚠️ SUPABASE | User→Department mapping |
| Staffing Rules | `fetchStaffingRules()` | ⚠️ SUPABASE | Minimum staff requirements |
| Holidays | `fetchHolidays()` | ⚠️ SUPABASE | Fixed holidays |
| Special Days | `fetchSpecialDays()` | ⚠️ SUPABASE | Custom special days |
| Audit Log | `insertAuditLog()` | ⚠️ SUPABASE | All audit entries |
| Notifications | `fetchNotifications()` | ⚠️ SUPABASE | 1,700+ notifications |
| Notification Settings | `fetchNotificationSettings()` | ⚠️ SUPABASE | App config |

### **ALREADY ON FIREBASE/FIRESTORE** (From `firestoreService.ts`):

| Data | Service | Status | Notes |
|------|---------|--------|-------|
| Leave Requests | `fetchLeaveRequests()` | ✅ FIREBASE | Listening via Firestore |
| Tour Assignments | `upsertTourAssignments()` | ✅ FIREBASE | Guide schedules |
| Schedules | `fetchSchedules()` | ✅ FIREBASE | Calendar schedules |
| Task Board | (taskService) | ✅ FIREBASE | Tasks/checklist |

### **HYBRID/MIXED**:

| Data | Status | Details |
|------|--------|---------|
| Push Notifications | Mixed | Stored in Supabase, sent via Firebase Cloud Messaging |

---

## 🔴 CRITICAL ISSUES

### Issue 1: Migration Script Missing
```
✓ Created: commit e37b063 (Sep 13, 2026)
✓ Had: 224 lines of migration code
✓ Could migrate: users, leave_requests, notifications, audit_log, check-ins, etc.
❌ CURRENT STATUS: File does not exist in scripts/ directory
```

**This means**:
- No easy way to bulk migrate remaining data
- Manual migration would be required
- Risk of data loss if not careful

### Issue 2: AppDataContext Still Uses Supabase for Core Data
```typescript
// src/context/AppDataContext.tsx - Line 84-89:
const [u, jr, ra, sr, h, sd, ns, ta, sched] = await Promise.all([
  fetchUsers(),              // ← SUPABASE
  fetchJobRoles(),          // ← SUPABASE
  fetchRoleAssignments(),   // ← SUPABASE
  fetchStaffingRules(),     // ← SUPABASE
  fetchHolidays(),          // ← SUPABASE
  fetchSpecialDays(),       // ← SUPABASE
  fetchNotificationSettings(), // ← SUPABASE
  fetchTourAssignments(),   // ← SUPABASE (but Firebase storage)
  fetchSchedules(),         // ← FIREBASE ✓
]);
```

### Issue 3: Leave Restrictions Need Firestore Integration
The new leave restrictions feature I recommended requires:
- ⚠️ New `leave_restrictions` table
- ⚠️ Currently planned for Supabase
- ❌ But you want Firebase!

---

## 📈 DATA VOLUMES TO MIGRATE

Based on git history, your data includes:
- **16 users** (accounts)
- **846+ leave requests** (historical)
- **1,700+ notifications**
- **1,300+ audit log entries**
- **1,080+ check-ins**
- **Multiple job roles** (Fields/Departments)
- **Staff role assignments** (User→Department mappings)

**Total**: ~4,500+ records still on Supabase

---

## 🛠️ WHAT NEEDS TO BE DONE

### Phase 1: Recover Migration Script (URGENT)

**Option A: Reconstruct from Git**
```bash
git show e37b063:scripts/migrate-supabase-to-firestore.mjs > scripts/migrate-supabase-to-firestore.mjs
```

**Option B: Check if in worktree**
```bash
find ./.claude/worktrees -name "migrate-supabase-to-firestore.mjs"
```

### Phase 2: Create Complete Firestore Schemas

For each remaining table, create Firestore collection:
- `users` → Firestore collection with same structure
- `job_roles` → Firestore collection
- `staff_role_assignments` → Firestore collection
- `staffing_rules` → Firestore collection
- `holidays` → Firestore collection
- `special_days` → Firestore collection
- `audit_log` → Firestore collection
- `notifications` → Already migrated ✓
- `notification_settings` → Firestore document

### Phase 3: Execute Migration

1. Restore/recreate migration script
2. Run in dry-run mode first: `node scripts/migrate-supabase-to-firestore.mjs`
3. Verify output
4. Run with `--apply` flag: `node scripts/migrate-supabase-to-firestore.mjs --apply`

### Phase 4: Update Services

Update `supabaseService.ts` functions to read from Firestore instead:
- Remove Supabase imports
- Create Firestore equivalents
- Update AppDataContext to use Firestore

### Phase 5: Verify & Cleanup

- Verify all data migrated correctly
- Run app with Firestore-only (disable Supabase)
- Delete Supabase data (or keep as backup)
- Deploy to production

---

## 📋 MIGRATION CHECKLIST

**Phase 1: Recovery**
- [ ] Restore or recreate `migrate-supabase-to-firestore.mjs`
- [ ] Test script in dry-run mode
- [ ] Verify it can read all Supabase tables

**Phase 2: Schema Creation**
- [ ] Create Firestore collections for: users, job_roles, staff_role_assignments, staffing_rules, holidays, special_days, audit_log
- [ ] Verify Firestore schema matches what app expects
- [ ] Create indexes if needed

**Phase 3: Data Migration**
- [ ] Backup Supabase data
- [ ] Run migration script with `--apply`
- [ ] Verify record counts match
- [ ] Check data integrity

**Phase 4: Code Updates**
- [ ] Update `supabaseService.ts` to use Firestore
- [ ] Or create new `firestoreUserService.ts`, `firestoreRoleService.ts`, etc.
- [ ] Update `AppDataContext.tsx` imports
- [ ] Update all service function calls

**Phase 5: Testing**
- [ ] Test login (users table)
- [ ] Test job role/field display
- [ ] Test staff assignments
- [ ] Test staffing rules
- [ ] Test all audit logging
- [ ] Test notifications

**Phase 6: Deployment**
- [ ] Disable Supabase reads (or set environment variable)
- [ ] Deploy to staging
- [ ] Test in staging
- [ ] Deploy to production

---

## 🔍 HOW THIS HAPPENED

Looking at git history:
1. ✅ Migration script created (Sep 13, commit e37b063)
2. ✅ Other Firebase services created (leave requests, schedules, tasks migrated)
3. ❌ Migration script then disappeared from codebase
4. ❌ App continued using hybrid setup (Supabase + Firebase)
5. ❌ No one ran the migration script with `--apply` flag

**Result**: Script existed but was never executed, then lost.

---

## 💡 IMMEDIATE ACTION REQUIRED

### Step 1: Check if script can be recovered

```bash
# Try to restore from git
git show e37b063:scripts/migrate-supabase-to-firestore.mjs > scripts/migrate-supabase-to-firestore.mjs

# Or check worktree
find .claude -name "*.mjs" -path "*migrate*"
```

### Step 2: If script is recoverable

1. Review the migration script
2. Run in dry-run: `node scripts/migrate-supabase-to-firestore.mjs`
3. If dry-run succeeds, run actual migration: `node scripts/migrate-supabase-to-firestore.mjs --apply`

### Step 3: If script is lost

I can help you recreate it based on:
- Current Supabase schema
- Current Firestore structure
- The 224-line original that was committed

---

## ⚡ PRIORITY: CRITICAL 🔴

**This is blocking**:
- Proper database architecture
- New feature development (like leave restrictions)
- Production deployment
- Scaling concerns

**Your Firebase investment is not being fully utilized.**

---

## 📞 NEXT STEPS

1. **Immediately**: Check if migration script can be recovered
   ```bash
   git show e37b063:scripts/migrate-supabase-to-firestore.mjs
   ```

2. **If recoverable**: Run it in dry-run mode
   ```bash
   node scripts/migrate-supabase-to-firestore.mjs
   ```

3. **If successful**: Apply the migration
   ```bash
   node scripts/migrate-supabase-to-firestore.mjs --apply
   ```

4. **Then**: Update code to use Firestore instead of Supabase

**Would you like me to**:
- [ ] Recover the migration script from git
- [ ] Recreate the migration script from scratch
- [ ] Help execute the migration
- [ ] Update services to use Firestore
- [ ] All of the above

---

**This is URGENT. Your system is split across two databases, which defeats the purpose of buying Firebase.** 🚨
