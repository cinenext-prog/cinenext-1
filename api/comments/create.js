import { requireTelegramUser } from '../_lib/auth.js';
import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { query } from '../_lib/db.js';

const MAX_COMMENT_LENGTH = 280;

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
    const content = String(body.content || '').trim();

    if (!videoId) {
      return badRequest(res, 'Missing required field: videoId');
    }

    if (!content) {
      return badRequest(res, 'Missing required field: content');
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      return badRequest(res, `Comment too long (max ${MAX_COMMENT_LENGTH})`);
    }

    const inserted = await query(
      `
      INSERT INTO comments (user_id, video_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, video_id, content, created_at
      `,
      [auth.user.id, videoId, content]
    );

    const countResult = await query('SELECT COUNT(*)::INT AS count FROM comments WHERE video_id = $1', [videoId]);
    const comments = Number(countResult.rows[0]?.count || 0);

    return res.status(201).json({
      comment: inserted.rows[0],
      comments,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to create comment',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
