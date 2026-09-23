const { scryptSync, randomBytes, timingSafeEqual } = require('node:crypto');
function hashPin(pin) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(pin, salt, 64).toString('hex')}`;
}
function verifyPin(pin, stored) {
  if (typeof stored !== 'string') return false;
  if (/^\$2[aby]\$/.test(stored)) return require('bcryptjs').compareSync(pin, stored);
  if (!stored.startsWith('scrypt:')) return false;
  const [, salt, hex] = stored.split(':');
  const expected = Buffer.from(hex || '', 'hex');
  return expected.length === 64 && timingSafeEqual(scryptSync(pin, salt, 64), expected);
}
module.exports = { hashPin, verifyPin };
