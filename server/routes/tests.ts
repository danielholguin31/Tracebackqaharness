import { pageNumber } from '../lib/validation';
import { Router } from 'express';
import { validate, testSchema } from '../lib/validation';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { uid, now, WORKSPACE_ID, parseJson, toJson } from '../lib/helpers';
import { openai } from '../lib/openai';

export const testsRouter = Router();

// GET /api/tests
testsRouter.get('/', async (req, res) => {
  try {
    const { q, mode, archived, projectId, page = '1' } = req.query as Record<string, string>;
    let all = await db.select().from(schema.tests)
      .where(eq(schema.tests.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.tests.createdAt));

    if (archived !== 'true') all = all.filter(t => !t.archived);
    if (mode && mode !== 'all') all = all.filter(t => t.mode === mode);
    if (q) all = all.filter(t => t.name.toLowerCase().includes(q.toLowerCase()));
    if (projectId) all = all.filter(t => projectId === '__team__' ? !t.projectId : t.projectId === projectId);

    const pageNum = pageNumber(page);
    const pageSize = 50;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    res.json({ items: items.map(deserializeTest), total: all.length, page: pageNum });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tests
testsRouter.post('/', validate(testSchema), async (req, res) => {
  try {
    const body = req.body;
    if (body.mode === 'autonomous' && !body.customPrompt?.trim()) return res.status(400).json({error:'An autonomous goal is required'});
    if (body.mode === 'deterministic' && !body.steps?.length) return res.status(400).json({error:'Deterministic tests require at least one step'});
    if (body.projectId) {
      const [project] = await db.select().from(schema.personalProjects).where(eq(schema.personalProjects.id, body.projectId));
      if (!project) return res.status(404).json({error:'Project not found'});
    }
    const id = uid();
    const createdAt = now();

    await db.transaction(async tx => {
    await tx.insert(schema.tests).values({
      id,
      workspaceId: WORKSPACE_ID,
      projectId: body.projectId ?? null,
      name: body.name,
      mode: body.mode ?? 'autonomous',
      status: 'never_run',
      environment: body.environment ?? 'staging',
      entryPoint: body.entryPoint ?? '',
      auth: body.auth ?? '',
      runnerMode: body.runnerMode ?? 'standard',
      viewportJson: toJson(body.viewport ?? { mode: 'single', single: 'desktop' }),
      triggersJson: toJson(body.triggers ?? { onPr: false, onDeploy: false, scheduled: false }),
      suiteIdsJson: toJson(body.suiteIds ?? []),
      defaultReportsJson: toJson(body.defaultReports ?? ['standard']),
      customPrompt: body.customPrompt ?? null,
      estimatedCredits: body.estimatedCredits ?? null,
      tagsJson: toJson(body.tags ?? []),
      selfHealing: body.selfHealing ?? false,
      selfHealingSensitivity: body.selfHealingSensitivity ?? 'medium',
      screenshotOnFailure: body.screenshotOnFailure ?? true,
      createdAt,
      version: 1,
      archived: false,
    });

    if (body.steps && Array.isArray(body.steps)) {
      for (const step of body.steps) {
        await tx.insert(schema.testSteps).values({
          id: uid(),
          testId: id,
          order: step.order,
          action: step.action,
          isAiGenerated: step.isAiGenerated ?? false,
          generatedAction: step.generatedAction ?? '',
          type: step.type ?? 'click',
          target: step.target ?? '',
          value: step.value ?? '',
          css: step.css ?? false,
          stable: step.stable ?? true,
          pressEnter: step.pressEnter ?? false,
          captureScreenshot: step.captureScreenshot ?? false,
        });
      }
    }

    });

    const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, id));
    res.status(201).json(deserializeTest(test));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tests/estimate
testsRouter.post('/estimate', async (req, res) => {
  try {
    const { goal, mode, runnerMode, viewport } = req.body;
    const multiplier = runnerMode === 'fast' ? 0.5 : runnerMode === 'deep' ? 2 : 1;

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
      const steps = Math.min(25, Math.max(3, Math.ceil(String(goal || '').length / 40)));
      const credits = Math.ceil((steps + 2) * multiplier);
      return res.json({ credits, steps, breakdown: 'Estimated without AI (no API key)' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a test estimation assistant. Given a test goal, estimate the credits and steps needed. Reply with JSON only: {"credits": number, "steps": number, "breakdown": "short explanation"}' },
        { role: 'user', content: `Test goal: "${goal}"\nMode: ${mode}\nRunner: ${runnerMode}\nViewport: ${JSON.stringify(viewport)}` },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    result.credits = Math.round((result.credits ?? 5) * multiplier);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tests/parse-step
testsRouter.post('/generate-steps', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Configure OPENAI_API_KEY to generate steps' });
  try {
    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return JSON {steps:[{action:string,type:navigate|click|fill|assert|wait|screenshot,target:string,value:string}]}. Draft ordered QA steps for the user goal. Leave unknown selectors empty.' }, { role: 'user', content: String(req.body.prompt || '') }] });
    res.json(JSON.parse(completion.choices[0].message.content || '{}').steps || []);
  } catch { res.status(502).json({ error: 'Step generation failed' }); }
});

testsRouter.post('/parse-step', async (req, res) => {
  try {
    const { action } = req.body;

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-key-here') {
      return res.json({ type: 'click', target: '', value: '', generatedAction: action });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Parse the user\'s test step description into structured fields. Reply with JSON only: {"type": "navigate|fill|click|assert|screenshot", "target": "CSS selector or description", "value": "fill value or assertion text", "generatedAction": "playwright code snippet"}' },
        { role: 'user', content: action },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/tests/:id
testsRouter.get('/:id', async (req, res) => {
  try {
    const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, String(req.params.id)));
    if (!test) return res.status(404).json({ error: 'Not found' });

    const steps = (await db.select().from(schema.testSteps)
      .where(eq(schema.testSteps.testId, String(req.params.id))))
      .sort((a, b) => a.order - b.order);

    res.json({ ...deserializeTest(test), steps });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH /api/tests/:id
testsRouter.patch('/:id', validate(testSchema.partial()), async (req, res) => {
  try {
    const body = req.body;
    const [existing] = await db.select().from(schema.tests).where(eq(schema.tests.id, String(req.params.id)));
    if (!existing) return res.status(404).json({ error: 'Test not found' });
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.mode !== undefined) updates.mode = body.mode;
    if (body.environment !== undefined) updates.environment = body.environment;
    if (body.entryPoint !== undefined) updates.entryPoint = body.entryPoint;
    if (body.auth !== undefined) updates.auth = body.auth;
    if (body.runnerMode !== undefined) updates.runnerMode = body.runnerMode;
    if (body.viewport !== undefined) updates.viewportJson = toJson(body.viewport);
    if (body.triggers !== undefined) updates.triggersJson = toJson(body.triggers);
    if (body.suiteIds !== undefined) updates.suiteIdsJson = toJson(body.suiteIds);
    if (body.defaultReports !== undefined) updates.defaultReportsJson = toJson(body.defaultReports);
    if (body.customPrompt !== undefined) updates.customPrompt = body.customPrompt;
    if (body.estimatedCredits !== undefined) updates.estimatedCredits = body.estimatedCredits;
    if (body.tags !== undefined) updates.tagsJson = toJson(body.tags);
    if (body.selfHealing !== undefined) updates.selfHealing = body.selfHealing;
    if (body.selfHealingSensitivity !== undefined) updates.selfHealingSensitivity = body.selfHealingSensitivity;
    if (body.screenshotOnFailure !== undefined) updates.screenshotOnFailure = body.screenshotOnFailure;
    if (body.archived !== undefined) updates.archived = body.archived;

    await db.transaction(async tx => {
    if (Object.keys(updates).length > 0) {
      await tx.update(schema.tests).set(updates as any).where(eq(schema.tests.id, String(req.params.id)));
    }

    if (body.steps && Array.isArray(body.steps)) {
      await tx.delete(schema.testSteps).where(eq(schema.testSteps.testId, String(req.params.id)));
      for (const step of body.steps) {
        await tx.insert(schema.testSteps).values({
          id: step.id ?? uid(),
          testId: String(req.params.id),
          order: step.order,
          action: step.action,
          isAiGenerated: step.isAiGenerated ?? false,
          generatedAction: step.generatedAction ?? '',
          type: step.type ?? 'click',
          target: step.target ?? '',
          value: step.value ?? '',
          css: step.css ?? false,
          stable: step.stable ?? true,
          pressEnter: step.pressEnter ?? false,
          captureScreenshot: step.captureScreenshot ?? false,
        });
      }
    }

    });

    const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, String(req.params.id)));
    res.json(deserializeTest(test));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/tests/:id
testsRouter.delete('/:id', async (req, res) => {
  try {
    await db.update(schema.tests).set({ archived: true }).where(eq(schema.tests.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/tests/:id/duplicate
testsRouter.post('/:id/duplicate', async (req, res) => {
  try {
    const [original] = await db.select().from(schema.tests).where(eq(schema.tests.id, String(req.params.id)));
    if (!original) return res.status(404).json({ error: 'Not found' });

    const newId = uid();
    await db.insert(schema.tests).values({
      ...original,
      id: newId,
      name: `${original.name} (copy)`,
      status: 'never_run',
      lastRunAt: null,
      lastRunId: null,
      createdAt: now(),
    });

    const steps = await db.select().from(schema.testSteps).where(eq(schema.testSteps.testId, String(req.params.id)));
    for (const step of steps) {
      await db.insert(schema.testSteps).values({ ...step, id: uid(), testId: newId });
    }

    const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, newId));
    res.status(201).json(deserializeTest(test));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/tests/:id/runs
testsRouter.get('/:id/runs', async (req, res) => {
  try {
    const { page = '1' } = req.query as Record<string, string>;
    const all = await db.select().from(schema.runs)
      .where(eq(schema.runs.testId, String(req.params.id)))
      .orderBy(desc(schema.runs.startedAt));

    const pageNum = pageNumber(page);
    const pageSize = 20;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    res.json({ items, total: all.length, page: pageNum });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function deserializeTest(t: typeof schema.tests.$inferSelect) {
  return {
    ...t,
    viewport: parseJson(t.viewportJson, { mode: 'single', single: 'desktop' }),
    triggers: parseJson(t.triggersJson, { onPr: false, onDeploy: false, scheduled: false }),
    suiteIds: parseJson<string[]>(t.suiteIdsJson, []),
    defaultReports: parseJson<string[]>(t.defaultReportsJson, ['standard']),
    tags: parseJson<string[]>(t.tagsJson, []),
  };
}
