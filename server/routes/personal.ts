import { validate, url } from '../lib/validation';
import { z } from 'zod';
const projectSchema = z.object({name:z.string().trim().min(1).max(100),baseUrl:url,color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),pinned:z.boolean().optional()});
import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db, schema } from '../db';
import { uid, now, WORKSPACE_ID, OWNER_ID } from '../lib/helpers';

export const personalRouter = Router();

// GET /api/personal/projects
personalRouter.get('/projects', async (req, res) => {
  try {
    const projects = await db.select().from(schema.personalProjects)
      .where(and(
        eq(schema.personalProjects.workspaceId, WORKSPACE_ID),
        eq(schema.personalProjects.ownerId, OWNER_ID),
      ))
      .orderBy(desc(schema.personalProjects.lastActiveAt));

    const allRuns = await db.select().from(schema.runs);
    const allIssues = await db.select().from(schema.issues);

    const enriched = projects.map(p => {
      const projectRuns = allRuns.filter(r => r.projectId === p.id);
      const openIssues = allIssues.filter(i => i.projectId === p.id && i.status === 'open');

      return {
        ...p,
        stats: {
          totalRuns: projectRuns.length,
          passingTests: projectRuns.filter(r => r.status === 'passed').length,
          failingTests: projectRuns.filter(r => r.status === 'failed').length,
          openIssues: openIssues.length,
        },
        recentRuns: projectRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5),
        openIssues: openIssues.slice(0, 5),
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/personal/projects
personalRouter.post('/projects', validate(projectSchema), async (req, res) => {
  try {
    const { name, baseUrl, color = '#7B8FC2' } = req.body;
    const existing = await db.select().from(schema.personalProjects).where(eq(schema.personalProjects.name, name));
    if (existing.length) return res.status(409).json({ error: 'A project with this name already exists' });
    const id = uid();
    const ts = now();

    await db.insert(schema.personalProjects).values({
      id,
      ownerId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      name,
      baseUrl,
      color,
      pinned: false,
      createdAt: ts,
      lastActiveAt: ts,
    });

    const [project] = await db.select().from(schema.personalProjects).where(eq(schema.personalProjects.id, id));
    res.status(201).json({ ...project, stats: { totalRuns: 0, passingTests: 0, failingTests: 0, openIssues: 0 }, recentRuns: [], openIssues: [] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/personal/projects/:id
personalRouter.get('/projects/:id', async (req, res) => {
  try {
    const [project] = await db.select().from(schema.personalProjects)
      .where(eq(schema.personalProjects.id, String(req.params.id)));
    if (!project) return res.status(404).json({ error: 'Not found' });

    const allRuns = await db.select().from(schema.runs)
      .where(eq(schema.runs.projectId, String(req.params.id)));
    const openIssues = await db.select().from(schema.issues)
      .where(and(eq(schema.issues.projectId, String(req.params.id)), eq(schema.issues.status, 'open')));

    res.json({
      ...project,
      stats: {
        totalRuns: allRuns.length,
        passingTests: allRuns.filter(r => r.status === 'passed').length,
        failingTests: allRuns.filter(r => r.status === 'failed').length,
        openIssues: openIssues.length,
      },
      recentRuns: allRuns.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5),
      openIssues: openIssues.slice(0, 5),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/personal/projects/:id
personalRouter.patch('/projects/:id', validate(projectSchema.partial()), async (req, res) => {
  try {
    const [existing] = await db.select().from(schema.personalProjects).where(eq(schema.personalProjects.id, String(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    const { name, color, pinned, baseUrl } = req.body;
    const updates: Record<string, unknown> = { lastActiveAt: now() };
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (pinned !== undefined) updates.pinned = pinned;
    if (baseUrl !== undefined) updates.baseUrl = baseUrl;

    await db.update(schema.personalProjects).set(updates as any)
      .where(eq(schema.personalProjects.id, String(req.params.id)));

    const [project] = await db.select().from(schema.personalProjects)
      .where(eq(schema.personalProjects.id, String(req.params.id)));
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/personal/projects/:id
personalRouter.delete('/projects/:id', async (req, res) => {
  try {
    const [project] = await db.select().from(schema.personalProjects).where(eq(schema.personalProjects.id, String(req.params.id)));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const active = await db.select().from(schema.runs).where(eq(schema.runs.projectId, String(req.params.id)));
    if (active.some(r => ['queued','initializing','running','paused'].includes(r.status))) return res.status(409).json({ error: 'Stop active runs before deleting this project' });
    await db.transaction(async tx => {
      await tx.update(schema.tests).set({ archived: true }).where(eq(schema.tests.projectId, String(req.params.id)));
      await tx.delete(schema.suites).where(eq(schema.suites.projectId, String(req.params.id)));
      await tx.delete(schema.personalProjects).where(eq(schema.personalProjects.id, String(req.params.id)));
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
