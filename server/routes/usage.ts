import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { WORKSPACE_ID } from '../lib/helpers';

export const usageRouter = Router();

usageRouter.get('/', async (req, res) => {
  try {
    const { period = 'month' } = req.query as Record<string, string>;
    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, WORKSPACE_ID));
    if (!ws) return res.status(404).json({ error: 'Not found' });

    const allRuns = await db.select().from(schema.runs)
      .where(eq(schema.runs.workspaceId, WORKSPACE_ID));
    const allIssues = await db.select().from(schema.issues)
      .where(eq(schema.issues.workspaceId, WORKSPACE_ID));

    const now = new Date();
    const cutoff = period === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      : new Date(0).toISOString();

    const periodRuns = allRuns.filter(r => r.startedAt >= cutoff);
    const periodIssues = allIssues.filter(i => i.createdAt >= cutoff);

    const creditsUsed = periodRuns.reduce((sum, r) => sum + (r.credits ?? 0), 0);
    const agentTimeSavedHours = Math.round(creditsUsed * 0.05 * 10) / 10;

    const history: { date: string; creditsUsed: number; runs: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRuns = allRuns.filter(r => r.startedAt.startsWith(dateStr));
      history.push({
        date: dateStr,
        creditsUsed: dayRuns.reduce((s, r) => s + (r.credits ?? 0), 0),
        runs: dayRuns.length,
      });
    }

    const byTest = new Map<string, { testId: string; testName: string; credits: number; runs: number }>();
    for (const r of periodRuns) {
      const existing = byTest.get(r.testId) ?? { testId: r.testId, testName: r.testName, credits: 0, runs: 0 };
      existing.credits += r.credits ?? 0;
      existing.runs += 1;
      byTest.set(r.testId, existing);
    }
    const topConsumers = Array.from(byTest.values())
      .sort((a, b) => b.credits - a.credits)
      .slice(0, 10);

    res.json({
      period,
      creditsUsed,
      creditsTotal: ws.creditsTotal,
      creditsRemaining: ws.creditsRemaining,
      totalRuns: periodRuns.length,
      issuesFound: periodIssues.length,
      agentTimeSavedHours,
      history,
      topConsumers,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
