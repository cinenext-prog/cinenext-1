export const parseJsonBody = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export const readRequestBody = (req) => parseJsonBody(req.body);

export const ensureMethod = (req, res, method) => {
  if (req.method !== method) {
    res.status(405).json({ error: 'Method Not Allowed' });
    return false;
  }

  return true;
};

export const badRequest = (res, message, details) => res.status(400).json({ error: message, details });

export const unauthorized = (res, message = 'Unauthorized') => res.status(401).json({ error: message });
