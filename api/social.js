import { requireTelegramUser } from './_lib/auth.js';
import { badRequest, parseJsonBody } from './_lib/http.js';
import { query } from './_lib/db.js';

const MAX_COMMENT_LENGTH = 280;

const toggleLike = async (req, res, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
};

const createComment = async (req, res, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
};

const trackShare = async (req, res, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = parseJsonBody(req.body);
  const videoId = String(body.videoId || '').trim();
  const refCode = String(body.refCode || '').trim() || null;

  if (!videoId) {
    return badRequest(res, 'Missing required field: videoId');
  }

  await query('INSERT INTO shares (user_id, video_id, ref_code) VALUES ($1, $2, $3)', [auth.user.id, videoId, refCode]);

  const countResult = await query('SELECT COUNT(*)::INT AS count FROM shares WHERE video_id = $1', [videoId]);
  const shares = Number(countResult.rows[0]?.count || 0);

  return res.status(201).json({
    videoId,
    shares,
  });
};

export default async function handler(req, res) {
  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    const action = String(req.query?.action || '').trim().toLowerCase();

    if (action === 'toggle-like') {
      return await toggleLike(req, res, auth);
    }

    if (action === 'create-comment') {
      return await createComment(req, res, auth);
    }

    if (action === 'track-share') {
      return await trackShare(req, res, auth);
    }

    return res.status(404).json({ error: 'Unknown social action' });
  } catch (error) {
    return res.status(500).json({
      error: 'Social API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
