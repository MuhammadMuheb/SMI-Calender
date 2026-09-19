# Get Firebase Admin SDK Credentials

To run the migration, we need your Firebase Admin SDK credentials. Follow these steps:

## 🔑 Get Your Service Account Key

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select your project: **smi-calender**

### Step 2: Generate Service Account Key
1. Click ⚙️ **Settings** (top-left gear icon)
2. Go to **Service Accounts** tab
3. Under "Firebase Admin SDK", click **Generate New Private Key**
4. A JSON file will download. **Save it securely** - it contains sensitive credentials!

### Step 3: Copy the Credentials

Open the downloaded JSON file. It will look like this:

```json
{
  "type": "service_account",
  "project_id": "smi-calender",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@smi-calender.iam.gserviceaccount.com",
  ...
}
```

You need 3 values:
- **project_id**: e.g., `smi-calender`
- **private_key**: The `-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----` block
- **client_email**: e.g., `firebase-adminsdk-xxxxx@smi-calender.iam.gserviceaccount.com`

---

## 🚀 Use Credentials: Pick ONE Method

### Method A: Save JSON File (Recommended)

1. Save the downloaded JSON file to:
   ```
   scripts/firebase-admin-key.json
   ```

2. Then just run:
   ```bash
   node scripts/migrate-supabase-to-firestore.mjs
   ```

### Method B: Environment Variables (Quick)

1. Set these environment variables:
   ```bash
   export FIREBASE_PROJECT_ID="smi-calender"
   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   export FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@smi-calender.iam.gserviceaccount.com"
   ```

2. Then run:
   ```bash
   node scripts/migrate-supabase-to-firestore.mjs
   ```

### Method C: Create .env File

Create `.env` in the project root:
```bash
FIREBASE_PROJECT_ID=smi-calender
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@smi-calender.iam.gserviceaccount.com
```

Then run:
```bash
node scripts/migrate-supabase-to-firestore.mjs
```

---

## ⚠️ IMPORTANT SECURITY NOTES

- 🔐 **Never commit** the JSON file or private key to git
- 🔐 **Never** share your private key
- 🔐 **Rotate** the key after 6 months
- 🔐 The `firestore.rules` and `firestore.indexes.json` are already in git (safe)
- 🔐 Service account credentials are **NOT** the same as your user account

---

## 🎯 What to Do Right Now

1. Go to Firebase Console → smi-calender → Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Choose one method above (A, B, or C) to provide credentials
5. Run the migration script

**You're almost ready!** Just need to provide credentials. 👇

---

## Next: Run Migration

Once credentials are set up, I'll run:
```bash
# Step 1: Dry run (safe, read-only)
node scripts/migrate-supabase-to-firestore.mjs

# Step 2: Actual migration (writes to Firestore)
node scripts/migrate-supabase-to-firestore.mjs --apply
```

This will migrate all data A-Z to Firebase! 🚀
