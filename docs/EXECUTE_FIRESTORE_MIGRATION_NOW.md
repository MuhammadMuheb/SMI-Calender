# 🚀 EXECUTE FIRESTORE MIGRATION - COMPLETE A-Z

## ✅ Status Update

**RECOVERED**: The migration script has been recovered from git history and restored to:
```
scripts/migrate-supabase-to-firestore.mjs
```

This script will migrate ALL data from Supabase to Firebase/Firestore:
- ✅ Users (16+)
- ✅ Job Roles (Fields/Departments)
- ✅ Staff Role Assignments
- ✅ Staffing Rules
- ✅ Holidays
- ✅ Special Days
- ✅ Audit Log (1,300+ entries)
- ✅ Notifications (1,700+)
- ✅ Notification Settings
- ✅ Check-ins & denormalization

---

## 🎯 What This Migration Does

```
SUPABASE (Read-Only)          FIRESTORE (Write Target)
├── users                     → users collection
├── job_roles                 → jobRoles collection
├── staff_role_assignments    → roleAssignments collection
├── staffing_rules            → staffingRules collection
├── holidays                  → holidays collection
├── special_days              → specialDays collection
├── audit_log                 → auditLog collection
├── notifications             → notifications collection
├── notification_settings     → notificationSettings document
└── check_ins                 → checkIns collection (denormalized)
```

**Important Security**: 
- ✅ Plaintext PINs from Supabase are bcrypt-hashed during migration
- ✅ Firestore will never store plaintext PINs

---

## 📋 PRE-MIGRATION CHECKLIST

### ✅ Required:

- [ ] Backup Supabase data (optional but recommended)
- [ ] Have Firebase Admin SDK credentials ready (`.env` file)
- [ ] Firestore database is initialized and accessible
- [ ] Node.js is installed on your machine
- [ ] You're in the project directory

### ✅ Environment Setup:

Create `.env` file with Firebase Admin credentials:
```bash
# Get these from Firebase Console → Project Settings → Service Accounts
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
```

OR if using `scripts/lib/firebaseAdmin.mjs`:
```bash
# Check your .env.local or secrets manager
npm install -g dotenv  # if needed
```

---

## 🏃 STEP-BY-STEP EXECUTION

### Step 1: Verify Script is Present

```bash
cd /path/to/smi-calendar
ls -la scripts/migrate-supabase-to-firestore.mjs
```

**Expected Output**:
```
-rwxr-xr-x 1 user staff 11519 Sep 19 15:26 scripts/migrate-supabase-to-firestore.mjs
```

### Step 2: Verify Supabase Credentials

The script uses these environment variables (checked in order):
1. `SUPABASE_URL` / `VITE_SUPABASE_URL`
2. `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`

Check your `.env` or `.env.local`:
```bash
grep SUPABASE .env
# or
grep SUPABASE .env.local
```

**The script has hardcoded Supabase credentials as fallback** (production URL), so it should work even without explicit env vars.

### Step 3: RUN DRY RUN (SAFE - READ ONLY)

```bash
node scripts/migrate-supabase-to-firestore.mjs
```

**This will**:
- ✅ Connect to Supabase (read-only)
- ✅ Connect to Firestore (no writes)
- ✅ Show you exactly what would be migrated
- ✅ Display record counts for each table
- ✅ Report any errors without modifying data

**Expected Output** (example):
```
═══════════════════════════════════════════════════
 SUPABASE → FIRESTORE MIGRATION
 Mode: DRY RUN (read-only)
═══════════════════════════════════════════════════

users: 16 rows (PINs re-hashed with bcrypt)
jobRoles: 6 rows
roleAssignments: 24 rows
staffingRules: 8 rows
holidays: 12 rows
specialDays: 5 rows
notifications: 1723 rows
notificationSettings: 1 doc
checkIns: 1081 rows (with denormalization)
auditLog: 1342 rows

───────────────────────────────────────────────────
 TOTAL: 4210 documents ready to write
───────────────────────────────────────────────────
 Would write to Firestore (in batches of 400)
 But did not — this was a DRY RUN.
```

### Step 4: REVIEW DRY RUN OUTPUT

**Look for**:
- ✅ All expected tables listed
- ✅ Record counts that make sense
- ✅ No error messages
- ✅ "DRY RUN (read-only)" confirmation

**If there are errors**:
- Check Firebase/Firestore connectivity
- Check Supabase credentials
- Check network access

### Step 5: EXECUTE MIGRATION WITH --apply

Once dry run looks good, execute actual migration:

```bash
node scripts/migrate-supabase-to-firestore.mjs --apply
```

**This will**:
- ✅ Connect to Supabase (read-only)
- ✅ Connect to Firestore (WRITES data)
- ✅ Create collections in Firestore
- ✅ Write all documents in batches of 400
- ✅ Hash all PINs with bcrypt
- ✅ Show progress

**Expected Output** (example):
```
═══════════════════════════════════════════════════
 SUPABASE → FIRESTORE MIGRATION
 Mode: APPLY (will write)
═══════════════════════════════════════════════════

users: 16 rows (PINs re-hashed with bcrypt)
   writing 16 docs to "users"...
   ✓ Batch 1 committed (16 docs)

jobRoles: 6 rows
   writing 6 docs to "jobRoles"...
   ✓ Batch 1 committed (6 docs)

roleAssignments: 24 rows
   writing 24 docs to "roleAssignments"...
   ✓ Batch 1 committed (24 docs)

...

auditLog: 1342 rows
   writing 1342 docs to "auditLog"...
   ✓ Batch 1 committed (400 docs)
   ✓ Batch 2 committed (400 docs)
   ✓ Batch 3 committed (400 docs)
   ✓ Batch 4 committed (142 docs)

───────────────────────────────────────────────────
 MIGRATION COMPLETE
 4210 documents written to Firestore
───────────────────────────────────────────────────
```

### Step 6: VERIFY IN FIRESTORE CONSOLE

After migration completes:

1. Go to **Firebase Console** → Your Project → **Firestore Database**
2. Check collections exist:
   - [ ] `users` (should have 16 docs)
   - [ ] `jobRoles` (should have 6 docs)
   - [ ] `roleAssignments` (should have 24 docs)
   - [ ] `staffingRules` (should have 8 docs)
   - [ ] `holidays` (should have 12 docs)
   - [ ] `specialDays` (should have 5 docs)
   - [ ] `notifications` (should have 1,700+ docs)
   - [ ] `auditLog` (should have 1,300+ docs)
   - [ ] `checkIns` (should have 1,000+ docs)

3. Click on a collection to sample data:
   - ✅ Data should look correct
   - ✅ PINs should look like bcrypt hashes (starts with `$2a$` or `$2b$`)
   - ✅ Dates should be timestamps
   - ✅ IDs should match Supabase

---

## 🔄 NEXT: Update App Code

After migration completes, you need to update your app to read from Firestore instead of Supabase:

### What needs to change:

**Current** (`supabaseService.ts`):
```typescript
export async function fetchUsers() {
  const { data, error } = await supabase.from('users').select('*');
  // ...
}
```

**Target** (needs new functions in `firestoreUserService.ts`):
```typescript
export async function fetchUsers() {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}
```

### Files to create/update:

- [ ] `src/services/firestoreUserService.ts` - User operations
- [ ] `src/services/firestoreRoleService.ts` - Job roles & assignments
- [ ] `src/services/firestoreStaffingService.ts` - Staffing rules
- [ ] `src/services/firestoreSettingsService.ts` - Holidays & special days
- [ ] `src/context/AppDataContext.tsx` - Update imports

---

## ⚠️ IMPORTANT NOTES

### During Migration:

- ⚠️ **READ-ONLY** on Supabase (no data changes)
- ⚠️ **WRITE** to Firestore (check Firestore quota)
- ⚠️ Takes ~30-60 seconds for 4,000+ documents
- ⚠️ If it fails halfway, just run with `--apply` again (idempotent)

### After Migration:

- ✅ Keep Supabase backup for 30 days
- ✅ Test app thoroughly with Firestore data
- ✅ Update code to use Firestore services
- ✅ Disable Supabase reads once tested

---

## 🚨 TROUBLESHOOTING

### Error: "Cannot find module '@supabase/supabase-js'"

```bash
npm install @supabase/supabase-js bcryptjs
```

### Error: "Firebase credentials not found"

Make sure `.env` has:
```bash
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
```

### Error: "Supabase connection failed"

- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check internet connection
- Verify Supabase project still exists

### Error: "Firestore quota exceeded"

- You've hit daily quota
- Wait 24 hours or upgrade Firebase plan
- Or delete test collections and try again

### Migration started but didn't complete

- Just run again with `--apply` — it's idempotent
- Firestore will overwrite with latest data

---

## 📊 VERIFICATION COMMANDS

After migration, verify data integrity:

```bash
# Count documents in Firestore (in Firebase Console)
# users: 16
# jobRoles: 6
# roleAssignments: 24
# notifications: 1700+
# auditLog: 1300+

# Run app and check:
# - Login with any user (PIN should work)
# - See departments listed correctly
# - See staff assignments correct
# - See notifications appearing
```

---

## 🎯 SUCCESS CRITERIA

Migration is complete when:

✅ Dry run shows all tables with correct counts
✅ Dry run completes with no errors
✅ `--apply` migration completes with "MIGRATION COMPLETE"
✅ Firestore console shows all collections
✅ Sample documents in Firestore look correct
✅ PINs are bcrypt-hashed (not plaintext)
✅ App still functions after code update to use Firestore

---

## 🚀 NOW EXECUTE

**Run this command:**

```bash
node scripts/migrate-supabase-to-firestore.mjs
```

Then check the output. If it looks good:

```bash
node scripts/migrate-supabase-to-firestore.mjs --apply
```

**That's it! Your A-Z data will be on Firebase.** 🎉

---

## 📞 NEXT STEPS AFTER MIGRATION

1. ✅ Run migration (you're here)
2. 📝 Create Firestore service files
3. 🔄 Update AppDataContext.tsx
4. ✅ Test app thoroughly
5. 🚀 Deploy to production
6. 🧹 Optional: Clean up Supabase

I can help with all of these steps!
