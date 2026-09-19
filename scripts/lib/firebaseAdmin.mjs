/**
 * Firebase Admin SDK initialization for migration scripts
 *
 * Loads credentials from:
 * 1. Service account JSON file (if FIREBASE_ADMIN_SDK env var points to it)
 * 2. Environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
 * 3. Default location: scripts/firebase-admin-key.json
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (db) return db;

  // Try environment variables first
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: '0',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log('✓ Initialized Firebase Admin SDK from environment variables');
    return db;
  }

  // Try service account JSON file
  const jsonPath = process.env.FIREBASE_ADMIN_SDK || path.join(__dirname, '..', 'firebase-admin-key.json');

  if (fs.existsSync(jsonPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log(`✓ Initialized Firebase Admin SDK from ${jsonPath}`);
    return db;
  }

  // If no credentials found, show helpful error
  console.error('❌ Firebase Admin SDK credentials not found!');
  console.error('');
  console.error('Please provide credentials in ONE of these ways:');
  console.error('');
  console.error('1. Environment variables:');
  console.error('   export FIREBASE_PROJECT_ID=your-project');
  console.error('   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"');
  console.error('   export FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com');
  console.error('');
  console.error('2. Service account JSON file at:');
  console.error(`   ${jsonPath}`);
  console.error('');
  console.error('3. Path to JSON file via environment variable:');
  console.error('   export FIREBASE_ADMIN_SDK=/path/to/firebase-admin-key.json');
  console.error('');
  console.error('To get credentials:');
  console.error('  1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('  2. Click "Generate New Private Key"');
  console.error('  3. Download the JSON file or copy the values');
  console.error('');
  process.exit(1);
}
