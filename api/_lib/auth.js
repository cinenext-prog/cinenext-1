import { query } from './db.js';
import { parseJsonBody } from './http.js';
import { ensureDatabaseSchema } from './schema.js';
import { verifyTelegramInitData } from './telegram.js';

const pickInitData = (req, body) => {
  const headerInitData = String(req.headers['x-telegram-init-data'] || '').trim();
  if (headerInitData) return headerInitData;

  const bodyInitData = String(body?.initData || '').trim();
  if (bodyInitData) return bodyInitData;

  const queryInitData = String(req.query?.initData || '').trim();
  if (queryInitData) return queryInitData;

  return '';
};

const upsertUser = async (telegramUser) => {
  const { rows } = await query(
    `
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code, photo_url, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        photo_url = EXCLUDED.photo_url,
        updated_at = NOW()
      RETURNING id, telegram_id, username, first_name, last_name, language_code, photo_url, wallet_address
    `,
    [
      Number(telegramUser.id),
      telegramUser.username || null,
      telegramUser.first_name || null,
      telegramUser.last_name || null,
      telegramUser.language_code || null,
      telegramUser.photo_url || null,
    ]
  );

  return rows[0];
};

export const requireTelegramUser = async (req) => {
  await ensureDatabaseSchema();

  const body = parseJsonBody(req.body);
  const initData = pickInitData(req, body);
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();

  if (!botToken) {
    return { ok: false, status: 500, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  const verified = verifyTelegramInitData({
    initData,
    botToken,
    maxAgeSeconds: Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE || 86400),
  });

  if (!verified.ok) {
    return { ok: false, status: 401, error: verified.error };
  }

  const user = await upsertUser(verified.user);
  return {
    ok: true,
    user,
    telegramUser: verified.user,
  };
};
