#!/usr/bin/env node

const https = require('https');

/**
 * Invoke the migrateData Cloud Function
 * Uses the Cloud Run service account authentication
 */
async function invokeMigration() {
  const projectId = 'smi-calender';
  const region = 'us-central1';
  const functionName = 'migrateData';

  // Cloud Run service URL (from deployment)
  const url = `https://migratedata-ad2zxp2vhq-uc.a.run.app?token=migrateNow2026Secure123!`;

  console.log('🚀 Starting migration...\n');
  console.log(`Invoking: ${url}\n`);

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    https.get(url, { timeout: 600000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
        process.stdout.write('.');
      });

      res.on('end', () => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n\n✅ Migration completed in ${duration}s\n`);

        try {
          const result = JSON.parse(data);

          if (result.success) {
            console.log('📊 Migration Summary:');
            console.log(`   Total documents: ${result.totalDocuments}`);
            console.log(`   Collections migrated:`);

            Object.entries(result.collections).forEach(([collection, count]) => {
              console.log(`     • ${collection}: ${count}`);
            });

            if (result.errors.length > 0) {
              console.log(`\n⚠️  Errors encountered:`);
              result.errors.forEach(err => console.log(`   • ${err}`));
            }
          } else {
            console.log('❌ Migration failed');
            console.log(result);
          }

          resolve(result);
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

invokeMigration().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
