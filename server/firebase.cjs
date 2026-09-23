const admin = require('firebase-admin');
function services() {
  if (!admin.apps.length && process.env.FIRESTORE_EMULATOR_HOST) {
    if (!process.env.FIREBASE_PROJECT_ID?.startsWith('demo-')) throw new Error('Emulator tests require a demo project');
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const account = raw?.trim().startsWith('{') ? JSON.parse(raw) : {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    admin.initializeApp({ credential: admin.credential.cert(account) });
  }
  return { db: admin.firestore(), auth: admin.auth() };
}
async function requireUser(req, roles) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) throw Object.assign(new Error('Sign in required'), { status: 401 });
  const { db, auth } = services();
  let decoded;
  try { decoded = await auth.verifyIdToken(token, true); }
  catch { throw Object.assign(new Error('Session expired'), { status: 401 }); }
  if (decoded.firebase?.sign_in_provider === 'anonymous') throw Object.assign(new Error('Sign in required'), { status: 401 });
  const snapshot = await db.collection('users').doc(decoded.uid).get();
  const user = snapshot.data();
  if (!user?.isActive || (roles && !roles.includes(user.role))) throw Object.assign(new Error('Permission denied'), { status: 403 });
  return { ...user, id: snapshot.id };
}
module.exports = { services, requireUser };
