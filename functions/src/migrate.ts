import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import https from 'https';

// Initialize Firebase Admin (same as index.ts)
try {
  initializeApp();
} catch {
  // Already initialized
}

// Supabase credentials (from your app config)
const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

/**
 * Convert Supabase snake_case to Firestore camelCase
 */
function convertFieldNames(_table: string, doc: any): any {
  const converted: any = {};

  const mappings: Record<string, string> = {
    user_id: 'userId',
    user_display_name: 'userDisplayName',
    user_role: 'userRole',
    job_role: 'jobRole',
    job_role_id: 'jobRoleId',
    display_name: 'displayName',
    pin_hash: 'pinHash',
    is_active: 'isActive',
    is_hidden: 'isHidden',
    is_primary: 'isPrimary',
    shift_start: 'shiftStart',
    shift_end: 'shiftEnd',
    day_of_week: 'dayOfWeek',
    minimum_required: 'minimumRequired',
    is_recurring: 'isRecurring',
    consumes_balance: 'consumesBalance',
    applies_to_all: 'appliesToAll',
    applies_to: 'appliesTo',
    created_by: 'createdBy',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    decided_by_id: 'decidedById',
    decided_by_name: 'decidedByName',
    decided_at: 'decidedAt',
    is_overridden: 'isOverridden',
    overridden_by_id: 'overriddenById',
    overridden_by_name: 'overriddenByName',
    overridden_at: 'overriddenAt',
    staff_note: 'staffNote',
    approver_note: 'approverNote',
    leave_type: 'leaveType',
    is_read: 'isRead',
    confirm_status: 'confirmStatus',
    reject_reason: 'rejectReason',
    entity_type: 'entityType',
    entity_id: 'entityId',
    daily_reminder_time: 'dailyReminderTime',
    daily_reminder_enabled: 'dailyReminderEnabled',
    check_in_at: 'checkInAt',
    check_out_at: 'checkOutAt',
    check_in_lat: 'checkInLat',
    check_in_lng: 'checkInLng',
    check_out_lat: 'checkOutLat',
    check_out_lng: 'checkOutLng',
    location_id: 'locationId',
    location_name: 'locationName',
    is_wfh: 'isWfh',
    work_type: 'workType',
    auto_checked_out: 'autoCheckedOut',
    radius_meters: 'radiusMeters',
    allowed_roles: 'allowedRoles',
  };

  for (const [key, value] of Object.entries(doc)) {
    const newKey = mappings[key] || key;
    converted[newKey] = value;
  }

  return converted;
}

/**
 * Fetch all records from a Supabase table using REST API (handles pagination)
 */
async function fetchAllFromSupabase(table: string): Promise<any[]> {
  const pageSize = 1000;
  const allRows: any[] = [];

  for (let from = 0; ; from += pageSize) {
    try {
      const data = await new Promise<any[]>((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
        url.searchParams.append('select', '*');
        url.searchParams.append('offset', String(from));
        url.searchParams.append('limit', String(pageSize));

        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
        };

        https.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(body));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          });
        }).on('error', reject).end();
      });

      if (!data || data.length === 0) {
        break;
      }

      allRows.push(...data);

      if (data.length < pageSize) {
        break;
      }
    } catch (error: any) {
      console.warn(`⚠️  Error fetching ${table}: ${error.message}`);
      break;
    }
  }

  return allRows;
}

/**
 * Write documents to Firestore in batches
 */
async function writeToFirestore(
  collection: string,
  documents: any[]
): Promise<number> {
  if (documents.length === 0) {
    return 0;
  }

  const batchSize = 400;
  let written = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = getFirestore().batch();
    const slice = documents.slice(i, i + batchSize);

    for (const doc of slice) {
      const docId = doc.id || `${collection}_${Date.now()}_${Math.random()}`;
      const converted = convertFieldNames(collection, doc);
      const docRef = getFirestore().collection(collection).doc(String(docId));
      batch.set(docRef, converted, { merge: true });
    }

    await batch.commit();
    written += slice.length;

    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(documents.length / batchSize);
    console.log(`  ✓ Batch ${batchNum}/${totalBatches} committed (${written}/${documents.length})`);
  }

  return written;
}

/**
 * Main migration function
 */
async function runMigration(): Promise<{
  success: boolean;
  totalDocuments: number;
  collections: Record<string, number>;
  errors: string[];
}> {
  console.log('═══════════════════════════════════════════════════');
  console.log(' SUPABASE → FIRESTORE MIGRATION');
  console.log(' Time:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════\n');

  const collections = [
    'users',
    'job_roles',
    'staff_role_assignments',
    'staffing_rules',
    'holidays',
    'special_days',
    'leave_requests',
    'notifications',
    'notification_settings',
    'audit_log',
    'check_ins',
    'locations',
    'push_subscriptions',
    'tasks',
    'task_templates',
    'task_categories',
    'task_comments',
    'task_activity',
    'task_attachments',
    'tour_assignments',
  ];

  let totalDocuments = 0;
  const results: Record<string, number> = {};
  const errors: string[] = [];

  for (const collection of collections) {
    try {
      console.log(`📋 Fetching ${collection}...`);

      const rows = await fetchAllFromSupabase(collection);

      if (rows.length === 0) {
        console.log(`   ✓ Empty (0 records)\n`);
        results[collection] = 0;
        continue;
      }

      console.log(`   Writing ${rows.length} records...`);

      const written = await writeToFirestore(collection, rows);

      console.log(`✅ ${collection}: ${written} docs\n`);

      totalDocuments += written;
      results[collection] = written;
    } catch (error: any) {
      const errorMsg = `Error with ${collection}: ${error.message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ MIGRATION COMPLETE!');
  console.log(`✅ Total documents written: ${totalDocuments}`);
  console.log('═══════════════════════════════════════════════════\n');

  if (errors.length > 0) {
    console.log('⚠️  Errors encountered:');
    errors.forEach((err) => console.log(`  - ${err}`));
  }

  return {
    success: errors.length === 0,
    totalDocuments,
    collections: results,
    errors,
  };
}

/**
 * HTTP-triggered Cloud Function to run migration
 */
export const migrateData = onRequest(
  { region: 'us-central1' },
  async (request, response) => {
    try {
      // Check authorization
      const token = request.query.token || request.body.token;
      // Hardcode the secret token (deployed Cloud Functions don't read .env.local)
      const SECRET_TOKEN = 'migrateNow2026Secure123!';

      if (token !== SECRET_TOKEN) {
        response.status(403).json({
          error: 'Unauthorized',
          message: 'Missing or invalid migration token',
        });
        return;
      }

      const result = await runMigration();

      response.status(200).json({
        success: result.success,
        totalDocuments: result.totalDocuments,
        collections: result.collections,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Migration failed:', error);
      response.status(500).json({
        error: 'Migration failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
);

/**
 * Scheduled function to run migration daily (optional)
 * Commented out by default - uncomment to enable daily migrations
 */
// export const scheduledMigration = functions.pubsub
//   .schedule('every 24 hours')
//   .onRun(async () => {
//     console.log('Running scheduled migration...');
//     const result = await runMigration();
//     console.log('Scheduled migration result:', result);
//     return result;
//   });
