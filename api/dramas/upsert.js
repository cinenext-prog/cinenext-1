import { badRequest, ensureMethod, parseJsonBody } from '../_lib/http.js';
import { ensureDatabaseSchema } from '../_lib/schema.js';
import { query } from '../_lib/db.js';

const verifyAdmin = (req) => {
  const token = String(process.env.ADMIN_WRITE_TOKEN || '').trim();
  if (!token) {
    return false;
  }

  const fromHeader = String(req.headers['x-admin-token'] || '').trim();
  return fromHeader === token;
};

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await ensureDatabaseSchema();
    const body = parseJsonBody(req.body);

    const slug = String(body.slug || '').trim().toLowerCase();
    const title = String(body.title || '').trim();
    const synopsis = String(body.synopsis || '').trim();
    const status = String(body.status || 'draft').trim();

    if (!slug || !title) {
      return badRequest(res, 'Missing required fields: slug, title');
    }

    const { rows } = await query(
      `
      INSERT INTO dramas (slug, title, synopsis, status, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (slug)
      DO UPDATE SET
        title = EXCLUDED.title,
        synopsis = EXCLUDED.synopsis,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, slug, title, synopsis, status
      `,
      [slug, title, synopsis, status]
    );

    return res.status(200).json({ drama: rows[0] });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to upsert drama',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
