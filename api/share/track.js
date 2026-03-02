import { requireTelegramUser } from '../_lib/auth.js';
import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { query } from '../_lib/db.js';

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
    const refCode = String(body.refCode || '').trim() || null;

    if (!videoId) {
      return badRequest(res, 'Missing required field: videoId');
    }

    await query('INSERT INTO shares (user_id, video_id, ref_code) VALUES ($1, $2, $3)', [
      auth.user.id,
      videoId,
      refCode,
    ]);

    const countResult = await query('SELECT COUNT(*)::INT AS count FROM shares WHERE video_id = $1', [videoId]);
    const shares = Number(countResult.rows[0]?.count || 0);

    return res.status(201).json({
      videoId,
      shares,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to track share event',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
