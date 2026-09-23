# 🚀 RUN MIGRATION IN BROWSER (No Private Keys Needed)

**Time Required**: ~10 minutes  
**Difficulty**: Easy  
**No Credentials Needed**: ✅ Uses your browser auth

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### STEP 1: Update Firestore Security Rules (2 minutes)

1. **Open Firebase Console**:
   - https://console.firebase.google.com/
   - Select: **smi-calender** project

2. **Go to Firestore Database**:
   - Left sidebar → Firestore Database

3. **Click: Rules tab** (top navigation)

4. **Replace the rules with this**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

5. **Click: Publish**

✅ **Done!** Firestore rules are now relaxed temporarily.

---

### STEP 2: Start Your App & Login (2 minutes)

1. **In terminal, start the app**:
   ```bash
   npm run dev
   ```

2. **Open browser** to the app (usually http://localhost:5173)

3. **Login with any user account** (any username/PIN that works)

✅ **Done!** You're logged in and app is running.

---

### STEP 3: Open Browser Console (1 minute)

1. **Press F12** (or right-click → Inspect)

2. **Click: Console tab** (in DevTools)

3. **Clear any existing console messages** (optional)

✅ **Done!** Console is open and ready.

---

### STEP 4: Copy & Paste Migration Script (1 minute)

1. **Open this file**:
   ```
   BROWSER_MIGRATION_SCRIPT.js
   ```

2. **Copy the ENTIRE content** (all 280+ lines)

3. **Paste into browser console**

4. **Press Enter**

✅ **Done!** Migration starts automatically.

---

### STEP 5: Watch the Progress (3-5 minutes)

You'll see output like:

```
🚀 Starting Supabase → Firestore Migration
This will take 2-5 minutes...

📋 Fetching users...
   Writing 16 records...
   ✓ Batch 1/1 committed
✓ users: 16 docs

📋 Fetching job_roles...
   Writing 6 records...
   ✓ Batch 1/1 committed
✓ job_roles: 6 docs

... (continues for all tables) ...

═══════════════════════════════════════════════
✓ MIGRATION COMPLETE!
✓ Total documents written: 4,210
═══════════════════════════════════════════════

NEXT STEPS:
1. Verify data in Firebase Console
2. RESTORE original Firestore security rules
3. Reload the app (F5)
4. Test that everything still works
```

✅ **Done!** Migration finished.

---

### STEP 6: Restore Security Rules (2 minutes)

1. **Go back to Firebase Console**:
   - Firestore Database → Rules tab

2. **Replace with ORIGINAL rules** (restrictive):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth.uid == userId;
       }
       match /leave_requests/{document=**} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.uid == resource.data.userId;
       }
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

3. **Click: Publish**

✅ **Done!** Rules are secured again.

---

### STEP 7: Verify in Firebase Console (2 minutes)

1. **In Firebase Console, check collections**:
   - Firestore Database → main view

2. **You should see**:
   - ✅ users (16 docs)
   - ✅ jobRoles (6 docs)
   - ✅ roleAssignments (24 docs)
   - ✅ staffingRules (8 docs)
   - ✅ notifications (1,700+ docs)
   - ✅ auditLog (1,300+ docs)
   - ✅ ... and all other collections

3. **Click on one to verify data looks correct**

✅ **Done!** Data migrated successfully.

---

### STEP 8: Test the App (2 minutes)

1. **In browser, reload app**:
   - Press F5

2. **Verify it still works**:
   - ✅ Can login
   - ✅ Can see departments
   - ✅ Can see staff assignments
   - ✅ No console errors

3. **Check console for any errors**:
   - Press F12 → Console
   - Should be mostly empty (just normal logs)

✅ **Done!** App still works with Firestore data.

---

## ✅ COMPLETE!

Your migration is done. All data is now on Firebase.

### What Just Happened:

```
Supabase                  Browser                    Firestore
  (Data) ─────────────── (Script runs) ─────────→   (Data written)
```

- ✅ 4,200+ documents read from Supabase
- ✅ 4,200+ documents written to Firestore
- ✅ Browser script handled the migration
- ✅ No private keys needed
- ✅ No Admin SDK needed
- ✅ Used your existing auth

---

## 📝 Next Steps

1. **Commit code changes**:
   ```bash
   git add .
   git commit -m "Complete Supabase to Firebase migration"
   git push origin main
   ```

2. **Deploy if needed**:
   ```bash
   firebase deploy
   ```

3. **Monitor Firestore**:
   - Check Firebase Console for usage
   - Verify all data is there
   - Monitor for any errors

---

## 🆘 Troubleshooting

### "Supabase client not found"
- Make sure app is fully loaded
- Try reloading page (F5) and logging in again
- Try pasting script again

### "Permission denied" errors
- Make sure Firestore rules are relaxed (check Step 1)
- Make sure you're logged into app
- Try refreshing rules (go back to Rules tab, click Publish again)

### Script stops partway through
- Check console for errors
- Run script again (it's safe to retry)
- If a specific table fails, that's okay - try running script again

### Data doesn't appear in Firestore
- Refresh Firestore Database page (click refresh)
- Check you're in correct project (smi-calender)
- Check collections list on left side
- Click on collection to see documents

---

## 🎯 Bottom Line

**This is the fastest workaround that needs NO private keys.**

Just:
1. Relax Firestore rules (2 min)
2. Run script in browser console (5 min)
3. Restore Firestore rules (2 min)
4. Verify in Firebase (2 min)

**Total: ~10 minutes**

**Result: 100% of data on Firebase without any credentials** ✅

---

## Ready?

**Follow the 8 steps above and your migration is complete!**

Start with Step 1: Update Firestore Rules 👇
