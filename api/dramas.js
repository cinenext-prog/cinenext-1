import { badRequest, parseJsonBody } from './_lib/http.js';
import { ensureDatabaseSchema } from './_lib/schema.js';
import { query } from './_lib/db.js';

const verifyAdmin = (req) => {
  const token = String(process.env.ADMIN_WRITE_TOKEN || '').trim();
  if (!token) {
    return false;
  }

  const fromHeader = String(req.headers['x-admin-token'] || '').trim();
  return fromHeader === token;
};

const listDramas = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  await ensureDatabaseSchema();

  const { rows } = await query(
    `
    SELECT
      d.id,
      d.slug,
      d.title,
      d.synopsis,
      d.status,
      COALESCE(COUNT(e.id), 0)::INT AS episode_count
    FROM dramas d
    LEFT JOIN episodes e ON e.drama_id = d.id
    GROUP BY d.id
    ORDER BY d.created_at DESC
    `
  );

  return res.status(200).json({ dramas: rows });
};

const upsertDrama = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!verifyAdmin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

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
};

export default async function handler(req, res) {
  try {
    const action = String(req.query?.action || '').trim().toLowerCase();

    if (action === 'list') {
      return await listDramas(req, res);
    }

    if (action === 'upsert') {
      return await upsertDrama(req, res);
    }

    return res.status(404).json({ error: 'Unknown dramas action' });
  } catch (error) {
    return res.status(500).json({
      error: 'Dramas API failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
