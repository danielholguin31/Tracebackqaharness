import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Workspace & Users ────────────────────────────────────

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  planType: text('plan_type').notNull().default('free'),
  creditsRemaining: integer('credits_remaining').notNull().default(1000),
  creditsTotal: integer('credits_total').notNull().default(1000),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
  role: text('role').notNull().default('member'), // owner | admin | member | viewer
  createdAt: text('created_at').notNull(),
});

// ─── Tests ────────────────────────────────────────────────

export const tests = sqliteTable('tests', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'), // null = team test
  name: text('name').notNull(),
  mode: text('mode').notNull(), // autonomous | deterministic
  status: text('status').notNull().default('never_run'), // pass | fail | never_run
  environment: text('environment').notNull().default('staging'),
  entryPoint: text('entry_point').notNull().default(''),
  auth: text('auth').notNull().default(''),
  runnerMode: text('runner_mode').notNull().default('standard'),
  viewportJson: text('viewport_json').notNull().default('{"mode":"single","single":"desktop"}'),
  triggersJson: text('triggers_json').notNull().default('{"onPr":false,"onDeploy":false,"scheduled":false}'),
  suiteIdsJson: text('suite_ids_json').notNull().default('[]'),
  defaultReportsJson: text('default_reports_json').notNull().default('["standard"]'),
  customPrompt: text('custom_prompt'),
  estimatedCredits: integer('estimated_credits'),
  tagsJson: text('tags_json').notNull().default('[]'),
  selfHealing: integer('self_healing', { mode: 'boolean' }).notNull().default(false),
  selfHealingSensitivity: text('self_healing_sensitivity').notNull().default('medium'),
  screenshotOnFailure: integer('screenshot_on_failure', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  lastRunAt: text('last_run_at'),
  lastRunId: text('last_run_id'),
  version: integer('version').notNull().default(1),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
});

export const testSteps = sqliteTable('test_steps', {
  id: text('id').primaryKey(),
  testId: text('test_id').notNull(),
  order: integer('order').notNull(),
  action: text('action').notNull(),
  isAiGenerated: integer('is_ai_generated', { mode: 'boolean' }).notNull().default(false),
  generatedAction: text('generated_action').notNull().default(''),
  type: text('type').notNull().default('click'), // navigate | fill | click | assert | screenshot
  target: text('target').notNull().default(''),
  value: text('value').notNull().default(''),
  css: integer('css', { mode: 'boolean' }).notNull().default(false),
  stable: integer('stable', { mode: 'boolean' }).notNull().default(true),
  pressEnter: integer('press_enter', { mode: 'boolean' }).notNull().default(false),
  captureScreenshot: integer('capture_screenshot', { mode: 'boolean' }).notNull().default(false),
});

// ─── Runs ─────────────────────────────────────────────────

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'),
  testId: text('test_id').notNull(),
  testName: text('test_name').notNull(),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('queued'), // queued | initializing | running | passed | failed | healed | blocked | cancelled | paused
  environment: text('environment').notNull().default('staging'),
  viewport: text('viewport').notNull().default('desktop'),
  runnerMode: text('runner_mode').notNull().default('standard'),
  triggeredBy: text('triggered_by').notNull().default('manual'), // manual | pr | deploy | schedule | webhook | suite | operator
  triggeredByUser: text('triggered_by_user'),
  branch: text('branch'),
  commit: text('commit'),
  duration: real('duration'),
  credits: integer('credits'),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  keyFinding: text('key_finding'),
  screenshotCount: integer('screenshot_count').notNull().default(0),
  issueCount: integer('issue_count').notNull().default(0),
  videoUrl: text('video_url'),
  suiteRunId: text('suite_run_id'),
});

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  step: integer('step').notNull(),
  timestamp: text('timestamp').notNull(), // "00:15.5"
  thought: text('thought').notNull(),
  action: text('action').notNull(),
  isError: integer('is_error', { mode: 'boolean' }).notNull().default(false),
  screenshotUrl: text('screenshot_url'),
});

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  type: text('type').notNull(), // standard | regression | coverage | security | performance | accessibility | custom
  format: text('format').notNull().default('ui'), // ui | pdf
  status: text('status').notNull().default('generating'), // generating | generated | failed
  customPrompt: text('custom_prompt'),
  generatedAt: text('generated_at'),
  downloadUrl: text('download_url'),
});

// ─── Suites ───────────────────────────────────────────────

export const suites = sqliteTable('suites', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'),
  name: text('name').notNull(),
  testIdsJson: text('test_ids_json').notNull().default('[]'),
  triggersJson: text('triggers_json').notNull().default('{"onPr":false,"onDeploy":false,"scheduled":false}'),
  parallel: integer('parallel', { mode: 'boolean' }).notNull().default(false),
  maxConcurrency: integer('max_concurrency'),
  retryFailedTests: text('retry_failed_tests').notNull().default('none'), // none | once | twice
  status: text('status').notNull().default('never_run'),
  lastRunAt: text('last_run_at'),
  lastRunId: text('last_run_id'),
  createdAt: text('created_at').notNull(),
});

export const suiteRuns = sqliteTable('suite_runs', {
  id: text('id').primaryKey(),
  suiteId: text('suite_id').notNull(),
  status: text('status').notNull().default('running'), // running | passed | failed | partial
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  triggeredBy: text('triggered_by').notNull().default('manual'),
});

export const suiteRunResults = sqliteTable('suite_run_results', {
  id: text('id').primaryKey(),
  suiteRunId: text('suite_run_id').notNull(),
  testId: text('test_id').notNull(),
  testName: text('test_name').notNull(),
  runId: text('run_id').notNull(),
  status: text('status').notNull().default('running'),
  duration: real('duration'),
  issueCount: integer('issue_count').notNull().default(0),
});

// ─── Issues ───────────────────────────────────────────────

export const issues = sqliteTable('issues', {
  id: text('id').primaryKey(), // TR-XXXX format
  workspaceId: text('workspace_id').notNull(),
  projectId: text('project_id'),
  runId: text('run_id').notNull(),
  testId: text('test_id').notNull(),
  title: text('title').notNull(),
  severity: text('severity').notNull().default('high'), // critical | high | warning | info
  status: text('status').notNull().default('open'), // open | pushed | resolved | dismissed
  flow: text('flow').notNull(),
  context: text('context').notNull().default(''),
  evidence: text('evidence').notNull().default(''),
  proposedSolution: text('proposed_solution'),
  agentNote: text('agent_note'),
  screenshotsJson: text('screenshots_json').notNull().default('[]'),
  triggeredBy: text('triggered_by').notNull().default('manual'),
  eventId: text('event_id'),
  externalRefJson: text('external_ref_json'),
  dismissReason: text('dismiss_reason'),
  resolvedAt: text('resolved_at'),
  pushedAt: text('pushed_at'),
  createdAt: text('created_at').notNull(),
});

// ─── Events ───────────────────────────────────────────────

export const events = sqliteTable('events', {
  id: text('id').primaryKey(), // ev_XXXX format
  workspaceId: text('workspace_id').notNull(),
  type: text('type').notNull(), // pr | mcp
  summary: text('summary').notNull(),
  prNumber: text('pr_number'),
  branch: text('branch'),
  prUrl: text('pr_url'),
  initiatedAt: text('initiated_at').notNull(),
  completedAt: text('completed_at'),
  duration: real('duration'),
  status: text('status').notNull().default('pass'), // running | pass | fail
  resultJson: text('result_json').notNull().default('{"passed":0,"failed":0}'),
  testIdsJson: text('test_ids_json').notNull().default('[]'),
  runIdsJson: text('run_ids_json').notNull().default('[]'),
  issueIdsJson: text('issue_ids_json').notNull().default('[]'),
  rawPayloadJson: text('raw_payload_json'),
  agentResponse: text('agent_response'),
});

// ─── Operator ─────────────────────────────────────────────

export const operatorSessions = sqliteTable('operator_sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  title: text('title').notNull().default('New Chat'),
  participantsJson: text('participants_json').notNull().default('[]'),
  pageLabel: text('page_label'),  // e.g. "Run: Login SSO" — set when session is created from a specific page
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const operatorMessages = sqliteTable('operator_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(), // user | operator
  content: text('content').notNull(),
  fromUserId: text('from_user_id'),
  componentsJson: text('components_json'), // JSON array of InlineComponent
  reasoningJson: text('reasoning_json'),   // JSON array of thinking step strings
  createdAt: text('created_at').notNull(),
});

export const operatorSettings = sqliteTable('operator_settings', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().unique(),
  autonomyPreset: text('autonomy_preset').notNull().default('balanced'), // supervised | balanced | autonomous
  responseFormat: integer('response_format').notNull().default(50),
  mockupFreq: integer('mockup_freq').notNull().default(50),
  responseLength: integer('response_length').notNull().default(50),
  model: text('model').notNull().default('gpt-4o-mini'), // gpt-4o-mini | gpt-4o
  instructions: text('instructions').notNull().default(''),
  alwaysDo: text('always_do').notNull().default(''),
  neverDo: text('never_do').notNull().default(''),
});

export const operatorSkills = sqliteTable('operator_skills', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),           // display name: "Summarize page"
  trigger: text('trigger').notNull(),     // slash trigger without slash: "summarize"
  instruction: text('instruction').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// ─── Toolbox ──────────────────────────────────────────────

export const toolboxMcp = sqliteTable('toolbox_mcp', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  authToken: text('auth_token'),
  status: text('status').notNull().default('disconnected'),
});

export const toolboxAuth = sqliteTable('toolbox_auth', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  password: text('password'),
  oauthProvider: text('oauth_provider'),
  cookieString: text('cookie_string'),
});

export const toolboxSecrets = sqliteTable('toolbox_secrets', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
});

export const toolboxBrowser = sqliteTable('toolbox_browser', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().unique(),
  headless: integer('headless', { mode: 'boolean' }).notNull().default(true),
  slowMo: integer('slow_mo').notNull().default(0),
  timeout: integer('timeout').notNull().default(30000),
  screenshots: text('screenshots').notNull().default('on-failure'),
});

export const integrations = sqliteTable('integrations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().unique(),
  githubJson: text('github_json').notNull().default('{"installed":false,"repos":[]}'),
  linearJson: text('linear_json').notNull().default('{"installed":false}'),
  jiraJson: text('jira_json').notNull().default('{"installed":false}'),
  slackJson: text('slack_json').notNull().default('{"installed":false}'),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  keyPrefix: text('key_prefix').notNull(), // first 8 chars for display
  createdAt: text('created_at').notNull(),
});

// ─── Personal Projects ────────────────────────────────────

export const personalProjects = sqliteTable('personal_projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  workspaceId: text('workspace_id').notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  color: text('color').notNull().default('#7B8FC2'),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  lastActiveAt: text('last_active_at').notNull(),
});
