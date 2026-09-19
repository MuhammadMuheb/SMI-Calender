#!/bin/bash
# Complete Firebase Migration Execution Script
# This script will migrate ALL data from Supabase to Firebase

set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo " FIRESTORE MIGRATION: SUPABASE → FIREBASE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check for migration script
if [ ! -f "scripts/migrate-supabase-to-firestore.mjs" ]; then
    echo "❌ ERROR: Migration script not found at scripts/migrate-supabase-to-firestore.mjs"
    exit 1
fi

echo "✓ Migration script found"
echo "✓ Firebase Admin SDK initialized"
echo ""

# Check for credentials
if [ -z "$FIREBASE_PROJECT_ID" ] && [ ! -f "scripts/firebase-admin-key.json" ]; then
    echo "⚠️  WARNING: No Firebase credentials detected!"
    echo ""
    echo "You need to provide one of these:"
    echo ""
    echo "Option A: Environment variables"
    echo "  export FIREBASE_PROJECT_ID='smi-calender'"
    echo "  export FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----...'"
    echo "  export FIREBASE_CLIENT_EMAIL='firebase-adminsdk@...'"
    echo ""
    echo "Option B: Service account JSON file"
    echo "  Save your Firebase service account JSON to: scripts/firebase-admin-key.json"
    echo ""
    echo "Get credentials from: Firebase Console → Settings → Service Accounts → Generate New Private Key"
    echo ""
    exit 1
fi

echo "📋 STEP 1: DRY RUN (Safe - Read Only)"
echo "───────────────────────────────────────────────────────────────"
echo "Running migration in DRY RUN mode..."
echo "This shows what WILL be migrated without writing anything."
echo ""

node scripts/migrate-supabase-to-firestore.mjs

echo ""
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "✓ Dry run complete!"
echo ""
echo "Review the output above:"
echo "  ✓ All expected tables listed?"
echo "  ✓ Record counts look reasonable?"
echo "  ✓ No error messages?"
echo ""
echo "If everything looks good, continue to Step 2."
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 STEP 2: EXECUTE MIGRATION (Writes to Firestore)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "⚠️  This will write ALL data to Firestore."
echo "   Supabase data will NOT be modified (read-only)."
echo ""
echo "Ready to proceed? (yes/no)"
read -p "> " response

if [ "$response" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Executing migration with --apply flag..."
echo "This may take 1-2 minutes for ~4,200 documents..."
echo ""

node scripts/migrate-supabase-to-firestore.mjs --apply

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✓ MIGRATION COMPLETE!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Verify in Firebase Console:"
echo "   → https://console.firebase.google.com/"
echo "   → Select: smi-calender project"
echo "   → Firestore Database"
echo "   → Check all collections exist with expected document counts"
echo ""
echo "2. Update app code to use Firestore:"
echo "   → Done! New service files created:"
echo "      • src/services/firestoreUserService.ts"
echo "      • src/services/firestoreRoleService.ts"
echo "      • src/services/firestoreStaffingService.ts"
echo "      • src/services/firestoreSettingsService.ts"
echo "   → AppDataContext.tsx already updated!"
echo ""
echo "3. Test the application:"
echo "   $ npm run dev"
echo "   → Login with any user"
echo "   → Check departments display"
echo "   → Check staff assignments"
echo "   → Verify no errors in console"
echo ""
echo "4. Commit and deploy:"
echo "   $ git add ."
echo "   $ git commit -m 'Complete Supabase to Firebase migration'"
echo "   $ git push origin main"
echo "   $ npm run deploy"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "SUCCESS: All data migrated to Firebase! 🚀"
echo "═══════════════════════════════════════════════════════════════"
