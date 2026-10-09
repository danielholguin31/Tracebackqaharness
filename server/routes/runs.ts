import { createRuns } from '../lib/create-run';
import { validate } from '../lib/validation';
import { z } from 'zod';
import { pageNumber } from '../lib/validation';
import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { uid, now, WORKSPACE_ID } from '../lib/helpers';
import { executeRun, abortRun, pauseRun, resumeRun, selectedViewports } from '../lib/runner';

export const runsRouter = Router();

// GET /api/runs
runsRouter.get('/', async (req, res) => {
  try {
    const { q, status, branch, testId, projectId, page = '1' } = req.query as Record<string, string>;
    let all = await db.select().from(schema.runs)
      .where(eq(schema.runs.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.runs.startedAt));

    if (status && status !== 'all') {
      if (status === 'failures') all = all.filter(r => r.status === 'failed');
      else if (status === 'healed') all = all.filter(r => r.status === 'healed');
      else all = all.filter(r => r.status === status);
    }
    if (branch) all = all.filter(r => r.branch === branch);
    if (testId) all = all.filter(r => r.testId === testId);
    if (projectId) all = all.filter(r => projectId === '__team__' ? !r.projectId : r.projectId === projectId);
    if (q) all = all.filter(r => r.testName.toLowerCase().includes(q.toLowerCase()));

    const pageNum = pageNumber(page);
    const pageSize = 50;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    res.json({ items, total: all.length, page: pageNum });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// POST /api/runs
runsRouter.post('/', validate(z.object({testId:z.string().min(1),environment:z.enum(['production','staging','local']).optional(),triggeredBy:z.enum(['manual','webhook','pr','deploy','schedule','operator']).optional(),viewport:z.enum(['desktop','tablet','mobile']).optional()})), async (req, res) => {
  try {
    const { testId, environment, triggeredBy = 'manual', triggeredByUser, suiteRunId } = req.body;

    const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, testId));
    if (!test) return res.status(404).json({ error: 'Test not found' });
    if (test.archived) return res.status(409).json({ error: 'Archived tests cannot run' });
    if (suiteRunId) return res.status(400).json({ error: 'Use the suite run endpoint' });

    const created = await createRuns(test, { environment, triggeredBy, viewport: req.body.viewport });
    for (const run of created) void executeRun(run.id).catch(console.error);
    res.status(201).json({ ...created[0], runIds: created.map(r => r.id) });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// GET /api/runs/:id
runsRouter.get('/:id', async (req, res) => {
  try {
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Not found' });

    const activityLog = (await db.select().from(schema.activityLogs)
      .where(eq(schema.activityLogs.runId, req.params.id)))
      .sort((a, b) => a.step - b.step);

    const runReports = await db.select().from(schema.reports)
      .where(eq(schema.reports.runId, req.params.id));

    res.json({ ...run, activityLog, reports: runReports });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// GET /api/runs/:id/status
runsRouter.get('/:id/status', async (req, res) => {
  try {
    const [run] = await db.select({
      status: schema.runs.status,
      screenshotCount: schema.runs.screenshotCount,
      issueCount: schema.runs.issueCount,
    }).from(schema.runs).where(eq(schema.runs.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Not found' });

    const logs = await db.select().from(schema.activityLogs)
      .where(eq(schema.activityLogs.runId, req.params.id));

    res.json({ ...run, currentStep: logs.length });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// POST /api/runs/:id/pause
runsRouter.post('/:id/pause', async (req, res) => {
  try {
    await pauseRun(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// POST /api/runs/:id/resume
runsRouter.post('/:id/resume', async (req, res) => {
  try {
    const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (run.status !== 'paused') return res.status(409).json({ error: 'Run is not paused' });
    if (req.body.extraCredits) {
      const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, run.testId));
      const extra = Number(req.body.extraCredits);
      if (!Number.isInteger(extra) || extra < 1 || extra > 10000) return res.status(400).json({ error: 'Invalid credit extension' });
      await db.update(schema.tests).set({ estimatedCredits: (test.estimatedCredits || 50) + extra }).where(eq(schema.tests.id, run.testId));
    }
    await resumeRun(run.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// POST /api/runs/:id/abort
runsRouter.post('/:id/abort', async (req, res) => {
  try {
    await abortRun(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

// DELETE /api/runs/:id
runsRouter.delete('/:id', async (req, res) => {
  try {
    await abortRun(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(/not found/i.test(String(err)) ? 404 : /not active|not paused|already completed/i.test(String(err)) ? 409 : 500).json({ error: String(err) });
  }
});

runsRouter.post('/:id/heals/:logId/apply', async (req,res) => {
  const [run] = await db.select().from(schema.runs).where(eq(schema.runs.id,String(req.params.id)));
  const [log] = await db.select().from(schema.activityLogs).where(and(eq(schema.activityLogs.id,String(req.params.logId)),eq(schema.activityLogs.runId,String(req.params.id))));
  if (!run || !log) return res.status(404).json({error:'Run or repair not found'});
  let repair: any; try { repair=JSON.parse(log.action); } catch { return res.status(400).json({error:'This log does not contain a selector repair'}); }
  if(repair.kind!=='heal')return res.status(400).json({error:'This log is not a repair'});
  const changed=await db.update(schema.testSteps).set({target:repair.target,css:true}).where(and(eq(schema.testSteps.id,repair.stepId),eq(schema.testSteps.testId,run.testId),eq(schema.testSteps.target,repair.originalTarget))).returning();
  if(!changed.length)return res.status(409).json({error:'The step has changed since this run. Review its current definition.'});
  await db.update(schema.tests).set({version:sql`${schema.tests.version}+1`}).where(eq(schema.tests.id,run.testId));
  res.json({ok:true});
});
