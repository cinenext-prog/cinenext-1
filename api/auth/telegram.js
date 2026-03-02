import { ensureMethod } from '../_lib/http.js';
import { requireTelegramUser } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!ensureMethod(req, res, 'POST')) {
    return;
  }

  try {
    const auth = await requireTelegramUser(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    return res.status(200).json({
      user: auth.user,
      telegram: {
        id: auth.telegramUser.id,
        username: auth.telegramUser.username || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to authenticate Telegram user',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
