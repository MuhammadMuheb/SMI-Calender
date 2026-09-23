/**
 * BROWSER CONSOLE MIGRATION SCRIPT
 *
 * Run this in your browser console (F12) to migrate data from Supabase to Firebase
 * while logged into the app.
 *
 * IMPORTANT: You must:
 * 1. Be logged into the app
 * 2. Have Firestore security rules temporarily relaxed (see instructions below)
 * 3. Copy this entire script into browser console and press Enter
 *
 * BEFORE RUNNING:
 *
 * 1. Update Firestore Rules:
 *    Go to Firebase Console → Firestore Database → Rules
 *    Replace with:
 *
 *    rules_version = '2';
 *    service cloud.firestore {
 *      match /databases/{database}/documents {
 *        match /{document=**} {
 *          allow read, write: if request.auth != null;
 *        }
 *      }
 *    }
 *
 *    Then publish the rules.
 *
 * 2. Copy this entire script into browser console
 *
 * 3. Run it: Press Enter
 *
 * 4. Wait for completion (should take 2-5 minutes for 4,200+ documents)
 *
 * 5. RESTORE Firestore Rules to original:
 *    Go back to Firebase Console → Firestore Database → Rules
 *    Restore the original restrictive rules
 */

async function migrateSupabaseToFirestore() {
  console.log('🚀 Starting Supabase → Firestore Migration');
  console.log('This will take 2-5 minutes...\n');

  // Get Firestore instance from the app
  const db = window.firebaseDb || firebase.firestore();

  // Supabase credentials (from your app)
  const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

  // Initialize Supabase client
  const supabase = supabase || window.supabase;
  if (!supabase) {
    alert('Error: Supabase client not found in window');
    return;
  }

  try {
    const collections = [
      'users', 'job_roles', 'staff_role_assignments', 'staffing_rules',
      'holidays', 'special_days', 'notifications', 'notification_settings',
      'audit_log', 'check_ins', 'locations', 'push_subscriptions',
      'tasks', 'task_templates', 'task_categories', 'task_comments',
      'task_activity', 'task_attachments', 'tour_assignments'
    ];

    let totalDocs = 0;

    for (const tableName of collections) {
      console.log(`📋 Fetching ${tableName}...`);

      try {
        const { data, error } = await supabase.from(tableName).select('*').limit(10000);

        if (error) {
          console.log(`   ⚠️  Skipped (${error.message})`);
          continue;
        }

        if (!data || data.length === 0) {
          console.log(`   ✓ Empty (0 records)`);
          continue;
        }

        console.log(`   Writing ${data.length} records...`);

        // Write to Firestore in batches
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = db.batch();
          const slice = data.slice(i, i + batchSize);

          for (const doc of slice) {
            const docId = doc.id || `${tableName}_${Date.now()}_${Math.random()}`;
            const docRef = db.collection(tableName).doc(String(docId));

            // Convert snake_case keys to camelCase for some tables
            const converted = convertSupabaseToFirestore(tableName, doc);
            batch.set(docRef, converted, { merge: true });
          }

          await batch.commit();
          console.log(`   ✓ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} committed`);
        }

        totalDocs += data.length;
        console.log(`✓ ${tableName}: ${data.length} docs\n`);
      } catch (tableError) {
        console.error(`✗ Error with ${tableName}:`, tableError.message);
      }
    }

    console.log('═══════════════════════════════════════════════');
    console.log(`✓ MIGRATION COMPLETE!`);
    console.log(`✓ Total documents written: ${totalDocs}`);
    console.log('═══════════════════════════════════════════════\n');
    console.log('NEXT STEPS:');
    console.log('1. Verify data in Firebase Console');
    console.log('2. RESTORE original Firestore security rules');
    console.log('3. Reload the app (F5)');
    console.log('4. Test that everything still works');
    console.log('5. Commit code changes: git commit -m "Complete Firebase migration"');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  }
}

/**
 * Convert Supabase snake_case to Firestore camelCase
 */
function convertSupabaseToFirestore(table, doc) {
  const converted = {};

  for (const [key, value] of Object.entries(doc)) {
    let newKey = key;

    // Convert specific known mappings
    const mappings = {
      'user_id': 'userId',
      'user_display_name': 'userDisplayName',
      'user_role': 'userRole',
      'job_role': 'jobRole',
      'job_role_id': 'jobRoleId',
      'display_name': 'displayName',
      'pin_hash': 'pinHash',
      'is_active': 'isActive',
      'is_hidden': 'isHidden',
      'is_primary': 'isPrimary',
      'shift_start': 'shiftStart',
      'shift_end': 'shiftEnd',
      'day_of_week': 'dayOfWeek',
      'minimum_required': 'minimumRequired',
      'is_recurring': 'isRecurring',
      'consumes_balance': 'consumesBalance',
      'applies_to_all': 'appliesToAll',
      'applies_to': 'appliesTo',
      'created_by': 'createdBy',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'decided_by_id': 'decidedById',
      'decided_by_name': 'decidedByName',
      'decided_at': 'decidedAt',
      'is_overridden': 'isOverridden',
      'overridden_by_id': 'overriddenById',
      'overridden_by_name': 'overriddenByName',
      'overridden_at': 'overriddenAt',
      'staff_note': 'staffNote',
      'approver_note': 'approverNote',
      'leave_type': 'leaveType',
      'is_read': 'isRead',
      'confirm_status': 'confirmStatus',
      'reject_reason': 'rejectReason',
      'entity_type': 'entityType',
      'entity_id': 'entityId',
      'daily_reminder_time': 'dailyReminderTime',
      'daily_reminder_enabled': 'dailyReminderEnabled',
      'check_in_at': 'checkInAt',
      'check_out_at': 'checkOutAt',
      'check_in_lat': 'checkInLat',
      'check_in_lng': 'checkInLng',
      'check_out_lat': 'checkOutLat',
      'check_out_lng': 'checkOutLng',
      'location_id': 'locationId',
      'location_name': 'locationName',
      'is_wfh': 'isWfh',
      'work_type': 'workType',
      'auto_checked_out': 'autoCheckedOut',
      'radius_meters': 'radiusMeters',
      'allowed_roles': 'allowedRoles',
      'p256dh': 'p256dh',
    };

    newKey = mappings[key] || key;
    converted[newKey] = value;
  }

  return converted;
}

// Run it!
migrateSupabaseToFirestore().catch(console.error);
