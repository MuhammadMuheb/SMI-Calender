// Persisted in-app notifications are the source of truth. Push is a retryable delivery channel.
async function flushWorkPush(db) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    // Firebase's scheduler delegates push to Vercel, where the existing VAPID keys live.
    if (process.env.WORK_PUSH_URL && process.env.WORK_PUSH_SECRET) {
      const response = await fetch(process.env.WORK_PUSH_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.WORK_PUSH_SECRET }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Push relay unavailable');
      return response.json();
    }
    return { configured: false };
  }
  const webpush = require('web-push');
  webpush.setVapidDetails('mailto:admin@showmeitaly.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const pending = await db.collection('notifications').where('pushPending', '==', true).limit(40).get();
  let sent = 0;
  const deadline = Date.now() + 8000;
  for (const item of pending.docs) {
    if (Date.now() > deadline) break;
    const n = item.data();
    // Exclude notifications from other features or untrusted client-created entries.
    if (n.entityType !== 'work_arrangement' || !n.createdAt) continue;
    const sub = (await db.collection('push_subscriptions').doc(n.userId).get()).data();
    if (!sub?.endpoint || !sub.auth || !sub.p256dh) { await item.ref.update({ pushPending: false, pushDelivery: 'no_subscription' }); continue; }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, JSON.stringify({ title: n.title, body: n.body, tag: item.id }), { timeout: 3000 });
      await item.ref.update({ pushPending: false, pushDelivery: 'sent' }); sent++;
    } catch (e) {
      if ([404, 410].includes(e.statusCode)) await item.ref.update({ pushPending: false, pushDelivery: 'expired_subscription' });
      else await item.ref.update({ pushAttempts: (n.pushAttempts || 0) + 1, pushPending: (n.pushAttempts || 0) < 4, pushDelivery: 'retry' });
    }
  }
  return { configured: true, sent };
}
module.exports = { flushWorkPush };
