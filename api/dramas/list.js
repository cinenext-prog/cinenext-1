import { ensureMethod } from '../_lib/http.js';
import { ensureDatabaseSchema } from '../_lib/schema.js';
import { query } from '../_lib/db.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'GET')) {
    return;
  }

  try {
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
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to list dramas',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
