import { createRuns } from '../lib/create-run';
import { validate } from '../lib/validation';
import { z } from 'zod';
const suiteSchema = z.object({name:z.string().trim().min(1).max(200),projectId:z.string().nullable().optional(),testIds:z.array(z.string()).max(100).default([]),triggers:z.object({onPr:z.boolean(),onDeploy:z.boolean(),scheduled:z.boolean()}).optional(),parallel:z.boolean().optional(),maxConcurrency:z.number().int().positive().optional(),retryFailedTests:z.enum(['none','once','twice']).optional()});
import { pageNumber } from '../lib/validation';
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { uid, now, WORKSPACE_ID, parseJson, toJson } from '../lib/helpers';
import { executeRun, selectedViewports } from '../lib/runner';

export const suitesRouter = Router();

// GET /api/suites
suitesRouter.get('/', async (req, res) => {
  try {
    const { q, projectId } = req.query as Record<string, string>;
    let all = await db.select().from(schema.suites)
      .where(eq(schema.suites.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.suites.createdAt));

    if (q) all = all.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
    if (projectId) all = all.filter(s => projectId === '__team__' ? !s.projectId : s.projectId === projectId);

    res.json({ items: all.map(deserializeSuite) });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/suites
suitesRouter.post('/', validate(suiteSchema), async (req, res) => {
  try {
    const body = req.body;
    const id = uid();

    await db.insert(schema.suites).values({
      id,
      workspaceId: WORKSPACE_ID,
      projectId: body.projectId ?? null,
      name: body.name,
      testIdsJson: toJson(body.testIds ?? []),
      triggersJson: toJson(body.triggers ?? { onPr: false, onDeploy: false, scheduled: false }),
      parallel: body.parallel ?? false,
      maxConcurrency: body.maxConcurrency ?? null,
      retryFailedTests: body.retryFailedTests ?? 'none',
      status: 'never_run',
      createdAt: now(),
    });

    const [suite] = await db.select().from(schema.suites).where(eq(schema.suites.id, id));
    res.status(201).json(deserializeSuite(suite));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/suites/runs/:suiteRunId — must be before /:id
suitesRouter.get('/runs/:suiteRunId', async (req, res) => {
  try {
    const [suiteRun] = await db.select().from(schema.suiteRuns)
      .where(eq(schema.suiteRuns.id, req.params.suiteRunId));
    if (!suiteRun) return res.status(404).json({ error: 'Not found' });

    const results = await db.select().from(schema.suiteRunResults)
      .where(eq(schema.suiteRunResults.suiteRunId, req.params.suiteRunId));

    res.json({ ...suiteRun, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/suites/:id
suitesRouter.get('/:id', async (req, res) => {
  try {
    const [suite] = await db.select().from(schema.suites).where(eq(schema.suites.id, String(req.params.id)));
    if (!suite) return res.status(404).json({ error: 'Not found' });
    res.json(deserializeSuite(suite));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/suites/:id
suitesRouter.patch('/:id', validate(suiteSchema.partial()), async (req, res) => {
  try {
    const body = req.body;
    const [existing] = await db.select().from(schema.suites).where(eq(schema.suites.id, String(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Suite not found' });
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.testIds !== undefined) updates.testIdsJson = toJson(body.testIds);
    if (body.triggers !== undefined) updates.triggersJson = toJson(body.triggers);
    if (body.parallel !== undefined) updates.parallel = body.parallel;
    if (body.maxConcurrency !== undefined) updates.maxConcurrency = body.maxConcurrency;
    if (body.retryFailedTests !== undefined) updates.retryFailedTests = body.retryFailedTests;

    if (Object.keys(updates).length > 0) {
      await db.update(schema.suites).set(updates as any).where(eq(schema.suites.id, String(req.params.id)));
    }

    const [suite] = await db.select().from(schema.suites).where(eq(schema.suites.id, String(req.params.id)));
    res.json(deserializeSuite(suite));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/suites/:id
suitesRouter.delete('/:id', async (req, res) => {
  try {
    await db.delete(schema.suites).where(eq(schema.suites.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/suites/:id/runs
suitesRouter.post('/:id/runs', async (req, res) => {
  try {
    const [suite] = await db.select().from(schema.suites).where(eq(schema.suites.id, String(req.params.id)));
    if (!suite) return res.status(404).json({ error: 'Not found' });

    const testIds = [...new Set(parseJson<string[]>(suite.testIdsJson, []))];
    if (!testIds.length) return res.status(400).json({ error: 'Add tests before running this suite' });
    for (const testId of testIds) {
      const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, testId));
      if (!test || test.archived || test.projectId !== suite.projectId) return res.status(409).json({ error: 'Suite contains a missing, archived, or out-of-project test. Edit its test list before running.' });
    }
    const launched: string[] = [];
    const suiteRunId = uid();
    const startedAt = now();

    await db.insert(schema.suiteRuns).values({
      id: suiteRunId,
      suiteId: String(req.params.id),
      status: 'running',
      startedAt,
      triggeredBy: req.body.triggeredBy ?? 'manual',
    });

    await db.update(schema.suites).set({ status: 'failing', lastRunAt: startedAt, lastRunId: suiteRunId })
      .where(eq(schema.suites.id, String(req.params.id)));

    for (const testId of testIds) {
      const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, testId));
      if (!test) continue;

      const created = await createRuns(test, { suiteRunId, triggeredBy: 'suite' });
      launched.push(...created.map(r => r.id));
    }

    void (async () => { for (const id of launched) await executeRun(id); })().catch(console.error);
    const [suiteRun] = await db.select().from(schema.suiteRuns).where(eq(schema.suiteRuns.id, suiteRunId));
    const results = await db.select().from(schema.suiteRunResults)
      .where(eq(schema.suiteRunResults.suiteRunId, suiteRunId));

    res.status(201).json({ ...suiteRun, results });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/suites/:id/runs
suitesRouter.get('/:id/runs', async (req, res) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const all = await db.select().from(schema.suiteRuns)
      .where(eq(schema.suiteRuns.suiteId, String(req.params.id)))
      .orderBy(desc(schema.suiteRuns.startedAt));

    const pageNum = pageNumber(page);
    const pageSize = 20;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    res.json({ items, total: all.length, page: pageNum });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function deserializeSuite(s: typeof schema.suites.$inferSelect) {
  return {
    ...s,
    testIds: parseJson<string[]>(s.testIdsJson, []),
    triggers: parseJson(s.triggersJson, { onPr: false, onDeploy: false, scheduled: false }),
  };
}
