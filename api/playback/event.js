import { requireTelegramUser } from '../_lib/auth.js';
import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { query } from '../_lib/db.js';

const ALLOWED_TYPES = new Set(['play', 'pause', 'progress', 'ended', 'error']);

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const body = parseJsonBody(req.body);
    const videoId = String(body.videoId || '').trim();
    const eventType = String(body.eventType || '').trim();
    const positionSeconds = Number(body.positionSeconds || 0);
    const payload = typeof body.payload === 'object' && body.payload ? body.payload : {};

    if (!videoId) {
      return badRequest(res, 'Missing required field: videoId');
    }

    if (!ALLOWED_TYPES.has(eventType)) {
      return badRequest(res, 'Invalid eventType');
    }

    const { rows } = await query(
      `
      INSERT INTO playback_events (user_id, video_id, event_type, position_seconds, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id, video_id, event_type, position_seconds, created_at
      `,
      [
        auth.user.id,
        videoId,
        eventType,
        Number.isFinite(positionSeconds) ? Math.max(0, Math.floor(positionSeconds)) : null,
        JSON.stringify(payload),
      ]
    );

    return res.status(201).json({ event: rows[0] });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to record playback event',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
