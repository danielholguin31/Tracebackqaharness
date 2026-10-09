import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { installAuth } from './auth';
import { bootstrap } from './bootstrap';
import { recoverInterruptedRuns } from './lib/runner';
import path from 'node:path';
import { steelBase } from './lib/steel';

import { overviewRouter } from './routes/overview';
import { testsRouter } from './routes/tests';
import { runsRouter } from './routes/runs';
import { suitesRouter } from './routes/suites';
import { issuesRouter } from './routes/issues';
import { eventsRouter } from './routes/events';
import { operatorRouter } from './routes/operator';
import { workspaceRouter } from './routes/workspace';
import { toolboxRouter } from './routes/toolbox';
import { personalRouter } from './routes/personal';
import { usageRouter } from './routes/usage';
import { journeysRouter } from './routes/journeys';
import { tracebackStore } from './lib/traceback-store';
import { recoverMappings } from './lib/journey-mapping';
import { mcpRouter } from './routes/mcp';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

installAuth(app);
await bootstrap();
await recoverInterruptedRuns();
await tracebackStore.init();
await recoverMappings();

app.use('/api/artifacts', express.static(path.resolve('data/artifacts'), { dotfiles: 'deny' }));
// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.get('/api/capabilities', async (_req, res) => {
  let steel = false;
  try { const r = await fetch(steelBase() + '/v1/health', { headers: process.env.STEEL_API_KEY ? { 'steel-api-key': process.env.STEEL_API_KEY } : {}, signal: AbortSignal.timeout(3000) }); steel = r.ok; } catch {}
  res.json({ steel, ai: !!process.env.OPENAI_API_KEY, github: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY), linear: !!(process.env.LINEAR_API_KEY && process.env.LINEAR_TEAM_ID), mode: 'single-owner' });
});

// All routes
app.use('/api/overview', overviewRouter);
app.use('/api/tests', testsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/suites', suitesRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/events', eventsRouter);
app.use('/api/operator', operatorRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/toolbox', toolboxRouter);
app.use('/api/personal', personalRouter);
app.use('/api/usage', usageRouter);
app.use('/api/journeys', journeysRouter);
app.use('/api/mcp', mcpRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
app.use(express.static(path.resolve('dist')));
app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ error: error.status === 400 ? 'Invalid JSON body' : 'Unexpected server error' }));

app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});
