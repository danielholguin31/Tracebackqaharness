import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { db, schema } from './db';
import { eq } from 'drizzle-orm';
import type { Express, RequestHandler } from 'express';
const sessions = new Map<string, number>();
const attempts = new Map<string, { count: number; until: number }>();
const digest = (value: string) => createHash('sha256').update(value).digest();
export function installAuth(app: Express) {
  const password = process.env.TRACEBACK_PASSWORD;
  if (process.env.NODE_ENV === 'production' && !password) throw new Error('TRACEBACK_PASSWORD is required in production');
  const check = (cookie: string | undefined) => {
    const token = cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('traceback_session='))?.slice(18);
    const expiry = token && sessions.get(token);
    return Boolean(expiry && expiry > Date.now());
  };
  app.get('/api/auth/session', (req, res) => res.json({ authenticated: !password || check(req.headers.cookie), localMode: !password }));
  app.post('/api/auth/login', (req, res) => {
    if (!password) return res.json({ ok: true });
    const ip = req.ip || 'local';
    const state = attempts.get(ip);
    if (state && state.until > Date.now() && state.count >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    if (!timingSafeEqual(digest(String(req.body.password || '')), digest(password))) {
      attempts.set(ip, { count: state && state.until > Date.now() ? state.count + 1 : 1, until: Date.now() + 60000 });
      return res.status(401).json({ error: 'Incorrect password' });
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 86400000);
    for (const [id, expiry] of sessions) if (expiry < Date.now()) sessions.delete(id);
    res.setHeader('Set-Cookie', `traceback_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
    res.json({ ok: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('traceback_session='))?.slice(18);
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'traceback_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  const auth: RequestHandler = async (req, res, next) => {
    if (req.path === '/health') return next();
    let apiKeyValid = false;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const hash = createHash('sha256').update(req.headers.authorization.slice(7)).digest('hex');
      const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, hash));
      apiKeyValid = !!key;
      if (!apiKeyValid) return res.status(401).json({ error: 'Invalid or revoked API key' });
    }
    if (password && !apiKeyValid && !check(req.headers.cookie)) return res.status(401).json({ error: 'Sign in to access this workspace' });
    if (req.method !== 'GET' && req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin);
        const allowed = new Set([req.headers.host, ...(process.env.NODE_ENV !== 'production' ? ['localhost:5173','127.0.0.1:5173'] : []), ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).map(v => new URL(v).host)]);
        if (!allowed.has(origin.host)) return res.status(403).json({ error: 'Untrusted request origin' });
      } catch { return res.status(403).json({ error: 'Invalid request origin' }); }
    }
    next();
  };
  app.use('/api', auth);
}
