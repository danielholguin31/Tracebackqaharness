import { pushIssue } from '../lib/integrations';
import { pageNumber } from '../lib/validation';
import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { now, WORKSPACE_ID, parseJson } from '../lib/helpers';
import { openai } from '../lib/openai';

export const issuesRouter = Router();

// GET /api/issues
issuesRouter.get('/', async (req, res) => {
  try {
    const { q, status, severity, projectId, runId, page = '1' } = req.query as Record<string, string>;
    let all = await db.select().from(schema.issues)
      .where(eq(schema.issues.workspaceId, WORKSPACE_ID))
      .orderBy(desc(schema.issues.createdAt));

    if (status && status !== 'all') all = all.filter(i => i.status === status);
    if (runId) all = all.filter(i => i.runId === runId);
    if (severity && severity !== 'all') all = all.filter(i => i.severity === severity);
    if (projectId) all = all.filter(i => projectId === '__team__' ? !i.projectId : i.projectId === projectId);
    if (q) all = all.filter(i =>
      i.title.toLowerCase().includes(q.toLowerCase()) ||
      i.id.toLowerCase().includes(q.toLowerCase())
    );

    const pageNum = pageNumber(page);
    const pageSize = 50;
    const items = all.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    res.json({ items: items.map(deserializeIssue), total: all.length, page: pageNum });
  } catch (err) {
    res.status(/Configure|unavailable/.test(String(err)) ? 503 : 500).json({ error: String(err) });
  }
});

// GET /api/issues/:id
issuesRouter.get('/:id', async (req, res) => {
  try {
    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, req.params.id));
    if (!issue) return res.status(404).json({ error: 'Not found' });
    res.json(deserializeIssue(issue));
  } catch (err) {
    res.status(/Configure|unavailable/.test(String(err)) ? 503 : 500).json({ error: String(err) });
  }
});

// PATCH /api/issues/:id
issuesRouter.patch('/:id', async (req, res) => {
  try {
    const { status, dismissReason } = req.body;
    const updates: Record<string, unknown> = {};

    if (status !== undefined) updates.status = status;
    if (dismissReason !== undefined) updates.dismissReason = dismissReason;
    if (status === 'resolved') updates.resolvedAt = now();

    await db.update(schema.issues).set(updates as any).where(eq(schema.issues.id, req.params.id));

    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, req.params.id));
    res.json(deserializeIssue(issue));
  } catch (err) {
    res.status(/Configure|unavailable/.test(String(err)) ? 503 : 500).json({ error: String(err) });
  }
});

// POST /api/issues/:id/push
issuesRouter.post('/:id/push', async (req, res) => {
  try {
    const { target } = req.body;
    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, req.params.id));
    if (!issue) return res.status(404).json({ error: 'Not found' });

    const externalRef = await pushIssue(String(req.params.id), target);

    res.json({ url: externalRef.url, externalRef });
  } catch (err) {
    res.status(/Configure|unavailable/.test(String(err)) ? 503 : 500).json({ error: String(err) });
  }
});

// GET /api/issues/:id/agent-prompt
issuesRouter.get('/:id/agent-prompt', async (req, res) => {
  try {
    const [issue] = await db.select().from(schema.issues).where(eq(schema.issues.id, req.params.id));
    if (!issue) return res.status(404).json({ error: 'Not found' });

    let prompt: string;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: `You are a senior software engineer writing a precise, detailed prompt for a coding agent (like Claude, Cursor, or GitHub Copilot) to fix a bug that was automatically detected during a test run.

Write the prompt in second person, addressed to the coding agent. The prompt must be:
- Long and thorough (500–800 words)
- Technically specific: reference the exact error, endpoint, component, or behavior
- Actionable: tell the agent exactly what to find, what to change, and how to verify the fix
- Include a "Verification" section with concrete steps to confirm the fix works
- Include an "Edge cases to consider" section
- Include a "Do NOT do" section to prevent common wrong approaches
- Use markdown headers and bullet points for structure
- Do not pad with fluff; every sentence should be useful to the coding agent`,
          },
          {
            role: 'user',
            content: `Generate a coding agent fix prompt for this issue:

**Issue ID:** ${issue.id}
**Title:** ${issue.title}
**Severity:** ${issue.severity}
**Test / Flow:** ${issue.flow}
**Environment / Context:** ${issue.context}

**Evidence from test run:**
${issue.evidence}

**Proposed solution (human note):**
${issue.proposedSolution || 'None provided.'}

**Agent note:**
${issue.agentNote || 'None.'}`,
          },
        ],
      });
      prompt = completion.choices[0]?.message?.content ?? '';
    } catch {
      prompt = buildFallbackPrompt(issue);
    }
    res.json({ prompt });
  } catch (err) {
    res.status(/Configure|unavailable/.test(String(err)) ? 503 : 500).json({ error: String(err) });
  }
});

function buildFallbackPrompt(issue: typeof schema.issues.$inferSelect): string {
  return `# Fix: ${issue.title}

**Issue ID:** \`${issue.id}\`
**Severity:** ${issue.severity}
**Test / Flow:** ${issue.flow ?? 'N/A'}

---

## Summary

This issue was detected automatically during a test run. Your goal is to locate the root cause, implement a targeted fix, and verify the fix resolves the failure without introducing regressions.

## Evidence

\`\`\`
${issue.evidence ?? 'No evidence captured.'}
\`\`\`

## What to Fix

${issue.proposedSolution
  ? issue.proposedSolution
  : `Investigate the root cause of the failure described in the evidence above. The issue is classified as **${issue.severity}** severity — prioritize a clean, correct fix over a quick workaround.`}

${issue.agentNote ? `\n## Additional Context\n\n${issue.agentNote}\n` : ''}
## Steps to Reproduce

1. Set up the test environment: \`${issue.context ?? 'N/A'}\`
2. Run the test flow: \`${issue.flow ?? 'N/A'}\`
3. Observe the failure described in the evidence section above

## Verification

- Re-run the exact test flow that detected this issue and confirm it passes cleanly
- Inspect the code path(s) implicated by the evidence — read them carefully before editing
- Run related tests in the same module/component to confirm no regressions
- If the fix touches shared utilities or helpers, run the full suite

## Edge Cases to Consider

- Null or undefined values in the relevant data path
- Network failures, timeouts, or slow responses if the issue involves async calls
- State not being reset correctly between test iterations or user sessions
- Concurrent operations if the affected code is called from multiple places

## Do NOT Do

- Do not add empty try/catch blocks or swallow errors silently as a workaround
- Do not modify code unrelated to this specific failure
- Do not rename or reorganize files unless the fix strictly requires it
- Do not skip the Verification steps — a fix that isn't verified may reintroduce the issue
`;
}

function deserializeIssue(i: typeof schema.issues.$inferSelect) {
  return {
    ...i,
    screenshots: parseJson<string[]>(i.screenshotsJson, []),
    externalRef: i.externalRefJson ? parseJson(i.externalRefJson, null) : null,
  };
}
