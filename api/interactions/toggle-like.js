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

    if (!videoId) {
      return badRequest(res, 'Missing required field: videoId');
    }

    const inserted = await query(
      'INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id',
      [auth.user.id, videoId]
    );

    let liked = false;
    if (inserted.rowCount > 0) {
      liked = true;
    } else {
      await query('DELETE FROM likes WHERE user_id = $1 AND video_id = $2', [auth.user.id, videoId]);
    }

    const countResult = await query('SELECT COUNT(*)::INT AS count FROM likes WHERE video_id = $1', [videoId]);
    const likes = Number(countResult.rows[0]?.count || 0);

    return res.status(200).json({
      videoId,
      liked,
      likes,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to toggle like',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
