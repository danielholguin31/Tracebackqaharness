import { validate } from '../lib/validation';
import { z } from 'zod';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { db, schema } from '../db';
import { uid, now, WORKSPACE_ID, OWNER_ID } from '../lib/helpers';

export const workspaceRouter = Router();

// GET /api/workspace
workspaceRouter.get('/', async (req, res) => {
  try {
    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, WORKSPACE_ID));
    if (!ws) return res.status(404).json({ error: 'Not found' });
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/workspace
workspaceRouter.patch('/', validate(z.object({name:z.string().trim().min(1).max(100).optional(),slug:z.string().regex(/^[a-z0-9-]+$/).optional()})), async (req, res) => {
  try {
    const { name, slug } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;

    await db.update(schema.workspaces).set(updates as any).where(eq(schema.workspaces.id, WORKSPACE_ID));
    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, WORKSPACE_ID));
    res.json(ws);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/workspace/members
workspaceRouter.get('/members', async (req, res) => {
  try {
    const members = await db.select().from(schema.users)
      .where(eq(schema.users.workspaceId, WORKSPACE_ID));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Identity-provider invitations are intentionally unavailable in owner mode.
workspaceRouter.post('/invites', (_req,res) => res.status(503).json({error:'Member invitations require an identity provider. No invitation was sent.'}));

// PATCH /api/workspace/members/:id
workspaceRouter.patch('/members/:id', async (req, res) => {
  try {
    const { role } = req.body;
    await db.update(schema.users).set({ role }).where(eq(schema.users.id, req.params.id));
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.params.id));
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/workspace/members/:id
workspaceRouter.delete('/members/:id', async (req, res) => {
  try {
    if (req.params.id === OWNER_ID) return res.status(409).json({error:'The workspace owner cannot be removed'});
    await db.delete(schema.users).where(eq(schema.users.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/workspace/api-keys
workspaceRouter.get('/api-keys', async (req, res) => {
  try {
    const keys = await db.select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      createdAt: schema.apiKeys.createdAt,
    }).from(schema.apiKeys).where(eq(schema.apiKeys.workspaceId, WORKSPACE_ID));
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/workspace/api-keys
workspaceRouter.post('/api-keys', validate(z.object({name:z.string().trim().min(1).max(100)})), async (req, res) => {
  try {
    const { name } = req.body;
    const rawKey = `tb_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 10);
    const id = uid();
    const createdAt = now();

    await db.insert(schema.apiKeys).values({
      id, workspaceId: WORKSPACE_ID, name, keyHash, keyPrefix, createdAt,
    });

    res.status(201).json({ id, name, key: rawKey, keyPrefix, createdAt });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/workspace/api-keys/:id
workspaceRouter.delete('/api-keys/:id', async (req, res) => {
  try {
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/workspace/me
workspaceRouter.get('/me', async (req, res) => {
  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, OWNER_ID));
    res.json(user ?? null);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/workspace/integrations
workspaceRouter.get('/integrations', async (req, res) => {
  try {
    const [integ] = await db.select().from(schema.integrations)
      .where(eq(schema.integrations.workspaceId, WORKSPACE_ID));
    if (!integ) return res.json({ github: { installed: false }, linear: { installed: false }, jira: { installed: false }, slack: { installed: false } });

    res.json({
      github: JSON.parse(integ.githubJson),
      linear: JSON.parse(integ.linearJson),
      jira: JSON.parse(integ.jiraJson),
      slack: JSON.parse(integ.slackJson),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
