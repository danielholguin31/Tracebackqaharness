// ─── Typed API client ─────────────────────────────────────
// All calls go through Vite's /api proxy → http://localhost:3001

const BASE = '/api';
export const currentProjectId = () => window.location.pathname.match(/\/personal\/projects\/([^/]+)/)?.[1] || new URLSearchParams(window.location.search).get('projectId') || undefined;

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const projectId = currentProjectId();
  if (method === 'GET' && /^\/(tests|runs|suites|issues)(\?|$)/.test(path)) {
    const target = new URL(path, window.location.origin);
    if (!target.searchParams.has('projectId')) target.searchParams.set('projectId', projectId || '__team__');
    path = target.pathname + target.search;
  }
  if (method === 'POST' && /^\/(tests|suites)$/.test(path) && body && projectId) body = { ...(body as object), projectId };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => req<T>('GET', path);
const post = <T>(path: string, body?: unknown) => req<T>('POST', path, body);
const patch = <T>(path: string, body: unknown) => req<T>('PATCH', path, body);
const del = <T>(path: string) => req<T>('DELETE', path);
const put = <T>(path: string, body: unknown) => req<T>('PUT', path, body);

// ─── Overview ─────────────────────────────────────────────

export const overview = {
  get: () => get<any>('/overview'),
  trends: (window: '24h' | '7d' | '30d') => get<any[]>(`/overview/trends?window=${window}`),
};

// ─── Tests ────────────────────────────────────────────────

export const tests = {
  list: (params?: { q?: string; mode?: string; archived?: boolean; projectId?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.mode) qs.set('mode', params.mode);
    if (params?.archived) qs.set('archived', 'true');
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.page) qs.set('page', String(params.page));
    const str = qs.toString();
    return get<{ items: any[]; total: number; page: number }>(`/tests${str ? `?${str}` : ''}`);
  },
  get: (id: string) => get<any>(`/tests/${id}`),
  create: (data: any) => post<any>('/tests', data),
  update: (id: string, data: any) => patch<any>(`/tests/${id}`, data),
  delete: (id: string) => del<{ ok: boolean }>(`/tests/${id}`),
  duplicate: (id: string) => post<any>(`/tests/${id}/duplicate`),
  runs: (id: string, page?: number) => get<any>(`/tests/${id}/runs${page ? `?page=${page}` : ''}`),
  estimate: (data: { goal: string; mode: string; runnerMode: string; viewport: any }) =>
    post<{ credits: number; steps: number; breakdown: string }>('/tests/estimate', data),
  parseStep: (action: string) => post<any>('/tests/parse-step', { action }),
  generateSteps: (prompt: string) =>
    post<Array<{ action: string; type: string; target: string; value: string }>>('/tests/generate-steps', { prompt }),
};

// ─── Runs ─────────────────────────────────────────────────

export const runs = {
  list: (params?: { q?: string; status?: string; branch?: string; testId?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.branch) qs.set('branch', params.branch);
    if (params?.testId) qs.set('testId', params.testId);
    if (params?.page) qs.set('page', String(params.page));
    const str = qs.toString();
    return get<{ items: any[]; total: number; page: number }>(`/runs${str ? `?${str}` : ''}`);
  },
  get: (id: string) => get<any>(`/runs/${id}`),
  status: (id: string) => get<any>(`/runs/${id}/status`),
  create: (data: { testId: string; environment?: string; triggeredBy?: string; viewport?: string }) => post<any>('/runs', data),
  pause: (id: string) => post<any>(`/runs/${id}/pause`),
  resume: (id: string, extraCredits?: number) => post<any>(`/runs/${id}/resume`, { extraCredits }),
  applyHeal: (id:string, logId:string) => post<any>(`/runs/${id}/heals/${logId}/apply`),
  abort: (id: string) => post<any>(`/runs/${id}/abort`),
};

// ─── Suites ───────────────────────────────────────────────

export const suites = {
  list: (params?: { q?: string; projectId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.projectId) qs.set('projectId', params.projectId);
    const str = qs.toString();
    return get<{ items: any[] }>(`/suites${str ? `?${str}` : ''}`);
  },
  get: (id: string) => get<any>(`/suites/${id}`),
  create: (data: any) => post<any>('/suites', data),
  update: (id: string, data: any) => patch<any>(`/suites/${id}`, data),
  delete: (id: string) => del<{ ok: boolean }>(`/suites/${id}`),
  run: (id: string) => post<any>(`/suites/${id}/runs`),
  getRun: (suiteRunId: string) => get<any>(`/suites/runs/${suiteRunId}`),
  listRuns: (id: string, page?: number) => get<any>(`/suites/${id}/runs${page ? `?page=${page}` : ''}`),
};

// ─── Issues ───────────────────────────────────────────────

export const issues = {
  list: (params?: { q?: string; status?: string; severity?: string; projectId?: string; runId?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.status) qs.set('status', params.status);
    if (params?.severity) qs.set('severity', params.severity);
    if (params?.runId) qs.set('runId', params.runId);
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.page) qs.set('page', String(params.page));
    const str = qs.toString();
    return get<{ items: any[]; total: number; page: number }>(`/issues${str ? `?${str}` : ''}`);
  },
  get: (id: string) => get<any>(`/issues/${id}`),
  update: (id: string, data: { status?: string; dismissReason?: string }) => patch<any>(`/issues/${id}`, data),
  push: (id: string, target: 'github' | 'linear' | 'jira') => post<any>(`/issues/${id}/push`, { target }),
  agentPrompt: (id: string) => get<{ prompt: string }>(`/issues/${id}/agent-prompt`),
};

// ─── Events ───────────────────────────────────────────────

export const events = {
  list: (params?: { q?: string; type?: string; status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.type) qs.set('type', params.type);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    const str = qs.toString();
    return get<{ items: any[]; total: number; page: number }>(`/events${str ? `?${str}` : ''}`);
  },
  get: (id: string) => get<any>(`/events/${id}`),
};

// ─── Workspace ────────────────────────────────────────────

export const workspace = {
  get: () => get<any>('/workspace'),
  update: (data: { name?: string; slug?: string }) => patch<any>('/workspace', data),
  me: () => get<any>('/workspace/me'),
  members: () => get<any[]>('/workspace/members'),
  invite: (data: { email: string; role?: string }) => post<any>('/workspace/invites', data),
  updateMember: (id: string, data: { role: string }) => patch<any>(`/workspace/members/${id}`, data),
  removeMember: (id: string) => del<{ ok: boolean }>(`/workspace/members/${id}`),
  apiKeys: () => get<any[]>('/workspace/api-keys'),
  createApiKey: (name: string) => post<any>('/workspace/api-keys', { name }),
  deleteApiKey: (id: string) => del<{ ok: boolean }>(`/workspace/api-keys/${id}`),
  integrations: () => get<any>('/workspace/integrations'),
};

// ─── Toolbox ─────────────────────────────────────────────

export const toolbox = {
  getMcp: () => get<any>('/toolbox/mcp'),
  saveMcp: (data: { name: string; url: string; authToken?: string }) => put<any>('/toolbox/mcp', data),
  testMcp: (url: string) => post<{ status: string }>('/toolbox/mcp/test', { url }),
  getAuth: () => get<any[]>('/toolbox/auth'),
  createAuth: (data: any) => post<any>('/toolbox/auth', data),
  deleteAuth: (id: string) => del<{ ok: boolean }>(`/toolbox/auth/${id}`),
  getSecrets: () => get<any[]>('/toolbox/secrets'),
  createSecret: (data: { key: string; value: string }) => post<any>('/toolbox/secrets', data),
  deleteSecret: (id: string) => del<{ ok: boolean }>(`/toolbox/secrets/${id}`),
  getBrowser: () => get<any>('/toolbox/browser'),
  saveBrowser: (data: any) => put<any>('/toolbox/browser', data),
};

// ─── Personal ────────────────────────────────────────────

export const personal = {
  projects: () => get<any[]>('/personal/projects'),
  getProject: (id: string) => get<any>(`/personal/projects/${id}`),
  createProject: (data: { name: string; baseUrl: string; color?: string }) => post<any>('/personal/projects', data),
  updateProject: (id: string, data: any) => patch<any>(`/personal/projects/${id}`, data),
  deleteProject: (id: string) => del<{ ok: boolean }>(`/personal/projects/${id}`),
};

// ─── Usage ───────────────────────────────────────────────

export const usage = {
  get: (period: 'month' | 'alltime' = 'month') => get<any>(`/usage?period=${period}`),
};

// ─── Operator ────────────────────────────────────────────

export const operator = {
  sessions: () => get<any[]>('/operator/sessions'),
  createSession: (title?: string, pageLabel?: string) => post<any>('/operator/sessions', { title, pageLabel }),
  generateTitle: (id: string, message: string) => post<{ title: string }>(`/operator/sessions/${id}/title`, { message }),
  getSession: (id: string) => get<any>(`/operator/sessions/${id}`),
  messages: (id: string) => get<any[]>(`/operator/sessions/${id}/messages`),
  getSettings: () => get<any>('/operator/settings'),
  updateSettings: (data: any) => patch<any>('/operator/settings', data),
  getSkills: () => get<any[]>('/operator/skills'),
  createSkill: (data: { name: string; trigger: string; instruction: string }) => post<any>('/operator/skills', data),
  deleteSkill: (id: string) => del<any>(`/operator/skills/${id}`),
};
