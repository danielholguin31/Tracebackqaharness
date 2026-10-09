import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { WORKSPACE_ID, parseJson } from '../lib/helpers';

export const overviewRouter = Router();

// GET /api/overview
overviewRouter.get('/', async (req, res) => {
  try {
    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, WORKSPACE_ID));

    const allRuns = await db.select().from(schema.runs)
      .where(eq(schema.runs.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.runs.startedAt));

    const allIssues = await db.select().from(schema.issues)
      .where(eq(schema.issues.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.issues.createdAt));

    const recentRuns = allRuns.slice(0, 10);
    const openIssues = allIssues.filter(i => i.status === 'open').slice(0, 10).map(i => ({
      ...i,
      screenshots: parseJson<string[]>(i.screenshotsJson, []),
    }));

    const passRate = allRuns.length
      ? Math.round((allRuns.filter(r => r.status === 'passed').length / allRuns.length) * 100)
      : 0;

    const trends = buildTrends(allRuns, '7d');

    res.json({
      workspace: ws,
      recentRuns,
      openIssues,
      stats: {
        totalRuns: allRuns.length,
        passRate,
        openIssues: openIssues.length,
        creditsRemaining: ws?.creditsRemaining ?? 0,
        creditsTotal: ws?.creditsTotal ?? 1000,
      },
      trends,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/overview/trends
overviewRouter.get('/trends', async (req, res) => {
  try {
    const { window: w = '7d' } = req.query as Record<string, string>;
    const allRuns = await db.select().from(schema.runs)
      .where(eq(schema.runs.workspaceId, WORKSPACE_ID));
    res.json(buildTrends(allRuns, w as '24h' | '7d' | '30d'));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function buildTrends(allRuns: typeof schema.runs.$inferSelect[], window: '24h' | '7d' | '30d') {
  const now = new Date();
  const points = window === '24h' ? 24 : window === '7d' ? 7 : 30;
  const buckets: { label: string; runs: number; passed: number; failed: number }[] = [];

  for (let i = points - 1; i >= 0; i--) {
    const d = new Date(now);
    if (window === '24h') {
      d.setHours(d.getHours() - i);
      const label = `${d.getHours()}:00`;
      const start = new Date(d); start.setMinutes(0, 0, 0);
      const end = new Date(d); end.setMinutes(59, 59, 999);
      const bucket = allRuns.filter(r => r.startedAt >= start.toISOString() && r.startedAt <= end.toISOString());
      buckets.push({ label, runs: bucket.length, passed: bucket.filter(r => r.status === 'passed').length, failed: bucket.filter(r => r.status === 'failed').length });
    } else {
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const bucket = allRuns.filter(r => r.startedAt.startsWith(dateStr));
      buckets.push({ label: dateStr.slice(5), runs: bucket.length, passed: bucket.filter(r => r.status === 'passed').length, failed: bucket.filter(r => r.status === 'failed').length });
    }
  }

  return buckets;
}
