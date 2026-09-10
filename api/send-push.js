let webpush;
try {
  webpush = require('web-push');
} catch (e) {
  // Fallback: will return error below
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://bchjkyavanfaegdbewnj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjaGpreWF2YW5mYWVnZGJld25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDEyOTYsImV4cCI6MjA5MTQxNzI5Nn0.WdN1sJeLxwBJ0HlJN_nmvwhvx6xsV1NY-nCH_jHVgVQ';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      webpush: !!webpush,
      hasVapidPublic: !!process.env.VAPID_PUBLIC_KEY,
      hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!webpush) return res.status(500).json({ error: 'web-push module not available' });

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: 'VAPID keys missing from env' });

  try {
    webpush.setVapidDetails('mailto:admin@showmeitaly.com', vapidPublic, vapidPrivate);
  } catch (e) {
    return res.status(500).json({ error: 'VAPID setup failed: ' + e.message });
  }

  const { userId, title, body, tag } = req.body || {};
  if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: 'DB: ' + error.message });
    if (!subs || subs.length === 0) return res.status(200).json({ sent: 0, message: 'No subscriptions' });

    const payload = JSON.stringify({ title, body: body || '', tag: tag || 'smi' });
    let sent = 0;
    const errors = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err) {
        errors.push({ id: sub.id, status: err.statusCode, msg: err.message });
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }

    return res.status(200).json({ sent, total: subs.length, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
