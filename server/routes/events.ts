import { pageNumber } from '../lib/validation';
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { WORKSPACE_ID, parseJson } from '../lib/helpers';

export const eventsRouter = Router();

// GET /api/events
eventsRouter.get('/', async (req, res) => {
  try {
    const { q, type, status, page = '1' } = req.query as Record<string, string>;
    let all = await db.select().from(schema.events)
      .where(eq(schema.events.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.events.initiatedAt));

    if (type && type !== 'all') all = all.filter(e => e.type === type);
    if (status && status !== 'all') all = all.filter(e => e.status === status);
    if (q) all = all.filter(e => e.summary.toLowerCase().includes(q.toLowerCase()));

    const pageNum = pageNumber(page);
    const pageSize = 50;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    res.json({ items: items.map(deserializeEvent), total: all.length, page: pageNum });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/events/:id
eventsRouter.get('/:id', async (req, res) => {
  try {
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, req.params.id));
    if (!event) return res.status(404).json({ error: 'Not found' });

    const runIds = parseJson<string[]>(event.runIdsJson, []);
    const issueIds = parseJson<string[]>(event.issueIdsJson, []);

    const allRuns = await db.select().from(schema.runs);
    const allIssues = await db.select().from(schema.issues);

    const runs = allRuns.filter(r => runIds.includes(r.id));
    const issues = allIssues.filter(i => issueIds.includes(i.id));

    res.json({ ...deserializeEvent(event), runs, issues });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function deserializeEvent(e: typeof schema.events.$inferSelect) {
  return {
    ...e,
    result: parseJson(e.resultJson, { passed: 0, failed: 0 }),
    testIds: parseJson<string[]>(e.testIdsJson, []),
    runIds: parseJson<string[]>(e.runIdsJson, []),
    issueIds: parseJson<string[]>(e.issueIdsJson, []),
    rawPayload: e.rawPayloadJson ? parseJson(e.rawPayloadJson, null) : null,
  };
}
