import crypto from 'crypto';

const parseInitData = (initData) => {
  const params = new URLSearchParams(String(initData || ''));
  const hash = params.get('hash') || '';

  const items = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    items.push([key, value]);
  }

  items.sort(([left], [right]) => left.localeCompare(right));

  const dataCheckString = items.map(([key, value]) => `${key}=${value}`).join('\n');
  const asObject = Object.fromEntries(items);

  return {
    hash,
    dataCheckString,
    data: asObject,
    user: asObject.user ? JSON.parse(asObject.user) : null,
  };
};

export const verifyTelegramInitData = ({ initData, botToken, maxAgeSeconds = 86400 }) => {
  if (!initData || !botToken) {
    return { ok: false, error: 'Missing initData or bot token' };
  }

  let parsed;
  try {
    parsed = parseInitData(initData);
  } catch {
    return { ok: false, error: 'Invalid initData format' };
  }

  const { hash, dataCheckString, data, user } = parsed;
  if (!hash || !dataCheckString || !user?.id) {
    return { ok: false, error: 'initData missing required fields' };
  }

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  const left = Buffer.from(calculatedHash, 'hex');
  const right = Buffer.from(hash, 'hex');
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { ok: false, error: 'Invalid Telegram hash' };
  }

  const authDate = Number(data.auth_date || 0);
  if (!authDate) {
    return { ok: false, error: 'Missing auth_date' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    return { ok: false, error: 'Expired Telegram initData' };
  }

  return {
    ok: true,
    data,
    user,
  };
};
