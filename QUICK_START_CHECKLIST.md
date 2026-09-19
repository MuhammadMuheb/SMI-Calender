# ⚡ QUICK START CHECKLIST - Migration in 20 Minutes

**Copy-paste this checklist and complete each step in order.**

---

## ✅ PRE-DEPLOYMENT (5 min)

- [ ] **Step 1**: Verify functions folder exists
  ```bash
  cd path/to/smi-calendar/functions
  ls -la src/
  ```

- [ ] **Step 2**: Install dependencies
  ```bash
  cd functions
  npm install
  ```

- [ ] **Step 3**: Update `functions/src/index.ts`
  ```typescript
  export * from './migrate';
  ```

- [ ] **Step 4**: Create `.env.local` in functions folder
  ```bash
  cd functions
  echo "MIGRATION_SECRET_TOKEN=mySecureToken123!" > .env.local
  ```

---

## 🚀 DEPLOYMENT (5 min)

- [ ] **Step 5**: Build functions (optional test)
  ```bash
  npm run build
  ```

- [ ] **Step 6**: Deploy to Firebase
  ```bash
  cd ..
  firebase deploy --only functions
  ```
  
  **Copy the Function URL shown in output:**
  ```
  https://us-central1-smi-calender.cloudfunctions.net/migrateData
  ```

---

## 🎯 EXECUTION (5 min)

- [ ] **Step 7**: Trigger migration with your secret token
  ```bash
  # Replace YOUR_SECRET_TOKEN_HERE with the token from Step 4
  curl "https://us-central1-smi-calender.cloudfunctions.net/migrateData?token=YOUR_SECRET_TOKEN_HERE"
  ```

  **Or paste this in browser** (replace token):
  ```
  https://us-central1-smi-calender.cloudfunctions.net/migrateData?token=YOUR_SECRET_TOKEN_HERE
  ```

  **Wait for response** (5-10 minutes):
  ```json
  {
    "success": true,
    "totalDocuments": 4210,
    ...
  }
  ```

---

## ✔️ VERIFICATION (3 min)

- [ ] **Step 8**: Check Firebase Console
  - Open https://console.firebase.google.com/
  - Select `smi-calender`
  - Firestore Database → Check collections exist
  - ✓ users, ✓ jobRoles, ✓ notifications, etc.

- [ ] **Step 9**: Test app
  ```bash
  npm run dev
  ```
  - Login works? ✓
  - Departments show? ✓
  - No console errors? ✓

- [ ] **Step 10**: Commit code
  ```bash
  git add functions/src/migrate.ts
  git commit -m "Add Cloud Function migration"
  git push origin main
  ```

---

## 🎉 COMPLETE!

**Total time: ~20 minutes**

**Result: 100% of data on Firebase** ✅

---

## 🆘 IF SOMETHING GOES WRONG

### Check function logs:
```bash
firebase functions:log
```

### Re-run migration:
```bash
# Safe to run multiple times
curl "https://us-central1-smi-calender.cloudfunctions.net/migrateData?token=YOUR_TOKEN"
```

### Verify Firestore connection:
- Firebase Console → Firestore Database
- Click any collection
- Documents should load

---

## 📝 IMPORTANT VALUES

**Save these somewhere safe:**

```
Project ID: smi-calender
Secret Token: ______________________
Function URL: https://us-central1-smi-calender.cloudfunctions.net/migrateData
```

---

**Ready? Start with Step 1 above!** 👆
