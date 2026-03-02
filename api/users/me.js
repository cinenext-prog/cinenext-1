import { ensureMethod } from '../_lib/http.js';
import { requireTelegramUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'GET')) {
    return;
  }

  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    return res.status(200).json({ user: auth.user });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get user profile',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
