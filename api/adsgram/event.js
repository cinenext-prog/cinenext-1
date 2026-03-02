import { ensureMethod, parseJsonBody, badRequest } from '../_lib/http.js';
import { ensureDatabaseSchema } from '../_lib/schema.js';
import { query } from '../_lib/db.js';

const ALLOWED_TYPES = new Set(['impression', 'click', 'reward', 'close', 'error']);

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  try {
    await ensureDatabaseSchema();

    const body = parseJsonBody(req.body);
    const eventType = String(body.eventType || '').trim();
    const videoId = String(body.videoId || '').trim() || null;
    const telegramId = Number(body.telegramId || 0) || null;
    const payload = typeof body.payload === 'object' && body.payload ? body.payload : {};

    if (!ALLOWED_TYPES.has(eventType)) {
      return badRequest(res, 'Invalid eventType');
    }

    let userId = null;
    if (telegramId) {
      const userLookup = await query('SELECT id FROM users WHERE telegram_id = $1 LIMIT 1', [telegramId]);
      userId = userLookup.rows[0]?.id || null;
    }

    const { rows } = await query(
      `
      INSERT INTO ad_events (user_id, video_id, provider, event_type, payload)
      VALUES ($1, $2, 'adsgram', $3, $4::jsonb)
      RETURNING id, user_id, video_id, event_type, created_at
      `,
      [userId, videoId, eventType, JSON.stringify(payload)]
    );

    return res.status(201).json({ event: rows[0] });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to record AdsGram event',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
