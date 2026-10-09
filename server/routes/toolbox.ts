import { encrypt } from '../lib/secrets';
import { validate } from '../lib/validation';
import { z } from 'zod';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { uid, WORKSPACE_ID } from '../lib/helpers';

export const toolboxRouter = Router();

// ─── MCP Servers ──────────────────────────────────────────

toolboxRouter.get('/mcp', async (req, res) => {
  try {
    const items = await db.select().from(schema.toolboxMcp)
      .where(eq(schema.toolboxMcp.workspaceId, WORKSPACE_ID));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.put('/mcp', async (req, res) => {
  try {
    const { name, url, authToken } = req.body;
    const [existing] = await db.select().from(schema.toolboxMcp)
      .where(eq(schema.toolboxMcp.workspaceId, WORKSPACE_ID));

    if (existing) {
      await db.update(schema.toolboxMcp).set({ name, url, authToken: authToken ?? null, status: 'disconnected' })
        .where(eq(schema.toolboxMcp.id, existing.id));
      const [item] = await db.select().from(schema.toolboxMcp).where(eq(schema.toolboxMcp.id, existing.id));
      return res.json(item);
    }

    const id = uid();
    await db.insert(schema.toolboxMcp).values({ id, workspaceId: WORKSPACE_ID, name, url, authToken: authToken ?? null, status: 'disconnected' });
    const [item] = await db.select().from(schema.toolboxMcp).where(eq(schema.toolboxMcp.id, id));
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.post('/mcp/test', (_req, res) => res.status(503).json({ error: 'MCP execution is not configured. Saving a URL does not verify a connection.' }));

// ─── Auth Contexts ────────────────────────────────────────

toolboxRouter.get('/auth', async (req, res) => {
  try {
    const items = await db.select().from(schema.toolboxAuth)
      .where(eq(schema.toolboxAuth.workspaceId, WORKSPACE_ID));
    res.json(items.map(({ password, cookieString, ...rest }) => ({ ...rest, hasPassword: !!password, hasCookies: !!cookieString })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.post('/auth', validate(z.object({name:z.string().trim().min(1),email:z.string().email(),password:z.string().optional(),oauthProvider:z.string().optional(),cookieString:z.string().optional()})), async (req, res) => {
  try {
    const { name, email, password, oauthProvider, cookieString } = req.body;
    const id = uid();
    await db.insert(schema.toolboxAuth).values({
      id, workspaceId: WORKSPACE_ID, name, email,
      password: password ? encrypt(password) : null,
      oauthProvider: oauthProvider ?? null,
      cookieString: cookieString ? encrypt(cookieString) : null,
    });
    const [item] = await db.select().from(schema.toolboxAuth).where(eq(schema.toolboxAuth.id, id));
    const { password: _pw, cookieString: _cookies, ...safe } = item;
    res.status(201).json(safe);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.delete('/auth/:id', async (req, res) => {
  try {
    await db.delete(schema.toolboxAuth).where(eq(schema.toolboxAuth.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Secrets ─────────────────────────────────────────────

toolboxRouter.get('/secrets', async (req, res) => {
  try {
    const items = await db.select({
      id: schema.toolboxSecrets.id,
      workspaceId: schema.toolboxSecrets.workspaceId,
      key: schema.toolboxSecrets.key,
    }).from(schema.toolboxSecrets).where(eq(schema.toolboxSecrets.workspaceId, WORKSPACE_ID));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.post('/secrets', validate(z.object({ key:z.string().regex(/^[A-Z][A-Z0-9_]*$/), value:z.string().min(1) })), async (req, res) => {
  try {
    const { key, value: rawValue } = req.body;
    const value = encrypt(rawValue);
    const duplicate = await db.select().from(schema.toolboxSecrets).where(eq(schema.toolboxSecrets.key, key));
    if (duplicate.length) return res.status(409).json({ error: 'This secret key already exists. Delete it before replacing it.' });
    const id = uid();
    await db.insert(schema.toolboxSecrets).values({ id, workspaceId: WORKSPACE_ID, key, value });
    res.status(201).json({ id, workspaceId: WORKSPACE_ID, key });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.delete('/secrets/:id', async (req, res) => {
  try {
    await db.delete(schema.toolboxSecrets).where(eq(schema.toolboxSecrets.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Browser Config ───────────────────────────────────────

toolboxRouter.get('/browser', async (req, res) => {
  try {
    const [config] = await db.select().from(schema.toolboxBrowser)
      .where(eq(schema.toolboxBrowser.workspaceId, WORKSPACE_ID));
    res.json(config ?? { headless: true, slowMo: 0, timeout: 30000, screenshots: 'on-failure' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

toolboxRouter.put('/browser', async (req, res) => {
  try {
    const { headless, slowMo, timeout, screenshots } = req.body;
    const [existing] = await db.select().from(schema.toolboxBrowser)
      .where(eq(schema.toolboxBrowser.workspaceId, WORKSPACE_ID));

    if (existing) {
      await db.update(schema.toolboxBrowser).set({ headless, slowMo, timeout, screenshots })
        .where(eq(schema.toolboxBrowser.id, existing.id));
    } else {
      await db.insert(schema.toolboxBrowser).values({ id: uid(), workspaceId: WORKSPACE_ID, headless, slowMo, timeout, screenshots });
    }

    const [config] = await db.select().from(schema.toolboxBrowser)
      .where(eq(schema.toolboxBrowser.workspaceId, WORKSPACE_ID));
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
